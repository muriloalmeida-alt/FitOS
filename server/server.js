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
const { mapTeam, mapStandingRow, mapFixture, mapStatistics, mapEvents, mapSubstitutions, mapLineups, mapOdds, mapPlayerEntry } = require("./src/adapter");
const cache = require("./src/cache");
const oddsHistory = require("./src/oddsHistory");
const { fetchBroadcastStation } = require("./src/broadcastSource");
const { fetchNews } = require("./src/newsSource");

loadDotEnv();

const PORT = process.env.PORT || 8787;
const LEAGUE_ID = process.env.LEAGUE_ID || "71"; // 71 = Brasileirão Série A na API-Sports (confirme no /api/leagues/search)
const PUBLIC_DIR = path.join(__dirname, "..", "public");

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
