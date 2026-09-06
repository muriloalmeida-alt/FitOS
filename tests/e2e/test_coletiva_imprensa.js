const { chromium } = require("playwright-core");

async function newCareer(page, base, email) {
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Coletiva Test", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(200);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
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
  page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("fonts.googleapis") && !m.text().includes("fundingchoices")) console.log("CONSOLE ERROR:", m.text()); });

  const base = "http://localhost:8787";
  await newCareer(page, base, `coletiva${Date.now()}@teste.com`);

  // 1) Biblioteca tem as 21 situações, cada uma com 2 ou 3 respostas.
  const libCheck = await page.evaluate(() => ({
    total: PRESS_LIBRARY.length,
    allHaveOptions: PRESS_LIBRARY.every((e) => e.respostas.length === 2 || e.respostas.length === 3),
    ids: PRESS_LIBRARY.map((e) => e.id),
  }));
  console.log("1) Biblioteca com 21 situações, cada uma com 2-3 respostas:", libCheck.total === 21 && libCheck.allHaveOptions);

  // 2) Determinação de gatilho: goleada aplicada (margem >= 3). Evita
  // clube "grande" (clássico tem prioridade maior, ver PRESS_PRIORITY)
  // pra não confundir o teste.
  // Math.random forçado a 0 nos testes 2-5/7: determineMatchPressTrigger
  // agora joga uma "moeda" de chance de disparo (ver PRESS_CHANCE_BY_ID)
  // mesmo pra gatilhos especiais (documento: "não acontece toda
  // partida") -- sem fixar o random, esses testes ficariam
  // aleatoriamente flaky por design (o comportamento em si está certo,
  // só o teste precisa de determinismo).
  const t1 = await page.evaluate(() => {
    Math.__realRandom = Math.random;
    Math.random = () => 0;
    const oppId = LEAGUE_TEAMS.map((t) => t.id).find((id) => String(id) !== String(CAREER.clubId) && !isBigClub(id));
    return determineMatchPressTrigger({
      myGoals: 4, oppGoals: 0, isHome: true, myClubId: CAREER.clubId, oppClubId: oppId,
      winlessBefore: 0, injuredBeforeIds: new Set(), events: [], roundPlayed: 10,
    });
  });
  console.log("2) Goleada aplicada dispara gatilho 12:", t1 && t1.id === "12");

  // 3) Zebra sofrida: perde pra time com overall bem menor.
  const t2 = await page.evaluate(() => {
    // Acha um adversário BEM mais fraco que o meu clube (ou força
    // artificialmente derrubando o overall do adversário).
    const oppId = LEAGUE_TEAMS.map((t) => t.id).find((id) => String(id) !== String(CAREER.clubId) && !isBigClub(id));
    CAREER.leagueSquads[String(oppId)].forEach((p) => { p.overall = 30; });
    CAREER.squad.filter((p) => p.origin === "principal").forEach((p) => { p.overall = 85; });
    return determineMatchPressTrigger({
      myGoals: 0, oppGoals: 1, isHome: true, myClubId: CAREER.clubId, oppClubId: oppId,
      winlessBefore: 0, injuredBeforeIds: new Set(), events: [], roundPlayed: 11,
    });
  });
  console.log("3) Zebra sofrida (perder pro fraco) dispara gatilho 10:", t2 && t2.id === "10");

  // 4) Lanterna vence e reage: estava em último, vence.
  const t3 = await page.evaluate(() => {
    const allIds = Object.keys(CAREER.standings);
    allIds.forEach((id, i) => { CAREER.standings[id].pts = 100 - i; });
    // Meu clube fica em último (pontuação mais baixa) e VENCE agora.
    const others = allIds.filter((id) => id !== String(CAREER.clubId));
    others.forEach((id, i) => { CAREER.standings[id].pts = 200 + i; });
    CAREER.standings[CAREER.clubId].pts = 1;
    const oppId = others.find((id) => !isBigClub(id)) || others[0];
    return determineMatchPressTrigger({
      myGoals: 1, oppGoals: 0, isHome: true, myClubId: CAREER.clubId, oppClubId: oppId,
      winlessBefore: 0, injuredBeforeIds: new Set(), events: [], roundPlayed: 12,
    });
  });
  console.log("4) Time em último vencendo dispara gatilho 09 (lanterna reage) ou 08 (zona):", t3 && (t3.id === "09" || t3.id === "08"));

  // 5) Meta em risco: posição bem pior que a meta, só dispara 1x por
  // temporada.
  const t4 = await page.evaluate(() => {
    const allIds = Object.keys(CAREER.standings);
    allIds.forEach((id, i) => { CAREER.standings[id].pts = 100 - i; });
    CAREER.standings[CAREER.clubId].pts = -999; // garante ser o último
    CAREER.boardGoal = { type: "posicao_tabela", target: 6, label: "Terminar entre os 6 primeiros" };
    CAREER.metaRiskWarnedSeason = null;
    const oppId = allIds.find((id) => id !== String(CAREER.clubId));
    const first = determineMatchPressTrigger({
      myGoals: 0, oppGoals: 0, isHome: true, myClubId: CAREER.clubId, oppClubId: oppId,
      winlessBefore: 0, injuredBeforeIds: new Set(), events: [], roundPlayed: 13,
    });
    const second = determineMatchPressTrigger({
      myGoals: 0, oppGoals: 0, isHome: true, myClubId: CAREER.clubId, oppClubId: oppId,
      winlessBefore: 0, injuredBeforeIds: new Set(), events: [], roundPlayed: 14,
    });
    return { firstId: first && first.id, secondId: second && second.id, warnedSeason: CAREER.metaRiskWarnedSeason === CAREER.seasonYear };
  });
  console.log("5) Meta em risco dispara (gatilho 20 ou zona 08, ambos plausíveis com último lugar):", ["20", "08"].includes(t4.firstId));
  console.log("   Meta em risco NÃO repete no mesmo jogo se já avisou:", t4.secondId !== "20" || t4.firstId !== "20");

  // Restaura o Math.random de verdade antes de qualquer simulação real
  // de partida (checks 6 em diante) -- forçar em 0 só era seguro
  // isolado dentro das chamadas diretas a determineMatchPressTrigger
  // acima, sem nenhuma outra lógica do jogo rodando no meio.
  await page.evaluate(() => { Math.random = Math.__realRandom || Math.random; });

  // 6) Aplicar resposta muda reputação e moral do elenco, grava no
  // histórico (pressLog).
  const applyCheck = await page.evaluate(() => {
    const repBefore = CAREER.reputation;
    const moraleBefore = CAREER.squad.find((p) => p.origin === "principal").morale;
    firePressConference("12", 15, false); // goleada aplicada, resposta A é sempre a mais positiva
    applyPressAnswer("A");
    return {
      repAfter: CAREER.reputation, repBefore,
      moraleAfter: CAREER.squad.find((p) => p.origin === "principal").morale, moraleBefore,
      logLen: (CAREER.pressLog || []).length,
      logEntry: CAREER.pressLog[0],
    };
  });
  console.log("6) Resposta A (goleada aplicada) sobe reputação e moral:", applyCheck.repAfter > applyCheck.repBefore, applyCheck.moraleAfter > applyCheck.moraleBefore);
  console.log("   Fica registrado no histórico (pressLog):", applyCheck.logLen === 1 && applyCheck.logEntry.letra === "A" && applyCheck.logEntry.round === 15);

  // 7) Fluxo real via UI: força uma goleada no PRÓPRIO jogo (derruba o
  // overall do adversário CPU) e confere que a coletiva aparece ENTRE
  // o modal "Seu jogo" e o de Resultados da rodada.
  const uiSetup = await page.evaluate(() => {
    const myId = CAREER.clubId;
    const fixtures = CAREER.schedule[CAREER.currentRound] || [];
    const humanFx = fixtures.find((fx) => String(fx.home) === String(myId) || String(fx.away) === String(myId));
    const oppId = String(humanFx.home) === String(myId) ? humanFx.away : humanFx.home;
    (CAREER.leagueSquads[String(oppId)] || []).forEach((p) => { p.atk = 1; p.def = 200; p.overall = 20; });
    CAREER.squad.filter((p) => p.origin === "principal").forEach((p) => { p.atk = 99; p.overall = 95; });
    return { oppId };
  });
  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(300);
  await page.click("#btnSimulate");
  await page.waitForSelector("#preMatchOverlay.open", { timeout: 5000 });
  await page.click("#btnPreMatchGo");
  // AJUSTE (item 4, pedido do usuário: "o jogo deve pausar no
  // intervalo (45) e aguardar que o técnico clique em prosseguir") —
  // clica em "Prosseguir" se o jogo parar no intervalo antes de seguir
  // esperando o resto do fluxo.
  await page.waitForSelector("#liveMatchOverlay.open", { timeout: 5000 }).catch(() => {});
  await page.waitForFunction(() => typeof LIVE_MATCH !== 'undefined' && LIVE_MATCH && (LIVE_MATCH.halftime || LIVE_MATCH.finished), { timeout: 15000 }).catch(() => {});
  if (await page.evaluate(() => typeof LIVE_MATCH !== 'undefined' && LIVE_MATCH && LIVE_MATCH.halftime)) {
    await page.click("#btnLiveContinueSecondHalf");
  }
  await page.waitForSelector("#liveMatchOverlay.open", { timeout: 5000 });
  await page.evaluate(() => skipLiveMatch());
  await page.waitForSelector("#matchDetailOverlay.open", { timeout: 5000 });
  await page.click("#btnMatchDetailContinue");
  await page.waitForTimeout(300);
  const pressAppeared = await page.evaluate(() => document.getElementById("pressOverlay").classList.contains("open"));
  console.log("7) Coletiva aparece após 'Seu jogo' quando a situação bate (goleada forçada):", pressAppeared);
  if (pressAppeared) {
    const questionText = await page.evaluate(() => document.getElementById("pressQuestion").textContent);
    const optCount = await page.evaluate(() => document.querySelectorAll("#pressOptions [data-press]").length);
    console.log("   Pergunta e opções carregadas:", questionText.length > 5, "| opções:", optCount);
    await page.click("#pressOptions [data-press]");
    await page.waitForTimeout(300);
    const wentToNews = await page.evaluate(() => !document.getElementById("pressOverlay").classList.contains("open") && document.getElementById("newsOverlay").classList.contains("open"));
    console.log("   Responder fecha a coletiva e segue pra tela de Notícias (tela cheia):", wentToNews);
  } else {
    // Sem coletiva (chance de disparo pode ter caído nesse ramo mesmo
    // com a goleada) — segue direto pra tela de Notícias.
    const wentToNews = await page.evaluate(() => document.getElementById("newsOverlay").classList.contains("open"));
    console.log("   Sem coletiva -- seguiu direto pra tela de Notícias (tela cheia):", wentToNews);
  }
  // AJUSTE (pedido do usuário: "notícias em tela cheia antes dos
  // resultados dos jogos") — "Continuar" da tela de Notícias é quem
  // agora leva pros Resultados da rodada, com ou sem coletiva no meio.
  await page.click("#btnNewsContinue");
  await page.waitForTimeout(300);
  const reachedRoundResults = await page.evaluate(() => document.getElementById("roundResultsOverlay").classList.contains("open"));
  console.log("   'Continuar' das Notícias leva pros Resultados da rodada:", reachedRoundResults);
  await page.click("#btnRoundResultsContinue").catch(() => {});
  await page.waitForTimeout(200);
  await page.click("#tabelaModalClose").catch(() => {});

  // 8) X fecha sem aplicar efeito (conta como "sem comentário").
  const xCheck = await page.evaluate(() => {
    const repBefore = CAREER.reputation;
    firePressConference("12", CAREER.currentRound, false);
    openPressConferenceModal();
    return repBefore;
  });
  await page.waitForSelector("#pressOverlay.open");
  await page.click("#pressClose");
  await page.waitForTimeout(200);
  const afterX = await page.evaluate(() => ({ rep: CAREER.reputation, closed: !document.getElementById("pressOverlay").classList.contains("open") }));
  console.log("8) X fecha sem mudar reputação:", afterX.rep === xCheck, "| modal fechou:", afterX.closed);

  // 9) Contratação polêmica / venda de ídolo: ver test_coletiva_buy.js
  // (script separado, mais enxuto, pra não competir com a flakiness de
  // rede desse script mais longo).

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
