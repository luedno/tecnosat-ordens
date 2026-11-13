/* App de Ordens de Serviço — parte 2 de 5 (não precisa mexer) */
  // ---------------------------------------------------------- sincronização em tempo real
  function conectarRealtime() {
    if (S.canal) sb.removeChannel(S.canal);
    S.canal = sb.channel('app-os')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordens' }, (p) => mudouOrdem(p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, (p) => mudouAgenda(p))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'historico' }, (p) => mudouHist(p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orcamentos' }, (p) => mudouOrc(p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'perfis' }, (p) => mudouPerfil(p))
      .subscribe((status) => { S.online = status === 'SUBSCRIBED'; const d = document.getElementById('dot'); if (d) d.className = 'dot' + (S.online ? ' on' : ''); });
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
  // Ao voltar para o app (celular estava bloqueado), recarrega tudo
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && S.perfil && ['dono', 'funcionario'].includes(S.perfil.papel)) {
      await carregarTudo();
      if (S.tela === 'ordem' && S.ordemId) await carregarHist(S.ordemId);
      atualizarTela();
    }
  });

  // Só redesenha se a pessoa não estiver digitando algo
  function atualizarTela() {
    if (!S.perfil || !['dono', 'funcionario'].includes(S.perfil.papel)) return;
    if (['formOrdem', 'formAgenda'].includes(S.tela)) return;
    const ae = document.activeElement;
    if (ae && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ae.tagName) && ae.id !== 'busca') return;
    const sujos = Array.from(document.querySelectorAll('[data-orig]')).some((el) => el.value !== el.dataset.orig);
    if (sujos) return;
    if (S.tela === 'ordens') return desenharLista();
    render();
  }

  // ---------------------------------------------------------- estrutura da tela
  function moldura(titulo, corpo, opt) {
    opt = opt || {};
    const pend = Object.values(S.perfis).filter((p) => p.papel === 'pendente').length;
    const nav = opt.semNav ? '' : `
      <nav class="baixo">
        <button class="${S.tela === 'ordens' ? 'ativo' : ''}" data-ir="ordens"><b>🛠️</b>Ordens</button>
        <button class="${S.tela === 'agenda' ? 'ativo' : ''}" data-ir="agenda"><b>📅</b>Agenda</button>
        ${souDono() ? `<button class="${S.tela === 'equipe' ? 'ativo' : ''}" data-ir="equipe"><b>👥</b>Equipe${pend ? ' (' + pend + ')' : ''}</button>` : ''}
      </nav>`;
    $app.innerHTML = `
      <header class="top">
        ${opt.voltar ? '<button id="voltar">‹ Voltar</button>' : '<span id="dot" class="dot' + (S.online ? ' on' : '') + '" title="Sincronização"></span>'}
        <h1>${esc(titulo)}</h1>
        ${opt.voltar ? '' : '<button id="sair">Sair</button>'}
      </header>
      <div class="wrap">${corpo}</div>
      ${opt.fab ? '<button class="fab" id="fab">+</button>' : ''}
      ${nav}`;
    $app.querySelectorAll('[data-ir]').forEach((b) => b.onclick = () => ir(b.dataset.ir));
    const v = document.getElementById('voltar'); if (v) v.onclick = opt.voltar;
    const s = document.getElementById('sair'); if (s) s.onclick = () => { if (confirm('Sair do app?')) sair(); };
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
      case 'agenda': return telaAgenda();
      case 'formAgenda': return formAgenda();
      case 'equipe': return souDono() ? telaEquipe() : ir('ordens');
      default: S.tela = 'ordens'; return telaOrdens();
    }
  }

  // ---------------------------------------------------------- lista de ordens
  function telaOrdens() {
    moldura(C.NOME_EMPRESA || 'Ordens de Serviço', `
      <input id="busca" type="search" placeholder="🔎 Buscar cliente, telefone, nº ou aparelho" value="${esc(S.busca)}">
      <div class="chips" id="chips" style="margin-top:10px"></div>
      <div id="lista"></div>`, { fab: () => ir('formOrdem', { ordemId: null, prefill: null, novasFotos: [] }) });
    document.getElementById('busca').oninput = (e) => { S.busca = e.target.value; desenharLista(); };
    desenharLista();
  }
  function desenharLista() {
    const chipsEl = document.getElementById('chips'), lista = document.getElementById('lista');
    if (!chipsEl || !lista) return render();
    const cont = (f) => S.ordens.filter((o) => f(o)).length;
    const filtros = [['abertas', 'Abertas', (o) => !FECHADAS.includes(o.status)]]
      .concat(STATUS.map(([k, r]) => [k, r, (o) => o.status === k]))
      .concat([['todas', 'Todas', () => true]]);
    chipsEl.innerHTML = filtros.map(([k, r, f]) => {
      const n = cont(f); if (n === 0 && k !== S.filtro && !['abertas', 'todas'].includes(k)) return '';
      return `<button class="chip ${S.filtro === k ? 'ativo' : ''}" data-f="${k}">${r} (${n})</button>`;
    }).join('');
    chipsEl.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { S.filtro = b.dataset.f; desenharLista(); });
    const fAtual = (filtros.find((x) => x[0] === S.filtro) || filtros[0])[2];
    const q = S.busca.toLowerCase().trim(), qd = q.replace(/\D/g, '');
    const itens = S.ordens.filter(fAtual).filter((o) => {
      if (!q) return true;
      const txt = [o.cliente_nome, o.aparelho, o.marca, o.modelo, o.defeito, o.numero_serie, '#' + o.numero, String(o.numero)].join(' ').toLowerCase();
      return txt.includes(q) || (qd.length >= 3 && String(o.cliente_telefone || '').replace(/\D/g, '').includes(qd));
    });
    if (!itens.length) { lista.innerHTML = '<div class="vazio">Nenhuma ordem aqui.<br>Toque no <b>+</b> para cadastrar um aparelho.</div>'; return; }
    lista.innerHTML = itens.map((o) => `
      <div class="card os-item" data-id="${o.id}">
        <div class="os-linha">
          <span class="os-num">OS #${o.numero}</span>
          <span class="badge st-${o.status}">${ST[o.status]}</span>
        </div>
        <div class="os-titulo">${esc([o.aparelho, o.marca, o.modelo].filter(Boolean).join(' · '))}</div>
        <div>${esc(o.cliente_nome)}</div>
        ${o.defeito ? `<div class="muted small" style="margin-top:4px">${esc(o.defeito.length > 90 ? o.defeito.slice(0, 90) + '…' : o.defeito)}</div>` : ''}
        <div class="os-linha small muted" style="margin-top:6px">
          <span>Entrada ${fmtData(o.created_at)}${o.previsao ? ' · Previsão ' + fmtDia(o.previsao) : ''}</span>
          ${o.orcamento_status !== 'sem' ? `<span class="badge orc-${o.orcamento_status}">${ORC[o.orcamento_status]}</span>` : ''}
        </div>
      </div>`).join('');
    lista.querySelectorAll('[data-id]').forEach((c) => c.onclick = () => abrirOrdem(c.dataset.id));
  }

  async function abrirOrdem(id) {
    S.ordemId = id; S.tela = 'ordem';
    render(); window.scrollTo(0, 0);
    await carregarHist(id);
    if (S.tela === 'ordem' && S.ordemId === id) atualizarTela();
  }
  async function carregarHist(id) {
    const { data, error } = await sb.from('historico').select('*').eq('ordem_id', id).order('created_at');
    if (!error) S.hist[id] = data;
  }
