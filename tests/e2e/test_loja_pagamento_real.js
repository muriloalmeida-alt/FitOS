// Pedido do usuário (item 7 da lista de melhorias, "Vamos implementar
// todos na ordem abaixo"): "Loja com pagamento de verdade — hoje
// 'Confirmar compra' só mostra 'em breve'. O site principal já tem
// Mercado Pago integrado (server/src/mercadoPago.js) — dá pra plugar
// nos pacotes de Créditos BR sem reinventar nada." + decisão do
// usuário via AskUserQuestion de também gastar Créditos BR nos
// boosts/patrocínios nesta mesma entrega.
// Valida: pacote de Créditos BR chama /api/loja/checkout de verdade
// (aqui, sem MERCADOPAGO_ACCESS_TOKEN configurado, o servidor devolve
// erro 502 — mesmo comportamento já aceito pra /api/support/checkout
// nesta sandbox — confirmado como o caminho de erro esperado, não um
// bug); boost gasta o saldo de verdade via /api/loja/spend-credits,
// aplica o efeito real na carreira, loga no Histórico de compras, e
// falha de forma clara sem saldo suficiente. Também valida o retorno
// do Checkout Pro (?status=approved na URL).
const { chromium } = require("playwright-core");

async function newCareer(page, base, email) {
  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Loja Pagamento", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "load" });
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(200);
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
}
async function openLoja(page) {
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#btnOpenLoja");
  await page.waitForTimeout(300);
}
async function openLojaBoosts(page) {
  await openLoja(page);
  await page.click('#lojaTabs .mt-obj-tab[data-tab="boosts"]');
  await page.waitForTimeout(150);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
    args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  await newCareer(page, base, `lojareal${Date.now()}@teste.com`);
  await openLoja(page);

  // 1) Pacote de Créditos BR: modal de confirmação mostra o rail de
  // pagamento certo (Mercado Pago), botão chama /api/loja/checkout de
  // verdade (sem token configurado nesta sandbox -- 502 esperado, cai
  // no toast de erro em vez de travar ou fingir sucesso).
  await page.click('[data-buy-package="bronze"]');
  await page.waitForTimeout(150);
  const packageModalState = await page.evaluate(() => ({
    paymentLabel: document.getElementById("purchasePaymentLabel").textContent,
    disclosure: document.getElementById("purchaseDisclosureText").textContent,
  }));
  console.log("1) Modal de confirmação (pacote) mostra o rail de pagamento certo:", packageModalState.paymentLabel.includes("Mercado Pago") && packageModalState.disclosure.includes("redirecionado"), JSON.stringify(packageModalState));
  const checkoutReqPromise = page.waitForResponse((r) => r.url().includes("/api/loja/checkout"));
  await page.click("#btnConfirmPurchase");
  const checkoutRes = await checkoutReqPromise;
  await page.waitForTimeout(200);
  const stillOnCarreira = page.url().includes("carreira.html");
  console.log("2) Botão chama /api/loja/checkout de verdade (502 sem MP token nesta sandbox -- caminho de erro esperado) e não navega embora:", checkoutRes.status() === 502 && stillOnCarreira, checkoutRes.status());

  // 3) Boost: modal mostra saldo/débito de Créditos BR, sem saldo
  // suficiente o botão fica desabilitado com aviso.
  await openLojaBoosts(page);
  await page.click('[data-buy-boost="reset_moral"]');
  await page.waitForTimeout(150);
  const boostModalNoSaldo = await page.evaluate(() => ({
    paymentLabel: document.getElementById("purchasePaymentLabel").textContent,
    disabled: document.getElementById("btnConfirmPurchase").disabled,
  }));
  console.log("3) Sem saldo suficiente, botão de confirmar fica desabilitado:", boostModalNoSaldo.paymentLabel.includes("Créditos BR") && boostModalNoSaldo.disabled === true, JSON.stringify(boostModalNoSaldo));
  await page.click("#purchaseConfirmClose");
  await page.waitForTimeout(150);

  // 4) Saldo de teste concedido ANTES deste processo (ver
  // _grant_test_credits.js + reinício do servidor, orquestrado pelo
  // shell que chama este script) -- confirma aqui só que a conta já
  // sobe logada com o saldo de verdade.
  await page.close();
  const page2 = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page2.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const email2 = process.env.LOJA_TEST_EMAIL;
  const creditsExpected = Number(process.env.LOJA_TEST_CREDITS || 5000);
  await page2.goto(base + "/", { waitUntil: "load" });
  const meData = await page2.evaluate(async ({ email }) => {
    return await (await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) })).json();
  }, { email: email2 });
  await page2.goto(base + "/carreira.html", { waitUntil: "load" });
  await page2.click('.mt-competition-card[data-competition="brasileirao"]');
  await page2.waitForTimeout(200);
  await page2.click(".m3-club-row");
  await page2.waitForTimeout(150);
  await page2.click("#btnConfirmClub");
  await page2.click("#btnOnboardSkip", { timeout: 4000 }).catch(() => {});
  await page2.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page2.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page2.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page2.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page2.waitForSelector("#dailyLoginOverlay.open", { timeout: 6000 }).catch(() => {});
  await page2.click("#btnClaimDailyLogin", { timeout: 6000 }).catch(() => {});
  await page2.waitForSelector("#dailyLoginOverlay:not(.open)", { timeout: 6000 }).catch(() => {});
  await page2.waitForTimeout(500);
  const creditsGranted = await page2.evaluate(() => ME.creditsBR);
  console.log("4) Saldo de teste concedido de verdade (via addCredits, mesma função do webhook, antes do servidor subir):", creditsGranted === creditsExpected, creditsGranted, JSON.stringify(meData && meData.user && meData.user.id));

  // 5) Com saldo suficiente, comprar um boost debita de verdade, aplica
  // o efeito na carreira, e loga no Histórico de compras.
  await openLojaBoosts(page2);
  const moraleBefore = await page2.evaluate(() => CAREER.squad[0].morale);
  await page2.click('[data-buy-boost="reset_moral"]');
  await page2.waitForTimeout(150);
  await page2.click("#btnConfirmPurchase");
  await page2.waitForTimeout(400);
  const afterBoost = await page2.evaluate(() => ({
    creditsBR: ME.creditsBR,
    moraleAfter: CAREER.squad[0].morale,
    historyFirst: CAREER.purchaseHistory && CAREER.purchaseHistory[0],
  }));
  console.log("5) Comprar boost debita de verdade (5000-120=4880), aplica o efeito (moral=90) e loga no histórico:",
    afterBoost.creditsBR === 4880 && afterBoost.moraleAfter === 90 && afterBoost.historyFirst && afterBoost.historyFirst.name === "Reset de Moral",
    JSON.stringify(afterBoost));

  // 6) "Desconto de Contratação" reduz o valor sugerido na próxima
  // proposta em 15%, e é consumido depois de enviada.
  await openLojaBoosts(page2);
  await page2.click('[data-buy-boost="desconto_contratacao"]');
  await page2.waitForTimeout(150);
  await page2.click("#btnConfirmPurchase");
  await page2.waitForTimeout(400);
  await page2.click(".m3-nav-item[data-panel='mercado']");
  await page2.waitForTimeout(400);
  const marketRow = await page2.$(".mt-market-row [data-openplayer]");
  let discountApplied = null;
  if (marketRow) {
    const playerId = await marketRow.getAttribute("data-openplayer");
    const marketValue = await page2.evaluate((id) => {
      const found = allMarketPlayers().find(({ p }) => p.id === id);
      return found ? found.p.value : null;
    }, playerId);
    await page2.click(`.mt-market-actions-corner [data-buy="${playerId}"]`).catch(() => {});
    await page2.waitForTimeout(300);
    const offerOpen = await page2.evaluate(() => document.getElementById("offerOverlay").classList.contains("open"));
    if (offerOpen) {
      const prefillValue = await page2.evaluate(() => Number(document.getElementById("offerValueInput").value));
      discountApplied = { marketValue, prefillValue, expected: Math.round(marketValue * 0.85) };
    }
  }
  console.log("6) 'Desconto de Contratação' sugere 15% a menos na próxima proposta:", !!discountApplied && discountApplied.prefillValue === discountApplied.expected, JSON.stringify(discountApplied));

  // 7) Retorno do Checkout Pro (?status=approved) mostra toast e limpa
  // a URL — o saldo real só muda de verdade via webhook (não testável
  // aqui sem credencial do Mercado Pago), mas o feedback e a limpeza
  // de URL são 100% client-side e testáveis.
  await page2.goto(`${base}/carreira.html?status=approved&payment_id=123&external_reference=credits:x:bronze`, { waitUntil: "load" });
  await page2.waitForTimeout(600);
  const returnState = await page2.evaluate(() => ({
    urlClean: !location.search.includes("status"),
    toastVisible: getComputedStyle(document.getElementById("toast")).display !== "none",
  }));
  console.log("7) Retorno do Checkout Pro limpa a URL e mostra um toast de status:", returnState.urlClean && returnState.toastVisible, JSON.stringify(returnState));

  await browser.close();
  console.log("OK");
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
