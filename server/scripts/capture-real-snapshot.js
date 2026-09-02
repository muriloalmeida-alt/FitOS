/* Captura um retrato ESTÁTICO (uma vez só) do elenco real das 3
   competições do Modo Técnico (Brasileirão Série A, Série B, Série C)
   — pedido do usuário: "vou cancelar o contrato com a Sportmonks no
   final de setembro... pode capturar esse retrato final de elenco
   real e desconectar as APIs".

   PRECISA RODAR NUM HOST COM ACESSO DE VERDADE À API (Railway, ou
   local com o .env preenchido) — o ambiente de desenvolvimento desta
   sessão não consegue falar com Sportmonks nem API-Sports (confirmado:
   as duas retornam bloqueio 403 do proxy de rede daqui). Rode isto
   ONDE o site já roda de verdade, ANTES de cancelar a assinatura ou
   apagar a credencial — depois disso não tem mais como capturar nada.

   Como rodar (na raiz do projeto, no host que já tem DATA_PROVIDER +
   a credencial certa configurados, ex.: SSH/console do Railway):
     node server/scripts/capture-real-snapshot.js

   Gera um arquivo por competição em server/data/snapshot-<id>.json
   com times + tabela (pra calibrar força) + elenco de cada time (dado
   cru, mesmo formato que buildRealPlayer já sabe processar). Depois
   de rodar, baixe os 3 arquivos de server/data/ e me mande de volta
   (ou cole o conteúdo aqui) — eu transformo isso no catálogo local
   definitivo do Modo Técnico. NENHUM outro arquivo é alterado por
   este script — só lê da API e escreve em server/data/, não mexe em
   nada do jogo. */

const fs = require("fs");
const path = require("path");
const dataProvider = require("../src/providers");
const competitions = require("../src/competitions");

const COMPETITION_IDS = ["brasileirao", "serie_b", "serie_c"];
const OUT_DIR = path.join(__dirname, "..", "data");
const DELAY_MS = 400; // educado com o limite de requisição do fornecedor -- não tem pressa nenhuma aqui

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function captureCompetition(compId) {
  const comp = competitions.getCompetition(compId);
  if (!comp) { console.log(`[pular] competição desconhecida: ${compId}`); return null; }
  const leagueId = competitions.providerLeagueId(comp, dataProvider.ACTIVE_PROVIDER_NAME);
  if (!leagueId) {
    console.log(`[pular] ${comp.name}: sem id mapeado pro fornecedor ativo (${dataProvider.ACTIVE_PROVIDER_NAME}) -- confira SPORTMONKS_LEAGUE_ID_* no .env.`);
    return null;
  }
  const season = process.env.LIVE_SEASON || competitions.DEFAULT_SEASON;
  console.log(`\n=== ${comp.name} (leagueId=${leagueId}, temporada=${season}) ===`);

  const teams = await dataProvider.getTeams({ leagueId, season });
  console.log(`  ${teams.length} times encontrados.`);
  const standings = await dataProvider.getStandings({ leagueId, season }).catch((err) => {
    console.log(`  [aviso] tabela falhou (${err.message}) -- segue sem ela, cada time fica sem força calibrada.`);
    return [];
  });

  const playersByTeamId = {};
  for (let i = 0; i < teams.length; i++) {
    const t = teams[i];
    process.stdout.write(`  [${i + 1}/${teams.length}] elenco de ${t.name}... `);
    try {
      const players = await dataProvider.getTeamPlayers({ teamId: t.id, season, leagueId });
      playersByTeamId[t.id] = players;
      console.log(`${players.length} jogadores.`);
    } catch (err) {
      console.log(`FALHOU (${err.message}) -- time fica sem elenco capturado, será preenchido com jogador gerado na hora de usar.`);
      playersByTeamId[t.id] = [];
    }
    await sleep(DELAY_MS);
  }

  return { competitionId: compId, name: comp.name, leagueId, season, capturedAt: new Date().toISOString(), teams, standings, playersByTeamId };
}

(async () => {
  console.log(`Fornecedor ativo: ${dataProvider.ACTIVE_PROVIDER_NAME} | tem credencial: ${dataProvider.hasCredential()}`);
  if (!dataProvider.hasCredential()) {
    console.error("\nERRO: fornecedor ativo não tem credencial configurada neste host (ver server/.env). Preencha e rode de novo.");
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const summary = [];
  for (const compId of COMPETITION_IDS) {
    const result = await captureCompetition(compId);
    if (!result) continue;
    const outFile = path.join(OUT_DIR, `snapshot-${compId}.json`);
    fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
    const teamsWithPlayers = Object.values(result.playersByTeamId).filter((p) => p.length > 0).length;
    summary.push({ competitionId: compId, file: outFile, teams: result.teams.length, teamsWithPlayers });
    console.log(`  Salvo em ${outFile}`);
  }

  console.log("\n=== RESUMO ===");
  summary.forEach((s) => console.log(`${s.competitionId}: ${s.teams} times, ${s.teamsWithPlayers} com elenco capturado -> ${s.file}`));
  console.log("\nPronto. Baixe os arquivos server/data/snapshot-*.json e me mande de volta (ou cole o conteúdo) pra eu congelar isso como o catálogo local do Modo Técnico.");
})().catch((err) => { console.error("FATAL:", err); process.exit(1); });
