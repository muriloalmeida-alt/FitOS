// Testa a migração da tela Mercado pro TransferCard/Design System novo
// (S4-B3-002, issue #18). Cobre o que foi de fato alterado: cada linha
// de jogador agora é um TransferCard (transferCardHTML(), S4-B3-001,
// classes .m3-op-*) no lugar do antigo .mt-market-row ad hoc — mesma
// informação, mesmos data-* de ação, só via componente nomeado.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("console", (msg) => { if (msg.type() === "error") console.log("CONSOLE ERROR:", msg.text()); });
  const base = "http://localhost:8787";
  const email = `s4b3002_${Date.now()}@teste.com`;

  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "S4B3002 Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  // 1) Lista usa TransferCard (.m3-op-card), não mais .mt-market-row.
  const rowShape = await page.evaluate(() => ({
    opCards: document.querySelectorAll("#marketList .m3-op-card").length,
    oldRows: document.querySelectorAll("#marketList .mt-market-row").length,
  }));
  console.log("1) Lista de mercado usa .m3-op-card (TransferCard), zero .mt-market-row antigo:",
    rowShape.opCards > 0 && rowShape.oldRows === 0, JSON.stringify(rowShape));

  // 2) Um card tem badge/nome/clube clicável/chip de posição/ação de
  // compra, com os data-* certos preservados.
  const firstCard = await page.evaluate(() => {
    const card = document.querySelector("#marketList .m3-op-card");
    if (!card) return null;
    return {
      hasBadge: !!card.querySelector(".mt-ovr-badge"),
      hasName: !!card.querySelector(".m3-op-name")?.textContent,
      hasClub: !!card.querySelector(".m3-op-club"),
      openPlayerAttr: card.querySelector("[data-openplayer]")?.dataset.openplayer,
      openClubAttr: card.querySelector("[data-openclub]")?.dataset.openclub,
      hasPosChip: !!card.querySelector(".mt-pos-chip"),
      hasDetail: !!card.querySelector(".m3-op-detail")?.textContent,
      cardBg: getComputedStyle(card).backgroundColor,
    };
  });
  console.log("2) Card individual: badge/nome/clube clicável/chip posição/detalhe/tokens m3:",
    !!firstCard && firstCard.hasBadge && firstCard.hasName && firstCard.hasClub && !!firstCard.openPlayerAttr
    && !!firstCard.openClubAttr && firstCard.hasPosChip && firstCard.hasDetail && firstCard.cardBg === "rgb(44, 42, 39)",
    JSON.stringify(firstCard));

  // 3) Clicar no nome do jogador abre o Perfil somente-leitura
  // (openPlayerCard/.m3-dialog) — mesmo fluxo de antes, preservado.
  await page.click("#marketList .m3-op-info");
  await page.waitForTimeout(250);
  const dialogOpened = await page.evaluate(() => !!document.querySelector(".m3-dialog-overlay.open"));
  console.log("3) Clicar no nome do jogador continua abrindo o Perfil (Dialog):", dialogOpened);
  await page.keyboard.press("Escape").catch(() => {});
  await page.evaluate(() => document.querySelectorAll(".m3-dialog-overlay.open").forEach((el) => el.classList.remove("open")));
  await page.waitForTimeout(150);

  // 4) Busca por nome continua filtrando a lista (mesma função,
  // renderMercado() só mudou a linha de apresentação).
  const searchResult = await page.evaluate(async () => {
    const before = document.querySelectorAll("#marketList .m3-op-card").length;
    const input = document.getElementById("marketSearch");
    input.value = "zzzznomeinexistentezzzz";
    input.dispatchEvent(new Event("input"));
    await new Promise((r) => setTimeout(r, 100));
    const afterNoMatch = document.querySelectorAll("#marketList .m3-op-card").length;
    const emptyMsg = document.querySelector("#marketList .ct-empty");
    input.value = "";
    input.dispatchEvent(new Event("input"));
    await new Promise((r) => setTimeout(r, 100));
    const afterCleared = document.querySelectorAll("#marketList .m3-op-card").length;
    return { before, afterNoMatch, hasEmptyMsg: !!emptyMsg, afterCleared };
  });
  console.log("4) Busca continua filtrando (zero resultado com nome inexistente, volta ao normal ao limpar):",
    searchResult.before > 0 && searchResult.afterNoMatch === 0 && searchResult.hasEmptyMsg && searchResult.afterCleared === searchResult.before,
    JSON.stringify(searchResult));

  // 5) Fazer uma proposta (fluxo de compra) continua funcionando —
  // abre o modal de oferta, confirma, e o jogador alvo passa a mostrar
  // "proposta enviada" (ícone de pendente) em vez do botão de comprar.
  const offerFlow = await page.evaluate(async () => {
    const buyBtn = document.querySelector("#marketList [data-buy]");
    if (!buyBtn) return { hasBuyBtn: false };
    const playerId = buyBtn.dataset.buy;
    buyBtn.click();
    await new Promise((r) => setTimeout(r, 150));
    const modalOpen = document.getElementById("offerOverlay").classList.contains("open");
    document.getElementById("btnOfferConfirm").click();
    await new Promise((r) => setTimeout(r, 150));
    const card = [...document.querySelectorAll("#marketList .m3-op-card")].find((c) => c.dataset.id === playerId);
    const hasPendingIcon = !!card?.querySelector("[data-viewoffer]");
    const stillHasBuyBtn = !!card?.querySelector("[data-buy]");
    return { hasBuyBtn: true, modalOpen, hasPendingIcon, stillHasBuyBtn };
  });
  console.log("5) Enviar proposta continua funcionando (modal abre, card muda pra 'pendente' depois de confirmar):",
    offerFlow.hasBuyBtn && offerFlow.modalOpen && offerFlow.hasPendingIcon && !offerFlow.stillHasBuyBtn,
    JSON.stringify(offerFlow));

  await page.screenshot({ path: "s4_b3_002_mercado.png" }).catch(() => {});

  await browser.close();
})();
