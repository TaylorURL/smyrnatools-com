// Service worker that caches build-emitted .mp4 files so background videos
// play from cache after their first fetch. skipWaiting plus clients.claim
// puts a new version in control of open tabs immediately rather than after
// the next reload.
const CACHE_NAME = 'video-cache-v1'

self.addEventListener('install', (event) => {
    self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
    // Vite (this project's bundler) emits hashed build assets under
    // `/assets/`, not `/static/media/` — that path is Create React App's
    // convention and never appears in this build's output, so matching it
    // silently never caught a single video request.
    if (event.request.url.includes('/assets/') &&
        event.request.url.includes('.mp4')) {
        event.respondWith(
            caches.match(event.request).then((response) => {
                if (response) {
                    return response
                }

                return fetch(event.request).then((response) => {
                    if (response.status === 200) {
                        const responseClone = response.clone()
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseClone)
                        })
                    }
                    return response
                })
            })
        )
    }
})

self.addEventListener('activate', (event) => {
    event.waitUntil(
        // eslint-disable-next-line no-undef
        clients.claim()
    )
})