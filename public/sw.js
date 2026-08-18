const CACHE_NAME = 'myalphapics-v4';
const ASSETS_TO_CACHE = [
  '/manifest.json',
  '/sounds/pop.mp3',
  '/sounds/cheering.mp3',
  ...Array.from({length: 26}, (_, i) => `/images/${String.fromCharCode(97 + i)}.png`),
  '/images/myalphapics.jpg'
];

// Speech is pre-generated audio now, so offline play depends on these clips
// being cached. Warmed after activation rather than during install: 188 files
// in addAll() would fail the whole install if any single fetch failed.
async function warmAudioCache() {
  try {
    const res = await fetch('/audio/manifest.json');
    if (!res.ok) return;
    const keys = await res.json();
    const cache = await caches.open(CACHE_NAME);
    for (const key of keys) {
      const url = `/audio/${key}.mp3`;
      if (await cache.match(url)) continue;
      try {
        const clip = await fetch(url);
        if (clip.ok) await cache.put(url, clip);
      } catch (e) {
        // Skip this clip — the fetch handler still caches it on first play.
      }
    }
  } catch (e) {
    // Offline during activation. Clips cache on demand instead.
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
    await warmAudioCache();   // after claim, so pages are never blocked on it
  })());
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests — Cache API doesn't support HEAD/POST
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Static assets (images, sounds, speech clips, manifest) — cache first
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
