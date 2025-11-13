/* service-worker.js - place at site root */
const SW_VERSION = 'v1.2.0';
const STATIC_CACHE = `static-${SW_VERSION}`;
const RUNTIME_CACHE = `runtime-${SW_VERSION}`;
const PRECACHE_URLS = [
  '/',                // index.html
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/styles.css',
  '/script.js',
  '/install.js',
  '/favicon.ico',
  // common icons - ensure these files exist in /icons/
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-icon-512.png'
];

// Install - cache static assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .catch(err => console.error('[SW] Install failed', err))
  );
});

// Activate - cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// Fetch handler - cache-first for static, network-first for navigation, runtime caching for images
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignore non-GET
  if (req.method !== 'GET') return;

  // Navigation -> try network first, fallback to cache, then offline page
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(res => {
        // update runtime cache copy
        caches.open(RUNTIME_CACHE).then(cache => cache.put(req, res.clone()));
        return res;
      }).catch(() => caches.match('/offline.html').then(resp => resp || Response.error()))
    );
    return;
  }

  // For same-origin requests to static files -> cache-first
  if (url.origin === location.origin) {
    // images & icons -> runtime cache (keep limited)
    if (req.destination === 'image' || url.pathname.startsWith('/icons/')) {
      event.respondWith(
        caches.match(req).then(cached => cached || fetch(req).then(networkRes => {
          return caches.open(RUNTIME_CACHE).then(cache => {
            cache.put(req, networkRes.clone());
            // optional: keep runtime cache trimmed
            trimCache(RUNTIME_CACHE, 80);
            return networkRes;
          });
        }).catch(() => cached || Response.error()))
      );
      return;
    }

    // other files -> static cache first
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        // optional: populate runtime
        return caches.open(RUNTIME_CACHE).then(cache => {
          cache.put(req, res.clone());
          return res;
        });
      }))
    );
    return;
  }

  // cross-origin requests -> try network then cache
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});

// Listen for messages (skipWaiting / trigger update UI)
self.addEventListener('message', (evt) => {
  const data = evt.data;
  if (!data) return;
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Utility: trim cache to max entries
async function trimCache(cacheName, maxItems = 50) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
    await trimCache(cacheName, maxItems);
  }
}