/* App TecnoSat — parte 2 de 8: lista de ordens (não precisa mexer) */

function parados() {
  const lp = Number(S.loja.alerta_pronto || 15), lc = Number(S.loja.alerta_peca || 10);
  const pronto = S.ordens.filter((o) => o.status === 'pronto' && diasDesde(o.updated_at) >= lp);
  const peca = S.ordens.filter((o) => o.status === 'aguardando_peca' && diasDesde(o.updated_at) >= lc);
  const aprov = S.ordens.filter((o) => o.status === 'aguardando_aprovacao' && diasDesde(o.updated_at) >= 5);
  const naoAprov = S.ordens.filter((o) => o.status === 'nao_aprovado' && diasDesde(o.updated_at) >= lp);
  return { pronto, peca, aprov, naoAprov, lp, lc, ids: new Set([...pronto, ...peca, ...aprov, ...naoAprov].map((o) => o.id)) };
}

function telaOrdens() {
  moldura(empresa(), `
    <input id="busca" type="search" placeholder="🔎 Buscar cliente, telefone, nº ou aparelho" value="${esc(S.busca)}">
    <div class="seg" id="seg">
      <button data-meu="todas" class="${S.meu === 'todas' ? 'ativo' : ''}">Todas</button>
      <button data-meu="minhas" class="${S.meu === 'minhas' ? 'ativo' : ''}">Minhas</button>
      <button data-meu="semtec" class="${S.meu === 'semtec' ? 'ativo' : ''}">Sem técnico</button>
    </div>
    <div id="alertas"></div>
    <div class="chips" id="chips"></div>
    <div id="lista"></div>`, { fab: () => ir('formOrdem', { ordemId: null, prefill: null, novasFotos: [] }) });
  document.getElementById('busca').oninput = (e) => { S.busca = e.target.value; desenharLista(); };
  document.querySelectorAll('[data-meu]').forEach((b) => b.onclick = () => {
    S.meu = b.dataset.meu;
    document.querySelectorAll('[data-meu]').forEach((x) => x.classList.toggle('ativo', x === b));
    desenharLista();
  });
  desenharLista();
}

function desenharLista() {
  const chipsEl = document.getElementById('chips'), lista = document.getElementById('lista'), alertasEl = document.getElementById('alertas');
  if (!chipsEl || !lista) return render();
  const pr = parados();
  const base = S.ordens.filter((o) => S.meu === 'todas' || (S.meu === 'minhas' ? o.tecnico === S.user.id : !o.tecnico));

  // Alertas de aparelhos parados
  const avisos = [];
  if (pr.pronto.length) avisos.push(`<b>${pr.pronto.length}</b> pronto(s) há mais de ${pr.lp} dias sem retirada`);
  if (pr.peca.length) avisos.push(`<b>${pr.peca.length}</b> aguardando peça há mais de ${pr.lc} dias`);
  if (pr.aprov.length) avisos.push(`<b>${pr.aprov.length}</b> aguardando aprovação há mais de 5 dias`);
  if (pr.naoAprov.length) avisos.push(`<b>${pr.naoAprov.length}</b> não aprovado(s) há mais de ${pr.lp} dias sem o cliente buscar`);
  alertasEl.innerHTML = avisos.length ? `<div class="alerta" id="verParados">⚠️ ${avisos.join('<br>⚠️ ')}<div class="small" style="margin-top:4px">Toque para ver</div></div>` : '';
  const vp = document.getElementById('verParados'); if (vp) vp.onclick = () => { S.filtro = 'parados'; desenharLista(); };

  const filtros = [['abertas', 'Abertas', (o) => !FECHADAS.includes(o.status)]]
    .concat(pr.ids.size ? [['parados', '⚠️ Parados', (o) => pr.ids.has(o.id)]] : [])
    .concat(STATUS.map(([k, r]) => [k, r, (o) => o.status === k]))
    .concat([['garantia', '🛡️ Em garantia', (o) => o.garantia_ate && o.garantia_ate >= hojeChave()], ['todas', 'Todas', () => true]]);
  chipsEl.innerHTML = filtros.map(([k, r, f]) => {
    const n = base.filter(f).length;
    if (n === 0 && k !== S.filtro && !['abertas', 'todas'].includes(k)) return '';
    return `<button class="chip ${S.filtro === k ? 'ativo' : ''}" data-f="${k}">${r} (${n})</button>`;
  }).join('');
  chipsEl.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { S.filtro = b.dataset.f; desenharLista(); });
  const fAtual = (filtros.find((x) => x[0] === S.filtro) || filtros[0])[2];
  const q = S.busca.toLowerCase().trim(), qd = digitos(q);
  const itens = base.filter(fAtual).filter((o) => {
    if (!q) return true;
    const txt = [o.cliente_nome, o.aparelho, o.marca, o.modelo, o.defeito, o.numero_serie, '#' + o.numero, String(o.numero)].join(' ').toLowerCase();
    return txt.includes(q) || (qd.length >= 3 && digitos(o.cliente_telefone).includes(qd));
  });
  if (!itens.length) {
    lista.innerHTML = `<div class="vazio">Nenhuma ordem aqui.${S.meu === 'minhas' ? '<br>Nenhuma OS está com você como técnico.' : '<br>Toque no <b>+</b> para cadastrar um aparelho.'}</div>`;
    return;
  }
  lista.innerHTML = itens.slice(0, 300).map(cardOrdem).join('') + (itens.length > 300 ? '<div class="vazio">Mostrando 300 de ' + itens.length + '. Use a busca.</div>' : '');
  lista.querySelectorAll('[data-id]').forEach((c) => c.onclick = () => abrirOrdem(c.dataset.id));
}

function cardOrdem(o) {
  const pr = parados();
  const gar = o.garantia_ate && o.garantia_ate >= hojeChave();
  return `
    <div class="card os-item ${pr.ids.has(o.id) ? 'parado' : ''}" data-id="${o.id}">
      <div class="os-linha">
        <span class="os-num">OS #${o.numero}</span>
        <span class="badge st-${o.status}">${ST[o.status]}</span>
      </div>
      <div class="os-titulo">${esc([o.aparelho, o.marca, o.modelo].filter(Boolean).join(' · '))}</div>
      <div>${esc(o.cliente_nome)}</div>
      ${o.defeito ? `<div class="muted small" style="margin-top:4px">${esc(o.defeito.length > 90 ? o.defeito.slice(0, 90) + '…' : o.defeito)}</div>` : ''}
      <div class="os-linha small muted" style="margin-top:6px">
        <span>${o.tecnico ? '👤 ' + esc(nomeDe(o.tecnico)) + ' · ' : ''}Entrada ${fmtData(o.created_at)}${o.previsao ? ' · Prev. ' + fmtDia(o.previsao) : ''}</span>
        ${gar ? '<span class="badge orc-aprovado">🛡️ Garantia</span>' : o.orcamento_status !== 'sem' && !FECHADAS.includes(o.status) ? `<span class="badge orc-${o.orcamento_status}">${ORC[o.orcamento_status]}</span>` : ''}
      </div>
    </div>`;
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
async function salvarOrdem(id, campos, msg) {
  const { data, error } = await sb.from('ordens').update(campos).eq('id', id).select().single();
  if (error) { erro(error, 'salvar'); return null; }
  const i = S.ordens.findIndex((x) => x.id === id); if (i >= 0) S.ordens[i] = data;
  if ('diagnostico' in campos) { const d = document.getElementById('diag'); if (d) d.dataset.orig = d.value; }
  if (document.activeElement) document.activeElement.blur();
  if (msg) toast('✔ ' + msg);
  await carregarHist(id);
  atualizarTela();
  return data;
}
