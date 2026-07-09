// ═══════════════════════════════════════════════════════════
// Service Worker · macht die App installierbar + offline-fähig
// ═══════════════════════════════════════════════════════════
// WICHTIG (Lehre aus dem "schwarzer Bildschirm nach Login"-Bug):
// Die App besteht aus vielen sich gegenseitig aufrufenden JS-Dateien
// (app.js + views-*.js). Werden davon EINIGE aus einem alten Cache und
// ANDERE frisch aus dem Netz geladen, entsteht eine Versions-Mischung
// (z.B. altes app.js ruft eine Funktion, die es im neuen views-*.js
// nicht mehr gibt) → unbehandelter Fehler → schwarzer Bildschirm.
//
// Zwei Vorkehrungen dagegen:
//  1) CACHE_VERSION bei JEDER Frontend-Änderung hochzählen. Ein neuer
//     Name erzwingt install→activate und löscht den alten Cache komplett,
//     sodass die zwischengespeicherte Shell nie "hängen" bleibt.
//  2) NETZWERK-ZUERST für App-Dateien (HTML/JS/CSS): online bekommt man
//     immer den frischen, in sich stimmigen Satz; der Cache dient nur als
//     Offline-Rückfall. So kann Shell und Views nie auseinanderlaufen.
const CACHE_VERSION = 'v2';                 // ⬅️ bei Frontend-Änderungen erhöhen
const CACHE_NAME = `srdf-os-${CACHE_VERSION}`;

// Der komplette App-Shell — als EIN atomarer Satz vorgeladen, damit
// offline nie eine halbe (gemischte) App entsteht.
const SHELL_FILES = [
  './index.html',
  './manifest.json',
  './styles.css',
  './app.js',
  './views-desktop.js',
  './views-automations.js',
  './views-dashboard.js',
  './views-approvals.js',
  './views-chat.js',
  './views-shopify.js',
  './views-social.js',
  './views-analytics.js',
  './views-ai.js',
  './views-settings.js',
];

self.addEventListener('install', (event) => {
  // Best effort: sollte eine Datei (noch) nicht abrufbar sein, darf das
  // die Installation nicht scheitern lassen — der Rest wird trotzdem
  // vorgeladen, Fehlendes kommt später per Netzwerk nach.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(SHELL_FILES.map((f) => cache.add(f)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Alle FRÜHEREN Caches wegräumen — so bleibt keine alte Shell zurück.
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Nur eigene GET-Anfragen behandeln. API-Aufrufe NIE cachen (immer
  // frische Daten), fremde Hosts unangetastet lassen.
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Netzwerk-zuerst: die frische, in sich stimmige Datei gewinnt; bei
  // Erfolg aktualisieren wir leise den Cache (für den Offline-Fall).
  // Nur wenn das Netz nicht antwortet, greifen wir auf den Cache zurück —
  // für Navigationen zusätzlich auf die gecachte index.html.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          if (request.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        })
      )
  );
});
