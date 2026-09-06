const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("console", (msg) => console.log("CONSOLE", msg.type().toUpperCase() + ":", msg.text()));
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message, err.stack));
  page.on("requestfailed", (req) => console.log("REQUEST FAILED:", req.url(), req.failure()?.errorText));
  page.on("response", async (res) => {
    if (res.url().includes("/api/career")) {
      console.log(res.request().method(), res.url(), "->", res.status());
    }
  });

  const base = "http://localhost:8787";
  const email = `savetest2_${Date.now()}@teste.com`;

  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Teste Save Dois", email, password: "senha123", phone: "11999999999", plan: "freemium" }),
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

  // Vai pra escalação, muda formação, clica em Salvar
  await page.click(".m3-nav-item[data-panel='escalacao']");
  await page.waitForTimeout(300);
  await page.selectOption("#formationSelect", { index: 2 }).catch((e) => console.log("selectOption err:", e.message));
  await page.waitForTimeout(200);
  await page.click("#btnSaveLineup");
  await page.waitForTimeout(600);
  const toastText = await page.evaluate(() => document.getElementById("toast").textContent);
  console.log("TOAST AFTER SAVE CLICK:", JSON.stringify(toastText));

  // Recarrega a página (simula fechar/reabrir o navegador) e confere se persistiu
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(1000);
  const formationAfterReload = await page.evaluate(() => document.getElementById("formationSelect")?.value);
  console.log("FORMATION AFTER RELOAD:", formationAfterReload);
  await page.screenshot({ path: "save-test-after-reload.png" });

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
