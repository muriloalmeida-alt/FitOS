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
   a credencial certa configurados):
     node server/scripts/capture-real-snapshot.js

   ALTERNATIVA (recomendada em produção/Railway): o shell web do
   Railway não tem como "baixar" um arquivo de volta pro seu
   computador, e derruba a conexão (WebSocket) no meio de comandos mais
   longos — em vez de rodar este script pelo shell, use o endpoint
   HTTP admin (não depende de shell nenhum, aceita GET, dá pra colar
   direto na barra de endereço do navegador). Capturar as 3 competições
   de uma vez pode demorar demais e dar timeout — o jeito recomendado é
   1 URL por divisão, que já captura E baixa o arquivo na mesma chamada
   (bem mais rápido, ~20 times cada em vez de 60):
     https://SEU-DOMINIO/api/admin/snapshot?secret=SEU_ADMIN_SECRET&file=brasileirao&capture=1
     https://SEU-DOMINIO/api/admin/snapshot?secret=SEU_ADMIN_SECRET&file=serie_b&capture=1
     https://SEU-DOMINIO/api/admin/snapshot?secret=SEU_ADMIN_SECRET&file=serie_c&capture=1
   Exige ADMIN_SECRET configurado no host (ver server/.env.example).

   Gera um arquivo por competição em server/data/snapshot-<id>.json
   com times + tabela (pra calibrar força) + elenco de cada time (dado
   cru, mesmo formato que buildRealPlayer já sabe processar). Depois
   de rodar, baixe os 3 arquivos de server/data/ e me mande de volta
   (ou cole o conteúdo aqui) — eu transformo isso no catálogo local
   definitivo do Modo Técnico. NENHUM outro arquivo é alterado por
   este script — só lê da API e escreve em server/data/, não mexe em
   nada do jogo.

   A lógica de captura em si mora em server/src/captureSnapshot.js,
   compartilhada com o endpoint HTTP acima — este arquivo é só a casca
   de linha de comando por cima dela. */

const { captureAllCompetitions } = require("../src/captureSnapshot");

(async () => {
  try {
    const summary = await captureAllCompetitions((msg) => console.log(msg));
    console.log("\n=== RESUMO ===");
    summary.forEach((s) => console.log(`${s.competitionId}: ${s.teams} times, ${s.teamsWithPlayers} com elenco capturado -> server/data/${s.file}`));
    console.log("\nPronto. Baixe os arquivos server/data/snapshot-*.json e me mande de volta (ou cole o conteúdo) pra eu congelar isso como o catálogo local do Modo Técnico.");
  } catch (err) {
    console.error("\nERRO:", err.message);
    process.exit(1);
  }
})();
