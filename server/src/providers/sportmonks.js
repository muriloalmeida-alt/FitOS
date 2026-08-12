/* Provider "sportmonks" — usa a Sportmonks Football API v3
   (https://www.sportmonks.com/football-api/), fornecedor comercial
   (planos a partir de €29/mês) com cobertura de Brasil/Inglaterra/
   Espanha + histórico, que foi o que levou a essa integração.

   IMPORTANTE — como testei isso: os paths de endpoint e o mecanismo
   de autenticação abaixo foram conferidos contra o cliente PHP oficial
   da comunidade (github.com/tetzilla/sportmonks-football-api) e a
   documentação pública da Sportmonks. MAS eu não tenho como testar
   contra uma resposta real da API nesse ambiente (sem token, e a rede
   daqui não alcança api.sportmonks.com de qualquer forma) — os 3
   pontos abaixo são os que têm MAIOR chance de precisar de um ajuste
   fino assim que você testar com um token de verdade:

   1) EXTRAÇÃO DE ESTATÍSTICA DA TABELA (findDetail): a Sportmonks
      guarda pontos/vitórias/empates/derrotas/gols num array genérico
      "details" (cada item tem um "type" com nome), não em campos
      fixos como pts/v/e/d. Faço a leitura por palavra-chave no nome
      do tipo (ex.: contém "won" pra vitórias) — se a Sportmonks usar
      nomenclatura diferente da esperada, ajuste as palavras-chave em
      findDetail() mais abaixo.
   2) CALENDÁRIO DA TEMPORADA (getFixtures/flattenFixtures): o endpoint
      /schedules/seasons/{id} devolve os jogos agrupados por rodada/
      fase, mas a profundidade exata desse aninhamento pode variar por
      campeonato — flattenFixtures() varre recursivamente western
      procurando por objetos que "parecem" um jogo (têm participants +
      starting_at), então deve funcionar mesmo se o aninhamento for
      diferente do esperado, mas vale conferir contra uma resposta
      real.
   3) LÍDERES DE ARTILHARIA (getPlayersLeaders): só uso o endpoint de
      artilheiros (topscorers) — a Sportmonks pode não devolver
      assistências/cartões/nota nesse mesmo payload; nesse caso esses
      campos ficam 0/null (degradação graciosa, não quebra).

   Cobertura: qualquer liga/temporada que o SEU plano na Sportmonks
   incluir — Brasil/Inglaterra/Espanha e histórico de anos anteriores
   costumam estar nos planos pagos (ver server/src/competitions.js). */

const { sportmonksGet, getQuota } = require("../sportmonksClient");

function hasCredential() { return !!process.env.SPORTMONKS_API_TOKEN; }

// leagueId aqui é o id da liga NA SPORTMONKS (ver providerLeagueIds em
// competitions.js) — diferente da API-Sports, a Sportmonks não aceita
// liga+ano direto nos endpoints de dado: precisa resolver pro
// "seasonId" dela primeiro (um id só que já representa "essa liga,
// esse ano"). Cache em memória — a lista de temporadas de uma liga
// não muda de um dia pro outro.
const seasonIdCache = new Map();
async function resolveSeasonId(leagueId, season) {
  const key = `${leagueId}:${season}`;
  if (seasonIdCache.has(key)) return seasonIdCache.get(key);
  const league = await sportmonksGet(`/leagues/${leagueId}`, { include: "seasons" });
  const seasons = league?.seasons || [];
  const found = seasons.find((s) => String(s.name) === String(season))
    || seasons.find((s) => String(s.starting_at || "").startsWith(String(season)));
  if (!found) {
    const err = new Error(`Temporada ${season} não encontrada pra liga ${leagueId} na Sportmonks (confira as temporadas disponíveis no seu plano).`);
    err.status = 501; err.code = "NOT_SUPPORTED_BY_PROVIDER";
    throw err;
  }
  seasonIdCache.set(key, found.id);
  return found.id;
}

function mapTeam(t) {
  if (!t) return null;
  return {
    id: t.id,
    name: t.name,
    short: (t.short_code || t.name || "???").toUpperCase().slice(0, 3),
    logo: t.image_path || null,
    venue: t.venue ? { name: t.venue.name || null, city: t.venue.city_name || null } : null,
  };
}

// Ver aviso (1) no topo do arquivo — busca por palavra-chave no nome
// do "type" de cada item do array "details" da Sportmonks.
function findDetail(details, ...keywords) {
  const kws = keywords.map((k) => k.toLowerCase());
  const item = (details || []).find((d) => {
    const name = (d.type?.name || d.type?.developer_name || "").toLowerCase();
    return kws.some((k) => name.includes(k));
  });
  return item && item.value != null ? Number(item.value) : null;
}

function mapStandingEntry(entry) {
  const gp = findDetail(entry.details, "goals for", "goal for", "goals scored");
  const gc = findDetail(entry.details, "goals against", "goal against", "goals conceded");
  let sg = findDetail(entry.details, "goal difference", "goals difference");
  if (sg == null && gp != null && gc != null) sg = gp - gc;
  return {
    id: entry.participant?.id ?? entry.participant_id,
    rank: entry.position,
    pts: findDetail(entry.details, "points"),
    j: findDetail(entry.details, "played"),
    v: findDetail(entry.details, "won", "win"),
    e: findDetail(entry.details, "draw"),
    d: findDetail(entry.details, "lost", "lose"),
    gp, gc, sg,
  };
}

// Ver aviso (2) no topo do arquivo. Varre recursivamente o payload de
// /schedules/seasons/{id} (rounds/stages aninhados) coletando qualquer
// objeto que "pareça" um jogo — tem participants e starting_at —
// independente da profundidade exata do aninhamento.
function flattenFixtures(node, round, acc) {
  if (Array.isArray(node)) { node.forEach((n) => flattenFixtures(n, round, acc)); return acc; }
  if (!node || typeof node !== "object") return acc;
  if (Array.isArray(node.participants) && node.starting_at) {
    acc.push(node);
    return acc;
  }
  const nextRound = node.name && (node.round_id || node.type === "round") ? node : round;
  ["fixtures", "rounds", "stages", "data"].forEach((key) => {
    if (node[key]) flattenFixtures(node[key], nextRound, acc);
  });
  return acc;
}

function mapStatus(shortName) {
  if (["FT", "AET", "PEN", "AWARDED"].includes(shortName)) return "FT";
  if (shortName === "NS" || !shortName) return "NS";
  return "LIVE"; // 1H, HT, 2H, ET etc.
}

function mapFixture(fx) {
  const home = (fx.participants || []).find((p) => p.meta?.location === "home");
  const away = (fx.participants || []).find((p) => p.meta?.location === "away");
  const scoreFor = (participantId) => {
    const s = (fx.scores || []).find((sc) => sc.participant_id === participantId && sc.description === "CURRENT");
    return s?.score?.goals ?? null;
  };
  return {
    id: fx.id,
    date: fx.starting_at || null,
    status: mapStatus(fx.state?.short_name),
    round: Number(fx.round?.name) || null,
    home: home?.id ?? null,
    away: away?.id ?? null,
    gh: home ? scoreFor(home.id) : null,
    ga: away ? scoreFor(away.id) : null,
    venue: fx.venue ? { name: fx.venue.name || null, city: fx.venue.city_name || null } : null,
  };
}

// Ver aviso (3) no topo do arquivo — só o que o endpoint de
// artilheiros devolve.
function mapPlayerFromTopscorer(item) {
  const p = item.player;
  if (!p) return null;
  return {
    id: p.id,
    name: p.display_name || p.name,
    photo: p.image_path || null,
    teamId: item.participant_id ?? null,
    position: p.position?.name || null,
    games: null,
    goals: item.total ?? null,
    assists: null,
    yellow: null,
    red: null,
    rating: null,
  };
}

function mapPlayerFromSquad(item) {
  const p = item.player;
  if (!p) return null;
  return {
    id: p.id,
    name: p.display_name || p.name,
    photo: p.image_path || null,
    teamId: item.team_id ?? null,
    position: p.position?.name || null,
    games: item.appearances ?? null,
    goals: item.goals ?? null,
    assists: item.assists ?? null,
    yellow: item.yellowcards ?? null,
    red: item.redcards ?? null,
    rating: null,
  };
}

async function searchLeagues({ name }) {
  const leagues = await sportmonksGet("/leagues/search/" + encodeURIComponent(name || ""), { include: "country;seasons" });
  return (Array.isArray(leagues) ? leagues : [leagues]).filter(Boolean).map((l) => ({
    id: l.id, name: l.name, type: "League",
    country: l.country?.name || null,
    seasons: (l.seasons || []).map((s) => s.name),
  }));
}

async function getTeams({ leagueId, season }) {
  const seasonId = await resolveSeasonId(leagueId, season);
  const teams = await sportmonksGet(`/teams/seasons/${seasonId}`, { include: "venue" });
  return (teams || []).map(mapTeam).filter(Boolean);
}

async function getStandings({ leagueId, season }) {
  const seasonId = await resolveSeasonId(leagueId, season);
  const standings = await sportmonksGet(`/standings/seasons/${seasonId}`, { include: "participant;details.type" });
  return (standings || []).map(mapStandingEntry);
}

async function getFixtures({ leagueId, season }) {
  const seasonId = await resolveSeasonId(leagueId, season);
  const schedule = await sportmonksGet(`/schedules/seasons/${seasonId}`, { include: "participants;scores;state;round;venue" });
  return flattenFixtures(schedule, null, []).map(mapFixture);
}

async function getPlayersLeaders({ leagueId, season }) {
  const seasonId = await resolveSeasonId(leagueId, season);
  const topscorers = await sportmonksGet(`/topscorers/seasons/${seasonId}`, { include: "player.position" });
  const byId = new Map();
  (topscorers || []).forEach((item) => {
    const p = mapPlayerFromTopscorer(item);
    if (p) byId.set(p.id, p);
  });
  return Array.from(byId.values());
}

async function getTeamPlayers({ teamId, season }) {
  const squad = season
    ? await sportmonksGet(`/squads/seasons/${season}/teams/${teamId}`, { include: "player.position" })
    : await sportmonksGet(`/squads/teams/${teamId}`, { include: "player.position" });
  const byId = new Map();
  (squad || []).forEach((item) => {
    const p = mapPlayerFromSquad(item);
    if (p) byId.set(p.id, p);
  });
  return Array.from(byId.values());
}

async function getPlayer({ playerId }) {
  const p = await sportmonksGet(`/players/${playerId}`, { include: "position" });
  if (!p) return null;
  return {
    id: p.id, name: p.display_name || p.name, photo: p.image_path || null,
    teamId: null, position: p.position?.name || null,
    games: null, goals: null, assists: null, yellow: null, red: null, rating: null,
  };
}

const STAT_TYPE_KEYWORDS = {
  posse: ["possession"],
  finalizacoes: ["shots total", "total shots"],
  escanteios: ["corners"],
  amarelos: ["yellowcards", "yellow cards"],
  vermelhos: ["redcards", "red cards"],
  passesCertos: ["passes %", "accurate passes"],
};

async function getFixtureStatistics({ fixtureId, homeId, awayId }) {
  const fx = await sportmonksGet(`/fixtures/${fixtureId}`, { include: "statistics.type" });
  const statsFor = (teamId, keywords) => {
    const block = (fx?.statistics || []).find((s) => s.participant_id === teamId);
    const found = (block?.details || block?.type ? [block] : (fx?.statistics || []).filter((s) => s.participant_id === teamId))
      .find((s) => keywords.some((k) => (s.type?.name || "").toLowerCase().includes(k)));
    return found?.value ? Number(found.value) : 0;
  };
  const out = {};
  Object.entries(STAT_TYPE_KEYWORDS).forEach(([key, keywords]) => {
    out[key] = [statsFor(homeId, keywords), statsFor(awayId, keywords)];
  });
  return out;
}

async function getFixtureEvents({ fixtureId }) {
  const fx = await sportmonksGet(`/fixtures/${fixtureId}`, { include: "events.type;events.player" });
  const events = fx?.events || [];
  const goals = events
    .filter((e) => (e.type?.name || "").toLowerCase().includes("goal"))
    .map((e) => ({ team: e.participant_id, min: e.minute, playerId: e.player_id ?? null, player: e.player?.display_name || "Desconhecido", detail: e.type?.name || null }))
    .sort((a, b) => a.min - b.min);
  const substitutions = events
    .filter((e) => (e.type?.name || "").toLowerCase().includes("substitution"))
    .map((e) => ({ team: e.participant_id, min: e.minute, outId: e.related_player_id ?? null, out: "Desconhecido", inId: e.player_id ?? null, in: e.player?.display_name || "Desconhecido" }))
    .sort((a, b) => a.min - b.min);
  return { goals, substitutions };
}

async function getFixtureLineups({ fixtureId }) {
  const fx = await sportmonksGet(`/fixtures/${fixtureId}`, { include: "lineups.player;lineups.type" });
  const out = {};
  (fx?.lineups || []).forEach((entry) => {
    const teamId = entry.team_id;
    if (!teamId) return;
    if (!out[teamId]) out[teamId] = { formation: fx?.formations?.find((f) => f.participant_id === teamId)?.formation || null, coach: null, startXI: [], substitutes: [] };
    const player = { id: entry.player_id ?? null, name: entry.player?.display_name || "Desconhecido", number: entry.jersey_number ?? null, pos: entry.position?.name || null };
    if ((entry.type?.name || "").toLowerCase().includes("bench")) out[teamId].substitutes.push(player);
    else out[teamId].startXI.push(player);
  });
  return out;
}

async function getFixtureOdds({ fixtureId }) {
  const odds = await sportmonksGet(`/odds/pre-match/fixtures/${fixtureId}`, { include: "market;bookmaker" });
  const market = (odds || []).filter((o) => /match winner|1x2|full time result/i.test(o.market?.name || ""));
  if (!market.length) return null;
  const pick = (label) => {
    const o = market.find((m) => new RegExp(`^${label}$`, "i").test(m.label || ""));
    return o ? parseFloat(o.value) : null;
  };
  return {
    bookmaker: market[0]?.bookmaker?.name || null,
    home: pick("home") ?? pick("1"),
    draw: pick("draw") ?? pick("x"),
    away: pick("away") ?? pick("2"),
  };
}

module.exports = {
  name: "sportmonks",
  requiresKey: true,
  hasCredential,
  searchLeagues, getTeams, getStandings, getFixtures,
  getPlayersLeaders, getTeamPlayers, getPlayer,
  getFixtureStatistics, getFixtureEvents, getFixtureLineups, getFixtureOdds,
  getQuota,
};
