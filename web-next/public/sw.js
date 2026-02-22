/// <reference lib="webworker" />

const CACHE_NAME = "controlfinance-v1";

const STATIC_ASSETS = [
  "/",
  "/dashboard",
  "/login",
  "/icons/icon-192x192.svg",
  "/icons/icon-512x512.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Ignorar requisições que não são GET
  if (request.method !== "GET") return;

  // Ignorar chamadas à API — sempre buscar da rede
  if (request.url.includes("/api/")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cachear respostas válidas de navegação e assets
        if (response.ok && (request.mode === "navigate" || request.destination === "script" || request.destination === "style")) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline: tentar servir do cache
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          // Para navegação, retornar a página principal cacheada
          if (request.mode === "navigate") {
            return caches.match("/dashboard");
          }
          return new Response("Offline", { status: 503 });
        });
      })
  );
});
