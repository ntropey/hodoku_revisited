/*
 * Hodoku Revisited service worker: app shell + runtime cache, so the app works offline.
 * Pages (index.html) are fetched from the network first, so a new deploy shows up on the next visit; the
 * hashed assets they point to never change, so they come from the cache first.
 */
const CACHE = 'hodoku-v2';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg'];
const MAX_ENTRIES = 150;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Keep the cache from growing with every deploy: drop the oldest entries (the cache lists them oldest first). */
async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length > MAX_ENTRIES) await Promise.all(keys.slice(0, keys.length - MAX_ENTRIES + 30).map((k) => cache.delete(k)));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      if (isPage) {
        // network first: a deploy is visible on the next visit; offline, the cached page is used
        try {
          const res = await fetch(req);
          if (res.ok) {
            cache.put(req, res.clone());
            cache.put('index.html', res.clone());
            trim(cache);
          }
          return res;
        } catch {
          return (await cache.match(req, { ignoreSearch: true })) ?? (await cache.match('index.html')) ?? Response.error();
        }
      }
      // everything else (hashed assets, icons, manifest): cache first
      const cached = await cache.match(req, { ignoreSearch: true });
      if (cached) return cached;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    }),
  );
});
