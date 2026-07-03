const CACHE_NAME = 'media112-v8';
const urlsToCache = [
    './',
    './index.html',
    './css/style.css',
    './js/supabase.js',
    './js/data.js',
    './js/animations.js',
    './js/app.js',
    './manifest.json',
    './img/icon.svg'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// Network-first for Supabase API calls
function networkFirst(event) {
    return fetch(event.request)
        .then(response => {
            if (response && response.status === 200) {
                const responseToCache = response.clone();
                caches.open(CACHE_NAME)
                    .then(cache => cache.put(event.request, responseToCache));
            }
            return response;
        })
        .catch(() => {
            return caches.match(event.request);
        });
}

// Cache-first for static assets
function cacheFirst(event) {
    return caches.match(event.request)
        .then(response => {
            if (response) return response;
            return fetch(event.request)
                .then(response => {
                    if (!response || response.status !== 200 || response.type !== 'basic') return response;
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => cache.put(event.request, responseToCache));
                    return response;
                })
                .catch(() => {
                    if (event.request.destination === 'document') {
                        return caches.match('./index.html');
                    }
                });
        });
}

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Network-first for Supabase API
    if (url.hostname.includes('supabase.co')) {
        event.respondWith(networkFirst(event));
        return;
    }

    // Cache-first for everything else
    event.respondWith(cacheFirst(event));
});
