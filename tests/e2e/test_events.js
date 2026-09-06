const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));

  const base = "http://localhost:8787";
  const email = `eventstest${Date.now()}@teste.com`;

  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Teste Eventos", email, password: "senha123", phone: "11999999999", plan: "freemium" }),
    });
    await fetch("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "senha123" }),
    });
  }, { email });

  await page.goto(base + "/carreira.html", { waitUntil: "load" });
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(200);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(300);

  for (let i = 0; i < 10; i++) {
    await page.click("#btnSimulate");
    await page.waitForTimeout(400);
    const matchOpen = await page.evaluate(() => document.getElementById("matchDetailOverlay").classList.contains("open"));
    if (matchOpen) {
      const info = await page.evaluate(() => ({
        score: document.getElementById("matchDetailScore").textContent.replace(/\s+/g, " ").trim(),
        events: document.getElementById("matchDetailEvents").textContent.replace(/\s+/g, " ").trim(),
      }));
      console.log(`round ${i + 1}:`, info.score, "|", info.events);
      // Screenshot only when opponent likely scored more (heuristic: just grab first case with content)
      if (i === 0 || info.events.includes("Gol do")) {
        await page.screenshot({ path: `events-round${i + 1}.png` });
      }
      await page.click("#btnMatchDetailContinue");
      await page.waitForTimeout(300);
    }
    const resOpen = await page.evaluate(() => document.getElementById("roundResultsOverlay").classList.contains("open"));
    if (resOpen) {
      await page.click("#btnRoundResultsContinue");
      await page.waitForTimeout(300);
    }
    await page.click(".m3-nav-item[data-panel='central']").catch(() => {});
  }

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
