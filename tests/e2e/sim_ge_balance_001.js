// GE-BALANCE-001 (issue #26) — validação por simulação Monte Carlo do
// mecanismo "adversário motivado" (opponentMotivationMod), ANTES vs
// DEPOIS, reaproveitando a MESMA fórmula de lambda/Poisson do motor real
// (ver resolveLiveChunk em public/js/carreira.js) e o MESMO conjunto de
// clubes/atk/def real de public/js/data.js (extraído por regex, não
// reinventado). Script standalone (Node puro, sem Playwright/DOM) — só
// isola a matemática do gol pra medir o efeito do mecanismo na
// distribuição de sequências de invencibilidade, não o motor inteiro
// (fadiga/tática/lesão do time humano ficam de fora de propósito: isso
// deixa a medição CONSERVADORA — o motor completo em jogo real tem ainda
// mais fricção do que este modelo simplificado considera).
const fs = require("fs");
const dataJs = fs.readFileSync("/home/user/FitOS/public/js/data.js", "utf8");
const teamRe = /atk:\s*([\d.]+),\s*def:\s*([\d.]+)/g;
const OPPONENTS = [];
let m;
while ((m = teamRe.exec(dataJs))) OPPONENTS.push({ atk: parseFloat(m[1]), def: parseFloat(m[2]) });
if (OPPONENTS.length < 19) throw new Error("Esperava >=19 clubes, achou " + OPPONENTS.length);

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function poissonSample(lambda, rng) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}
const OPPONENT_MOTIVATION_STREAK_STEPS = [
  { minStreak: 12, mod: 1.12 },
  { minStreak: 8, mod: 1.08 },
  { minStreak: 5, mod: 1.04 },
];
function opponentMotivationMod(streak, enabled) {
  if (!enabled) return 1;
  const step = OPPONENT_MOTIVATION_STREAK_STEPS.find((s) => streak >= s.minStreak);
  return step ? step.mod : 1;
}

// Time humano: acima da média (representa o clube "bem gerido" do
// relato do usuário, não o pior nem o melhor do elenco de 20 — Flamengo/
// Palmeiras já são os extremos superiores, ver data.js). Fixo pra medir
// só o efeito do mecanismo, não variações de elenco/condição.
const HUMAN = { atk: 2.6, def: 0.56 }; // Flamengo bem gerido, realista (ver nota sobre inversão def/defMult no relatório)

function simulateSeason(rng, enabled) {
  // 19 adversários (out de 20, o humano ocupa 1 vaga), turno e returno = 38 jogos.
  const others = OPPONENTS.filter((o) => !(o.atk === HUMAN.atk && o.def === HUMAN.def)).slice(0, 19);
  const fixtures = [];
  others.forEach((o) => { fixtures.push({ opp: o, home: true }); fixtures.push({ opp: o, home: false }); });
  // embaralha a ordem (Fisher-Yates) pra sequência de rodadas não ficar sempre igual
  for (let i = fixtures.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [fixtures[i], fixtures[j]] = [fixtures[j], fixtures[i]]; }
  let unbeaten = 0, longestUnbeaten = 0, winStreak = 0, longestWin = 0;
  fixtures.forEach((fx) => {
    const mod = opponentMotivationMod(unbeaten, enabled);
    const opp = { atk: fx.opp.atk * mod, def: fx.opp.def * mod };
    const hs = fx.home ? HUMAN : opp;
    const as = fx.home ? opp : HUMAN;
    const lambdaHome = clamp((hs.atk / as.def) * 1.12, 0.05, 6);
    const lambdaAway = clamp(as.atk / hs.def, 0.05, 6);
    const gh = poissonSample(lambdaHome, rng), ga = poissonSample(lambdaAway, rng);
    const myGoals = fx.home ? gh : ga, oppGoals = fx.home ? ga : gh;
    const diff = myGoals - oppGoals;
    winStreak = diff > 0 ? winStreak + 1 : 0;
    unbeaten = diff >= 0 ? unbeaten + 1 : 0;
    longestWin = Math.max(longestWin, winStreak);
    longestUnbeaten = Math.max(longestUnbeaten, unbeaten);
  });
  return { longestWin, longestUnbeaten };
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function runBatch(enabled, seasons) {
  const rng = mulberry32(enabled ? 987654321 : 123456789);
  const longestWins = [], longestUnbeatens = [];
  for (let i = 0; i < seasons; i++) {
    const r = simulateSeason(rng, enabled);
    longestWins.push(r.longestWin);
    longestUnbeatens.push(r.longestUnbeaten);
  }
  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const pctGE = (arr, n) => (arr.filter((v) => v >= n).length / arr.length) * 100;
  return {
    avgLongestWin: avg(longestWins).toFixed(2),
    avgLongestUnbeaten: avg(longestUnbeatens).toFixed(2),
    pctSeasonsUnbeaten10: pctGE(longestUnbeatens, 10).toFixed(1),
    pctSeasonsUnbeaten15: pctGE(longestUnbeatens, 15).toFixed(1),
    pctSeasonsWin10: pctGE(longestWins, 10).toFixed(1),
    maxLongestUnbeaten: Math.max(...longestUnbeatens),
  };
}

const SEASONS = 5000;
const before = runBatch(false, SEASONS);
const after = runBatch(true, SEASONS);
console.log(`=== GE-BALANCE-001: ${SEASONS} temporadas simuladas, clube humano atk=${HUMAN.atk} def=${HUMAN.def} ===`);
console.log("ANTES (sem motivação do adversário):", before);
console.log("DEPOIS (com motivação do adversário):", after);
