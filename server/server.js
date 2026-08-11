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
const { apiSportsGet, getQuota } = require("./src/apiSports");
const { mapTeam, mapStandingRow, mapFixture, mapStatistics, mapEvents, mapOdds } = require("./src/adapter");
const cache = require("./src/cache");
const oddsHistory = require("./src/oddsHistory");

loadDotEnv();

const PORT = process.env.PORT || 8787;
const LEAGUE_ID = process.env.LEAGUE_ID || "71"; // 71 = Brasileirão Série A na API-Sports (confirme no /api/leagues/search)
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const TTL = {
  teams: 12 * 60 * 60 * 1000,      // 12h — elenco de times quase não muda
  standings: 15 * 60 * 1000,       // 15min
  fixtures: 15 * 60 * 1000,        // 15min
  fixtureDetail: 7 * 24 * 60 * 60 * 1000, // 7 dias — jogo encerrado não muda mais
  odds: 10 * 60 * 1000,             // 10min — odds pré-jogo mudam com frequência
  leagueSearch: 24 * 60 * 60 * 1000,
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
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
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
        hasKey: !!process.env.API_SPORTS_KEY,
        leagueId: LEAGUE_ID,
        quota: getQuota(),
      });
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
      const data = await withCache(`fxevents:${fixtureId}`, TTL.fixtureDetail, () =>
        apiSportsGet("/fixtures/events", { fixture: fixtureId })
      );
      return sendJSON(res, 200, { goals: mapEvents(data) });
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
});
