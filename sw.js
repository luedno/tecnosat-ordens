// Permite instalar o app e receber notificações. Sempre busca a versão mais nova quando há internet.
const CACHE = 'os-v6';
const ARQUIVOS = ['./', 'index.html', 'style.css', 'config.js', 'manifest.json', 'icon-192.png',
  'app1.js', 'app2.js', 'app3.js', 'app4.js', 'app5.js', 'app6.js', 'app7.js', 'app8.js', 'app9.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => {
    const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); return r;
  }).catch(() => caches.match(e.request).then((r) => r || caches.match('./'))));
});
// Notificações
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { titulo: 'TecnoSat', corpo: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titulo || 'TecnoSat', {
    body: d.corpo || '', icon: 'icon-192.png', badge: 'icon-192.png', data: { url: d.url || '/' }, vibrate: [200, 100, 200]
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const alvo = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
    for (const c of lista) { if ('navigate' in c) return c.navigate(alvo).then((w) => w && w.focus()); }
    return self.clients.openWindow(alvo);
  }));
});
