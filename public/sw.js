// Service Worker Takata Kwetu — mode hors-ligne
// Numéro de version : à incrémenter à chaque mise à jour du shell (l'appel reg.update()
// au démarrage + Cache-Control no-cache sur /sw.js garantissent la détection rapide).
const CACHE = 'takata-v7';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
'/css/takata.css?v=4',
'/js/app.js?v=4',
'/js/api.js?v=4',
'/js/views.js?v=4',
'/js/admin.js?v=4',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon.png',
  '/icons/favicon-32.png'
];

// Installation : pré-cache du shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Stratégie : cache-first pour le statique, network-first pour l'API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return; // POST/PUT gérés hors SW

  if (url.pathname.startsWith('/api/')) {
    // Network-first avec repli cache (lectures hors-ligne)
    event.respondWith(
      fetch(event.request)
        .then((res) => {
        if (!res.ok) return res; // ne pas mettre en cache 401/500
        const clone = res.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        return res;
      })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Statique : cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        return res;
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});