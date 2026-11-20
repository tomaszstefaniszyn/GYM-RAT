/* GYM RAT service worker.
   Pages and API stay on the network so plans are never stale.
   Hashed bundles, exercise photos and icons are cache-first. */
const CACHE = 'gym-rat-static-v2'

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      await self.clients.claim()
    })(),
  )
})

function isStaticAsset(url) {
  if (url.origin !== self.location.origin) return false
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/exercises/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/logo.png'
  )
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (!isStaticAsset(url)) return
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      const cached = await cache.match(event.request)
      if (cached) return cached
      const response = await fetch(event.request)
      if (response.ok) cache.put(event.request, response.clone()).catch(() => undefined)
      return response
    })(),
  )
})
