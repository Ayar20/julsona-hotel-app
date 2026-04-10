const CACHE_NAME = 'julsona-hotels-v1';

// Core pages and assets to cache for offline use
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/booking.html',
  '/rooms.html',
  '/rooms-deluxe.html',
  '/rooms-executive.html',
  '/rooms-royal.html',
  '/gallery.html',
  '/about.html',
  '/contact.html',
  '/bush-bar.html',
  '/vip-lounge.html',
  '/lounge&Bar.html',
  '/Julsona.css',
  '/Julsona.js',
  '/booking.js',
  '/lightbox.js',
  '/header.html',
  '/footer.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/Julsona Logo.jpg'
];

// Install event – cache all static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).catch(err => {
      console.warn('[SW] Some assets failed to cache:', err);
    })
  );
  self.skipWaiting();
});

// Activate event – clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch event – serve from cache, fall back to network
self.addEventListener('fetch', event => {
  // Skip non-GET requests and API calls (always fetch live)
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Serve cached version, update cache in background
        const fetchUpdate = fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => {});
        return cached;
      }

      // Not in cache – fetch from network
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        // Offline fallback for HTML pages
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('/index.html');
        }
      });
    })
  );
});
