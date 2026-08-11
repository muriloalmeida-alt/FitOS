/* ===================================================================
   LIVEDATA.JS — Carrega dados reais via o backend (proxy da API-Sports)
   -------------------------------------------------------------------
   Se o backend não tiver uma API_SPORTS_KEY configurada, ou a chamada
   falhar por qualquer motivo, tryLoadLiveData() retorna null e o
   app.js segue no modo de exemplo (DEMO_TEAMS + calendário gerado).
=================================================================== */

const LIVE_SEASON = new Date().getFullYear(); // ajuste manual se quiser travar uma temporada específica

async function safeFetchJSON(url) {
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.error) throw new Error(data?.error || `Falha ao buscar ${url}`);
  return data;
}

// Calibra força de ataque/defesa de cada time a partir da tabela real
// (gols marcados/sofridos por jogo, normalizados pela média da liga).
// Essa força alimenta o mesmo motor de Monte Carlo (engine.js) usado
// no modo de exemplo, agora com números tirados da temporada real.
function calibrateStrengths(standings) {
  const withGames = standings.filter(r => r.j > 0);
  if (!withGames.length) return {};
  const avg = withGames.reduce((s, r) => s + r.gp / r.j, 0) / withGames.length || 1;
  const out = {};
  standings.forEach(r => {
    const gfpg = r.j ? r.gp / r.j : avg;
    const gapg = r.j ? r.gc / r.j : avg;
    out[r.id] = {
      atk: clamp(gfpg / avg, 0.5, 2.3),
      def: clamp(gapg / avg, 0.4, 2.3),
    };
  });
  return out;
}

const PALETTE = ["#20D08A", "#3E7BFF", "#FFC93C", "#FF4D5E", "#8A2432", "#1E90CE", "#DC2626", "#0B6E33"];
function colorForId(id) { return PALETTE[id % PALETTE.length]; }

async function tryLoadLiveData(season = LIVE_SEASON) {
  try {
    const health = await safeFetchJSON("/api/health");
    if (!health.hasKey) {
      console.info("[liveData] Sem API_SPORTS_KEY configurada no servidor — usando modo de exemplo.");
      return null;
    }

    const [teamsData, standingsData, fixturesData] = await Promise.all([
      safeFetchJSON(`/api/teams?season=${season}`),
      safeFetchJSON(`/api/standings?season=${season}`),
      safeFetchJSON(`/api/fixtures?season=${season}`),
    ]);

    if (!teamsData.teams?.length || !fixturesData.fixtures?.length) {
      console.warn("[liveData] Resposta da API-Sports veio vazia — usando modo de exemplo.");
      return null;
    }

    const strengths = calibrateStrengths(standingsData.standings || []);
    const teams = teamsData.teams.map(t => ({
      ...t,
      atk: strengths[t.id]?.atk ?? 1.3,
      def: strengths[t.id]?.def ?? 1.05,
      c1: colorForId(t.id), c2: "#12121A",
    }));

    const allRounds = {};
    const results = {};
    let maxRound = 0;
    fixturesData.fixtures.forEach(fx => {
      if (!fx.round) return;
      maxRound = Math.max(maxRound, fx.round);
      allRounds[fx.round] = allRounds[fx.round] || [];
      allRounds[fx.round].push({ home: fx.home, away: fx.away, fixtureId: fx.id, date: fx.date, venue: fx.venue });
      if (["FT", "AET", "PEN"].includes(fx.status)) {
        results[`${fx.round}_${fx.home}_${fx.away}`] = {
          home: fx.home, away: fx.away, gh: fx.gh, ga: fx.ga, round: fx.round,
          fixtureId: fx.id, official: true, venue: fx.venue,
        };
      }
    });

    return {
      teams, allRounds, results,
      totalRounds: maxRound || 38,
      season,
    };
  } catch (err) {
    console.warn("[liveData] Não foi possível carregar dados reais, usando modo de exemplo:", err.message);
    return null;
  }
}

// Escalação (titulares + banco + formação + técnico) de UM jogo —
// compartilhada entre o card de jogo encerrado (escalação que jogou)
// e o de jogo futuro (escalação já publicada, quando existir). Lazy
// e cacheada: só busca quando o card é expandido, e só uma vez.
const fixtureLineupsCache = new Map();
async function loadFixtureLineups(fixtureId) {
  if (fixtureLineupsCache.has(fixtureId)) return fixtureLineupsCache.get(fixtureId);
  const promise = safeFetchJSON(`/api/fixtures/${fixtureId}/lineups`).then(r => r.lineups || {}).catch(() => ({}));
  fixtureLineupsCache.set(fixtureId, promise);
  return promise;
}

// Emissora de TV (best-effort, fonte comunitária TheSportsDB — ver
// server/src/broadcastSource.js) de UM jogo futuro. Lazy, cacheada, e
// tolerante a falha: erro ou "não achou" vira null, o front-end cai
// no texto genérico nesse caso.
const broadcastCache = new Map();
async function loadBroadcastInfo(dateIso, homeName, awayName) {
  const day = String(dateIso || "").slice(0, 10);
  const key = `${day}:${homeName}:${awayName}`;
  if (broadcastCache.has(key)) return broadcastCache.get(key);
  const promise = safeFetchJSON(`/api/broadcast?date=${encodeURIComponent(day)}&home=${encodeURIComponent(homeName)}&away=${encodeURIComponent(awayName)}`)
    .then(r => r.station || null)
    .catch(() => null);
  broadcastCache.set(key, promise);
  return promise;
}

// Busca estatísticas + gols + substituições + escalação de UM jogo já
// encerrado — lazy, só quando o usuário expande aquele card em "Jogos".
const fixtureDetailCache = new Map();
async function loadFixtureDetails(fixtureId, homeId, awayId) {
  if (fixtureDetailCache.has(fixtureId)) return fixtureDetailCache.get(fixtureId);
  const promise = Promise.all([
    safeFetchJSON(`/api/fixtures/${fixtureId}/statistics?home=${homeId}&away=${awayId}`),
    safeFetchJSON(`/api/fixtures/${fixtureId}/events`),
    loadFixtureLineups(fixtureId),
  ]).then(([statsRes, eventsRes, lineups]) => ({
    stats: statsRes.stats,
    goals: eventsRes.goals,
    substitutions: eventsRes.substitutions,
    lineups,
  }));
  fixtureDetailCache.set(fixtureId, promise);
  return promise;
}

// Busca odds (1X2) de UM jogo específico ainda não realizado — lazy,
// só quando o card daquela partida é renderizado na tela.
const fixtureOddsCache = new Map();
async function loadFixtureOdds(fixtureId) {
  if (fixtureOddsCache.has(fixtureId)) return fixtureOddsCache.get(fixtureId);
  const promise = safeFetchJSON(`/api/fixtures/${fixtureId}/odds`).then(r => r.odds);
  fixtureOddsCache.set(fixtureId, promise);
  return promise;
}

// Histórico de movimentação de odds (gravado pelo próprio backend a
// cada consulta — ver server/src/oddsHistory.js). Sem cache local
// porque o range pode mudar (24h/7d/30d).
async function loadOddsHistory(fixtureId, range) {
  try {
    const data = await safeFetchJSON(`/api/fixtures/${fixtureId}/odds/history?range=${range}`);
    return data.points || [];
  } catch {
    return [];
  }
}

// Ranking de jogadores (gols, assistências, cartões, nota) — lazy,
// só busca quando o usuário abre a sub-aba "Jogadores" em
// Estatísticas (ver app.js). Cacheado em memória: a lista não muda
// dentro de uma mesma sessão de navegação.
let playersLeadersCache = null;
async function loadPlayersLeaders(season = LIVE_SEASON) {
  if (playersLeadersCache) return playersLeadersCache;
  try {
    const data = await safeFetchJSON(`/api/players/leaders?season=${season}`);
    playersLeadersCache = data.players || [];
    return playersLeadersCache;
  } catch (err) {
    console.warn("[liveData] Não foi possível carregar estatísticas de jogadores:", err.message);
    return [];
  }
}
