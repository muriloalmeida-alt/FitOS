/* Provider "campeonato-brasileiro" — usa o pacote gratuito e sem
   chave `campeonato-brasileiro-api` (https://github.com/ezefranca/
   campeonato-brasileiro-api), que lê a página pública do Globo
   Esporte (ge.globo.com/futebol/brasileirao-serie-a/ etc.) pras
   Séries A/B/C/D do Brasileirão.

   ATENÇÃO — leia antes de trocar DATA_PROVIDER pra este:

   1) COBERTURA: só Brasileirão (Séries A/B/C/D). Não tem Premier
      League nem La Liga — nesse fornecedor, esses 2 campeonatos ficam
      sem providerLeagueIds mapeado (ver competitions.js), então
      resolveCompetition() já trata como "em breve" automaticamente,
      sem precisar de nenhum código extra aqui.

   2) SÓ A RODADA ATUAL: a fonte (página do Globo Esporte) só expõe de
      forma estável a classificação completa e os jogos da RODADA
      ATIVA — não tem o calendário da temporada inteira (rodadas
      passadas fechadas e futuras ainda não sorteadas/exibidas na
      página). Isso significa que getFixtures() aqui devolve só ~10
      jogos (a rodada atual), não os ~380 da temporada inteira que
      Jogos/Simulador/Tabela esperam pra navegar rodada a rodada. Na
      prática, ativar esse fornecedor pra valer faz o app mostrar só 1
      rodada populada e todas as outras vazias — não é um substituto
      completo da API-Sports pra esse fim hoje.

   3) SEM histórico de temporada (só a corrente), SEM dado de jogador
      (elenco/artilheiros), SEM estatística/eventos/escalação/odds de
      partida — getPlayersLeaders/getTeamPlayers/getPlayer devolvem
      vazio, e getFixtureStatistics/Events/Lineups/Odds lançam erro
      claro (NOT_SUPPORTED_BY_PROVIDER) em vez de fingir que teriam
      dado.

   4) É scraping de uma página pública (não uma API oficial com
      contrato/SLA) — o pacote é "fornecido apenas para fins
      educacionais" (aviso do próprio autor no README). Pode quebrar
      se o Globo Esporte mudar a página, sem aviso prévio.

   Dado esse conjunto de limitações, esse fornecedor fica registrado e
   pronto pra uso (ver providers/index.js), mas NÃO é o DATA_PROVIDER
   padrão — trocar exige decisão consciente, sabendo que o calendário
   completo de rodadas não funciona nele hoje. */

const brasileirao = require("campeonato-brasileiro-api");

// leagueId aqui é o "serie" desse pacote: "a" | "b" | "c" | "d" (ver
// providerLeagueIds da entrada "brasileirao" em competitions.js).

function notSupported(method) {
  const err = new Error(
    `${method} não é suportado pelo fornecedor "campeonato-brasileiro" (a fonte não expõe esse dado). ` +
    `Configure DATA_PROVIDER=api-sports (ou outro fornecedor com esse recurso) pra usar essa funcionalidade.`
  );
  err.status = 501;
  err.code = "NOT_SUPPORTED_BY_PROVIDER";
  throw err;
}

function mapStatus(status) {
  if (status === "finished") return "FT";
  if (status === "live") return "LIVE";
  return "NS"; // "scheduled" ou qualquer outro valor não previsto
}

function mapTeamFromRecord(t) {
  if (!t || t.id == null) return null;
  return {
    id: t.id,
    name: t.name || t.shortName || `Time ${t.id}`,
    short: (t.shortName || t.name || "???").toUpperCase().slice(0, 3),
    logo: t.badge || null,
    venue: null, // a fonte não traz estádio/cidade do mandante
  };
}

async function searchLeagues({ name }) {
  const series = brasileirao.listSeries();
  const q = String(name || "").trim().toLowerCase();
  return series
    .filter((s) => !q || s.name.toLowerCase().includes(q) || s.slug.includes(q))
    .map((s) => ({ id: s.code, name: s.name, type: "League", country: "Brasil", seasons: [] }));
}

async function getTeams({ leagueId }) {
  const standings = await brasileirao.getStandings(leagueId);
  const table = standings.tables[0];
  const byId = new Map();
  (table?.entries || []).forEach((entry) => {
    const t = mapTeamFromRecord(entry.team);
    if (t) byId.set(t.id, t);
  });
  return Array.from(byId.values());
}

async function getStandings({ leagueId }) {
  const standings = await brasileirao.getStandings(leagueId);
  const table = standings.tables[0];
  return (table?.entries || []).map((entry) => ({
    id: entry.team.id,
    rank: entry.position,
    pts: entry.points,
    j: entry.matches,
    v: entry.wins,
    e: entry.draws,
    d: entry.losses,
    gp: entry.goalsFor,
    gc: entry.goalsAgainst,
    sg: entry.goalDifference,
  }));
}

// Ver aviso (2) no topo do arquivo — só a rodada atual, não a
// temporada inteira.
async function getFixtures({ leagueId }) {
  const rounds = await brasileirao.getRounds(leagueId);
  const round = rounds.rounds[0];
  return (round?.matches || []).map((m) => ({
    id: m.id,
    date: m.dateTime || m.date || null,
    status: mapStatus(m.status),
    round: m.round,
    home: m.homeTeam?.id ?? null,
    away: m.awayTeam?.id ?? null,
    gh: m.score?.home ?? null,
    ga: m.score?.away ?? null,
    venue: m.venue ? { name: m.venue, city: null } : null,
  }));
}

// Sem dado de jogador nessa fonte — ver aviso (3).
async function getPlayersLeaders() { return []; }
async function getTeamPlayers() { return []; }
async function getPlayer() { return null; }

// Sem detalhe de partida nessa fonte — ver aviso (3).
async function getFixtureStatistics() { return notSupported("getFixtureStatistics"); }
async function getFixtureEvents() { return notSupported("getFixtureEvents"); }
async function getFixtureLineups() { return notSupported("getFixtureLineups"); }
async function getFixtureOdds() { return notSupported("getFixtureOdds"); }

// Sem conceito de cota nessa fonte (não é uma API com rate limit
// documentado, é scraping de página pública).
function getQuota() { return { limit: null, remaining: null }; }

module.exports = {
  name: "campeonato-brasileiro",
  requiresKey: false, // grátis, sem chave nenhuma — ver hasCredential()/liveModeEnabled() em server.js
  hasCredential: () => true,
  searchLeagues, getTeams, getStandings, getFixtures,
  getPlayersLeaders, getTeamPlayers, getPlayer,
  getFixtureStatistics, getFixtureEvents, getFixtureLineups, getFixtureOdds,
  getQuota,
};
