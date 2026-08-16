const CACHE_NAME = 'daily-task-monitor-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/public/placeholder.json',
  '/src/css/style.css',
  '/src/js/main.js',
  '/src/js/storage.js',
  '/src/js/tasks.js',
  '/src/js/ui.js',
  '/src/js/utils.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install — cache only your own assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch — cache first for own assets, network first for CDN
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Cache first for same-origin assets
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        });
      }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Network first then cache for CDN assets (Tailwind, Google Fonts)
  if (url.href.includes('cdn.tailwindcss.com') || url.href.includes('fonts.googleapis.com') || url.href.includes('fonts.gstatic.com')) {
    event.respondWith(
      fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }
});