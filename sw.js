// ═════════════════════════════════════════════════════════════════════
// Service worker · Consultor de Garantía Extendida
// - Con internet: siempre pide la versión más nueva (red primero).
// - Sin señal o si la red demora: abre lo último guardado.
// IMPORTANTE: sube VERSION en cada publicación (también si solo cambia
// datos.js). Así los celulares detectan el cambio y muestran el aviso.
// ═════════════════════════════════════════════════════════════════════
const VERSION = '3.34.1';
const CACHE = 'eg-' + VERSION;
const ARCHIVOS = ['./', './index.html', './datos.js', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];
const ESPERA_RED = 4000; // ms: si la red no responde en este tiempo, se usa lo guardado

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE)
    .then(function (c) { return c.addAll(ARCHIVOS.map(function (u) { return new Request(u, { cache: 'reload' }); })); })
    .then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys()
    .then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })
    .then(function () { return self.clients.claim(); }));
});

// La página pregunta qué versión trae este service worker
self.addEventListener('message', function (e) {
  if (e.data === 'version' && e.source) e.source.postMessage({ tipo: 'version', version: VERSION });
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;            // enlaces de Ripley y otros: sin tocar
  var nav = req.mode === 'navigate';
  var clave = nav ? './index.html' : url.pathname;            // ?v=... no crea copias nuevas
  e.respondWith(caches.open(CACHE).then(function (cache) {
    var guardado = function () { return cache.match(clave, { ignoreSearch: true }).then(function (r) { return r || (nav ? cache.match('./', { ignoreSearch: true }) : r); }); };
    var red = fetch(req, { cache: 'no-cache' }).then(function (res) {
      if (res && res.ok && res.type === 'basic') cache.put(clave, res.clone());
      return res;
    });
    red.catch(function () {});
    var plazo = new Promise(function (ok) { setTimeout(ok, ESPERA_RED); });
    return Promise.race([red, plazo]).then(function (res) {
      if (res) return res;
      return guardado().then(function (g) { return g || red; });  // la red demora: usa lo guardado
    }, function () {
      return guardado().then(function (g) { return g || Response.error(); });  // sin señal
    });
  }));
});
