// GE-COPA-001 (issue #28) — teste e2e via UI real. Cobre a estrutura
// (constantes/prêmios), integridade de clubes por fase (60 → 56+4 →
// 32 → 16 → 8 → 4 → 2 → 1, sem duplicado/perdido), o fluxo ao vivo do
// confronto do técnico (ida e volta, reaproveitando startLiveMatch/
// resolveLiveChunk) e a compatibilidade com o formato LEGADO (save sem
// sistema de divisões continua com 16 clubes/jogo único). A validação
// estatística de várias temporadas completas já foi feita em
// tests/e2e/sim_ge_copa_001.js — este teste é sobre corretude
// estrutural e integração, não estatística.
const { chromium } = require("playwright-core");

async function newCareer(page, base, email) {
  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "GE Copa 001 Test", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "load" });
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(200);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnOnboardSkip", { timeout: 2000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("fonts.googleapis") && !m.text().includes("fundingchoices")) console.log("CONSOLE ERROR:", m.text()); });

  const base = "http://localhost:8787";
  await newCareer(page, base, `gecopa001b${Date.now()}@teste.com`);

  // 1) Estrutura: 6 fases na ordem certa, 4 cabeças de chave, prêmios
  // novos somados sem alterar os 5 valores preservados.
  const structure = await page.evaluate(() => ({
    phases: CUP_PHASES_EXPANDED, seedCount: CUP_SEED_COUNT,
    prize: CUP_PRIZE, rounds: CUP_ROUNDS_EXPANDED,
  }));
  const phasesOk = JSON.stringify(structure.phases) === JSON.stringify(["fase1", "r32", "r16", "qf", "sf", "final"]);
  const prizeOk = structure.prize.r32 === 150000 && structure.prize.r16 === 350000
    && structure.prize.qf === 500000 && structure.prize.sf === 1500000 && structure.prize.final === 4000000
    && structure.prize.champion === 10000000 && structure.prize.runnerUp === 3000000;
  const roundsOk = structure.rounds.fase1.ida === 3 && structure.rounds.fase1.volta === 6 && structure.rounds.final.volta === 36;
  console.log("1) Estrutura de fases/prêmios/calendário bate com o desenho aprovado (6 fases, 4 cabeças de chave, prêmios antigos preservados + 2 novos):",
    phasesOk && structure.seedCount === 4 && prizeOk && roundsOk, JSON.stringify(structure));

  // 2) Integridade de clubes por fase — fecha o chaveamento inteiro
  // (silent:true bypassa o vivo, mesma função real usada por
  // migração) e confere: 60 únicos no total, cada fase com o tamanho
  // certo, exatamente 1 campeão no fim.
  const integrity = await page.evaluate(() => {
    setupCupExpanded();
    const cup = CAREER.cup;
    const seen = new Set();
    const phaseSizes = {};
    let guard = 0;
    while (cup.phase !== "done" && guard++ < 20) {
      const phase = cup.phase;
      const ties = cup.ties[phase];
      phaseSizes[phase] = ties.length * 2;
      ties.forEach((t) => { seen.add(String(t.home)); seen.add(String(t.away)); });
      const rounds = CUP_ROUNDS_EXPANDED[phase];
      resolveCupPhaseExpanded(rounds.ida, { silent: true });
      resolveCupPhaseExpanded(rounds.volta, { silent: true });
    }
    return { phaseSizes, totalUniqueClubs: seen.size, champion: cup.champion, phaseFinal: cup.phase };
  });
  const sizesOk = integrity.phaseSizes.fase1 === 56 && integrity.phaseSizes.r32 === 32 && integrity.phaseSizes.r16 === 16
    && integrity.phaseSizes.qf === 8 && integrity.phaseSizes.sf === 4 && integrity.phaseSizes.final === 2;
  console.log("2) Integridade do chaveamento inteiro (60 clubes únicos, tamanho certo em cada fase, fecha num campeão só):",
    integrity.totalUniqueClubs === 60 && sizesOk && integrity.phaseFinal === "done" && !!integrity.champion, JSON.stringify(integrity));

  // 3) Fluxo ao vivo real: força o confronto do técnico na Fase 1 (ida)
  // e confere que vira partida ao vivo de verdade (mesmo
  // #liveMatchOverlay do Brasileirão), decide pelos mesmos tempos, e
  // fecha gravando o placar na perna certa do tie.
  const liveIda = await page.evaluate(async () => {
    setupCupExpanded();
    const cup = CAREER.cup;
    const myTie = cup.ties.fase1.find((t) => String(t.home) === String(CAREER.clubId) || String(t.away) === String(CAREER.clubId));
    resolveCupPhaseExpanded(CUP_ROUNDS_EXPANDED.fase1.ida); // resolve os OUTROS confrontos, defere o seu
    const deferredBefore = !!cup.pendingLiveLeg;
    const started = maybeStartPendingCupLegLive();
    const overlayOpen = document.getElementById("liveMatchOverlay").classList.contains("open");
    const isCup = !!(LIVE_MATCH && LIVE_MATCH.cupContext);
    pauseLiveMatch();
    skipLiveMatch();
    await new Promise((r) => setTimeout(r, 300));
    return {
      deferredBefore, started, overlayOpen, isCup,
      liveMatchGone: LIVE_MATCH === null,
      leg1Filled: myTie.leg1.gh != null,
      pendingClearedAfter: !cup.pendingLiveLeg,
    };
  });
  console.log("3) Confronto do técnico na Fase 1 (ida) vira ao vivo de verdade (reaproveita #liveMatchOverlay/resolveLiveChunk), decide e grava a perna:",
    liveIda.deferredBefore && liveIda.started && liveIda.overlayOpen && liveIda.isCup && liveIda.liveMatchGone && liveIda.leg1Filled && liveIda.pendingClearedAfter,
    JSON.stringify(liveIda));

  // 4) Formato LEGADO preservado: carreira SEM sistema de divisões
  // continua com a Copa de 16 clubes/jogo único, exatamente como antes
  // desta demanda.
  const legacy = await page.evaluate(() => {
    const savedPool = CAREER.serieDPool;
    delete CAREER.serieDPool; // simula save antigo, sem o sistema de divisões
    setupCup();
    const cup = CAREER.cup;
    const totalClubsR16 = new Set(cup.ties.r16.flatMap((t) => [String(t.home), String(t.away)])).size;
    CAREER.serieDPool = savedPool; // restaura pro resto do processo continuar normal
    return { expanded: cup.expanded, phase: cup.phase, hasSeeds: !!cup.seeds, totalClubsR16, hasFlatGh: cup.ties.r16.every((t) => "gh" in t) };
  });
  console.log("4) Save sem sistema de divisões continua com a Copa LEGADA (16 clubes, jogo único, sem cabeça de chave):",
    legacy.expanded === false && legacy.phase === "r16" && !legacy.hasSeeds && legacy.totalClubsR16 === 16 && legacy.hasFlatGh,
    JSON.stringify(legacy));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
