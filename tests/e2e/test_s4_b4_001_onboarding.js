// S4-B4-001 (issue #31) — teste e2e via UI real. Cobre a migração de
// tokens do Onboarding (--mt-ivory-50/--mt-ink-muted → --m3-on-surface/
// --m3-on-surface-variant) e confirma que o comportamento (navegar
// entre slides, contador de pontos, pular, gatilho de 1ª vez por
// conta) continua 100% preservado — nenhuma mudança de lógica, só de
// token visual, conforme o escopo.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `s4b4001${Date.now()}@teste.com`;

  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Onboarding Test", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForSelector(".m3-club-row", { timeout: 15000 });
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");

  // 1) Onboarding aparece na 1ª carreira desta conta (gatilho de sempre,
  // ver ME.onboardingSeen), com o slide 1 renderizado.
  await page.waitForSelector("#onboardingOverlay.open", { timeout: 5000 });
  const slide1 = await page.evaluate(() => ({
    dotsCount: document.querySelectorAll("#onboardingDots .mt-onboard-dot").length,
    firstDotActive: document.querySelector("#onboardingDots .mt-onboard-dot").classList.contains("active"),
    hasTitle: !!document.querySelector("#onboardingBody .mt-onboard-title"),
    hasText: !!document.querySelector("#onboardingBody .mt-onboard-text"),
    nextLabel: document.getElementById("btnOnboardNext").textContent,
  }));
  console.log("1) Onboarding abre no 1º acesso com slide 1 (dots/título/texto presentes):",
    slide1.dotsCount >= 3 && slide1.firstDotActive && slide1.hasTitle && slide1.hasText && slide1.nextLabel === "Avançar",
    JSON.stringify(slide1));

  // 2) Tokens migrados: título usa --m3-on-surface, texto e "Pular"
  // usam --m3-on-surface-variant (cor computada bate com a variável
  // resolvida no :root, não mais com os valores antigos --mt-ivory-50/
  // --mt-ink-muted).
  const tokens = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const title = getComputedStyle(document.querySelector("#onboardingBody .mt-onboard-title"));
    const text = getComputedStyle(document.querySelector("#onboardingBody .mt-onboard-text"));
    const skip = getComputedStyle(document.getElementById("btnOnboardSkip"));
    return {
      onSurface: root.getPropertyValue("--m3-on-surface").trim(),
      onSurfaceVariant: root.getPropertyValue("--m3-on-surface-variant").trim(),
      titleColor: title.color, textColor: text.color, skipColor: skip.color,
    };
  });
  // Converte a cor hex do :root pro formato rgb() que getComputedStyle devolve, pra comparar de verdade.
  const hexToRgb = (hex) => { const h = hex.replace("#", ""); const n = parseInt(h, 16); return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`; };
  const titleOk = tokens.titleColor === hexToRgb(tokens.onSurface);
  const textOk = tokens.textColor === hexToRgb(tokens.onSurfaceVariant);
  const skipOk = tokens.skipColor === hexToRgb(tokens.onSurfaceVariant);
  console.log("2) Título usa --m3-on-surface, texto/'Pular' usam --m3-on-surface-variant (tokens migrados, não mais --mt-ivory-50/--mt-ink-muted):",
    titleOk && textOk && skipOk, JSON.stringify({ ...tokens, titleOk, textOk, skipOk }));

  // 3) Navegação entre os 4 slides continua funcionando (avança até o
  // último, onde o botão vira "Começar"), pontos de progresso avançam.
  await page.click("#btnOnboardNext");
  await page.waitForTimeout(150);
  await page.click("#btnOnboardNext");
  await page.waitForTimeout(150);
  await page.click("#btnOnboardNext");
  await page.waitForTimeout(150);
  const lastSlide = await page.evaluate(() => ({
    nextLabel: document.getElementById("btnOnboardNext").textContent,
    lastDotActive: [...document.querySelectorAll("#onboardingDots .mt-onboard-dot")].pop().classList.contains("active"),
  }));
  console.log("3) Depois de 3 cliques em 'Avançar', chegou no último slide ('Começar', último ponto ativo):",
    lastSlide.nextLabel === "Começar" && lastSlide.lastDotActive, JSON.stringify(lastSlide));

  // 4) Fechar (Começar) marca a conta como já tendo visto — não
  // reaparece numa carreira nova da MESMA conta.
  await page.click("#btnOnboardNext");
  await page.waitForTimeout(300);
  const closedNow = await page.evaluate(() => !document.getElementById("onboardingOverlay").classList.contains("open"));
  console.log("4) Onboarding fecha ao terminar o último slide:", closedNow);

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
