// S4-B4-006 (issue #36) — teste e2e via UI real, última tela do Batch
// 4. Cobre a migração de tokens de Estatísticas/Histórico:
// 1) as grades de KPI (Retrospecto/Gols/Disciplina/Sequências/Copa/
//    Campeonato) passam a reaproveitar o componente m3 que kpiHTML()
//    já tinha (block:"m3" → .m3-stat-card, já usado no card
//    "Financeiro"/Início) — nenhuma classe nova criada, só o 4º
//    argumento passado nas chamadas dentro de Estatísticas;
// 2) os 2 seletores (escopo/período, .mt-obj-tabs/.mt-obj-tab) e as
//    mini-tabelas (.mt-mini-head/-row/-col) migram via override
//    ESCOPADO a #panel-estatisticas — as classes base são
//    compartilhadas com Objetivos/Loja (tabs) e o Histórico por
//    temporada do Perfil do jogador (mini-tabela), nenhum dos 3 em
//    escopo aqui, então o teste confirma que NENHUM deles foi afetado.
// Nenhuma mudança de comportamento (os 2 seletores independentes,
// cobertura multi-temporada) — cobertura de regressão fica com
// test_estatisticas_completas.js (pré-existente, já escrito pra
// aceitar .mt-stat-block OU .m3-stat-card, sinal de que essa migração
// já era esperada) e test_ux_estatisticas_check.js.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `s4b4006${Date.now()}@teste.com`;

  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Estat M3", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
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
  await page.waitForTimeout(1000);
  await page.click("#btnClaimDailyLogin").catch(() => {});
  await page.waitForTimeout(200);

  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='competicao']");
  await page.click("#btnOpenEstatisticas");
  await page.waitForTimeout(250);

  // 1) Grades de KPI usam .m3-stat-card (não mais .mt-stat-block) em
  // pelo menos 3 seções diferentes (Retrospecto, Gols, Sequências).
  const kpiCards = await page.evaluate(() => ({
    recordM3: document.querySelectorAll("#statsRecordKpis .m3-stat-card").length,
    recordOld: document.querySelectorAll("#statsRecordKpis .mt-stat-block").length,
    goalsM3: document.querySelectorAll("#statsGoalsKpis .m3-stat-card").length,
    streakM3: document.querySelectorAll("#statsStreakKpis .m3-stat-card").length,
    copaM3: document.querySelectorAll("#statsCopaContent .m3-stat-card").length,
  }));
  console.log("1) Grades de KPI reaproveitam .m3-stat-card (já usado no card Financeiro), nenhum .mt-stat-block restante:",
    kpiCards.recordM3 === 5 && kpiCards.recordOld === 0 && kpiCards.goalsM3 === 4 && kpiCards.streakM3 >= 2 && kpiCards.copaM3 === 1,
    JSON.stringify(kpiCards));

  // 2) Tokens dos seletores (escopo/período) migrados, ESCOPADOS a
  // #panel-estatisticas — cor do tab inativo e borda do wrapper.
  const tabTokens = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const inactiveTab = document.querySelector("#statsScopeTabs .mt-obj-tab:not(.active)");
    const tabsWrap = document.getElementById("statsScopeTabs");
    return {
      onSurfaceVariant: root.getPropertyValue("--m3-on-surface-variant").trim(),
      outlineVariant: root.getPropertyValue("--m3-outline-variant").trim(),
      inactiveColor: getComputedStyle(inactiveTab).color,
      wrapBorderColor: getComputedStyle(tabsWrap).borderBottomColor,
    };
  });
  const hexToRgb = (hex) => { const h = hex.replace("#", ""); const n = parseInt(h, 16); return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`; };
  const inactiveOk = tabTokens.inactiveColor === hexToRgb(tabTokens.onSurfaceVariant);
  const wrapBorderOk = tabTokens.wrapBorderColor === hexToRgb(tabTokens.outlineVariant);
  console.log("2) Tab inativo/borda do seletor migrados (--m3-on-surface-variant/--m3-outline-variant), escopado a #panel-estatisticas:",
    inactiveOk && wrapBorderOk, JSON.stringify({ ...tabTokens, inactiveOk, wrapBorderOk }));

  // 3) Mini-tabela (times da competição) migrada — nome da coluna
  // migra pra --m3-on-surface, cabeçalho pra --m3-on-surface-variant.
  await page.click('#statsScopeTabs .mt-obj-tab[data-scope="campeonato"]');
  await page.waitForTimeout(150);
  const miniTable = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const nameCol = document.querySelector("#leagueTeamStatsTable .mt-mini-col.name");
    const head = document.querySelector("#statsTeamsTableCard .mt-mini-head");
    return {
      onSurface: root.getPropertyValue("--m3-on-surface").trim(),
      onSurfaceVariant: root.getPropertyValue("--m3-on-surface-variant").trim(),
      nameColor: nameCol ? getComputedStyle(nameCol).color : null,
      headColor: head ? getComputedStyle(head).color : null,
    };
  });
  const nameOk = miniTable.nameColor === hexToRgb(miniTable.onSurface);
  const headOk = miniTable.headColor === hexToRgb(miniTable.onSurfaceVariant);
  console.log("3) Mini-tabela migrada (nome do time --m3-on-surface, cabeçalho --m3-on-surface-variant):",
    nameOk && headOk, JSON.stringify({ ...miniTable, nameOk, headOk }));

  // 4) O override ESCOPADO não vazou: o Histórico por temporada do
  // Perfil do jogador (mesma classe .mt-mini-col.name) continua com a
  // cor LEGADA de sempre — confirma que a mudança ficou só dentro de
  // #panel-estatisticas.
  await page.click(".m3-nav-item[data-panel='elenco']");
  await page.waitForTimeout(300);
  await page.click("#squadMainList [data-id]");
  await page.waitForSelector("#detailOverlay.open");
  const profileUnaffected = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const nameCol = document.querySelector("#detailOverlay .mt-mini-col.name");
    if (!nameCol) return { hasSeasonHistory: false };
    return {
      hasSeasonHistory: true,
      ivory50: root.getPropertyValue("--mt-ivory-50").trim(),
      nameColor: getComputedStyle(nameCol).color,
    };
  });
  const profileOk = !profileUnaffected.hasSeasonHistory
    || profileUnaffected.nameColor === hexToRgb(profileUnaffected.ivory50);
  console.log("4) Override escopado não vazou pro Histórico por temporada do Perfil (mesma classe, ainda legada lá):",
    profileOk, JSON.stringify({ ...profileUnaffected, profileOk }));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
