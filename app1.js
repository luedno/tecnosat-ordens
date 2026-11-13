/* =====================================================================
   APP DE ORDENS DE SERVIÇO — não precisa mexer aqui.
   As configurações ficam no arquivo config.js
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

  const S = {
    user: null, perfil: null, perfis: {}, ordens: [], agenda: [], orc: {}, hist: {},
    tela: 'ordens', filtro: 'abertas', busca: '', ordemId: null, agId: null, agFiltro: 'proximos',
    online: false, canal: null, iniciado: null, fotoUrls: {}, prefill: null, novasFotos: []
  };

  // ---------------------------------------------------------- utilidades
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const souDono = () => S.perfil && S.perfil.papel === 'dono';
  const nomeDe = (id) => (S.perfis[id] && S.perfis[id].nome) || '—';
  const moeda = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const pad = (n) => String(n).padStart(2, '0');
  function fmtData(d) { if (!d) return ''; const x = new Date(d); return pad(x.getDate()) + '/' + pad(x.getMonth() + 1) + '/' + x.getFullYear(); }
  function fmtDataHora(d) { const x = new Date(d); return fmtData(x) + ' ' + pad(x.getHours()) + ':' + pad(x.getMinutes()); }
  function fmtHora(d) { const x = new Date(d); return pad(x.getHours()) + ':' + pad(x.getMinutes()); }
  function fmtDia(dateOnly) { const [a, m, d] = dateOnly.split('-'); return d + '/' + m + '/' + a; }
  function diaChave(d) { const x = new Date(d); return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); }
  function rotuloDia(chave) {
    const hoje = diaChave(new Date()); const am = new Date(); am.setDate(am.getDate() + 1);
    const ont = new Date(); ont.setDate(ont.getDate() - 1);
    const sem = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const [a, m, d] = chave.split('-').map(Number); const dt = new Date(a, m - 1, d);
    if (chave === hoje) return 'Hoje — ' + fmtDia(chave);
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
    let d = String(t || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.length === 10 || d.length === 11) d = '55' + d;
    return d;
  }
  function abrirZap(fone, texto) {
    const n = foneZap(fone);
    window.open('https://wa.me/' + n + '?text=' + encodeURIComponent(texto), '_blank');
  }
  const val = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };

  // ---------------------------------------------------------- verificação da configuração
  if (!C.SUPABASE_URL || C.SUPABASE_URL.includes('COLE_AQUI') || !C.SUPABASE_ANON_KEY || C.SUPABASE_ANON_KEY.includes('COLE_AQUI')) {
    $app.innerHTML = '<div class="login"><div class="logo">⚙️</div><h1>Falta configurar</h1>' +
      '<p>Abra o arquivo <b>config.js</b> no GitHub e cole a <b>Project URL</b> e a chave <b>anon public</b> do Supabase.</p></div>';
    throw new Error('config');
  }
  if (!window.supabase) {
    $app.innerHTML = '<div class="login"><div class="logo">📶</div><h1>Sem conexão</h1><p>Não consegui carregar o app. Verifique a internet e abra de novo.</p></div>';
    throw new Error('sem supabase');
  }
  const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
  document.title = (C.NOME_EMPRESA || 'Ordens de Serviço');

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

  // ---------------------------------------------------------- login
  function telaLogin(modo) {
    modo = modo || 'entrar';
    const criar = modo === 'criar';
    $app.innerHTML = `
      <div class="login">
        <div class="logo">🛠️</div>
        <h1>${esc(C.NOME_EMPRESA || 'Ordens de Serviço')}</h1>
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
          if (!data.session) {
            document.getElementById('l-erro').innerHTML = '<div class="erro" style="background:#dcfce7;color:#166534">Conta criada! Abra seu e-mail e clique no link de confirmação. Depois volte aqui e entre.</div>';
          }
        } else {
          const { error } = await sb.auth.signInWithPassword({ email, password: senha });
          if (error) throw error;
        }
      } catch (e) {
        const msg = /Invalid login/i.test(e.message) ? 'E-mail ou senha errados.\n\n(' + e.message + ')' :
          /not confirmed/i.test(e.message) ? 'Você ainda não confirmou o e-mail. Abra seu e-mail e clique no link.\n\n(' + e.message + ')' : erroTexto(e);
        mostrarErro(msg);
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
          <p>${bloq ? 'Seu acesso foi bloqueado pelo dono.' : 'Sua conta foi criada. Peça ao dono para liberar seu acesso no app (aba <b>Equipe</b>).'}</p>
          <div class="btns">
            <button class="btn" id="p-ver">Verificar de novo</button>
            <button class="btn sec" id="p-sair">Sair</button>
          </div>
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
      $app.innerHTML = '<div class="login"><div class="logo">⚠️</div><h1>Banco não configurado</h1><div class="card">' +
        '<p>Não encontrei seu perfil. Confira se você rodou o arquivo <b>supabase.sql</b> no SQL Editor do Supabase.</p>' +
        (error ? '<div class="erro">' + esc(erroTexto(error)) + '</div>' : '') +
        '<div class="btns"><button class="btn sec" id="x-sair">Sair</button></div></div></div>';
      document.getElementById('x-sair').onclick = sair;
      return;
    }
    S.perfil = data;
    conectarRealtime();
    if (!['dono', 'funcionario'].includes(data.papel)) return telaPendente();
    $app.innerHTML = '<div class="center muted">Carregando dados…</div>';
    await carregarTudo();
    render();
  }

  async function carregarTudo() {
    const desde = new Date(); desde.setDate(desde.getDate() - 60);
    const pedidos = [
      sb.from('perfis').select('*').order('nome'),
      sb.from('ordens').select('*').order('created_at', { ascending: false }).limit(1000),
      sb.from('agendamentos').select('*').gte('data_hora', desde.toISOString()).order('data_hora')
    ];
    if (souDono()) pedidos.push(sb.from('orcamentos').select('*'));
    const res = await Promise.all(pedidos);
    const falha = res.find((r) => r.error);
    if (falha) { erro(falha.error, 'carregar dados'); return; }
    S.perfis = Object.fromEntries(res[0].data.map((p) => [p.id, p]));
    S.ordens = res[1].data;
    S.agenda = res[2].data;
    if (res[3]) S.orc = Object.fromEntries(res[3].data.map((o) => [o.ordem_id, o]));
  }
