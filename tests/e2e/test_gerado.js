const { chromium } = require("playwright-core");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const base = "http://localhost:8787";
  const email = `gerado${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Gerado Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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
  await page.click(".m3-nav-item[data-panel='elenco']");
  await page.waitForTimeout(300);
  const baseHasTag = await page.evaluate(() => document.getElementById("squadBaseList").textContent.includes("gerado"));
  console.log("Tabela de base tem 'gerado'?", baseHasTag);
  await page.screenshot({ path: "gerado-base-table.png" });
  await browser.close();
})();
