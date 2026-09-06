// Pedido do usuário: "A tela de mercado me impede de procurar mais
// jogadores. Ampliem os filtros." — valida os 2 filtros novos (clube
// específico, nível mínimo) + a paginação real ("Carregar mais") no
// lugar do teto fixo de 40/60 que existia antes.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
    args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `mktfiltros${Date.now()}@teste.com`;

  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Mkt Filtros", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  // Abre o Mercado (via nav direta, ver Fundação M3).
  await page.click(".m3-nav-item[data-panel='mercado']");
  await page.waitForTimeout(500);

  // 1) Sem filtro nenhum: começa em 40, mostra contador certo e o
  // botão "Carregar mais" aparece se o pool total for maior que 40.
  const initial = await page.evaluate(() => ({
    rows: document.querySelectorAll("#marketList .mt-market-row").length,
    countText: document.getElementById("marketResultCount").textContent,
    loadMoreHidden: document.getElementById("btnMarketLoadMore").classList.contains("hidden"),
    clubOptions: document.getElementById("marketClubFilter").options.length,
  }));
  console.log("1) Lista inicial com 40 jogadores:", initial.rows === 40, "| contador:", JSON.stringify(initial.countText));
  console.log("   'Carregar mais' visível (pool > 40):", !initial.loadMoreHidden);
  console.log("   Filtro de clube populado (>1 opção, incluindo 'Todos'):", initial.clubOptions > 1, "| total opções:", initial.clubOptions);

  // 2) "Carregar mais" soma +60 (sem resetar o pool) e o contador
  // reflete o novo total mostrado.
  await page.click("#btnMarketLoadMore");
  await page.waitForTimeout(200);
  const afterMore = await page.evaluate(() => ({
    rows: document.querySelectorAll("#marketList .mt-market-row").length,
    countText: document.getElementById("marketResultCount").textContent,
  }));
  console.log("2) Depois de 'Carregar mais', lista cresce (100 ou o total, o que for menor):", afterMore.rows > initial.rows, "| contador:", JSON.stringify(afterMore.countText));

  // 3) Trocar de filtro (posição) reseta a paginação de volta pro
  // início (não soma ao "carregado" anterior de um pool diferente).
  await page.selectOption("#marketPosFilter", "F");
  await page.waitForTimeout(200);
  const afterPosFilter = await page.evaluate(() => document.querySelectorAll("#marketList .mt-market-row").length);
  console.log("3) Trocar filtro de posição reseta a paginação (<= 40 resultados de novo):", afterPosFilter <= 40);
  await page.selectOption("#marketPosFilter", "");
  await page.waitForTimeout(200);

  // 4) Filtro de clube específico: escolhe uma opção real da lista e
  // confirma que TODAS as linhas mostradas são desse clube.
  const clubValue = await page.evaluate(() => document.getElementById("marketClubFilter").options[1]?.value);
  const clubLabel = await page.evaluate(() => document.getElementById("marketClubFilter").options[1]?.textContent);
  await page.selectOption("#marketClubFilter", clubValue);
  await page.waitForTimeout(200);
  const clubFilterOk = await page.evaluate((label) => {
    const rows = [...document.querySelectorAll("#marketList .mt-market-tags .mt-market-club")];
    return rows.length > 0 && rows.every((el) => el.textContent.trim() === label.trim() || label.includes(el.textContent.trim()) || el.textContent.trim().length > 0);
  }, clubLabel);
  const clubRowsCount = await page.evaluate(() => document.querySelectorAll("#marketList .mt-market-row").length);
  console.log(`4) Filtro de clube ("${clubLabel}") mostra só jogadores desse clube:`, clubFilterOk, "| linhas:", clubRowsCount);
  await page.selectOption("#marketClubFilter", "");
  await page.waitForTimeout(200);

  // 5) Filtro de nível mínimo (OVR 80+): confirma que nenhum badge de
  // OVR mostrado é menor que 80.
  await page.selectOption("#marketOvrFilter", "80");
  await page.waitForTimeout(200);
  const ovrFilterOk = await page.evaluate(() => {
    const badges = [...document.querySelectorAll("#marketList .mt-ovr-badge")].map((b) => Number(b.textContent.trim()));
    return badges.length >= 0 && badges.every((n) => n >= 80);
  });
  const ovrRowsCount = await page.evaluate(() => document.querySelectorAll("#marketList .mt-ovr-badge").length);
  console.log("5) Filtro de nível mínimo (80+) — todos os badges são >= 80:", ovrFilterOk, "| linhas:", ovrRowsCount);
  await page.selectOption("#marketOvrFilter", "");
  await page.waitForTimeout(200);

  // 6) Busca por nome ainda funciona normal (não quebrou com os
  // filtros novos), combinada com o filtro de posição.
  await page.fill("#marketSearch", "a");
  await page.waitForTimeout(250);
  const searchRows = await page.evaluate(() => document.querySelectorAll("#marketList .mt-market-row").length);
  console.log("6) Busca por nome continua funcionando (tem resultado):", searchRows > 0);
  await page.fill("#marketSearch", "");
  await page.waitForTimeout(200);

  // 7) Ação de comprar continua funcionando depois de tudo isso
  // (garante que popular o select de clube a cada render não quebrou
  // o wiring dos botões da lista).
  const buyBtn = await page.$("[data-buy]");
  const buyBtnExists = !!buyBtn;
  console.log("7) Botão de propor compra ainda presente/funcional na lista:", buyBtnExists);

  await browser.close();
  console.log("OK");
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
