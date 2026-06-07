const CACHE_VERSION = 'guineemarche-v2'
const STATIC_CACHE  = `${CACHE_VERSION}-static`
const OFFLINE_URLS  = ['/', '/index.html']

// Installation : mise en cache des pages essentielles
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(STATIC_CACHE).then(c => c.addAll(OFFLINE_URLS))
    )
    self.skipWaiting()
})

// Activation : nettoyage des anciens caches
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(k => k !== STATIC_CACHE)
                    .map(k => caches.delete(k))
            )
        )
    )
    self.clients.claim()
})

// Stratégie Network-first pour les pages, Cache-first pour les assets statiques
self.addEventListener('fetch', (e) => {
    const { request } = e
    if (request.method !== 'GET') return
    const url = new URL(request.url)

    // Ne jamais intercepter les appels API
    if (url.pathname.startsWith('/api/')) return
    // Ne jamais intercepter les ressources Cloudinary et externes
    if (url.hostname !== self.location.hostname) return

    // Assets statiques (JS, CSS, images) → Cache-first
    if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?)$/)) {
        e.respondWith(
            caches.match(request).then(cached => cached || fetch(request).then(res => {
                const clone = res.clone()
                caches.open(STATIC_CACHE).then(c => c.put(request, clone))
                return res
            }))
        )
        return
    }

    // Pages HTML → Network-first, fallback sur index.html
    e.respondWith(
        fetch(request)
            .then(res => {
                const clone = res.clone()
                caches.open(STATIC_CACHE).then(c => c.put(request, clone))
                return res
            })
            .catch(() => caches.match(request).then(c => c || caches.match('/index.html')))
    )
})
