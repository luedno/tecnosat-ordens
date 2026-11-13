/* App de Ordens de Serviço — parte 5 de 5 (não precisa mexer) */
  // ---------------------------------------------------------- equipe (só dono)
  function telaEquipe() {
    const lista = Object.values(S.perfis).sort((a, b) => a.nome.localeCompare(b.nome));
    const papelR = { dono: 'Dono', funcionario: 'Funcionário', pendente: 'Aguardando liberação', bloqueado: 'Bloqueado' };
    const link = location.origin + location.pathname;
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
    const outros = lista.filter((p) => p.papel !== 'pendente');
    moldura('Equipe', `
      <div class="card">
        <h3>Convidar funcionário</h3>
        <p class="small">Mande este link para o funcionário. Ele toca em <b>Criar conta</b> e depois você libera aqui.</p>
        <input readonly value="${esc(link)}" onclick="this.select()">
        <div class="btns"><button class="btn zap" id="convite">💬 Enviar convite no WhatsApp</button></div>
      </div>
      ${pend.length ? '<div class="dia">Aguardando liberação</div>' + pend.map(linha).join('') : ''}
      <div class="dia">Equipe</div>
      ${outros.map(linha).join('')}
    `);
    document.getElementById('convite').onclick = () => abrirZap('', `Instale o app da ${C.NOME_EMPRESA || 'assistência'}: abra ${link} no celular, toque em "Criar conta" e me avise. Depois, no menu do navegador, toque em "Adicionar à tela inicial".`);
    $app.querySelectorAll('[data-papel]').forEach((b) => b.onclick = async () => {
      const p = S.perfis[b.dataset.uid];
      if (b.dataset.papel === 'bloqueado' && !confirm('Bloquear ' + p.nome + '? Ele não vai mais conseguir ver as ordens.')) return;
      const { data, error } = await sb.from('perfis').update({ papel: b.dataset.papel }).eq('id', p.id).select().single();
      if (error) return erro(error, 'equipe');
      S.perfis[p.id] = data; toast('✔ ' + p.nome + ': ' + papelR[data.papel]); render();
    });
  }

  // ---------------------------------------------------------- liga tudo
  sb.auth.onAuthStateChange((evento, session) => {
    setTimeout(() => {
      if (evento === 'SIGNED_OUT') return iniciar(null);
      if (['INITIAL_SESSION', 'SIGNED_IN'].includes(evento)) iniciar(session);
    }, 0);
  });
