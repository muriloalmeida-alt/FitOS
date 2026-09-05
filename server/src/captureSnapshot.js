/* Lógica compartilhada de captura de retrato real de elenco (times +
   tabela + elenco cru por competição, Série A/B/C do Modo Técnico) —
   pedido original do usuário: "vou cancelar o contrato com a
   Sportmonks no final de setembro... pode capturar esse retrato final
   de elenco real e desconectar as APIs".

   Extraída de server/scripts/capture-real-snapshot.js pra ser
   reaproveitada TAMBÉM pelo endpoint HTTP admin (ver
   /api/admin/snapshot-capture em server.js) — descoberto na prática
   que o shell web do Railway não tem como "baixar" um arquivo de
   volta pro usuário, e ainda derruba a conexão (WebSocket) no meio de
   comandos mais longos. Via HTTPS comum (curl/navegador) não depende
   de shell nenhum, e mesmo que o cliente desista de esperar a
   resposta, esta função continua rodando dentro do processo do
   servidor até o fim — os arquivos ficam salvos de qualquer jeito.

   ONDE OS ARQUIVOS PARAM: esta função grava em server/data/ (OUT_DIR
   abaixo) — pasta gitignorada, de dado local/descartável (cadastros,
   saves de teste). A captura de 03/09/2026 já foi promovida a
   catálogo DEFINITIVO, commitado, em server/frozen-catalog/ (ver o
   README lá e server/src/providers/frozen.js) — se rodar esta captura
   de novo no futuro, o arquivo novo cai aqui em server/data/ primeiro;
   promovê-lo (substituir o arquivo correspondente em
   frozen-catalog/ e commitar) é um passo manual, de propósito — nunca
   automático, pra sempre exigir uma decisão consciente de "sim, quero
   substituir o retrato congelado por este novo". */

const fs = require("fs");
const path = require("path");
const dataProvider = require("./providers");
const competitions = require("./competitions");

const COMPETITION_IDS = ["brasileirao", "serie_b", "serie_c"];
const OUT_DIR = path.join(__dirname, "..", "data");
const DELAY_MS = 400; // educado com o limite de requisição do fornecedor -- não tem pressa nenhuma aqui

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function captureCompetition(compId, log) {
  const comp = competitions.getCompetition(compId);
  if (!comp) { log(`[pular] competição desconhecida: ${compId}`); return null; }
  const leagueId = competitions.providerLeagueId(comp, dataProvider.ACTIVE_PROVIDER_NAME);
  if (!leagueId) {
    log(`[pular] ${comp.name}: sem id mapeado pro fornecedor ativo (${dataProvider.ACTIVE_PROVIDER_NAME}) -- confira SPORTMONKS_LEAGUE_ID_* no host.`);
    return null;
  }
  const season = process.env.LIVE_SEASON || competitions.DEFAULT_SEASON;
  log(`=== ${comp.name} (leagueId=${leagueId}, temporada=${season}) ===`);

  const teams = await dataProvider.getTeams({ leagueId, season });
  log(`  ${teams.length} times encontrados.`);
  const standings = await dataProvider.getStandings({ leagueId, season }).catch((err) => {
    log(`  [aviso] tabela falhou (${err.message}) -- segue sem ela, cada time fica sem força calibrada.`);
    return [];
  });

  const playersByTeamId = {};
  for (let i = 0; i < teams.length; i++) {
    const t = teams[i];
    try {
      const players = await dataProvider.getTeamPlayers({ teamId: t.id, season, leagueId });
      playersByTeamId[t.id] = players;
      log(`  [${i + 1}/${teams.length}] ${t.name}: ${players.length} jogadores.`);
    } catch (err) {
      log(`  [${i + 1}/${teams.length}] ${t.name}: FALHOU (${err.message}) -- fica sem elenco capturado.`);
      playersByTeamId[t.id] = [];
    }
    await sleep(DELAY_MS);
  }

  return { competitionId: compId, name: comp.name, leagueId, season, capturedAt: new Date().toISOString(), teams, standings, playersByTeamId };
}

function assertCredential() {
  if (!dataProvider.hasCredential()) {
    throw new Error("Fornecedor ativo não tem credencial configurada neste host (ver DATA_PROVIDER/SPORTMONKS_API_TOKEN).");
  }
}

// Captura só UMA competição e já salva o arquivo dela — pedido do
// usuário: capturar as 3 juntas (captureAllCompetitions) numa chamada
// HTTP só demorava o suficiente (~1-2min pros 60 times somados) pra
// dar timeout em alguns hosts/navegadores. 3 chamadas de ~20 times
// cada (uma por divisão, ver /api/admin/snapshot?capture=1 em
// server.js) ficam bem abaixo de qualquer timeout razoável.
async function captureOneCompetition(compId, log = () => {}) {
  if (!COMPETITION_IDS.includes(compId)) throw new Error(`competição desconhecida: ${compId}`);
  log(`Fornecedor ativo: ${dataProvider.ACTIVE_PROVIDER_NAME} | tem credencial: ${dataProvider.hasCredential()}`);
  assertCredential();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const result = await captureCompetition(compId, log);
  if (!result) throw new Error(`${compId}: sem id mapeado pro fornecedor ativo -- confira SPORTMONKS_LEAGUE_ID_* no host.`);
  const fileName = `snapshot-${compId}.json`;
  fs.writeFileSync(path.join(OUT_DIR, fileName), JSON.stringify(result, null, 2));
  const teamsWithPlayers = Object.values(result.playersByTeamId).filter((p) => p.length > 0).length;
  log(`  Salvo em server/data/${fileName}`);
  return { competitionId: compId, file: fileName, teams: result.teams.length, teamsWithPlayers };
}

// log — callback opcional pra acompanhar o progresso (console.log no
// script CLI; ignorado, silenciosamente, pelo endpoint HTTP, que só
// devolve o resumo final na resposta).
async function captureAllCompetitions(log = () => {}) {
  log(`Fornecedor ativo: ${dataProvider.ACTIVE_PROVIDER_NAME} | tem credencial: ${dataProvider.hasCredential()}`);
  assertCredential();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const summary = [];
  for (const compId of COMPETITION_IDS) {
    const result = await captureCompetition(compId, log);
    if (!result) continue;
    const fileName = `snapshot-${compId}.json`;
    fs.writeFileSync(path.join(OUT_DIR, fileName), JSON.stringify(result, null, 2));
    const teamsWithPlayers = Object.values(result.playersByTeamId).filter((p) => p.length > 0).length;
    summary.push({ competitionId: compId, file: fileName, teams: result.teams.length, teamsWithPlayers });
    log(`  Salvo em server/data/${fileName}`);
  }
  return summary;
}

module.exports = { captureAllCompetitions, captureOneCompetition, COMPETITION_IDS, OUT_DIR };
