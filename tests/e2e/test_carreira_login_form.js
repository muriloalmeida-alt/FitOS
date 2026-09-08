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
  const email = `carreiralogin${Date.now()}@teste.com`;

  // cria a conta via API (mais rápido) e depois testa o FORM de login
  // de carreira.html de verdade.
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Login Form", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  }, { email });

  await page.goto(base + "/carreira.html", { waitUntil: "load" });
  await page.waitForTimeout(500);
  const loginVisible = await page.evaluate(() => !document.getElementById("screenLoginRequired").classList.contains("hidden"));
  console.log("1) Tela de login aparece:", loginVisible);
  await page.fill("#ctLoginEmail", email);
  await page.fill("#ctLoginPassword", "senha123");
  await page.click("#screenLoginRequired button[type=submit]");
  await page.waitForTimeout(1000);
  const loggedIn = await page.evaluate(() => document.getElementById("screenLoginRequired").classList.contains("hidden"));
  console.log("2) Login pelo formulário funciona (tela de login some):", loggedIn);
  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
