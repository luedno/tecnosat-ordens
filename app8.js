/* App TecnoSat — parte 8 de 8: liga tudo (não precisa mexer) */
sb.auth.onAuthStateChange((evento, session) => {
  setTimeout(() => {
    if (evento === 'SIGNED_OUT') return iniciar(null);
    if (['INITIAL_SESSION', 'SIGNED_IN'].includes(evento)) iniciar(session);
  }, 0);
});
