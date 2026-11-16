/* App TecnoSat — parte 9: Fiado (a receber) e Comissões (só o dono vê) */

// pagamento "de verdade": se era fiado e já foi recebido, vale a forma do recebimento
function fiadoAberto(o) { return o.status === 'entregue' && o.forma_pagamento === 'Fiado' && !(S.orc[o.id] || {}).recebido_em; }
function dinheiroEntrou(o) { // true quando o dinheiro já foi recebido
  if (o.status !== 'entregue') return false;
  return o.forma_pagamento === 'Fiado' ? !!(S.orc[o.id] || {}).recebido_em : true;
}
function dataRecebimento(o) { const r = S.orc[o.id] || {}; return o.forma_pagamento === 'Fiado' ? r.recebido_em : o.entregue_em; }
function pagEfetivo(o) { const r = S.orc[o.id] || {}; return o.forma_pagamento === 'Fiado' ? (r.recebido_em ? 'Fiado (pago em ' + (r.forma_recebimento || '—') + ')' : 'Fiado — a receber') : (o.forma_pagamento || 'Não informado'); }
function diasDevendo(o) { return Math.max(0, Math.floor((Date.now() - new Date(o.entregue_em || o.updated_at)) / 86400000)); }
function pctDe(userId) { const c = S.cfgCom[userId]; return c ? Number(c.percentual) : 0; }
function comissaoDe(o) { // valor da comissão desta OS (ou null se não há)
  if (!o.tecnico) return null;
  const r = S.orc[o.id] || {};
  if (r.comissao_valor != null) return Number(r.comissao_valor);
  if (r.valor_final == null) return null;
  const pct = r.comissao_pct != null ? Number(r.comissao_pct) : pctDe(o.tecnico);
  return Math.round(Number(r.valor_final) * pct) / 100;
}
const dec = (t) => { const b = String(t || '').trim().replace(/\./g, '').replace(',', '.'); return b === '' ? null : Number(b); };

// ---------------------------------------------------------- A receber (fiado)
function telaFiados() {
  const lista = S.ordens.filter(fiadoAberto).sort((a, b) => new Date(a.entregue_em) - new Date(b.entregue_em));
  const total = lista.reduce((s, o) => s + Number((S.orc[o.id] || {}).valor_final || 0), 0);
  moldura('A receber (fiado)', `
    <div class="card"><div class="muted small">Total na rua</div><div style="font-size:28px;font-weight:800;color:var(--vermelho,#c0392b)">${moeda(total)}</div><div class="small muted">${lista.length} aparelho(s) entregue(s) sem pagar</div></div>
    ${lista.map((o) => { const v = (S.orc[o.id] || {}).valor_final; return `
      <div class="card">
        <b>${esc(o.cliente_nome)}</b> <span class="muted small">· OS #${o.numero} · ${esc(o.aparelho || '')}</span>
        <div style="font-size:20px;font-weight:700">${v != null ? moeda(v) : '<span class="alerta small">sem valor registrado</span>'}</div>
        <div class="small ${diasDevendo(o) >= 7 ? 'erro' : 'muted'}">Entregue ${fmtData(o.entregue_em)} · há ${diasDevendo(o)} dia(s) sem pagar</div>
        <div class="btns" style="margin-top:8px">
          <button class="btn zap" data-cobrar="${o.id}">💬 Cobrar no WhatsApp</button>
          <button class="btn ok" data-receber="${o.id}">✔ Receber</button>
          <button class="btn sec" data-abrir="${o.id}">Abrir OS</button>
        </div>
      </div>`; }).join('') || '<p class="muted center">Ninguém devendo. 🎉</p>'}
  `, { voltar: () => ir('menu'), aba: 'menu' });
  $app.querySelectorAll('[data-cobrar]').forEach((b) => b.onclick = () => {
    const o = S.ordens.find((x) => x.id === b.dataset.cobrar); const v = (S.orc[o.id] || {}).valor_final;
    abrirZap(o.cliente_telefone, montarMsg(String(o.cliente_nome).split(' ')[0], 'Passando para lembrar do pagamento do serviço, entregue em ' + fmtData(o.entregue_em) + '. 🧾', ['📱 Aparelho: ' + (o.aparelho || ''), '🧾 OS: *#' + o.numero + '*', v != null ? '💰 Valor: *' + moeda(v) + '*' : null, '', 'Pode nos avisar quando conseguir acertar? Obrigado! 🙏']));
  });
  $app.querySelectorAll('[data-abrir]').forEach((b) => b.onclick = () => abrirOrdem(b.dataset.abrir));
  $app.querySelectorAll('[data-receber]').forEach((b) => b.onclick = () => ir('receber', { ordemId: b.dataset.receber }));
}

function telaReceber() {
  const o = S.ordens.find((x) => x.id === S.ordemId); if (!o) return ir('fiados');
  const r = S.orc[o.id] || {};
  let forma = 'Pix';
  moldura('Receber — OS #' + o.numero, `
    <div class="card">
      <b>${esc(o.cliente_nome)}</b>
      <div style="font-size:24px;font-weight:800">${r.valor_final != null ? moeda(r.valor_final) : '—'}</div>
      <label>Como o cliente pagou?</label>
      <div class="chips quebra" id="r-forma">${PAGAMENTOS.filter((p) => p !== 'Fiado' && p !== 'Sem custo').map((p) => `<button class="chip ${p === forma ? 'ativo' : ''}" data-p="${p}">${p}</button>`).join('')}</div>
      <label>Data do pagamento</label><input type="date" id="r-data" value="${diaChave(new Date())}">
    </div>
    <div class="btns"><button class="btn ok full" id="r-ok">✔ Confirmar recebimento</button></div><div id="r-erro"></div>
  `, { voltar: () => ir('fiados'), semNav: true });
  document.querySelectorAll('#r-forma [data-p]').forEach((b) => b.onclick = () => { forma = b.dataset.p; document.querySelectorAll('#r-forma [data-p]').forEach((x) => x.classList.toggle('ativo', x.dataset.p === forma)); });
  document.getElementById('r-ok').onclick = async () => {
    const d = document.getElementById('r-data').value; if (!d) return alert('Escolha a data.');
    const btn = document.getElementById('r-ok'); btn.disabled = true;
    const { data, error } = await sb.from('orcamentos').upsert({ ordem_id: o.id, recebido_em: new Date(d + 'T12:00:00').toISOString(), forma_recebimento: forma, updated_at: new Date().toISOString() }).select().single();
    if (error) { btn.disabled = false; document.getElementById('r-erro').innerHTML = '<div class="erro">' + esc(erroTexto(error)) + '</div>'; return; }
    S.orc[o.id] = data; toast('✔ Recebimento registrado'); ir('fiados');
  };
}

// ---------------------------------------------------------- Comissões
function telaComissoes() {
  const agora = new Date();
  const mes = S.comMes || (agora.getFullYear() + '-' + pad(agora.getMonth() + 1));
  const funcs = ativos().filter((p) => p.papel === 'funcionario' || p.papel === 'dono');
  const mesDe = (o) => { const d = dataRecebimento(o); return d ? diaChave(d).slice(0, 7) : ''; };
  const itens = S.ordens.filter((o) => o.tecnico && dinheiroEntrou(o) && mesDe(o) === mes && comissaoDe(o) != null && comissaoDe(o) > 0);
  const por = {};
  itens.forEach((o) => { (por[o.tecnico] = por[o.tecnico] || []).push(o); });
  const pendentesFiado = S.ordens.filter((o) => o.tecnico && fiadoAberto(o)).length;
  moldura('Comissões', `
    <div class="card"><h3>Porcentagem de cada pessoa</h3>
      ${funcs.map((p) => `<div style="display:flex;gap:8px;align-items:center;margin:6px 0"><span style="flex:1">${esc(p.nome)}</span><input class="pct" data-u="${p.id}" inputmode="decimal" style="width:80px" value="${pctDe(p.id) ? String(pctDe(p.id)).replace('.', ',') : ''}" placeholder="0"> %</div>`).join('')}
      <button class="btn sec" id="c-salvarpct">Salvar porcentagens</button>
      <p class="muted small">Vale para os aparelhos entregues daqui para frente. Em cada entrega você ainda pode trocar por um valor fixo.</p>
    </div>
    <label>Mês (data em que o dinheiro entrou)</label><input type="month" id="comMes" value="${mes}">
    ${Object.entries(por).map(([uid, os]) => { const tot = os.reduce((s, o) => s + comissaoDe(o), 0); const aPagar = os.filter((o) => !(S.orc[o.id] || {}).comissao_paga_em); const totPagar = aPagar.reduce((s, o) => s + comissaoDe(o), 0);
      return `<div class="card"><h3>${esc(nomeDe(uid))}</h3>
        <div class="small muted">Total do mês: <b>${moeda(tot)}</b> · Falta pagar: <b>${moeda(totPagar)}</b></div>
        ${os.map((o) => { const paga = (S.orc[o.id] || {}).comissao_paga_em; return `<div class="barra-l"><span>OS #${o.numero} · ${esc(o.cliente_nome)} · ${moeda((S.orc[o.id] || {}).valor_final)}</span><b>${moeda(comissaoDe(o))} ${paga ? '✅' : ''}</b></div>`; }).join('')}
        ${aPagar.length ? `<button class="btn ok" data-pagar="${uid}" style="margin-top:8px">Marcar ${moeda(totPagar)} como pago</button>` : '<div class="small muted" style="margin-top:6px">Tudo pago ✅</div>'}
      </div>`; }).join('') || '<p class="muted center">Nenhuma comissão neste mês.</p>'}
    ${pendentesFiado ? `<p class="alerta small">${pendentesFiado} aparelho(s) fiado(s) ainda não pagos — a comissão só aparece depois que o cliente pagar.</p>` : ''}
  `, { voltar: () => ir('menu'), aba: 'menu' });
  document.getElementById('comMes').onchange = (e) => { S.comMes = e.target.value; render(); };
  document.getElementById('c-salvarpct').onclick = async () => {
    const linhas = [...$app.querySelectorAll('.pct')].map((i) => ({ user_id: i.dataset.u, percentual: dec(i.value) || 0, updated_at: new Date().toISOString() }));
    if (linhas.some((l) => isNaN(l.percentual) || l.percentual < 0 || l.percentual > 100)) return alert('Porcentagem inválida (0 a 100).');
    const { data, error } = await sb.from('comissao_config').upsert(linhas).select();
    if (error) return alert(erroTexto(error));
    data.forEach((c) => { S.cfgCom[c.user_id] = c; }); toast('✔ Porcentagens salvas'); render();
  };
  $app.querySelectorAll('[data-pagar]').forEach((b) => b.onclick = async () => {
    const os = (por[b.dataset.pagar] || []).filter((o) => !(S.orc[o.id] || {}).comissao_paga_em);
    if (!confirm('Marcar ' + os.length + ' comissão(ões) de ' + nomeDe(b.dataset.pagar) + ' como paga(s)?')) return;
    const agoraIso = new Date().toISOString();
    const { data, error } = await sb.from('orcamentos').update({ comissao_paga_em: agoraIso }).in('ordem_id', os.map((o) => o.id)).select();
    if (error) return alert(erroTexto(error));
    data.forEach((r) => { S.orc[r.ordem_id] = r; }); toast('✔ Marcado como pago'); render();
  });
}
