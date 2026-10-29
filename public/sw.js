// Service worker do Meu Caderno de Receitas: guarda o app para abrir sem internet.
// Os dados das receitas não passam por aqui (ficam no IndexedDB ou no servidor).

const CACHE = 'caderno-v1'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png']
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com']

// Guarda a casca do app e os arquivos do build citados no index.html (JS e CSS com hash no nome).
async function precache() {
  const cache = await caches.open(CACHE)
  await cache.addAll(SHELL)
  const html = await (await cache.match('/index.html')).text()
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1])
  await cache.addAll(assets)
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function networkFirst(request, fallback) {
  const cache = await caches.open(CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(fallback ?? request, response.clone())
    return response
  } catch {
    return (await cache.match(fallback ?? request)) ?? Response.error()
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE)
  const hit = await cache.match(request)
  if (hit) return hit
  const response = await fetch(request)
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone())
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  // Fontes do Google: cache permanente.
  if (FONT_HOSTS.includes(url.hostname)) return event.respondWith(cacheFirst(request))
  if (url.origin !== self.location.origin) return
  // API e painel do PocketBase nunca vêm do cache.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_/')) return

  // Páginas (inclusive /?url=... do menu Compartilhar): rede primeiro, app guardado sem internet.
  if (request.mode === 'navigate') return event.respondWith(networkFirst(request, '/index.html'))
  // Arquivos do build têm hash no nome: podem vir direto do cache.
  if (url.pathname.startsWith('/assets/')) return event.respondWith(cacheFirst(request))
  event.respondWith(networkFirst(request))
})
