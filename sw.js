const CACHE = 'hngxy-v2-' + Date.now();
const ASSETS = [
  '/', 'index.html', 'login.html', 'register.html', 'publish.html',
  'detail.html', 'chat.html', 'profile.html', 'admin.html',
  'css/style.css', 'js/script.js'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      return cached || fetch(e.request).then(function(resp) {
        if (resp.ok && resp.type === 'basic') {
          var clone = resp.clone();
          caches.open(CACHE).then(function(cache) { cache.put(e.request, clone); });
        }
        return resp;
      }).catch(function() {
        if (e.request.headers.get('accept') && e.request.headers.get('accept').includes('text/html')) {
          return caches.match('index.html');
        }
      });
    })
  );
});
