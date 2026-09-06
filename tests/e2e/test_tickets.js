const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));

  const base = "http://localhost:8787";
  const email = `tickets${Date.now()}@teste.com`;

  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Tickets Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });

  await page.goto(base + "/carreira.html", { waitUntil: "load" });
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(200);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(300);

  let sawHomeGame = false;
  for (let i = 0; i < 8 && !sawHomeGame; i++) {
    await page.click("#btnSimulate");
    await page.waitForTimeout(400);
    const matchOpen = await page.evaluate(() => document.getElementById("matchDetailOverlay").classList.contains("open"));
    if (matchOpen) {
      const ticketsText = await page.evaluate(() => document.getElementById("matchDetailTickets").textContent);
      if (ticketsText) {
        sawHomeGame = true;
        console.log(`Rodada ${i + 1} (casa):`, ticketsText);
        await page.screenshot({ path: "tickets-home-game.png" });
      }
      await page.click("#btnMatchDetailContinue");
      await page.waitForTimeout(300);
    }
    if (await page.evaluate(() => document.getElementById("roundResultsOverlay").classList.contains("open"))) {
      await page.click("#btnRoundResultsContinue"); await page.waitForTimeout(300);
    }
    await page.click(".m3-nav-item[data-panel='central']").catch(() => {});
  }
  const finalCash = await page.evaluate(async () => (await (await fetch("/api/career")).json()).career.finances.cash);
  const recentForm = await page.evaluate(async () => (await (await fetch("/api/career")).json()).career.recentForm);
  console.log("Viu jogo em casa com receita:", sawHomeGame);
  console.log("Caixa final:", finalCash);
  console.log("Forma recente:", JSON.stringify(recentForm));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
