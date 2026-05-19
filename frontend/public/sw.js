/**
 * Service Worker para Trocaria - Cache de assets para otimizar Render Free Tier
 * 
 * Estratégia: Cache First para assets estáticos, Network First para API
 */

const CACHE_NAME = 'trocaria-v1';
const STATIC_CACHE = [
  '/',
  '/index.html',
  '/logo.png',
  '/favicon.svg'
];

// Instalação - cacheia assets estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_CACHE);
    })
  );
  self.skipWaiting();
});

// Ativação - limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Intercepta requisições
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Estratégia 1: Assets estáticos (JS, CSS, imagens) - Cache First
  if (request.destination === 'script' || 
      request.destination === 'style' || 
      request.destination === 'image' ||
      request.destination === 'font') {
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) {
          return response;
        }
        return fetch(request).then((fetchResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, fetchResponse.clone());
            return fetchResponse;
          });
        });
      })
    );
    return;
  }

  // Estratégia 2: API requests - Network First com fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          return response;
        })
        .catch(() => {
          // Se offline, tenta retornar do cache se existir
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            // Retorna erro offline para API
            return new Response(
              JSON.stringify({ detail: 'Você está offline. Verifique sua conexão.' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // Estratégia 3: Outras requisições - Network First
  event.respondWith(
    fetch(request).catch(() => {
      return caches.match(request);
    })
  );
});