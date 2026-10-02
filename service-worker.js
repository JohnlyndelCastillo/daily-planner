const CACHE_NAME = 'daily-task-monitor-v4';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/placeholder.json',
  '/src/css/style.css',
  '/src/js/main.js',
  '/src/js/storage.js',
  '/src/js/tasks.js',
  '/src/js/ui.js',
  '/src/js/utils.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/app-mark.svg',
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

// Fetch — network first for same-origin assets and CDN files
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Prefer fresh same-origin files, keeping a cached copy for offline use.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (!response.ok) return response;
        return caches.open(CACHE_NAME)
          .then(cache => cache.put(event.request, response.clone()))
          .then(() => response);
      }).catch(async () => {
        const cached = await caches.match(event.request);
        return cached || (event.request.mode === 'navigate' ? caches.match('/index.html') : Response.error());
      })
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
