/* ===================================================================
   SERVICE WORKER — deixa o BR Data instalável (PWA) e funcionando
   parcialmente offline.
   -------------------------------------------------------------------
   Estratégia:
   - "App shell" (HTML/CSS/JS/ícones): NETWORK-FIRST — toda vez que o
     visitante está online, busca a versão atual direto do servidor
     (com cache:"no-store", ignorando até o cache HTTP nativo do
     navegador) e só cai pro que estiver salvo em cache se a rede
     falhar (offline). Isso existe pra o app SEMPRE abrir com o deploy
     mais recente pra quem está online, sem exigir um 2º reload nem um
     clique em "atualizar" — só entra em jogo o que está em cache
     quando não há internet nenhuma.
   - /api/*: mesma ideia (network-first), já era assim antes.
   - Qualquer outra origem (fontes do Google, etc.): não intercepta,
     deixa o navegador cuidar do jeito normal dele.

   AJUSTE (29/08/2026, pedido do usuário: "Todo deploy novo estou com
   problema de cache no navegador"): a estratégia ANTERIOR pro app
   shell era "stale-while-revalidate" (responde na hora com o que já
   tava em cache, atualiza em segundo plano só pra PRÓXIMA visita) —
   ou seja, depois de todo deploy, o primeiro carregamento de quem já
   tinha o site aberto/instalado SEMPRE vinha da versão antiga, e só
   ficava em dia depois de um 2º carregamento (ou de esperar o aviso
   "nova versão disponível" e clicar em atualizar). Reportado
   repetidamente como "problema de cache a cada deploy" -- histórico
   de vários BUMPs manuais de CACHE_NAME abaixo (removidos deste
   comentário, mas seguem no histórico do git) tentando contornar o
   sintoma sem resolver a causa. Network-first resolve a causa: com
   internet, a versão nova aparece JÁ NO PRIMEIRO carregamento depois
   do deploy, sem esperar nada.

   CACHE_NAME não precisa mais ser bumpado manualmente a cada deploy
   (era o processo antigo, documentado nas versões anteriores deste
   arquivo) — o servidor substitui "__DEPLOY_VERSION__" abaixo por um
   valor calculado no boot do processo (ver DEPLOY_VERSION em
   server.js) toda vez que serve este arquivo, então cada novo deploy
   (que reinicia o processo no Railway) já gera um nome de cache novo
   sozinho — isso só importa pro fallback OFFLINE (o "activate" abaixo
   limpa o cache antigo), já que a estratégia network-first acima nem
   depende do cache pra quem está online. */
const CACHE_NAME = "brdata-shell-__DEPLOY_VERSION__";
const API_CACHE_NAME = "brdata-api-v1";

const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/css/style.css",
  "/js/qrcode-lib.js",
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

// networkFirst genérico — tenta a rede primeiro (cache:"no-store" pra
// nem o cache HTTP nativo do navegador servir uma cópia antiga sem
// perguntar pro servidor) e só cai pro cache dado (offline, ou o
// servidor fora do ar) se a rede falhar de verdade.
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request, { cache: "no-store" });
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

  const cacheName = isApiRequest(url) ? API_CACHE_NAME : CACHE_NAME;
  event.respondWith(networkFirst(request, cacheName));
});
