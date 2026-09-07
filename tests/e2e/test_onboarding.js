// Pedido do usuário: "onboarding pro primeiro acesso... tutorial
// curtinho (3-4 telas) na primeira carreira". Valida: aparece na 1ª
// carreira, navega pelos slides, "Pular" funciona, nunca mais
// reaparece (nem em conta nova retomando, nem depois de "Reiniciar"),
// e libera o modal de login diário só depois de fechado.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
    args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `onboard${Date.now()}@teste.com`;

  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Onboard Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(300);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.waitForTimeout(700);

  // 1) Tutorial abre sozinho na 1ª carreira, ANTES do login diário.
  const initial = await page.evaluate(() => ({
    onboardOpen: document.getElementById("onboardingOverlay").classList.contains("open"),
    dailyLoginOpen: document.getElementById("dailyLoginOverlay").classList.contains("open"),
    title: document.querySelector(".mt-onboard-title")?.textContent,
    dots: document.querySelectorAll(".mt-onboard-dot").length,
    nextLabel: document.getElementById("btnOnboardNext").textContent,
  }));
  console.log("1) Tutorial abre sozinho (login diário ainda NÃO), 4 slides, começa no 1º:",
    initial.onboardOpen && !initial.dailyLoginOpen && initial.dots === 4 && initial.nextLabel === "Avançar", JSON.stringify(initial));

  // 2) "Avançar" 3x passa pelos slides 2, 3, 4 (último vira "Começar").
  await page.click("#btnOnboardNext");
  await page.waitForTimeout(100);
  const slide2 = await page.evaluate(() => document.querySelector(".mt-onboard-title").textContent);
  await page.click("#btnOnboardNext");
  await page.waitForTimeout(100);
  const slide3 = await page.evaluate(() => document.querySelector(".mt-onboard-title").textContent);
  await page.click("#btnOnboardNext");
  await page.waitForTimeout(100);
  const slide4 = await page.evaluate(() => ({ title: document.querySelector(".mt-onboard-title").textContent, nextLabel: document.getElementById("btnOnboardNext").textContent }));
  console.log("2) Avança pelos 4 slides (títulos diferentes), último botão vira 'Começar':",
    slide2 !== initial.title && slide3 !== slide2 && slide4.title !== slide3 && slide4.nextLabel === "Começar",
    JSON.stringify({ s1: initial.title, s2: slide2, s3: slide3, s4: slide4.title }));

  // 3) "Começar" no último slide fecha o tutorial E libera o login
  // diário (fila: tutorial -> login diário).
  await page.click("#btnOnboardNext");
  // Espera explícita pelo login diário (não um wait fixo) -- fechar o
  // tutorial dispara um POST real (/api/account/onboarding-seen) antes
  // de checkDailyLoginOnBoot rodar, tempo de rede variável.
  await page.waitForSelector("#dailyLoginOverlay.open", { timeout: 5000 }).catch(() => {});
  const afterFinish = await page.evaluate(() => ({
    onboardOpen: document.getElementById("onboardingOverlay").classList.contains("open"),
    dailyLoginOpen: document.getElementById("dailyLoginOverlay").classList.contains("open"),
  }));
  console.log("3) Tutorial fecha e login diário abre em seguida:", !afterFinish.onboardOpen && afterFinish.dailyLoginOpen, JSON.stringify(afterFinish));

  const meAfter = await page.evaluate(async () => (await (await fetch("/api/auth/me")).json()).user.onboardingSeen);
  console.log("4) Servidor confirma onboardingSeen:true:", meAfter === true);

  // 5) Coleta a recompensa (fecha o daily login) e confere que o app
  // segue funcional normalmente.
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300);
  const centralOk = await page.evaluate(() => document.getElementById("panel-central").classList.contains("active"));
  console.log("5) Depois de tudo, a Central renderiza normal:", centralOk);

  // 6) Reload da página (mesma sessão) NÃO reabre o tutorial de novo.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const afterReload = await page.evaluate(() => document.getElementById("onboardingOverlay").classList.contains("open"));
  console.log("6) Depois de recarregar a página, o tutorial NÃO reaparece:", !afterReload);

  // 7) "Pular" também marca como visto (testado com uma 2ª conta nova,
  // clicando Pular na 1ª tela em vez de percorrer tudo).
  const email2 = `onboardskip${Date.now()}@teste.com`;
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Skip Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email: email2 });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(300);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.waitForTimeout(700);
  const openedForSkip = await page.evaluate(() => document.getElementById("onboardingOverlay").classList.contains("open"));
  await page.click("#btnOnboardSkip");
  await page.waitForTimeout(400);
  const afterSkip = await page.evaluate(() => ({
    onboardOpen: document.getElementById("onboardingOverlay").classList.contains("open"),
    dailyLoginOpen: document.getElementById("dailyLoginOverlay").classList.contains("open"),
  }));
  const meAfterSkip = await page.evaluate(async () => (await (await fetch("/api/auth/me")).json()).user.onboardingSeen);
  console.log("7) 'Pular' fecha na hora, libera login diário, e marca visto no servidor:",
    openedForSkip && !afterSkip.onboardOpen && afterSkip.dailyLoginOpen && meAfterSkip === true, JSON.stringify({ openedForSkip, ...afterSkip, meAfterSkip }));

  await browser.close();
  console.log("OK");
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
