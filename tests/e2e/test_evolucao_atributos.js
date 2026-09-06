// Nova feature (pedido do usuário: "os atributos precisam ser mais
// reais. Com os treinos chega um momento que todos os atletas estão
// em 99. Precisamos ter uma evolução menos agressiva e os jogadores
// tbm podem perder atributos naturalmente") — ver derivePotentialForAdult/
// attributeTrainingGain/backfillPlayerPotential em carreira.js.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `evolucao${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Evolucao Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(300);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.waitForTimeout(1500);
  await page.click("#btnClaimDailyLogin").catch(() => {});
  await page.waitForTimeout(200);

  // 0) Todo jogador do elenco (real, vindo de buildRealPlayer) já
  // nasce com potential definido e >= overall.
  const check0 = await page.evaluate(() => ({
    total: CAREER.squad.length,
    allHavePotential: CAREER.squad.every((p) => p.potential != null && p.potential >= p.overall && p.potential <= 99),
    sample: CAREER.squad.slice(0, 3).map((p) => ({ name: p.name, age: p.age, overall: p.overall, potential: p.potential })),
  }));
  console.log("0) Todo jogador nasce com potential >= overall (buildRealPlayer):", check0.allHavePotential, JSON.stringify({ total: check0.total, sample: check0.sample }));

  // 1) Jogador JOVEM com teto alto: treino técnico intenso, semana
  // após semana, converge pro potencial e NUNCA passa dele -- mesmo
  // repetindo 60 vezes (bem mais que uma temporada inteira, 38
  // rodadas).
  const check1 = await page.evaluate(() => {
    const p = CAREER.squad.find((x) => x.origin === "principal");
    p.age = 19; p.overall = 60; p.potential = 75;
    CAREER.trainingPlan = defaultTrainingPlan("pretemporada"); // físico intenso -- vamos forçar técnico manualmente
    CAREER.trainingPlan[0] = { foco: "tecnico", intensidade: "intensa", grupo: "principal" };
    CAREER.trainingPlan[1] = { foco: "tecnico", intensidade: "intensa", grupo: "principal" };
    CAREER.trainingPlan[2] = { foco: "tecnico", intensidade: "intensa", grupo: "principal" };
    CAREER.trainingPlan[3] = { foco: "tecnico", intensidade: "intensa", grupo: "principal" };
    let maxSeen = p.overall;
    let everExceeded = false;
    for (let i = 0; i < 60; i++) {
      CAREER.trainingAppliedForRound = null; // bypassa a idempotência por rodada (não avançamos rodada de verdade aqui)
      applyWeeklyTraining();
      if (p.overall > p.potential) everExceeded = true;
      maxSeen = Math.max(maxSeen, p.overall);
    }
    return { finalOverall: p.overall, potential: p.potential, everExceeded, reachedPotential: p.overall === p.potential };
  });
  console.log("1) Jogador jovem (potencial 75) converge pro teto em 60 semanas de treino técnico intenso, sem NUNCA passar dele:",
    !check1.everExceeded && check1.reachedPotential, JSON.stringify(check1));

  // 2) Jogador VETERANO (30+) nasce com potential === overall (sem
  // espaço) -- treino técnico intenso não move o overall dele NADA,
  // mesmo repetindo várias semanas.
  const check2 = await page.evaluate(() => {
    const p = CAREER.squad.find((x) => x.origin === "principal" && x.id !== CAREER.squad[0].id) || CAREER.squad[1];
    p.age = 34; p.overall = 70; p.potential = derivePotentialForAdult(70, 34, Math.random); // sem espaço (30+)
    const before = p.overall;
    for (let i = 0; i < 20; i++) {
      CAREER.trainingAppliedForRound = null;
      applyWeeklyTraining();
    }
    return { before, after: p.overall, potential: p.potential, noRoom: p.potential === before };
  });
  console.log("2) Veterano (34 anos) nasce sem espaço de crescimento (potential === overall) e treino não move nada:",
    check2.noRoom && check2.after === check2.before, JSON.stringify(check2));

  // 3) Ganho de treino agora é PROBABILÍSTICO/decrescente perto do
  // teto -- rodando várias semanas com pouco espaço restante (5
  // pontos), a MÉDIA de ganho por semana é bem menor que o baseGain
  // cheio (4, treino intenso) -- prova que não é mais um "+4 garantido
  // toda semana" até bater o teto de repente.
  const check3 = await page.evaluate(() => {
    const gainsSeen = [];
    for (let trial = 0; trial < 40; trial++) {
      const before = 70;
      let cur = before;
      const ceiling = 75; // 5 pontos de espaço
      // 1 tentativa de ganho isolada (chance = room/15, room encolhe a
      // cada unidade convertida dentro de attributeTrainingGain).
      cur += attributeTrainingGain(cur, ceiling, 4);
      gainsSeen.push(cur - before);
    }
    const avg = gainsSeen.reduce((a, b) => a + b, 0) / gainsSeen.length;
    return { avg, samples: gainsSeen.slice(0, 10), neverExceeds5: gainsSeen.every((g) => g <= 5) };
  });
  console.log("3) Ganho por semana com pouco espaço restante (5 pontos) é bem menor que o baseGain cheio (4) na média, nunca passa do espaço:",
    check3.avg < 3.5 && check3.neverExceeds5, JSON.stringify({ avg: check3.avg, samples: check3.samples }));

  // 4) Migração: jogador SEM potential (save antigo) recebe um valor
  // retroativo determinístico (mesmo valor sempre, mesma seed) ao
  // rodar migrateCareerDefaults(), coerente com idade/overall.
  const check4 = await page.evaluate(() => {
    const p = CAREER.squad[2];
    delete p.potential;
    migrateCareerDefaults();
    const first = p.potential;
    delete p.potential;
    migrateCareerDefaults();
    const second = p.potential;
    return { hasPotentialNow: first != null, deterministic: first === second, coherent: first >= p.overall };
  });
  console.log("4) Migração dá potential retroativo determinístico (mesma seed sempre) e coerente (>= overall):",
    check4.hasPotentialNow && check4.deterministic && check4.coherent, JSON.stringify(check4));

  // 5) Maturação natural (applyNaturalAgingEvolution) também respeita
  // o teto -- jovem com growChance sempre positivo (Math.random
  // forçado a 0, sempre "cresce") repetido MUITAS vezes nunca passa do
  // potential, mesmo sem treino nenhum envolvido.
  const check5 = await page.evaluate(() => {
    const p = CAREER.squad.find((x) => x.origin === "principal");
    p.age = 19; p.overall = 60; p.atk = 60; p.def = 60; p.phys = 60; p.potential = 65;
    const orig = Math.random;
    Math.random = () => 0; // sempre "cresce" (roll < growChance, growChance > 0 pra jovem)
    for (let i = 0; i < 100; i++) applyNaturalAgingEvolution([]);
    Math.random = orig;
    return { overall: p.overall, atk: p.atk, def: p.def, phys: p.phys, potential: p.potential, allAtCeiling: [p.overall, p.atk, p.def, p.phys].every((v) => v === p.potential) };
  });
  console.log("5) Maturação natural (mesmo forçada a crescer sempre) também para no potential, nunca passa dele:",
    check5.allAtCeiling, JSON.stringify(check5));

  // 6) Declínio natural: veterano NÃO titular (mais chance de
  // declínio) com Math.random forçado ALTO (sempre cai no ramo de
  // declínio) perde atributo de verdade, repetidamente -- "os
  // jogadores também podem perder atributos naturalmente" (pedido do
  // usuário). Declínio nunca foi limitado por teto (só pelo piso, 20)
  // -- continua exatamente como já era antes desta mudança.
  const check6 = await page.evaluate(() => {
    const p = CAREER.squad.find((x) => x.origin === "principal");
    p.age = 35; p.group = "D"; p.overall = 70; p.atk = 70; p.def = 70; p.phys = 70; p.potential = 70;
    const before = { overall: p.overall, atk: p.atk, def: p.def, phys: p.phys };
    const orig = Math.random;
    Math.random = () => 0.999; // sempre cai no ramo de declínio (roll > 1 - declineChance)
    for (let i = 0; i < 30; i++) applyNaturalAgingEvolution([]); // não jogou -- declineChance maior
    Math.random = orig;
    const after = { overall: p.overall, atk: p.atk, def: p.def, phys: p.phys };
    const allDeclined = Object.keys(before).every((k) => after[k] < before[k]);
    return { before, after, allDeclined };
  });
  console.log("6) Veterano (35 anos) sem jogar perde atributos de verdade ao longo de várias rodadas (declínio natural):",
    check6.allDeclined, JSON.stringify(check6));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
