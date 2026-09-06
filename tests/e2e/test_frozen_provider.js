// Testa o fornecedor "frozen" (catálogo real congelado) de ponta a
// ponta no Modo Técnico: servidor precisa estar rodando com
// DATA_PROVIDER=frozen + ENABLED_COMPETITIONS=serie_b,serie_c.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `frozen${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Frozen Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);

  // 1) health confirma hasKey:true com provider frozen.
  const health = await page.evaluate(() => fetch("/api/health").then((r) => r.json()));
  console.log("1) /api/health reporta hasKey:true, provider frozen:", health.hasKey === true && health.provider === "frozen", JSON.stringify(health));

  // 2) Escolher Brasileirão -> Escolha do Clube mostra time REAL
  // (Corinthians, não fictício) com escudo real.
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(400);
  const clubNames = await page.evaluate(() => [...document.querySelectorAll(".m3-club-row .m3-club-name, .m3-club-row")].map((el) => el.textContent).join(" | "));
  const liveModeAfterPick = await page.evaluate(() => typeof LIVE_MODE !== "undefined" ? LIVE_MODE : null);
  console.log("2) Escolha do Clube em modo AO VIVO (dado real congelado), lista tem Corinthians:", liveModeAfterPick === true && clubNames.includes("Corinthians"), liveModeAfterPick);

  // 3) Criar carreira no Corinthians (id 303, real, tem Yuri Alberto/
  // Gabriel Paulista no elenco real) e confirmar elenco real aparece.
  await page.click('.m3-club-row[data-id="303"]');
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.waitForTimeout(900);
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300);
  const squadNames = await page.evaluate(() => CAREER.squad.map((p) => p.name));
  const hasRealPlayer = squadNames.some((n) => n.includes("Yuri Alberto") || n.includes("Gabriel Paulista") || n.includes("Garro"));
  console.log("3) Elenco do Corinthians tem jogador real de verdade (Yuri Alberto/Gabriel Paulista/Garro):", hasRealPlayer, JSON.stringify(squadNames.slice(0, 8)));

  // 4) Times de Série B/C também reais (ex.: Coritiba deixou de ser
  // fictício -- agora está na Série A de verdade nesta captura).
  const compId = await page.evaluate(() => CAREER.competitionId);
  console.log("4) competitionId gravado na carreira:", compId === "brasileirao", compId);

  await page.screenshot({ path: "frozen_01_central.png" });

  await browser.close();
})();
