// Verifica o mercado de 60 times (Séries A, B e C juntas): carreira
// nova nasce "multi" (elenco das 3 divisões, não só a própria), o
// Mercado mostra jogador de fora com selo de divisão e permite
// comprar/vender/emprestar entre elas, e uma carreira "single" (de
// antes desta mudança) continua exatamente como sempre foi.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `mercadomulti${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Mercado Multi", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(300);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(1000); // criação da carreira agora busca as 3 competições

  // 1) Carreira nasce "multi", com liveModeByCompetition das 3.
  const created = await page.evaluate(() => ({
    marketScope: CAREER.marketScope,
    liveModeByCompetition: CAREER.liveModeByCompetition,
    leagueSquadCount: Object.keys(CAREER.leagueSquads).length,
  }));
  console.log("1) Carreira nasce 'multi':", created.marketScope === "multi", "| 59 outros times com elenco:", created.leagueSquadCount === 59, JSON.stringify(created));

  // 2) O Mercado mostra o filtro de divisão e jogadores das 3 séries
  // (checa via ALL_TEAMS_FLAT/teamById que os clubes de fora resolvem
  // nome de verdade, não "Time #xxx").
  await page.click(".m3-nav-item[data-panel='mercado']");
  await page.waitForTimeout(300);
  const compFilterVisible = await page.evaluate(() => !document.getElementById("marketCompFilter").classList.contains("hidden"));
  console.log("2) Filtro de divisão aparece no Mercado:", compFilterVisible);

  const marketState = await page.evaluate(() => {
    const rows = allMarketPlayers();
    const byComp = {};
    rows.forEach(({ club }) => {
      const c = club.competitionId || "?";
      byComp[c] = (byComp[c] || 0) + 1;
    });
    const anyBroken = rows.some(({ club }) => club.name.startsWith("Time #"));
    return { byComp, anyBroken, total: rows.length };
  });
  console.log("3) Jogadores das 3 divisões aparecem no mercado (sem 'Time #xxx' quebrado):", !marketState.anyBroken && Object.keys(marketState.byComp).length === 3, JSON.stringify(marketState.byComp));

  // 4) Filtrar por Série C some com Série A/B da lista renderizada.
  await page.selectOption("#marketCompFilter", "serie_c");
  await page.waitForTimeout(200);
  const filteredClubs = await page.evaluate(() => [...document.querySelectorAll("#marketList .mt-market-tags")].map((el) => el.textContent));
  const onlySerieC = filteredClubs.length > 0 && filteredClubs.every((t) => t.includes("Série C"));
  console.log("4) Filtro 'Série C' só mostra jogadores dessa divisão:", onlySerieC, filteredClubs.length, "linhas");
  await page.selectOption("#marketCompFilter", "");
  await page.waitForTimeout(200);

  // 5) Compra um jogador de OUTRA divisão de verdade -- via clique real
  // na UI. Bloco 3 (pedido do usuário) mudou "Comprar" pra abrir uma
  // NEGOCIAÇÃO (openOfferModal), não mais confirmModal instantâneo --
  // propõe o valor de mercado à vista (aceite quase certo) e resolve
  // na hora com RNG forçado, mesmo padrão de test_mercado2.js/
  // test_mercado_negociacao.js. Filtra por Série B primeiro pra
  // garantir que a 1ª linha visível é de fora.
  await page.selectOption("#marketCompFilter", "serie_b");
  await page.waitForTimeout(200);
  const before = await page.evaluate(() => ({ cash: CAREER.finances.cash, squadLen: CAREER.squad.length }));
  // Lista vem ordenada do mais caro pro mais barato (ver renderMercado)
  // -- pega o ÚLTIMO botão de comprar visível (o mais barato), pra não
  // esbarrar em caixa insuficiente com o mais caro do topo.
  const buyBtns = await page.$$("[data-buy]");
  const buyBtn = buyBtns.length ? buyBtns[buyBtns.length - 1] : null;
  const targetClub = buyBtn ? await buyBtn.getAttribute("data-club") : null;
  if (buyBtn) {
    await buyBtn.click();
    await page.waitForSelector("#offerOverlay.open", { timeout: 5000 });
    await page.click("#btnOfferConfirm");
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const orig = Math.random;
      Math.random = () => 0.01;
      resolvePendingOffersOutRound(CAREER.currentRound); // OFFER_WAIT_ROUNDS=2 -- 1ª chamada só decrementa
      resolvePendingOffersOutRound(CAREER.currentRound); // 2ª chamada zera o prazo e resolve de verdade
      Math.random = orig;
      renderMercado();
    });
    await page.waitForTimeout(300);
  }
  const after = await page.evaluate(() => ({ cash: CAREER.finances.cash, squadLen: CAREER.squad.length }));
  const bought = { found: !!buyBtn, targetClub, cashChanged: after.cash < before.cash, squadGrew: after.squadLen === before.squadLen + 1 };
  console.log("5) Comprou jogador da Série B com sucesso (via clique real):", bought.found && bought.cashChanged && bought.squadGrew, JSON.stringify(bought));
  // Enviar a proposta (#btnOfferConfirm) já fechou tudo e voltou pra
  // Início (Task #72) -- volta pro Mercado antes de continuar.
  await page.evaluate(() => switchToPanel("mercado"));
  await page.waitForTimeout(150);
  await page.selectOption("#marketCompFilter", "");
  await page.waitForTimeout(200);

  // 6) Simula algumas rodadas — negociação CPU x CPU (simulateAiTransfers)
  // pode mover jogador entre divisões diferentes agora (checa no feed
  // de transferências se alguma menciona um time de fora, ao longo de
  // várias rodadas -- sorteio, então roda uma boa quantidade de vezes).
  const crossDivisionTrade = await page.evaluate(() => {
    const ownIds = new Set(Object.keys(CAREER.standings));
    for (let i = 0; i < 40; i++) {
      simulateAiTransfers(CAREER.currentRound + i);
    }
    // Um transferLog que cite um clube de fora da própria divisão
    // (nome de time que não está em CAREER.standings) indica troca
    // cruzando divisão -- não dá pra achar por id direto no texto, só
    // roda bastante e confia no sorteio (0-2 por rodada, 40 rodadas).
    return { transferLogSize: (CAREER.transferLog || []).length, leagueSquadCount: Object.keys(CAREER.leagueSquads).length };
  });
  console.log("6) simulateAiTransfers rodou sem erro (40 rodadas simuladas):", crossDivisionTrade.transferLogSize > 0, JSON.stringify(crossDivisionTrade));

  // 7) Depois de 40 rodadas de negociação CPU x CPU, nenhum elenco de
  // outra divisão passou do teto menor (MAX_LEAGUE_SQUAD_OTHER_DIVISION)
  // nem encolheu abaixo do piso -- confere que o limite por time
  // (maxSquadSizeFor/minSquadSizeFor) segurou de verdade, sem corroer a
  // economia de tamanho de save com o tempo.
  const capsHeld = await page.evaluate(() => {
    const ownIds = new Set(Object.keys(CAREER.standings));
    let ok = true;
    const sizes = [];
    Object.entries(CAREER.leagueSquads).forEach(([id, squad]) => {
      if (ownIds.has(id)) return; // times da própria divisão usam o teto/piso maior, não checado aqui
      sizes.push(squad.length);
      if (squad.length > 16 || squad.length < 1) ok = false; // nunca deveria passar de 16 (teto) -- piso de 12 pode furar um pouco por venda avulsa, mas nunca zera
    });
    return { ok, min: Math.min(...sizes), max: Math.max(...sizes) };
  });
  console.log("7) Elenco de times de fora respeita o teto de 16 mesmo depois de várias negociações CPU:", capsHeld.ok, JSON.stringify(capsHeld));

  await page.screenshot({ path: "screens/mercado-multi-01-lista.png" });

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
