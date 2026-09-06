const { chromium } = require("playwright-core");
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `estatcheck${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Estat Check", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(200);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.waitForTimeout(700);
  try { await page.click("#btnClaimDailyLogin", { timeout: 1500 }); await page.waitForTimeout(200); } catch {}
  // simula algumas rodadas via engine (mesma técnica já usada antes)
  await page.evaluate(() => {
    for (let i = 0; i < 6; i++) {
      const standingsBefore = JSON.parse(JSON.stringify(CAREER.standings));
      const round = CAREER.currentRound;
      const fixtures = (CAREER.schedule[round] || []).filter((fx) => String(fx.home) !== String(CAREER.clubId) && String(fx.away) !== String(CAREER.clubId));
      const allResults = fixtures.map((fx) => resolveCpuFixture(fx, round));
      finishRoundTail(round, allResults, null, standingsBefore);
    }
  });
  await page.evaluate(() => { switchToPanel("estatisticas"); renderEstatisticas(); });
  await page.waitForTimeout(200);
  const rows = await page.evaluate(() => document.querySelectorAll("#leagueTopScorersTable .mt-mini-row").length);
  console.log("Linhas de artilheiro da liga depois de 6 rodadas:", rows);
  if (rows > 0) {
    await page.click("#leagueTopScorersTable .mt-mini-row:first-child .mt-mini-col.name");
    await page.waitForTimeout(150);
    const opened = await page.evaluate(() => document.getElementById("detailOverlay").classList.contains("open"));
    console.log("Nome do artilheiro abre Perfil:", opened);
  }
  await browser.close();
})();
