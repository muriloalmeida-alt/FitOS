const { chromium } = require("playwright-core");
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `hooks${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Murilo Melo", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(300);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.waitForTimeout(700);
  try { await page.click("#btnClaimDailyLogin", { timeout: 1500 }); await page.waitForTimeout(200); } catch {}

  // Simula várias rodadas via engine direto (sem passar pela tela Ao Vivo)
  // pra checar rapidamente position/partida/lesao notifications.
  const result = await page.evaluate(() => {
    for (let i = 0; i < 8; i++) {
      const standingsBefore = JSON.parse(JSON.stringify(CAREER.standings));
      const round = CAREER.currentRound;
      const fixtures = (CAREER.schedule[round] || []).filter((fx) => String(fx.home) !== String(CAREER.clubId) && String(fx.away) !== String(CAREER.clubId));
      const myFx = (CAREER.schedule[round] || []).find((fx) => String(fx.home) === String(CAREER.clubId) || String(fx.away) === String(CAREER.clubId));
      const allResults = fixtures.map((fx) => resolveCpuFixture(fx, round));
      let humanMatch = null;
      if (myFx) {
        const isHome = String(myFx.home) === String(CAREER.clubId);
        const hs = isHome ? computeHumanStrength(teamById(myFx.home)) : { atk: teamById(myFx.home).atk, def: teamById(myFx.home).def, starters: pickCpuXI(leagueSquadFor(myFx.home)) };
        const as = !isHome ? computeHumanStrength(teamById(myFx.away)) : { atk: teamById(myFx.away).atk, def: teamById(myFx.away).def, starters: pickCpuXI(leagueSquadFor(myFx.away)) };
        const gh = poissonSample(clamp((hs.atk / as.def) * 1.12, 0.05, 6), Math.random);
        const ga = poissonSample(clamp(as.atk / hs.def, 0.05, 6), Math.random);
        if (isHome) applyConditionRecovery(hs.starters.map((p) => p.id)); else applyConditionRecovery(as.starters.map((p) => p.id));
        const evH = isHome ? simulatePlayerEvents(hs.starters, gh, round) : [];
        const evA = !isHome ? simulatePlayerEvents(as.starters, ga, round) : [];
        const res = { home: myFx.home, away: myFx.away, gh, ga, events: [...evH, ...evA] };
        applyResultToStandings(res);
        (CAREER.resultsByRound[round] = CAREER.resultsByRound[round] || []).push(res);
        allResults.push(res);
        humanMatch = res;
      }
      finishRoundTail(round, allResults, humanMatch, standingsBefore);
    }
    return {
      notifCount: (CAREER.notifications || []).length,
      types: [...new Set((CAREER.notifications || []).map((n) => n.type))],
      sampleTexts: (CAREER.notifications || []).slice(0, 5).map((n) => n.text),
    };
  });
  console.log("Rodadas simuladas — notificações geradas:", JSON.stringify(result, null, 2));
  await browser.close();
})();
