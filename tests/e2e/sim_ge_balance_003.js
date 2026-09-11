// GE-BALANCE-003 (issue #30) — validação por simulação Monte Carlo da
// correção da fórmula de gol (atk/def -> atk*def), ANTES vs DEPOIS,
// usando os 20 clubes REAIS do Brasileirão (atk/def extraídos de
// public/js/data.js por regex, não reescritos à mão — mesma técnica
// de sim_ge_balance_001.js). Simula um campeonato de pontos corridos
// completo (turno e returno, 38 rodadas) por várias temporadas, com
// as 2 fórmulas lado a lado, pra confirmar com números reais (não só
// álgebra) que: (1) o time de defesa mais forte sofre MENOS gols em
// média com a fórmula nova (o oposto do bug relatado); (2) a
// distribuição de pontos/gols continua plausível, sem nenhum time
// dominar de forma implausível nem um "pior time real" virar
// artificialmente competitivo demais.
const fs = require("fs");
const dataJs = fs.readFileSync("/home/user/FitOS/public/js/data.js", "utf8");

// Extrai só o bloco DEMO_TEAMS (Brasileirão, 20 clubes) — mesmo
// recorte que o motor real usa pra rodadas do campeonato principal.
const demoBlockMatch = dataJs.match(/const DEMO_TEAMS = \[([\s\S]*?)\n\];/);
if (!demoBlockMatch) throw new Error("Não achou DEMO_TEAMS em data.js — arquivo mudou?");
const teamRe = /id:\s*"([^"]+)",\s*name:\s*"([^"]+)"[\s\S]*?atk:\s*([\d.]+),\s*def:\s*([\d.]+)/g;
const TEAMS = [];
let m;
while ((m = teamRe.exec(demoBlockMatch[1]))) TEAMS.push({ id: m[1], name: m[2], atk: parseFloat(m[3]), def: parseFloat(m[4]) });
if (TEAMS.length !== 20) throw new Error("Esperava 20 clubes do Brasileirão, achou " + TEAMS.length);

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function poissonSample(lambda, rng) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Turno e returno completo — cada par de times joga 2x (casa/fora).
function buildFixtures(teams) {
  const fixtures = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = 0; j < teams.length; j++) {
      if (i === j) continue;
      fixtures.push({ home: teams[i], away: teams[j] });
    }
  }
  return fixtures;
}

function simulateSeason(rng, useNewFormula) {
  const fixtures = buildFixtures(TEAMS);
  const table = {};
  TEAMS.forEach((t) => { table[t.id] = { pts: 0, j: 0, gp: 0, gc: 0 }; });
  fixtures.forEach((fx) => {
    const lambdaHome = useNewFormula
      ? clamp((fx.home.atk * fx.away.def) * 1.12, 0.05, 6)
      : clamp((fx.home.atk / fx.away.def) * 1.12, 0.05, 6);
    const lambdaAway = useNewFormula
      ? clamp(fx.away.atk * fx.home.def, 0.05, 6)
      : clamp(fx.away.atk / fx.home.def, 0.05, 6);
    const gh = poissonSample(lambdaHome, rng), ga = poissonSample(lambdaAway, rng);
    const h = table[fx.home.id], a = table[fx.away.id];
    h.j++; a.j++; h.gp += gh; h.gc += ga; a.gp += ga; a.gc += gh;
    if (gh > ga) h.pts += 3; else if (ga > gh) a.pts += 3; else { h.pts += 1; a.pts += 1; }
  });
  return table;
}

function runBatch(useNewFormula, seasons, seed) {
  const rng = mulberry32(seed);
  const totals = {};
  TEAMS.forEach((t) => { totals[t.id] = { pts: 0, gp: 0, gc: 0 }; });
  for (let s = 0; s < seasons; s++) {
    const table = simulateSeason(rng, useNewFormula);
    TEAMS.forEach((t) => {
      totals[t.id].pts += table[t.id].pts;
      totals[t.id].gp += table[t.id].gp;
      totals[t.id].gc += table[t.id].gc;
    });
  }
  const avg = {};
  TEAMS.forEach((t) => {
    avg[t.id] = {
      name: t.name, atk: t.atk, def: t.def,
      avgPts: totals[t.id].pts / seasons,
      avgGp: totals[t.id].gp / seasons,
      avgGc: totals[t.id].gc / seasons,
    };
  });
  return avg;
}

const SEASONS = 300;
const before = runBatch(false, SEASONS, 555111);
const after = runBatch(true, SEASONS, 555111); // mesma seed nos 2 lados -- só a fórmula muda

console.log(`=== GE-BALANCE-003: ${SEASONS} temporadas simuladas (20 clubes reais do Brasileirão, turno+returno=38 rodadas) ===\n`);

// 1) Time de defesa mais forte (menor .def real) e mais fraca (maior .def real).
const byDefAsc = TEAMS.slice().sort((a, b) => a.def - b.def);
const bestDef = byDefAsc[0], worstDef = byDefAsc[byDefAsc.length - 1];
console.log(`Defesa mais forte (menor def real): ${bestDef.name} (def=${bestDef.def})`);
console.log(`  ANTES (atk/def): média de gols sofridos/temporada = ${before[bestDef.id].avgGc.toFixed(2)}`);
console.log(`  DEPOIS (atk*def): média de gols sofridos/temporada = ${after[bestDef.id].avgGc.toFixed(2)}`);
console.log(`Defesa mais fraca (maior def real): ${worstDef.name} (def=${worstDef.def})`);
console.log(`  ANTES (atk/def): média de gols sofridos/temporada = ${before[worstDef.id].avgGc.toFixed(2)}`);
console.log(`  DEPOIS (atk*def): média de gols sofridos/temporada = ${after[worstDef.id].avgGc.toFixed(2)}`);
const fixedDirectionOk = after[bestDef.id].avgGc < after[worstDef.id].avgGc;
const buggyDirectionWasWrong = before[bestDef.id].avgGc > before[worstDef.id].avgGc;
console.log(`\n1) Fórmula ANTES tinha a direção ERRADA (defesa mais forte sofria MAIS gols que a mais fraca): ${buggyDirectionWasWrong}`);
console.log(`   Fórmula DEPOIS tem a direção CORRETA (defesa mais forte sofre MENOS gols que a mais fraca): ${fixedDirectionOk}`, "\n");

// 2) Ranking por pontos médios continua plausível: favoritos reais
// (Flamengo/Palmeiras, maior atk) ainda terminam no topo, sem
// nenhum time dominar de forma implausível (ex.: >90% de aproveitamento)
// nem um "pior time real" virar artificialmente competitivo demais.
const afterRanked = TEAMS.slice().sort((a, b) => after[b.id].avgPts - after[a.id].avgPts);
console.log("2) Ranking médio de pontos DEPOIS da correção (top 5 / bottom 5 de 20):");
afterRanked.slice(0, 5).forEach((t, i) => console.log(`   ${i + 1}º ${t.name} (atk=${t.atk}, def=${t.def}) — ${after[t.id].avgPts.toFixed(1)} pts/temporada`));
console.log("   ...");
afterRanked.slice(-5).forEach((t, i) => console.log(`   ${20 - 4 + i}º ${t.name} (atk=${t.atk}, def=${t.def}) — ${after[t.id].avgPts.toFixed(1)} pts/temporada`));
const maxPts = Math.max(...TEAMS.map((t) => after[t.id].avgPts));
const maxPossible = 38 * 3;
const plausible = maxPts < maxPossible * 0.85; // nenhum time com >85% de aproveitamento médio
console.log(`\n   Nenhum time com aproveitamento médio implausível (>85% dos pontos possíveis): ${plausible} (máximo observado: ${(100 * maxPts / maxPossible).toFixed(1)}%)`);

// 3) Comparação lado a lado de pontos médios ANTES/DEPOIS pros 3
// favoritos reais (Flamengo/Palmeiras/Botafogo) e 3 lanternas reais
// (Mirassol/Cuiabá/Juventude) — confirma que ninguém "piora de forma
// implausível nem melhora artificialmente além do razoável".
console.log("\n3) Pontos médios ANTES vs DEPOIS (favoritos e lanternas reais):");
["fla", "pal", "bot", "mir", "cui", "juv"].forEach((id) => {
  const t = TEAMS.find((x) => x.id === id);
  if (!t) return;
  console.log(`   ${t.name}: ANTES=${before[id].avgPts.toFixed(1)} pts | DEPOIS=${after[id].avgPts.toFixed(1)} pts | Δ=${(after[id].avgPts - before[id].avgPts).toFixed(1)}`);
});
