/* Traduz as respostas "cruas" da API-Sports para os formatos que o
   front-end já sabe consumir (mesmas chaves usadas no motor de
   simulação: home/away/gh/ga/round, stats.posse = [casa, fora] etc). */

function parseRoundNumber(roundStr = "") {
  const m = roundStr.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function mapTeam(item) {
  const t = item.team;
  return {
    id: t.id,
    name: t.name,
    short: (t.code || t.name.replace(/[^A-Za-zÀ-ú]/g, "").slice(0, 3)).toUpperCase(),
    logo: t.logo || null,
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
  return {
    id: fx.fixture.id,
    date: fx.fixture.date,
    status: fx.fixture.status.short, // NS, FT, PST, POSTPONED, CANC, AET, PEN...
    round: parseRoundNumber(fx.league.round),
    home: fx.teams.home.id,
    away: fx.teams.away.id,
    gh: fx.goals.home,
    ga: fx.goals.away,
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
      player: ev.player && ev.player.name ? ev.player.name : "Desconhecido",
      detail: ev.detail, // "Normal Goal", "Own Goal", "Penalty"
    }))
    .sort((a, b) => a.min - b.min);
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

module.exports = { mapTeam, mapStandingRow, mapFixture, mapStatistics, mapEvents, mapOdds, parseRoundNumber };
