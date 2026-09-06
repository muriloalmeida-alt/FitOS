const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 500 } });
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));

  const base = "http://localhost:8787";
  const email = `menutest${Date.now()}@teste.com`;

  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Menu Test", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });

  await page.goto(base + "/carreira.html", { waitUntil: "load" });
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(200);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);

  // Screenshot do header novo
  await page.screenshot({ path: "menu-1-header.png" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  console.log("overflow no header:", overflow);

  // Abre o menu hambúrguer
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(200);
  const menuOpen = await page.evaluate(() => document.getElementById("topbarMenu").classList.contains("open"));
  console.log("menu abriu:", menuOpen);
  await page.screenshot({ path: "menu-2-open.png" });

  // Clica fora fecha o menu
  await page.click("body", { position: { x: 10, y: 400 } });
  await page.waitForTimeout(200);
  const menuClosedAfterOutsideClick = await page.evaluate(() => !document.getElementById("topbarMenu").classList.contains("open"));
  console.log("fechou clicando fora:", menuClosedAfterOutsideClick);

  // Round info no card "Próximo jogo"
  const roundText = await page.evaluate(() => document.getElementById("roundPill").textContent);
  console.log("texto da rodada no card:", roundText);
  await page.screenshot({ path: "menu-3-roundcard.png" });

  // Testa logout
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(200);
  await page.click("#btnLogout");
  await page.waitForTimeout(800);
  const url = page.url();
  const meResp = await page.evaluate(async () => (await fetch("/api/auth/me")).json());
  console.log("URL depois do logout:", url, "| /api/auth/me:", JSON.stringify(meResp));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
