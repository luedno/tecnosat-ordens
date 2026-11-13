/* App TecnoSat — parte 5 de 8: agenda (não precisa mexer) */

function telaAgenda() {
  const agora = new Date(); const hojeIni = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const filtros = {
    proximos: (a) => a.status === 'agendado',
    meus: (a) => a.status === 'agendado' && (a.responsavel === S.user.id || !a.responsavel),
    feitos: (a) => a.status !== 'agendado',
    todos: () => true
  };
  let itens = S.agenda.filter(filtros[S.agFiltro] || filtros.proximos);
  if (S.agFiltro === 'feitos') itens = itens.slice().reverse();
  const grupos = {};
  itens.forEach((a) => { const k = diaChave(a.data_hora); (grupos[k] = grupos[k] || []).push(a); });
  const html = Object.keys(grupos).map((k) => `
    <div class="dia">${rotuloDia(k)}</div>
    ${grupos[k].map((a) => {
      const atrasado = a.status === 'agendado' && new Date(a.data_hora) < hojeIni;
      return `
      <div class="card">
        <div class="os-linha">
          <span class="os-num">${fmtHora(a.data_hora)}</span>
          <span class="badge ${a.status === 'feito' ? 'st-pronto' : a.status === 'cancelado' ? 'st-sem_conserto' : atrasado ? 'st-aguardando_peca' : 'st-em_analise'}">
            ${a.status === 'feito' ? 'Feito' : a.status === 'cancelado' ? 'Cancelado' : atrasado ? 'Atrasado' : 'Agendado'}</span>
        </div>
        <div class="os-titulo">${esc(a.cliente_nome)}${a.aparelho ? ' — ' + esc(a.aparelho) : ''}</div>
        ${a.endereco ? `<div class="small">📍 ${esc(a.endereco)}</div>` : ''}
        ${a.descricao ? `<div class="small muted" style="margin-top:4px">${esc(a.descricao)}</div>` : ''}
        <div class="small muted" style="margin-top:4px">👤 Responsável: ${esc(a.responsavel ? nomeDe(a.responsavel) : 'qualquer um')}</div>
        <div class="btns">
          ${a.status === 'agendado' ? `<button class="btn ok" data-feito="${a.id}">✓ Feito</button>` : ''}
          ${a.cliente_telefone ? `<button class="btn zap" data-zap="${a.id}">💬</button>` : ''}
          ${a.endereco ? `<a class="btn sec" target="_blank" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.endereco)}">🗺️</a>` : ''}
          <button class="btn sec" data-os="${a.id}">+ OS</button>
          <button class="btn sec" data-ed="${a.id}">✏️</button>
        </div>
      </div>`;
    }).join('')}`).join('');
  moldura('Agenda', `
    <div class="chips">
      <button class="chip ${S.agFiltro === 'proximos' ? 'ativo' : ''}" data-af="proximos">A fazer</button>
      <button class="chip ${S.agFiltro === 'meus' ? 'ativo' : ''}" data-af="meus">Meus</button>
      <button class="chip ${S.agFiltro === 'feitos' ? 'ativo' : ''}" data-af="feitos">Feitos / cancelados</button>
      <button class="chip ${S.agFiltro === 'todos' ? 'ativo' : ''}" data-af="todos">Todos</button>
    </div>
    ${html || '<div class="vazio">Nenhum agendamento.<br>Toque no <b>+</b> para marcar uma visita ou avaliação.</div>'}
  `, { fab: () => ir('formAgenda', { agId: null }) });
  $app.querySelectorAll('[data-af]').forEach((b) => b.onclick = () => { S.agFiltro = b.dataset.af; render(); });
  const acha = (id) => S.agenda.find((x) => x.id === id);
  $app.querySelectorAll('[data-feito]').forEach((b) => b.onclick = async () => {
    const { error } = await sb.from('agendamentos').update({ status: 'feito' }).eq('id', b.dataset.feito);
    if (error) return erro(error, 'agenda');
    acha(b.dataset.feito).status = 'feito'; toast('✔ Marcado como feito'); render();
  });
  $app.querySelectorAll('[data-zap]').forEach((b) => b.onclick = () => {
    const a = acha(b.dataset.zap);
    abrirZap(a.cliente_telefone, `Olá ${a.cliente_nome.split(' ')[0]}! Aqui é da ${empresa()}. Confirmando nossa visita no dia ${fmtData(a.data_hora)} às ${fmtHora(a.data_hora)}${a.aparelho ? ' para olhar seu aparelho (' + a.aparelho + ')' : ''}. Tudo certo?`);
  });
  $app.querySelectorAll('[data-ed]').forEach((b) => b.onclick = () => ir('formAgenda', { agId: b.dataset.ed }));
  $app.querySelectorAll('[data-os]').forEach((b) => b.onclick = () => {
    const a = acha(b.dataset.os);
    const d = digitos(a.cliente_telefone);
    const cli = d.length >= 8 ? S.clientes.find((c) => c.telefone_digitos === d) : null;
    ir('formOrdem', { ordemId: null, novasFotos: [], voltarPara: 'agenda', prefill: { cliente_id: cli ? cli.id : null, cliente_nome: a.cliente_nome, cliente_telefone: a.cliente_telefone, aparelho: a.aparelho, defeito: a.descricao, tecnico: a.responsavel, _agId: a.status === 'agendado' ? a.id : null } });
  });
}

function formAgenda() {
  const a = S.agId ? (S.agenda.find((x) => x.id === S.agId) || {}) : (S.prefill || {});
  const v = (k) => esc(a[k] || '');
  const dt = a.data_hora ? new Date(a.data_hora) : null;
  const amanha = new Date(); amanha.setDate(amanha.getDate() + 1);
  moldura(S.agId ? 'Editar agendamento' : 'Novo agendamento', `
    <div class="card">
      <label>Nome do cliente *</label><input id="a-cliente_nome" value="${v('cliente_nome')}" list="lista-cli">
      <datalist id="lista-cli">${S.clientes.slice(0, 500).map((c) => `<option value="${esc(c.nome)}">`).join('')}</datalist>
      <label>Telefone / WhatsApp</label><input id="a-cliente_telefone" type="tel" inputmode="tel" value="${v('cliente_telefone')}">
      <label>Endereço</label><input id="a-endereco" value="${v('endereco')}" placeholder="Rua, número, bairro">
      <label>Aparelho</label><input id="a-aparelho" list="lista-ap2" value="${v('aparelho')}">
      <datalist id="lista-ap2">${APARELHOS.map((x) => `<option value="${x}">`).join('')}</datalist>
      <label>O que precisa ser feito</label><textarea id="a-descricao">${v('descricao')}</textarea>
      <div class="linha2">
        <div><label>Dia *</label><input id="a-dia" type="date" value="${dt ? diaChave(dt) : diaChave(amanha)}"></div>
        <div><label>Hora *</label><input id="a-hora" type="time" value="${dt ? fmtHora(dt) : '09:00'}"></div>
      </div>
      <label>Responsável</label>
      <select id="a-responsavel">
        <option value="">Qualquer um</option>
        ${ativos().map((p) => `<option value="${p.id}" ${a.responsavel === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}
      </select>
      ${S.agId ? `<label>Situação</label><select id="a-status">
        ${[['agendado', 'Agendado'], ['feito', 'Feito'], ['cancelado', 'Cancelado']].map(([k, r]) => `<option value="${k}" ${a.status === k ? 'selected' : ''}>${r}</option>`).join('')}
      </select>` : ''}
    </div>
    <div class="btns"><button class="btn full" id="a-salvar">Salvar</button></div>
    ${S.agId && souDono() ? '<div class="btns" style="margin-bottom:24px"><button class="btn perigo full" id="a-apagar">🗑️ Apagar agendamento</button></div>' : ''}
    <div id="a-erro"></div>
  `, { voltar: () => { S.prefill = null; ir(S.voltarPara || 'agenda', { voltarPara: null }); }, semNav: true });

  const $ = (id) => document.getElementById(id);
  // Ao escolher um cliente cadastrado, completa telefone e endereço
  $('a-cliente_nome').onchange = () => {
    const c = S.clientes.find((x) => x.nome === $('a-cliente_nome').value);
    if (c) { if (!$('a-cliente_telefone').value) $('a-cliente_telefone').value = c.telefone || ''; if (!$('a-endereco').value) $('a-endereco').value = c.endereco || ''; }
  };
  $('a-salvar').onclick = async (ev) => {
    const btn = ev.target;
    const dia = val('a-dia'), hora = val('a-hora');
    const campos = {
      cliente_nome: val('a-cliente_nome'), cliente_telefone: val('a-cliente_telefone') || null, endereco: val('a-endereco') || null,
      aparelho: val('a-aparelho') || null, descricao: val('a-descricao') || null, responsavel: val('a-responsavel') || null
    };
    if (!campos.cliente_nome || !dia || !hora) return alert('Preencha o nome do cliente, o dia e a hora.');
    campos.data_hora = new Date(dia + 'T' + hora + ':00').toISOString();
    if (S.agId) campos.status = val('a-status');
    btn.disabled = true;
    const res = S.agId ? await sb.from('agendamentos').update(campos).eq('id', S.agId).select().single()
      : await sb.from('agendamentos').insert(campos).select().single();
    btn.disabled = false;
    if (res.error) { $('a-erro').innerHTML = '<div class="erro">' + esc(erroTexto(res.error)) + '</div>'; return; }
    const i = S.agenda.findIndex((x) => x.id === res.data.id);
    if (i >= 0) S.agenda[i] = res.data; else S.agenda.push(res.data);
    S.agenda.sort((x, y) => new Date(x.data_hora) - new Date(y.data_hora));
    S.prefill = null;
    toast('✔ Agendamento salvo'); ir('agenda', { voltarPara: null });
  };
  if ($('a-apagar')) $('a-apagar').onclick = async () => {
    if (!confirm('Apagar este agendamento?')) return;
    const { error } = await sb.from('agendamentos').delete().eq('id', S.agId);
    if (error) return erro(error, 'apagar');
    S.agenda = S.agenda.filter((x) => x.id !== S.agId); toast('Agendamento apagado'); ir('agenda');
  };
}
