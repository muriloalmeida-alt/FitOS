const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const base = "http://localhost:8787";
  const email = `wagecap${Date.now()}@teste.com`;

  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Wage Cap", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  // Força o teto salarial artificialmente baixo direto via API, pra
  // testar o bloqueio sem precisar simular dezenas de promoções.
  const result = await page.evaluate(async () => {
    const r = await fetch("/api/career");
    const data = await r.json();
    data.career.finances.wageCap = 1; // impossível de promover qualquer um
    await fetch("/api/career", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data.career) });
    return data.career.finances;
  });
  console.log("Teto forçado:", JSON.stringify(result));

  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(1000);
  await page.click(".m3-nav-item[data-panel='elenco']");
  await page.waitForTimeout(300);
  const baseRow = await page.$("#squadBaseList [data-id]");
  await baseRow.click();
  await page.waitForTimeout(200);
  const promoteBtn = await page.$('[data-act="promote"]');
  const disabled = await promoteBtn.evaluate((b) => b.disabled);
  console.log("Botão promover desabilitado (teto=1):", disabled);
  await page.screenshot({ path: "wagecap-blocked.png" });

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
