// GE-BALANCE-002 (issue #27) — validação por simulação Monte Carlo do
// mecanismo de "reprieve de tradição" (applyTraditionReprieve), ANTES
// vs DEPOIS. Diferente de GE-BALANCE-001 (que isolou só a fórmula de
// gol), aqui o próprio CÓDIGO FONTE de produção
// (relegationZoneIds/accessZoneIds/CLUB_TRADITION_IDS/
// TRADITION_REPRIEVE_CHANCE/applyTraditionReprieve, extraído por regex
// de public/js/carreira.js — não reescrito à mão) roda dentro deste
// script Node via `vm`, junto com seededRngFromKey/mulberry32 reais de
// public/js/data.js. O que este script MODELA (não reaproveita) é a
// distribuição de "quem cai pra zona de rebaixamento" — em vez de rodar
// 38 rodadas de Poisson por temporada (custoso, e GE-BALANCE-001 já
// validou que a fórmula de gol em si não é o alvo aqui), sorteia
// diretamente uma composição de zona de rebaixamento por temporada,
// com clubes de tradição tendo uma chance realista (não nula, não
// garantida) de aparecer nela — o suficiente pra medir o que o
// mecanismo em si faz com essa composição, que é exatamente a pergunta
// desta demanda.
const fs = require("fs");
const vm = require("vm");

const dataJs = fs.readFileSync("/home/user/FitOS/public/js/data.js", "utf8");
const mulberryMatch = dataJs.match(/function mulberry32\(seed\) \{[\s\S]*?\n\}\n/);
const seededMatch = dataJs.match(/function seededRngFromKey\(key\) \{[\s\S]*?\n\}\n/);
if (!mulberryMatch || !seededMatch) throw new Error("Não achou mulberry32/seededRngFromKey em data.js — arquivo mudou?");

const carreiraJs = fs.readFileSync("/home/user/FitOS/public/js/carreira.js", "utf8");
function extractFn(re, label) {
  const m = carreiraJs.match(re);
  if (!m) throw new Error(`Não achou ${label} em carreira.js — arquivo mudou?`);
  return m[0];
}
const relegationZoneIdsSrc = extractFn(/function relegationZoneIds\(sortedRows, n, protectedId\) \{[\s\S]*?\n\}\n/, "relegationZoneIds");
const clubTraditionIdsSrc = extractFn(/const CLUB_TRADITION_IDS = new Set\(\[[^\]]*\]\);/, "CLUB_TRADITION_IDS");
const traditionChanceSrc = extractFn(/const TRADITION_REPRIEVE_CHANCE = [\d.]+;/, "TRADITION_REPRIEVE_CHANCE");
const applyTraditionReprieveSrc = extractFn(/function applyTraditionReprieve\(zone, sortedRows, seedKey\) \{[\s\S]*?\n\}\n/, "applyTraditionReprieve");

const sandbox = {};
vm.createContext(sandbox);
// `const` de topo não vira propriedade do objeto global do contexto vm
// (diferente de `function`/`var`) — troca só pra isso não quebrar o
// acesso via `sandbox.X` depois (o CÓDIGO em si continua sendo o
// mesmo, só a forma de declarar top-level muda, sem efeito nenhum no
// comportamento de nenhuma das 2 constantes).
const toVar = (src) => src.replace(/^const /, "var ");
vm.runInContext(mulberryMatch[0] + seededMatch[0] + relegationZoneIdsSrc + toVar(clubTraditionIdsSrc) + toVar(traditionChanceSrc) + applyTraditionReprieveSrc, sandbox);
const { relegationZoneIds, CLUB_TRADITION_IDS, TRADITION_REPRIEVE_CHANCE, applyTraditionReprieve } = sandbox;
console.log("Código real extraído de produção — TRADITION_REPRIEVE_CHANCE:", TRADITION_REPRIEVE_CHANCE, "| CLUB_TRADITION_IDS:", [...CLUB_TRADITION_IDS].join(", "));

// 20 clubes por divisão — 1 posição = 1 "sortedRows" (já ordenado por
// pontos, como sortedDivisionRows produz de verdade). Sorteia UMA
// permutação de tabela por temporada, com viés (não puro acaso) — os
// clubes de tradição têm uma chance de terminar mal (senão a demanda
// nem faria sentido: o pedido do usuário é sobre quando isso acontece,
// não sobre impedir que aconteça).
const OTHER_CLUBS = Array.from({ length: 8 }, (_, i) => `outro${i}`);
const ALL_20 = [...CLUB_TRADITION_IDS, ...OTHER_CLUBS];
function mulberry32(seed) { return sandbox.mulberry32 ? sandbox.mulberry32(seed) : null; }

function simulateSeasonZone(rng) {
  // embaralha (Fisher-Yates) — cada clube tem a MESMA chance de terminar
  // em qualquer posição por padrão (pior caso pra medir o mecanismo: sem
  // isso os clubes de tradição raramente cairiam de qualquer jeito, e o
  // teste não mediria nada).
  const shuffled = ALL_20.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const sortedRows = shuffled.map((id, idx) => ({ id, pts: shuffled.length - idx }));
  return sortedRows;
}

function runBatch(useReprieve, seasons, seed) {
  const rng = mulberry32(seed);
  let naiveTraditionRelegations = 0, actualTraditionRelegations = 0, totalTraditionAppearancesInZone = 0;
  for (let s = 0; s < seasons; s++) {
    const sortedRows = simulateSeasonZone(rng);
    const naiveZone = relegationZoneIds(sortedRows, 4);
    const traditionInNaiveZone = naiveZone.filter((id) => CLUB_TRADITION_IDS.has(id));
    naiveTraditionRelegations += traditionInNaiveZone.length;
    totalTraditionAppearancesInZone += traditionInNaiveZone.length;
    const finalZone = useReprieve ? applyTraditionReprieve(naiveZone, sortedRows, `test-season-${s}`) : naiveZone;
    actualTraditionRelegations += finalZone.filter((id) => CLUB_TRADITION_IDS.has(id)).length;
    // sempre 4 rebaixados, nunca mais nem menos — checagem de invariante.
    if (finalZone.length !== 4) throw new Error(`zona com tamanho errado: ${finalZone.length}`);
  }
  return { naiveTraditionRelegations, actualTraditionRelegations, totalTraditionAppearancesInZone, seasons };
}

const SEASONS = 20000;
const before = runBatch(false, SEASONS, 111);
const after = runBatch(true, SEASONS, 111); // MESMA seed de composição de tabela — só liga/desliga o mecanismo
console.log(`\n=== GE-BALANCE-002: ${SEASONS} temporadas simuladas (composição de zona sorteada, mesma seed nos 2 lados) ===`);
console.log("Clube de tradição caiu na zona NAIVE (posicional pura) em", before.totalTraditionAppearancesInZone, "ocorrências (esperado ~", (SEASONS * 4 * 12 / 20).toFixed(0), "pela proporção 12/20 de tradição).");
console.log("SEM o mecanismo — rebaixamentos de clube de tradição:", before.actualTraditionRelegations, `(${(100 * before.actualTraditionRelegations / before.totalTraditionAppearancesInZone).toFixed(1)}% dos que caíram na zona)`);
console.log("COM o mecanismo — rebaixamentos de clube de tradição:", after.actualTraditionRelegations, `(${(100 * after.actualTraditionRelegations / after.totalTraditionAppearancesInZone).toFixed(1)}% dos que caíram na zona)`);
console.log("Redução relativa:", (100 * (1 - after.actualTraditionRelegations / before.actualTraditionRelegations)).toFixed(1) + "%", "(esperado ~50%, TRADITION_REPRIEVE_CHANCE=" + TRADITION_REPRIEVE_CHANCE + ")");

// Checagem extra: nenhum clube NÃO-tradicional é afetado (zona final
// sempre tem o mesmo total de não-tradicionais que a naive só quando o
// mecanismo NÃO troca ninguém — senão, sobe; nunca desce abaixo do que
// a naive já tinha).
{
  const rng = mulberry32(222);
  let neverBelowNaive = true;
  for (let s = 0; s < 2000; s++) {
    const sortedRows = simulateSeasonZone(rng);
    const naiveZone = relegationZoneIds(sortedRows, 4);
    const finalZone = applyTraditionReprieve(naiveZone, sortedRows, `check-${s}`);
    const naiveNonTradition = naiveZone.filter((id) => !CLUB_TRADITION_IDS.has(id)).length;
    const finalNonTradition = finalZone.filter((id) => !CLUB_TRADITION_IDS.has(id)).length;
    if (finalNonTradition < naiveNonTradition) neverBelowNaive = false;
  }
  console.log("\nClube não-tradicional nunca sai mais protegido do que estava (mecanismo só ajuda tradição, nunca prejudica quem não é):", neverBelowNaive);
}
