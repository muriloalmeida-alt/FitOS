const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());

  const base = "http://localhost:8787";
  const email = `moraleseason${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Morale Season", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  const results = await page.evaluate(() => {
    const out = {};
    // Caso 1: moral no teto (100), salário justo -- deve regredir rumo a 70.
    const pA = CAREER.squad.find((p) => p.origin === "principal");
    pA.morale = 100;
    pA.wage = fairWageFor(pA); // exatamente o "justo" -- ratio 1, sem efeito de salário
    // Caso 2: moral neutra (70), mal pago (metade do justo) -- deve cair.
    const pB = CAREER.squad.filter((p) => p.origin === "principal")[1];
    pB.morale = 70;
    pB.wage = Math.round(fairWageFor(pB) * 0.5);
    // Caso 3: moral neutra (70), bem pago (o dobro do justo) -- deve subir.
    const pC = CAREER.squad.filter((p) => p.origin === "principal")[2];
    pC.morale = 70;
    pC.wage = Math.round(fairWageFor(pC) * 2);

    applySeasonMoraleReset(CAREER.squad);

    return {
      regressaoDoTeto: pA.morale, // esperado: round(100 + (70-100)*0.3) = 91
      malPago: pB.morale, // esperado: round(70 + 0*0.3) - 6 = 64
      bemPago: pC.morale, // esperado: round(70 + 0*0.3) + 4 = 74
    };
  });
  console.log(JSON.stringify(results, null, 2));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
