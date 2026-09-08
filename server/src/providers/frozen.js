/* Fornecedor "congelado" — retrato REAL de elenco/tabela capturado uma
   única vez da Sportmonks (03/09/2026, ver server/frozen-catalog/README.md
   e server/src/captureSnapshot.js) e commitado no repositório, sem
   nenhuma chamada de rede depois disso.

   Contexto (pedido do usuário): "vou cancelar o contrato com a
   Sportmonks no final de setembro... o Modo Técnico não precisa de
   dado AO VIVO — só de um retrato inicial de elenco real, que pode
   virar dado local permanente". Este arquivo É esse "desconectar as
   APIs" — implementa só o suficiente do contrato de providers/index.js
   pro Modo Técnico funcionar (times/tabela/elenco cru, ver
   getTeams/getStandings/getTeamPlayers abaixo), sem depender de
   NENHUMA credencial nem conexão externa.

   COMO ATIVAR (zero redeploy de código, mesmo padrão já usado por
   ENABLED_COMPETITIONS): defina a variável de ambiente
     DATA_PROVIDER=frozen
   no host (Railway/painel) — a partir daí TODO o app (site principal E
   Modo Técnico) para de chamar a Sportmonks/API-Sports pra sempre.
   Efeito em cada parte:
     - Modo Técnico (rotas /api/career/*): continua com dado REAL de
       verdade (times/tabela/elenco das Séries A/B/C, o mesmo retrato
       capturado), só que congelado na data da captura — nunca mais
       atualiza.
     - Site principal (rotas /api/teams, /api/fixtures, /api/livescores,
       /api/players/leaders etc.): como este fornecedor não tem
       partidas/estatística ao vivo nenhuma (só times+tabela+elenco),
       essas rotas devolvem erro 501 controlado — o próprio front-end já
       cai sozinho pro Modo Exemplo nesse caso (mesmo comportamento de
       sempre quando falta credencial, ver tryLoadLiveData em
       liveData.js) — o site não quebra, só deixa de mostrar
       resultado/tabela ao vivo, exatamente como esperado depois do
       cancelamento do contrato.

   `hasCredential` sempre `true` de propósito (ver comentário no
   contrato, providers/index.js: "fornecedor sem chave nenhuma... sempre
   devolve true aqui") — isso faz liveModeEnabled() no servidor (e
   health.hasKey no cliente) tratar este dado como REAL, não como Modo
   Exemplo, que é exatamente o objetivo: o retrato capturado É dado
   real, só que parado no tempo. */

const fs = require("fs");
const path = require("path");

const CATALOG_DIR = path.join(__dirname, "..", "..", "frozen-catalog");

// Cache em memória — o arquivo nunca muda em produção (é commitado,
// congelado por definição), então só vale ler o disco 1x por processo.
const cache = new Map();
function loadSnapshot(competitionId) {
  if (cache.has(competitionId)) return cache.get(competitionId);
  const filePath = path.join(CATALOG_DIR, `snapshot-${competitionId}.json`);
  let data = null;
  try {
    data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    data = null; // sem arquivo pra essa competição -- getTeams/getStandings devolvem vazio, igual a "sem cobertura"
  }
  cache.set(competitionId, data);
  return data;
}

// Erro do mesmo formato que server.js já sabe tratar em toda rota
// (`err.status`, ver resolveCompetition/handleError) -- usado só pelos
// recursos que este fornecedor genuinamente não tem (partida/estatística
// ao vivo), nunca por times/tabela/elenco.
function unsupported(feature) {
  const err = new Error(
    `Modo de dado congelado (sem contrato de API ativo) -- ${feature} não está disponível. ` +
    `Só times/tabela/elenco (Modo Técnico) foram capturados antes de desconectar.`
  );
  err.status = 501;
  err.code = "FROZEN_UNSUPPORTED";
  return err;
}

module.exports = {
  requiresKey: false,
  hasCredential: () => true,

  // leagueId aqui É o id da competição no registro interno (ver
  // providerLeagueIds.frozen em server/src/competitions.js -- "frozen"
  // reusa o próprio id, ex. "serie_b", em vez de um número de
  // fornecedor de verdade, já que não existe fornecedor nenhum por
  // trás -- só o arquivo local).
  async getTeams({ leagueId }) {
    const snap = loadSnapshot(leagueId);
    return snap?.teams || [];
  },
  async getStandings({ leagueId }) {
    const snap = loadSnapshot(leagueId);
    return snap?.standings || [];
  },
  async getTeamPlayers({ teamId, leagueId }) {
    const snap = loadSnapshot(leagueId);
    return snap?.playersByTeamId?.[String(teamId)] || [];
  },

  // Recursos de partida/estatística ao vivo -- fora do escopo da
  // captura (só times/tabela/elenco, ver captureSnapshot.js). Onde o
  // contrato já prevê um "sem dado" válido (não é erro de verdade),
  // devolve isso; onde não tem esse conceito, erro 501 controlado (ver
  // unsupported() acima) -- o site principal cai pro Modo Exemplo
  // sozinho nos dois casos (tryLoadLiveData trata qualquer falha
  // igual).
  async searchLeagues() { return []; },
  async getFixtures() { throw unsupported("calendário/resultados de partidas"); },
  async getPlayersLeaders() { throw unsupported("artilharia/ranking de jogadores"); },
  async getPlayer() { return null; },
  async getFixtureStatistics() { throw unsupported("estatística de partida"); },
  async getFixtureEvents() { throw unsupported("eventos de partida"); },
  async getFixtureLineups() { throw unsupported("escalação de partida"); },
  async getFixtureOdds() { return null; }, // contrato já prevê null como "sem odds"
  async getFixtureBroadcast() { return null; }, // contrato já prevê null como "sem emissora"
  async getLiveScores() { return []; }, // contrato já prevê lista vazia como "nada ao vivo agora"
  getQuota() { return { limit: null, remaining: null }; }, // sem conceito de cota (dado local, não é chamada de API)
};
