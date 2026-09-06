// Confere que persistCareer() funciona de verdade numa carreira
// "multi" depois de simular uma rodada inteira (não só na criação) --
// é aqui que o bug do save "grande demais" (413) apareceria se a
// correção de tamanho não fosse suficiente.
const { chromium } = require("playwright-core");
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `mercadopersist${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Mercado Persist", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  // Simula uma rodada inteira via UI de verdade (persistCareer roda
  // dentro do fluxo normal de "Ir para o jogo").
  await page.click("#btnSimulate");
  await page.waitForSelector("#preMatchOverlay.open", { timeout: 5000 });
  await page.click("#btnPreMatchGo");
  await page.waitForSelector("#liveMatchOverlay.open", { timeout: 5000 });
  await page.evaluate(() => skipLiveMatch());
  await page.waitForSelector("#matchDetailOverlay.open, #roundResultsOverlay.open", { timeout: 10000 });
  await page.waitForTimeout(500);

  // Confere direto no servidor (fetch real) que o save persistiu sem
  // erro -- não só que o cliente "achou" que salvou.
  const saved = await page.evaluate(async () => {
    const r = await fetch("/api/career");
    const data = await r.json();
    return { ok: r.ok, currentRound: data.career?.currentRound, size: new Blob([JSON.stringify(data.career)]).size };
  });
  console.log("1) Save persistiu no servidor sem erro 413 depois de simular a rodada:", saved.ok && saved.currentRound === 2, JSON.stringify(saved));
  console.log("   Tamanho do save depois de 1 rodada:", (saved.size/1024).toFixed(1), "KB (limite: 768 KB)");

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
