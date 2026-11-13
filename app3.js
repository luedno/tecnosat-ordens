/* App TecnoSat — parte 3 de 8: detalhe da ordem e fotos (não precisa mexer) */

function mensagemZap(o) {
  const emp = empresa();
  const ap = [o.aparelho, o.marca, o.modelo].filter(Boolean).join(' ');
  const nome = (o.cliente_nome || '').split(' ')[0];
  const orc = S.orc[o.id];
  const v = orc ? (orc.valor_final != null ? orc.valor_final : orc.valor) : null;
  const valor = souDono() && v != null ? ' O valor do serviço é ' + moeda(v) + '.' : '';
  const link = '\n\nAcompanhe seu aparelho aqui: ' + linkCliente(o);
  switch (o.status) {
    case 'recebido': return `Olá ${nome}! Recebemos seu aparelho (${ap}) aqui na ${emp}. O número da sua ordem de serviço é #${o.numero}. Avisaremos assim que tivermos o diagnóstico.` + link;
    case 'em_analise': return `Olá ${nome}! Seu aparelho (${ap}) já está em análise aqui na ${emp}. Em breve damos retorno. OS #${o.numero}.` + link;
    case 'aguardando_aprovacao': return `Olá ${nome}! Avaliamos seu aparelho (${ap}).${o.diagnostico ? ' Diagnóstico: ' + o.diagnostico + '.' : ''}${valor} Podemos fazer o conserto? OS #${o.numero}.`;
    case 'aguardando_peca': return `Olá ${nome}! O conserto do seu aparelho (${ap}) está aguardando a chegada da peça. Assim que chegar, avisamos. OS #${o.numero}.` + link;
    case 'em_conserto': return `Olá ${nome}! Seu aparelho (${ap}) já está em conserto aqui na ${emp}. OS #${o.numero}.` + link;
    case 'pronto': return `Olá ${nome}! Seu aparelho (${ap}) está PRONTO para retirada aqui na ${emp}!${valor} OS #${o.numero}.` + (S.loja.endereco ? '\nEndereço: ' + S.loja.endereco : '');
    case 'sem_conserto': return `Olá ${nome}! Infelizmente seu aparelho (${ap}) não tem conserto.${o.diagnostico ? ' Motivo: ' + o.diagnostico + '.' : ''} Ele já pode ser retirado aqui na ${emp}. OS #${o.numero}.`;
    default: return `Olá ${nome}! Obrigado por escolher a ${emp}.${o.garantia_ate ? ' Seu serviço tem garantia até ' + fmtDia(o.garantia_ate) + '.' : ''} Qualquer coisa estamos à disposição. OS #${o.numero}.`;
  }
}

function telaOrdem() {
  const o = S.ordens.find((x) => x.id === S.ordemId);
  if (!o) { toast('Essa ordem não foi encontrada.'); return ir('ordens'); }
  const orc = S.orc[o.id] || {};
  const hist = (S.hist[o.id] || []).slice().reverse();
  const campo = (r, v) => v ? `<dt>${r}</dt><dd>${esc(v)}</dd>` : '';
  const cli = o.cliente_id ? S.clientes.find((c) => c.id === o.cliente_id) : null;
  const outrasGar = garantiaAtiva(o.cliente_id, o.cliente_telefone, o.id, o.created_at);
  const entregue = FECHADAS.includes(o.status);
  const fmtOrc = (v) => v != null ? Number(v).toFixed(2).replace('.', ',') : '';

  let gar = '';
  if (o.garantia_ate) {
    gar = o.garantia_ate >= hojeChave()
      ? `<div class="alerta verde">🛡️ <b>Em garantia</b> até ${fmtDia(o.garantia_ate)} (${o.garantia_dias} dias)</div>`
      : `<div class="alerta cinza">🛡️ Garantia vencida em ${fmtDia(o.garantia_ate)}</div>`;
  }
  const retorno = outrasGar.map((g) => `<div class="alerta" data-abrir="${g.id}">🔁 <b>Possível retorno em garantia:</b> a OS #${g.numero} (${esc(g.aparelho)}) deste cliente tem garantia até ${fmtDia(g.garantia_ate)}. <u>Ver OS</u></div>`).join('');

  moldura('OS #' + o.numero, `
    ${retorno}${gar}
    <div class="card">
      <h3>Situação</h3>
      <div class="st-grid">
        ${STATUS.map(([k, r]) => `<button class="st-${k} ${o.status === k ? 'atual' : ''}" data-st="${k}">${o.status === k ? '● ' : ''}${r}</button>`).join('')}
      </div>
    </div>

    <div class="card">
      <h3>Técnico responsável</h3>
      <div class="chips quebra">
        <button class="chip ${!o.tecnico ? 'ativo' : ''}" data-tec="">Ninguém</button>
        ${ativos().map((p) => `<button class="chip ${o.tecnico === p.id ? 'ativo' : ''}" data-tec="${p.id}">${esc(p.nome)}${p.id === S.user.id ? ' (eu)' : ''}</button>`).join('')}
      </div>
    </div>

    <div class="card">
      <h3>Cliente</h3>
      <div style="font-size:18px;font-weight:700">${esc(o.cliente_nome)} ${cli ? '<a class="link small" href="#" id="verCli">ver cliente ›</a>' : ''}</div>
      ${o.cliente_telefone ? `<div><a class="link" href="tel:${esc(String(o.cliente_telefone).replace(/[^\d+]/g, ''))}">📞 ${esc(o.cliente_telefone)}</a></div>` : ''}
      <div class="btns">
        <button class="btn zap" id="zap">💬 Avisar no WhatsApp</button>
      </div>
      <div class="btns">
        <button class="btn sec" id="comprovante">🧾 Comprovante</button>
        <button class="btn sec" id="linkCli">🔗 Link de acompanhamento</button>
      </div>
      <p class="muted small">A mensagem do WhatsApp é montada de acordo com a situação e já leva o link para o cliente acompanhar.</p>
    </div>

    <div class="card">
      <h3>Aparelho</h3>
      <dl class="info">
        ${campo('Aparelho', [o.aparelho, o.marca, o.modelo].filter(Boolean).join(' · '))}
        ${campo('Nº de série / IMEI', o.numero_serie)}
        ${campo('Acessórios deixados', o.acessorios)}
        ${campo('Defeito relatado pelo cliente', o.defeito)}
        ${campo('Previsão de entrega', o.previsao ? fmtDia(o.previsao) : '')}
        ${campo('Observações', o.observacoes)}
      </dl>
      ${o.checklist && o.checklist.length ? `<dt class="muted small" style="margin-top:8px">Estado na entrada</dt><div class="chips quebra" style="margin-top:4px">${o.checklist.map((c) => `<span class="chip fixo">${esc(c)}</span>`).join('')}</div>` : ''}
      ${o.senha_aparelho ? `<dt class="muted small" style="margin-top:8px">Senha / padrão de desbloqueio</dt><dd><span id="senha" class="senha">••••••</span> <a href="#" class="link small" id="verSenha">mostrar</a></dd>` : ''}
      <div class="btns"><button class="btn sec" id="editar">✏️ Editar dados</button></div>
    </div>

    <div class="card">
      <h3>Diagnóstico técnico</h3>
      <textarea id="diag" placeholder="O que foi encontrado no aparelho…" data-orig="${esc(o.diagnostico || '')}">${esc(o.diagnostico || '')}</textarea>
      <div class="btns"><button class="btn" id="salvarDiag">Salvar diagnóstico</button></div>
    </div>

    <div class="card">
      <h3>Orçamento</h3>
      <div class="chips quebra">
        ${Object.entries(ORC).map(([k, r]) => `<button class="chip ${o.orcamento_status === k ? 'ativo' : ''}" data-orc="${k}">${r}</button>`).join('')}
      </div>
      ${souDono() ? `
        <label>Valor do orçamento (R$)</label>
        <input id="orcValor" inputmode="decimal" placeholder="0,00" value="${fmtOrc(orc.valor)}" data-orig="${fmtOrc(orc.valor)}">
        <label>Peças / detalhes do orçamento</label>
        <textarea id="orcDet" data-orig="${esc(orc.detalhes || '')}">${esc(orc.detalhes || '')}</textarea>
        <div class="btns"><button class="btn" id="salvarOrc">Salvar valor</button></div>
        <p class="muted small">🔒 Só você (dono) vê os valores.</p>` : '<p class="muted small">O valor do orçamento é definido pelo dono.</p>'}
    </div>

    <div class="card">
      <h3>Entrega</h3>
      ${o.status === 'entregue' ? `
        <dl class="info">
          <dt>Entregue em</dt><dd>${o.entregue_em ? fmtDataHora(o.entregue_em) : '—'}</dd>
          ${campo('Retirado por', o.retirado_por)}
          ${campo('Forma de pagamento', o.forma_pagamento)}
          ${souDono() && orc.valor_final != null ? `<dt>Valor cobrado</dt><dd><b>${moeda(orc.valor_final)}</b></dd>` : ''}
          <dt>Garantia</dt><dd>${o.garantia_ate ? o.garantia_dias + ' dias — até ' + fmtDia(o.garantia_ate) : 'Sem garantia'}</dd>
        </dl>
        <div class="btns"><button class="btn sec" id="entregar">✏️ Corrigir entrega</button><button class="btn sec" id="compEntrega">🧾 Comprovante de entrega</button></div>`
      : o.status === 'sem_conserto' ? '<p class="muted">Aparelho sem conserto. Quando o cliente retirar, toque abaixo.</p><div class="btns"><button class="btn" id="entregar">📦 Registrar retirada</button></div>'
      : `<p class="muted small">Quando o cliente buscar o aparelho, registre aqui quem retirou, o pagamento e a garantia.</p>
         <div class="btns"><button class="btn ${o.status === 'pronto' ? 'ok' : 'sec'}" id="entregar">📦 Entregar ao cliente</button></div>`}
    </div>

    <div class="card">
      <h3>Fotos (${o.fotos.length})</h3>
      <div class="fotos">
        ${o.fotos.map((p) => `<img data-path="${esc(p)}" alt="foto">`).join('')}
        <label class="add-foto">📷<br>Adicionar foto<input type="file" accept="image/*" multiple id="addFoto"></label>
      </div>
      <div id="fotoStatus" class="muted small"></div>
    </div>

    <div class="card">
      <h3>Histórico e anotações</h3>
      <div style="display:flex;gap:8px">
        <input id="nota" placeholder="Escrever uma anotação…" data-orig="">
        <button class="btn" id="addNota">Enviar</button>
      </div>
      <ul class="hist" style="margin-top:8px">
        ${hist.map((h) => `<li><b>${esc(nomeDe(h.usuario))}</b> · <span class="muted small">${fmtDataHora(h.created_at)}</span><br>${esc(h.texto)}</li>`).join('') || '<li class="muted">Carregando…</li>'}
      </ul>
    </div>

    <p class="muted small center" style="padding:6px">
      Cadastrada por ${esc(nomeDe(o.criado_por))} em ${fmtDataHora(o.created_at)}<br>
      Última alteração: ${esc(nomeDe(o.atualizado_por))} em ${fmtDataHora(o.updated_at)}
    </p>
    ${souDono() ? '<div class="btns" style="margin-bottom:20px"><button class="btn perigo full" id="apagar">🗑️ Apagar esta ordem</button></div>' : ''}
  `, { voltar: () => ir(S.voltarPara || 'ordens', { voltarPara: null }), semNav: true });

  const $ = (id) => document.getElementById(id);
  $app.querySelectorAll('[data-abrir]').forEach((b) => b.onclick = () => abrirOrdem(b.dataset.abrir));
  $app.querySelectorAll('[data-st]').forEach((b) => b.onclick = () => {
    if (b.dataset.st === 'entregue' && o.status !== 'entregue') return ir('entrega');
    salvarOrdem(o.id, { status: b.dataset.st }, 'Situação: ' + ST[b.dataset.st]);
  });
  $app.querySelectorAll('[data-tec]').forEach((b) => b.onclick = () => salvarOrdem(o.id, { tecnico: b.dataset.tec || null }, b.dataset.tec ? 'Técnico: ' + nomeDe(b.dataset.tec) : 'Sem técnico'));
  $app.querySelectorAll('[data-orc]').forEach((b) => b.onclick = () => salvarOrdem(o.id, { orcamento_status: b.dataset.orc }, 'Orçamento: ' + ORC[b.dataset.orc]));
  $('zap').onclick = () => abrirZap(o.cliente_telefone, mensagemZap(o));
  $('linkCli').onclick = async () => {
    const link = linkCliente(o);
    if (navigator.share) { try { await navigator.share({ title: 'Acompanhe sua OS #' + o.numero, text: 'Acompanhe o conserto do seu aparelho (' + o.aparelho + '):', url: link }); return; } catch (_) { return; } }
    abrirZap(o.cliente_telefone, 'Olá! Acompanhe o conserto do seu aparelho (' + o.aparelho + ') por este link: ' + link);
  };
  $('comprovante').onclick = () => ir('comprovante', { compTipo: 'entrada' });
  if ($('compEntrega')) $('compEntrega').onclick = () => ir('comprovante', { compTipo: 'entrega' });
  if ($('verCli')) $('verCli').onclick = (e) => { e.preventDefault(); ir('cliente', { clienteId: o.cliente_id }); };
  if ($('verSenha')) $('verSenha').onclick = (e) => { e.preventDefault(); $('senha').textContent = o.senha_aparelho; e.target.remove(); };
  $('editar').onclick = () => ir('formOrdem', { ordemId: o.id, prefill: null, novasFotos: [] });
  $('entregar').onclick = () => ir('entrega');
  $('salvarDiag').onclick = () => salvarOrdem(o.id, { diagnostico: $('diag').value.trim() || null }, 'Diagnóstico salvo');
  if ($('salvarOrc')) $('salvarOrc').onclick = async () => {
    const bruto = val('orcValor').replace(/\./g, '').replace(',', '.');
    const valor = bruto === '' ? null : Number(bruto);
    if (bruto !== '' && isNaN(valor)) return alert('Valor inválido. Exemplo: 150,00');
    $('salvarOrc').disabled = true;
    const { data, error } = await sb.from('orcamentos').upsert({ ordem_id: o.id, valor, detalhes: val('orcDet') || null, updated_at: new Date().toISOString() }).select().single();
    $('salvarOrc').disabled = false;
    if (error) return erro(error, 'salvar orçamento');
    S.orc[o.id] = data; toast('✔ Valor salvo');
    $('orcValor').dataset.orig = $('orcValor').value; $('orcDet').dataset.orig = $('orcDet').value;
    atualizarTela();
  };
  $('addFoto').onchange = async (e) => {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    await enviarFotos(o.id, files, $('fotoStatus'));
  };
  const enviarNota = async () => {
    const n = $('nota'); const texto = n.value.trim(); if (!texto) return;
    $('addNota').disabled = true;
    const { data, error } = await sb.from('historico').insert({ ordem_id: o.id, usuario: S.user.id, texto }).select().single();
    $('addNota').disabled = false;
    if (error) return erro(error, 'salvar anotação');
    n.value = ''; n.blur();
    if (S.hist[o.id] && !S.hist[o.id].some((x) => x.id === data.id)) S.hist[o.id].push(data);
    atualizarTela();
  };
  $('addNota').onclick = enviarNota;
  $('nota').onkeydown = (e) => { if (e.key === 'Enter') enviarNota(); };
  if ($('apagar')) $('apagar').onclick = async () => {
    if (!confirm('Apagar a OS #' + o.numero + '? Isso não pode ser desfeito.')) return;
    if (o.fotos.length) await sb.storage.from('fotos').remove(o.fotos);
    const { error } = await sb.from('ordens').delete().eq('id', o.id);
    if (error) return erro(error, 'apagar');
    S.ordens = S.ordens.filter((x) => x.id !== o.id); toast('Ordem apagada'); ir('ordens');
  };
  carregarFotos(o.fotos);
}

// ---------------------------------------------------------- fotos
async function carregarFotos(paths) {
  const agora = Date.now();
  const faltam = paths.filter((p) => !S.fotoUrls[p] || S.fotoUrls[p].exp < agora);
  if (faltam.length) {
    const { data } = await sb.storage.from('fotos').createSignedUrls(faltam, 3600);
    (data || []).forEach((d) => { if (d.signedUrl) S.fotoUrls[d.path] = { url: d.signedUrl, exp: agora + 3500 * 1000 }; });
  }
  document.querySelectorAll('img[data-path]').forEach((img) => {
    const u = S.fotoUrls[img.dataset.path]; if (u) img.src = u.url;
    img.onclick = () => {
      if (!img.src) return;
      const z = document.createElement('div'); z.className = 'zoom'; z.innerHTML = '<img src="' + img.src + '">';
      z.onclick = () => z.remove(); document.body.appendChild(z);
    };
  });
}
function comprimir(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      const max = 1600; let w = img.naturalWidth, h = img.naturalHeight;
      if (w > max || h > max) { const r = Math.min(max / w, max / h); w = Math.round(w * r); h = Math.round(h * r); }
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      c.toBlob((b) => resolve(b || file), 'image/jpeg', 0.75);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}
async function enviarFotos(ordemId, files, statusEl) {
  const novos = [];
  for (let i = 0; i < files.length; i++) {
    if (statusEl) statusEl.textContent = 'Enviando foto ' + (i + 1) + ' de ' + files.length + '…';
    const blob = await comprimir(files[i]);
    const path = ordemId + '/' + Date.now() + '-' + i + '.jpg';
    const { error } = await sb.storage.from('fotos').upload(path, blob, { contentType: 'image/jpeg' });
    if (error) { if (statusEl) statusEl.textContent = ''; erro(error, 'enviar foto'); break; }
    novos.push(path);
  }
  if (statusEl) statusEl.textContent = '';
  if (!novos.length) return;
  const atual = (S.ordens.find((x) => x.id === ordemId) || { fotos: [] }).fotos;
  await salvarOrdem(ordemId, { fotos: atual.concat(novos) }, novos.length + ' foto(s) adicionada(s)');
}
