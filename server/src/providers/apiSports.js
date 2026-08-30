/* Provider "api-sports" — implementa a interface comum descrita em
   providers/index.js usando a API-Sports (v3.football.api-sports.io).
   É o único fornecedor que existe hoje; junta o cliente HTTP fino
   (../apiSports.js) com os mapeadores de formato (../adapter.js) numa
   interface só, já devolvendo dado no formato interno do app —
   server.js nunca mais fala com apiSportsGet/mapX diretamente, só com
   essa interface (ver providers/index.js). */

const { apiSportsGet, getQuota } = require("../apiSports");
const {
  mapTeam, mapStandingRow, mapFixture, mapStatistics,
  mapEvents, mapSubstitutions, mapLineups, mapOdds, mapPlayerEntry,
  normalizeLogoUrl,
} = require("../adapter");

async function searchLeagues({ name }) {
  const data = await apiSportsGet("/leagues", { search: name });
  return data.map((l) => ({
    id: l.league.id, name: l.league.name, type: l.league.type,
    country: l.country.name, seasons: l.seasons.map((s) => s.year),
  }));
}

async function getTeams({ leagueId, season }) {
  const data = await apiSportsGet("/teams", { league: leagueId, season });
  return data.map(mapTeam);
}

async function getStandings({ leagueId, season }) {
  const data = await apiSportsGet("/standings", { league: leagueId, season });
  const table = data?.[0]?.league?.standings?.[0] || [];
  return table.map(mapStandingRow);
}

async function getFixtures({ leagueId, season }) {
  const data = await apiSportsGet("/fixtures", { league: leagueId, season });
  return data.map(mapFixture);
}

// 4 chamadas baratas (1 página cada, ~20 jogadores) em vez de paginar
// /players inteiro (custaria dezenas de requisições pra cobrir o
// elenco completo da liga). Cada item já vem com o bloco de
// estatísticas completo da temporada, então dá pra montar uma lista
// única com gols+assistências+cartões+nota mesmo sem uma chamada
// dedicada de "nota por jogo".
async function getPlayersLeaders({ leagueId, season }) {
  const [scorers, assists, yellows, reds] = await Promise.all([
    apiSportsGet("/players/topscorers", { league: leagueId, season }),
    apiSportsGet("/players/topassists", { league: leagueId, season }),
    apiSportsGet("/players/topyellowcards", { league: leagueId, season }),
    apiSportsGet("/players/topredcards", { league: leagueId, season }),
  ]);
  const byId = new Map();
  [...scorers, ...assists, ...yellows, ...reds].forEach((item) => {
    const p = mapPlayerEntry(item);
    if (p) byId.set(p.id, p);
  });
  return Array.from(byId.values());
}

// BUG CORRIGIDO (pedido do usuário: "goleiro Santos e Mycael não
// aparecem no elenco do Athletico PR"): a causa NUNCA foi paginação —
// era a FONTE errada. /players?team=X&season=Y é um endpoint de
// ESTATÍSTICA por temporada: só devolve quem já tem pelo menos 1 jogo
// registrado por aquele time NAQUELA temporada (mapPlayerEntry, ver
// adapter.js, descarta todo item sem "statistics" — if(!s) return
// null). Reserva que ainda não entrou em campo (típico pra 2º/3º
// goleiro) nunca aparecia ali, não importa quantas páginas a gente
// buscasse.
//
// A fonte certa pro ELENCO em si — quem está registrado no time
// AGORA, jogando ou não — é /players/squads?team=X: devolve todo
// mundo (nome/idade/número/posição), sem depender de estatística
// nenhuma. É essa que vira a base da lista agora; /players?season=Y
// continua sendo usado, só que como ENRIQUECIMENTO por cima (games/
// goals/assists/nota pra quem já tiver) — quem não tiver estatística
// nenhuma continua aparecendo no elenco, só com esses números
// zerados/vazios em vez de sumir da lista.
async function getPlayerStatsMap(teamId, season) {
  const byId = new Map();
  const maxPages = 6; // trava de segurança — nunca deveria chegar perto disso
  for (let page = 1; page <= maxPages; page++) {
    const items = await apiSportsGet("/players", { team: teamId, season, page }).catch(() => []);
    if (!items.length) break;
    items.forEach((item) => {
      const p = mapPlayerEntry(item);
      if (p) byId.set(p.id, p);
    });
    if (items.length < 20) break; // API-Sports pagina de 20 em 20 — página não-cheia já é a última
  }
  return byId;
}
async function getTeamPlayers({ teamId, season }) {
  const [squadResp, statsById] = await Promise.all([
    apiSportsGet("/players/squads", { team: teamId }).catch(() => []),
    getPlayerStatsMap(teamId, season),
  ]);
  const squad = squadResp?.[0]?.players || [];
  if (!squad.length) {
    // /players/squads veio vazio (plano sem cobertura desse endpoint
    // nesse host, ou time sem elenco cadastrado ainda) — cai pro que
    // a estatística tiver, melhor um elenco incompleto do que nenhum.
    return Array.from(statsById.values());
  }
  // AJUSTE (pedido do usuário: idade real de verdade, não sorteada) —
  // /players/squads devolve "age" pronto pra CADA jogador do elenco
  // (comentário no topo desse arquivo já citava isso, só nunca tinha
  // sido lido) — prioriza esse valor sobre o de /players?season (que
  // também tem age agora, ver mapPlayerEntry, mas pode vir de uma
  // temporada mais antiga se o jogador não tiver estatística na atual).
  return squad.map((sp) => {
    const statEntry = statsById.get(sp.id);
    const age = Number.isFinite(sp.age) ? sp.age : (statEntry ? statEntry.age : null);
    if (statEntry) return { ...statEntry, age };
    return {
      id: sp.id,
      name: sp.name,
      photo: normalizeLogoUrl(sp.photo),
      teamId: Number(teamId),
      position: sp.position || null,
      age,
      games: 0, goals: 0, assists: 0, yellow: 0, red: 0, rating: null,
    };
  });
}

async function getPlayer({ playerId, season }) {
  const resp = await apiSportsGet("/players", { id: playerId, season });
  const item = (resp || [])[0];
  return item ? mapPlayerEntry(item) : null;
}

async function getFixtureStatistics({ fixtureId, homeId, awayId }) {
  const data = await apiSportsGet("/fixtures/statistics", { fixture: fixtureId });
  return mapStatistics(data, homeId, awayId);
}

// Gols e substituições vêm do mesmo endpoint (/fixtures/events) — só
// filtram tipos diferentes do mesmo payload, então uma chamada só já
// serve os dois.
async function getFixtureEvents({ fixtureId }) {
  const data = await apiSportsGet("/fixtures/events", { fixture: fixtureId });
  return { goals: mapEvents(data), substitutions: mapSubstitutions(data) };
}

async function getFixtureLineups({ fixtureId }) {
  const data = await apiSportsGet("/fixtures/lineups", { fixture: fixtureId });
  return mapLineups(data);
}

async function getFixtureOdds({ fixtureId }) {
  const data = await apiSportsGet("/odds", { fixture: fixtureId });
  return mapOdds(data);
}

// A API-Sports não tem um recurso equivalente ao "tvStations" da
// Sportmonks — devolve null sempre (ver contrato em
// providers/index.js: GET /api/broadcast já trata isso como "sem essa
// fonte, tenta a próxima" — EPG/TheSportsDB — sem quebrar a página).
async function getFixtureBroadcast() { return null; }

// AJUSTE (26/08/2026, pedido do usuário: jogos ao vivo na aba Jogos —
// ver AJUSTE 7 equivalente em providers/sportmonks.js). live=all
// devolve TODOS os jogos em andamento agora, de qualquer liga do
// plano contratado — filtra por liga aqui (fx.league.id), igual o
// filtro por fx.league_id feito no lado da Sportmonks. mapFixture (já
// importado de ../adapter) cobre participants/round/gols; só falta
// forçar status="LIVE" (por definição desse endpoint) e ler o minuto
// corrido direto de fixture.status.elapsed (a API-Sports, diferente da
// Sportmonks, já devolve isso pronto, sem precisar montar a partir de
// "periods").
async function getLiveScores({ leagueId }) {
  const data = await apiSportsGet("/fixtures", { live: "all" });
  return (data || [])
    .filter((fx) => String(fx.league?.id) === String(leagueId))
    .map((fx) => ({
      ...mapFixture(fx),
      status: "LIVE",
      phase: fx.fixture?.status?.short || null,
      elapsed: fx.fixture?.status?.elapsed ?? null,
    }));
}

// Precisa de API_SPORTS_KEY configurada pra funcionar — ver
// hasCredential()/liveModeEnabled() em server.js.
function hasCredential() { return !!process.env.API_SPORTS_KEY; }

module.exports = {
  name: "api-sports",
  requiresKey: true,
  hasCredential,
  searchLeagues, getTeams, getStandings, getFixtures,
  getPlayersLeaders, getTeamPlayers, getPlayer,
  getFixtureStatistics, getFixtureEvents, getFixtureLineups, getFixtureOdds,
  getFixtureBroadcast, getLiveScores,
  getQuota,
};
