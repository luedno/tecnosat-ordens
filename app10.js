/* App TecnoSat — parte 10: tela "Hoje" e etiqueta com QR code */

function telaHoje() {
  const hoje = hojeChave();
  const nome = (S.perfil && S.perfil.nome ? S.perfil.nome.split(' ')[0] : '');
  const h = new Date().getHours();
  const saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const pr = parados();
  const prontos = S.ordens.filter((o) => o.status === 'pronto');
  const paradosLista = S.ordens.filter((o) => pr.ids.has(o.id) && o.status !== 'pronto');
  const aprov = S.ordens.filter((o) => o.status === 'aguardando_aprovacao');
  const ag = (S.agenda || []).filter((a) => a.status === 'agendado' && diaChave(a.data_hora) <= hoje)
    .sort((a, b) => new Date(a.data_hora) - new Date(b.data_hora));
  const fiados = souDono() ? S.ordens.filter((o) => fiadoAberto(o) && diasDevendo(o) >= 7) : [];
  const entraram = S.ordens.filter((o) => diaChave(o.created_at) === hoje).length;
  const abertas = S.ordens.filter((o) => !FECHADAS.includes(o.status)).length;

  const linhaOS = (o, extra) => `<div class="h-it" data-os="${o.id}">
      <div style="flex:1;min-width:0"><b>#${o.numero}</b> ${esc(o.cliente_nome)}<div class="small muted">${esc([o.aparelho, o.marca].filter(Boolean).join(' '))}${extra ? ' · ' + extra : ''}</div></div>
      <span class="h-seta">›</span></div>`;
  const bloco = (ic, titulo, cor, n, corpo) => `<div class="card h-bl">
      <div class="h-tit"><span>${ic} ${titulo}</span><span class="h-n" style="background:${cor}">${n}</span></div>${corpo}</div>`;

  moldura(saud + (nome ? ', ' + esc(nome) : ''), `
    <div class="h-kpi">
      <div><b>${abertas}</b><span>em aberto</span></div>
      <div><b>${entraram}</b><span>entraram hoje</span></div>
      <div><b>${prontos.length}</b><span>prontos</span></div>
    </div>
    ${prontos.length ? bloco('✅', 'Prontos para avisar o cliente', '#dcfce7', prontos.length,
      prontos.map((o) => linhaOS(o, 'pronto há ' + diasDesde(o.updated_at) + ' dia(s)')).join('')) : ''}
    ${ag.length ? bloco('📅', 'Visitas de hoje', '#dbeafe', ag.length,
      ag.map((a) => `<div class="h-it" data-ag="1"><div style="flex:1;min-width:0"><b>${diaChave(a.data_hora) < hoje ? '⚠️ atrasada' : fmtHora(a.data_hora)}</b> ${esc(a.cliente_nome)}<div class="small muted">${esc(a.aparelho || '')}${a.endereco ? ' · ' + esc(a.endereco) : ''}</div></div><span class="h-seta">›</span></div>`).join('')) : ''}
    ${aprov.length ? bloco('⏳', 'Aguardando o cliente aprovar', '#fef9c3', aprov.length,
      aprov.map((o) => linhaOS(o, 'há ' + diasDesde(o.updated_at) + ' dia(s)')).join('')) : ''}
    ${paradosLista.length ? bloco('⚠️', 'Parados há muito tempo', '#ffedd5', paradosLista.length,
      paradosLista.map((o) => linhaOS(o, ST[o.status] + ' há ' + diasDesde(o.updated_at) + ' dias')).join('')) : ''}
    ${fiados.length ? bloco('🧾', 'Fiado há mais de 7 dias', '#fee2e2', fiados.length,
      fiados.map((o) => linhaOS(o, moeda((S.orc[o.id] || {}).valor_final) + ' · ' + diasDevendo(o) + ' dias')).join('')) : ''}
    ${!prontos.length && !ag.length && !aprov.length && !paradosLista.length && !fiados.length ? '<div class="card center muted">Tudo em dia por aqui. 🎉</div>' : ''}
    <button class="btn full" id="h-nova" style="margin-top:4px">＋ Nova ordem de serviço</button>
  `, { aba: 'hoje' });
  $app.querySelectorAll('[data-os]').forEach((d) => d.onclick = () => abrirOrdem(d.dataset.os));
  $app.querySelectorAll('[data-ag]').forEach((d) => d.onclick = () => ir('agenda'));
  document.getElementById('h-nova').onclick = () => ir('formOrdem', { ordemId: null, prefill: null, novasFotos: [], voltarPara: 'hoje' });
}

// ---------------------------------------------------------- etiqueta para colar no aparelho
function telaEtiqueta() {
  const o = S.ordens.find((x) => x.id === S.ordemId);
  if (!o) return ir('ordens');
  const link = location.origin + '/?os=' + o.id;
  let qr = '';
  try { const q = qrcode(0, 'M'); q.addData(link); q.make(); qr = q.createSvgTag({ cellSize: 2, margin: 0 }); } catch (_) { qr = ''; }
  const ap = [o.aparelho, o.marca, o.modelo].filter(Boolean).join(' ');
  $app.innerHTML = `
    <style>@media print { @page { size: 62mm 40mm; margin: 1.5mm; } }</style>
    <div class="nao-imprimir barra-comp">
      <button class="btn sec" id="et-voltar">‹ Voltar</button>
      <button class="btn" id="et-print">🖨️ Imprimir etiqueta</button>
    </div>
    <p class="nao-imprimir muted small center">Tamanho 62 × 40 mm. Aponte a câmera do celular para o QR e a OS abre no app.</p>
    <div class="etiqueta">
      <div class="et-qr">${qr}</div>
      <div class="et-txt">
        <div class="et-os">OS #${o.numero}</div>
        <div class="et-cli">${esc(o.cliente_nome)}</div>
        <div>${esc(ap)}</div>
        <div>Entrada ${fmtData(o.created_at)}</div>
        ${o.gaveta || o.local ? '<div><b>📍 ' + esc([o.gaveta ? 'Gav. ' + o.gaveta : '', o.local].filter(Boolean).join(' · ')) + '</b></div>' : ''}
        ${o.cliente_telefone ? '<div>' + esc(o.cliente_telefone) + '</div>' : ''}
      </div>
    </div>`;
  document.getElementById('et-voltar').onclick = () => ir('ordem');
  document.getElementById('et-print').onclick = () => window.print();
  window.scrollTo(0, 0);
}
