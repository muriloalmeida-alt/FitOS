// Verifica que o toast "Reputação X · Moral do elenco Y" (disparado
// AINDA com a coletiva de imprensa aberta, sem rodapé fixo) se
// reposiciona sozinho quando a tela troca pra Notícias (rodapé fixo
// de verdade) enquanto ele ainda está visível.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 700 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `toastreposiciona${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Toast Reposiciona", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  // Força a coletiva de imprensa a SEMPRE aparecer (oposto do hábito
  // usual nos outros testes) -- é justo essa tela sem rodapé fixo que
  // reproduz o bug.
  await page.evaluate(() => {
    Object.keys(PRESS_CHANCE_BY_ID).forEach((k) => { PRESS_CHANCE_BY_ID[k] = 1; });
  });

  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(200);
  await page.click("#btnSimulate");
  await page.waitForSelector("#preMatchOverlay.open", { timeout: 5000 });
  await page.click("#btnPreMatchGo");
  await page.waitForSelector("#liveMatchOverlay.open", { timeout: 5000 });
  await page.evaluate(() => skipLiveMatch());
  await page.waitForSelector("#matchDetailOverlay.open", { timeout: 5000 });
  await page.click("#btnMatchDetailContinue");
  await page.waitForSelector("#pressOverlay.open", { timeout: 5000 });

  // Confere ANTES de responder: a coletiva realmente não tem rodapé
  // fixo (é o cenário que expõe o bug).
  const pressHasFooter = await page.evaluate(() => !!document.querySelector("#pressOverlay .ct-modal-footer"));
  console.log("0) Coletiva de imprensa não tem rodapé fixo (cenário do bug):", !pressHasFooter);

  await page.click("#pressOptions [data-press]");
  // Não espera nada -- o toast já deve ter dado o primeiro cálculo
  // (na tela da coletiva, ainda aberta) e a transição pra Notícias
  // acontece toda em seguida, síncrona.
  await page.waitForSelector("#newsOverlay.open", { timeout: 5000 });
  // Espera um pouco MAIS pro reposicionamento (a cada 150ms) rodar
  // pelo menos uma vez depois da troca de tela.
  await page.waitForTimeout(400);

  const state = await page.evaluate(() => {
    const toastEl = document.getElementById("toast");
    const footer = document.getElementById("newsFooter");
    const t = toastEl.getBoundingClientRect();
    const f = footer.getBoundingClientRect();
    return {
      toastText: toastEl.textContent,
      toastVisible: toastEl.style.display === "flex",
      toastBottom: t.bottom,
      footerTop: f.top,
      gap: f.top - t.bottom,
    };
  });
  console.log("1) Toast ainda visível (dentro dos 4s) com o texto de reputação/moral:", state.toastVisible && state.toastText.includes("Reputação"));
  console.log("2) Toast reposicionado acima do rodapé de Notícias (gap >= 0), não mais preso na posição da coletiva:", state.gap >= 0, JSON.stringify(state));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
