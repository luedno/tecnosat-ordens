-- =====================================================================
--  APP DE ORDENS DE SERVIÇO — BANCO DE DADOS (Supabase)
--  Cole TUDO isto no Supabase > SQL Editor > New query > Run
--  Pode rodar de novo sem problema (não apaga seus dados).
-- =====================================================================

-- ---------- 1. PERFIS (quem usa o app) ----------
create table if not exists public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  email text,
  papel text not null default 'pendente'
    check (papel in ('dono','funcionario','pendente','bloqueado')),
  created_at timestamptz not null default now()
);

-- O PRIMEIRO cadastro vira "dono". Os próximos ficam "pendente" até o dono liberar.
create or replace function public.novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, nome, email, papel)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'nome',''), split_part(new.email,'@',1)),
    new.email,
    case when exists (select 1 from public.perfis where papel = 'dono') then 'pendente' else 'dono' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.novo_usuario();

create or replace function public.eh_dono() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and papel = 'dono')
$$;

create or replace function public.eh_ativo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and papel in ('dono','funcionario'))
$$;

-- ---------- 2. ORDENS DE SERVIÇO ----------
create table if not exists public.ordens (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  cliente_nome text not null,
  cliente_telefone text,
  aparelho text not null,
  marca text,
  modelo text,
  numero_serie text,
  acessorios text,
  defeito text,
  diagnostico text,
  observacoes text,
  status text not null default 'recebido' check (status in
    ('recebido','em_analise','aguardando_aprovacao','aguardando_peca','em_conserto','pronto','entregue','sem_conserto')),
  orcamento_status text not null default 'sem' check (orcamento_status in ('sem','aguardando','aprovado','recusado')),
  previsao date,
  fotos text[] not null default '{}',
  criado_por uuid references public.perfis(id) on delete set null default auth.uid(),
  atualizado_por uuid references public.perfis(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 3. HISTÓRICO (quem fez o quê) ----------
create table if not exists public.historico (
  id bigint generated always as identity primary key,
  ordem_id uuid not null references public.ordens(id) on delete cascade,
  usuario uuid references public.perfis(id) on delete set null default auth.uid(),
  texto text not null,
  created_at timestamptz not null default now()
);

-- ---------- 4. ORÇAMENTOS (valores — só o dono vê) ----------
create table if not exists public.orcamentos (
  ordem_id uuid primary key references public.ordens(id) on delete cascade,
  valor numeric(10,2),
  detalhes text,
  updated_at timestamptz not null default now()
);

-- ---------- 5. AGENDAMENTOS ----------
create table if not exists public.agendamentos (
  id uuid primary key default gen_random_uuid(),
  cliente_nome text not null,
  cliente_telefone text,
  endereco text,
  aparelho text,
  descricao text,
  data_hora timestamptz not null,
  responsavel uuid references public.perfis(id) on delete set null,
  status text not null default 'agendado' check (status in ('agendado','feito','cancelado')),
  criado_por uuid references public.perfis(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---------- 6. REGISTRO AUTOMÁTICO NO HISTÓRICO ----------
create or replace function public.rotulo_status(s text) returns text language sql immutable as $$
  select case s
    when 'recebido' then 'Recebido'
    when 'em_analise' then 'Em análise'
    when 'aguardando_aprovacao' then 'Aguardando aprovação'
    when 'aguardando_peca' then 'Aguardando peça'
    when 'em_conserto' then 'Em conserto'
    when 'pronto' then 'Pronto'
    when 'entregue' then 'Entregue'
    when 'sem_conserto' then 'Sem conserto'
    else s end
$$;

create or replace function public.ordem_antes_update() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.atualizado_por := coalesce(auth.uid(), new.atualizado_por);
  return new;
end $$;

drop trigger if exists ordem_antes_update on public.ordens;
create trigger ordem_antes_update before update on public.ordens
  for each row execute function public.ordem_antes_update();

create or replace function public.ordem_registrar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into historico (ordem_id, usuario, texto) values (new.id, auth.uid(), 'Ordem de serviço criada');
    return new;
  end if;
  if new.status is distinct from old.status then
    insert into historico (ordem_id, usuario, texto)
    values (new.id, auth.uid(), 'Situação: ' || rotulo_status(old.status) || ' → ' || rotulo_status(new.status));
  end if;
  if coalesce(new.diagnostico,'') is distinct from coalesce(old.diagnostico,'') then
    insert into historico (ordem_id, usuario, texto) values (new.id, auth.uid(), 'Diagnóstico atualizado');
  end if;
  if new.orcamento_status is distinct from old.orcamento_status then
    insert into historico (ordem_id, usuario, texto) values (new.id, auth.uid(),
      'Orçamento: ' || case new.orcamento_status when 'sem' then 'sem orçamento' when 'aguardando' then 'aguardando o cliente'
        when 'aprovado' then 'APROVADO pelo cliente' when 'recusado' then 'RECUSADO pelo cliente' end);
  end if;
  if cardinality(new.fotos) > cardinality(old.fotos) then
    insert into historico (ordem_id, usuario, texto) values (new.id, auth.uid(),
      (cardinality(new.fotos) - cardinality(old.fotos))::text || ' foto(s) adicionada(s)');
  end if;
  return new;
end $$;

drop trigger if exists ordem_registrar on public.ordens;
create trigger ordem_registrar after insert or update on public.ordens
  for each row execute function public.ordem_registrar();

-- ---------- 7. SEGURANÇA (quem pode ver/editar) ----------
alter table public.perfis enable row level security;
alter table public.ordens enable row level security;
alter table public.historico enable row level security;
alter table public.orcamentos enable row level security;
alter table public.agendamentos enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.perfis, public.ordens, public.historico,
  public.orcamentos, public.agendamentos to authenticated;

drop policy if exists perfis_ver on public.perfis;
create policy perfis_ver on public.perfis for select to authenticated
  using (id = auth.uid() or public.eh_ativo());
drop policy if exists perfis_dono_edita on public.perfis;
create policy perfis_dono_edita on public.perfis for update to authenticated
  using (public.eh_dono()) with check (public.eh_dono());

drop policy if exists ordens_ver on public.ordens;
create policy ordens_ver on public.ordens for select to authenticated using (public.eh_ativo());
drop policy if exists ordens_criar on public.ordens;
create policy ordens_criar on public.ordens for insert to authenticated with check (public.eh_ativo());
drop policy if exists ordens_editar on public.ordens;
create policy ordens_editar on public.ordens for update to authenticated
  using (public.eh_ativo()) with check (public.eh_ativo());
drop policy if exists ordens_apagar on public.ordens;
create policy ordens_apagar on public.ordens for delete to authenticated using (public.eh_dono());

drop policy if exists historico_ver on public.historico;
create policy historico_ver on public.historico for select to authenticated using (public.eh_ativo());
drop policy if exists historico_anotar on public.historico;
create policy historico_anotar on public.historico for insert to authenticated
  with check (public.eh_ativo() and usuario = auth.uid());

drop policy if exists orcamentos_dono on public.orcamentos;
create policy orcamentos_dono on public.orcamentos for all to authenticated
  using (public.eh_dono()) with check (public.eh_dono());

drop policy if exists agenda_ver on public.agendamentos;
create policy agenda_ver on public.agendamentos for select to authenticated using (public.eh_ativo());
drop policy if exists agenda_criar on public.agendamentos;
create policy agenda_criar on public.agendamentos for insert to authenticated with check (public.eh_ativo());
drop policy if exists agenda_editar on public.agendamentos;
create policy agenda_editar on public.agendamentos for update to authenticated
  using (public.eh_ativo()) with check (public.eh_ativo());
drop policy if exists agenda_apagar on public.agendamentos;
create policy agenda_apagar on public.agendamentos for delete to authenticated using (public.eh_dono());

-- ---------- 8. FOTOS ----------
insert into storage.buckets (id, name, public) values ('fotos', 'fotos', false)
  on conflict (id) do nothing;

drop policy if exists fotos_ver on storage.objects;
create policy fotos_ver on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and public.eh_ativo());
drop policy if exists fotos_enviar on storage.objects;
create policy fotos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and public.eh_ativo());
drop policy if exists fotos_apagar on storage.objects;
create policy fotos_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and public.eh_dono());

-- ---------- 9. SINCRONIZAÇÃO EM TEMPO REAL ----------
do $$
declare t text;
begin
  foreach t in array array['ordens','historico','orcamentos','agendamentos','perfis'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- Pronto! Deve aparecer "Success. No rows returned".
