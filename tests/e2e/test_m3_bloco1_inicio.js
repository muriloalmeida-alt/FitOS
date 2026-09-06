// Testa Fundação M3 + nav de 5 itens + Início/Clube (Bloco 1, parte 1).
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("console", (msg) => { if (msg.type() === "error") console.log("CONSOLE ERROR:", msg.text()); });
  const base = "http://localhost:8787";
  const email = `m3teste${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "M3 Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(300);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.waitForTimeout(800);
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300);

  // 1) Nav tem 5 itens + Menu, todos com data-panel certo.
  const navLabels = await page.evaluate(() => [...document.querySelectorAll(".m3-nav-item")].map((el) => el.textContent.trim()));
  console.log("1) Nav com 5 itens + Menu:", JSON.stringify(navLabels), navLabels.length === 6 && navLabels[0] === "Início" && navLabels[4] === "Clube" && navLabels[5] === "Menu");

  // 2) Topbar mostra identidade do clube (nome + posição).
  const topbar = await page.evaluate(() => ({
    name: document.getElementById("topbarClubName").textContent,
    sub: document.getElementById("topbarClubSub").textContent,
    chip: document.getElementById("topbarPositionChip").textContent,
  }));
  console.log("2) Topbar com identidade do clube:", topbar.name.length > 0 && /\dº lugar/.test(topbar.chip), JSON.stringify(topbar));

  // 3) Início (M3): hero card, FAB visível. AJUSTE (pedido do usuário:
  // "remover o card de situação do elenco") — #squadKpis (5 stat cards)
  // saiu da Central de vez; checa a AUSÊNCIA em vez do count antigo.
  const inicio = await page.evaluate(() => ({
    heroVisible: !!document.querySelector(".m3-hero-card"),
    squadKpisRemoved: !document.getElementById("squadKpis"),
    fabText: document.getElementById("btnSimulate").textContent.trim(),
    fabVisible: getComputedStyle(document.getElementById("btnSimulate")).display !== "none",
  }));
  console.log("3) Início: hero+FAB, sem o card 'Situação do elenco':", inicio.heroVisible && inicio.squadKpisRemoved && inicio.fabVisible, JSON.stringify(inicio));

  // 4) Clicar em "Clube" mostra financeiro/patrocínio (movidos da Central).
  await page.click('.m3-nav-item[data-panel="clube"]');
  await page.waitForTimeout(200);
  const clube = await page.evaluate(() => ({
    panelActive: document.getElementById("panel-clube").classList.contains("active"),
    hasFinanceKpis: document.getElementById("financeKpis").children.length > 0,
    hasSponsorBox: document.getElementById("sponsorshipBox").innerHTML.length > 0,
    caixaText: document.querySelector("#financeKpis .mt-fin-block .num")?.textContent,
  }));
  console.log("4) Clube mostra financeiro/patrocínio (relocado da Central):", clube.panelActive && clube.hasFinanceKpis && clube.hasSponsorBox, JSON.stringify(clube));

  // 5) Mercado voltou pra nav direta (sem passar pelo Menu).
  await page.click('.m3-nav-item[data-panel="mercado"]');
  await page.waitForTimeout(200);
  const mercadoDirect = await page.evaluate(() => document.getElementById("panel-mercado").classList.contains("active"));
  console.log("5) Mercado acessível direto pela nav:", mercadoDirect);

  // 6) Tabela/Treinos saíram da nav e foram pro Menu.
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  const menuHasTabelaTreinos = await page.evaluate(() => !!document.getElementById("btnOpenTabela") && !!document.getElementById("btnOpenTreinos") && !document.getElementById("btnOpenMercado"));
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='competicao']");
  await page.click("#btnOpenTabela");
  await page.waitForTimeout(200);
  const tabelaViaMenu = await page.evaluate(() => document.getElementById("panel-tabela").classList.contains("active"));
  console.log("6) Tabela/Treinos no Menu (Mercado saiu de lá), Tabela abre via Menu:", menuHasTabelaTreinos && tabelaViaMenu);

  // 7) Central foi pra Início de novo, sem erro.
  await page.click('.m3-nav-item[data-panel="central"]');
  await page.waitForTimeout(200);
  const inicioActive = await page.evaluate(() => document.getElementById("panel-central").classList.contains("active"));
  console.log("7) Voltar pra Início funciona:", inicioActive);

  await page.screenshot({ path: "m3_01_inicio.png" });
  await page.click('.m3-nav-item[data-panel="clube"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: "m3_02_clube.png" });

  await browser.close();
})();
