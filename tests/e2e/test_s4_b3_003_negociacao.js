// Testa a migração da tela Negociação/Proposta pro Design System novo
// (S4-B3-003, issue #19). Cobre o que foi de fato alterado: "Fazer
// proposta" virou um Dialog dinâmico (openM3Dialog(), S3-DS20-S4-PREP-001)
// no lugar do antigo #offerOverlay estático, e cada linha de "Minhas
// propostas" agora usa o TransferCard (transferCardHTML(), S4-B3-001)
// no lugar do antigo .mt-sponsor-proposal-row (reaproveitado de um
// contexto de patrocínio sem relação com transferência).
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("console", (msg) => { if (msg.type() === "error") console.log("CONSOLE ERROR:", msg.text()); });
  const base = "http://localhost:8787";
  const email = `s4b3003_${Date.now()}@teste.com`;

  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "S4B3003 Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForSelector(".m3-club-row", { timeout: 15000 });
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnOnboardSkip", { timeout: 2000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);

  await page.click(".m3-nav-item[data-panel='mercado']");
  await page.waitForTimeout(400);

  // 1) "Fazer proposta" abre um Dialog de verdade (.m3-dialog-overlay,
  // não mais #offerOverlay estático) com foco automático e os campos
  // certos.
  await page.click("#marketList [data-buy]");
  await page.waitForTimeout(250);
  const dialog = await page.evaluate(() => {
    const overlay = document.querySelector(".m3-dialog-overlay.open");
    const oldOverlay = document.getElementById("offerOverlay");
    return {
      isDialog: !!overlay, oldOverlayExists: !!oldOverlay,
      hasValueInput: !!document.getElementById("offerValueInput"),
      hasInstallmentsSelect: !!document.getElementById("offerInstallmentsSelect"),
      focusedIsValueInput: document.activeElement?.id === "offerValueInput",
      title: overlay?.querySelector(".m3-dialog-header h3")?.textContent,
    };
  });
  console.log("1) 'Fazer proposta' abre Dialog dinâmico (não mais #offerOverlay estático), foco no valor:",
    dialog.isDialog && !dialog.oldOverlayExists && dialog.hasValueInput && dialog.hasInstallmentsSelect && dialog.focusedIsValueInput && dialog.title === "Fazer proposta",
    JSON.stringify(dialog));

  // 2) Esc fecha o Dialog (mesmo comportamento do Dialog em qualquer
  // outro lugar do app, ver openPlayerCard) sem enviar nada.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  const closedByEsc = await page.evaluate(() => !document.querySelector(".m3-dialog-overlay.open") && (CAREER.pendingOffersOut || []).length === 0);
  console.log("2) Esc fecha o Dialog sem enviar proposta:", closedByEsc);

  // 3) Enviar a proposta de verdade funciona (clique real no botão
  // dentro do Dialog) e o Dialog fecha sozinho depois.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);
  await page.click("#marketList [data-buy]");
  await page.waitForTimeout(200);
  // 2b) Regressão do bug crítico achado nesta demanda: o overlay do
  // Dialog precisa estar de fato position:fixed/z-index:500 (não
  // "auto"/"static") — sem isso o botão de confirmar fica sob a nav
  // fixa e nem chega a ser clicável. Ver comentário corrigido em
  // carreira.html (regra .m3-dialog-overlay/.m3-bottom-sheet-overlay).
  const overlayCss = await page.evaluate(() => {
    const overlay = document.querySelector(".m3-dialog-overlay");
    const btn = document.getElementById("btnOfferConfirm");
    const rect = btn?.getBoundingClientRect();
    const atPoint = rect ? document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) : null;
    return {
      zIndex: overlay ? getComputedStyle(overlay).zIndex : null,
      position: overlay ? getComputedStyle(overlay).position : null,
      atPointIsConfirmBtn: atPoint?.id === "btnOfferConfirm",
    };
  });
  console.log("2b) Overlay do Dialog é position:fixed/z-index:500 de verdade (não auto/static) e o botão de confirmar é o elemento clicável no seu próprio ponto:",
    overlayCss.zIndex === "500" && overlayCss.position === "fixed" && overlayCss.atPointIsConfirmBtn, JSON.stringify(overlayCss));
  await page.click("#btnOfferConfirm");
  await page.waitForTimeout(250);
  const sent = await page.evaluate(() => ({
    dialogClosed: !document.querySelector(".m3-dialog-overlay.open"),
    offerCount: (CAREER.pendingOffersOut || []).length,
  }));
  console.log("3) Confirmar dentro do Dialog envia a proposta e fecha sozinho:",
    sent.dialogClosed && sent.offerCount === 1, JSON.stringify(sent));

  // 4) "Minhas propostas" mostra a proposta como TransferCard
  // (.m3-op-card), não mais .mt-sponsor-proposal-row. Enviar a
  // proposta leva pra Central (finishOperationAndGoHome(), fluxo já
  // existente, não alterado aqui) — volta pro Mercado antes de abrir
  // "Minhas propostas".
  await page.click(".m3-nav-item[data-panel='mercado']");
  await page.waitForTimeout(300);
  await page.click("#btnOpenMyOffers");
  await page.waitForTimeout(250);
  const myOffers = await page.evaluate(() => {
    const card = document.querySelector("#myOffersList .m3-op-card");
    return {
      hasCard: !!card, oldRows: document.querySelectorAll("#myOffersList .mt-sponsor-proposal-row").length,
      hasName: !!card?.querySelector(".m3-op-name")?.textContent,
      hasClub: !!card?.querySelector(".m3-op-club"),
      metaText: card?.querySelector(".m3-op-detail")?.textContent,
      hasWithdrawBtn: !!card?.querySelector("[data-withdraw]"),
      hasIncreaseOrCompareBtn: !!(card?.querySelector("[data-increase]") || card?.querySelector("[data-compare]")),
    };
  });
  console.log("4) 'Minhas propostas' usa TransferCard (.m3-op-card), zero .mt-sponsor-proposal-row:",
    myOffers.hasCard && myOffers.oldRows === 0 && myOffers.hasName && myOffers.hasClub
    && (myOffers.metaText || "").includes("aguardando resposta") && myOffers.hasWithdrawBtn && myOffers.hasIncreaseOrCompareBtn,
    JSON.stringify(myOffers));

  // 5) Retirar a proposta continua funcionando (fluxo de decisão
  // preservado, mesma função de sempre).
  await page.click("#myOffersList [data-withdraw]");
  await page.waitForTimeout(200);
  const withdrawn = await page.evaluate(() => (CAREER.pendingOffersOut || []).length === 0 && document.querySelectorAll("#myOffersList .m3-op-card").length === 0);
  console.log("5) Retirar a proposta continua funcionando:", withdrawn);

  await page.screenshot({ path: "s4_b3_003_negociacao.png" }).catch(() => {});

  await browser.close();
})();
