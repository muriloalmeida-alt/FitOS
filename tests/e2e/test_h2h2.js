const { chromium } = require("playwright-core");
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `h2h2${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "H2H Teste 2", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  const opponentId = await page.evaluate(() => document.getElementById("nextMatchBox").dataset.opponentId);
  console.log("Adversário da rodada 1:", opponentId);

  // 1) Sem matchLog -- "nunca se enfrentaram".
  await page.click("#nextMatchBox");
  await page.waitForSelector("#h2hOverlay.open", { timeout: 3000 });
  await page.waitForTimeout(150);
  const before = await page.evaluate(() => ({
    record: document.getElementById("h2hRecord").textContent,
    sub: document.getElementById("h2hSub").textContent,
  }));
  console.log("1) H2H sem histórico:", before.record === "—" && /ainda não/.test(before.sub), JSON.stringify(before));
  await page.click("#h2hClose");
  await page.waitForTimeout(150);

  // 2) Injeta matchLog manualmente (2 vitórias, 1 empate, 1 derrota contra o mesmo adversário).
  await page.evaluate((oppId) => {
    CAREER.matchLog = [
      { seasonYear: 2023, round: 10, opponentId: oppId, home: true, gh: 3, ga: 1 },   // vitória
      { seasonYear: 2022, round: 25, opponentId: oppId, home: false, gh: 0, ga: 2 },  // vitória (fora, ga=meu)
      { seasonYear: 2022, round: 5, opponentId: oppId, home: true, gh: 1, ga: 1 },    // empate
      { seasonYear: 2021, round: 30, opponentId: oppId, home: false, gh: 2, ga: 0 },  // derrota
    ];
  }, opponentId);
  await page.click("#nextMatchBox");
  await page.waitForSelector("#h2hOverlay.open", { timeout: 3000 });
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => ({
    record: document.getElementById("h2hRecord").textContent,
    sub: document.getElementById("h2hSub").textContent,
    formDots: [...document.querySelectorAll("#h2hFormRow .m3-form-dot")].map((d) => d.textContent),
    matchRows: [...document.querySelectorAll("#h2hMatchList .m3-match-row .m3-match-score")].map((d) => d.textContent),
  }));
  console.log("2) H2H calcula V-E-D corretamente (2-1-1):", after.record === "2–1–1", JSON.stringify(after));

  await page.screenshot({ path: "m3_31_h2h.png" });
  console.log("OK");
  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
