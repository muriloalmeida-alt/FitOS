/* ===================================================================
   LIVEDATA.JS — Carrega dados reais via o backend (proxy da API-Sports)
   -------------------------------------------------------------------
   Se o backend não tiver uma API_SPORTS_KEY configurada, ou a chamada
   falhar por qualquer motivo, tryLoadLiveData() retorna null e o
   app.js segue no modo de exemplo (DEMO_TEAMS + calendário gerado).
=================================================================== */

// TESTE: fixado em 2023 porque o plano free da API-Sports não cobre 2026 ainda.
// Pra voltar ao normal depois do teste, troque de volta para: new Date().getFullYear()
const LIVE_SEASON = 2023;

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
      allRounds[fx.round].push({ home: fx.home, away: fx.away, fixtureId: fx.id, date: fx.date });
      if (["FT", "AET", "PEN"].includes(fx.status)) {
        results[`${fx.round}_${fx.home}_${fx.away}`] = {
          home: fx.home, away: fx.away, gh: fx.gh, ga: fx.ga, round: fx.round,
          fixtureId: fx.id, official: true,
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

// Busca estatísticas + gols de UM jogo específico (lazy — só quando o
// usuário efetivamente abre aquela rodada/partida na aba "Jogos").
const fixtureDetailCache = new Map();
async function loadFixtureDetails(fixtureId, homeId, awayId) {
  if (fixtureDetailCache.has(fixtureId)) return fixtureDetailCache.get(fixtureId);
  const promise = Promise.all([
    safeFetchJSON(`/api/fixtures/${fixtureId}/statistics?home=${homeId}&away=${awayId}`),
    safeFetchJSON(`/api/fixtures/${fixtureId}/events`),
  ]).then(([statsRes, eventsRes]) => ({ stats: statsRes.stats, goals: eventsRes.goals }));
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
