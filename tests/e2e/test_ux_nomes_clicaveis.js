// Verifica "todos os locais que aparecer nome do clube ou do jogador
// deve ser clicável e abrir a página do jogador ou do clube (elenco)"
// — escopo confirmado: só listas/cards estruturados.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `nomesclick${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Nomes Click", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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
  try { await page.click("#btnClaimDailyLogin", { timeout: 1500 }); await page.waitForTimeout(200); } catch {}

  async function goToPanel(name) {
    await page.evaluate((n) => switchToPanel(n), name);
    await page.waitForTimeout(100);
  }
  async function detailOpenWithName() {
    return page.evaluate(() => document.getElementById("detailOverlay").classList.contains("open") ? document.getElementById("detailBody").querySelector(".mt-player-hero-info b")?.textContent : null);
  }
  async function clubRosterOpenWithName() {
    return page.evaluate(() => document.getElementById("clubRosterOverlay").classList.contains("open") ? document.getElementById("clubRosterName").textContent : null);
  }
  function closeAll() {
    return page.evaluate(() => document.querySelectorAll(".ct-modal-overlay.open").forEach((el) => el.classList.remove("open")));
  }

  // 1) Mercado: nome do jogador de outro clube abre perfil somente-leitura
  await goToPanel("mercado");
  await page.waitForTimeout(200);
  const otherRow = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("#marketList .mt-market-row")];
    const idx = rows.findIndex((r) => r.querySelector("[data-buy]"));
    return idx;
  });
  await page.click(`#marketList .mt-market-row:nth-child(${otherRow + 1}) .mt-market-info`);
  await page.waitForTimeout(150);
  const marketPlayerName = await detailOpenWithName();
  console.log("1a) Mercado: nome do jogador de outro clube abre Perfil (somente leitura):", !!marketPlayerName, marketPlayerName);
  const readOnlyNote = await page.evaluate(() => document.getElementById("detailBody").textContent.includes("consulta apenas"));
  console.log("1b) Perfil somente-leitura mostra aviso 'consulta apenas' (sem ações de gestão):", readOnlyNote);
  await closeAll();

  // 2) Mercado: nome do clube abre o elenco do clube
  await goToPanel("mercado");
  await page.waitForTimeout(150);
  await page.click(`#marketList .mt-market-row:nth-child(${otherRow + 1}) .mt-market-club`);
  await page.waitForTimeout(150);
  console.log("2) Mercado: nome do clube abre elenco (roster read-only):", !!(await clubRosterOpenWithName()));
  await closeAll();

  // 3) Tabela: nome do clube abre elenco (exceto o meu, que vai pra aba Elenco)
  await goToPanel("tabela");
  await page.waitForTimeout(150);
  const oppTeamCell = await page.evaluate(() => {
    const cells = [...document.querySelectorAll("#standingsTable .mt-team-cell")];
    const mine = String(CAREER.clubId);
    return cells.findIndex((c) => c.dataset.openclub !== mine);
  });
  await page.click(`#standingsTable .mt-team-cell:nth-child(${1})`, { trial: true }).catch(() => {});
  await page.evaluate((idx) => document.querySelectorAll("#standingsTable .mt-team-cell")[idx].click(), oppTeamCell);
  await page.waitForTimeout(150);
  console.log("3) Tabela: nome de outro clube abre elenco read-only:", !!(await clubRosterOpenWithName()));
  await closeAll();

  // 3b) Tabela: nome do MEU clube abre a aba Elenco de verdade
  await goToPanel("mercado"); // sai da Tabela pra confirmar que a navegação de verdade ocorreu
  await goToPanel("tabela");
  await page.waitForTimeout(150);
  const myTeamCellIdx = await page.evaluate(() => {
    const cells = [...document.querySelectorAll("#standingsTable .mt-team-cell")];
    const mine = String(CAREER.clubId);
    return cells.findIndex((c) => c.dataset.openclub === mine);
  });
  await page.evaluate((idx) => document.querySelectorAll("#standingsTable .mt-team-cell")[idx].click(), myTeamCellIdx);
  await page.waitForTimeout(150);
  const activeAfterMyClub = await page.evaluate(() => document.querySelector(".ct-panel.active")?.id);
  console.log("3b) Tabela: nome do MEU clube leva pra aba Elenco (não abre modal):", activeAfterMyClub === "panel-elenco");

  // 4) Estatísticas: artilheiro da liga (nome + clube) clicáveis
  await goToPanel("estatisticas");
  await page.waitForTimeout(150);
  const hasLeagueRows = await page.evaluate(() => document.querySelectorAll("#leagueTopScorersTable .mt-mini-row").length > 0);
  if (hasLeagueRows) {
    await page.click("#leagueTopScorersTable .mt-mini-row:first-child .mt-mini-col.name");
    await page.waitForTimeout(150);
    console.log("4a) Estatísticas (artilheiro da liga): nome do jogador abre Perfil:", !!(await detailOpenWithName()));
    await closeAll();
    await goToPanel("estatisticas");
    await page.waitForTimeout(150);
    await page.click("#leagueTopScorersTable .mt-mini-row:first-child [data-openclub]");
    await page.waitForTimeout(150);
    const openedSomething = await page.evaluate(() => document.getElementById("clubRosterOverlay").classList.contains("open") || document.querySelector(".ct-panel.active")?.id === "panel-elenco");
    console.log("4b) Estatísticas (artilheiro da liga): nome do clube abre elenco:", openedSomething);
    await closeAll();
  } else {
    console.log("4) Estatísticas: sem artilheiros ainda nesta carreira nova (esperado) — checagem pulada.");
  }

  // 5) Indicações dos olheiros
  await goToPanel("mercado");
  await page.waitForTimeout(150);
  await page.evaluate(() => searchScoutSuggestions());
  await page.waitForTimeout(200);
  const hasScoutSuggestions = await page.evaluate(() => (CAREER.scoutSuggestions || []).length > 0);
  if (hasScoutSuggestions) {
    await page.evaluate(() => openScoutSuggestionsScreen());
    await page.waitForTimeout(150);
    await page.click("#scoutSuggestionsList [data-openplayer]");
    await page.waitForTimeout(150);
    console.log("5) Indicações dos olheiros: nome do jogador abre Perfil:", !!(await detailOpenWithName()));
    await closeAll();
  } else {
    console.log("5) Indicações dos olheiros: nenhuma indicação encontrada nesta rodada (sorteio) — checagem pulada.");
  }

  // 6) Resultado do jogo ("Seu jogo"): nome do time abre elenco
  await goToPanel("mercado");
  await page.evaluate(() => {
    showMatchDetailModal({ humanMatch: { home: CAREER.clubId, away: Object.keys(CAREER.standings).find((id) => String(id) !== String(CAREER.clubId)), gh: 2, ga: 1, events: [], isHome: true }, round: CAREER.currentRound });
  });
  await page.waitForTimeout(150);
  const matchDetailOpen = await page.evaluate(() => document.getElementById("matchDetailOverlay").classList.contains("open"));
  await page.click("#matchDetailScore .side:last-child");
  await page.waitForTimeout(150);
  console.log("6) Resultado do jogo: nome do time adversário abre elenco:", matchDetailOpen && !!(await clubRosterOpenWithName()));
  await closeAll();

  // 7) H2H: nome/escudo do adversário abre elenco
  await goToPanel("mercado");
  const anyOpp = await page.evaluate(() => Object.keys(CAREER.standings).find((id) => String(id) !== String(CAREER.clubId)));
  await page.evaluate((opp) => openH2H(opp), anyOpp);
  await page.waitForTimeout(150);
  const h2hOpen = await page.evaluate(() => document.getElementById("h2hOverlay").classList.contains("open"));
  await page.click("#h2hOppName");
  await page.waitForTimeout(150);
  console.log("7) H2H: nome do adversário abre elenco:", h2hOpen && !!(await clubRosterOpenWithName()));
  await closeAll();

  await browser.close();
})();
