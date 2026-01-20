const CACHE_NAME = 'esp-calc-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://unpkg.com/chart.js@4.4.0/dist/chart.umd.js'
];

// При установке Service Worker
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Caching files...');
      return cache.addAll(urlsToCache).catch(err => {
        console.log('Some files could not be cached (expected for CDN):', err);
        // Игнорируем ошибки с CDN, это нормально
      });
    })
  );
  self.skipWaiting();
});

// При активации Service Worker
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
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

// Сеть -> Кэш (Network First)
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // GET запросы
  if (request.method !== 'GET') {
    return;
  }

  // Для CDN (Chart.js) - стараемся сеть, потом кэш
  if (url.hostname !== 'unpkg.com' && url.hostname !== location.hostname) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (!response || response.status !== 200) throw new Error('Failed');
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseToCache);
          });
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Для локальных файлов - кэш -> сеть
  event.respondWith(
    caches.match(request).then(response => {
      return response || fetch(request)
        .then(response => {
          if (!response || response.status !== 200) {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // Если нет сети и нет в кэше - возвращаем index.html
          return caches.match('/index.html');
        });
    })
  );
});
