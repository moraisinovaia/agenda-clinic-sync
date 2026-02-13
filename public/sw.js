const CACHE_NAME = 'app-v1.4';

const commonUrls = ['/'];
const inovaiaUrls = ['/manifest.json', '/icon-192.png', '/icon-512.png'];
const gtInovaUrls = ['/manifest-gt-inova.json', '/gt-inova-icon-192.png', '/gt-inova-icon-512.png'];

// Install event - cache resources based on hostname
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  const isGtInova = self.location.hostname.toLowerCase().includes('gt.inovaia');
  const urlsToCache = [...commonUrls, ...(isGtInova ? gtInovaUrls : inovaiaUrls)];

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching app shell for:', isGtInova ? 'GT INOVA' : 'INOVAIA');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.log('Cache install failed:', error);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, then cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const responseToCache = response.clone();

        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(event.request, responseToCache);
          });

        return response;
      })
      .catch(() => {
        return caches.match(event.request)
          .then((response) => {
            if (response) {
              return response;
            }
            if (event.request.destination === 'document') {
              return caches.match('/');
            }
          });
      })
  );
});
