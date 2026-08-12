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

const { apiSportsGet, getQuota } = require("./src/apiSports");
const { mapTeam, mapStandingRow, mapFixture, mapStatistics, mapEvents, mapSubstitutions, mapLineups, mapOdds, mapPlayerEntry } = require("./src/adapter");
const cache = require("./src/cache");
const oddsHistory = require("./src/oddsHistory");
const { fetchBroadcastStation } = require("./src/broadcastSource");
const { fetchNews } = require("./src/newsSource");
const mercadoPago = require("./src/mercadoPago");
const supportPlans = require("./src/supportPlans");
const users = require("./src/users");
const sessions = require("./src/sessions");

const PORT = process.env.PORT || 8787;
const LEAGUE_ID = process.env.LEAGUE_ID || "71"; // 71 = Brasileirão Série A na API-Sports (confirme no /api/leagues/search)
// Temporada usada no modo ao vivo — configurável no Railway/host, sem
// precisar editar código nem dar redeploy manual de código toda vez
// que quiser trocar (ex.: plano free da API-Sports geralmente só cobre
// temporadas passadas, não a corrente). O front-end nunca mais
// hardcoda esse valor — ele pergunta pro backend via GET /api/health.
const LIVE_SEASON = process.env.LIVE_SEASON || "2023";
const PUBLIC_DIR = path.join(__dirname, "..", "public");

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

// Se true, os endpoints que dependem da API-Sports devem responder.
// Combina APP_MODE com a presença (ou não) da chave.
function liveModeEnabled() {
  if (APP_MODE === "demo") return false;
  return !!process.env.API_SPORTS_KEY;
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
        // Sinal explícito pra debug: pediram modo ao vivo (APP_MODE=live)
        // mas a chave não está configurada no host — em vez de cair
        // quieto pro modo exemplo, isso aparece aqui e nos endpoints
        // que dependem da API-Sports (erro 501 em vez de resposta vazia).
        warning: (APP_MODE === "live" && !process.env.API_SPORTS_KEY)
          ? "APP_MODE=live mas API_SPORTS_KEY não está configurada neste host."
          : null,
        leagueId: LEAGUE_ID,
        season: LIVE_SEASON,
        quota: getQuota(),
      });
    }

    // ================= Login obrigatório =================
    // Toda rota /api/* a partir daqui exige sessão válida (cookie),
    // EXCETO as que precisam funcionar antes/sem estar logado: as
    // próprias rotas de auth, a lista de planos (mostrada na tela de
    // cadastro), e o webhook/status do Mercado Pago (chamados pelo
    // próprio Mercado Pago, ou consultados durante o retorno do
    // checkout — ainda sem sessão). /api/support/checkout FICA de fora
    // dessa lista de propósito: exige login (é usado tanto durante o
    // cadastro com plano pago quanto pra trocar de plano depois).
    const AUTH_EXEMPT_PATHS = new Set([
      "/api/auth/signup", "/api/auth/login", "/api/auth/logout", "/api/auth/me",
      "/api/support/plans", "/api/support/webhook", "/api/support/status",
    ]);
    if (pathname.startsWith("/api/") && !AUTH_EXEMPT_PATHS.has(pathname)) {
      const cookies = parseCookies(req);
      const session = sessions.getSession(cookies[SESSION_COOKIE]);
      const authUser = session ? users.findById(session.userId) : null;
      if (!authUser) return sendJSON(res, 401, { error: "Login necessário.", code: "AUTH_REQUIRED" });
      req.authUser = authUser;
      // /api/support/checkout é a única rota autenticada que não exige
      // plano ativo — é exatamente o endpoint que ativa/retenta o
      // pagamento de quem ainda está com planStatus pendente.
      if (pathname !== "/api/support/checkout" && authUser.planStatus !== "active") {
        return sendJSON(res, 402, {
          error: "Pagamento pendente — finalize o pagamento pra liberar o acesso.",
          code: "PAYMENT_REQUIRED", plan: authUser.plan, planStatus: authUser.planStatus,
        });
      }
    }

    // Bloqueia cedo qualquer rota que dependa da API-Sports quando o
    // modo ao vivo está desligado (sem chave, ou APP_MODE=demo forçando
    // exemplo mesmo com chave presente) — /api/health, /api/broadcast
    // (TheSportsDB), /api/news (RSS), /api/support/* e /api/auth/*
    // (Mercado Pago e login, independentes da API-Sports e do modo ao
    // vivo/exemplo) não usam a API-Sports, então ficam de fora dessa
    // checagem.
    const LIVE_ONLY = pathname.startsWith("/api/") && pathname !== "/api/broadcast" && pathname !== "/api/news"
      && !pathname.startsWith("/api/support/") && !pathname.startsWith("/api/auth/");
    if (LIVE_ONLY && !liveModeEnabled()) {
      const err = new Error(
        APP_MODE === "demo"
          ? "Modo Exemplo forçado (APP_MODE=demo) — dados reais desativados de propósito neste host."
          : "API_SPORTS_KEY não configurada neste host (ou modo ao vivo desativado)."
      );
      err.code = "NO_API_KEY";
      throw err;
    }

    if (pathname === "/api/leagues/search") {
      const name = searchParams.get("name") || "Brazil";
      const data = await withCache(`leagues:${name}`, TTL.leagueSearch, () =>
        apiSportsGet("/leagues", { search: name })
      );
      return sendJSON(res, 200, {
        leagues: data.map(l => ({ id: l.league.id, name: l.league.name, type: l.league.type, country: l.country.name, seasons: l.seasons.map(s => s.year) })),
      });
    }

    if (pathname === "/api/teams") {
      const season = searchParams.get("season");
      if (!season) return sendJSON(res, 400, { error: "parâmetro season é obrigatório" });
      const data = await withCache(`teams:${LEAGUE_ID}:${season}`, TTL.teams, () =>
        apiSportsGet("/teams", { league: LEAGUE_ID, season })
      );
      return sendJSON(res, 200, { teams: data.map(mapTeam) });
    }

    if (pathname === "/api/standings") {
      const season = searchParams.get("season");
      if (!season) return sendJSON(res, 400, { error: "parâmetro season é obrigatório" });
      const data = await withCache(`standings:${LEAGUE_ID}:${season}`, TTL.standings, () =>
        apiSportsGet("/standings", { league: LEAGUE_ID, season })
      );
      const table = data?.[0]?.league?.standings?.[0] || [];
      return sendJSON(res, 200, { standings: table.map(mapStandingRow) });
    }

    if (pathname === "/api/fixtures") {
      const season = searchParams.get("season");
      if (!season) return sendJSON(res, 400, { error: "parâmetro season é obrigatório" });
      const data = await withCache(`fixtures:${LEAGUE_ID}:${season}`, TTL.fixtures, () =>
        apiSportsGet("/fixtures", { league: LEAGUE_ID, season })
      );
      return sendJSON(res, 200, { fixtures: data.map(mapFixture) });
    }

    if (pathname === "/api/players/leaders") {
      const season = searchParams.get("season");
      if (!season) return sendJSON(res, 400, { error: "parâmetro season é obrigatório" });
      const data = await withCache(`players:${LEAGUE_ID}:${season}`, TTL.playersLeaders, async () => {
        // 4 chamadas baratas (1 página cada, ~20 jogadores) em vez de
        // paginar /players inteiro (custaria dezenas de requisições
        // pra cobrir o elenco completo da liga). Cada item já vem com
        // o bloco de estatísticas completo da temporada, então dá pra
        // montar uma lista única com gols+assistências+cartões+nota
        // mesmo sem uma chamada dedicada de "nota por jogo".
        const [scorers, assists, yellows, reds] = await Promise.all([
          apiSportsGet("/players/topscorers", { league: LEAGUE_ID, season }),
          apiSportsGet("/players/topassists", { league: LEAGUE_ID, season }),
          apiSportsGet("/players/topyellowcards", { league: LEAGUE_ID, season }),
          apiSportsGet("/players/topredcards", { league: LEAGUE_ID, season }),
        ]);
        const byId = new Map();
        [...scorers, ...assists, ...yellows, ...reds].forEach(item => {
          const p = mapPlayerEntry(item);
          if (p) byId.set(p.id, p);
        });
        return Array.from(byId.values());
      });
      return sendJSON(res, 200, { players: data });
    }

    const teamPlayersMatch = pathname.match(/^\/api\/teams\/(\d+)\/players$/);
    if (teamPlayersMatch) {
      const teamId = teamPlayersMatch[1];
      const season = searchParams.get("season");
      if (!season) return sendJSON(res, 400, { error: "parâmetro season é obrigatório" });
      const data = await withCache(`teamplayers:${teamId}:${season}`, TTL.teams, async () => {
        // Elenco de 1 time só cabe em 1-2 páginas (~20-40 jogadores);
        // busca as duas sempre, sem depender do "paging" da resposta
        // (o cliente genérico já descarta esse campo). Página vazia
        // não quebra a outra.
        const fetchPage = (p) => apiSportsGet("/players", { team: teamId, season, page: p }).catch(() => []);
        const [page1, page2] = await Promise.all([fetchPage(1), fetchPage(2)]);
        const byId = new Map();
        [...page1, ...page2].forEach(item => {
          const p = mapPlayerEntry(item);
          if (p) byId.set(p.id, p);
        });
        return Array.from(byId.values());
      });
      return sendJSON(res, 200, { players: data });
    }

    const playerMatch = pathname.match(/^\/api\/players\/(\d+)$/);
    if (playerMatch) {
      const playerId = playerMatch[1];
      const season = searchParams.get("season");
      if (!season) return sendJSON(res, 400, { error: "parâmetro season é obrigatório" });
      const data = await withCache(`player:${playerId}:${season}`, TTL.teams, async () => {
        const resp = await apiSportsGet("/players", { id: playerId, season });
        const item = (resp || [])[0];
        return item ? mapPlayerEntry(item) : null;
      });
      return sendJSON(res, 200, { player: data });
    }

    const statsMatch = pathname.match(/^\/api\/fixtures\/(\d+)\/statistics$/);
    if (statsMatch) {
      const fixtureId = statsMatch[1];
      const homeId = parseInt(searchParams.get("home"), 10);
      const awayId = parseInt(searchParams.get("away"), 10);
      const data = await withCache(`fxstats:${fixtureId}`, TTL.fixtureDetail, () =>
        apiSportsGet("/fixtures/statistics", { fixture: fixtureId })
      );
      return sendJSON(res, 200, { stats: mapStatistics(data, homeId, awayId) });
    }

    const eventsMatch = pathname.match(/^\/api\/fixtures\/(\d+)\/events$/);
    if (eventsMatch) {
      const fixtureId = eventsMatch[1];
      // Gols e substituições vêm do mesmo endpoint (/fixtures/events)
      // — só filtram tipos diferentes do mesmo payload, então uma
      // chamada só já serve os dois.
      const data = await withCache(`fxevents:${fixtureId}`, TTL.fixtureDetail, () =>
        apiSportsGet("/fixtures/events", { fixture: fixtureId })
      );
      return sendJSON(res, 200, { goals: mapEvents(data), substitutions: mapSubstitutions(data) });
    }

    const lineupsMatch = pathname.match(/^\/api\/fixtures\/(\d+)\/lineups$/);
    if (lineupsMatch) {
      const fixtureId = lineupsMatch[1];
      const data = await withCache(`fxlineups:${fixtureId}`, TTL.lineups, () =>
        apiSportsGet("/fixtures/lineups", { fixture: fixtureId })
      );
      return sendJSON(res, 200, { lineups: mapLineups(data) });
    }

    const oddsMatch = pathname.match(/^\/api\/fixtures\/(\d+)\/odds$/);
    if (oddsMatch) {
      const fixtureId = oddsMatch[1];
      const data = await withCache(`fxodds:${fixtureId}`, TTL.odds, () =>
        apiSportsGet("/odds", { fixture: fixtureId })
      );
      const odds = mapOdds(data);
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
      // Fonte independente da API-Sports (TheSportsDB, gratuita e
      // comunitária) — não exige API_SPORTS_KEY. Best-effort: erro
      // ou "não achou" vira station:null, nunca quebra a página.
      const date = searchParams.get("date");
      const home = searchParams.get("home");
      const away = searchParams.get("away");
      if (!date || !home || !away) return sendJSON(res, 400, { error: "date, home e away são obrigatórios" });
      const data = await withCache(`broadcast:${date.slice(0, 10)}:${home}:${away}`, TTL.broadcast, async () => {
        try {
          return { station: await fetchBroadcastStation(date, home, away) };
        } catch (err) {
          console.error("[broadcast] falha ao consultar TheSportsDB:", err.message);
          return { station: null };
        }
      });
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
      const email = users.normalizeEmail(body.email);
      const password = String(body.password || "");
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
            if (payment.status === "approved") {
              // Se tinha uma troca de plano em andamento (upgrade), é
              // ela que vira o plano ativo agora; senão é a própria
              // conta nova sendo ativada pela 1ª vez.
              const patch = { planStatus: "active", paymentId: String(payment.id) };
              if (user.pendingPlan) { patch.plan = user.pendingPlan; patch.pendingPlan = null; }
              users.updateUser(user.id, patch);
            } else {
              users.updateUser(user.id, { lastPaymentStatus: payment.status, paymentId: String(payment.id) });
            }
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

    if (pathname.startsWith("/api/")) {
      return sendJSON(res, 404, { error: "endpoint não encontrado" });
    }

    return serveStatic(req, res);
  } catch (err) {
    return handleError(res, err);
  }
});

server.listen(PORT, () => {
  console.log(`\n⚽  Brasileirão 2026 rodando em http://localhost:${PORT}`);
  console.log(process.env.API_SPORTS_KEY
    ? `   Chave da API-Sports detectada — modo ao vivo disponível.`
    : `   Nenhuma API_SPORTS_KEY em .env — o site usará dados de exemplo.\n   Copie .env.example para .env e cole sua chave para ativar dados reais.`);
  // Log explícito do que a variável de ambiente realmente chegou (ou
  // não) no processo — se o valor configurado no host não bater com o
  // que aparece aqui, o problema é no nome/escopo da variável no
  // painel do host (Railway etc.), não no código.
  console.log(`   APP_MODE recebido: ${JSON.stringify(process.env.APP_MODE ?? null)} → modo efetivo: "${APP_MODE}"`);
});
