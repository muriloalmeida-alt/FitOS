// Testa a Loja (BR_Data_Treinador_Monetizacao.xlsx + BR_Data_Treinador_
// Loja_Mockup.html + BR_Data_Treinador_Confirmacao_Compra_Mockup.html):
// catálogo (5 pacotes de Créditos BR + 6 boosts/patrocínios), carteiras,
// fluxo de confirmação de compra sem pagamento real ainda.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `loja${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Murilo Melo", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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
  await page.waitForTimeout(200);

  // 1) creditsBR:0 lido do servidor, chegou na conta (ME).
  const meCredits = await page.evaluate(() => ME.creditsBR);
  console.log("1) ME.creditsBR começa em 0 (ledger no servidor):", meCredits === 0, meCredits);

  // 2) Abrir Loja pelo Menu — aba Créditos com os 5 pacotes certos.
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#btnOpenLoja");
  await page.waitForTimeout(200);
  const state1 = await page.evaluate(() => ({
    panelActive: document.getElementById("panel-loja").classList.contains("active"),
    cash: document.getElementById("walletCash").textContent,
    credits: document.getElementById("walletCredits").textContent,
    activeTab: document.querySelector("#lojaTabs .mt-obj-tab.active")?.dataset.tab,
    pkgCards: document.querySelectorAll("#lojaItemsList .mt-pkg-card").length,
    pkgNames: [...document.querySelectorAll("#lojaItemsList .mt-pkg-name")].map((el) => el.textContent.trim()),
    featured: document.querySelector("#lojaItemsList .mt-pkg-card.featured .mt-pkg-name")?.textContent.trim(),
    buyLabels: [...document.querySelectorAll("#lojaItemsList .mt-pkg-buy")].map((el) => el.textContent.trim()),
  }));
  console.log("2) Loja abre na aba Créditos com os 5 pacotes do documento:", state1.panelActive && state1.activeTab === "creditos" && state1.pkgCards === 5, JSON.stringify(state1));
  console.log("2b) Pacote Ouro é o destacado (MELHOR VALOR):", state1.featured && state1.featured.includes("Ouro"), state1.featured);
  const norm = (s) => s.replace(/ /g, " ");
  console.log("2c) Preços em reais com centavos (não arredonda R$4,90 -> R$5):", state1.buyLabels.map(norm).includes("R$ 4,90") && state1.buyLabels.map(norm).includes("R$ 149,90"), JSON.stringify(state1.buyLabels));

  // 3) Trocar pra aba Boosts & Patrocínios — 6 itens, 3 grupos.
  await page.click('#lojaTabs .mt-obj-tab[data-tab="boosts"]');
  await page.waitForTimeout(150);
  const state2 = await page.evaluate(() => ({
    activeTab: document.querySelector("#lojaTabs .mt-obj-tab.active")?.dataset.tab,
    boostCards: document.querySelectorAll("#lojaItemsList .mt-boost-card").length,
    dividers: [...document.querySelectorAll("#lojaItemsList .mt-divider-label")].map((el) => el.textContent),
    boostNames: [...document.querySelectorAll("#lojaItemsList .mt-boost-name")].map((el) => el.textContent),
  }));
  console.log("3) Aba Boosts mostra os 6 itens da planilha em 3 grupos:", state2.activeTab === "boosts" && state2.boostCards === 6 && state2.dividers.length === 3, JSON.stringify(state2));
  console.log("3b) Inclui Uniforme Alternativo (só na planilha, não no mockup):", state2.boostNames.includes("Uniforme Alternativo"));

  // 4) Comprar um pacote (Créditos) -- abre confirmação com dados certos.
  await page.click('#lojaTabs .mt-obj-tab[data-tab="creditos"]');
  await page.waitForTimeout(150);
  await page.click('#lojaItemsList [data-buy-package="ouro"]');
  await page.waitForTimeout(150);
  const confirmPkg = await page.evaluate(() => ({
    open: document.getElementById("purchaseConfirmOverlay").classList.contains("open"),
    title: document.getElementById("purchaseConfirmTitle").textContent,
    name: document.getElementById("purchaseConfirmName").textContent,
    detail: document.getElementById("purchaseConfirmDetail").textContent,
    price: document.getElementById("purchaseConfirmPrice").textContent,
    btnLabel: document.getElementById("btnConfirmPurchase").textContent,
  }));
  console.log("4) Confirmação de compra do Pacote Ouro com dados certos:", confirmPkg.open && confirmPkg.title.includes("Ouro") && confirmPkg.name.includes("4.480") && norm(confirmPkg.price) === "R$ 34,90" && norm(confirmPkg.btnLabel).includes("R$ 34,90"), JSON.stringify(confirmPkg));

  // 5) Confirmar -- toast "em breve", SEM debitar/creditar nada (nenhum
  // endpoint de compra existe ainda -- decisão do usuário).
  const cashBefore = await page.evaluate(() => CAREER.finances.cash);
  await page.click("#btnConfirmPurchase");
  await page.waitForTimeout(250);
  const afterConfirm = await page.evaluate(() => ({
    overlayClosed: !document.getElementById("purchaseConfirmOverlay").classList.contains("open"),
    cashAfter: CAREER.finances.cash,
    creditsAfter: ME.creditsBR,
    toastText: document.getElementById("toast").style.display !== "none" ? document.getElementById("toast").textContent : "",
  }));
  console.log("5) Confirmar mostra aviso 'em breve' e NÃO altera nenhum saldo:", afterConfirm.overlayClosed && afterConfirm.cashAfter === cashBefore && afterConfirm.creditsAfter === 0 && /breve/i.test(afterConfirm.toastText), JSON.stringify(afterConfirm));

  // 6) Comprar um boost -- confirmação mostra preço em Créditos BR (não R$).
  await page.click('#lojaTabs .mt-obj-tab[data-tab="boosts"]');
  await page.waitForTimeout(150);
  await page.click('#lojaItemsList [data-buy-boost="reset_moral"]');
  await page.waitForTimeout(150);
  const confirmBoost = await page.evaluate(() => ({
    open: document.getElementById("purchaseConfirmOverlay").classList.contains("open"),
    title: document.getElementById("purchaseConfirmTitle").textContent,
    price: document.getElementById("purchaseConfirmPrice").textContent,
    btnLabel: document.getElementById("btnConfirmPurchase").textContent,
    disclosure: document.querySelector(".mt-purchase-disclosure-text").textContent,
  }));
  console.log("6) Confirmação de boost mostra preço em Créditos BR:", confirmBoost.open && confirmBoost.title.includes("Reset de Moral") && confirmBoost.price.includes("Créditos BR") && confirmBoost.btnLabel.includes("120 Créditos BR"), JSON.stringify(confirmBoost));
  console.log("6b) Aviso de prévia (não copia o texto de cobrança real do mockup):", /prévia/i.test(confirmBoost.disclosure) && !/Google Play/i.test(confirmBoost.disclosure), confirmBoost.disclosure);

  // 7) Cancelar fecha sem tocar em nada.
  await page.click("#btnCancelPurchase");
  await page.waitForTimeout(150);
  const afterCancel = await page.evaluate(() => document.getElementById("purchaseConfirmOverlay").classList.contains("open"));
  console.log("7) Cancelar fecha a confirmação:", afterCancel === false);

  // 8) Elegibilidade "todo mundo, qualquer plano" -- conta freemium (a
  // criada aqui) acessa a Loja sem nenhum bloqueio de plano.
  const planCheck = await page.evaluate(() => ME.plan);
  console.log("8) Conta freemium acessou a Loja sem trava de plano:", planCheck === "freemium" && state1.panelActive, planCheck);

  await page.click('#lojaTabs .mt-obj-tab[data-tab="creditos"]');
  await page.waitForTimeout(150);
  await page.screenshot({ path: "loja_01_creditos.png" });
  await page.click('#lojaTabs .mt-obj-tab[data-tab="boosts"]');
  await page.waitForTimeout(150);
  await page.screenshot({ path: "loja_02_boosts.png" });
  await page.waitForTimeout(3800); // deixa o toast anterior sumir sozinho antes do print
  await page.click('#lojaItemsList [data-buy-boost="injecao_moral"]');
  await page.waitForTimeout(150);
  await page.screenshot({ path: "loja_03_confirmacao.png" });

  await browser.close();
})();
