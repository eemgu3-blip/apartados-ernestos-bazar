
// Very small service worker for caching core files
const CACHE = 'ernestos-apartados-v1';
const FILES = ['/', '/index.html', '/styles.css', '/app.js', '/manifest.json', '/icons/icon.svg'];

self.addEventListener('install', ev=>{
  ev.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', ev=>{
  ev.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', ev=>{
  ev.respondWith(caches.match(ev.request).then(resp=>resp||fetch(ev.request)));
});
