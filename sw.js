// Permite instalar o app no celular. Sempre busca a versão mais nova quando há internet.
const CACHE = 'os-v2';
const ARQUIVOS = ['./', 'index.html', 'style.css', 'app1.js', 'app2.js', 'app3.js', 'app4.js', 'app5.js', 'config.js', 'manifest.json', 'icon-192.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => {
    const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); return r;
  }).catch(() => caches.match(e.request).then((r) => r || caches.match('./'))));
});
