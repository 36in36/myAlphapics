const CACHE_NAME = 'myalphapics-v3';
const ASSETS_TO_CACHE = [
  '/manifest.json',
  '/sounds/pop.mp3',
  '/sounds/cheering.mp3',
  ...Array.from({length: 26}, (_, i) => `/images/${String.fromCharCode(97 + i)}.png`),
  '/images/myalphapics.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests — Cache API doesn't support HEAD/POST
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Static assets (images, sounds, manifest) — cache first
  if (url.pathname.match(/\.(png|jpg|jpeg|webp|mp3|wav|json)$/) && !url.pathname.includes('_next')) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      }))
    );
    return;
  }

  // Everything else (HTML, JS, CSS) — network first, fall back to cache
  event.respondWith(
    fetch(event.request).then((response) => {
      const clone = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
      return response;
    }).catch(() => caches.match(event.request))
  );
});
