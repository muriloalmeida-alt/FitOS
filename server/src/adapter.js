/* Traduz as respostas "cruas" da API-Sports para os formatos que o
   front-end já sabe consumir (mesmas chaves usadas no motor de
   simulação: home/away/gh/ga/round, stats.posse = [casa, fora] etc). */

function parseRoundNumber(roundStr = "") {
  const m = roundStr.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

// Garante um esquema (https:) na URL do logo. Algumas respostas da
// API-Sports trazem o campo "logo" sem "https://" na frente (ex:
// "media.api-sports.io/football/teams/118.png" ou
// "//media.api-sports.io/..."), o que faz o navegador tratar o valor
// como caminho relativo (ou, no caso "//", tentar resolver o host
// certo mas ainda assim falhar em alguns ambientes) — resultado: o
// brasão nunca carrega. Normalizamos aqui, uma vez só, na origem.
function normalizeLogoUrl(url) {
  if (!url) return null;
  const trimmed = String(url).trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return `https://${trimmed}`;
}

function mapTeam(item) {
  const t = item.team;
  const v = item.venue;
  return {
    id: t.id,
    name: t.name,
    short: (t.code || t.name.replace(/[^A-Za-zÀ-ú]/g, "").slice(0, 3)).toUpperCase(),
    logo: normalizeLogoUrl(t.logo),
    venue: v && v.name ? { name: v.name, city: v.city || null } : null,
  };
}

function mapStandingRow(row) {
  return {
    id: row.team.id,
    rank: row.rank,
    pts: row.points,
    j: row.all.played,
    v: row.all.win,
    e: row.all.draw,
    d: row.all.lose,
    gp: row.all.goals.for,
    gc: row.all.goals.against,
    sg: row.goalsDiff,
  };
}

function mapFixture(fx) {
  const venue = fx.fixture.venue;
  return {
    id: fx.fixture.id,
    date: fx.fixture.date,
    status: fx.fixture.status.short, // NS, FT, PST, POSTPONED, CANC, AET, PEN...
    round: parseRoundNumber(fx.league.round),
    home: fx.teams.home.id,
    away: fx.teams.away.id,
    gh: fx.goals.home,
    ga: fx.goals.away,
    venue: venue && venue.name ? { name: venue.name, city: venue.city || null } : null,
  };
}

const STAT_TYPES = {
  posse: "Ball Possession",
  finalizacoes: "Total Shots",
  escanteios: "Corner Kicks",
  amarelos: "Yellow Cards",
  vermelhos: "Red Cards",
  passesCertos: "Passes %", // nem toda liga/plano tem esse dado — vira null e o front estima
};

function findStatValue(list, type) {
  const item = (list || []).find(s => s.type === type);
  if (!item || item.value === null || item.value === undefined) return 0;
  if (typeof item.value === "string" && item.value.includes("%")) return parseInt(item.value, 10) || 0;
  return typeof item.value === "number" ? item.value : parseInt(item.value, 10) || 0;
}

// response = array com (até) 2 objetos: [{team:{id}, statistics:[...]}, {...}]
function mapStatistics(response, homeTeamId, awayTeamId) {
  const homeBlock = (response || []).find(b => b.team.id === homeTeamId);
  const awayBlock = (response || []).find(b => b.team.id === awayTeamId);
  const out = {};
  Object.entries(STAT_TYPES).forEach(([key, apiType]) => {
    out[key] = [
      findStatValue(homeBlock && homeBlock.statistics, apiType),
      findStatValue(awayBlock && awayBlock.statistics, apiType),
    ];
  });
  return out;
}

// response = array de eventos da partida
function mapEvents(response) {
  return (response || [])
    .filter(ev => ev.type === "Goal")
    .map(ev => ({
      team: ev.team.id,
      min: ev.time.elapsed + (ev.time.extra || 0),
      playerId: ev.player && ev.player.id ? ev.player.id : null,
      player: ev.player && ev.player.name ? ev.player.name : "Desconhecido",
      detail: ev.detail, // "Normal Goal", "Own Goal", "Penalty"
    }))
    .sort((a, b) => a.min - b.min);
}

// response = mesmo array de /fixtures/events usado por mapEvents,
// filtrando as trocas em vez dos gols. Na API-Sports, eventos do
// tipo "subst" guardam quem SAIU em "player" e quem ENTROU em
// "assist" (reaproveitamento desse campo, particularidade da API).
function mapSubstitutions(response) {
  return (response || [])
    .filter(ev => (ev.type || "").toLowerCase() === "subst")
    .map(ev => ({
      team: ev.team.id,
      min: ev.time.elapsed + (ev.time.extra || 0),
      outId: ev.player && ev.player.id ? ev.player.id : null,
      out: ev.player && ev.player.name ? ev.player.name : "Desconhecido",
      inId: ev.assist && ev.assist.id ? ev.assist.id : null,
      in: ev.assist && ev.assist.name ? ev.assist.name : "Desconhecido",
    }))
    .sort((a, b) => a.min - b.min);
}

// response = array de /fixtures/lineups (até 2 blocos, um por time).
// Vira um objeto indexado por id do time pra ficar fácil de buscar
// startXI/reservas/formação/técnico de cada lado no front-end.
function mapLineups(response) {
  const out = {};
  (response || []).forEach(block => {
    const teamId = block.team && block.team.id;
    if (!teamId) return;
    const mapPlayer = (p) => ({
      id: p.player?.id ?? null,
      name: p.player?.name || "Desconhecido",
      number: p.player?.number ?? null,
      pos: p.player?.pos || null,
    });
    out[teamId] = {
      formation: block.formation || null,
      coach: block.coach?.name || null,
      startXI: (block.startXI || []).map(mapPlayer),
      substitutes: (block.substitutes || []).map(mapPlayer),
    };
  });
  return out;
}

// response = array retornado por /players/topscorers, /topassists,
// /topyellowcards ou /topredcards — cada item já traz o bloco de
// estatísticas da temporada inteira pro time em que o jogador atuou
// (não só a métrica do endpoint específico), então dá pra montar um
// registro completo (gols, assistências, cartões, nota) a partir de
// qualquer um dos 4 endpoints.
function mapPlayerEntry(item) {
  const p = item.player;
  const s = (item.statistics || [])[0];
  if (!p || !s) return null;
  const rating = s.games?.rating != null ? parseFloat(s.games.rating) : null;
  return {
    id: p.id,
    name: p.name,
    photo: normalizeLogoUrl(p.photo),
    teamId: s.team?.id ?? null,
    position: s.games?.position || null,
    games: s.games?.appearences || 0,
    goals: s.goals?.total || 0,
    assists: s.goals?.assists || 0,
    yellow: s.cards?.yellow || 0,
    red: s.cards?.red || 0,
    rating: Number.isFinite(rating) ? rating : null,
  };
}

// response = array (por casa de apostas) retornado por /odds?fixture=
// Pega o mercado "Match Winner" (1X2) da primeira casa disponível
// (preferindo bet365, por ser a referência mais comum de mercado).
function mapOdds(response) {
  const fx = (response || [])[0];
  const bookmakers = fx?.bookmakers || [];
  if (!bookmakers.length) return null;
  const preferred = bookmakers.find(b => /bet365/i.test(b.name)) || bookmakers[0];
  const market = (preferred.bets || []).find(b => /match winner|1x2/i.test(b.name));
  if (!market) return null;
  const pick = (label) => {
    const v = market.values.find(v => v.value === label);
    return v ? parseFloat(v.odd) : null;
  };
  return { bookmaker: preferred.name, home: pick("Home"), draw: pick("Draw"), away: pick("Away") };
}

module.exports = { mapTeam, mapStandingRow, mapFixture, mapStatistics, mapEvents, mapSubstitutions, mapLineups, mapOdds, mapPlayerEntry, parseRoundNumber, normalizeLogoUrl };
