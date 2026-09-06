const { chromium } = require("playwright-core");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
    args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("fonts.googleapis") && !m.text().includes("fundingchoices")) console.log("CONSOLE ERROR:", m.text()); });

  const base = "http://localhost:8787";

  // 1) Visitante normal (sem params) continua caindo direto no app,
  // sem gate -- comportamento do "Freemium sem login" preservado.
  await page.goto(base + "/", { waitUntil: "load" });
  await page.waitForTimeout(500);
  const gateHidden = await page.evaluate(() => document.getElementById("authGate").style.display === "none");
  const shellVisible = await page.evaluate(() => document.querySelector(".shell").style.display !== "none");
  console.log("1) Visitante sem params cai direto no app (gate escondido):", gateHidden, "| shell visível:", shellVisible);

  // 2) Avatar "Entrar" continua abrindo o gate na view de LOGIN (não
  // cadastro) -- comportamento de sempre, não deveria ter mudado.
  await page.click("#avatarBtn");
  await page.waitForTimeout(300);
  const loginView = await page.evaluate(() => document.getElementById("gateLoginView").style.display);
  const signupView = await page.evaluate(() => document.getElementById("gateSignupView").style.display);
  console.log("2) Avatar 'Entrar' abre o gate na view de login:", loginView === "block" && signupView === "none");
  await page.click("#authGateClose");
  await page.waitForTimeout(200);

  // 3) ?signup=1 some da URL depois de processado (não reaparece num
  // reload acidental).
  await page.goto(base + "/?signup=1", { waitUntil: "load" });
  await page.waitForTimeout(500);
  const urlClean = !page.url().includes("signup=1");
  const gateVisible = await page.evaluate(() => document.getElementById("authGate").style.display);
  const signupViewVisible = await page.evaluate(() => document.getElementById("gateSignupView").style.display);
  console.log("3) ?signup=1 abre direto o cadastro:", gateVisible === "flex" && signupViewVisible === "block", "| URL limpa depois:", urlClean);

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
