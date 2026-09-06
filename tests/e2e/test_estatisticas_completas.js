// Módulo de Estatísticas completo (pedido do usuário: "com todas as
// informações possíveis sobre o meu time e as principais informações
// do campeonato... sempre divididas em Histórico e Temporada Atual").
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `estatisticas${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Estatisticas Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  async function openStats() {
    await page.click("#btnBottomMenu");
    await page.waitForTimeout(150);
    await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='competicao']");
    await page.click("#btnOpenEstatisticas");
    await page.waitForTimeout(250);
  }

  // 1) Abre em Meu Time / Temporada Atual por padrão, com todos os
  // cards presentes.
  await openStats();
  const check1 = await page.evaluate(() => ({
    scopeActive: document.querySelector("#statsScopeTabs .mt-obj-tab.active")?.dataset.scope,
    periodActive: document.querySelector("#statsPeriodTabs .mt-obj-tab.active")?.dataset.period,
    timeVisible: !document.getElementById("statsScopeTime").classList.contains("hidden"),
    campeonatoHidden: document.getElementById("statsScopeCampeonato").classList.contains("hidden"),
    recordCards: document.querySelectorAll("#statsRecordKpis .mt-stat-block, #statsRecordKpis .m3-stat-card").length,
    goalsCards: document.querySelectorAll("#statsGoalsKpis .mt-stat-block, #statsGoalsKpis .m3-stat-card").length,
  }));
  console.log("1) Abre em Meu Time / Temporada Atual, com os cards da Central presentes:",
    check1.scopeActive === "time" && check1.periodActive === "temporada" && check1.timeVisible && check1.campeonatoHidden
    && check1.recordCards === 5 && check1.goalsCards === 4, JSON.stringify(check1));

  // 2) Alterna pra Histórico — mesmos cards, agora lendo careerTotals
  // (tudo zerado, carreira nova).
  await page.click('#statsPeriodTabs .mt-obj-tab[data-period="historico"]');
  await page.waitForTimeout(150);
  const check2 = await page.evaluate(() => ({
    periodActive: document.querySelector("#statsPeriodTabs .mt-obj-tab.active")?.dataset.period,
    recordText: document.getElementById("statsRecordKpis").textContent,
    hasRecordeKpi: document.getElementById("statsStreakKpis").textContent.includes("Recorde"),
  }));
  console.log("2) Histórico mostra os mesmos cards (carreira nova, tudo zerado) + recordes extras nas sequências:",
    check2.periodActive === "historico" && check2.hasRecordeKpi, JSON.stringify(check2));

  // 3) Campeonato / Temporada Atual — cards existentes de sempre.
  await page.click('#statsScopeTabs .mt-obj-tab[data-scope="campeonato"]');
  await page.click('#statsPeriodTabs .mt-obj-tab[data-period="temporada"]');
  await page.waitForTimeout(150);
  const check3 = await page.evaluate(() => ({
    leagueKpisVisible: !document.getElementById("statsLeagueKpisCard").classList.contains("hidden"),
    teamsTableVisible: !document.getElementById("statsTeamsTableCard").classList.contains("hidden"),
    championsHidden: document.getElementById("statsChampionsCard").classList.contains("hidden"),
    teamRows: document.querySelectorAll("#leagueTeamStatsTable .mt-mini-row").length,
    scorersTitle: document.getElementById("statsScorersLeagueTitle").textContent,
  }));
  console.log("3) Campeonato/Temporada mostra KPIs+times da competição (20 linhas), esconde Campeões:",
    check3.leagueKpisVisible && check3.teamsTableVisible && check3.championsHidden && check3.teamRows === 20
    && check3.scorersTitle.includes("temporada"), JSON.stringify(check3));

  // 4) Campeonato / Histórico — carreira nova, nenhuma temporada
  // completa ainda: mostra estado vazio, sem quebrar.
  await page.click('#statsPeriodTabs .mt-obj-tab[data-period="historico"]');
  await page.waitForTimeout(150);
  const check4 = await page.evaluate(() => ({
    championsVisible: !document.getElementById("statsChampionsCard").classList.contains("hidden"),
    leagueKpisHidden: document.getElementById("statsLeagueKpisCard").classList.contains("hidden"),
    emptyShown: !document.getElementById("statsChampionsEmpty").hidden,
    scorersTitle: document.getElementById("statsScorersLeagueTitle").textContent,
  }));
  console.log("4) Campeonato/Histórico (carreira nova) mostra Campeões vazio, sem quebrar:",
    check4.championsVisible && check4.leagueKpisHidden && check4.emptyShown && check4.scorersTitle.includes("históricos"),
    JSON.stringify(check4));

  // 5) Simula UMA partida vencida (mandante ou visitante, o que a
  // rodada corrente trouxer) e confere que Meu Time / Temporada e
  // Histórico refletem V=1, clean sheet, no lado certo (casa/fora).
  await page.evaluate(() => switchToPanel("central"));
  await page.waitForTimeout(200);
  const myFixtureIsHome = await page.evaluate(() => {
    const fx = CAREER.schedule[CAREER.currentRound].find((f) => String(f.home) === String(CAREER.clubId) || String(f.away) === String(CAREER.clubId));
    return String(fx.home) === String(CAREER.clubId);
  });
  await page.click("#btnSimulate");
  await page.waitForSelector("#preMatchOverlay.open", { timeout: 5000 });
  await page.click("#btnPreMatchGo");
  await page.waitForSelector("#liveMatchOverlay.open", { timeout: 5000 });
  await page.click("#btnLiveSkip");
  await page.waitForSelector("#matchDetailOverlay.open, #roundResultsOverlay.open", { timeout: 10000 });
  await page.waitForTimeout(300);
  if (await page.evaluate(() => document.getElementById("matchDetailOverlay").classList.contains("open"))) {
    await page.click("#btnMatchDetailContinue");
    await page.waitForTimeout(300);
    if (await page.evaluate(() => document.getElementById("pressOverlay").classList.contains("open"))) {
      await page.click("#pressOptions [data-press]");
      await page.waitForTimeout(300);
    }
    // "Continuar" de Notícias faz parte do MESMO fluxo pós-jogo (mesmo
    // clique defensivo já usado em outros testes desta sessão).
    await page.waitForSelector("#newsOverlay.open", { timeout: 5000 }).catch(() => {});
    if (await page.evaluate(() => document.getElementById("newsOverlay").classList.contains("open"))) {
      await page.click("#btnNewsContinue");
      await page.waitForTimeout(300);
    }
  }
  if (await page.evaluate(() => document.getElementById("roundResultsOverlay").classList.contains("open"))) {
    await page.click("#btnRoundResultsContinue");
    await page.waitForTimeout(300);
  }
  if (await page.evaluate(() => document.getElementById("playerOfferOverlay")?.classList.contains("open"))) {
    await page.click("#btnPlayerOfferDecline");
    await page.waitForTimeout(300);
  }
  if (await page.evaluate(() => document.getElementById("tabelaModalOverlay")?.classList.contains("open"))) {
    await page.click("#tabelaModalClose");
    await page.waitForTimeout(200);
  }
  // O motor Ao Vivo (play-by-play real, chunk a chunk) decide o placar
  // sozinho -- lê o resultado de verdade em vez de forçar um placar, e
  // confere que os novos contadores bateram com ele (consistência
  // interna: temporada == histórico == CAREER.standings, lado certo,
  // clean sheet só se ga===0, sequência bate com o resultado).
  const sideKey = myFixtureIsHome ? "home" : "away";
  const afterMatch = await page.evaluate((sideKey) => {
    const my = CAREER.standings[CAREER.clubId];
    return {
      teamStats: JSON.parse(JSON.stringify(CAREER.teamStats)),
      careerTotals: JSON.parse(JSON.stringify(CAREER.careerTotals)),
      currentWinStreak: CAREER.currentWinStreak, currentUnbeatenStreak: CAREER.currentUnbeatenStreak,
      standings: { v: my.v, e: my.e, d: my.d, gp: my.gp, gc: my.gc },
    };
  }, sideKey);
  const outcome = afterMatch.standings.v ? "v" : afterMatch.standings.e ? "e" : "d";
  const expectCleanSheet = afterMatch.standings.gc === 0 ? 1 : 0;
  const expectWinStreak = outcome === "v" ? 1 : 0;
  const expectUnbeatenStreak = outcome !== "d" ? 1 : 0;
  console.log(`5) Resultado (${outcome}, ${afterMatch.standings.gp}x${afterMatch.standings.gc}, ${sideKey}) bate igual no lado certo (temporada e histórico), clean sheet e sequência corretos:`,
    afterMatch.teamStats[sideKey].j === 1 && afterMatch.teamStats[sideKey][outcome] === 1
    && afterMatch.teamStats[sideKey].gp === afterMatch.standings.gp && afterMatch.teamStats[sideKey].gc === afterMatch.standings.gc
    && afterMatch.teamStats.cleanSheets === expectCleanSheet
    && afterMatch.careerTotals.j === 1 && afterMatch.careerTotals[outcome] === 1 && afterMatch.careerTotals[sideKey].j === 1
    && afterMatch.careerTotals.cleanSheets === expectCleanSheet
    && afterMatch.currentWinStreak === expectWinStreak && afterMatch.currentUnbeatenStreak === expectUnbeatenStreak,
    JSON.stringify(afterMatch));

  // 6) Tela reflete isso de verdade (Meu Time / Temporada).
  await openStats();
  await page.click('#statsScopeTabs .mt-obj-tab[data-scope="time"]');
  await page.click('#statsPeriodTabs .mt-obj-tab[data-period="temporada"]');
  await page.waitForTimeout(150);
  const check6 = await page.evaluate(() => ({
    recordText: document.getElementById("statsRecordKpis").textContent,
    homeAwayText: document.getElementById("statsHomeAwayTable").textContent,
    streakText: document.getElementById("statsStreakKpis").textContent,
    biggestText: document.getElementById("statsBiggestList").textContent,
  }));
  const expectBiggestLabel = outcome === "v" ? "Maior goleada" : outcome === "d" ? "Maior derrota" : null;
  console.log("6) Tela (Meu Time/Temporada) mostra o resultado de verdade:",
    check6.recordText.includes("Vitórias") && check6.homeAwayText.includes(sideKey === "home" ? "mandante" : "visitante")
    && (expectBiggestLabel ? check6.biggestText.includes(expectBiggestLabel) : true),
    JSON.stringify(check6));

  // 7) Copa do Brasil — conteúdo aparece sem quebrar, nos 2 períodos.
  const check7 = await page.evaluate(() => document.getElementById("statsCopaContent").textContent.length > 5);
  await page.click('#statsPeriodTabs .mt-obj-tab[data-period="historico"]');
  await page.waitForTimeout(150);
  const check7b = await page.evaluate(() => document.getElementById("statsCopaContent").textContent);
  console.log("7) Card da Copa do Brasil aparece nos 2 períodos, sem quebrar:", check7 && check7b.includes("Edições"), check7b.replace(/\s+/g, " ").trim());

  // 8) Avança a temporada (via API, pulando pro fim) e confere que o
  // histórico de campeões grava alguma coisa coerente.
  await page.evaluate(async () => {
    const r = await fetch("/api/career");
    const data = await r.json();
    data.career.currentRound = 39;
    await fetch("/api/career", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data.career) });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(200);
  await page.click("#btnAdvanceSeason");
  await page.waitForSelector("#confirmOverlay.open", { timeout: 5000 });
  await page.click("#confirmOkBtn");
  await page.waitForTimeout(500);
  await page.click("#btnSeasonContinue").catch(() => {});
  await page.waitForTimeout(300);
  const afterSeason = await page.evaluate(() => ({
    champions: JSON.parse(JSON.stringify(CAREER.leagueChampions || [])),
    seasonsPlayed: (CAREER.careerTotals || {}).seasonsPlayed,
  }));
  console.log("8) advanceSeason grava 1 entrada em leagueChampions (campeão/vice/minha posição) e seasonsPlayed=1:",
    afterSeason.champions.length === 1 && !!afterSeason.champions[0].championName && afterSeason.seasonsPlayed === 1,
    JSON.stringify(afterSeason));

  // 9) Tela (Campeonato/Histórico) mostra a temporada encerrada de
  // verdade agora.
  await openStats();
  await page.click('#statsScopeTabs .mt-obj-tab[data-scope="campeonato"]');
  await page.click('#statsPeriodTabs .mt-obj-tab[data-period="historico"]');
  await page.waitForTimeout(150);
  const check9 = await page.evaluate(() => ({
    championsRows: document.querySelectorAll("#leagueChampionsTable .mt-mini-row").length,
    titlesRows: document.querySelectorAll("#titlesByClubTable .mt-mini-row").length,
    emptyHidden: document.getElementById("statsChampionsEmpty").hidden,
  }));
  console.log("9) Campeonato/Histórico mostra 1 temporada de campeões + títulos por clube, sem estado vazio:",
    check9.championsRows === 1 && check9.titlesRows === 1 && check9.emptyHidden, JSON.stringify(check9));

  await browser.close();
  console.log("OK");
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
