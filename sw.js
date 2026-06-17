// ═══════════════════════════════════════════════════════════
// Service Worker · macht die App installierbar + grundlegend offline-fähig
// ═══════════════════════════════════════════════════════════
const CACHE_NAME = 'srdf-os-v1';
const SHELL_FILES = ['./index.html', './manifest.json', './app.js', './styles.css'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // API-Aufrufe NIE cachen — die brauchen immer echte, frische Daten
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
