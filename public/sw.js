/* ===================================================================
   SERVICE WORKER — deixa o BR Data instalável (PWA) e funcionando
   parcialmente offline.
   -------------------------------------------------------------------
   Estratégia:
   - "App shell" (HTML/CSS/JS/ícones): stale-while-revalidate — responde
     na hora com o que já está em cache (app abre instantâneo, inclusive
     offline) e atualiza o cache em segundo plano pra próxima visita.
   - /api/*: network-first — tenta sempre buscar dado fresco; se falhar
     (sem internet), cai pro último resultado em cache daquele endpoint,
     se existir. O front-end já sabe lidar com API indisponível (cai
     pro modo de exemplo ou mostra "não disponível"), então isso aqui é
     só uma camada extra pra quem já tinha aberto o app antes.
   - Qualquer outra origem (fontes do Google, etc.): não intercepta,
     deixa o navegador cuidar do jeito normal dele.

   CACHE_NAME: muda a cada mudança relevante de assets — isso invalida
   o cache antigo automaticamente no próximo deploy (ver "activate"
   abaixo, que limpa qualquer cache com nome diferente deste).
=================================================================== */
const CACHE_NAME = "brdata-shell-v9";
const API_CACHE_NAME = "brdata-api-v1";

const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/css/style.css",
  "/js/data.js",
  "/js/engine.js",
  "/js/liveData.js",
  "/js/affiliates.js",
  "/js/app.js",
  "/img/logo.png",
  "/img/cbf-logo.png",
  "/img/icons/icon-192.png",
  "/img/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== API_CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

function isApiRequest(url) {
  return url.pathname.startsWith("/api/");
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const networkFetch = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || (await networkFetch) || Response.error();
}

async function networkFirst(request) {
  const cache = await caches.open(API_CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("offline e sem cache pra essa consulta");
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // não intercepta POST/etc.

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // deixa passar (fontes externas etc.)

  if (isApiRequest(url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});
