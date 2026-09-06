const { chromium } = require("playwright-core");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
    args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  const base = "http://localhost:8787";
  const email = `renov${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Renov Test", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(200);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);

  // Força um jogador com moral muito baixa (recusa na certa, ver
  // proposeRenewal) e propõe renovação -- deve disparar a coletiva
  // "19" (renovação recusada).
  const setup = await page.evaluate(() => {
    const p = CAREER.squad.find((x) => x.origin === "principal");
    p.morale = 10;
    RENEW_CTX = { playerId: p.id };
    return p.id;
  });
  await page.evaluate(() => { document.getElementById("renewWageInput").value = "1"; document.getElementById("renewDurationSelect").value = "2"; proposeRenewal(); });
  await page.waitForTimeout(300);
  const pressOpen = await page.evaluate(() => document.getElementById("pressOverlay").classList.contains("open"));
  console.log("1) Renovação recusada (moral baixíssima) dispara coletiva 19:", pressOpen);
  if (pressOpen) {
    const q = await page.evaluate(() => document.getElementById("pressQuestion").textContent);
    console.log("   Pergunta é a de renovação recusada:", q.includes("recusa"));
    await page.click("#pressOptions [data-press]");
    await page.waitForTimeout(200);
  }

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
