/* =====================================================================
   APP TECNOSAT — ORDENS DE SERVIÇO (parte 1 de 8: base) — não precisa mexer.
   ===================================================================== */
const C = window.CONFIG || {};
const $app = document.getElementById('app');

const STATUS = [
  ['recebido', 'Recebido'], ['em_analise', 'Em análise'], ['aguardando_aprovacao', 'Aguardando aprovação'],
  ['aguardando_peca', 'Aguardando peça'], ['em_conserto', 'Em conserto'], ['pronto', 'Pronto'],
  ['entregue', 'Entregue'], ['sem_conserto', 'Sem conserto']
];
const ST = Object.fromEntries(STATUS);
const FECHADAS = ['entregue', 'sem_conserto'];
const ORC = { sem: 'Sem orçamento', aguardando: 'Aguardando cliente', aprovado: 'Aprovado', recusado: 'Recusado' };
const APARELHOS = ['TV', 'Celular', 'Notebook', 'Computador', 'Tablet', 'Micro-ondas', 'Aparelho de som', 'Caixa de som',
  'Videogame', 'Controle', 'Receptor / Antena', 'Ar-condicionado', 'Geladeira', 'Máquina de lavar', 'Ventilador', 'Liquidificador'];
const CHECKLIST = ['Liga', 'Não liga', 'Tela trincada', 'Riscos / amassados', 'Sem tampa', 'Sinais de umidade',
  'Sem bateria', 'Botões com defeito', 'Lacre violado', 'Com cartão / chip'];
const PAGAMENTOS = ['Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Sem custo'];

const S = {
  user: null, perfil: null, perfis: {}, ordens: [], agenda: [], orc: {}, hist: {}, clientes: [], loja: {},
  tela: 'ordens', filtro: 'abertas', meu: 'todas', busca: '', ordemId: null, agId: null, clienteId: null,
  agFiltro: 'proximos', cliBusca: '', relMes: null,
  online: false, canal: null, iniciado: null, fotoUrls: {}, prefill: null, novasFotos: [], voltarPara: null
};

// ---------------------------------------------------------- utilidades
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const souDono = () => S.perfil && S.perfil.papel === 'dono';
const ativos = () => Object.values(S.perfis).filter((p) => ['dono', 'funcionario'].includes(p.papel)).sort((a, b) => a.nome.localeCompare(b.nome));
const nomeDe = (id) => (S.perfis[id] && S.perfis[id].nome) || '—';
const moeda = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pad = (n) => String(n).padStart(2, '0');
const digitos = (t) => String(t || '').replace(/\D/g, '');
const empresa = () => (S.loja && S.loja.nome) || C.NOME_EMPRESA || 'TecnoSat';
function fmtData(d) { if (!d) return ''; const x = new Date(d); return pad(x.getDate()) + '/' + pad(x.getMonth() + 1) + '/' + x.getFullYear(); }
function fmtDataHora(d) { const x = new Date(d); return fmtData(x) + ' ' + pad(x.getHours()) + ':' + pad(x.getMinutes()); }
function fmtHora(d) { const x = new Date(d); return pad(x.getHours()) + ':' + pad(x.getMinutes()); }
function fmtDia(dateOnly) { if (!dateOnly) return ''; const [a, m, d] = dateOnly.split('-'); return d + '/' + m + '/' + a; }
function diaChave(d) { const x = new Date(d); return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); }
const hojeChave = () => diaChave(new Date());
function diasDesde(d) { return Math.floor((Date.now() - new Date(d).getTime()) / 86400000); }
function rotuloDia(chave) {
  const am = new Date(); am.setDate(am.getDate() + 1);
  const ont = new Date(); ont.setDate(ont.getDate() - 1);
  const sem = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const [a, m, d] = chave.split('-').map(Number); const dt = new Date(a, m - 1, d);
  if (chave === hojeChave()) return 'Hoje — ' + fmtDia(chave);
  if (chave === diaChave(am)) return 'Amanhã — ' + fmtDia(chave);
  if (chave === diaChave(ont)) return 'Ontem — ' + fmtDia(chave);
  return sem[dt.getDay()] + ' — ' + fmtDia(chave);
}
function erroTexto(e) {
  if (!e) return 'Erro desconhecido';
  const partes = [e.message || String(e)];
  if (e.code) partes.push('código: ' + e.code);
  if (e.details) partes.push(e.details);
  if (e.hint) partes.push('dica: ' + e.hint);
  return partes.join('\n');
}
let toastTimer;
function toast(msg, ms) {
  const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms || 2600);
}
function erro(e, onde) { console.error(onde, e); alert('Deu erro' + (onde ? ' (' + onde + ')' : '') + ':\n\n' + erroTexto(e)); }
function foneZap(t) {
  let d = digitos(t);
  if (!d) return '';
  if (d.length === 10 || d.length === 11) d = '55' + d;
  return d;
}
function abrirZap(fone, texto) { window.open('https://wa.me/' + foneZap(fone) + '?text=' + encodeURIComponent(texto), '_blank'); }
const val = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
const linkCliente = (o) => location.origin + '/status.html?t=' + o.token;
function ordensDoCliente(cli) {
  if (!cli) return [];
  const d = digitos(cli.telefone);
  return S.ordens.filter((o) => o.cliente_id === cli.id || (d.length >= 8 && digitos(o.cliente_telefone) === d));
}
// Garantia ativa de outra OS do mesmo cliente (para avisar quando o aparelho volta)
function garantiaAtiva(clienteId, fone, excetoId, naData) {
  const d = digitos(fone); const ref = naData ? diaChave(naData) : hojeChave();
  return S.ordens.filter((o) => o.id !== excetoId && o.garantia_ate && o.garantia_ate >= ref &&
    ((clienteId && o.cliente_id === clienteId) || (d.length >= 8 && digitos(o.cliente_telefone) === d)));
}
function baixarArquivo(nome, conteudo, tipo) {
  const blob = new Blob(['﻿' + conteudo], { type: tipo || 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// ---------------------------------------------------------- verificação da configuração
if (!C.SUPABASE_URL || C.SUPABASE_URL.includes('COLE_AQUI') || !C.SUPABASE_ANON_KEY || C.SUPABASE_ANON_KEY.includes('COLE_AQUI')) {
  $app.innerHTML = '<div class="login"><div class="logo">⚙️</div><h1>Falta configurar</h1><p>Confira o arquivo <b>config.js</b>.</p></div>';
  throw new Error('config');
}
if (!window.supabase) {
  $app.innerHTML = '<div class="login"><div class="logo">📶</div><h1>Sem conexão</h1><p>Não consegui carregar o app. Verifique a internet e abra de novo.</p></div>';
  throw new Error('sem supabase');
}
const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

// ---------------------------------------------------------- login
function telaLogin(modo) {
  modo = modo || 'entrar';
  const criar = modo === 'criar';
  $app.innerHTML = `
    <div class="login">
      <div class="logo">🛠️</div>
      <h1>${esc(C.NOME_EMPRESA || 'TecnoSat')}</h1>
      <div class="card">
        ${criar ? '<label>Seu nome</label><input id="l-nome" autocomplete="name">' : ''}
        <label>E-mail</label><input id="l-email" type="email" autocomplete="email" inputmode="email">
        <label>Senha</label><input id="l-senha" type="password" autocomplete="${criar ? 'new-password' : 'current-password'}">
        ${criar ? '<p class="muted small">Mínimo de 6 caracteres.</p>' : ''}
        <div class="btns"><button class="btn full" id="l-ok">${criar ? 'Criar conta' : 'Entrar'}</button></div>
        <div id="l-erro"></div>
      </div>
      <p class="center small">${criar
        ? 'Já tem conta? <a href="#" class="link" id="l-troca">Entrar</a>'
        : 'Primeira vez? <a href="#" class="link" id="l-troca">Criar conta</a>'}</p>
    </div>`;
  document.getElementById('l-troca').onclick = (e) => { e.preventDefault(); telaLogin(criar ? 'entrar' : 'criar'); };
  const ok = document.getElementById('l-ok');
  const mostrarErro = (t) => { document.getElementById('l-erro').innerHTML = '<div class="erro">' + esc(t) + '</div>'; };
  ok.onclick = async () => {
    const email = val('l-email'), senha = document.getElementById('l-senha').value;
    if (!email || !senha) return mostrarErro('Preencha e-mail e senha.');
    ok.disabled = true;
    try {
      if (criar) {
        const nome = val('l-nome');
        if (!nome) { ok.disabled = false; return mostrarErro('Preencha seu nome.'); }
        const { data, error } = await sb.auth.signUp({ email, password: senha, options: { data: { nome } } });
        if (error) throw error;
        if (!data.session) document.getElementById('l-erro').innerHTML = '<div class="erro ok">Conta criada! Confira seu e-mail e depois entre.</div>';
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
      }
    } catch (e) {
      mostrarErro(/Invalid login/i.test(e.message) ? 'E-mail ou senha errados.\n\n(' + e.message + ')' : erroTexto(e));
    }
    ok.disabled = false;
  };
}

function telaPendente() {
  const bloq = S.perfil && S.perfil.papel === 'bloqueado';
  $app.innerHTML = `
    <div class="login">
      <div class="logo">${bloq ? '⛔' : '⏳'}</div>
      <h1>${bloq ? 'Acesso bloqueado' : 'Aguardando liberação'}</h1>
      <div class="card">
        <p>Olá, <b>${esc(S.perfil ? S.perfil.nome : '')}</b>.</p>
        <p>${bloq ? 'Seu acesso foi bloqueado pelo dono.' : 'Sua conta foi criada. Peça ao dono para liberar seu acesso no app (Menu &gt; Equipe).'}</p>
        <div class="btns"><button class="btn" id="p-ver">Verificar de novo</button><button class="btn sec" id="p-sair">Sair</button></div>
      </div>
    </div>`;
  document.getElementById('p-ver').onclick = () => { S.iniciado = null; sb.auth.getSession().then(({ data }) => iniciar(data.session)); };
  document.getElementById('p-sair').onclick = sair;
}

async function sair() {
  if (S.canal) { sb.removeChannel(S.canal); S.canal = null; }
  await sb.auth.signOut();
}

// ---------------------------------------------------------- início
async function iniciar(session) {
  if (!session) {
    S.user = null; S.perfil = null; S.iniciado = null;
    if (S.canal) { sb.removeChannel(S.canal); S.canal = null; }
    return telaLogin();
  }
  if (S.iniciado === session.user.id) return;
  S.iniciado = session.user.id;
  S.user = session.user;
  const { data, error } = await sb.from('perfis').select('*').eq('id', S.user.id).maybeSingle();
  if (error || !data) {
    S.iniciado = null;
    $app.innerHTML = '<div class="login"><div class="logo">⚠️</div><h1>Não encontrei seu perfil</h1><div class="card">' +
      (error ? '<div class="erro">' + esc(erroTexto(error)) + '</div>' : '<p>Tente sair e entrar de novo.</p>') +
      '<div class="btns"><button class="btn sec" id="x-sair">Sair</button></div></div></div>';
    document.getElementById('x-sair').onclick = sair;
    return;
  }
  S.perfil = data;
  conectarRealtime();
  if (!['dono', 'funcionario'].includes(data.papel)) return telaPendente();
  $app.innerHTML = '<div class="center muted">Carregando dados…</div>';
  await carregarTudo();
  // Abriu por uma notificação? (?os=... ou ?tela=...)
  const q = new URLSearchParams(location.search);
  if (q.get('os') && S.ordens.some((o) => o.id === q.get('os'))) { S.tela = 'ordem'; S.ordemId = q.get('os'); }
  else if (q.get('tela')) S.tela = q.get('tela');
  if (location.search) history.replaceState(null, '', location.pathname);
  render();
  if (S.tela === 'ordem') carregarHist(S.ordemId).then(atualizarTela);
}

async function carregarTudo() {
  const desde = new Date(); desde.setDate(desde.getDate() - 90);
  const pedidos = [
    sb.from('perfis').select('*').order('nome'),
    sb.from('ordens').select('*').order('created_at', { ascending: false }).limit(3000),
    sb.from('agendamentos').select('*').gte('data_hora', desde.toISOString()).order('data_hora'),
    sb.from('clientes').select('*').order('nome').limit(5000),
    sb.from('loja').select('*').eq('id', 1).maybeSingle()
  ];
  if (souDono()) pedidos.push(sb.from('orcamentos').select('*'));
  const res = await Promise.all(pedidos);
  const falha = res.find((r) => r.error);
  if (falha) { erro(falha.error, 'carregar dados'); return; }
  S.perfis = Object.fromEntries(res[0].data.map((p) => [p.id, p]));
  S.ordens = res[1].data;
  S.agenda = res[2].data;
  S.clientes = res[3].data;
  S.loja = res[4].data || {};
  if (res[5]) S.orc = Object.fromEntries(res[5].data.map((o) => [o.ordem_id, o]));
}

// ---------------------------------------------------------- sincronização em tempo real
function conectarRealtime() {
  if (S.canal) sb.removeChannel(S.canal);
  const on = (tabela, fn, evento) => ({ tabela, fn, evento: evento || '*' });
  const lista = [
    on('ordens', mudouOrdem), on('agendamentos', mudouAgenda), on('historico', mudouHist, 'INSERT'),
    on('orcamentos', mudouOrc), on('perfis', mudouPerfil), on('clientes', mudouCliente), on('loja', (p) => { if (p.new) S.loja = p.new; atualizarTela(); })
  ];
  let canal = sb.channel('app-os');
  lista.forEach((x) => { canal = canal.on('postgres_changes', { event: x.evento, schema: 'public', table: x.tabela }, x.fn); });
  S.canal = canal.subscribe((status) => {
    S.online = status === 'SUBSCRIBED';
    const d = document.getElementById('dot'); if (d) d.className = 'dot' + (S.online ? ' on' : '');
  });
}
function aplicar(lista, p, chave) {
  chave = chave || 'id';
  if (p.eventType === 'DELETE') return lista.filter((x) => x[chave] !== p.old[chave]);
  const i = lista.findIndex((x) => x[chave] === p.new[chave]);
  if (i >= 0) { const c = lista.slice(); c[i] = p.new; return c; }
  return null;
}
function mudouOrdem(p) {
  const r = aplicar(S.ordens, p);
  if (r) S.ordens = r;
  else if (p.eventType === 'INSERT') {
    S.ordens = [p.new].concat(S.ordens);
    if (p.new.criado_por !== S.user.id) {
      toast('🔔 Nova OS #' + p.new.numero + ' — ' + p.new.aparelho + ' (' + nomeDe(p.new.criado_por) + ')', 4000);
      if (navigator.vibrate) navigator.vibrate(200);
    }
  }
  atualizarTela();
}
function mudouAgenda(p) {
  const r = aplicar(S.agenda, p);
  if (r) S.agenda = r;
  else if (p.eventType === 'INSERT') {
    S.agenda = S.agenda.concat([p.new]).sort((a, b) => new Date(a.data_hora) - new Date(b.data_hora));
    if (p.new.criado_por !== S.user.id) toast('📅 Novo agendamento: ' + p.new.cliente_nome + ' ' + fmtDataHora(p.new.data_hora), 4000);
  }
  atualizarTela();
}
function mudouCliente(p) {
  const r = aplicar(S.clientes, p);
  if (r) S.clientes = r; else if (p.eventType === 'INSERT') S.clientes = S.clientes.concat([p.new]);
  atualizarTela();
}
function mudouHist(p) {
  const h = p.new;
  if (S.hist[h.ordem_id] && !S.hist[h.ordem_id].some((x) => x.id === h.id)) S.hist[h.ordem_id].push(h);
  if (S.tela === 'ordem' && S.ordemId === h.ordem_id) atualizarTela();
}
function mudouOrc(p) {
  if (p.eventType === 'DELETE') delete S.orc[p.old.ordem_id]; else S.orc[p.new.ordem_id] = p.new;
  atualizarTela();
}
async function mudouPerfil(p) {
  if (p.eventType !== 'DELETE') {
    S.perfis[p.new.id] = p.new;
    if (p.new.id === S.user.id) {
      const antes = S.perfil.papel; S.perfil = p.new;
      if (antes !== p.new.papel) { S.iniciado = null; const { data } = await sb.auth.getSession(); return iniciar(data.session); }
    }
  }
  atualizarTela();
}
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && S.perfil && ['dono', 'funcionario'].includes(S.perfil.papel)) {
    await carregarTudo();
    if (S.tela === 'ordem' && S.ordemId) await carregarHist(S.ordemId);
    atualizarTela();
  }
});

// Só redesenha se a pessoa não estiver digitando
const TELAS_FORM = ['formOrdem', 'formAgenda', 'entrega', 'loja', 'formCliente'];
function atualizarTela() {
  if (!S.perfil || !['dono', 'funcionario'].includes(S.perfil.papel)) return;
  if (TELAS_FORM.includes(S.tela) || S.tela === 'comprovante') return;
  const ae = document.activeElement;
  if (ae && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ae.tagName) && !['busca', 'cliBusca'].includes(ae.id)) return;
  if (Array.from(document.querySelectorAll('[data-orig]')).some((el) => el.value !== el.dataset.orig)) return;
  if (S.tela === 'ordens') return desenharLista();
  if (S.tela === 'clientes') return desenharClientes();
  render();
}

// ---------------------------------------------------------- moldura das telas
function moldura(titulo, corpo, opt) {
  opt = opt || {};
  const pend = Object.values(S.perfis).filter((p) => p.papel === 'pendente').length;
  const aba = (t, ic, nome, extra) => `<button class="${(S.tela === t || (opt.aba === t)) ? 'ativo' : ''}" data-ir="${t}"><b>${ic}</b>${nome}${extra || ''}</button>`;
  const nav = opt.semNav ? '' : `
    <nav class="baixo">
      ${aba('ordens', '🛠️', 'Ordens')}${aba('agenda', '📅', 'Agenda')}${aba('clientes', '👤', 'Clientes')}
      ${aba('menu', '☰', 'Menu', souDono() && pend ? ' <span class="bolinha">' + pend + '</span>' : '')}
    </nav>`;
  $app.innerHTML = `
    <header class="top">
      ${opt.voltar ? '<button id="voltar">‹ Voltar</button>' : '<span id="dot" class="dot' + (S.online ? ' on' : '') + '" title="Sincronização"></span>'}
      <h1>${esc(titulo)}</h1>
      ${opt.direita || ''}
    </header>
    <div class="wrap">${corpo}</div>
    ${opt.fab ? '<button class="fab" id="fab">+</button>' : ''}
    ${nav}`;
  $app.querySelectorAll('[data-ir]').forEach((b) => b.onclick = () => ir(b.dataset.ir));
  const v = document.getElementById('voltar'); if (v) v.onclick = opt.voltar;
  const f = document.getElementById('fab'); if (f) f.onclick = opt.fab;
}
function ir(tela, extra) {
  S.tela = tela; Object.assign(S, extra || {});
  render(); window.scrollTo(0, 0);
}
function render() {
  switch (S.tela) {
    case 'ordem': return telaOrdem();
    case 'formOrdem': return formOrdem();
    case 'entrega': return telaEntrega();
    case 'comprovante': return telaComprovante();
    case 'agenda': return telaAgenda();
    case 'formAgenda': return formAgenda();
    case 'clientes': return telaClientes();
    case 'cliente': return telaCliente();
    case 'formCliente': return formCliente();
    case 'menu': return telaMenu();
    case 'equipe': return souDono() ? telaEquipe() : ir('menu');
    case 'relatorio': return souDono() ? telaRelatorio() : ir('menu');
    case 'loja': return souDono() ? telaLoja() : ir('menu');
    default: S.tela = 'ordens'; return telaOrdens();
  }
}
