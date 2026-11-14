/* App TecnoSat — parte 7 de 8: menu, equipe, relatório, dados da loja, notificações (não precisa mexer) */

function telaMenu() {
  const pend = Object.values(S.perfis).filter((p) => p.papel === 'pendente').length;
  const nFiado = S.ordens.filter(fiadoAberto).length;
  const item = (id, ic, titulo, sub) => `<button class="menu-item" id="${id}"><span class="ic">${ic}</span><span><b>${titulo}</b><br><span class="muted small">${sub}</span></span><span class="seta">›</span></button>`;
  moldura('Menu', `
    <div class="card"><b>${esc(S.perfil.nome)}</b><div class="muted small">${souDono() ? 'Dono' : 'Funcionário'} · ${esc(S.perfil.email || '')}</div></div>
    <div class="card" id="pushBox"><h3>Notificações neste celular</h3><div class="muted small">Verificando…</div></div>
    ${souDono() ? `
      ${item('mEquipe', '👥', 'Equipe' + (pend ? ' <span class="bolinha">' + pend + '</span>' : ''), 'Convidar e liberar funcionários')}
      ${item('mFiado', '🧾', 'A receber (fiado)' + (nFiado ? ' <span class="bolinha">' + nFiado + '</span>' : ''), 'Quem levou o aparelho e ainda não pagou')}
      ${item('mCom', '💰', 'Comissões', 'Quanto cada funcionário ganhou no mês')}
      ${item('mRel', '📊', 'Relatório do mês', 'Entradas, entregas, faturamento e técnicos')}
      ${item('mLoja', '🏪', 'Dados da loja', 'Endereço, telefone, termos do comprovante, garantia')}
      ${item('mBackup', '💾', 'Baixar cópia de segurança', 'Planilha com todas as ordens e clientes')}
      ${item('mFotos', '🧹', 'Limpar fotos antigas', 'Apaga fotos de OS entregues há mais de 1 ano')}` : ''}
    ${item('mSair', '🚪', 'Sair', 'Desconectar deste celular')}
  `);
  const $ = (id) => document.getElementById(id);
  if ($('mEquipe')) $('mEquipe').onclick = () => ir('equipe');
  if ($('mFiado')) $('mFiado').onclick = () => ir('fiados');
  if ($('mCom')) $('mCom').onclick = () => ir('comissoes');
  if ($('mRel')) $('mRel').onclick = () => ir('relatorio');
  if ($('mLoja')) $('mLoja').onclick = () => ir('loja');
  if ($('mBackup')) $('mBackup').onclick = baixarBackup;
  if ($('mFotos')) $('mFotos').onclick = limparFotos;
  $('mSair').onclick = () => { if (confirm('Sair do app?')) sair(); };
  caixaPush();
}

// ---------------------------------------------------------- notificações
function b64ParaBytes(b64) {
  const p = '='.repeat((4 - (b64.length % 4)) % 4);
  const s = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}
async function caixaPush() {
  const box = document.getElementById('pushBox'); if (!box) return;
  const ios = /iphone|ipad/i.test(navigator.userAgent);
  const instalado = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    box.innerHTML = '<h3>Notificações neste celular</h3><p class="small">' + (ios && !instalado
      ? 'No iPhone, primeiro instale o app: no Safari toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>. Depois abra pelo ícone e volte aqui.'
      : 'Este navegador não aceita notificações. Use o Chrome.') + '</p>';
    return;
  }
  let sub = null;
  try { const reg = await navigator.serviceWorker.ready; sub = await reg.pushManager.getSubscription(); } catch (_) {}
  const negado = Notification.permission === 'denied';
  box.innerHTML = `<h3>Notificações neste celular</h3>
    ${sub && Notification.permission === 'granted'
      ? '<p class="small">✅ <b>Ativadas.</b> Você recebe aviso de OS nova, OS passada para você, orçamento aprovado, aparelho pronto e agendamentos — mesmo com o app fechado.</p><div class="btns"><button class="btn sec" id="pTeste">🔔 Testar</button><button class="btn sec" id="pDes">Desativar</button></div>'
      : negado ? '<p class="small">🚫 As notificações estão <b>bloqueadas</b> para este site. No Chrome: toque no cadeado ao lado do endereço &gt; Permissões &gt; Notificações &gt; Permitir. Depois volte aqui.</p>'
      : '<p class="small">Receba aviso no celular mesmo com o app fechado.</p><div class="btns"><button class="btn" id="pAtivar">🔔 Ativar notificações</button></div>'}
    <div id="pErro"></div>`;
  const $ = (id) => document.getElementById(id);
  if ($('pAtivar')) $('pAtivar').onclick = ativarPush;
  if ($('pTeste')) $('pTeste').onclick = async () => {
    const { error } = await sb.rpc('testar_push');
    if (error) return erro(error, 'teste'); toast('Enviado! Deve chegar em alguns segundos.');
  };
  if ($('pDes')) $('pDes').onclick = async () => {
    try { const reg = await navigator.serviceWorker.ready; const s = await reg.pushManager.getSubscription();
      if (s) { await sb.from('push_subs').delete().eq('endpoint', s.endpoint); await s.unsubscribe(); } } catch (e) { return erro(e, 'desativar'); }
    toast('Notificações desativadas'); caixaPush();
  };
}
async function ativarPush() {
  const errEl = document.getElementById('pErro');
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { toast('Permissão não concedida'); return caixaPush(); }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ParaBytes(C.VAPID_PUBLIC) });
    const j = sub.toJSON();
    const { error } = await sb.from('push_subs').upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_id: S.user.id });
    if (error) throw error;
    toast('✔ Notificações ativadas'); caixaPush();
  } catch (e) {
    if (errEl) errEl.innerHTML = '<div class="erro">' + esc(erroTexto(e)) + '</div>';
  }
}

// ---------------------------------------------------------- equipe
function telaEquipe() {
  const lista = Object.values(S.perfis).sort((a, b) => a.nome.localeCompare(b.nome));
  const papelR = { dono: 'Dono', funcionario: 'Funcionário', pendente: 'Aguardando liberação', bloqueado: 'Bloqueado' };
  const link = location.origin + '/';
  const linha = (p) => `
    <div class="card">
      <div class="os-linha">
        <div><b>${esc(p.nome)}</b>${p.id === S.user.id ? ' (você)' : ''}<div class="small muted">${esc(p.email || '')}</div></div>
        <span class="badge ${p.papel === 'pendente' ? 'st-aguardando_aprovacao' : p.papel === 'bloqueado' ? 'st-sem_conserto' : 'st-pronto'}">${papelR[p.papel]}</span>
      </div>
      ${p.id === S.user.id ? '' : `<div class="btns">
        ${p.papel !== 'funcionario' ? `<button class="btn ok" data-papel="funcionario" data-uid="${p.id}">✓ Liberar acesso</button>` : ''}
        ${p.papel !== 'bloqueado' ? `<button class="btn perigo" data-papel="bloqueado" data-uid="${p.id}">Bloquear</button>` : ''}
      </div>`}
    </div>`;
  const pend = lista.filter((p) => p.papel === 'pendente');
  moldura('Equipe', `
    <div class="card">
      <h3>Convidar funcionário</h3>
      <p class="small">Mande este link. Ele toca em <b>Criar conta</b> e depois você libera aqui.</p>
      <input readonly value="${esc(link)}" onclick="this.select()">
      <div class="btns"><button class="btn zap" id="convite">💬 Enviar convite no WhatsApp</button></div>
    </div>
    ${pend.length ? '<div class="dia">Aguardando liberação</div>' + pend.map(linha).join('') : ''}
    <div class="dia">Equipe</div>
    ${lista.filter((p) => p.papel !== 'pendente').map(linha).join('')}
  `, { voltar: () => ir('menu'), aba: 'menu' });
  document.getElementById('convite').onclick = () => abrirZap('', `Instale o app da ${empresa()}: abra ${link} no celular, toque em "Criar conta" e me avise. Depois, no menu do Chrome, toque em "Adicionar à tela inicial".`);
  $app.querySelectorAll('[data-papel]').forEach((b) => b.onclick = async () => {
    const p = S.perfis[b.dataset.uid];
    if (b.dataset.papel === 'bloqueado' && !confirm('Bloquear ' + p.nome + '? Ele não vai mais conseguir ver as ordens.')) return;
    const { data, error } = await sb.from('perfis').update({ papel: b.dataset.papel }).eq('id', p.id).select().single();
    if (error) return erro(error, 'equipe');
    S.perfis[p.id] = data; toast('✔ ' + p.nome + ': ' + papelR[data.papel]); render();
  });
}

// ---------------------------------------------------------- relatório do mês
function telaRelatorio() {
  const agora = new Date();
  const mes = S.relMes || (agora.getFullYear() + '-' + pad(agora.getMonth() + 1));
  const noMes = (d) => d && diaChave(d).slice(0, 7) === mes;
  const valorDe = (o) => { const r = S.orc[o.id] || {}; return r.valor_final != null ? Number(r.valor_final) : (r.valor != null ? Number(r.valor) : null); };
  const entraram = S.ordens.filter((o) => noMes(o.created_at));
  const entregues = S.ordens.filter((o) => o.status === 'entregue' && noMes(o.entregue_em));
  const semCons = S.ordens.filter((o) => o.status === 'sem_conserto' && noMes(o.entregue_em || o.updated_at));
  const comValor = entregues.filter((o) => valorDe(o) != null);
  const fat = comValor.reduce((s, o) => s + valorDe(o), 0);
  const aReceber = entregues.filter(fiadoAberto).reduce((s, o) => s + (valorDe(o) || 0), 0);
  const semValor = entregues.length - comValor.length;
  const tempos = entregues.filter((o) => o.entregue_em).map((o) => (new Date(o.entregue_em) - new Date(o.created_at)) / 86400000);
  const tempoMedio = tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;
  const agrupar = (lista, chave, comValorSoma) => {
    const g = {};
    lista.forEach((o) => { const k = chave(o) || '—'; g[k] = g[k] || { n: 0, v: 0 }; g[k].n++; if (comValorSoma) g[k].v += valorDe(o) || 0; });
    return Object.entries(g).sort((a, b) => b[1].n - a[1].n);
  };
  const barras = (pares, mostraValor) => {
    const max = Math.max(1, ...pares.map(([, x]) => x.n));
    return pares.map(([k, x]) => `<div class="barra-l"><span>${esc(k)}</span><b>${x.n}${mostraValor && x.v ? ' · ' + moeda(x.v) : ''}</b></div><div class="barra"><div style="width:${Math.round(100 * x.n / max)}%"></div></div>`).join('') || '<p class="muted small">Nada neste mês.</p>';
  };
  const abertas = STATUS.filter(([k]) => !FECHADAS.includes(k)).map(([k, r]) => [r, { n: S.ordens.filter((o) => o.status === k).length }]).filter(([, x]) => x.n);
  const kpi = (n, r) => `<div class="kpi"><b>${n}</b><span>${r}</span></div>`;
  moldura('Relatório', `
    <label>Mês</label><input type="month" id="relMes" value="${mes}">
    <div class="kpis">
      ${kpi(entraram.length, 'aparelhos entraram')}
      ${kpi(entregues.length, 'entregues consertados')}
      ${kpi(semCons.length, 'sem conserto')}
      ${kpi(S.ordens.filter((o) => !FECHADAS.includes(o.status)).length, 'abertas agora')}
    </div>
    <div class="card">
      <h3>Faturamento (entregues no mês)</h3>
      <div style="font-size:28px;font-weight:800;color:var(--verde)">${moeda(fat)}</div>
      <div class="small muted">Ticket médio: ${comValor.length ? moeda(fat / comValor.length) : '—'} · Tempo médio de conserto: ${tempos.length ? tempoMedio.toFixed(1).replace('.', ',') + ' dias' : '—'}</div>
      ${aReceber ? `<div class="alerta small" style="margin-top:8px">🧾 Deste total, ${moeda(aReceber)} ainda é fiado a receber.</div>` : ''}
      ${semValor ? `<div class="alerta small" style="margin-top:8px">${semValor} entrega(s) sem valor registrado — não entram no total.</div>` : ''}
    </div>
    <div class="card"><h3>Por forma de pagamento</h3>${barras(agrupar(entregues, (o) => pagEfetivo(o), true), true)}</div>
    <div class="card"><h3>Por técnico (entregues)</h3>${barras(agrupar(entregues, (o) => o.tecnico ? nomeDe(o.tecnico) : 'Sem técnico', true), true)}</div>
    <div class="card"><h3>Aparelhos que mais entraram</h3>${barras(agrupar(entraram, (o) => o.aparelho).slice(0, 6))}</div>
    <div class="card"><h3>Situação das abertas</h3>${barras(abertas)}</div>
    <p class="muted small center">O faturamento usa o valor cobrado na entrega. Se não foi informado, usa o valor do orçamento.</p>
  `, { voltar: () => ir('menu'), aba: 'menu' });
  document.getElementById('relMes').onchange = (e) => { S.relMes = e.target.value; render(); };
}

// ---------------------------------------------------------- dados da loja
function telaLoja() {
  const L = S.loja || {};
  const v = (k) => esc(L[k] ?? '');
  moldura('Dados da loja', `
    <div class="card">
      <p class="muted small">Esses dados aparecem no comprovante, no link do cliente e nas mensagens.</p>
      <label>Nome da loja</label><input id="j-nome" value="${v('nome')}">
      <label>Endereço</label><input id="j-endereco" value="${v('endereco')}" placeholder="Rua, número, bairro, cidade">
      <div class="linha2">
        <div><label>Telefone</label><input id="j-telefone" type="tel" value="${v('telefone')}"></div>
        <div><label>WhatsApp</label><input id="j-whatsapp" type="tel" value="${v('whatsapp')}"></div>
      </div>
      <label>Condições do comprovante (uma por linha)</label><textarea id="j-termos" rows="6">${v('termos')}</textarea>
      <label>Garantia padrão (dias)</label><input id="j-garantia_padrao" type="number" inputmode="numeric" value="${v('garantia_padrao')}">
      <div class="linha2">
        <div><label>Alerta "Pronto" parado (dias)</label><input id="j-alerta_pronto" type="number" inputmode="numeric" value="${v('alerta_pronto')}"></div>
        <div><label>Alerta "Aguard. peça" (dias)</label><input id="j-alerta_peca" type="number" inputmode="numeric" value="${v('alerta_peca')}"></div>
      </div>
    </div>
    <div class="btns" style="margin-bottom:24px"><button class="btn full" id="j-salvar">Salvar</button></div>
    <div id="j-erro"></div>
  `, { voltar: () => ir('menu'), semNav: true });
  document.getElementById('j-salvar').onclick = async () => {
    const campos = {};
    ['nome', 'endereco', 'telefone', 'whatsapp', 'termos'].forEach((k) => { campos[k] = val('j-' + k) || null; });
    if (!campos.nome) return alert('Preencha o nome da loja.');
    ['garantia_padrao', 'alerta_pronto', 'alerta_peca'].forEach((k) => { const n = parseInt(val('j-' + k), 10); campos[k] = isNaN(n) ? 0 : n; });
    const { data, error } = await sb.from('loja').update(campos).eq('id', 1).select().single();
    if (error) { document.getElementById('j-erro').innerHTML = '<div class="erro">' + esc(erroTexto(error)) + '</div>'; return; }
    S.loja = data; toast('✔ Dados da loja salvos'); ir('menu');
  };
}

// ---------------------------------------------------------- cópia de segurança
function csv(linhas) {
  const c = (x) => { const s = String(x ?? ''); return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return linhas.map((l) => l.map(c).join(';')).join('\r\n');
}
async function baixarBackup() {
  toast('Preparando a planilha…');
  const { data: todas, error } = await sb.from('ordens').select('*').order('numero');
  if (error) return erro(error, 'backup');
  const v = (n) => n == null ? '' : String(Number(n).toFixed(2)).replace('.', ',');
  const lin = [['Nº OS', 'Entrada', 'Cliente', 'Telefone', 'Aparelho', 'Marca', 'Modelo', 'Nº série', 'Acessórios', 'Estado na entrada', 'Defeito', 'Diagnóstico', 'Situação',
    'Orçamento', 'Valor orçamento', 'Valor cobrado', 'Técnico', 'Entregue em', 'Retirado por', 'Pagamento', 'Garantia até', 'Observações']];
  todas.forEach((o) => {
    const r = S.orc[o.id] || {};
    lin.push([o.numero, fmtDataHora(o.created_at), o.cliente_nome, o.cliente_telefone, o.aparelho, o.marca, o.modelo, o.numero_serie, o.acessorios,
      (o.checklist || []).join(', '), o.defeito, o.diagnostico, ST[o.status], ORC[o.orcamento_status], v(r.valor), v(r.valor_final),
      o.tecnico ? nomeDe(o.tecnico) : '', o.entregue_em ? fmtDataHora(o.entregue_em) : '', o.retirado_por, o.forma_pagamento,
      o.garantia_ate ? fmtDia(o.garantia_ate) : '', o.observacoes]);
  });
  const dia = hojeChave();
  baixarArquivo('ordens-' + dia + '.csv', csv(lin));
  const cl = [['Nome', 'Telefone', 'Endereço', 'Observações', 'Cliente desde']].concat(
    S.clientes.map((c) => [c.nome, c.telefone, c.endereco, c.observacoes, fmtData(c.created_at)]));
  setTimeout(() => baixarArquivo('clientes-' + dia + '.csv', csv(cl)), 800);
  toast('✔ Planilhas baixadas (abra no Excel ou Google Planilhas)', 4000);
}

// ---------------------------------------------------------- limpar fotos antigas
async function limparFotos() {
  const limite = new Date(); limite.setDate(limite.getDate() - 365);
  const alvo = S.ordens.filter((o) => FECHADAS.includes(o.status) && o.fotos && o.fotos.length && new Date(o.entregue_em || o.updated_at) < limite);
  const n = alvo.reduce((s, o) => s + o.fotos.length, 0);
  if (!n) return alert('Nenhuma foto antiga para apagar.\n\nSó são apagadas fotos de ordens entregues (ou sem conserto) há mais de 1 ano.');
  if (!confirm('Apagar ' + n + ' foto(s) de ' + alvo.length + ' ordem(ns) entregues há mais de 1 ano?\n\nAs ordens continuam salvas, só as fotos são apagadas.')) return;
  let feitas = 0;
  for (const o of alvo) {
    const { error } = await sb.storage.from('fotos').remove(o.fotos);
    if (error) { erro(error, 'apagar fotos'); break; }
    const r = await sb.from('ordens').update({ fotos: [] }).eq('id', o.id).select().single();
    if (!r.error) { const i = S.ordens.findIndex((x) => x.id === o.id); if (i >= 0) S.ordens[i] = r.data; }
    feitas += o.fotos.length; toast('Apagando… ' + feitas + ' de ' + n);
  }
  toast('✔ ' + feitas + ' foto(s) apagada(s)', 4000);
}
