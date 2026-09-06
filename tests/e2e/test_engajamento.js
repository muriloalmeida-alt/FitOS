// Testa os 4 sistemas de Retenção/Engajamento (BRDataRetencaoEspecificacao):
// login diário com streak, objetivos em camadas, conquistas permanentes,
// ranking assíncrono (amigos + global).
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `engaj${Date.now()}@teste.com`;
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

  // 1) Login diário: modal abre sozinha (carreira nova, ainda não coletou hoje).
  const loginModalOpen = await page.evaluate(() => document.getElementById("dailyLoginOverlay").classList.contains("open"));
  const loginInfo = await page.evaluate(() => ({
    subtitle: document.getElementById("dailyLoginSubtitle").textContent,
    rewardLabel: document.getElementById("dailyLoginRewardLabel").textContent,
    cells: document.querySelectorAll("#dailyLoginTrack .mt-day-cell-login").length,
  }));
  console.log("1) Modal de login diário abre sozinha (dia 1, 7 células):", loginModalOpen && loginInfo.cells === 7 && loginInfo.subtitle.includes("DIA 1 DE 7"), JSON.stringify(loginInfo));

  const cashBefore = await page.evaluate(() => CAREER.finances.cash);
  await page.click("#btnClaimDailyLogin");
  await page.waitForTimeout(300);
  const afterClaim = await page.evaluate(() => ({
    modalClosed: !document.getElementById("dailyLoginOverlay").classList.contains("open"),
    cashAfter: CAREER.finances.cash,
    meStreak: ME.dailyLogin.currentStreakDay,
  }));
  console.log("2) Coletar dia 1 aplica +500 moedas e fecha a modal:", afterClaim.modalClosed && afterClaim.cashAfter === cashBefore + 500 && afterClaim.meStreak === 1, JSON.stringify(afterClaim));

  // Coletar de novo no mesmo dia (chamando a função direto -- a modal já
  // fechou) deve falhar com erro claro (409 do servidor).
  const secondClaimError = await page.evaluate(async () => {
    try {
      await fetchJSON("/api/daily-login/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ localDate: localDateStr() }) });
      return null;
    } catch (err) { return err.message; }
  });
  console.log("2b) Coletar de novo no mesmo dia é rejeitado:", secondClaimError && secondClaimError.includes("já foi coletada"), secondClaimError);

  // 2) Objetivos: aba abre com os 3 objetivos diários certos.
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='progresso']");
  await page.click("#btnOpenObjetivos");
  await page.waitForTimeout(200);
  const objState = await page.evaluate(() => ({
    panelActive: document.getElementById("panel-objetivos").classList.contains("active"),
    cards: document.querySelectorAll("#objectivesList .mt-obj-card").length,
    titles: [...document.querySelectorAll("#objectivesList .mt-obj-title")].map((el) => el.textContent),
  }));
  console.log("3) Aba Objetivos abre com os 3 objetivos diários do documento:", objState.panelActive && objState.cards === 3, JSON.stringify(objState));

  // Trocar pra aba Semanal/Temporada mostra os objetivos certos.
  await page.click('#objectivesTabs .mt-obj-tab[data-tab="weekly"]');
  await page.waitForTimeout(150);
  const weeklyTitles = await page.evaluate(() => [...document.querySelectorAll("#objectivesList .mt-obj-title")].map((el) => el.textContent));
  console.log("3b) Aba Semanal mostra os 2 objetivos certos:", weeklyTitles.length === 2 && weeklyTitles.some((t) => t.includes("3 jogos seguidos")), JSON.stringify(weeklyTitles));
  await page.click('#objectivesTabs .mt-obj-tab[data-tab="season"]');
  await page.waitForTimeout(150);
  const seasonTitles = await page.evaluate(() => [...document.querySelectorAll("#objectivesList .mt-obj-title")].map((el) => el.textContent));
  console.log("3c) Aba Temporada mostra os 2 objetivos certos:", seasonTitles.length === 2 && seasonTitles.some((t) => t.includes("4 primeiros")), JSON.stringify(seasonTitles));
  await page.click('#objectivesTabs .mt-obj-tab[data-tab="daily"]');
  await page.waitForTimeout(150);

  // 3) Objetivo "Faça 1 movimentação no mercado" -- janela de
  // transferências fechada na rodada 1 (mesmo comportamento de sempre,
  // ver transferWindowStatus -- nada a ver com Retenção/Engajamento).
  // buyPlayer()/confirmModal() não existem mais pra compra instantânea
  // (Bloco 3, pré-existente, sem relação com o checklist de UX desta
  // etapa -- "Comprar" hoje abre uma negociação real, ver
  // openOfferModal/confirmOfferFromModal). finalizeIncomingPurchase()
  // é a função que uma proposta aceita chama de verdade pra fechar a
  // compra (inclusive bumpObjective do mercado) -- chama direto,
  // contornando o mesmo gate de janela sem precisar simular rodadas
  // até abrir de verdade.
  await page.evaluate(() => {
    const clubId = Object.keys(CAREER.leagueSquads)[0];
    const target = CAREER.leagueSquads[clubId][0];
    window.__buyTarget = target.id;
    finalizeIncomingPurchase({ clubId, playerId: target.id, playerName: target.name, clubName: teamById(clubId).name, offerValue: target.value, installments: 1 });
  });
  await page.waitForTimeout(300);
  // Contratação de craque (overall >= 82) pode abrir uma coletiva por
  // cima -- responde pra não travar o resto (mesmo clique defensivo já
  // usado em outros testes desta sessão).
  if (await page.evaluate(() => document.getElementById("pressOverlay").classList.contains("open"))) {
    await page.click("#pressOptions [data-press]");
    await page.waitForTimeout(300);
  }
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='progresso']");
  await page.click("#btnOpenObjetivos");
  await page.waitForTimeout(200);
  const marketObjState = await page.evaluate(() => {
    const list = CAREER.objectives.daily;
    const o = list.find((x) => x.objectiveId === "obj_market_1_move");
    return { status: o.status, currentProgress: o.currentProgress };
  });
  console.log("4) Comprar jogador completa 'Faça 1 movimentação no mercado':", marketObjState.status === "completed" && marketObjState.currentProgress === 1, JSON.stringify(marketObjState));

  // Coletar o objetivo completado.
  const cashBeforeClaimObj = await page.evaluate(() => CAREER.finances.cash);
  await page.click('[data-claim-objective="obj_market_1_move"]');
  await page.waitForTimeout(300);
  const afterClaimObj = await page.evaluate(() => ({
    status: CAREER.objectives.daily.find((o) => o.objectiveId === "obj_market_1_move").status,
    cash: CAREER.finances.cash,
  }));
  console.log("5) Coletar o objetivo aplica +150 e vira 'claimed':", afterClaimObj.status === "claimed" && afterClaimObj.cash === cashBeforeClaimObj + 150, JSON.stringify(afterClaimObj));

  // 4) Conquistas: aba abre, filtro funciona, detalhe abre.
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='progresso']");
  await page.click("#btnOpenConquistas");
  await page.waitForTimeout(200);
  const achState = await page.evaluate(() => ({
    subtitle: document.getElementById("achievementsSubtitle").textContent,
    badges: document.querySelectorAll("#achievementsGrid .mt-badge").length,
    nextText: document.getElementById("achievementsNext").textContent,
  }));
  console.log("6) Aba Conquistas mostra as 7 do catálogo, 0 desbloqueadas no início:", achState.badges === 7 && achState.subtitle.includes("0 DE 7"), JSON.stringify(achState));

  await page.click('#achievementsFilters .mt-chip[data-filter="titulos"]');
  await page.waitForTimeout(150);
  const filteredBadges = await page.evaluate(() => document.querySelectorAll("#achievementsGrid .mt-badge").length);
  console.log("6b) Filtro 'Títulos' mostra só 2 (Campeão Brasileiro + Copa):", filteredBadges === 2);
  await page.click('#achievementsFilters .mt-chip[data-filter="todas"]');
  await page.waitForTimeout(150);

  await page.click('[data-achievement="ach_idolo"]');
  await page.waitForTimeout(150);
  const detailInfo = await page.evaluate(() => ({
    open: document.getElementById("achievementDetailOverlay").classList.contains("open"),
    title: document.getElementById("achievementDetailTitle").textContent,
    progress: document.getElementById("achievementDetailProgress").textContent,
    shareHidden: document.getElementById("btnShareAchievement").hidden,
  }));
  console.log("7) Detalhe da conquista abre (bloqueada, sem botão compartilhar):", detailInfo.open && detailInfo.title === "Ídolo" && detailInfo.shareHidden, JSON.stringify(detailInfo));
  await page.click("#achievementDetailClose");
  await page.waitForTimeout(150);

  // Forçar desbloqueio de uma conquista direto (promover 5 jogadores da
  // base) pra testar o fluxo de "unlocked" + botão compartilhar.
  await page.evaluate(() => {
    const basePlayers = CAREER.squad.filter((p) => p.origin === "base").slice(0, 5);
    basePlayers.forEach((p) => handlePlayerAction(p.id, "promote"));
  });
  await page.waitForTimeout(200);
  const joiaEntry = await page.evaluate(() => CAREER.achievements.find((a) => a.achievementId === "ach_joia_base"));
  console.log("8) Promover 5 da base desbloqueia 'Joia da Base':", joiaEntry.unlockedAt != null && joiaEntry.currentProgress === 5, JSON.stringify(joiaEntry));
  await page.click("#btnOpenConquistas").catch(() => {});
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='progresso']");
  await page.click("#btnOpenConquistas");
  await page.waitForTimeout(200);
  await page.click('[data-achievement="ach_joia_base"]');
  await page.waitForTimeout(150);
  const joiaDetail = await page.evaluate(() => ({
    progress: document.getElementById("achievementDetailProgress").textContent,
    shareHidden: document.getElementById("btnShareAchievement").hidden,
  }));
  console.log("8b) Detalhe mostra desbloqueada + botão compartilhar visível:", joiaDetail.progress.includes("Desbloqueada") && !joiaDetail.shareHidden, JSON.stringify(joiaDetail));
  await page.click("#achievementDetailClose");
  await page.waitForTimeout(150);

  // 5) Ranking: abre, publica score, mostra card própria posição.
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='progresso']");
  await page.click("#btnOpenRanking");
  await page.waitForTimeout(500);
  const rankState = await page.evaluate(() => ({
    panelActive: document.getElementById("panel-ranking").classList.contains("active"),
    friendCode: document.getElementById("rankingFriendCode").textContent,
    myCardHidden: document.getElementById("rankingMyCard").hidden,
    myCardHTML: document.getElementById("rankingMyCard").innerHTML,
    listHTML: document.getElementById("rankingList").innerHTML.slice(0, 200),
  }));
  console.log("9) Ranking abre, mostra código de amigo + própria posição:", rankState.panelActive && rankState.friendCode.length === 6 && !rankState.myCardHidden && rankState.myCardHTML.includes("Murilo Melo"), JSON.stringify({ friendCode: rankState.friendCode, myCardHidden: rankState.myCardHidden }));

  // Trocar pra Global.
  await page.click('#rankingScopeToggle .mt-scope-btn[data-scope="global"]');
  await page.waitForTimeout(300);
  const globalState = await page.evaluate(() => document.getElementById("rankingList").innerHTML.includes("Murilo Melo"));
  console.log("10) Escopo Global também mostra a própria entrada:", globalState);

  await page.screenshot({ path: "engaj_01_ranking.png" });
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='progresso']");
  await page.click("#btnOpenObjetivos");
  await page.waitForTimeout(200);
  await page.screenshot({ path: "engaj_02_objetivos.png" });
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='progresso']");
  await page.click("#btnOpenConquistas");
  await page.waitForTimeout(200);
  await page.screenshot({ path: "engaj_03_conquistas.png" });

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
