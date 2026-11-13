/* App de Ordens de Serviço — parte 3 de 5 (não precisa mexer) */
  // ---------------------------------------------------------- detalhe da ordem
  function mensagemZap(o) {
    const emp = C.NOME_EMPRESA || 'assistência técnica';
    const ap = [o.aparelho, o.marca, o.modelo].filter(Boolean).join(' ');
    const nome = (o.cliente_nome || '').split(' ')[0];
    const orc = S.orc[o.id];
    const valor = souDono() && orc && orc.valor != null ? ' O valor do serviço é ' + moeda(orc.valor) + '.' : '';
    switch (o.status) {
      case 'recebido': return `Olá ${nome}! Recebemos seu aparelho (${ap}) aqui na ${emp}. O número da sua ordem de serviço é #${o.numero}. Avisaremos assim que tivermos o diagnóstico.`;
      case 'em_analise': return `Olá ${nome}! Seu aparelho (${ap}) já está em análise aqui na ${emp}. Em breve damos retorno. OS #${o.numero}.`;
      case 'aguardando_aprovacao': return `Olá ${nome}! Avaliamos seu aparelho (${ap}).${o.diagnostico ? ' Diagnóstico: ' + o.diagnostico + '.' : ''}${valor} Podemos fazer o conserto? OS #${o.numero}.`;
      case 'aguardando_peca': return `Olá ${nome}! O conserto do seu aparelho (${ap}) está aguardando a chegada da peça. Assim que chegar, avisamos. OS #${o.numero}.`;
      case 'em_conserto': return `Olá ${nome}! Seu aparelho (${ap}) já está em conserto aqui na ${emp}. OS #${o.numero}.`;
      case 'pronto': return `Olá ${nome}! Seu aparelho (${ap}) está PRONTO para retirada aqui na ${emp}!${valor} OS #${o.numero}.`;
      case 'sem_conserto': return `Olá ${nome}! Infelizmente seu aparelho (${ap}) não tem conserto.${o.diagnostico ? ' Motivo: ' + o.diagnostico + '.' : ''} Ele já pode ser retirado aqui na ${emp}. OS #${o.numero}.`;
      default: return `Olá ${nome}! Obrigado por escolher a ${emp}. Qualquer coisa estamos à disposição. OS #${o.numero}.`;
    }
  }

  function telaOrdem() {
    const o = S.ordens.find((x) => x.id === S.ordemId);
    if (!o) { toast('Essa ordem foi apagada.'); return ir('ordens'); }
    const orc = S.orc[o.id] || {};
    const hist = (S.hist[o.id] || []).slice().reverse();
    const campo = (r, v) => v ? `<dt>${r}</dt><dd>${esc(v)}</dd>` : '';
    moldura('OS #' + o.numero, `
      <div class="card">
        <h3>Situação</h3>
        <div class="st-grid">
          ${STATUS.map(([k, r]) => `<button class="st-${k} ${o.status === k ? 'atual' : ''}" data-st="${k}">${o.status === k ? '● ' : ''}${r}</button>`).join('')}
        </div>
      </div>

      <div class="card">
        <h3>Cliente</h3>
        <div style="font-size:18px;font-weight:700">${esc(o.cliente_nome)}</div>
        ${o.cliente_telefone ? `<div><a class="link" href="tel:${esc(String(o.cliente_telefone).replace(/[^\d+]/g, ''))}">📞 ${esc(o.cliente_telefone)}</a></div>` : ''}
        <div class="btns"><button class="btn zap" id="zap">💬 Avisar no WhatsApp</button></div>
        <p class="muted small">A mensagem é montada de acordo com a situação atual. Você pode mudar o texto antes de enviar.</p>
      </div>

      <div class="card">
        <h3>Aparelho</h3>
        <dl class="info">
          ${campo('Aparelho', [o.aparelho, o.marca, o.modelo].filter(Boolean).join(' · '))}
          ${campo('Nº de série', o.numero_serie)}
          ${campo('Acessórios deixados', o.acessorios)}
          ${campo('Defeito relatado pelo cliente', o.defeito)}
          ${campo('Previsão de entrega', o.previsao ? fmtDia(o.previsao) : '')}
          ${campo('Observações', o.observacoes)}
        </dl>
        <div class="btns"><button class="btn sec" id="editar">✏️ Editar dados</button></div>
      </div>

      <div class="card">
        <h3>Diagnóstico técnico</h3>
        <textarea id="diag" placeholder="O que foi encontrado no aparelho…" data-orig="${esc(o.diagnostico || '')}">${esc(o.diagnostico || '')}</textarea>
        <div class="btns"><button class="btn" id="salvarDiag">Salvar diagnóstico</button></div>
      </div>

      <div class="card">
        <h3>Orçamento</h3>
        <div class="chips">
          ${Object.entries(ORC).map(([k, r]) => `<button class="chip ${o.orcamento_status === k ? 'ativo' : ''}" data-orc="${k}">${r}</button>`).join('')}
        </div>
        ${souDono() ? `
          <div class="linha2">
            <div><label>Valor (R$)</label><input id="orcValor" inputmode="decimal" placeholder="0,00" value="${orc.valor != null ? Number(orc.valor).toFixed(2).replace('.', ',') : ''}" data-orig="${orc.valor != null ? Number(orc.valor).toFixed(2).replace('.', ',') : ''}"></div>
            <div></div>
          </div>
          <label>Peças / detalhes do orçamento</label>
          <textarea id="orcDet" data-orig="${esc(orc.detalhes || '')}">${esc(orc.detalhes || '')}</textarea>
          <div class="btns"><button class="btn" id="salvarOrc">Salvar valor</button></div>
          <p class="muted small">🔒 Só você (dono) vê o valor.</p>` : '<p class="muted small">O valor do orçamento é definido pelo dono.</p>'}
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
    `, { voltar: () => ir('ordens'), semNav: true });

    $app.querySelectorAll('[data-st]').forEach((b) => b.onclick = () => salvarOrdem(o.id, { status: b.dataset.st }, 'Situação: ' + ST[b.dataset.st]));
    $app.querySelectorAll('[data-orc]').forEach((b) => b.onclick = () => salvarOrdem(o.id, { orcamento_status: b.dataset.orc }, 'Orçamento: ' + ORC[b.dataset.orc]));
    document.getElementById('zap').onclick = () => abrirZap(o.cliente_telefone, mensagemZap(o));
    document.getElementById('editar').onclick = () => ir('formOrdem', { ordemId: o.id, prefill: null, novasFotos: [] });
    document.getElementById('salvarDiag').onclick = async () => {
      const ta = document.getElementById('diag');
      await salvarOrdem(o.id, { diagnostico: ta.value.trim() || null }, 'Diagnóstico salvo');
    };
    const so = document.getElementById('salvarOrc');
    if (so) so.onclick = async () => {
      const bruto = val('orcValor').replace(/\./g, '').replace(',', '.');
      const valor = bruto === '' ? null : Number(bruto);
      if (bruto !== '' && isNaN(valor)) return alert('Valor inválido. Exemplo: 150,00');
      so.disabled = true;
      const { data, error } = await sb.from('orcamentos').upsert({ ordem_id: o.id, valor, detalhes: val('orcDet') || null, updated_at: new Date().toISOString() }).select().single();
      so.disabled = false;
      if (error) return erro(error, 'salvar orçamento');
      S.orc[o.id] = data; toast('Valor salvo');
      document.getElementById('orcValor').dataset.orig = document.getElementById('orcValor').value;
      document.getElementById('orcDet').dataset.orig = document.getElementById('orcDet').value;
      atualizarTela();
    };
    document.getElementById('addFoto').onchange = async (e) => {
      const files = Array.from(e.target.files || []); if (!files.length) return;
      await enviarFotos(o.id, files, document.getElementById('fotoStatus'));
    };
    const enviarNota = async () => {
      const n = document.getElementById('nota'); const texto = n.value.trim(); if (!texto) return;
      const btn = document.getElementById('addNota'); btn.disabled = true;
      const { data, error } = await sb.from('historico').insert({ ordem_id: o.id, usuario: S.user.id, texto }).select().single();
      btn.disabled = false;
      if (error) return erro(error, 'salvar anotação');
      n.value = ''; n.blur();
      if (S.hist[o.id] && !S.hist[o.id].some((x) => x.id === data.id)) S.hist[o.id].push(data);
      atualizarTela();
    };
    document.getElementById('addNota').onclick = enviarNota;
    document.getElementById('nota').onkeydown = (e) => { if (e.key === 'Enter') enviarNota(); };
    const ap = document.getElementById('apagar');
    if (ap) ap.onclick = async () => {
      if (!confirm('Apagar a OS #' + o.numero + '? Isso não pode ser desfeito.')) return;
      if (o.fotos.length) await sb.storage.from('fotos').remove(o.fotos);
      const { error } = await sb.from('ordens').delete().eq('id', o.id);
      if (error) return erro(error, 'apagar');
      S.ordens = S.ordens.filter((x) => x.id !== o.id); toast('Ordem apagada'); ir('ordens');
    };
    carregarFotos(o.fotos);
  }

  async function salvarOrdem(id, campos, msg) {
    const { data, error } = await sb.from('ordens').update(campos).eq('id', id).select().single();
    if (error) return erro(error, 'salvar');
    const i = S.ordens.findIndex((x) => x.id === id); if (i >= 0) S.ordens[i] = data;
    document.querySelectorAll('[data-orig]').forEach((el) => {
      if (el.id === 'diag' && 'diagnostico' in campos) el.dataset.orig = el.value;
    });
    if (document.activeElement) document.activeElement.blur();
    if (msg) toast('✔ ' + msg);
    await carregarHist(id);
    atualizarTela();
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
