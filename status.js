// Página pública: o cliente acompanha o conserto pelo link (não precisa mexer)
(async function () {
  const el = document.getElementById('conteudo');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dia = (d) => { if (!d) return ''; const [a, m, x] = String(d).slice(0, 10).split('-'); return x + '/' + m + '/' + a; };
  const dataHora = (d) => { const x = new Date(d); return x.toLocaleDateString('pt-BR') + ' às ' + x.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
  const t = new URLSearchParams(location.search).get('t');
  if (!t || !window.supabase) { el.innerHTML = '<div class="card center">Link inválido. Confira o link que você recebeu.</div>'; return; }
  const sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await sb.rpc('consulta_os2', { t });
  if (error) { el.innerHTML = '<div class="card center">Não foi possível consultar agora.<br><small>' + esc(error.message) + '</small></div>'; return; }
  const o = data && data[0];
  if (!o) { el.innerHTML = '<div class="card center">Ordem de serviço não encontrada.<br>Confira o link que você recebeu.</div>'; return; }
  document.getElementById('loja').textContent = o.loja_nome || 'TecnoSat';
  document.getElementById('lojaEnd').textContent = o.loja_endereco || '';
  document.title = 'OS #' + o.numero + ' — ' + (o.loja_nome || 'TecnoSat');
  const passos = [['recebido', 'Recebido na loja'], ['em_analise', 'Em análise'], ['orcamento', 'Orçamento'], ['em_conserto', 'Em conserto'], ['pronto', 'Pronto para retirada'], ['entregue', 'Entregue']];
  const pos = { recebido: 0, em_analise: 1, aguardando_aprovacao: 2, aguardando_peca: 3, em_conserto: 3, pronto: 4, entregue: 5, sem_conserto: 4, nao_aprovado: 2, aguardando_retirada: 4 }[o.status] ?? 0;
  let aviso = '';
  const moeda = (v) => 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (o.status === 'aguardando_aprovacao') aviso = `<div class="orc">
      <div class="orc-t">📋 Orçamento do conserto</div>
      ${o.diagnostico ? '<div>🔍 ' + esc(o.diagnostico) + '</div>' : ''}
      ${o.orc_detalhes ? '<div class="muted">' + esc(o.orc_detalhes) + '</div>' : ''}
      ${o.orc_valor != null ? '<div class="orc-v">' + moeda(o.orc_valor) + '</div>' : ''}
      <div class="orc-b"><button id="aprovar" class="b-ok">✔ Aprovar conserto</button><button id="recusar" class="b-no">Não aprovar</button></div>
      <div class="muted" style="font-size:13px">Sua resposta vai direto para a loja.</div>
      <div id="orcMsg"></div>
    </div>`;
  if (o.status === 'aguardando_peca') aviso = '<div class="destaque amarelo">📦 Estamos aguardando a chegada da peça para o conserto.</div>';
  if (o.status === 'pronto') aviso = '<div class="destaque verde">✅ Seu aparelho está pronto! Pode vir buscar.</div>';
  if (o.status === 'aguardando_retirada') aviso = '<div class="destaque amarelo">📦 Seu aparelho está aguardando retirada. Pode vir buscar!</div>';
  if (o.status === 'nao_aprovado') aviso = '<div class="destaque amarelo">📦 O orçamento não foi aprovado. Seu aparelho já pode ser retirado na loja.</div>';
  if (o.status === 'sem_conserto') aviso = '<div class="destaque vermelho">Infelizmente o aparelho não tem conserto. Ele já pode ser retirado na loja.</div>';
  if (o.status === 'entregue') aviso = '<div class="destaque verde">✅ Aparelho entregue' + (o.entregue_em ? ' em ' + dia(o.entregue_em) : '') + '. Obrigado pela preferência!</div>';
  const hoje = new Date().toISOString().slice(0, 10);
  const gar = o.garantia_ate ? (o.garantia_ate >= hoje ? '<div class="destaque verde">🛡️ Garantia válida até ' + dia(o.garantia_ate) + '</div>' : '<div class="muted" style="margin-top:8px">Garantia encerrada em ' + dia(o.garantia_ate) + '</div>') : '';
  const zap = String(o.loja_whatsapp || o.loja_telefone || '').replace(/\D/g, '');
  const zapN = zap.length === 10 || zap.length === 11 ? '55' + zap : zap;
  el.innerHTML = `
    <div class="card">
      <div class="num">Ordem de serviço #${o.numero}</div>
      <div class="ap">${esc([o.aparelho, o.marca, o.modelo].filter(Boolean).join(' · '))}</div>
      <div class="muted">Cliente: ${esc(o.cliente)} · Entrada em ${dia(o.entrada)}</div>
      ${o.previsao && !['pronto', 'entregue', 'sem_conserto'].includes(o.status) ? '<div class="muted">Previsão: ' + dia(o.previsao) + '</div>' : ''}
      ${aviso}${gar}
    </div>
    <div class="card">
      <ul class="passos">
        ${passos.map(([k, r], i) => `<li class="${i < pos || o.status === 'entregue' ? 'feito' : i === pos ? 'atual' : ''}"><span class="b">${i < pos || o.status === 'entregue' ? '✓' : i + 1}</span>${r}</li>`).join('')}
      </ul>
      <div class="muted" style="margin-top:8px">Atualizado em ${dataHora(o.atualizado)}</div>
    </div>
    ${zapN ? `<a class="btn" href="https://wa.me/${zapN}?text=${encodeURIComponent('Olá! Quero saber sobre minha ordem de serviço #' + o.numero + '.')}">💬 Falar com a loja no WhatsApp</a>` : ''}
    ${o.loja_telefone ? `<p class="muted" style="text-align:center">📞 ${esc(o.loja_telefone)}</p>` : ''}`;
  const responder = async (aprovar) => {
    const ok = confirm(aprovar ? 'Confirmar: aprovar o conserto?' : 'Confirmar: NÃO aprovar o conserto?\n\nO aparelho ficará disponível para retirada.');
    if (!ok) return;
    document.querySelectorAll('.orc-b button').forEach((b) => b.disabled = true);
    const r = await sb.rpc('responder_orcamento', { t, aprovar });
    if (r.error || r.data === 'invalido') {
      document.querySelectorAll('.orc-b button').forEach((b) => b.disabled = false);
      document.getElementById('orcMsg').innerHTML = '<div class="destaque vermelho">Não deu para enviar agora. Tente de novo ou fale com a loja.<br><small>' + esc(r.error ? r.error.message : r.data) + '</small></div>';
      return;
    }
    location.reload();
  };
  const ba = document.getElementById('aprovar'); if (ba) ba.onclick = () => responder(true);
  const br = document.getElementById('recusar'); if (br) br.onclick = () => responder(false);
})();
