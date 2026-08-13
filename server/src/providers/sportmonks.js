/* Provider "sportmonks" — usa a Sportmonks Football API v3
   (https://www.sportmonks.com/football-api/), fornecedor comercial
   (planos a partir de €29/mês) com cobertura de Brasil/Inglaterra/
   Espanha + histórico, que foi o que levou a essa integração.

   HISTÓRICO DE AJUSTE (útil se aparecer outro erro parecido): a 1ª
   versão desse arquivo usava "includes aninhados" (sintaxe
   "relacao.subrelacao", ex.: "details.type", "player.position") em
   vários lugares — e a Sportmonks rejeitou com "You may not use more
   than 0 nested includes in this endpoint" assim que testado com um
   token de verdade (alguns endpoints da Sportmonks simplesmente não
   aceitam nenhum nível de aninhamento). A correção: em vez de pedir
   pra Sportmonks já devolver o nome resolvido de cada "tipo" via
   include aninhado, uso os IDS NUMÉRICOS FIXOS de cada tipo (ver
   STANDING_TYPE/EVENT_TYPE abaixo — conferidos via documentação
   pública, são constantes estáveis da Sportmonks) direto nos campos
   type_id que já vêm nos includes FLAT (sem ponto), sem precisar
   resolver nome nenhum.

   AJUSTE 2 (13/08/2026): o próprio getFixtures batia no MESMO erro
   "0 nested includes" contra /schedules/seasons/{id} MESMO com include
   flat (sem ponto nenhum: "participants;scores;state;round;venue") —
   confirmado com log real do Railway. Explicação: esse endpoint
   organiza a resposta por rodada/fase (season -> stage -> round ->
   fixtures), então pedir uma relação de NÍVEL DE JOGO (participants,
   scores...) já significa descer 1+ nível dentro dessa árvore, mesmo
   sem ponto na sintaxe — não é sobre a sintaxe do include, é sobre a
   PROFUNDIDADE do dado pedido em relação à raiz do endpoint. Troquei
   getFixtures pra usar /fixtures/between/{de}/{até} (endpoint de
   LISTAGEM DE JOGOS — não de calendário por temporada), filtrado por
   liga (filters=fixtureLeagues:ID) e pelas datas de início/fim da
   temporada (já vêm do mesmo /leagues/{id}?include=seasons de sempre)
   — nesse endpoint, participants/scores/etc. SÃO relações diretas do
   jogo (não precisam descer nenhum nível), o mesmo padrão que já
   funciona em getFixtureStatistics/Events/Lineups (/fixtures/{id}).
   Paginado via sportmonksGetAll (cursor, ver sportmonksClient.js) —
   uma temporada inteira passa fácil dos 25 itens por página padrão da
   Sportmonks. MESMA LIÇÃO se aparecer de novo em outro endpoint:
   confira se a relação pedida é de 1º nível DAQUELE endpoint
   específico, não só se a sintaxe do include tem ponto ou não.

   AJUSTE 3 (13/08/2026, mesmo dia): a troca acima resolveu o "nested
   includes", mas /fixtures/between/{de}/{até} tem outro limite
   documentado — MÁXIMO 100 DIAS entre "de" e "até" ("Invalid request
   parameters", confirmado com log real de novo). Uma temporada
   brasileira inteira (~10-11 meses) estoura isso fácil. Correção:
   chunkDateRange() abaixo quebra o intervalo da temporada em pedaços
   de até 100 dias, getFixtures dispara 1 requisição (já paginada) por
   pedaço e junta tudo (dedupe por id, embora não devesse haver
   sobreposição já que os pedaços são contíguos sem overlap).

   IMPORTANTE — o que ainda não foi testado contra uma resposta real:
   1) ESTATÍSTICA DE PARTIDA (getFixtureStatistics) e ESCALAÇÃO
      (getFixtureLineups): não tenho os type_id numéricos exatos da
      Sportmonks pra "posse de bola"/"escanteios"/"titular vs banco"
      confirmados (ao contrário dos de tabela e eventos, que estão
      confirmados abaixo) — a extração tenta múltiplas formas de ler o
      tipo (campo "type" direto, ou nome, com fallback) mas pode
      precisar de ajuste. Se vier tudo zerado, esse é o lugar.
   2) LÍDERES DE ARTILHARIA (getPlayersLeaders): só o endpoint de
      artilheiros — pode não trazer assistências/cartões/nota; nesse
      caso ficam null (degradação graciosa).

   Cobertura: qualquer liga/temporada que o SEU plano na Sportmonks
   incluir (ver server/src/competitions.js). */

const { sportmonksGet, sportmonksGetAll, getQuota } = require("../sportmonksClient");

function hasCredential() { return !!process.env.SPORTMONKS_API_TOKEN; }

// Ids numéricos fixos da Sportmonks (não mudam, são constantes da
// plataforma) — conferidos via documentação pública. Usar isso em vez
// de nome evita depender de includes aninhados (ver aviso no topo).
const STANDING_TYPE = { PLAYED: 129, WON: 130, DRAW: 131, LOST: 132, GOALS_FOR: 133, GOALS_AGAINST: 134, GOAL_DIFF: 188 };
const EVENT_TYPE = { GOAL: 14, OWN_GOAL: 15, PENALTY: 16, MISSED_PENALTY: 17, SUBSTITUTION: 18, YELLOW_CARD: 19, RED_CARD: 20 };

// leagueId aqui é o id da liga NA SPORTMONKS (ver providerLeagueIds em
// competitions.js) — diferente da API-Sports, a Sportmonks não aceita
// liga+ano direto nos endpoints de dado: precisa resolver pro
// "seasonId" dela primeiro (um id só que já representa "essa liga,
// esse ano"). Cache em memória — a lista de temporadas de uma liga
// não muda de um dia pro outro. Guarda o objeto INTEIRO da temporada
// (não só o id) porque getFixtures também precisa de starting_at/
// ending_at (ver AJUSTE 2 no topo do arquivo).
const seasonCache = new Map();
async function resolveSeason(leagueId, season) {
  const key = `${leagueId}:${season}`;
  if (seasonCache.has(key)) return seasonCache.get(key);
  const league = await sportmonksGet(`/leagues/${leagueId}`, { include: "seasons" });
  const seasons = league?.seasons || [];
  const found = seasons.find((s) => String(s.name) === String(season))
    || seasons.find((s) => String(s.starting_at || "").startsWith(String(season)));
  if (!found) {
    const err = new Error(`Temporada ${season} não encontrada pra liga ${leagueId} na Sportmonks (confira as temporadas disponíveis no seu plano).`);
    err.status = 501; err.code = "NOT_SUPPORTED_BY_PROVIDER";
    throw err;
  }
  seasonCache.set(key, found);
  return found;
}
async function resolveSeasonId(leagueId, season) {
  const s = await resolveSeason(leagueId, season);
  return s.id;
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

// Busca um item do array "details" da Sportmonks pelo type_id numérico
// (ver STANDING_TYPE acima) — sem depender de include aninhado.
function findDetailById(details, typeId) {
  const item = (details || []).find((d) => d.type_id === typeId);
  return item && item.value != null ? Number(item.value) : null;
}

function mapStandingEntry(entry) {
  const gp = findDetailById(entry.details, STANDING_TYPE.GOALS_FOR);
  const gc = findDetailById(entry.details, STANDING_TYPE.GOALS_AGAINST);
  let sg = findDetailById(entry.details, STANDING_TYPE.GOAL_DIFF);
  if (sg == null && gp != null && gc != null) sg = gp - gc;
  return {
    id: entry.participant?.id ?? entry.participant_id,
    rank: entry.position,
    // "points" costuma vir como campo direto na Sportmonks (não
    // dentro de "details") — fallback pro type_id só por precaução.
    pts: entry.points ?? findDetailById(entry.details, 187),
    j: findDetailById(entry.details, STANDING_TYPE.PLAYED),
    v: findDetailById(entry.details, STANDING_TYPE.WON),
    e: findDetailById(entry.details, STANDING_TYPE.DRAW),
    d: findDetailById(entry.details, STANDING_TYPE.LOST),
    gp, gc, sg,
  };
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
// artilheiros devolve, sem include aninhado (então sem nome de
// posição resolvido — fica null).
function mapPlayerFromTopscorer(item) {
  const p = item.player;
  if (!p) return null;
  return {
    id: p.id,
    name: p.display_name || p.name,
    photo: p.image_path || null,
    teamId: item.participant_id ?? null,
    position: null,
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
    position: null,
    games: item.appearances ?? null,
    goals: item.goals ?? null,
    assists: item.assists ?? null,
    yellow: item.yellowcards ?? null,
    red: item.redcards ?? null,
    rating: null,
  };
}

async function searchLeagues({ name }) {
  const leagues = await sportmonksGet("/leagues/search/" + encodeURIComponent(name || ""), { include: "country" });
  return (Array.isArray(leagues) ? leagues : [leagues]).filter(Boolean).map((l) => ({
    id: l.id, name: l.name, type: "League",
    country: l.country?.name || null,
    seasons: [],
  }));
}

async function getTeams({ leagueId, season }) {
  const seasonId = await resolveSeasonId(leagueId, season);
  const teams = await sportmonksGet(`/teams/seasons/${seasonId}`, { include: "venue" });
  return (teams || []).map(mapTeam).filter(Boolean);
}

async function getStandings({ leagueId, season }) {
  const seasonId = await resolveSeasonId(leagueId, season);
  const standings = await sportmonksGet(`/standings/seasons/${seasonId}`, { include: "participant;details" });
  return (standings || []).map(mapStandingEntry);
}

// Ver AJUSTE 3 no topo do arquivo — /fixtures/between/{de}/{até} só
// aceita até 100 dias entre as duas datas; quebra [from, to] numa
// lista de pedaços contíguos de até maxDays cada (o último pedaço fica
// menor, do jeito que sobrar). Datas em "YYYY-MM-DD" (mesmo formato
// que a Sportmonks espera na URL e que starting_at/ending_at já vêm).
function chunkDateRange(fromStr, toStr, maxDays = 100) {
  const chunks = [];
  const to = new Date(`${toStr}T00:00:00Z`);
  let cursor = new Date(`${fromStr}T00:00:00Z`);
  while (cursor <= to) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + maxDays - 1);
    if (chunkEnd > to) chunkEnd.setTime(to.getTime());
    chunks.push([cursor.toISOString().slice(0, 10), chunkEnd.toISOString().slice(0, 10)]);
    cursor = new Date(chunkEnd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return chunks;
}

// Ver AJUSTE 2 e 3 no topo do arquivo — /fixtures/between/{de}/{até}
// filtrado por liga, não /schedules/seasons/{id} (que rejeitava
// include de nível de jogo com "0 nested includes"); quebrado em
// pedaços de até 100 dias (limite da Sportmonks pra esse endpoint) e
// cada pedaço já paginado (uma temporada inteira, ~380 jogos num
// campeonato de 20 times, passa fácil do per_page padrão).
async function getFixtures({ leagueId, season }) {
  const s = await resolveSeason(leagueId, season);
  const start = String(s.starting_at || "").slice(0, 10);
  const end = String(s.ending_at || "").slice(0, 10);
  if (!start || !end) {
    const err = new Error(`Temporada ${season} da liga ${leagueId} não tem starting_at/ending_at na Sportmonks — não dá pra montar o calendário.`);
    err.status = 501; err.code = "NOT_SUPPORTED_BY_PROVIDER";
    throw err;
  }
  const chunks = chunkDateRange(start, end, 100);
  const perChunk = await Promise.all(chunks.map(([from, to]) =>
    sportmonksGetAll(`/fixtures/between/${from}/${to}`, {
      include: "participants;scores;state;round;venue",
      filters: `fixtureLeagues:${leagueId}`,
    })
  ));
  const byId = new Map();
  perChunk.flat().forEach((fx) => byId.set(fx.id, fx));
  return Array.from(byId.values()).map(mapFixture);
}

// sportmonksGetAll (paginado) — artilharia pode ter mais de 25
// jogadores com gol na temporada, que é o per_page padrão da
// Sportmonks.
async function getPlayersLeaders({ leagueId, season }) {
  const seasonId = await resolveSeasonId(leagueId, season);
  const topscorers = await sportmonksGetAll(`/topscorers/seasons/${seasonId}`, { include: "player" });
  const byId = new Map();
  topscorers.forEach((item) => {
    const p = mapPlayerFromTopscorer(item);
    if (p) byId.set(p.id, p);
  });
  return Array.from(byId.values());
}

// BUG CORRIGIDO (13/08/2026): essa função usava
// /squads/seasons/{season}/teams/{teamId} sempre que "season" vinha
// preenchido (que é sempre — a rota /api/teams/:id/players em
// server.js exige season) — só que "season" aqui chega como o ANO
// (ex.: "2026", o mesmo valor cru do LIVE_SEASON), não como o
// seasonId NUMÉRICO INTERNO da Sportmonks que esse endpoint espera
// (ex.: 26763, ver resolveSeason acima) — e essa função nem recebe
// leagueId (ver contrato em providers/index.js) pra poder resolver o
// id certo. Resultado: sempre batia num id de temporada que não
// existe, a Sportmonks respondia com uma lista vazia (sem erro
// nenhum pra logar) e o elenco aparecia como "não disponível" sem
// pista nenhuma nos logs. Correção: usar sempre /squads/teams/{id}
// (elenco ATUAL do time, sem precisar de season/seasonId nenhum) — é
// exatamente o que a tela de "Elenco" mostra mesmo (o elenco de
// agora, não um histórico por temporada).
// sportmonksGetAll (paginado) — elenco com reservas facilmente passa
// dos 25 itens por página padrão da Sportmonks.
async function getTeamPlayers({ teamId }) {
  const squad = await sportmonksGetAll(`/squads/teams/${teamId}`, { include: "player" });
  const byId = new Map();
  squad.forEach((item) => {
    const p = mapPlayerFromSquad(item);
    if (p) byId.set(p.id, p);
  });
  return Array.from(byId.values());
}

async function getPlayer({ playerId }) {
  const p = await sportmonksGet(`/players/${playerId}`, {});
  if (!p) return null;
  return {
    id: p.id, name: p.display_name || p.name, photo: p.image_path || null,
    teamId: null, position: null,
    games: null, goals: null, assists: null, yellow: null, red: null, rating: null,
  };
}

// Ver aviso (1) no topo do arquivo — sem type_id confirmado pra
// estatística de partida ainda, tenta ler o nome do tipo de qualquer
// jeito que a Sportmonks devolver (campo "type" direto como string,
// ou objeto {name}) e casa por palavra-chave.
const STAT_TYPE_KEYWORDS = {
  posse: ["possession"],
  finalizacoes: ["shots total", "total shots"],
  escanteios: ["corners"],
  amarelos: ["yellowcards", "yellow cards"],
  vermelhos: ["redcards", "red cards"],
  passesCertos: ["passes %", "accurate passes"],
};
function statTypeName(s) {
  if (typeof s.type === "string") return s.type.toLowerCase();
  return (s.type?.name || "").toLowerCase();
}

async function getFixtureStatistics({ fixtureId, homeId, awayId }) {
  const fx = await sportmonksGet(`/fixtures/${fixtureId}`, { include: "statistics" });
  const stats = fx?.statistics || [];
  const statsFor = (teamId, keywords) => {
    const found = stats.find((s) =>
      (s.participant_id === teamId || s.location === (teamId === homeId ? "home" : "away"))
      && keywords.some((k) => statTypeName(s).includes(k))
    );
    return found?.value != null ? Number(found.value) : 0;
  };
  const out = {};
  Object.entries(STAT_TYPE_KEYWORDS).forEach(([key, keywords]) => {
    out[key] = [statsFor(homeId, keywords), statsFor(awayId, keywords)];
  });
  return out;
}

async function getFixtureEvents({ fixtureId }) {
  const fx = await sportmonksGet(`/fixtures/${fixtureId}`, { include: "events" });
  const events = fx?.events || [];
  const goals = events
    .filter((e) => [EVENT_TYPE.GOAL, EVENT_TYPE.OWN_GOAL, EVENT_TYPE.PENALTY].includes(e.type_id))
    .map((e) => ({ team: e.participant_id, min: e.minute, playerId: e.player_id ?? null, player: e.player_name || "Desconhecido", detail: e.type_id === EVENT_TYPE.OWN_GOAL ? "Own Goal" : e.type_id === EVENT_TYPE.PENALTY ? "Penalty" : "Normal Goal" }))
    .sort((a, b) => a.min - b.min);
  const substitutions = events
    .filter((e) => e.type_id === EVENT_TYPE.SUBSTITUTION)
    .map((e) => ({ team: e.participant_id, min: e.minute, outId: e.related_player_id ?? null, out: e.related_player_name || "Desconhecido", inId: e.player_id ?? null, in: e.player_name || "Desconhecido" }))
    .sort((a, b) => a.min - b.min);
  return { goals, substitutions };
}

async function getFixtureLineups({ fixtureId }) {
  const fx = await sportmonksGet(`/fixtures/${fixtureId}`, { include: "lineups" });
  const out = {};
  (fx?.lineups || []).forEach((entry) => {
    const teamId = entry.team_id;
    if (!teamId) return;
    if (!out[teamId]) out[teamId] = { formation: null, coach: null, startXI: [], substitutes: [] };
    const player = { id: entry.player_id ?? null, name: entry.player_name || "Desconhecido", number: entry.jersey_number ?? null, pos: null };
    // formation_position preenchido = titular; null/0 costuma ser banco
    // na Sportmonks — sem type_id confirmado, ver aviso (1) no topo.
    if (entry.formation_position) out[teamId].startXI.push(player);
    else out[teamId].substitutes.push(player);
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
