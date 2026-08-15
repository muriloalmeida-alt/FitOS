/* ===================================================================
   SERVER.JS — Backend do Simulador Brasileirão 2026
   -------------------------------------------------------------------
   - Serve os arquivos estáticos do front-end (pasta ../public)
   - Faz proxy autenticado para a API-Sports (protege sua chave —
     ela nunca é exposta ao navegador do usuário)
   - Cacheia respostas em memória pra economizar sua cota diária
     (plano free = 100 requisições/dia)

   Como rodar:
     1) cp .env.example .env   e cole sua chave (API_SPORTS_KEY)
     2) node server.js
     3) abra http://localhost:8787
   Não requer "npm install" — usa só módulos nativos do Node 18+.
=================================================================== */

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Precisa rodar ANTES de qualquer require de módulo nosso que leia
// variável de ambiente no topo do arquivo (ex.: server/src/supportPlans.js,
// que calcula os preços dos planos assim que é carregado) — módulo
// Node só executa o corpo 1x, na primeira vez que é importado, então
// se o .env fosse lido depois desses requires, esses módulos nunca
// veriam as variáveis definidas nele (só as já exportadas pelo host,
// tipo Railway). function loadDotEnv() é uma "function declaration",
// por isso pode ser chamada aqui mesmo estando definida mais abaixo
// no arquivo (hoisting).
loadDotEnv();

// Camada de fornecedor de dados esportivos (ver server/src/providers/
// index.js) — server.js só fala com essa interface, nunca direto com
// apiSportsGet/adapter.js. Trocar de fornecedor é 100% isolado ali.
const dataProvider = require("./src/providers");
const cache = require("./src/cache");
const oddsHistory = require("./src/oddsHistory");
const { fetchBroadcastStation } = require("./src/broadcastSource");
const { fetchBroadcastFromEPG, getStats: getEpgStats } = require("./src/epgSource");
// Requerido direto (não só através de providers/sportmonks.js) pra
// expor métricas de tráfego na área administrativa (ver
// GET /api/adminpanel/integrations) mesmo quando o fornecedor ativo
// hoje é outro (api-sports) — nesse caso as métricas simplesmente
// ficam zeradas (nenhuma chamada foi feita), o que já é a resposta
// certa. Seguro de exigir sempre: nenhum código desse módulo roda de
// verdade até sportmonksGet/sportmonksGetAll serem chamados, então
// não faz chamada nenhuma nem exige token só por ser importado aqui.
const sportmonksClient = require("./src/sportmonksClient");
const analytics = require("./src/analytics");
const { fetchNews } = require("./src/newsSource");
const mercadoPago = require("./src/mercadoPago");
const supportPlans = require("./src/supportPlans");
const users = require("./src/users");
const sessions = require("./src/sessions");
const competitions = require("./src/competitions");
const paymentsLedger = require("./src/paymentsLedger");
const contentStore = require("./src/contentStore");
const publicRateLimit = require("./src/publicRateLimit");
const { slugify } = require("./src/slug");

const PORT = process.env.PORT || 8787;
const LEAGUE_ID = process.env.LEAGUE_ID || "71"; // 71 = Brasileirão Série A na API-Sports (confirme no /api/leagues/search)
// Temporada usada no modo ao vivo — configurável no Railway/host, sem
// precisar editar código nem dar redeploy manual de código toda vez
// que quiser trocar (ex.: plano free da API-Sports geralmente só cobre
// temporadas passadas, não a corrente). O front-end nunca mais
// hardcoda esse valor — ele pergunta pro backend via GET /api/health.
const LIVE_SEASON = process.env.LIVE_SEASON || "2023";
const PUBLIC_DIR = path.join(__dirname, "..", "public");

// Anúncio em vídeo do plano Freemium (ver #adModal em index.html e
// showAdModal()/loadAdSenseScript() em app.js) — engine real do
// Google AdSense no lugar do placeholder simulado que tinha antes.
// Sem os 2 valores abaixo configurados, o front-end nem injeta o
// script do AdSense nem tenta mostrar o modal de anúncio nenhuma vez
// (nada quebra, a feature só fica "desligada" — ver campo "adsense"
// em GET /api/health, e o mesmo aviso em README-PAGAMENTOS.md sobre
// como o app se comporta sem uma credencial paga configurada). Os 2
// valores vêm do painel da sua conta AdSense (adsense.google.com):
//   ADSENSE_CLIENT_ID — o "ID do editor" da conta, formato
//     "ca-pub-XXXXXXXXXXXXXXXX" (aparece em qualquer bloco de anúncio
//     gerado, e em Conta > Informações da conta).
//   ADSENSE_AD_SLOT_FREEMIUM_MODAL — o "ID do slot" (só números) do
//     bloco de anúncio criado especificamente pra esse modal — crie
//     um bloco de "Display ads" comum em Anúncios > Por unidade de
//     anúncio (não existe um tipo "vídeo" separado pra criar: o
//     Google decide sozinho, no leilão de cada impressão, se o
//     criativo mostrado vai ser imagem, vídeo ou HTML5 — não temos
//     controle nem confirmação de qual tipo veio numa impressão
//     específica; ver aviso maior em app.js sobre essa limitação).
// IMPORTANTE: client ID e slot NÃO são segredo nenhum — qualquer
// visitante do site já vê os dois no HTML/JS da página (é assim que
// o AdSense funciona, o anúncio carrega direto no navegador de quem
// visita, sem passar pelo nosso backend) — não tem problema nenhum
// esses 2 valores aparecerem numa resposta pública da API.
const ADSENSE_CLIENT_ID = (process.env.ADSENSE_CLIENT_ID || "").trim() || null;
const ADSENSE_AD_SLOT_FREEMIUM_MODAL = (process.env.ADSENSE_AD_SLOT_FREEMIUM_MODAL || "").trim() || null;

// Endpoint de admin (GET /api/admin/users) — consulta manual do que
// está persistido no Volume (usuários/sessões), sem precisar de acesso
// via terminal/CLI ao container. Fica completamente desativado (404 em
// qualquer chamada, mesmo com senha certa) se ADMIN_SECRET não estiver
// configurado neste host — nunca fica aberto por acidente. Configure
// um valor forte e aleatório na env var do Railway (só no HML/PRD,
// nunca comitado no código) e passe em ?secret=... ou no header
// X-Admin-Secret.
const ADMIN_SECRET = (process.env.ADMIN_SECRET || "").trim();
function isValidAdminSecret(req, searchParams) {
  if (!ADMIN_SECRET) return false;
  const provided = String(req.headers["x-admin-secret"] || searchParams.get("secret") || "");
  const expected = Buffer.from(ADMIN_SECRET);
  const got = Buffer.from(provided);
  if (expected.length !== got.length) return false; // timingSafeEqual exige mesmo tamanho
  return crypto.timingSafeEqual(expected, got);
}

// APP_MODE — controla o modo ao vivo/exemplo de fora, sem precisar
// mexer em código (útil pra configurar direto no Railway/painel do
// host). Valores aceitos:
//   auto (padrão) — ao vivo se API_SPORTS_KEY estiver configurada,
//                    exemplo se não estiver (comportamento de sempre).
//   live           — força modo ao vivo. Se a chave não estiver
//                    configurada, os endpoints falham com um erro
//                    explícito em vez de cair silenciosamente pro
//                    modo exemplo — bom pra pegar erro de configuração
//                    (chave/variável faltando no host) na hora.
//   demo           — força modo exemplo mesmo que a chave esteja
//                    configurada. Útil pra não gastar cota da API
//                    (plano free = 100 req/dia) em ambiente de teste,
//                    ou pra mostrar o app sem depender da API.
const RAW_APP_MODE = (process.env.APP_MODE || "").trim().toLowerCase();
const APP_MODE = ["auto", "live", "demo"].includes(RAW_APP_MODE) ? RAW_APP_MODE : "auto";

// Se true, os endpoints que dependem do fornecedor de dados ativo (ver
// server/src/providers/) devem responder. Combina APP_MODE com a
// credencial daquele fornecedor especificamente estar configurada —
// nem todo fornecedor precisa de chave (ex.: um scraper gratuito
// poderia ter hasCredential() sempre true).
function liveModeEnabled() {
  if (APP_MODE === "demo") return false;
  return dataProvider.hasCredential();
}

// URL pública do site — usada pra montar os back_urls/notification_url
// do Mercado Pago (precisam ser URLs absolutas). Por padrão, deriva do
// próprio request (funciona bem atrás do proxy do Railway, que envia
// x-forwarded-proto); defina PUBLIC_BASE_URL manualmente só se a
// detecção automática não bater (ex.: domínio customizado atrás de
// outro proxy/CDN).
function publicBaseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  const host = req.headers.host || `localhost:${PORT}`;
  const proto = req.headers["x-forwarded-proto"] || (/^(localhost|127\.0\.0\.1)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

function isHttps(req) {
  return String(req.headers["x-forwarded-proto"] || "").includes("https") || !!req.socket?.encrypted;
}

// Ambiente de homologação: qualquer host cujo nome comece com "hml"
// (ex.: hml.seusite.com, hml-brdata.up.railway.app). Usado só pra
// liberar o login padrão admin/admin (ver /api/auth/login) — nunca
// bate em produção contanto que o domínio de produção não comece com
// "hml".
function isHomologHost(req) {
  return String(req.headers.host || "").toLowerCase().startsWith("hml");
}

// Bootstrap opcional de admin via variável de ambiente — alternativa ao
// fluxo normal (POST /api/adminpanel/promote?secret=..., ver rota mais
// abaixo), pra quando não dá pra rodar curl/console contra o host de
// produção (proxy/firewall bloqueando esse tipo de chamada, sem acesso
// a shell externo, etc.). Só faz alguma coisa se as 2 variáveis abaixo
// estiverem preenchidas no host (Railway/etc.) — sem elas, não roda
// nada, comportamento de sempre (ninguém vira admin sozinho por
// acidente). Roda 1x a cada boot do processo: cria a conta se ainda não
// existir, ou só garante a role "admin" se a conta já existir mas não
// for admin ainda — idempotente, então também serve pra RECUPERAR o
// acesso admin se esse campo se perder por algum motivo, sem precisar
// de mais nada além da env var já configurada. Diferente do login
// admin/admin de homologação (isHomologHost acima), esse funciona em
// QUALQUER host, inclusive produção — de propósito: é o usuário quem
// escolhe e-mail/senha reais (nunca hardcoded no código/commitado no
// git) preenchendo a env var, exatamente como ADMIN_SECRET.
async function bootstrapDefaultAdmin() {
  const email = (process.env.DEFAULT_ADMIN_EMAIL || "").trim();
  const password = process.env.DEFAULT_ADMIN_PASSWORD || "";
  if (!email || !password) return;

  const normalized = users.normalizeEmail(email);
  let admin = users.findByEmail(normalized);
  if (!admin) {
    admin = await users.createUser({
      name: "Administrador", email: normalized, phone: "00000000000",
      password, plan: "enterprise", planStatus: "active",
    });
    console.log(`[bootstrap] usuário admin padrão criado a partir de DEFAULT_ADMIN_EMAIL (${normalized}).`);
  }
  if (admin.role !== "admin") {
    users.updateUser(admin.id, { role: "admin" });
    console.log(`[bootstrap] conta ${normalized} promovida a admin (via DEFAULT_ADMIN_EMAIL/DEFAULT_ADMIN_PASSWORD).`);
  }
}

// ---- Login (cookie de sessão) ----
const SESSION_COOKIE = "brdata_session";

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(";").forEach(pair => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    if (k) out[k] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  return out;
}

function setSessionCookie(res, token, secure) {
  const parts = [`${SESSION_COOKIE}=${encodeURIComponent(token)}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${Math.floor(sessions.SESSION_TTL_MS / 1000)}`];
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

// IP de verdade do visitante — atrás de proxy/CDN (Railway inclusive)
// o socket sempre mostra o IP do proxy, não do cliente; X-Forwarded-For
// é quem carrega o IP real (primeiro da lista, se houver mais de um
// proxy no meio). Usado só pro rate-limit das rotas públicas (ver
// PUBLIC_READ_EXACT/PUBLIC_READ_PATTERNS mais abaixo) — não é uma
// verificação de segurança forte (X-Forwarded-For pode ser forjado por
// quem fala direto com o processo Node, sem passar pelo proxy), só
// precisa ser bom o bastante pra distinguir visitantes normais de um
// scraper insistindo no mesmo IP.
function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff) return String(xff).split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

function clearSessionCookie(res, secure) {
  const parts = [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

const TTL = {
  teams: 12 * 60 * 60 * 1000,      // 12h — elenco de times quase não muda
  standings: 15 * 60 * 1000,       // 15min
  fixtures: 15 * 60 * 1000,        // 15min
  fixtureDetail: 7 * 24 * 60 * 60 * 1000, // 7 dias — jogo encerrado não muda mais
  lineups: 15 * 60 * 1000,          // 15min — escalação pode ser publicada/ajustada perto do jogo
  odds: 10 * 60 * 1000,             // 10min — odds pré-jogo mudam com frequência
  leagueSearch: 24 * 60 * 60 * 1000,
  playersLeaders: 6 * 60 * 60 * 1000, // 6h — rankings de jogadores não mudam durante o dia
  broadcast: 6 * 60 * 60 * 1000,     // 6h — fonte comunitária (TheSportsDB), não muda de hora em hora
  news: 20 * 60 * 1000,              // 20min — feed de notícias, atualiza mas não precisa ser em tempo real
};

function loadDotEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, "utf8").split("\n").forEach(line => {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  });
}

async function withCache(key, ttl, fetcher) {
  const hit = cache.get(key);
  if (hit) return hit;
  const value = await fetcher();
  cache.set(key, value, ttl);
  return value;
}

// Resolve qual campeonato uma rota de dado (teams/standings/fixtures/
// players) deve usar — ?competition=ID na query string, "brasileirao"
// por padrão (mantém compatível quem já chamava essas rotas sem esse
// parâmetro). Valida em 2 camadas: o plano do usuário alcança esse
// campeonato (403), e o campeonato já está habilitado de verdade
// (501 "em breve" — ver server/src/competitions.js).
function resolveCompetition(req, searchParams) {
  const compId = searchParams.get("competition") || "brasileirao";
  const comp = competitions.getCompetition(compId);
  if (!comp) {
    const err = new Error("Campeonato desconhecido.");
    err.status = 400;
    throw err;
  }
  // req.authUser vem null em rota de leitura pública sem sessão (ver
  // PUBLIC_READ_EXACT/PATTERNS acima) — desde a Fase 1 do "Freemium sem
  // login" isso passou a ser o caso NORMAL pra visitante, não exceção.
  // BUG CORRIGIDO: aqui ainda lia req.authUser.plan direto, sem
  // fallback — pra qualquer visitante sem conta, isso estourava
  // TypeError ("Cannot read properties of null") em toda chamada de
  // /api/teams, /api/standings, /api/fixtures, /api/players/leaders
  // etc. (as próprias rotas que carregam o dado AO VIVO do dashboard).
  // O erro 500 fazia tryLoadLiveData() cair silenciosamente pro modo
  // Exemplo no front-end (ver liveData.js) — visitante (inclusive
  // crawler de busca) via sempre dado de mentira, mesmo com a API
  // funcionando normalmente. Mesmo fallback já usado em /api/competitions
  // logo acima: sem conta = trata como Freemium.
  if (!competitions.planAllowsCompetition(req.authUser?.plan || "freemium", comp)) {
    const err = new Error("Esse campeonato não está disponível no seu plano — faça upgrade pra Pro ou Enterprise.");
    err.status = 403; err.code = "PLAN_UPGRADE_REQUIRED";
    throw err;
  }
  if (!comp.enabled) {
    const err = new Error(`${comp.name} ainda não está disponível — em breve.`);
    err.status = 501; err.code = "COMPETITION_COMING_SOON";
    throw err;
  }
  // Resolve o id desse campeonato NO FORNECEDOR ATIVO (ver
  // server/src/providers/) — se o fornecedor atual não tiver esse
  // campeonato cadastrado (ex.: trocou de fornecedor e o novo ainda
  // não tem os 3 mapeados), trata igual a "em breve" em vez de
  // deixar a chamada quebrar lá na frente.
  const leagueId = competitions.providerLeagueId(comp, dataProvider.ACTIVE_PROVIDER_NAME);
  if (!leagueId) {
    const err = new Error(`${comp.name} ainda não está mapeado pro fornecedor de dados ativo (${dataProvider.ACTIVE_PROVIDER_NAME}).`);
    err.status = 501; err.code = "COMPETITION_COMING_SOON";
    throw err;
  }
  return { ...comp, leagueId };
}

// Lê o corpo de um POST (JSON ou form-urlencoded, o Mercado Pago pode
// mandar qualquer um dos dois no webhook dependendo da configuração).
// Limite de 1MB — esses endpoints só recebem payloads pequenos.
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1024 * 1024) { reject(new Error("corpo da requisição grande demais")); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      const contentType = req.headers["content-type"] || "";
      try {
        if (contentType.includes("application/json")) return resolve(JSON.parse(raw));
        if (contentType.includes("application/x-www-form-urlencoded")) {
          return resolve(Object.fromEntries(new URLSearchParams(raw)));
        }
        // sem content-type declarado (ou algo inesperado) — tenta JSON
        // por ser o mais comum, cai pro corpo cru se não parsear.
        return resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function handleError(res, err) {
  console.error("[API ERROR]", err.message);
  const status = err.code === "NO_API_KEY" ? 501 : (err.status || 502);
  sendJSON(res, status, { error: err.message, code: err.code || null });
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

// Sem framework de HTML nenhum nesse projeto (zero-dependência de
// propósito) — até agora nunca precisou escapar HTML dinâmico porque o
// servidor só devolvia JSON. As rotas por entidade (Fase B) são as
// primeiras a interpolar dado (nome de time, vindo do fornecedor
// externo) direto num HTML de verdade — escapa por segurança (nunca
// confia em dado de fornecedor externo cru dentro de HTML, mesmo sendo
// um fornecedor confiável).
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// ================= SEO: shell + conteúdo por entidade (Fase B) =================
// Lê index.html do disco (igual serveStatic faz — sempre fresco, sem
// cache em memória, arquivo é pequeno) e troca 2 blocos marcados nele
// (ver comentários grandes no próprio index.html):
//   SEO:START..SEO:END   -> title/description/OG/Twitter/canonical/JSON-LD
//   SEO:BODY_SNAPSHOT    -> resumo em HTML puro da entidade (ou "" na
//                           raiz/páginas sem entidade — some o
//                           marcador sem deixar nada no lugar)
// canonicalPath já vem tipo "/times/flamengo" (sem domínio) — essa
// função completa com publicBaseUrl(req), igual o resto do arquivo já
// faz pros links do Mercado Pago.
async function renderShellWithSeo(req, { title, description, canonicalPath, bodySnapshotHtml, jsonLd }) {
  const html = await fs.promises.readFile(path.join(PUBLIC_DIR, "index.html"), "utf8");
  const base = publicBaseUrl(req);
  const canonicalUrl = `${base}${canonicalPath}`;
  const ogImage = `${base}/img/logo.png`;
  const ld = jsonLd || {
    "@context": "https://schema.org", "@type": "WebSite",
    name: "BR Data", description, inLanguage: "pt-BR",
  };
  const seoBlock =
    `<title>${escapeHtml(title)}</title>\n` +
    `<meta name="description" content="${escapeHtml(description)}">\n` +
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">\n` +
    `<meta property="og:type" content="website">\n` +
    `<meta property="og:site_name" content="BR Data">\n` +
    `<meta property="og:title" content="${escapeHtml(title)}">\n` +
    `<meta property="og:description" content="${escapeHtml(description)}">\n` +
    `<meta property="og:image" content="${escapeHtml(ogImage)}">\n` +
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">\n` +
    `<meta property="og:locale" content="pt_BR">\n` +
    `<meta name="twitter:card" content="summary_large_image">\n` +
    `<meta name="twitter:title" content="${escapeHtml(title)}">\n` +
    `<meta name="twitter:description" content="${escapeHtml(description)}">\n` +
    `<meta name="twitter:image" content="${escapeHtml(ogImage)}">\n` +
    `<script type="application/ld+json">\n${JSON.stringify(ld, null, 2)}\n</script>`;

  const startMarker = "<!-- SEO:START -->";
  const endMarker = "<!-- SEO:END -->";
  const startIdx = html.indexOf(startMarker);
  const endIdx = html.indexOf(endMarker);
  let out = html;
  if (startIdx !== -1 && endIdx !== -1) {
    out = html.slice(0, startIdx + startMarker.length) + "\n" + seoBlock + "\n" + html.slice(endIdx);
  }
  return out.replace("<!-- SEO:BODY_SNAPSHOT -->", bodySnapshotHtml || "");
}

function serveStatic(req, res) {
  let filePath = path.join(PUBLIC_DIR, decodeURIComponent(req.url.split("?")[0]));
  if (req.url === "/" || req.url === "") filePath = path.join(PUBLIC_DIR, "index.html");
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end("Forbidden"); }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // fallback SPA: qualquer rota desconhecida cai no index.html
      fs.readFile(path.join(PUBLIC_DIR, "index.html"), (e2, data2) => {
        if (e2) { res.writeHead(404); return res.end("Not found"); }
        res.writeHead(200, { "Content-Type": MIME[".html"] });
        res.end(data2);
      });
      return;
    }
    const ext = path.extname(filePath);
    const headers = { "Content-Type": MIME[ext] || "application/octet-stream" };
    // O service worker precisa ser sempre revalidado — se o navegador
    // (ou um proxy/CDN no meio do caminho) guardar sw.js em cache por
    // um tempo, o app fica preso numa versão antiga do worker e nunca
    // detecta atualização nenhuma.
    if (filePath.endsWith("sw.js")) headers["Cache-Control"] = "no-cache";
    res.writeHead(200, headers);
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname, searchParams } = url;

  try {
    if (pathname === "/api/health") {
      return sendJSON(res, 200, {
        ok: true,
        hasKey: liveModeEnabled(),
        mode: APP_MODE,
        provider: dataProvider.ACTIVE_PROVIDER_NAME,
        // Sinal de qual commit está rodando de verdade nesse host — o
        // Railway preenche RAILWAY_GIT_COMMIT_SHA sozinho em todo build
        // (nenhuma configuração extra necessária). Serve pra confirmar
        // rapidinho, sem precisar entrar no painel do Railway, se um
        // deploy específico já "pegou" (ex.: depois de pedir uma
        // correção, comparar esse valor com o hash do commit no
        // GitHub) — sem isso não dava pra saber, só de olhar o
        // comportamento do site, se o host tinha mesmo redeployado.
        commit: (process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || "").slice(0, 12) || null,
        // Sinal explícito pra debug: pediram modo ao vivo (APP_MODE=live)
        // mas o fornecedor ativo não tem credencial configurada no host
        // — em vez de cair quieto pro modo exemplo, isso aparece aqui e
        // nos endpoints que dependem dele (erro 501 em vez de resposta
        // vazia).
        warning: (APP_MODE === "live" && !dataProvider.hasCredential())
          ? `APP_MODE=live mas o fornecedor ativo (${dataProvider.ACTIVE_PROVIDER_NAME}) não tem credencial configurada neste host.`
          : null,
        leagueId: LEAGUE_ID,
        season: LIVE_SEASON,
        quota: dataProvider.getQuota(),
        // null = anúncio Freemium desligado (nenhum dos 2 configurados
        // nesse host ainda) — ver comentário de ADSENSE_CLIENT_ID acima.
        adsense: (ADSENSE_CLIENT_ID && ADSENSE_AD_SLOT_FREEMIUM_MODAL)
          ? { clientId: ADSENSE_CLIENT_ID, slotIdFreemiumModal: ADSENSE_AD_SLOT_FREEMIUM_MODAL }
          : null,
      });
    }

    // Arquivo exigido pelo AdSense pra confirmar que esse domínio tem
    // autorização de exibir anúncio da sua conta (padrão IAB
    // "authorized digital sellers") — sem ele, o Google pode não
    // preencher anúncio nenhum aqui, mesmo com o resto configurado
    // certo. Gerado sozinho a partir de ADSENSE_CLIENT_ID (nada pra
    // editar manualmente); sem essa variável configurada, devolve 404
    // (não existe fingir um ads.txt de mentira). O "f08c47fec0942fa0"
    // no fim é a "certification authority ID" fixa e pública do Google
    // pra revenda direta — não é segredo, é sempre o mesmo valor pra
    // qualquer site que vende direto com o Google (não via revenda por
    // terceiro), documentado pelo próprio AdSense.
    if (pathname === "/ads.txt") {
      if (!ADSENSE_CLIENT_ID) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("ads.txt não configurado nesse host (ver ADSENSE_CLIENT_ID).\n"); }
      const pubId = ADSENSE_CLIENT_ID.replace(/^ca-/, ""); // client id do script usa "ca-pub-...", ads.txt espera só "pub-..."
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" });
      return res.end(`google.com, ${pubId}, DIRECT, f08c47fec0942fa0\n`);
    }

    // ================= SEO: robots.txt + sitemap.xml =================
    // AJUSTE (15/08/2026, "Plano de Indexação" — Fase A): rota dinâmica
    // (não arquivo estático) pra usar publicBaseUrl(req) — mesma função
    // já usada pros links do Mercado Pago (ver comentário lá em cima) —
    // e assim funcionar certo em QUALQUER host sem precisar hardcodar
    // domínio nenhum: homologação (hml-brdata.up.railway.app),
    // produção no subdomínio padrão do Railway, ou um domínio próprio
    // customizado depois — todos automaticamente corretos.
    if (pathname === "/robots.txt") {
      const base = publicBaseUrl(req);
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" });
      return res.end(
        `User-agent: *\n` +
        `Allow: /\n` +
        // /admin e /api/ não são conteúdo pra indexar — só desperdiça
        // orçamento de rastreio do robô sem ganho nenhum de SEO.
        `Disallow: /admin\n` +
        `Disallow: /api/\n\n` +
        `Sitemap: ${base}/sitemap.xml\n`
      );
    }

    // Sitemap — v2 (Fase C do "Plano de Indexação", encadeada direto
    // depois da Fase B): além das URLs estáticas de sempre, agora lista
    // 1 <url> por time de verdade, buscado ao vivo (mesma chave de
    // cache de /api/teams e da própria página /times/:slug — não custa
    // nada extra na cota da Sportmonks). Sem credencial configurada
    // nesse host, cai pra v1 (só as URLs estáticas) — não tem time
    // nenhum pra listar sem dado ao vivo.
    if (pathname === "/sitemap.xml") {
      const base = publicBaseUrl(req);
      const today = new Date().toISOString().slice(0, 10);
      const urls = [
        { loc: `${base}/`, changefreq: "daily", priority: "1.0" },
        { loc: `${base}/privacidade.html`, changefreq: "yearly", priority: "0.3" },
      ];
      if (liveModeEnabled()) {
        try {
          const comp = competitions.getCompetition("brasileirao");
          const leagueId = competitions.providerLeagueId(comp, dataProvider.ACTIVE_PROVIDER_NAME);
          const teams = await withCache(`teams:${comp.id}:${LIVE_SEASON}`, TTL.teams, () =>
            dataProvider.getTeams({ leagueId, season: LIVE_SEASON })
          );
          teams.forEach((t) => urls.push({ loc: `${base}/times/${slugify(t.name)}`, changefreq: "daily", priority: "0.7" }));
        } catch (err) {
          // Sitemap nunca deveria quebrar por causa de uma falha
          // pontual do fornecedor -- pior caso, sai só com as URLs
          // estáticas de sempre (v1), não com erro 500.
          console.error("[sitemap] falha ao listar times:", err.message);
        }
      }
      const body = urls.map((u) =>
        `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
      ).join("\n");
      res.writeHead(200, { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" });
      return res.end(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
    }

    // ================= Página do Time (Fase B, "Plano de Indexação") =================
    // /times/:slug — 1ª URL por entidade do plano de SEO (ver Fase A
    // já em produção). Sempre do Brasileirão Série A por enquanto (é a
    // única competição habilitada de verdade hoje, ver
    // server/src/competitions.js) — quando Série B/C saírem de "em
    // breve", essa rota precisa de um jeito de indicar competição
    // (prefixo tipo /serie-b/times/:slug, por exemplo) pra não colidir
    // slug de times com nome parecido entre competições diferentes.
    //
    // Reusa EXATAMENTE as mesmas chaves de cache de /api/teams,
    // /api/standings e /api/fixtures (mesmo dataProvider, mesmo
    // leagueId, mesma season) — um crawler batendo aqui não custa
    // NADA a mais na cota da Sportmonks além do que o tráfego normal
    // do app já paga.
    const timeRouteMatch = pathname.match(/^\/times\/([a-z0-9-]+)\/?$/);
    if (timeRouteMatch) {
      const slug = timeRouteMatch[1];
      // Sem credencial configurada nesse host, não tem dado nenhum pra
      // pré-renderizar (o app cliente, em modo Exemplo, ainda sabe
      // resolver /times/:slug sozinho via JS — só não tem conteúdo
      // pronto pra um crawler que não roda JS, até esse host ganhar
      // uma chave de API de verdade).
      if (!liveModeEnabled()) return serveStatic(req, res);

      // Qualquer falha do fornecedor aqui (Sportmonks fora do ar,
      // token inválido, etc.) cai pro shell normal em vez de 500 --
      // mesmo espírito do "sem credencial" acima: o app cliente ainda
      // sabe se virar sozinho (cai pro modo Exemplo), só não tem
      // conteúdo pronto pra um crawler nesse instante específico.
      try {
        const comp = competitions.getCompetition("brasileirao");
        const leagueId = competitions.providerLeagueId(comp, dataProvider.ACTIVE_PROVIDER_NAME);
        const season = LIVE_SEASON;
        const teams = await withCache(`teams:${comp.id}:${season}`, TTL.teams, () =>
          dataProvider.getTeams({ leagueId, season })
        );
        const team = teams.find((t) => slugify(t.name) === slug);

        if (!team) {
          // Slug desconhecido -- 404 de verdade (não soft-404): status
          // errado aqui confundiria o Google sobre o que é conteúdo real.
          const html = await renderShellWithSeo(req, {
            title: "Time não encontrado · BR Data",
            description: "Não encontramos esse time no Brasileirão. Veja a tabela completa e todos os times na página inicial do BR Data.",
            canonicalPath: "/times/" + slug,
            bodySnapshotHtml: "",
          });
          res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
          return res.end(html);
        }

        const [standings, fixtures] = await Promise.all([
          withCache(`standings:${comp.id}:${season}`, TTL.standings, () => dataProvider.getStandings({ leagueId, season })),
          withCache(`fixtures:${comp.id}:${season}`, TTL.fixtures, () => dataProvider.getFixtures({ leagueId, season })),
        ]);

        const teamById = new Map(teams.map((t) => [t.id, t]));
        const row = standings.find((r) => String(r.id) === String(team.id));
        const teamFixtures = fixtures.filter((f) => f.home === team.id || f.away === team.id);
        const FINISHED_STATUS = ["FT", "AET", "PEN"]; // mesma lista usada no cliente, ver tryLoadLiveData em liveData.js
        const finished = teamFixtures
          .filter((f) => FINISHED_STATUS.includes(f.status))
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 5);
        const nextMatch = teamFixtures
          .filter((f) => !FINISHED_STATUS.includes(f.status))
          .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
        const oppName = (f) => teamById.get(f.home === team.id ? f.away : f.home)?.name || "adversário a definir";

        const title = `${team.name} — Tabela, Elenco e Próximos Jogos do Brasileirão · BR Data`;
        const description = row
          ? `${team.name} está em ${row.rank}º lugar no Brasileirão, com ${row.pts} pontos em ${row.j} jogos. Veja elenco, últimos resultados e próximos jogos.`
          : `Elenco, tabela e próximos jogos do ${team.name} no Brasileirão.`;

        const resultLineHTML = (f) => {
          const isHome = f.home === team.id;
          const gf = isHome ? f.gh : f.ga, ga = isHome ? f.ga : f.gh;
          return `<li>${escapeHtml(team.name)} ${gf} x ${ga} ${escapeHtml(oppName(f))}</li>`;
        };

        const bodySnapshotHtml = `<div id="seoSnapshot" style="max-width:680px;margin:32px auto;padding:0 20px;font:15px/1.6 system-ui,sans-serif;color:#0A1424;">
  <h1>${escapeHtml(team.name)}</h1>
  <p>${escapeHtml(description)}</p>
  ${finished.length ? `<h2>Últimos jogos</h2>\n  <ul>\n    ${finished.map(resultLineHTML).join("\n    ")}\n  </ul>` : ""}
  ${nextMatch ? `<h2>Próximo jogo</h2>\n  <p>${escapeHtml(team.name)} x ${escapeHtml(oppName(nextMatch))}</p>` : ""}
</div>`;

        const html = await renderShellWithSeo(req, {
          title, description, canonicalPath: `/times/${slug}`, bodySnapshotHtml,
          jsonLd: {
            "@context": "https://schema.org", "@type": "SportsTeam",
            name: team.name, sport: "Soccer",
            url: `${publicBaseUrl(req)}/times/${slug}`,
            ...(team.logo ? { logo: team.logo } : {}),
          },
        });
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=600" });
        return res.end(html);
      } catch (err) {
        console.error("[times/:slug] falha ao montar a página, servindo o shell padrão:", err.message);
        return serveStatic(req, res);
      }
    }

    // ================= Página do Jogador (Fase B, continuação) =================
    // /jogadores/:id[-slug] — mesma mecânica de /times/:slug, com uma
    // diferença: o ID vem PRIMEIRO na URL (não só o slug) porque não
    // tem como montar uma lista de "todos os jogadores" pra resolver
    // slug->id sem paginar o elenco de cada time (20 chamadas extra só
    // pra achar 1 jogador). O ID já resolve sozinho via getPlayer() — o
    // "-slug" no fim é só cosmético (URL legível/melhor pra busca);
    // qualquer coisa depois do ID é ignorada na resolução, mas o
    // canonical devolvido sempre usa o slug CERTO (ver mais abaixo),
    // então o Google converge pra 1 URL só por jogador não importa
    // como chegou nela.
    const playerRouteMatch = pathname.match(/^\/jogadores\/(\d+)(?:-[a-z0-9-]+)?\/?$/);
    if (playerRouteMatch) {
      const playerId = playerRouteMatch[1];
      if (!liveModeEnabled()) return serveStatic(req, res);

      try {
        const season = LIVE_SEASON;
        const player = await withCache(`player:${playerId}:${season}`, TTL.teams, () =>
          dataProvider.getPlayer({ playerId, season })
        );

        if (!player) {
          const html = await renderShellWithSeo(req, {
            title: "Jogador não encontrado · BR Data",
            description: "Não encontramos esse jogador. Veja artilheiros e elenco de cada time do Brasileirão no BR Data.",
            canonicalPath: `/jogadores/${playerId}`,
            bodySnapshotHtml: "",
          });
          res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
          return res.end(html);
        }

        const nameSlug = slugify(player.name);
        const canonicalPath = `/jogadores/${player.id}-${nameSlug}`;

        // Nome do time só pra enriquecer description/JSON-LD -- reusa
        // a MESMA lista de times já cacheada de /api/teams (zero custo
        // extra). Falha aqui não é crítica -- segue sem nome de time.
        let teamName = null;
        if (player.teamId) {
          try {
            const comp = competitions.getCompetition("brasileirao");
            const leagueId = competitions.providerLeagueId(comp, dataProvider.ACTIVE_PROVIDER_NAME);
            const teams = await withCache(`teams:${comp.id}:${season}`, TTL.teams, () =>
              dataProvider.getTeams({ leagueId, season })
            );
            teamName = teams.find((t) => String(t.id) === String(player.teamId))?.name || null;
          } catch { /* segue sem nome de time */ }
        }

        const title = `${player.name} — Estatísticas no Brasileirão · BR Data`;
        const description = `${player.name}${teamName ? ` (${teamName})` : ""}: ${player.goals ?? 0} gols e ${player.assists ?? 0} assistências em ${player.games ?? 0} jogos no Brasileirão.`;

        const bodySnapshotHtml = `<div id="seoSnapshot" style="max-width:680px;margin:32px auto;padding:0 20px;font:15px/1.6 system-ui,sans-serif;color:#0A1424;">
  <h1>${escapeHtml(player.name)}</h1>
  <p>${escapeHtml(description)}</p>
  <ul>
    <li>Jogos: ${Number(player.games) || 0}</li>
    <li>Gols: ${Number(player.goals) || 0}</li>
    <li>Assistências: ${Number(player.assists) || 0}</li>
    <li>Cartões amarelos: ${Number(player.yellow) || 0}</li>
    <li>Cartões vermelhos: ${Number(player.red) || 0}</li>
  </ul>
</div>`;

        const html = await renderShellWithSeo(req, {
          title, description, canonicalPath, bodySnapshotHtml,
          jsonLd: {
            "@context": "https://schema.org", "@type": "Person",
            name: player.name,
            url: `${publicBaseUrl(req)}${canonicalPath}`,
            ...(player.photo ? { image: player.photo } : {}),
            ...(teamName ? { affiliation: { "@type": "SportsTeam", name: teamName } } : {}),
          },
        });
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=600" });
        return res.end(html);
      } catch (err) {
        console.error("[jogadores/:id] falha ao montar a página, servindo o shell padrão:", err.message);
        return serveStatic(req, res);
      }
    }

    // URL amigável (sem ".html") pra área administrativa — o resto do
    // acesso é protegido por login + role "admin" (ver
    // /api/adminpanel/* acima), não por essa rota em si; ela só serve
    // o HTML (login form + JS), igual public/admin.html serviria
    // sozinho se alguém acessasse com a extensão.
    if (pathname === "/admin") {
      return fs.readFile(path.join(PUBLIC_DIR, "admin.html"), (err, data) => {
        if (err) { res.writeHead(404); return res.end("Not found"); }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(data);
      });
    }

    // Beacon de analytics de produto (funil de login + páginas mais
    // navegadas — pedido do usuário, ver server/src/analytics.js e
    // GET /api/adminpanel/analytics mais abaixo) — colocado CEDO de
    // propósito, ANTES do gate de login obrigatório: precisa funcionar
    // pra visitante SEM sessão nenhuma (é literalmente o evento "viu a
    // tela de login" que dispara daqui). userId vem da sessão (se
    // tiver uma válida), nunca do que o corpo da requisição manda —
    // mesma regra de sempre nesse arquivo. Sempre responde 200 rápido,
    // mesmo em evento inválido (recordEvent ignora silenciosamente) —
    // o cliente dispara isso best-effort (fetch com keepalive, sem
    // esperar nem tratar a resposta), não faz sentido devolver erro
    // pra um beacon que ninguém do outro lado vai ler.
    if (pathname === "/api/track" && req.method === "POST") {
      try {
        const body = await readBody(req);
        const cookies = parseCookies(req);
        const session = sessions.getSession(cookies[SESSION_COOKIE]);
        analytics.recordEvent({ type: body.type, page: body.page, userId: session?.userId || null });
      } catch { /* nunca deixa isso quebrar a experiência de quem só tá navegando */ }
      return sendJSON(res, 200, { ok: true });
    }

    // ================= Leitura pública (Freemium sem login) =================
    // AJUSTE (14/08/2026): decisão de produto de abrir o conteúdo do
    // plano Freemium pra qualquer visitante, sem exigir conta — pensando
    // em divulgação/crescimento (link compartilhado, crawler de busca,
    // preview de rede social não passam por login). Cobre só LEITURA de
    // dado esportivo básico (o que já é Freemium hoje); toda ESCRITA
    // (favoritar, checkout) e toda feature paga continuam exigindo
    // sessão — ver bloco "Login obrigatório" logo abaixo, que usa isso.
    // "/api/leagues/search" fica de FORA de propósito (não é rota usada
    // pelo front-end, é utilidade manual de configuração — ver
    // server/.env.example — não faz sentido pra visitante nenhum).
    const PUBLIC_READ_EXACT = new Set([
      "/api/competitions", "/api/teams", "/api/standings", "/api/fixtures",
      "/api/players/leaders", "/api/broadcast", "/api/news",
    ]);
    const PUBLIC_READ_PATTERNS = [
      /^\/api\/teams\/\d+\/players$/,
      /^\/api\/players\/\d+$/,
      /^\/api\/fixtures\/\d+\/statistics$/,
      /^\/api\/fixtures\/\d+\/events$/,
      /^\/api\/fixtures\/\d+\/lineups$/,
      /^\/api\/fixtures\/\d+\/odds$/,
      /^\/api\/fixtures\/\d+\/odds\/history$/,
    ];
    function isPublicReadPath(p) {
      return PUBLIC_READ_EXACT.has(p) || PUBLIC_READ_PATTERNS.some((re) => re.test(p));
    }

    // ================= Login obrigatório =================
    // Toda rota /api/* a partir daqui exige sessão válida (cookie),
    // EXCETO as que precisam funcionar antes/sem estar logado: as
    // próprias rotas de auth, a lista de planos (mostrada na tela de
    // cadastro), o webhook/status do Mercado Pago (chamados pelo
    // próprio Mercado Pago, ou consultados durante o retorno do
    // checkout — ainda sem sessão), e agora também as rotas de leitura
    // pública (PUBLIC_READ_EXACT/PATTERNS acima). /api/support/checkout
    // FICA de fora dessa lista de propósito: exige login (é usado tanto
    // durante o cadastro com plano pago quanto pra trocar de plano
    // depois).
    const AUTH_EXEMPT_PATHS = new Set([
      "/api/auth/signup", "/api/auth/login", "/api/auth/logout", "/api/auth/me",
      "/api/support/plans", "/api/support/webhook", "/api/support/status",
      "/api/admin/users", // autenticação própria (ADMIN_SECRET), não usa cookie de sessão
      "/api/adminpanel/promote", // idem — bootstrap de admin, ver rota abaixo
    ]);
    if (pathname.startsWith("/api/") && !AUTH_EXEMPT_PATHS.has(pathname)) {
      const cookies = parseCookies(req);
      const session = sessions.getSession(cookies[SESSION_COOKIE]);
      const authUser = session ? users.findById(session.userId) : null;
      req.authUser = authUser; // fica null em rota pública sem sessão — ver isPublicReadPath acima

      if (isPublicReadPath(pathname)) {
        // Funciona com ou sem sessão (inclusive sessão de plano
        // pendente — não faz sentido bloquear leitura básica de quem
        // já tem conta mas ainda não pagou, se um visitante completo
        // sem conta nenhuma já lê de graça). Sem sessão nenhuma,
        // rate-limit por IP no lugar da identificação por conta que a
        // sessão dava de graça (ver server/src/publicRateLimit.js).
        if (!authUser && !publicRateLimit.checkLimit(getClientIp(req))) {
          return sendJSON(res, 429, { error: "Muitas requisições — tente de novo em instantes." });
        }
      } else if (!authUser) {
        return sendJSON(res, 401, { error: "Login necessário.", code: "AUTH_REQUIRED" });
      } else if (pathname !== "/api/support/checkout" && authUser.planStatus !== "active") {
        // /api/support/checkout é a única rota autenticada que não
        // exige plano ativo — é exatamente o endpoint que ativa/
        // retenta o pagamento de quem ainda está com planStatus
        // pendente.
        return sendJSON(res, 402, {
          error: "Pagamento pendente — finalize o pagamento pra liberar o acesso.",
          code: "PAYMENT_REQUIRED", plan: authUser.plan, planStatus: authUser.planStatus,
        });
      }
    }

    // ================= Área administrativa (/admin) =================
    // Toda rota /api/adminpanel/* (exceto /promote, que é bootstrap
    // via ADMIN_SECRET — ver AUTH_EXEMPT_PATHS acima e a rota mais
    // abaixo) exige uma conta logada normal (cookie de sessão de
    // sempre) COM role "admin" (ver users.isAdmin). 404 genérico, não
    // 403 — mesmo motivo de sempre nesse arquivo: não dar pista pra
    // quem não é admin de que essas rotas existem.
    if (pathname.startsWith("/api/adminpanel/") && pathname !== "/api/adminpanel/promote") {
      if (!users.isAdmin(req.authUser)) return sendJSON(res, 404, { error: "endpoint não encontrado" });
    }

    // Bloqueia cedo qualquer rota que dependa da API-Sports quando o
    // modo ao vivo está desligado (sem chave, ou APP_MODE=demo forçando
    // exemplo mesmo com chave presente) — /api/health, /api/broadcast
    // (TheSportsDB), /api/news (RSS), /api/support/*, /api/auth/*,
    // /api/admin/* e /api/adminpanel/* (independentes da API-Sports)
    // não usam a API-Sports, /api/competitions só devolve o registro
    // local (server/src/competitions.js), e /api/account/favorite-club
    // só grava no arquivo local de usuários (server/src/users.js) —
    // nenhum desses chama a API-Sports, ficam de fora dessa checagem.
    const LIVE_ONLY = pathname.startsWith("/api/") && pathname !== "/api/broadcast" && pathname !== "/api/news"
      && pathname !== "/api/competitions" && pathname !== "/api/account/favorite-club"
      && !pathname.startsWith("/api/support/") && !pathname.startsWith("/api/auth/")
      && !pathname.startsWith("/api/admin/") && !pathname.startsWith("/api/adminpanel/");
    if (LIVE_ONLY && !liveModeEnabled()) {
      const err = new Error(
        APP_MODE === "demo"
          ? "Modo Exemplo forçado (APP_MODE=demo) — dados reais desativados de propósito neste host."
          : `Fornecedor ativo (${dataProvider.ACTIVE_PROVIDER_NAME}) sem credencial configurada neste host (ou modo ao vivo desativado).`
      );
      err.code = "NO_API_KEY";
      throw err;
    }

    // Lista de campeonatos disponíveis (Brasileirão + Inglaterra/Espanha
    // "em breve") e temporadas de histórico (Enterprise, "em breve"),
    // já anotados com o que o plano do usuário logado libera — ver
    // server/src/competitions.js. Front-end usa isso pra montar o
    // seletor de campeonato. Rota pública agora (ver PUBLIC_READ_EXACT
    // acima) — req.authUser fica null pra visitante sem sessão, trata
    // como "freemium" (mesmo padrão do resto do app: sem conta = vê o
    // que o Freemium vê, ver planAllowsAdvanced em app.js).
    if (pathname === "/api/competitions") {
      return sendJSON(res, 200, competitions.listForPlan(req.authUser?.plan || "freemium"));
    }

    if (pathname === "/api/leagues/search") {
      const name = searchParams.get("name") || "Brazil";
      const leagues = await withCache(`leagues:${name}`, TTL.leagueSearch, () =>
        dataProvider.searchLeagues({ name })
      );
      return sendJSON(res, 200, { leagues });
    }

    if (pathname === "/api/teams") {
      const season = searchParams.get("season");
      if (!season) return sendJSON(res, 400, { error: "parâmetro season é obrigatório" });
      const comp = resolveCompetition(req, searchParams);
      const teams = await withCache(`teams:${comp.id}:${season}`, TTL.teams, () =>
        dataProvider.getTeams({ leagueId: comp.leagueId, season })
      );
      return sendJSON(res, 200, { teams });
    }

    if (pathname === "/api/standings") {
      const season = searchParams.get("season");
      if (!season) return sendJSON(res, 400, { error: "parâmetro season é obrigatório" });
      const comp = resolveCompetition(req, searchParams);
      const standings = await withCache(`standings:${comp.id}:${season}`, TTL.standings, () =>
        dataProvider.getStandings({ leagueId: comp.leagueId, season })
      );
      return sendJSON(res, 200, { standings });
    }

    if (pathname === "/api/fixtures") {
      const season = searchParams.get("season");
      if (!season) return sendJSON(res, 400, { error: "parâmetro season é obrigatório" });
      const comp = resolveCompetition(req, searchParams);
      const fixtures = await withCache(`fixtures:${comp.id}:${season}`, TTL.fixtures, () =>
        dataProvider.getFixtures({ leagueId: comp.leagueId, season })
      );
      return sendJSON(res, 200, { fixtures });
    }

    if (pathname === "/api/players/leaders") {
      const season = searchParams.get("season");
      if (!season) return sendJSON(res, 400, { error: "parâmetro season é obrigatório" });
      const comp = resolveCompetition(req, searchParams);
      const players = await withCache(`players:${comp.id}:${season}`, TTL.playersLeaders, () =>
        dataProvider.getPlayersLeaders({ leagueId: comp.leagueId, season })
      );
      return sendJSON(res, 200, { players });
    }

    const teamPlayersMatch = pathname.match(/^\/api\/teams\/(\d+)\/players$/);
    if (teamPlayersMatch) {
      const teamId = teamPlayersMatch[1];
      const season = searchParams.get("season");
      if (!season) return sendJSON(res, 400, { error: "parâmetro season é obrigatório" });
      // leagueId aqui é usado só por fornecedores que precisam dele pra
      // resolver estatística de jogador por temporada (ver aviso no
      // contrato em providers/index.js) — resolveCompetition() já
      // trata "competição não informada" caindo pro Brasileirão.
      const comp = resolveCompetition(req, searchParams);
      const players = await withCache(`teamplayers:${comp.id}:${teamId}:${season}`, TTL.teams, () =>
        dataProvider.getTeamPlayers({ teamId, season, leagueId: comp.leagueId })
      );
      return sendJSON(res, 200, { players });
    }

    const playerMatch = pathname.match(/^\/api\/players\/(\d+)$/);
    if (playerMatch) {
      const playerId = playerMatch[1];
      const season = searchParams.get("season");
      if (!season) return sendJSON(res, 400, { error: "parâmetro season é obrigatório" });
      const player = await withCache(`player:${playerId}:${season}`, TTL.teams, () =>
        dataProvider.getPlayer({ playerId, season })
      );
      return sendJSON(res, 200, { player });
    }

    const statsMatch = pathname.match(/^\/api\/fixtures\/(\d+)\/statistics$/);
    if (statsMatch) {
      const fixtureId = statsMatch[1];
      const homeId = parseInt(searchParams.get("home"), 10);
      const awayId = parseInt(searchParams.get("away"), 10);
      const stats = await withCache(`fxstats:${fixtureId}`, TTL.fixtureDetail, () =>
        dataProvider.getFixtureStatistics({ fixtureId, homeId, awayId })
      );
      return sendJSON(res, 200, { stats });
    }

    const eventsMatch = pathname.match(/^\/api\/fixtures\/(\d+)\/events$/);
    if (eventsMatch) {
      const fixtureId = eventsMatch[1];
      const { goals, substitutions } = await withCache(`fxevents:${fixtureId}`, TTL.fixtureDetail, () =>
        dataProvider.getFixtureEvents({ fixtureId })
      );
      return sendJSON(res, 200, { goals, substitutions });
    }

    const lineupsMatch = pathname.match(/^\/api\/fixtures\/(\d+)\/lineups$/);
    if (lineupsMatch) {
      const fixtureId = lineupsMatch[1];
      const lineups = await withCache(`fxlineups:${fixtureId}`, TTL.lineups, () =>
        dataProvider.getFixtureLineups({ fixtureId })
      );
      return sendJSON(res, 200, { lineups });
    }

    const oddsMatch = pathname.match(/^\/api\/fixtures\/(\d+)\/odds$/);
    if (oddsMatch) {
      const fixtureId = oddsMatch[1];
      const odds = await withCache(`fxodds:${fixtureId}`, TTL.odds, () =>
        dataProvider.getFixtureOdds({ fixtureId })
      );
      if (odds && typeof odds.home === "number") oddsHistory.record(fixtureId, odds.home);
      return sendJSON(res, 200, { odds });
    }

    const oddsHistoryMatch = pathname.match(/^\/api\/fixtures\/(\d+)\/odds\/history$/);
    if (oddsHistoryMatch) {
      const fixtureId = oddsHistoryMatch[1];
      const range = searchParams.get("range") || "7d";
      const spanMs = { "24h": 24 * 60 * 60 * 1000, "7d": 7 * 24 * 60 * 60 * 1000, "30d": 30 * 24 * 60 * 60 * 1000 }[range] || 7 * 24 * 60 * 60 * 1000;
      const points = oddsHistory.getHistory(fixtureId, Date.now() - spanMs);
      return sendJSON(res, 200, { points });
    }

    if (pathname === "/api/broadcast") {
      // AJUSTE (13/08/2026): o fornecedor de dados esportivos ativo
      // (getFixtureBroadcast — ver providers/index.js, implementado só
      // na Sportmonks via tvStations) foi TIRADO dessa busca por
      // decisão do usuário depois de testar com dado real: a
      // Sportmonks devolve uma lista GENÉRICA de emissoras possíveis
      // da competição, não o canal específico daquele jogo — pior que
      // não mostrar nada, porque parecia um dado confirmado sem ser.
      // getFixtureBroadcast() continua existindo nos providers (não
      // foi removido, só parou de ser chamado aqui) — se a Sportmonks
      // um dia passar a devolver dado por jogo de verdade, é só
      // reativar a chamada que já existe.
      //
      // 2 fontes tentadas em sequência — best-effort: erro ou "não
      // achou" em qualquer uma delas nunca quebra a página, só passa
      // pra próxima (ou devolve station:null no final):
      //   1) epgSource.js (grade de TV real, XMLTV).
      //   2) broadcastSource.js (TheSportsDB) — último fallback, base
      //      de dados esportiva comunitária.
      // Nenhuma das 2 exige API_SPORTS_KEY/SPORTMONKS_API_TOKEN pra
      // FUNCIONAR — por isso essa rota fica de fora do bloqueio
      // LIVE_ONLY acima. "source" na resposta é só debug (não usado
      // pelo front-end) — ajuda a saber qual das 2 achou o dado.
      const date = searchParams.get("date");
      const home = searchParams.get("home");
      const away = searchParams.get("away");
      const fixtureId = searchParams.get("fixtureId");
      if (!date || !home || !away) return sendJSON(res, 400, { error: "date, home e away são obrigatórios" });
      const data = await withCache(`broadcast:${date.slice(0, 10)}:${home}:${away}:${fixtureId || ""}`, TTL.broadcast, async () => {
        try {
          const fromEpg = await fetchBroadcastFromEPG(date, home, away);
          if (fromEpg) return { station: fromEpg, source: "epg" };
        } catch (err) {
          console.error("[broadcast] falha ao consultar o EPG:", err.message);
        }
        try {
          const fromSportsDb = await fetchBroadcastStation(date, home, away);
          return { station: fromSportsDb, source: fromSportsDb ? "thesportsdb" : null };
        } catch (err) {
          console.error("[broadcast] falha ao consultar TheSportsDB:", err.message);
          return { station: null, source: null };
        }
      });
      // Log SEMPRE (não só em falha) — resume numa linha só o
      // resultado final de qualquer consulta de "onde assistir",
      // achando ou não achando em qualquer das 2 fontes. Pensado pra
      // debugar sem precisar abrir a aba Network do navegador (não dá
      // pra usar no celular) — só olhar os logs do Railway já basta.
      console.log(`[broadcast] ${home} x ${away} (${date.slice(0, 10)}${fixtureId ? `, fixture ${fixtureId}` : ", sem fixtureId"}) -> ${data.station ? `"${data.station}" via ${data.source}` : "não encontrado em nenhuma das 2 fontes"}`);
      return sendJSON(res, 200, data);
    }

    if (pathname === "/api/news") {
      // Feed de notícias — fonte independente da API-Sports e da
      // TheSportsDB, não depende de nenhuma chave. Best-effort: erro
      // vira lista vazia, nunca quebra a página (o front mostra um
      // aviso e o usuário pode tentar de novo depois).
      // ?team=Nome do Time — busca notícias daquele time específico
      // (usado pelo card "Últimas notícias" do Dashboard quando há um
      // Clube Favorito selecionado); cache separado por time.
      const team = searchParams.get("team");
      const cacheKey = team ? `news:team:${team.toLowerCase()}` : "news:brasileirao";
      const data = await withCache(cacheKey, TTL.news, async () => {
        try {
          return { items: await fetchNews(20, team) };
        } catch (err) {
          console.error("[news] falha ao buscar RSS:", err.message);
          return { items: [] };
        }
      });
      return sendJSON(res, 200, data);
    }

    // ================= Cadastro / Login / Planos =================
    // Preço de cada plano sempre decidido aqui no backend
    // (server/src/supportPlans.js), nunca confiar em valor vindo do
    // front-end.

    if (pathname === "/api/support/plans") {
      return sendJSON(res, 200, { plans: supportPlans.listPlans() });
    }

    // Cadastro — cria a conta (com senha já com hash) e, se o plano
    // escolhido for pago, já cria a preference do Mercado Pago aqui
    // dentro (não existe mais um /api/support/checkout público — essa
    // rota exige login, ver guard lá em cima — porque na hora do
    // cadastro ainda não existe sessão).
    if (pathname === "/api/auth/signup" && req.method === "POST") {
      const body = await readBody(req);
      const name = String(body.name || "").trim();
      const email = users.normalizeEmail(body.email);
      const phone = String(body.phone || "").trim();
      const password = String(body.password || "");
      const plan = supportPlans.getPlan(String(body.plan || "").trim());

      if (!name || name.length < 2) return sendJSON(res, 400, { error: "Informe seu nome." });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendJSON(res, 400, { error: "E-mail inválido." });
      if (phone.replace(/\D/g, "").length < 8) return sendJSON(res, 400, { error: "Telefone inválido." });
      if (password.length < 8) return sendJSON(res, 400, { error: "A senha precisa ter pelo menos 8 caracteres." });
      if (!plan) return sendJSON(res, 400, { error: "Plano inválido." });
      if (users.findByEmail(email)) return sendJSON(res, 409, { error: "Já existe uma conta com esse e-mail. Faça login." });

      const isFree = plan.price <= 0;
      const user = await users.createUser({
        name, email, phone, password,
        plan: plan.id,
        planStatus: isFree ? "active" : "pending_payment",
      });

      if (isFree) return sendJSON(res, 200, { requiresPayment: false });

      const base = publicBaseUrl(req);
      try {
        const pref = await mercadoPago.createPreference({
          plan, name, email, phone,
          externalReference: user.id,
          backUrl: `${base}/apoie`,
          notificationUrl: `${base}/api/support/webhook`,
        });
        users.updateUser(user.id, { preferenceId: pref.id });
        return sendJSON(res, 200, { requiresPayment: true, checkoutUrl: pref.init_point, ref: user.id });
      } catch (err) {
        users.updateUser(user.id, { planStatus: "checkout_error" });
        console.error("[auth/signup] falha ao criar preference:", err.message);
        return sendJSON(res, 200, {
          requiresPayment: true, checkoutUrl: null, ref: user.id,
          warning: "Conta criada, mas não foi possível iniciar o pagamento agora. Faça login que a gente tenta de novo.",
        });
      }
    }

    if (pathname === "/api/auth/login" && req.method === "POST") {
      const body = await readBody(req);
      const rawLogin = String(body.email || "").trim();
      const password = String(body.password || "");

      // Login padrão de homologação (admin/admin, plano Enterprise —
      // todas as permissões liberadas, pra testar qualquer recurso
      // gated por plano sem precisar passar pelo checkout) — só
      // funciona em host que comece com "hml" (ver isHomologHost). É
      // conveniência pra equipe de teste, não passa pela validação de
      // e-mail normal e a conta é criada (1x) na hora que é usada pela
      // 1ª vez. Nunca funciona em produção, contanto que o domínio de
      // produção não comece com "hml".
      if (isHomologHost(req) && rawLogin.toLowerCase() === "admin" && password === "admin") {
        let admin = users.findByEmail("admin@hml.local");
        if (!admin) {
          admin = await users.createUser({
            name: "Admin (homologação)", email: "admin@hml.local", phone: "00000000000",
            password: "admin", plan: "enterprise", planStatus: "active",
          });
          console.log("[auth] usuário admin/admin de homologação criado, plano Enterprise (host:", req.headers.host, ")");
        } else if (admin.plan !== "enterprise" || admin.planStatus !== "active") {
          // Conta já existia (criada antes desse usuário virar Enterprise
          // por padrão, ou com um upgrade pendente travado) — corrige na
          // hora, sem precisar apagar nada do Volume.
          admin = users.updateUser(admin.id, { plan: "enterprise", planStatus: "active", pendingPlan: null });
          console.log("[auth] usuário admin/admin de homologação corrigido pra plano Enterprise (host:", req.headers.host, ")");
        }
        const adminToken = sessions.createSession(admin.id);
        setSessionCookie(res, adminToken, isHttps(req));
        return sendJSON(res, 200, { user: users.publicUser(admin) });
      }

      const email = users.normalizeEmail(rawLogin);
      const user = users.findByEmail(email);
      // Roda o verifyPassword mesmo sem usuário achado (contra um hash
      // fixo, ver users.js) — mantém o tempo de resposta parecido pra
      // não dar pra descobrir por timing se aquele e-mail existe ou não.
      const ok = await users.verifyPassword(password, user?.passwordHash);
      if (!user || !ok) return sendJSON(res, 401, { error: "E-mail ou senha incorretos." });

      const token = sessions.createSession(user.id);
      setSessionCookie(res, token, isHttps(req));
      return sendJSON(res, 200, { user: users.publicUser(user) });
    }

    if (pathname === "/api/auth/logout" && req.method === "POST") {
      sessions.destroySession(parseCookies(req)[SESSION_COOKIE]);
      clearSessionCookie(res, isHttps(req));
      return sendJSON(res, 200, { ok: true });
    }

    if (pathname === "/api/auth/me") {
      const session = sessions.getSession(parseCookies(req)[SESSION_COOKIE]);
      const user = session ? users.findById(session.userId) : null;
      return sendJSON(res, 200, user ? { authenticated: true, user: users.publicUser(user) } : { authenticated: false });
    }

    // Clube favorito do Dashboard (card "⭐ Clube Favorito"/"🏆 Líder")
    // — vinculado à CONTA logada (req.authUser, setado pelo guard de
    // login lá em cima), não mais só ao navegador (era localStorage
    // antes). teamId null/vazio = removeu o favorito (volta a mostrar
    // o líder do campeonato pra essa competição). Não valida teamId
    // contra a lista de times porque o backend não conhece o registro
    // de times de cada competição (isso é dado estático do front-end,
    // ver public/js/data.js) — só limita tamanho pra não guardar lixo.
    if (pathname === "/api/account/favorite-club" && req.method === "POST") {
      const body = await readBody(req);
      const competitionId = String(body.competitionId || "").trim();
      const teamId = String(body.teamId || "").trim().slice(0, 40) || null;
      if (!competitions.getCompetition(competitionId)) return sendJSON(res, 400, { error: "Competição inválida." });
      const updated = users.setFavoriteClub(req.authUser.id, competitionId, teamId);
      return sendJSON(res, 200, { favoriteClubs: updated.favoriteClubs || {} });
    }

    // Cria um novo checkout pra quem já está logado — cobre 2 casos:
    // (1) retomar o pagamento de um cadastro pago que ainda não
    // confirmou (planStatus "pending_payment"/"checkout_error"), e
    // (2) trocar de plano depois de já estar ativo (upgrade). No caso
    // (2), o plano atual só é substituído quando o pagamento é
    // confirmado (ver webhook) — assim ninguém perde acesso no meio de
    // uma troca de plano.
    if (pathname === "/api/support/checkout" && req.method === "POST") {
      const user = req.authUser; // setado pelo guard de login lá em cima
      const body = await readBody(req);
      const plan = supportPlans.getPlan(String(body.plan || "").trim());
      if (!plan) return sendJSON(res, 400, { error: "Plano inválido." });
      if (plan.price <= 0) return sendJSON(res, 400, { error: "Esse plano é gratuito, não precisa de pagamento." });

      const base = publicBaseUrl(req);
      try {
        const pref = await mercadoPago.createPreference({
          plan, name: user.name, email: user.email, phone: user.phone,
          externalReference: user.id,
          backUrl: `${base}/apoie`,
          notificationUrl: `${base}/api/support/webhook`,
        });
        if (user.planStatus === "active" && user.plan !== plan.id) {
          users.updateUser(user.id, { pendingPlan: plan.id, pendingPreferenceId: pref.id });
        } else {
          users.updateUser(user.id, { plan: plan.id, planStatus: "pending_payment", preferenceId: pref.id });
        }
        return sendJSON(res, 200, { checkoutUrl: pref.init_point });
      } catch (err) {
        console.error("[support/checkout] falha ao criar preference:", err.message);
        return sendJSON(res, 502, { error: "Não foi possível iniciar o pagamento agora. Tente novamente em instantes." });
      }
    }

    // Notificação do Mercado Pago quando um pagamento muda de status.
    // Aceita webhooks v2 (POST, corpo JSON: {type, data:{id}}) e o
    // formato mais antigo (query string: ?topic=payment&id=...) — o
    // Mercado Pago já usou os dois ao longo do tempo. Sempre responde
    // 200 rápido (senão ele fica reenviando); erros só vão pro log.
    if (pathname === "/api/support/webhook") {
      try {
        const body = req.method === "POST" ? await readBody(req) : {};
        const type = searchParams.get("type") || searchParams.get("topic") || body.type || body.topic;
        const paymentId = searchParams.get("data.id") || searchParams.get("id") || body?.data?.id || body?.id;

        if (type === "payment" && paymentId) {
          // A verdade sobre o status vem SEMPRE de uma chamada nossa
          // pra API do Mercado Pago (autenticada com nosso access
          // token) — nunca do conteúdo da notificação em si, que
          // poderia ser forjado por qualquer um que descobrisse a URL.
          const payment = await mercadoPago.getPayment(paymentId);
          const user = payment.external_reference ? users.findById(payment.external_reference) : null;
          if (user) {
            let planForLedger = user.plan;
            if (payment.status === "approved") {
              // Se tinha uma troca de plano em andamento (upgrade), é
              // ela que vira o plano ativo agora; senão é a própria
              // conta nova sendo ativada pela 1ª vez.
              const patch = { planStatus: "active", paymentId: String(payment.id) };
              if (user.pendingPlan) { patch.plan = user.pendingPlan; patch.pendingPlan = null; }
              users.updateUser(user.id, patch);
              planForLedger = patch.plan || user.plan;
            } else {
              users.updateUser(user.id, { lastPaymentStatus: payment.status, paymentId: String(payment.id) });
              planForLedger = user.pendingPlan || user.plan; // recusa/cancelamento pode ter acontecido numa troca de plano em andamento
            }
            // Registro pra seção "Receita" da área administrativa
            // (/admin) — ver paymentsLedger.js. AJUSTE (14/08/2026):
            // registra QUALQUER status (não só aprovado) — pedido do
            // usuário pra entender recusas/cancelamentos/abandonos, não
            // só receita confirmada. Idempotente por (paymentId+status)
            // — reenvio de notificação do Mercado Pago pro MESMO evento
            // não conta em dobro, mas o MESMO paymentId pode gerar mais
            // de 1 entrada se passar por status diferentes com o tempo
            // (ex.: pending -> rejected).
            paymentsLedger.recordIfNew({
              paymentId: payment.id,
              status: payment.status,
              statusDetail: payment.status_detail || null,
              userId: user.id,
              email: user.email,
              plan: planForLedger,
              amount: payment.transaction_amount,
              currency: payment.currency_id,
              method: payment.payment_method_id || payment.payment_type_id || null,
              eventAt: payment.date_approved
                ? new Date(payment.date_approved).getTime()
                : (payment.date_created ? new Date(payment.date_created).getTime() : Date.now()),
            });
          }
        }
      } catch (err) {
        console.error("[support/webhook] falha ao processar notificação:", err.message);
      }
      return sendJSON(res, 200, { received: true });
    }

    // GET /api/support/status?ref=... — a tela de cadastro/retorno do
    // checkout usa isso pra confirmar o pagamento antes mesmo de haver
    // sessão (o redirect de volta do Mercado Pago já vem com o status
    // na URL, mas essa consulta pega o mais recente, atualizado pelo
    // webhook — útil pro PIX, que às vezes confirma alguns segundos
    // depois do redirect). `ref` é o id do usuário — resposta minimalista
    // de propósito, sem nome/telefone/e-mail/senha, é uma rota pública.
    if (pathname === "/api/support/status") {
      const ref = searchParams.get("ref");
      const user = ref ? users.findById(ref) : null;
      if (!user) return sendJSON(res, 404, { error: "cadastro não encontrado" });
      return sendJSON(res, 200, { status: user.planStatus, plan: user.plan });
    }

    // Consulta manual do conteúdo do Volume (usuários + contagem de
    // sessões ativas) — ver comentário do ADMIN_SECRET lá em cima.
    // Responde 404 (não 401/403) tanto sem ADMIN_SECRET configurado
    // quanto com senha errada, de propósito: não dá pra distinguir de
    // fora "rota não existe" de "senha errada".
    if (pathname === "/api/admin/users") {
      if (!isValidAdminSecret(req, searchParams)) return sendJSON(res, 404, { error: "endpoint não encontrado" });
      return sendJSON(res, 200, {
        totalUsers: users.listUsers().length,
        activeSessions: sessions.countActive(),
        users: users.listUsers(),
      });
    }

    // ================= Área administrativa (/admin) — rotas =================
    // Bootstrap: promove uma conta JÁ CADASTRADA (login normal, e-mail/
    // senha de sempre) pro papel de admin. Protegida por ADMIN_SECRET
    // (não por login — ver AUTH_EXEMPT_PATHS) porque é literalmente a
    // rota que CRIA o primeiro admin, não dava pra exigir já ser admin
    // pra chamar ela. Depois de promovida, a conta usa login normal +
    // o guard de role logo acima em tudo mais — o secret não serve
    // pra mais nada relacionado a essa conta a partir daí.
    if (pathname === "/api/adminpanel/promote" && req.method === "POST") {
      if (!isValidAdminSecret(req, searchParams)) return sendJSON(res, 404, { error: "endpoint não encontrado" });
      const body = await readBody(req);
      const email = users.normalizeEmail(body.email);
      if (!email) return sendJSON(res, 400, { error: "E-mail é obrigatório." });
      const user = users.findByEmail(email);
      if (!user) return sendJSON(res, 404, { error: "Não existe conta com esse e-mail — cadastre a conta normal primeiro (mesmo cadastro de sempre), depois promova." });
      users.updateUser(user.id, { role: "admin" });
      return sendJSON(res, 200, { ok: true, email: user.email });
    }

    // Resumo pra tela inicial de /admin: contagem de usuários por
    // plano, sessões ativas, receita (all-time + mês corrente) e
    // status de cada integração — tudo num request só, pra tela abrir
    // rápido.
    if (pathname === "/api/adminpanel/overview") {
      const allUsers = users.listUsers();
      const byPlan = {};
      allUsers.forEach((u) => { byPlan[u.plan] = (byPlan[u.plan] || 0) + 1; });
      return sendJSON(res, 200, {
        users: { total: allUsers.length, byPlan, activeSessions: sessions.countActive() },
        revenue: paymentsLedger.summary(),
        integrations: {
          dataProvider: {
            name: dataProvider.ACTIVE_PROVIDER_NAME,
            hasCredential: dataProvider.hasCredential(),
            mode: APP_MODE,
            liveModeEnabled: liveModeEnabled(),
          },
          mercadoPago: { configured: !!process.env.MERCADOPAGO_ACCESS_TOKEN },
          adsense: {
            configured: !!(ADSENSE_CLIENT_ID && ADSENSE_AD_SLOT_FREEMIUM_MODAL),
            clientId: ADSENSE_CLIENT_ID || null,
          },
          epg: { url: (process.env.EPG_URL || "").trim() || "https://www.open-epg.com/files/brazil1.xml (padrão)" },
          newsRss: { url: (process.env.NEWS_RSS_URL || "").trim() || null },
        },
      });
    }

    // Tráfego/sucesso/falha da Sportmonks e do EPG — pedido pelo
    // usuário pra acompanhar as 2 integrações que mais dependem de
    // fonte externa instável (Sportmonks é comercial mas ainda assim
    // cai às vezes; EPG é fonte comunitária best-effort de propósito,
    // ver aviso no topo de epgSource.js). Métricas SÓ EM MEMÓRIA
    // (zeram a cada restart/deploy do Railway) — não é histórico
    // permanente tipo Receita, é "o que está acontecendo agora/desde
    // o último boot", que já é o que interessa pra diagnosticar
    // tráfego ao vivo. dataProvider ativo diferente de "sportmonks"
    // não é erro nenhum aqui — as métricas simplesmente ficam
    // zeradas, porque nenhuma chamada foi feita mesmo.
    if (pathname === "/api/adminpanel/integrations") {
      return sendJSON(res, 200, {
        activeProvider: dataProvider.ACTIVE_PROVIDER_NAME,
        sportmonks: sportmonksClient.getStats(),
        epg: getEpgStats(),
      });
    }

    // Comportamento do cliente — funil de login (% que passa da tela
    // de login/cadastro pra dentro do app de verdade) + páginas mais
    // navegadas nos últimos 30 dias — pedido pelo usuário. Ver
    // server/src/analytics.js pra como os eventos são gravados
    // (POST /api/track, disparado pelo front-end).
    if (pathname === "/api/adminpanel/analytics") {
      return sendJSON(res, 200, {
        funnel: analytics.funnel(),
        pageViews: analytics.pageViews(30 * 24 * 60 * 60 * 1000),
      });
    }

    // Edição de conteúdo — /admin > Conteúdo, 1ª versão só dos cards de
    // plano (ver server/src/contentStore.js pro porquê do escopo e o
    // aviso de persistência efêmera). Devolve o padrão do código (pra
    // mostrar como placeholder de "o que aparece se deixar em branco")
    // junto com o override atual (se tiver algum) — a tela de admin
    // pré-preenche os campos com o override, nunca com o padrão.
    if (pathname === "/api/adminpanel/content/plans") {
      return sendJSON(res, 200, {
        plans: Object.values(supportPlans.PLANS).map((base) => ({
          id: base.id,
          price: base.price,
          defaults: { title: base.title, tagline: base.tagline, features: base.features },
          override: contentStore.getPlanOverride(base.id) || {},
        })),
      });
    }
    // Salva o override de UM plano — o formulário sempre manda os 4
    // campos (title/tagline/features/imageUrl), campo vazio vira "sem
    // override nesse campo" (volta pro padrão do código) — ver
    // setPlanOverride em contentStore.js. NUNCA aceita "price" aqui
    // (nem o form manda) — preço continua só em supportPlans.js/
    // variável de ambiente, de propósito.
    const contentPlanMatch = pathname.match(/^\/api\/adminpanel\/content\/plans\/([^/]+)$/);
    if (contentPlanMatch && req.method === "POST") {
      const planId = contentPlanMatch[1];
      if (!supportPlans.PLANS[planId]) return sendJSON(res, 404, { error: "Plano não encontrado." });
      const body = await readBody(req);
      const features = typeof body.features === "string"
        ? body.features.split("\n").map((s) => s.trim()).filter(Boolean)
        : (Array.isArray(body.features) ? body.features : []);
      const saved = contentStore.setPlanOverride(planId, {
        title: body.title, tagline: body.tagline, features, imageUrl: body.imageUrl,
      });
      return sendJSON(res, 200, { ok: true, override: saved || {}, plan: supportPlans.getPlan(planId) });
    }

    // Lista completa de usuários (mesmos campos de users.listUsers(),
    // já com a contagem de sessões ativas de cada um) — a tabela de
    // usuários em /admin filtra/busca do lado do cliente, o volume de
    // contas desse app não justifica paginação/busca no servidor.
    if (pathname === "/api/adminpanel/users") {
      const activeByUser = sessions.countActiveByUser();
      const list = users.listUsers().map((u) => ({ ...u, activeSessions: activeByUser[u.id] || 0 }));
      return sendJSON(res, 200, { users: list });
    }

    // Força logout de UM usuário (derruba todas as sessões ativas
    // dele) — ex.: suspeita de conta comprometida, ou só forçar
    // re-login depois de uma troca manual de plano feita abaixo.
    const adminLogoutMatch = pathname.match(/^\/api\/adminpanel\/users\/([^/]+)\/logout$/);
    if (adminLogoutMatch && req.method === "POST") {
      const target = users.findById(adminLogoutMatch[1]);
      if (!target) return sendJSON(res, 404, { error: "Usuário não encontrado." });
      const n = sessions.destroyAllForUser(target.id);
      return sendJSON(res, 200, { ok: true, sessionsRevoked: n });
    }

    // Troca manual de plano/status — pra suporte (ex.: cortesia,
    // corrigir um pagamento que travou em pending_payment, rebaixar
    // conta problemática). NÃO passa pelo Mercado Pago nem gera
    // registro na Receita (só pagamento de verdade, confirmado pelo
    // webhook, entra no ledger — ver paymentsLedger.js) — é só um
    // ajuste direto no estado da conta.
    const adminPlanMatch = pathname.match(/^\/api\/adminpanel\/users\/([^/]+)\/plan$/);
    if (adminPlanMatch && req.method === "POST") {
      const target = users.findById(adminPlanMatch[1]);
      if (!target) return sendJSON(res, 404, { error: "Usuário não encontrado." });
      const body = await readBody(req);
      const plan = String(body.plan || "").trim();
      const planStatus = String(body.planStatus || "").trim();
      if (!supportPlans.getPlan(plan)) return sendJSON(res, 400, { error: "Plano inválido." });
      if (!["active", "pending_payment", "checkout_error"].includes(planStatus)) return sendJSON(res, 400, { error: "Status de plano inválido." });
      const updated = users.updateUser(target.id, { plan, planStatus, pendingPlan: null });
      return sendJSON(res, 200, { ok: true, user: users.publicUser(updated) });
    }

    // Receita: pagamentos aprovados, tentativas NÃO aprovadas (recusa/
    // cancelamento/pendente/etc. — ver AJUSTE em paymentsLedger.js) e
    // abandono de checkout (conta paga que nunca chegou a tentar pagar
    // nenhuma vez — o Mercado Pago não avisa isso, é inferido aqui:
    // plano pago + ainda não ativa + nunca teve payment nenhum, só o
    // link de checkout criado no cadastro). Não cobre abandono de
    // UPGRADE (troca de plano de quem já é assinante ativo) —
    // pendingPreferenceId existe pra isso mas ainda não tem essa
    // mineração aqui, é um caso bem mais raro/de menor risco que
    // abandono no cadastro pago em si.
    if (pathname === "/api/adminpanel/revenue") {
      const allEvents = paymentsLedger.listAll();
      const payments = allEvents.filter((e) => (e.status || "approved") === "approved");
      const attempts = allEvents.filter((e) => (e.status || "approved") !== "approved");
      const abandoned = users.listUsers()
        .filter((u) => u.plan !== "freemium" && u.planStatus !== "active" && !u.paymentId && u.preferenceId)
        .map((u) => ({ id: u.id, name: u.name, email: u.email, plan: u.plan, planStatus: u.planStatus, createdAt: u.createdAt, updatedAt: u.updatedAt }));
      return sendJSON(res, 200, { summary: paymentsLedger.summary(), payments, attempts, abandoned });
    }

    if (pathname.startsWith("/api/")) {
      return sendJSON(res, 404, { error: "endpoint não encontrado" });
    }

    return serveStatic(req, res);
  } catch (err) {
    return handleError(res, err);
  }
});

bootstrapDefaultAdmin()
  .catch((err) => console.error("[bootstrap] falha ao criar/promover admin padrão:", err.message))
  .finally(() => {
    server.listen(PORT, () => {
      console.log(`\n⚽  Brasileirão 2026 rodando em http://localhost:${PORT}`);
      console.log(`   Fornecedor de dados ativo: ${dataProvider.ACTIVE_PROVIDER_NAME}`);
      console.log(dataProvider.hasCredential()
        ? `   Credencial configurada — modo ao vivo disponível.`
        : `   Sem credencial configurada pra esse fornecedor — o site usará dados de exemplo.\n   Copie .env.example para .env e configure a credencial (se esse fornecedor precisar de uma) para ativar dados reais.`);
      // Log explícito do que a variável de ambiente realmente chegou (ou
      // não) no processo — se o valor configurado no host não bater com o
      // que aparece aqui, o problema é no nome/escopo da variável no
      // painel do host (Railway etc.), não no código.
      console.log(`   APP_MODE recebido: ${JSON.stringify(process.env.APP_MODE ?? null)} → modo efetivo: "${APP_MODE}"`);
    });
  });
