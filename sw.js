const CACHE_NAME = 'studiora-shell-v2';
const APP_SHELL = [
  './', './index.html', './style.css', './manifest.webmanifest', './icons/icon.svg',
  './src/main.js', './src/config.js', './src/state.js', './src/events.js', './src/prompts.js',
  './src/backup.js', './src/utils/html.js', './src/utils/validation.js',
  './src/services/notes.js', './src/services/storage.js', './src/services/json.js', './src/services/terms.js', './src/services/library.js', './src/services/sync.js', './src/services/search.js',
  './src/ui/navigation.js', './src/ui/dom.js', './src/ui/theme.js', './src/ui/render.js', './src/ui/modals.js'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match('./index.html'))));
});
