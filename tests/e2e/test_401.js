const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("console", (msg) => { if (msg.type() === "error") console.log("CONSOLE ERROR:", msg.text()); });

  const base = "http://localhost:8787";
  const email = `authtest${Date.now()}@teste.com`;

  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Teste Auth", email, password: "senha123", phone: "11999999999", plan: "freemium" }),
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

  // Simula sessão expirada: apaga o cookie de sessão diretamente
  await page.context().clearCookies();

  await page.click("#btnSimulate");
  await page.waitForTimeout(600);

  const toastText = await page.evaluate(() => document.getElementById("toast").textContent);
  console.log("TOAST:", JSON.stringify(toastText));
  const loginScreenVisible = await page.evaluate(() => !document.getElementById("screenLoginRequired").classList.contains("hidden"));
  console.log("LOGIN SCREEN VISIBLE:", loginScreenVisible);
  await page.screenshot({ path: "401-test.png" });

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
