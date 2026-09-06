const { chromium } = require("playwright-core");
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `h2h${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "H2H Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300);

  // 1) Sem matchLog ainda -- abrir H2H mostra "nunca se enfrentaram".
  const opponentId = await page.evaluate(() => document.getElementById("nextMatchBox").dataset.opponentId);
  await page.click("#nextMatchBox");
  await page.waitForSelector("#h2hOverlay.open", { timeout: 3000 });
  await page.waitForTimeout(150);
  const before = await page.evaluate(() => ({
    record: document.getElementById("h2hRecord").textContent,
    sub: document.getElementById("h2hSub").textContent,
    oppName: document.getElementById("h2hOppName").textContent,
  }));
  console.log("1) H2H abre sem histórico ainda:", before.record === "—" && /nunca/.test(before.sub), JSON.stringify(before));
  await page.click("#h2hClose");
  await page.waitForTimeout(150);

  // 2) Simula 3 rodadas via skip, confere que matchLog registra.
  for (let i = 0; i < 3; i++) {
    await page.click("#btnSimulate");
    await page.waitForSelector("#preMatchOverlay.open", { timeout: 5000 });
    await page.click("#btnPreMatchGo");
    await page.waitForSelector("#liveMatchOverlay.open", { timeout: 5000 });
    await page.click("#btnLiveSkip");
    await page.waitForSelector("#matchDetailOverlay.open, #roundResultsOverlay.open", { timeout: 10000 });
    await page.waitForTimeout(300);
    if (await page.evaluate(() => document.getElementById("matchDetailOverlay").classList.contains("open"))) {
      await page.click("#btnMatchDetailContinue");
      await page.waitForTimeout(300);
      if (await page.evaluate(() => document.getElementById("pressOverlay").classList.contains("open"))) {
        await page.click("#pressOptions [data-press]");
        await page.waitForTimeout(300);
      }
      await page.waitForSelector("#newsOverlay.open", { timeout: 5000 });
      await page.click("#btnNewsContinue");
      await page.waitForTimeout(300);
    }
    if (await page.evaluate(() => document.getElementById("roundResultsOverlay").classList.contains("open"))) {
      await page.click("#btnRoundResultsContinue");
      await page.waitForTimeout(300);
      if (await page.evaluate(() => document.getElementById("playerOfferOverlay")?.classList.contains("open"))) {
        await page.click("#playerOfferClose");
        await page.waitForTimeout(200);
      }
      if (await page.evaluate(() => !document.getElementById("panel-central").classList.contains("active"))) {
        await page.click(".m3-nav-item[data-panel='central']");
        await page.waitForTimeout(200);
      }
    }
  }
  const matchLogLen = await page.evaluate(() => (CAREER.matchLog || []).length);
  console.log("2) matchLog registrou as 3 partidas jogadas:", matchLogLen === 3, matchLogLen);

  await page.click("#nextMatchBox");
  await page.waitForSelector("#h2hOverlay.open", { timeout: 3000 });
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => ({
    matchListRows: document.querySelectorAll("#h2hMatchList .m3-match-row").length,
    formDots: document.querySelectorAll("#h2hFormRow .m3-form-dot").length,
  }));
  console.log("3) H2H mostra a lista de confrontos (mesmo sem repetir adversário, deve ser 0 rows contra o NOVO adversário):", after.matchListRows === 0, JSON.stringify(after));

  await page.screenshot({ path: "m3_31_h2h.png" });
  console.log("OK");
  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
