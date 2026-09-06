const { chromium } = require("playwright-core");
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 700 } });
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";

  // 1) Viewport meta bloqueia zoom
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  const vp = await page.evaluate(() => document.querySelector('meta[name="viewport"]').content);
  console.log("1) viewport meta bloqueia zoom (maximum-scale=1, user-scalable=no):", vp.includes("maximum-scale=1.0") && vp.includes("user-scalable=no"), vp);
  const touchAction = await page.evaluate(() => getComputedStyle(document.body).touchAction);
  console.log("1b) touch-action:manipulation no body:", touchAction === "manipulation", touchAction);

  const vpHist = await page.evaluate(async () => {
    const r = await fetch("/historico.html");
    const html = await r.text();
    return /maximum-scale=1\.0/.test(html) && /user-scalable=no/.test(html);
  });
  console.log("1c) historico.html também bloqueia zoom:", vpHist);

  // login + criar carreira
  const email = `uxscroll${Date.now()}@teste.com`;
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "UX Scroll", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(200);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.waitForTimeout(700);
  try { await page.click("#btnClaimDailyLogin", { timeout: 1500 }); await page.waitForTimeout(200); } catch {}

  // 2) Scroll pro topo ao trocar de painel
  await page.click('.m3-nav-item[data-panel="elenco"]');
  await page.waitForTimeout(200);
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(100);
  const before = await page.evaluate(() => window.scrollY);
  await page.click('.m3-nav-item[data-panel="mercado"]');
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => window.scrollY);
  console.log("2) switchToPanel reseta o scroll (era > 0, virou 0):", before > 0 && after === 0, { before, after });

  // 3) Scroll interno de modal reseta ao reabrir
  await page.click(".m3-nav-item[data-panel='inicio'], .m3-nav-item[data-panel='central']").catch(() => {});
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#btnOpenSettings");
  await page.waitForTimeout(200);
  await page.evaluate(() => { document.getElementById("settingsBody").scrollTop = 200; });
  const scrollBefore = await page.evaluate(() => document.getElementById("settingsBody").scrollTop);
  await page.click("#settingsClose");
  await page.waitForTimeout(100);
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#btnOpenSettings");
  await page.waitForTimeout(150);
  const scrollAfter = await page.evaluate(() => document.getElementById("settingsBody").scrollTop);
  console.log("3) Reabrir uma modal reseta o scroll interno dela:", scrollAfter === 0, { scrollBefore, scrollAfter });

  await browser.close();
})();
