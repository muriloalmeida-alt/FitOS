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

   BUG CORRIGIDO (15/08/2026): esse número ficou parado em v20 por
   VÁRIOS deploys seguidos que mexeram em index.html/app.js/style.css
   (toda a leva "Freemium sem login" + os ajustes depois) — quem já
   tinha o app aberto/instalado antes continuava recebendo o HTML/JS
   antigo do cache (stale-while-revalidate serve o cache na hora,
   sempre), enquanto o backend já rodava as rotas novas. Pior ainda:
   como cada arquivo do App Shell revalida (atualiza o cache) de forma
   INDEPENDENTE, dava pra um visitante ficar com um MIX — ex.: app.js
   novo (que espera elementos como #authGateClose, #desktopBanner) rodando
   em cima de um index.html ainda velho (sem esses elementos) — e
   qualquer acesso a esse elemento inexistente estourava exceção bem
   cedo no boot(), sem try/catch nenhum ali (ver app.js), travando o
   app inteiro numa tela em branco pro visitante. A partir de agora:
   TODO deploy que mexer em qualquer arquivo do APP_SHELL abaixo
   precisa bumpar esse número — é o único jeito de forçar quem já tinha
   o site aberto a pegar a versão nova certinha, sem mistura.

   BUMP (16/08/2026): brdata.online acabou de sair do ar (DNS+SSL só
   resolveram agora) e produção ainda estava em deploy MANUAL no
   Railway -- o 1º acesso real ao domínio caiu num app.js várias
   versões atrás (setupEventListeners tentando addEventListener num
   elemento que não existe mais nessa versão do index.html, mesmo
   "mix" descrito acima), travando o boot() no meio e deixando só o
   resumo estático pro Google visível. Produção acabou de virar
   deploy AUTOMÁTICO (autorizado pelo usuário) -- esse commit é o
   gatilho do 1º deploy automático, e bumpar aqui garante que quem
   quer que já tenha acessado o domínio nesse meio tempo (com o app.js
   velho) também descarte esse cache misturado na próxima visita.

   BUMP (26/08/2026): placar ao vivo na aba Jogos (pedido do usuário) --
   mexeu em app.js (LIVE_SCORES/refreshLiveScores/getRoundMatches/
   fullMatchCardHTML/matchHeroHTML), liveData.js (loadLiveScores) e
   style.css (.live-tag/.match-hero-badge-live) ao mesmo tempo -- os 3
   arquivos do APP_SHELL abaixo. Mesma regra de sempre (ver topo deste
   comentário): bumpar aqui evita o "mix" de app.js novo com liveData.js/
   style.css velhos (ou vice-versa) pra quem já tinha o app aberto.

   BUMP (29/08/2026): "Modo Técnico" (carreira estilo Elifoot, pedido do
   usuário) -- mexeu em index.html (novo link "Modo Técnico" na
   sidebar), que já estava no APP_SHELL abaixo -- mesma regra de sempre.
   A página nova em si (/carreira, public/carreira.html, js/carreira.js)
   fica FORA do APP_SHELL de propósito, mesmo padrão já usado pra
   /admin (também não precisa entrar aqui) -- o handler "fetch"
   genérico abaixo já cacheia (stale-while-revalidate) qualquer GET
   same-origin sob demanda na 1ª visita, sem precisar listar cada
   página secundária no precache de instalação.
=================================================================== */
const CACHE_NAME = "brdata-shell-v28";
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
