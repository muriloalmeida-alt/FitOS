// Confere que a virada de temporada não reenche elenco de time de
// outra divisão até o piso maior (16) por engano -- deve continuar no
// piso menor (12, MIN_LEAGUE_SQUAD_OTHER_DIVISION).
const { chromium } = require("playwright-core");
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  const base = "http://localhost:8787";
  const email = `mercadoseason${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Mercado Season", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(300);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(1200);

  // Força elenco de um time de fora bem pequeno (abaixo do piso) e
  // avança temporada -- confere que reenche só até 12, não 16.
  const before = await page.evaluate(() => {
    const ownIds = new Set(Object.keys(CAREER.standings));
    const [otherId] = Object.keys(CAREER.leagueSquads).filter((id) => !ownIds.has(id));
    CAREER.leagueSquads[otherId] = CAREER.leagueSquads[otherId].slice(0, 5); // força bem pequeno
    return { otherId, sizeBefore: CAREER.leagueSquads[otherId].length };
  });
  await page.evaluate(async () => {
    CAREER.currentRound = 39;
    await fetch("/api/career", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(CAREER) });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await page.click("#btnAdvanceSeason");
  await page.waitForTimeout(300);
  await page.click("#confirmOkBtn");
  await page.waitForTimeout(600);
  const after = await page.evaluate((otherId) => ({ sizeAfter: CAREER.leagueSquads[otherId].length }), before.otherId);
  console.log("1) Elenco de time de fora reenchido até o piso MENOR (12), não o de sempre (16):", after.sizeAfter === 12, JSON.stringify({ before, after }));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
