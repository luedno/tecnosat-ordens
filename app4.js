/* App TecnoSat — parte 4 de 8: cadastro, entrega e comprovante (não precisa mexer) */

function formOrdem() {
  const editando = !!S.ordemId;
  const o = editando ? (S.ordens.find((x) => x.id === S.ordemId) || {}) : (S.prefill || {});
  const v = (k) => esc(o[k] || '');
  const marcados = new Set(o.checklist || []);
  let cliSel = o.cliente_id || null;
  moldura(editando ? 'Editar OS #' + o.numero : 'Nova ordem de serviço', `
    <div class="card">
      <h3>Cliente</h3>
      <label>Nome do cliente *</label>
      <input id="f-cliente_nome" value="${v('cliente_nome')}" autocomplete="off" placeholder="Digite o nome ou o telefone">
      <div id="sugestoes" class="sugestoes"></div>
      <label>Telefone / WhatsApp</label><input id="f-cliente_telefone" type="tel" inputmode="tel" placeholder="(85) 99999-9999" value="${v('cliente_telefone')}">
      ${botaoContato('f-contato')}
      <div id="cliInfo"></div>
    </div>
    <div class="card">
      <h3>Aparelho</h3>
      <label>Tipo de aparelho *</label>
      <input id="f-aparelho" list="lista-aparelhos" value="${v('aparelho')}" placeholder="Ex.: TV, Celular, Micro-ondas">
      <datalist id="lista-aparelhos">${APARELHOS.map((a) => `<option value="${a}">`).join('')}</datalist>
      <div class="linha2">
        <div><label>Marca</label><input id="f-marca" value="${v('marca')}"></div>
        <div><label>Modelo</label><input id="f-modelo" value="${v('modelo')}"></div>
      </div>
      <label>Nº de série / IMEI</label><input id="f-numero_serie" value="${v('numero_serie')}">
      <label>Acessórios deixados</label><input id="f-acessorios" value="${v('acessorios')}" placeholder="Ex.: controle remoto, cabo, carregador">
      <label>Defeito relatado pelo cliente</label><textarea id="f-defeito">${v('defeito')}</textarea>
      <label>Senha / padrão de desbloqueio</label><input id="f-senha_aparelho" value="${v('senha_aparelho')}" autocomplete="off" placeholder="Se o cliente informar">
      <label>Previsão de entrega</label><input id="f-previsao" type="date" value="${v('previsao')}">
      <label>📍 Local do aparelho</label><textarea id="f-local" class="local-txt" placeholder="Ex.: gaveta 3, estante azul de cima">${v('local')}</textarea>
      <label>Observações</label><textarea id="f-observacoes" placeholder="Arranhões, estado do aparelho, etc.">${v('observacoes')}</textarea>
      <label>Técnico responsável</label>
      <select id="f-tecnico">
        <option value="">Ninguém por enquanto</option>
        ${ativos().map((p) => `<option value="${p.id}" ${o.tecnico === p.id ? 'selected' : ''}>${esc(p.nome)}${p.id === S.user.id ? ' (eu)' : ''}</option>`).join('')}
      </select>
    </div>
    ${editando ? '' : `
    <div class="card">
      <h3>Fotos do aparelho</h3>
      ${botoesFoto('f-fotos')}
      <div style="margin-top:6px"><span id="f-fotos-qtd" class="muted small">${S.novasFotos.length ? S.novasFotos.length + ' foto(s) selecionada(s)' : ''}</span> <button type="button" class="btn sec" id="f-fotos-limpar" style="display:${S.novasFotos.length ? 'inline-block' : 'none'};padding:4px 10px;min-height:0">✕ Tirar fotos escolhidas</button></div>
    </div>`}
    <div class="btns" style="margin-bottom:24px"><button class="btn full" id="f-salvar">${editando ? 'Salvar alterações' : 'Cadastrar aparelho'}</button></div>
    <div id="f-erro"></div>
  `, { voltar: () => editando ? ir('ordem') : ir(S.voltarPara || 'ordens', { voltarPara: null }), semNav: true });

  const $ = (id) => document.getElementById(id);
  document.querySelectorAll('#check [data-c]').forEach((b) => b.onclick = () => {
    const c = b.dataset.c; if (marcados.has(c)) marcados.delete(c); else marcados.add(c);
    b.classList.toggle('ativo', marcados.has(c));
  });

  function mostrarCliente() {
    const box = $('cliInfo'); const cli = S.clientes.find((c) => c.id === cliSel);
    if (!cli) { box.innerHTML = $('f-cliente_nome').value.trim() ? '<p class="muted small">Cliente novo — será cadastrado automaticamente.</p>' : ''; return; }
    const antigas = ordensDoCliente(cli).filter((x) => x.id !== S.ordemId);
    const gar = garantiaAtiva(cli.id, cli.telefone, S.ordemId);
    box.innerHTML = `<div class="alerta verde small">✔ Cliente cadastrado · ${antigas.length} OS anterior(es)</div>` +
      gar.map((g) => `<div class="alerta small">🔁 <b>Atenção:</b> a OS #${g.numero} (${esc(g.aparelho)}) tem garantia até ${fmtDia(g.garantia_ate)}. Pode ser retorno em garantia.</div>`).join('');
  }
  function sugerir() {
    const box = $('sugestoes'); const q = $('f-cliente_nome').value.trim().toLowerCase(); const qd = digitos(q);
    if (cliSel || q.length < 2) { box.innerHTML = ''; return; }
    const achados = S.clientes.filter((c) => c.nome.toLowerCase().includes(q) || (qd.length >= 4 && (c.telefone_digitos || '').includes(qd))).slice(0, 6);
    box.innerHTML = achados.map((c) => `<div class="sug" data-cli="${c.id}"><b>${esc(c.nome)}</b> <span class="muted small">${esc(c.telefone || '')}</span></div>`).join('');
    box.querySelectorAll('[data-cli]').forEach((d) => d.onclick = () => {
      const c = S.clientes.find((x) => x.id === d.dataset.cli); cliSel = c.id;
      $('f-cliente_nome').value = c.nome; $('f-cliente_telefone').value = c.telefone || '';
      box.innerHTML = ''; mostrarCliente();
    });
  }
  $('f-cliente_nome').oninput = () => { if (!editando) cliSel = null; sugerir(); mostrarCliente(); };
  $('f-cliente_telefone').oninput = () => {
    const d = digitos($('f-cliente_telefone').value);
    if (!editando && d.length >= 10) {
      const c = S.clientes.find((x) => x.telefone_digitos === d);
      if (c) { cliSel = c.id; if (!$('f-cliente_nome').value.trim()) $('f-cliente_nome').value = c.nome; mostrarCliente(); }
    }
  };
  mostrarCliente();
  // Depois de importar do celular: procura se o cliente já está cadastrado pelo telefone
  ligarContato('f-contato', 'f-cliente_nome', 'f-cliente_telefone', () => {
    if (!editando) cliSel = null;
    $('sugestoes').innerHTML = '';
    $('f-cliente_telefone').oninput();
    mostrarCliente();
  });

  ligarFotos('f-fotos', (files) => {
    S.novasFotos = S.novasFotos.concat(files);
    $('f-fotos-qtd').textContent = S.novasFotos.length + ' foto(s) selecionada(s) — pode tirar mais';
    $('f-fotos-limpar').style.display = 'inline-block';
  });
  if ($('f-fotos-limpar')) $('f-fotos-limpar').onclick = () => {
    S.novasFotos = []; $('f-fotos-qtd').textContent = 'Fotos removidas — escolha de novo se quiser';
    $('f-fotos-limpar').style.display = 'none';
  };
  const btn = $('f-salvar');
  btn.onclick = async () => {
    const campos = {};
    ['cliente_nome', 'cliente_telefone', 'aparelho', 'marca', 'modelo', 'numero_serie', 'acessorios', 'defeito', 'previsao', 'observacoes', 'senha_aparelho', 'local']
      .forEach((k) => { campos[k] = val('f-' + k) || null; });
    campos.tecnico = val('f-tecnico') || null;
    campos.checklist = Array.from(marcados);
    if (!campos.cliente_nome || !campos.aparelho) return alert('Preencha o nome do cliente e o tipo de aparelho.');
    btn.disabled = true; btn.textContent = 'Salvando…';
    const falhou = (e) => { btn.disabled = false; btn.textContent = 'Tentar de novo'; $('f-erro').innerHTML = '<div class="erro">' + esc(erroTexto(e)) + '</div>'; };
    // Liga ao cadastro de clientes (procura pelo telefone; se não achar, cria)
    if (!cliSel) {
      const d = digitos(campos.cliente_telefone);
      const achado = d.length >= 8 ? S.clientes.find((c) => c.telefone_digitos === d) : null;
      if (achado) cliSel = achado.id;
      else {
        const { data, error } = await sb.from('clientes').insert({ nome: campos.cliente_nome, telefone: campos.cliente_telefone }).select().single();
        if (error) return falhou(error);
        S.clientes.push(data); cliSel = data.id;
      }
    }
    campos.cliente_id = cliSel;
    const res = editando ? await sb.from('ordens').update(campos).eq('id', S.ordemId).select().single()
      : await sb.from('ordens').insert(campos).select().single();
    if (res.error) return falhou(res.error);
    const o2 = res.data;
    const i = S.ordens.findIndex((x) => x.id === o2.id);
    if (i >= 0) S.ordens[i] = o2; else S.ordens.unshift(o2);
    if (!editando && S.prefill && S.prefill._agId) await sb.from('agendamentos').update({ status: 'feito' }).eq('id', S.prefill._agId);
    const fotos = S.novasFotos; S.novasFotos = []; S.prefill = null;
    S.ordemId = o2.id; S.tela = 'ordem';
    if (fotos.length) { btn.textContent = 'Enviando fotos…'; await enviarFotos(o2.id, fotos, null); }
    toast(editando ? '✔ Alterações salvas' : '✔ OS #' + o2.numero + ' cadastrada');
    if (!editando && confirm('OS #' + o2.numero + ' cadastrada!\n\nQuer abrir o comprovante de entrada para imprimir ou enviar ao cliente?')) {
      return ir('comprovante', { compTipo: 'entrada' });
    }
    abrirOrdem(o2.id);
  };
}

// ---------------------------------------------------------- entrega ao cliente
function telaEntrega() {
  const o = S.ordens.find((x) => x.id === S.ordemId);
  if (!o) return ir('ordens');
  const orc = S.orc[o.id] || {};
  const jaEntregue = o.status === 'entregue' || (o.status === 'sem_conserto' && o.entregue_em);
  const semConserto = o.status === 'sem_conserto' || o.status === 'nao_aprovado';
  let pag = o.forma_pagamento || '';
  let gar = o.garantia_dias != null ? o.garantia_dias : (semConserto ? 0 : Number(S.loja.garantia_padrao || 90));
  const vPadrao = orc.valor_final != null ? orc.valor_final : orc.valor;
  moldura('Entrega — OS #' + o.numero, `
    <div class="card">
      <div class="os-titulo">${esc([o.aparelho, o.marca, o.modelo].filter(Boolean).join(' · '))}</div>
      <div>${esc(o.cliente_nome)}</div>
      ${o.orcamento_status === 'recusado' ? '<div class="alerta small">O cliente recusou o orçamento.</div>' : ''}
      <label>Quem retirou o aparelho</label><input id="e-ret" value="${esc(o.retirado_por || o.cliente_nome)}">
      <label>Forma de pagamento</label>
      <div class="chips quebra" id="e-pag">${PAGAMENTOS.map((p) => `<button class="chip ${pag === p ? 'ativo' : ''}" data-p="${p}">${p}</button>`).join('')}</div>
      ${semConserto ? '' : `
      <label>Garantia do serviço</label>
      <div class="chips quebra" id="e-gar">${[0, 30, 90, 180].map((d) => `<button class="chip ${gar === d ? 'ativo' : ''}" data-g="${d}">${d ? d + ' dias' : 'Sem garantia'}</button>`).join('')}</div>
      <input id="e-gdias" type="number" inputmode="numeric" min="0" placeholder="Outro nº de dias" value="${[0, 30, 90, 180].includes(gar) ? '' : gar}">`}
      ${souDono() ? `<label>Valor cobrado (R$)</label><input id="e-valor" inputmode="decimal" placeholder="0,00" value="${vPadrao != null ? Number(vPadrao).toFixed(2).replace('.', ',') : ''}">
        <p class="muted small">🔒 Só você vê. Entra no relatório de faturamento.</p>
        ${o.tecnico ? `<label>Comissão de ${esc(nomeDe(o.tecnico))} (R$ fixo — opcional)</label><input id="e-comv" inputmode="decimal" placeholder="Em branco = ${pctDe(o.tecnico)}% do valor cobrado" value="${orc.comissao_valor != null ? Number(orc.comissao_valor).toFixed(2).replace('.', ',') : ''}">` : '<p class="muted small">Sem técnico nesta OS = sem comissão.</p>'}
        <div id="e-fiadoaviso" class="alerta small" style="display:${pag === 'Fiado' ? 'block' : 'none'}">🧾 Fiado: o aparelho sai agora e o valor fica em “A receber” no Menu. A comissão só conta depois que o cliente pagar.</div>` : '<p class="muted small">O valor cobrado é registrado pelo dono.</p>'}
    </div>
    <div class="btns" style="margin-bottom:24px"><button class="btn ok full" id="e-salvar">${jaEntregue ? 'Salvar correção' : '✔ Confirmar entrega'}</button></div>
    <div id="e-erro"></div>
  `, { voltar: () => ir('ordem'), semNav: true });

  const $ = (id) => document.getElementById(id);
  document.querySelectorAll('#e-pag [data-p]').forEach((b) => b.onclick = () => {
    pag = pag === b.dataset.p ? '' : b.dataset.p;
    document.querySelectorAll('#e-pag [data-p]').forEach((x) => x.classList.toggle('ativo', x.dataset.p === pag));
    const av = $('e-fiadoaviso'); if (av) av.style.display = pag === 'Fiado' ? 'block' : 'none';
  });
  document.querySelectorAll('#e-gar [data-g]').forEach((b) => b.onclick = () => {
    gar = Number(b.dataset.g); $('e-gdias').value = '';
    document.querySelectorAll('#e-gar [data-g]').forEach((x) => x.classList.toggle('ativo', Number(x.dataset.g) === gar));
  });
  $('e-salvar').onclick = async () => {
    const outro = $('e-gdias') ? $('e-gdias').value.trim() : '';
    const dias = semConserto ? 0 : (outro !== '' ? Number(outro) : gar);
    const campos = { retirado_por: val('e-ret') || null, forma_pagamento: pag || null, garantia_dias: dias || null };
    if (!jaEntregue) {
      if (o.status === 'sem_conserto') campos.entregue_em = new Date().toISOString(); else campos.status = 'entregue';
    }
    const btn = $('e-salvar'); btn.disabled = true;
    if (souDono() && $('e-valor')) {
      const bruto = val('e-valor').replace(/\./g, '').replace(',', '.');
      const valor = bruto === '' ? null : Number(bruto);
      if (bruto !== '' && isNaN(valor)) { btn.disabled = false; return alert('Valor inválido. Exemplo: 150,00'); }
      if (pag === 'Fiado' && valor == null) { btn.disabled = false; return alert('Para fiado, informe o valor cobrado (é o que o cliente vai ficar devendo).'); }
      const comv = $('e-comv') ? dec($('e-comv').value) : null;
      if ($('e-comv') && $('e-comv').value.trim() !== '' && isNaN(comv)) { btn.disabled = false; return alert('Comissão inválida. Exemplo: 20,00'); }
      const reg = { ordem_id: o.id, valor_final: valor, updated_at: new Date().toISOString() };
      if (o.tecnico) { reg.comissao_valor = comv; if (orc.comissao_pct == null) reg.comissao_pct = pctDe(o.tecnico); }
      const r = await sb.from('orcamentos').upsert(reg).select().single();
      if (r.error) { btn.disabled = false; $('e-erro').innerHTML = '<div class="erro">' + esc(erroTexto(r.error)) + '</div>'; return; }
      S.orc[o.id] = r.data;
    }
    const { data, error } = await sb.from('ordens').update(campos).eq('id', o.id).select().single();
    btn.disabled = false;
    if (error) { $('e-erro').innerHTML = '<div class="erro">' + esc(erroTexto(error)) + '</div>'; return; }
    const i = S.ordens.findIndex((x) => x.id === o.id); if (i >= 0) S.ordens[i] = data;
    await carregarHist(o.id);
    toast('✔ Entrega registrada');
    if (!jaEntregue && confirm('Entrega registrada!\n\nQuer abrir o comprovante de entrega?')) return ir('comprovante', { compTipo: 'entrega' });
    ir('ordem');
  };
}

// ---------------------------------------------------------- comprovante (imprimir / PDF)
function telaComprovante() {
  const o = S.ordens.find((x) => x.id === S.ordemId);
  if (!o) return ir('ordens');
  const entrega = S.compTipo === 'entrega';
  const L = S.loja || {};
  const orc = S.orc[o.id] || {};
  const link = linkCliente(o);
  let qr = '';
  try { const q = qrcode(0, 'M'); q.addData(link); q.make(); qr = q.createSvgTag({ cellSize: 3, margin: 0 }); } catch (_) { qr = ''; }
  const linha = (r, v) => v ? `<tr><th>${r}</th><td>${esc(v)}</td></tr>` : '';
  const termos = String(L.termos || '').split('\n').filter((t) => t.trim());
  $app.innerHTML = `
    <div class="nao-imprimir barra-comp">
      <button class="btn sec" id="c-voltar">‹ Voltar</button>
      <button class="btn" id="c-print">🖨️ Imprimir / Salvar PDF</button>
      <button class="btn zap" id="c-zap">💬 Enviar link</button>
    </div>
    <div class="comprovante">
      <div class="c-topo">
        <div>
          <div class="c-loja">${esc(L.nome || empresa())}</div>
          ${L.endereco ? `<div>${esc(L.endereco)}</div>` : ''}
          ${L.telefone || L.whatsapp ? `<div>${esc([L.telefone, L.whatsapp && L.whatsapp !== L.telefone ? 'WhatsApp ' + L.whatsapp : ''].filter(Boolean).join(' · '))}</div>` : ''}
        </div>
        <div class="c-num">OS<br><b>#${o.numero}</b></div>
      </div>
      <h2>${entrega ? 'Comprovante de entrega' : 'Comprovante de entrada de aparelho'}</h2>
      <table>
        ${linha('Data de entrada', fmtDataHora(o.created_at))}
        ${linha('Cliente', o.cliente_nome)}
        ${linha('Telefone', o.cliente_telefone)}
        ${linha('Aparelho', [o.aparelho, o.marca, o.modelo].filter(Boolean).join(' · '))}
        ${linha('Nº de série / IMEI', o.numero_serie)}
        ${linha('Acessórios', o.acessorios || 'Nenhum')}
        ${linha('Estado na entrada', (o.checklist || []).join(', '))}
        ${linha('Defeito relatado', o.defeito)}
        ${linha('Observações', o.observacoes)}
        ${!entrega ? linha('Previsão', o.previsao ? fmtDia(o.previsao) : '') : ''}
        ${entrega ? linha('Serviço / diagnóstico', o.diagnostico) : ''}
        ${entrega ? linha('Data de entrega', o.entregue_em ? fmtDataHora(o.entregue_em) : fmtDataHora(new Date())) : ''}
        ${entrega ? linha('Retirado por', o.retirado_por) : ''}
        ${entrega ? linha('Pagamento', o.forma_pagamento) : ''}
        ${entrega && souDono() && orc.valor_final != null ? linha('Valor', moeda(orc.valor_final)) : ''}
        ${entrega ? linha('Garantia', o.garantia_ate ? o.garantia_dias + ' dias — válida até ' + fmtDia(o.garantia_ate) : 'Sem garantia') : ''}
      </table>
      ${!entrega && qr ? `<div class="c-qr">${qr}<div>Acompanhe o conserto pelo celular:<br>aponte a câmera para o código<br><span class="small">${esc(link)}</span></div></div>` : ''}
      ${termos.length ? `<div class="c-termos"><b>Condições</b><ul>${termos.map((t) => '<li>' + esc(t) + '</li>').join('')}</ul></div>` : ''}
      <div class="c-assin">
        <div>________________________________<br>${entrega ? 'Assinatura de quem retirou' : 'Assinatura do cliente'}</div>
        <div>________________________________<br>${esc(L.nome || empresa())}</div>
      </div>
    </div>`;
  document.getElementById('c-voltar').onclick = () => ir('ordem');
  document.getElementById('c-print').onclick = () => window.print();
  document.getElementById('c-zap').onclick = () => {
    const nome = (o.cliente_nome || '').split(' ')[0];
    const ap = [o.aparelho, o.marca, o.modelo].filter(Boolean).join(' ');
    enviarComFoto(o, entrega
      ? montarMsg(nome, 'Seu aparelho foi entregue. Obrigado por escolher a ' + empresa() + '! 🙏', ['📱 Aparelho: ' + ap, '🧾 OS: *#' + o.numero + '*', o.garantia_ate ? '🛡️ Garantia até *' + fmtDia(o.garantia_ate) + '*' : null], link)
      : montarMsg(nome, 'Recebemos o seu aparelho na ' + empresa() + '. ✅', ['📱 Aparelho: ' + ap, '🧾 OS: *#' + o.numero + '*'], link));
  };
  prepararFoto(o);
  window.scrollTo(0, 0);
}
