// Doughdog service worker: makes the app open offline after the first visit.
// Bump CACHE when the caching rules change (file names of built assets are already unique).
const CACHE = 'doughdog-v2'
const FONT_HOSTS = [] // fonts are bundled with the app

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', './manifest.webmanifest', './favicon.svg', './icon-192.png'])).then(() => self.skipWaiting()))
})
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})

// The page tells us which files it loaded so they can be stored for offline use.
self.addEventListener('message', e => {
  const urls = (e.data && e.data.cache) || []
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(urls.map(u => c.match(u, { ignoreVary: true }).then(hit => hit || c.add(u).catch(() => {}))))))
})

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin && !FONT_HOSTS.includes(url.hostname)) return

  // Paths are relative to this file, so the app works at the site root or in a sub-folder.
  // Pages: try the network first (fresh version), fall back to the stored app shell.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(new URL('./', self.location).href, copy)); return res }).catch(() => caches.match(new URL('./', self.location).href, { ignoreVary: true })))
    return
  }
  // Everything else: stored copy first, otherwise fetch and store.
  // ignoreVary: these are static files, and some servers add `Vary: Origin`, which would defeat the lookup.
  e.respondWith(caches.match(req, { ignoreVary: true }).then(hit => hit || fetch(req).then(res => {
    if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)) }
    return res
  })))
})
