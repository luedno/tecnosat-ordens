/* App TecnoSat — parte 6 de 8: clientes (não precisa mexer) */

function telaClientes() {
  moldura('Clientes', `
    <input id="cliBusca" type="search" placeholder="🔎 Buscar por nome ou telefone" value="${esc(S.cliBusca)}">
    <div id="cliLista" style="margin-top:10px"></div>
  `, { fab: () => ir('formCliente', { clienteId: null }) });
  document.getElementById('cliBusca').oninput = (e) => { S.cliBusca = e.target.value; desenharClientes(); };
  desenharClientes();
}

function desenharClientes() {
  const el = document.getElementById('cliLista'); if (!el) return render();
  const q = S.cliBusca.toLowerCase().trim(), qd = digitos(q);
  // conta OS por cliente
  const qtd = {};
  S.ordens.forEach((o) => { if (o.cliente_id) qtd[o.cliente_id] = (qtd[o.cliente_id] || 0) + 1; });
  const lista = S.clientes.filter((c) => !q || c.nome.toLowerCase().includes(q) || (qd.length >= 3 && (c.telefone_digitos || '').includes(qd)))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  if (!lista.length) { el.innerHTML = '<div class="vazio">Nenhum cliente encontrado.<br>Os clientes são cadastrados automaticamente quando você cria uma OS.</div>'; return; }
  el.innerHTML = `<p class="muted small">${lista.length} cliente(s)</p>` + lista.slice(0, 200).map((c) => `
    <div class="card os-item" data-cli="${c.id}">
      <div class="os-linha"><b>${esc(c.nome)}</b><span class="badge st-recebido">${qtd[c.id] || 0} OS</span></div>
      <div class="small muted">${esc(c.telefone || 'sem telefone')}${c.endereco ? ' · ' + esc(c.endereco) : ''}</div>
    </div>`).join('');
  el.querySelectorAll('[data-cli]').forEach((d) => d.onclick = () => ir('cliente', { clienteId: d.dataset.cli }));
}

function telaCliente() {
  const c = S.clientes.find((x) => x.id === S.clienteId);
  if (!c) return ir('clientes');
  const oss = ordensDoCliente(c).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const gar = oss.filter((o) => o.garantia_ate && o.garantia_ate >= hojeChave());
  const total = souDono() ? oss.reduce((s, o) => s + Number((S.orc[o.id] || {}).valor_final || 0), 0) : 0;
  moldura(c.nome, `
    <div class="card">
      <div style="font-size:18px;font-weight:700">${esc(c.nome)}</div>
      ${c.telefone ? `<div><a class="link" href="tel:${esc(c.telefone.replace(/[^\d+]/g, ''))}">📞 ${esc(c.telefone)}</a></div>` : ''}
      ${c.endereco ? `<div class="small">📍 ${esc(c.endereco)}</div>` : ''}
      ${c.observacoes ? `<div class="small muted" style="margin-top:6px">${esc(c.observacoes)}</div>` : ''}
      <div class="small muted" style="margin-top:6px">Cliente desde ${fmtData(c.created_at)} · ${oss.length} OS${souDono() && total ? ' · total gasto ' + moeda(total) : ''}</div>
      <div class="btns">
        ${c.telefone ? '<button class="btn zap" id="cZap">💬 WhatsApp</button>' : ''}
        <button class="btn" id="cNova">+ Nova OS</button>
        <button class="btn sec" id="cAg">📅 Agendar</button>
        <button class="btn sec" id="cEd">✏️</button>
      </div>
    </div>
    ${gar.map((g) => `<div class="alerta verde">🛡️ OS #${g.numero} (${esc(g.aparelho)}) em garantia até ${fmtDia(g.garantia_ate)}</div>`).join('')}
    <div class="dia">Histórico de aparelhos</div>
    ${oss.map(cardOrdem).join('') || '<div class="vazio">Nenhuma OS ainda.</div>'}
  `, { voltar: () => ir('clientes'), aba: 'clientes' });
  const $ = (id) => document.getElementById(id);
  if ($('cZap')) $('cZap').onclick = () => abrirZap(c.telefone, `Olá ${c.nome.split(' ')[0]}! Aqui é da ${empresa()}.`);
  $('cNova').onclick = () => ir('formOrdem', { ordemId: null, novasFotos: [], voltarPara: 'cliente', prefill: { cliente_id: c.id, cliente_nome: c.nome, cliente_telefone: c.telefone } });
  $('cAg').onclick = () => ir('formAgenda', { agId: null, voltarPara: 'cliente', prefill: { cliente_nome: c.nome, cliente_telefone: c.telefone, endereco: c.endereco } });
  $('cEd').onclick = () => ir('formCliente', { clienteId: c.id });
  $app.querySelectorAll('[data-id]').forEach((d) => d.onclick = () => { S.voltarPara = 'cliente'; abrirOrdem(d.dataset.id); });
}

function formCliente() {
  const c = S.clienteId ? (S.clientes.find((x) => x.id === S.clienteId) || {}) : {};
  const v = (k) => esc(c[k] || '');
  moldura(S.clienteId ? 'Editar cliente' : 'Novo cliente', `
    <div class="card">
      <label>Nome *</label><input id="k-nome" value="${v('nome')}">
      <label>Telefone / WhatsApp</label><input id="k-telefone" type="tel" inputmode="tel" value="${v('telefone')}">
      <label>Endereço</label><input id="k-endereco" value="${v('endereco')}">
      <label>Observações</label><textarea id="k-obs">${v('observacoes')}</textarea>
    </div>
    <div class="btns"><button class="btn full" id="k-salvar">Salvar</button></div>
    ${S.clienteId && souDono() ? '<div class="btns" style="margin-bottom:24px"><button class="btn perigo full" id="k-apagar">🗑️ Apagar cliente</button></div>' : ''}
    <div id="k-erro"></div>
  `, { voltar: () => ir(S.clienteId ? 'cliente' : 'clientes'), semNav: true });
  const $ = (id) => document.getElementById(id);
  $('k-salvar').onclick = async () => {
    const campos = { nome: val('k-nome'), telefone: val('k-telefone') || null, endereco: val('k-endereco') || null, observacoes: val('k-obs') || null };
    if (!campos.nome) return alert('Preencha o nome.');
    const d = digitos(campos.telefone);
    const dup = d.length >= 8 && S.clientes.find((x) => x.telefone_digitos === d && x.id !== S.clienteId);
    if (dup && !confirm('Já existe um cliente com esse telefone: ' + dup.nome + '.\nSalvar mesmo assim?')) return;
    $('k-salvar').disabled = true;
    const res = S.clienteId ? await sb.from('clientes').update(campos).eq('id', S.clienteId).select().single()
      : await sb.from('clientes').insert(campos).select().single();
    $('k-salvar').disabled = false;
    if (res.error) { $('k-erro').innerHTML = '<div class="erro">' + esc(erroTexto(res.error)) + '</div>'; return; }
    const i = S.clientes.findIndex((x) => x.id === res.data.id);
    if (i >= 0) S.clientes[i] = res.data; else S.clientes.push(res.data);
    toast('✔ Cliente salvo'); ir('cliente', { clienteId: res.data.id });
  };
  if ($('k-apagar')) $('k-apagar').onclick = async () => {
    if (!confirm('Apagar o cliente ' + c.nome + '?\nAs ordens de serviço dele NÃO serão apagadas.')) return;
    const { error } = await sb.from('clientes').delete().eq('id', S.clienteId);
    if (error) return erro(error, 'apagar cliente');
    S.clientes = S.clientes.filter((x) => x.id !== S.clienteId); toast('Cliente apagado'); ir('clientes');
  };
}
