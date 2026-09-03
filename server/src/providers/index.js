/* ================= Camada de fornecedor de dados esportivos =================
   Ponto único de troca de fornecedor. Hoje existem "api-sports" (ver
   ./apiSports.js), "sportmonks" (ver ./sportmonks.js) e "frozen" (ver
   ./frozen.js — catálogo real congelado, local, sem rede nenhuma,
   pensado pra depois de cancelar o contrato com um fornecedor ao vivo),
   mas qualquer fornecedor novo (Football-Data.org etc.) entra AQUI, sem
   precisar tocar em server.js, adapter.js nem no front-end: basta criar
   um arquivo novo em providers/<nome>.js implementando a mesma
   interface — todo método abaixo, já devolvendo dado no formato interno
   do app, não no formato cru do fornecedor — e registrar esse arquivo
   no objeto PROVIDERS logo abaixo.

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
     getTeamPlayers({ teamId, season, leagueId })
       -> mesmo formato de getPlayersLeaders, só que do elenco de 1
          time. leagueId é OPCIONAL pro contrato (nem todo fornecedor
          precisa — API-Sports não usa), mas alguns fornecedores
          precisam dele pra resolver estatística de jogador por
          temporada (ver server/src/providers/sportmonks.js) — quem
          chama (server.js) já resolve a competição e passa o
          leagueId de qualquer forma, então não custa nada mandar
          mesmo quando o fornecedor ativo não usa.
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
     getFixtureBroadcast({ fixtureId })
       -> string | null — nome da(s) emissora(s) que vão transmitir
          esse jogo (junte com ", " se vier mais de uma), direto do
          fornecedor de dados esportivos (ex.: Sportmonks tem
          "tvStations" nativo, ligado ao fixtureId — sem ambiguidade
          de casamento por nome/data). Fornecedor sem esse recurso
          (ex.: API-Sports não tem) devolve null sempre — server.js já
          trata isso como "sem essa fonte, tenta a próxima" (EPG /
          TheSportsDB, ver GET /api/broadcast), nunca quebra a página.
     getLiveScores({ leagueId })
       -> [{ id, date, status, round, home, away, gh, ga, venue, phase, elapsed }]
          jogos EM ANDAMENTO agora mesmo nessa liga — status sempre
          "LIVE" (por definição: já é filtrado pra só trazer jogo ao
          vivo), phase = fase crua do fornecedor ("1H"/"HT"/"2H"/"ET"
          etc, pro front-end escolher o texto certo do badge — ver
          livePhaseLabel em app.js) e elapsed = minuto corrido (número)
          ou null se o fornecedor não conseguir calcular. Usado só pela
          aba Jogos pra atualizar placar/minuto em tempo real (ver GET
          /api/livescores em server.js, polling em loadLiveScores/
          refreshLiveScores em public/js/liveData.js e app.js) — nunca
          usado pra decidir resultado OFICIAL (isso continua vindo só
          de getFixtures, quando o status virar FT de verdade).
     getQuota()
       -> { limit, remaining } — síncrono, só reflete a última chamada
          feita; um fornecedor sem esse conceito pode devolver
          { limit: null, remaining: null }

   Cada provider também exporta (não são métodos, são valores/funções
   síncronas lidas no boot e a cada request — ver liveModeEnabled() em
   server.js):
     requiresKey    -> boolean — precisa de credencial pra funcionar?
     hasCredential  -> () => boolean — a credencial necessária (se
                       houver) está configurada nesse host agora?
                       Fornecedor sem chave nenhuma (ex.: scraping de
                       página pública) sempre devolve true aqui.

   `leagueId`/`teamId`/`playerId`/`fixtureId` chegam já resolvidos pro
   sistema de ids DESSE fornecedor específico (ver
   server/src/competitions.js — providerLeagueIds — pra league; os
   outros ids vêm direto da própria resposta anterior do fornecedor,
   então já nascem no formato certo).

   Fornecedor ativo escolhido pela env var DATA_PROVIDER (padrão
   "api-sports") — ver server/.env.example. */

const PROVIDERS = {
  "api-sports": require("./apiSports"),
  "sportmonks": require("./sportmonks"),
  // Ver ./frozen.js -- catálogo real congelado, sem chamada de rede
  // nenhuma. Ativar com DATA_PROVIDER=frozen (ver instruções no topo
  // desse arquivo) depois de cancelar o contrato com o fornecedor ao
  // vivo.
  "frozen": require("./frozen"),
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
