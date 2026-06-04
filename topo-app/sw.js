/* ============================================================
   Service Worker — Control Topográfico Terreno
   Estrategia: Cache-first para assets locales,
               network-first con fallback a cache para CDN.
   ============================================================ */

const CACHE_NAME  = 'topo-v2';
const CDN_XLSX    = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

const LOCAL_ASSETS = [
  './index.html',
  './manifest.json',
  './sw.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

/* ── INSTALL: pre-cachear todo ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Assets locales (críticos — falla si no están)
      await cache.addAll(LOCAL_ASSETS);

      // xlsx desde CDN (intenta cachear; no bloquea si no hay internet)
      try {
        const res = await fetch(CDN_XLSX);
        if (res.ok) await cache.put(CDN_XLSX, res);
      } catch (_) { /* sin internet al instalar — se cacheará en primer uso */ }
    })
  );
  self.skipWaiting();
});

/* ── ACTIVATE: limpiar caches antiguas ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ── FETCH: responder desde cache, actualizar en background ── */
self.addEventListener('fetch', event => {
  const req = event.request;

  // Solo interceptar GET
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then(cached => {
      const networkFetch = fetch(req).then(res => {
        // Si la respuesta es válida, actualizar cache en background
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => null);

      // Devolver cache inmediatamente si existe; sino esperar red
      return cached || networkFetch;
    })
  );
});
