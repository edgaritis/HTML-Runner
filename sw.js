const CACHE = 'html-runner-v3';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never intercept GitHub API or githubusercontent — must hit network.
  if (url.host === 'api.github.com' ||
      url.host.endsWith('.githubusercontent.com')) {
    return;
  }

  // Network-first for the HTML shell so updates land immediately when online.
  // Falls back to cache when offline.
  const isShell = req.mode === 'navigate'
    || req.destination === 'document'
    || url.pathname.endsWith('/index.html')
    || url.pathname.endsWith('/');

  if (isShell) {
    e.respondWith(
      fetch(req).then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(req, clone)).catch(()=>{});
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for static assets (icons, manifest, etc.)
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).catch(() => caches.match('./index.html'));
    })
  );
});
