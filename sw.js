// Service worker del Consultor de Garantía Extendida
// Estrategia: abre al instante desde la caché y, en segundo plano, descarga
// la versión del servidor. Si cambió (p. ej. tarifas nuevas), avisa a la página.
const CACHE = 'eg-cache-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.mode !== 'navigate') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const key = url.origin + url.pathname; // ignora ?parámetros

  const cacheP = caches.open(CACHE);
  const cachedP = cacheP.then(c => c.match(key));

  const networkP = fetch(key, { cache: 'no-cache' }).then(async res => {
    if (res.ok) {
      const cache = await cacheP;
      const anterior = await cache.match(key);
      const textoAnterior = anterior ? await anterior.text() : null;
      const textoNuevo = await res.clone().text();
      await cache.put(key, res.clone());
      if (textoAnterior !== null && textoAnterior !== textoNuevo) {
        const clientes = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        clientes.forEach(c => c.postMessage('eg-actualizado'));
      }
    }
    return res;
  });

  e.waitUntil(networkP.catch(() => {}));
  e.respondWith(cachedP.then(hit => hit || networkP));
});
