const CACHE = 'surabhi-v4';
const PRECACHE = [
  '/',
  '/index.html',
  '/product-detail.html',
  '/about.html',
  '/returns.html',
  '/css/styles.css',
  '/css/product-detail.css',
  '/js/app.js',
  '/js/product-detail.js',
  '/js/footer.js',
  '/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => {
        // Force every open tab to reload so they get fresh files immediately
        clients.forEach(client => {
          try { client.navigate(client.url); } catch(_) {}
        });
      })
  );
});

self.addEventListener('fetch', e => {
  // Only handle GET requests for same-origin assets — never intercept API calls
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.hostname.includes('google') || url.hostname.includes('googleapis')) return;
  if (url.hostname.includes('fonts')) return;

  // Network-first: always fetch fresh content, fall back to cache when offline
  e.respondWith(
    fetch(e.request).then(res => {
      if (res && res.status === 200 && url.origin === self.location.origin) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
