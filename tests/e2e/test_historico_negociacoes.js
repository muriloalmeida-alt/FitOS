// Nova feature (Bloco 3, 4/4 — pedido do usuário) — "Histórico de
// negociações": timeline dedicada com todo o CAREER.transferLog (o
// card "Transferências recentes" do Mercado só mostra as 5 mais
// recentes). Ver openTransferHistoryScreen/renderTransferHistoryScreen
// em carreira.js.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `historiconeg${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Historico Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(300);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.waitForTimeout(3000);
  await page.click("#btnClaimDailyLogin").catch(() => {});
  await page.waitForTimeout(200);
  await page.click(".m3-nav-item[data-panel='mercado']");
  await page.waitForTimeout(300);
  await page.evaluate(() => { CAREER.finances.wageCap = 999999999; CAREER.finances.cash = 999999999; });

  // 1) Vazio no início — carreira nova, sem nenhuma negociação.
  await page.click("#btnOpenTransferHistory");
  await page.waitForTimeout(200);
  const check1 = await page.evaluate(() => ({
    open: document.getElementById("transferHistoryOverlay").classList.contains("open"),
    countLabel: document.getElementById("transferHistoryCountLabel").textContent,
    hasEmptyMsg: !document.getElementById("transferHistoryEmpty").classList.contains("hidden"),
  }));
  console.log("1) Abre vazio, sem nenhuma negociação ainda:",
    check1.open && check1.hasEmptyMsg && check1.countLabel === "Nenhuma negociação ainda", JSON.stringify(check1));
  await page.click("#transferHistoryClose");
  await page.waitForTimeout(150);

  // 2) Compra + venda de verdade (via UI) aparecem na tela, com o
  // ícone/classificação certos, e o card "Transferências recentes"
  // mostra o mesmo total no badge.
  const buyBtn = await page.$("[data-buy]");
  await buyBtn.click();
  await page.waitForSelector("#offerOverlay.open", { timeout: 5000 });
  await page.click("#btnOfferConfirm");
  await page.waitForTimeout(200);
  await page.evaluate(async () => {
    const orig = Math.random;
    Math.random = () => 0.01;
    resolvePendingOffersOutRound(CAREER.currentRound);
    resolvePendingOffersOutRound(CAREER.currentRound);
    Math.random = orig;
    renderMercado();
  });
  await page.waitForTimeout(200);
  if (await page.evaluate(() => document.getElementById("pressOverlay").classList.contains("open"))) {
    await page.click("#pressOptions [data-press]");
    await page.waitForTimeout(200);
  }

  // Enviar a proposta (#btnOfferConfirm) já fechou tudo e voltou pra
  // Início (Task #72) -- volta pro Mercado antes de continuar.
  await page.evaluate(() => switchToPanel("mercado"));
  await page.waitForTimeout(150);

  const listBtn = await page.$("[data-list]");
  await listBtn.click();
  await page.waitForSelector("#listOverlay.open", { timeout: 5000 });
  await page.click("#btnListConfirm");
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const orig = Math.random;
    Math.random = () => 0.01;
    (CAREER.pendingListings || []).forEach(maybeSpawnListingOffer);
    Math.random = orig;
    const listing = CAREER.pendingListings[0];
    const offer = listing.offers[0];
    acceptListingOffer(listing.id, offer.id);
  });
  await page.waitForTimeout(200);
  if (await page.evaluate(() => document.getElementById("pressOverlay").classList.contains("open"))) {
    await page.click("#pressOptions [data-press]");
    await page.waitForTimeout(200);
  }

  // Confirmar o anúncio (#btnListConfirm) já fechou tudo e voltou pra
  // Início (Task #72) -- volta pro Mercado antes de continuar.
  await page.evaluate(() => switchToPanel("mercado"));
  await page.waitForTimeout(150);

  await page.click("#btnOpenTransferHistory");
  await page.waitForTimeout(200);
  const check2 = await page.evaluate(() => {
    const items = [...document.querySelectorAll("#transferHistoryList .mt-transfer-item")];
    const dots = items.map((it) => it.querySelector(".mt-transfer-dot").className);
    const texts = items.map((it) => it.querySelector(".mt-transfer-text").textContent);
    return {
      count: items.length,
      hasBuyDot: dots.some((c) => c.includes(" buy")),
      hasSellDot: dots.some((c) => c.includes(" sell")),
      textsSample: texts.slice(0, 3),
      countLabel: document.getElementById("transferHistoryCountLabel").textContent,
    };
  });
  console.log("2) Compra e venda de verdade aparecem na timeline, com ícone certo (buy/sell):",
    check2.count >= 2 && check2.hasBuyDot && check2.hasSellDot, JSON.stringify(check2));

  const badgeInfo = await page.evaluate(() => ({
    badge: document.getElementById("transferHistoryBadge").textContent,
    logLength: (CAREER.transferLog || []).length,
    feedRows: document.querySelectorAll("#transferFeed .ct-transfer-feed-item").length,
  }));
  console.log("3) Badge do botão bate com o tamanho real do log, card compacto mostra só até 5:",
    Number(badgeInfo.badge) === badgeInfo.logLength && badgeInfo.feedRows <= 5, JSON.stringify(badgeInfo));

  // 4) Fechar (rodapé) fecha a tela sem efeito colateral.
  await page.click("#btnTransferHistoryCloseFooter");
  await page.waitForTimeout(150);
  const check4 = await page.evaluate(() => !document.getElementById("transferHistoryOverlay").classList.contains("open"));
  console.log("4) 'Fechar' no rodapé fecha a tela:", check4);

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
