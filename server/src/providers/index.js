/* ================= Camada de fornecedor de dados esportivos =================
   Ponto único de troca de fornecedor. Hoje só existe "api-sports" (ver
   ./apiSports.js), mas qualquer novo fornecedor (Sportmonks,
   Football-Data.org etc.) entra AQUI, sem precisar tocar em
   server.js, adapter.js nem no front-end: basta criar um arquivo
   novo em providers/<nome>.js implementando a mesma interface — todo
   método abaixo, já devolvendo dado no formato interno do app, não no
   formato cru do fornecedor — e registrar esse arquivo no objeto
   PROVIDERS logo abaixo.

   CONTRATO que cada provider precisa implementar (todo método é
   async; erro é lançado — quem chama já sabe tratar, ver
   resolveCompetition/handleError em server.js):

     searchLeagues({ name })
       -> [{ id, name, type, country, seasons: [ano, ...] }]
     getTeams({ leagueId, season })
       -> [{ id, name, short, logo, venue: {name, city} | null }]
     getStandings({ leagueId, season })
       -> [{ id, rank, pts, j, v, e, d, gp, gc, sg }]
     getFixtures({ leagueId, season })
       -> [{ id, date, status, round, home, away, gh, ga, venue }]
     getPlayersLeaders({ leagueId, season })
       -> [{ id, name, photo, teamId, position, games, goals, assists, yellow, red, rating }]
     getTeamPlayers({ teamId, season })
       -> mesmo formato de getPlayersLeaders, só que do elenco de 1 time
     getPlayer({ playerId, season })
       -> 1 item do formato acima, ou null se não achar
     getFixtureStatistics({ fixtureId, homeId, awayId })
       -> { posse, finalizacoes, escanteios, amarelos, vermelhos, passesCertos }
          (cada chave é [valorCasa, valorFora])
     getFixtureEvents({ fixtureId })
       -> { goals: [...], substitutions: [...] }
     getFixtureLineups({ fixtureId })
       -> { [teamId]: { formation, coach, startXI, substitutes } }
     getFixtureOdds({ fixtureId })
       -> { bookmaker, home, draw, away } | null
     getQuota()
       -> { limit, remaining } — síncrono, só reflete a última chamada
          feita; um fornecedor sem esse conceito pode devolver
          { limit: null, remaining: null }

   `leagueId`/`teamId`/`playerId`/`fixtureId` chegam já resolvidos pro
   sistema de ids DESSE fornecedor específico (ver
   server/src/competitions.js — providerLeagueIds — pra league; os
   outros ids vêm direto da própria resposta anterior do fornecedor,
   então já nascem no formato certo).

   Fornecedor ativo escolhido pela env var DATA_PROVIDER (padrão
   "api-sports") — ver server/.env.example. */

const PROVIDERS = {
  "api-sports": require("./apiSports"),
  // "sportmonks": require("./sportmonks"), // exemplo de como um 2º fornecedor entraria aqui
};

const ACTIVE_PROVIDER_NAME = (process.env.DATA_PROVIDER || "api-sports").trim().toLowerCase();
const activeProvider = PROVIDERS[ACTIVE_PROVIDER_NAME];

if (!activeProvider) {
  throw new Error(
    `DATA_PROVIDER="${ACTIVE_PROVIDER_NAME}" não é um fornecedor conhecido. ` +
    `Disponíveis: ${Object.keys(PROVIDERS).join(", ")}. Ver server/src/providers/index.js.`
  );
}

module.exports = {
  ...activeProvider,
  PROVIDER_NAMES: Object.keys(PROVIDERS),
  ACTIVE_PROVIDER_NAME,
};
