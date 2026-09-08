/* Performance (pedido do usuário: "o jogo está lento") ----------
   Todo módulo de "store" local deste backend (careerStore/users/
   sessions/analytics/leaderboard/contentStore/paymentsLedger) seguia
   o MESMO padrão: guardar tudo num Map/array em memória e, a cada
   mutação, reescrever o arquivo INTEIRO no disco de forma SÍNCRONA
   (fs.writeFileSync) antes de responder a requisição.

   Isso é barato enquanto o arquivo é pequeno, mas careers.json (o pior
   caso — cada carreira "multi" pode passar de 500KB, e o arquivo junta
   TODAS as contas num blob só) media ~100-125ms por PUT /api/career
   mesmo pra um payload minúsculo, MEDIDO DE VERDADE (curl direto,
   sem overhead de browser): comparado ao ~0.5ms de um GET que não
   escreve nada, é a escrita síncrona do arquivo inteiro — não o
   tamanho do que mudou — quem domina o tempo de resposta. Como
   fs.writeFileSync BLOQUEIA o event loop (Node é single-thread), isso
   também trava toda e qualquer OUTRA requisição em andamento nesse
   meio-tempo, não só a que disparou o save.

   Este helper resolve os 2 problemas de uma vez, pros stores que
   optarem por ele:
   1) Debounce — várias mutações em sequência rápida (comum: o técnico
      edita vários campos em sequência, cada um chamando persistCareer())
      viram 1 escrita só, não N.
   2) Escrita assíncrona (fs.writeFile) — o disco nunca bloqueia o
      event loop; a resposta da requisição já volta com o Map em
      memória atualizado (sempre a fonte da verdade pras leituras
      seguintes), sem esperar o arquivo ser gravado de verdade.

   Trade-off aceito conscientemente (mesmo espírito de "cliente é dono
   da verdade" já documentado em careerStore.js): numa queda BRUTA do
   processo (não um desligamento normal), o que ainda não foi
   descarregado no disco (no máximo DEBOUNCE_MS de mudanças) se perde
   — aceitável pra um jogo solo sem dado financeiro real nem placar
   competitivo entre contas. flushAllSync() (chamada no SIGTERM/SIGINT,
   ver server.js) cobre o caso comum de desligamento/deploy normal. */
const fs = require("fs");
const path = require("path");

const DEBOUNCE_MS = 800;

// filePath -> { getData, timer }. Uma entrada por arquivo — vários
// módulos podem usar este helper ao mesmo tempo sem interferir.
const pending = new Map();

function flushOne(filePath) {
  const entry = pending.get(filePath);
  if (!entry) return;
  pending.delete(filePath);
  let data;
  try {
    data = entry.getData();
  } catch (err) {
    console.error(`[persist] falha ao preparar dado de ${filePath}:`, err.message);
    return;
  }
  fs.writeFile(filePath, data, (err) => {
    if (err) console.error(`[persist] falha ao salvar ${filePath}:`, err.message);
  });
}

// Agenda uma escrita debounced. `getData` é chamada só na hora de
// escrever de verdade (nunca antes) — assim, se 5 mutações acontecerem
// dentro da mesma janela, só a ÚLTIMA versão do dado é serializada e
// gravada (não as 5). Janela FIXA a partir da 1ª mutação da rajada
// (não desliza a cada chamada nova) — garante um teto de atraso
// (DEBOUNCE_MS) mesmo sob atividade contínua.
function scheduleWrite(filePath, dataDir, getData) {
  const existing = pending.get(filePath);
  if (existing) {
    existing.getData = getData;
    return;
  }
  try { fs.mkdirSync(dataDir, { recursive: true }); } catch (err) { /* ignora — writeFile já falha de forma visível se o dir não existir */ }
  const timer = setTimeout(() => flushOne(filePath), DEBOUNCE_MS);
  timer.unref?.(); // não segura o processo vivo só por causa de um save pendente
  pending.set(filePath, { getData, timer });
}

// Descarrega TUDO que ainda está pendente, de forma síncrona — só pra
// um desligamento limpo (SIGTERM/SIGINT, ver server.js). Nunca deve
// ser chamada no caminho quente de uma requisição.
function flushAllSync() {
  for (const [filePath, entry] of pending) {
    clearTimeout(entry.timer);
    pending.delete(filePath);
    try {
      fs.writeFileSync(filePath, entry.getData());
    } catch (err) {
      console.error(`[persist] falha ao salvar ${filePath} no desligamento:`, err.message);
    }
  }
}

module.exports = { scheduleWrite, flushAllSync };
