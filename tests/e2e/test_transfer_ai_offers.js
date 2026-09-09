// Fase 1.2 — Transfer AI: geração inteligente de ofertas. Testa
// maybeGenerateOffer/maybeSpawnListingOffer/maybeSpawnRivalOffer
// (chamadas de verdade, não reimplementadas) + offerProbabilityFromScore,
// no contexto do app real (via page.evaluate).
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `transferaioffers${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Transfer AI Offers", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
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
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);

  // ---------- Preparação: garante janela de transferências aberta
  // (rodadas 1-3) e ao menos 20 jogadores principais — o que a
  // carreira nova já traz.
  await page.evaluate(() => {
    CAREER.currentRound = 2; // dentro da janela (transferWindowStatus)
  });

  // ---------- offerProbabilityFromScore — sanidade da tabela exata
  const probTable = await page.evaluate(() => {
    return [0.1, 0.25, 0.3, 0.4, 0.5, 0.55, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.99].map((s) => ({ score: s, p: offerProbabilityFromScore(s) }));
  });
  const probOk = probTable.every(({ score, p }) => {
    if (score < 0.25) return p === 0.02;
    if (score < 0.40) return p === 0.05;
    if (score < 0.55) return p === 0.10;
    if (score < 0.70) return p === 0.18;
    if (score < 0.80) return p === 0.28;
    if (score < 0.90) return p === 0.40;
    return p === 0.55;
  });
  console.log("0) offerProbabilityFromScore bate com a tabela exata da especificação:", probOk, JSON.stringify(probTable));

  // ---------- TESTE 1 — Restrição financeira: jogador absurdamente
  // caro (overall 99) -> NENHUM clube do mercado consegue pagar ->
  // maybeGenerateOffer nunca deve gerar oferta, de forma determinística
  // (o filtro financeiro elimina todo mundo ANTES do RNG de probabilidade).
  const teste1 = await page.evaluate(() => {
    const backup = CAREER.squad.map((p) => ({ id: p.id, overall: p.overall, wage: p.wage, value: p.value, potential: p.potential }));
    CAREER.squad.filter((p) => p.origin === "principal").forEach((p) => {
      p.overall = 99;
      const cf = computeContractFields(99, 27, null, () => 0.5);
      p.wage = cf.wage; p.value = cf.value;
    });
    let offers = 0;
    for (let i = 0; i < 60; i++) {
      CAREER.pendingOffer = null;
      maybeGenerateOffer(CAREER.currentRound);
      if (CAREER.pendingOffer) offers++;
    }
    // restaura
    CAREER.squad.forEach((p) => {
      const b = backup.find((x) => x.id === p.id);
      if (b) { p.overall = b.overall; p.wage = b.wage; p.value = b.value; p.potential = b.potential; }
    });
    CAREER.pendingOffer = null;
    return { offers };
  });
  console.log("1) Restrição financeira — jogador overall 99, ninguém pode pagar -> 0 ofertas em 60 tentativas:", teste1.offers === 0, JSON.stringify(teste1));

  // ---------- TESTE 2/3/4/5 combinados (estatístico) — clube carente
  // e compatível (score alto, ~0.92 esperado) vs. clube bem servido e
  // incompatível (score baixo, ~0.25 esperado), fabricando UNIFORMEMENTE
  // todos os outros clubes do mercado (mesma característica pra
  // qualquer um que for sorteado como comprador) e todo o elenco
  // principal do usuário (mesmo grupo/overall, pra isolar a variável).
  const N_TRIALS = 200;
  const statResult = await page.evaluate((N) => {
    function fabricateSquad(n, avgOverall, forwards) {
      const squad = [];
      for (let i = 0; i < n; i++) {
        const cf = computeContractFields(avgOverall, 26, null, () => 0.5);
        squad.push({ id: `fab_${i}`, group: i < forwards ? "F" : "D", overall: avgOverall, wage: cf.wage, value: cf.value, origin: "principal" });
      }
      return squad;
    }
    function setAllOtherClubs(squad) {
      Object.keys(CAREER.leagueSquads).forEach((id) => { CAREER.leagueSquads[id] = squad.slice(); });
    }
    function setMySquadUniform(overall) {
      CAREER.squad.filter((p) => p.origin === "principal").forEach((p) => {
        p.group = "F";
        p.overall = overall;
        p.age = 26; // fixo — remove a variação de ageFit como fonte de ruído no experimento
        const cf = computeContractFields(overall, 26, 80, () => 0.5);
        p.wage = cf.wage; p.value = cf.value; p.potential = 80;
      });
    }
    function runTrials(n) {
      let offers = 0;
      for (let i = 0; i < n; i++) {
        CAREER.pendingOffer = null;
        maybeGenerateOffer(CAREER.currentRound);
        if (CAREER.pendingOffer) offers++;
      }
      return offers;
    }

    const backupSquad = CAREER.squad.map((p) => ({ ...p }));
    const backupLeague = JSON.parse(JSON.stringify(CAREER.leagueSquads));

    // média do score contra TODOS os clubes do mercado (não só o
    // primeiro) — mais representativo, já que maybeGenerateOffer
    // pondera entre vários candidatos, alguns own-division (contexto
    // vem da posição na tabela) e outros de fora (contexto vem da
    // força relativa) — a média captura essa mistura real.
    function avgScoreAcrossMarket(player) {
      const ids = Object.keys(CAREER.leagueSquads);
      const scores = ids.map((id) => transferScore(player, id));
      return scores.reduce((s, v) => s + v, 0) / scores.length;
    }

    // Cenário CARENTE: 0 atacantes, overall do clube 8 pontos ABAIXO do
    // candidato (upgrade real) — necessidade=1, adequação alta, mesmo
    // orçamento confortável.
    setMySquadUniform(74);
    setAllOtherClubs(fabricateSquad(18, 66, 0));
    const scoreNeedy = avgScoreAcrossMarket(CAREER.squad.find((p) => p.origin === "principal"));
    const offersNeedy = runTrials(N);

    // Cenário BEM SERVIDO + incompatível: grupo já saturado (mais
    // atacantes que o ideal) e overall do clube 20 pontos ACIMA do
    // candidato (não precisa, não é upgrade) — necessidade=0, adequação
    // baixa.
    setAllOtherClubs(fabricateSquad(18, 94, 6));
    const scoreServed = avgScoreAcrossMarket(CAREER.squad.find((p) => p.origin === "principal"));
    const offersServed = runTrials(N);

    // restaura
    CAREER.squad = backupSquad;
    CAREER.leagueSquads = backupLeague;
    CAREER.pendingOffer = null;

    return { scoreNeedy, offersNeedy, scoreServed, offersServed };
  }, N_TRIALS);
  // Item 12 da especificação: não exigir valores estatísticos exatos
  // (o RNG é real, não mockado) — o que importa é demonstrar a
  // TENDÊNCIA: score claramente maior e MUITO mais ofertas geradas.
  const trendOk = statResult.scoreNeedy > statResult.scoreServed + 0.3 && statResult.offersNeedy > statResult.offersServed * 2;
  console.log(`2/3/4/5) Clube carente+compatível (score médio ${statResult.scoreNeedy.toFixed(2)}) gera MUITO mais ofertas (${statResult.offersNeedy}/${N_TRIALS}) que clube bem servido+incompatível (score médio ${statResult.scoreServed.toFixed(2)}, ${statResult.offersServed}/${N_TRIALS}):`, trendOk, JSON.stringify(statResult));

  // ---------- TESTE 6 — Jogador listado pode receber oferta de clubes
  // elegíveis (maybeSpawnListingOffer, cenário favorável: mercado
  // uniformemente carente/compatível, mesmo perfil do cenário "needy"
  // acima).
  const teste6 = await page.evaluate(() => {
    function fabricateSquad(n, avgOverall, forwards) {
      const squad = [];
      for (let i = 0; i < n; i++) {
        const cf = computeContractFields(avgOverall, 26, null, () => 0.5);
        squad.push({ id: `fab6_${i}`, group: i < forwards ? "F" : "D", overall: avgOverall, wage: cf.wage, value: cf.value, origin: "principal" });
      }
      return squad;
    }
    const backupLeague = JSON.parse(JSON.stringify(CAREER.leagueSquads));
    Object.keys(CAREER.leagueSquads).forEach((id) => { CAREER.leagueSquads[id] = fabricateSquad(18, 66, 0); });
    const p = CAREER.squad.find((x) => x.origin === "principal");
    p.group = "F"; p.overall = 74;
    const cf = computeContractFields(74, 26, 80, () => 0.5);
    p.wage = cf.wage; p.value = cf.value; p.potential = 80;
    const listing = { playerId: p.id, playerName: p.name, askingValue: p.value, marketValue: p.value, listedRound: CAREER.currentRound, offers: [] };
    let gotOffer = false;
    for (let i = 0; i < 60 && !gotOffer; i++) {
      listing.offers = [];
      maybeSpawnListingOffer(listing);
      if (listing.offers.length > 0) gotOffer = true;
    }
    CAREER.leagueSquads = backupLeague;
    return { gotOffer, sampleOffer: listing.offers[0] || null };
  });
  console.log("6) Jogador listado recebe oferta de clube elegível (cenário favorável, até 60 tentativas):", teste6.gotOffer, JSON.stringify(teste6));

  // ---------- TESTE 7 — Integridade: nenhum elenco ultrapassa limites,
  // nenhuma corrupção de estado depois de uma simulação prolongada
  // combinando as 3 funções + simulateAiTransfers.
  const teste7 = await page.evaluate(() => {
    for (let i = 0; i < 30; i++) {
      simulateAiTransfers(CAREER.currentRound);
      CAREER.pendingOffer = null;
      maybeGenerateOffer(CAREER.currentRound);
    }
    const bad = [];
    Object.keys(CAREER.leagueSquads || {}).forEach((id) => {
      const n = CAREER.leagueSquads[id].length;
      const max = maxSquadSizeFor(id), min = minSquadSizeFor(id);
      if (n > max || n < min - 4) bad.push({ id, n, max, min });
    });
    const principalCount = CAREER.squad.filter((p) => p.origin === "principal").length;
    return { bad, principalCount, pendingOfferShape: CAREER.pendingOffer ? Object.keys(CAREER.pendingOffer).sort() : null };
  });
  const shapeOk = !teste7.pendingOfferShape || JSON.stringify(teste7.pendingOfferShape) === JSON.stringify(["clubId", "clubName", "fee", "playerId", "playerName", "round"].sort());
  console.log("7) Integridade — nenhum elenco fora dos limites, formato da oferta preservado, elenco principal intacto:",
    teste7.bad.length === 0 && teste7.principalCount >= 15 && shapeOk, JSON.stringify(teste7));

  await browser.close();
  console.log("OK");
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
