const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));

  const base = "http://localhost:8787";
  const email = `migration${Date.now()}@teste.com`;

  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Migration Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  // Simula um save BEM ANTIGO: remove TODOS os campos de todas as
  // fases 2/3, e também remove wage/value/contractUntil de cada
  // jogador (pra simular squad criado antes da Fase 2b existir).
  await page.evaluate(async () => {
    const r = await fetch("/api/career");
    const data = await r.json();
    delete data.career.finances;
    delete data.career.leagueSquads;
    delete data.career.teamStats;
    delete data.career.transferLog;
    delete data.career.pendingOffer;
    delete data.career.lastBoardRequestRound;
    delete data.career.boardDecision;
    delete data.career.recentForm;
    delete data.career.seasonYear;
    delete data.career.seasonHistory;
    data.career.squad.forEach((p) => { delete p.wage; delete p.value; delete p.contractUntil; });
    await fetch("/api/career", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data.career) });
  });

  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(1500);
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 400));
  console.log("BODY (save pré-Fase2 inteiro):", bodyText);
  await page.screenshot({ path: "migration-fixed.png" });

  // Confirma que persistiu os campos migrados
  const afterMigration = await page.evaluate(async () => {
    const r = await fetch("/api/career");
    const data = await r.json();
    return {
      finances: data.career.finances,
      seasonYear: data.career.seasonYear,
      firstPlayerWage: data.career.squad[0].wage,
    };
  });
  console.log("Depois da migração (persistido):", JSON.stringify(afterMigration));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
