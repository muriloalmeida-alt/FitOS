const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));

  const base = "http://localhost:8787";
  const email = `board${Date.now()}@teste.com`;

  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Board Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  await page.screenshot({ path: "board-1-antes.png" });

  const financesBefore = await page.evaluate(async () => (await (await fetch("/api/career")).json()).career.finances);
  console.log("Finanças antes:", JSON.stringify(financesBefore));

  await page.click(".m3-nav-item[data-panel='clube']"); await page.waitForTimeout(200); await page.click("#btnAskBoard");
  await page.waitForTimeout(400);
  const financesAfter = await page.evaluate(async () => (await (await fetch("/api/career")).json()).career.finances);
  const decision = await page.evaluate(async () => (await (await fetch("/api/career")).json()).career.boardDecision);
  console.log("Finanças depois:", JSON.stringify(financesAfter));
  console.log("Decisão:", decision);
  await page.screenshot({ path: "board-2-depois.png" });

  // Testa cooldown (o botão já deve estar desabilitado, sem precisar clicar de novo)
  const disabled = await page.evaluate(() => document.getElementById("btnAskBoard").disabled);
  const title = await page.evaluate(() => document.getElementById("btnAskBoard").title);
  console.log("Botão desabilitado após pedir (cooldown):", disabled, "| title:", title);

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
