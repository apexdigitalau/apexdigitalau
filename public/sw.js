/* Apex CRM service worker.
 *
 * Deliberately conservative. This is an authenticated CRM, so the cache is
 * limited to static, non-sensitive assets. API responses, auth routes and
 * anything non-GET are always served from the network so we can never show
 * stale leads or serve one session's data to another.
 */

const CACHE = 'apex-crm-v1';
const OFFLINE_URL = '/offline.html';

// Only assets that are safe to serve to anyone.
const PRECACHE = [OFFLINE_URL, '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isPrivate(url) {
  return url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/');
}

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Never touch non-GET, cross-origin, API or auth traffic.
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (isPrivate(url)) return;

  // Page loads: hit the network, fall back to an offline page so a dead
  // connection doesn't show the browser's error page inside the installed app.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Static assets: serve from cache, refresh in the background.
  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request)
        .then(response => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
