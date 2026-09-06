// Pedido do usuário: "a transição das telas está muito dura. Da pra
// melhorar?" — animação de entrada (fade+leve deslize) em troca de aba
// e abertura de modal, via CSS puro (sem tocar switchToPanel/close()).
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `transicoes${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Transicoes Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(300);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.waitForTimeout(700);
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300);

  // 1) Trocar de aba dispara a animação de entrada no painel novo.
  await page.click(".m3-nav-item[data-panel='elenco']");
  const anim1 = await page.evaluate(() => {
    const p = document.getElementById("panel-elenco");
    const cs = getComputedStyle(p);
    return { name: cs.animationName, duration: cs.animationDuration };
  });
  console.log("1) Trocar de aba anima o painel novo (fade+leve subida):", anim1.name === "ctPanelIn" && anim1.duration !== "0s", JSON.stringify(anim1));

  // 2) Trocar de aba de novo (Elenco -> Mercado) reanima (classe é
  // removida e recolocada a cada troca).
  await page.click(".m3-nav-item[data-panel='mercado']");
  const anim2 = await page.evaluate(() => getComputedStyle(document.getElementById("panel-mercado")).animationName);
  console.log("2) Trocar de aba de novo também anima (não gruda só na 1ª vez):", anim2 === "ctPanelIn");

  // 3) O painel continua 100% funcional depois da animação acabar
  // (espera passar da duração, confere conteúdo real renderizado).
  await page.waitForTimeout(400);
  const marketVisible = await page.evaluate(() => {
    const p = document.getElementById("panel-mercado");
    return p.classList.contains("active") && getComputedStyle(p).display !== "none" && p.querySelectorAll(".mt-market-row").length > 0;
  });
  console.log("3) Depois da animação, o painel continua ativo/visível com conteúdo de verdade:", marketVisible);

  // 4) Abrir uma modal (bottom sheet) dispara a animação de entrada
  // (fundo + folha).
  const buyBtn = await page.$("[data-buy]");
  await buyBtn.click();
  await page.waitForSelector("#offerOverlay.open", { timeout: 3000 });
  const anim3 = await page.evaluate(() => ({
    overlay: getComputedStyle(document.getElementById("offerOverlay")).animationName,
    sheet: getComputedStyle(document.querySelector("#offerOverlay .ct-modal")).animationName,
  }));
  console.log("4) Abrir modal anima o fundo + a folha:", anim3.overlay === "ctOverlayIn" && anim3.sheet === "ctSheetIn", JSON.stringify(anim3));
  await page.waitForTimeout(300);
  const modalUsable = await page.evaluate(() => {
    const ov = document.getElementById("offerOverlay");
    return ov.classList.contains("open") && !!document.getElementById("offerValueInput").value;
  });
  console.log("4b) Depois da animação a modal continua aberta e usável (campo preenchido):", modalUsable);
  await page.click("#offerClose");
  await page.waitForTimeout(200);
  const closedInstant = await page.evaluate(() => !document.getElementById("offerOverlay").classList.contains("open"));
  console.log("5) Fechar continua instantâneo (sem atraso nenhum):", closedInstant);

  // 6) Modal EM TELA CHEIA também anima (fundo + folha), mesmo
  // mecanismo.
  await page.click(".m3-nav-item[data-panel='elenco']");
  await page.waitForTimeout(400);
  const anyPlayer = await page.$("#panel-elenco [data-id]");
  await anyPlayer.click();
  await page.waitForSelector("#detailOverlay.open", { timeout: 3000 });
  const anim4 = await page.evaluate(() => ({
    overlay: getComputedStyle(document.getElementById("detailOverlay")).animationName,
    sheet: getComputedStyle(document.querySelector("#detailOverlay .ct-modal")).animationName,
  }));
  console.log("6) Modal em tela cheia (detalhe do jogador) também anima:", anim4.overlay === "ctOverlayIn" && anim4.sheet === "ctSheetIn", JSON.stringify(anim4));

  await browser.close();
  console.log("OK");
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
