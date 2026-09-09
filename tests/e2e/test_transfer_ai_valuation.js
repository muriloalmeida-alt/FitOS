// Fase 1.3 — Transfer AI: valuation. Testa transferValuation() (pura,
// determinística) diretamente no contexto do app real (via
// page.evaluate) + a integração real com maybeGenerateOffer/
// maybeSpawnListingOffer/maybeSpawnRivalOffer (chamadas de verdade, não
// reimplementadas).
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `transferaival${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Transfer AI Val", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  // ---------- Helpers no contexto da página ----------
  const setup = await page.evaluate(() => {
    CAREER.currentRound = 2; // dentro da janela de transferências
    // Clube comprador "neutro" — necessidade/adequação/financeiro/
    // contexto moderados, pra isolar cada variável nos testes 1-4 sem
    // um viés forte de nenhum outro fator.
    function fabricateNeutralBuyer(candidateOverall) {
      const squad = [];
      for (let i = 0; i < 18; i++) {
        const cf = computeContractFields(candidateOverall, 26, null, () => 0.5);
        squad.push({ id: `neutral_${i}`, group: i % 4 === 0 ? "F" : i % 3 === 0 ? "M" : "D", overall: candidateOverall, wage: cf.wage, value: cf.value, origin: "principal" });
      }
      return squad;
    }
    const anyOtherClubId = Object.keys(CAREER.leagueSquads)[0];
    return { anyOtherClubId, fabricateNeutralBuyerAvailable: typeof fabricateNeutralBuyer === "function" };
  });
  const buyerId = setup.anyOtherClubId;
  console.log("Setup — clube comprador de referência para os testes 1-4/9:", buyerId);

  // ---------- TESTE 1 — Overall ----------
  const t1 = await page.evaluate((buyerId) => {
    function fabricateNeutralBuyer(overall) {
      const squad = [];
      for (let i = 0; i < 18; i++) {
        const cf = computeContractFields(overall, 26, null, () => 0.5);
        squad.push({ group: i % 4 === 0 ? "F" : i % 3 === 0 ? "M" : "D", overall, wage: cf.wage, origin: "principal" });
      }
      return squad;
    }
    function player(overall, extra = {}) {
      const cf = computeContractFields(overall, 26, null, () => 0.5);
      return { id: "p", group: "F", overall, age: 26, potential: null, wage: cf.wage, value: cf.value, contractUntil: CAREER.seasonYear + 2, ...extra };
    }
    const backup = CAREER.leagueSquads[buyerId];
    CAREER.leagueSquads[buyerId] = fabricateNeutralBuyer(75);
    const p70 = player(70), p80 = player(80);
    const v70 = transferValuation(p70, buyerId, "cpu_seller_x");
    const v80 = transferValuation(p80, buyerId, "cpu_seller_x");
    CAREER.leagueSquads[buyerId] = backup;
    return { v70, v80, base70: p70.value, base80: p80.value };
  }, buyerId);
  console.log("1) Jogador melhor (overall 80) vale mais que overall 70, mesmas demais variáveis:", t1.v80 > t1.v70, JSON.stringify(t1));

  // ---------- TESTE 2 — Potencial ----------
  const t2 = await page.evaluate((buyerId) => {
    function fabricateNeutralBuyer(overall) {
      const squad = [];
      for (let i = 0; i < 18; i++) {
        const cf = computeContractFields(overall, 26, null, () => 0.5);
        squad.push({ group: i % 4 === 0 ? "F" : i % 3 === 0 ? "M" : "D", overall, wage: cf.wage, origin: "principal" });
      }
      return squad;
    }
    function player(potential) {
      const cf = computeContractFields(70, 24, potential, () => 0.5);
      return { id: "p", group: "F", overall: 70, age: 24, potential, wage: cf.wage, value: cf.value, contractUntil: CAREER.seasonYear + 2 };
    }
    const backup = CAREER.leagueSquads[buyerId];
    CAREER.leagueSquads[buyerId] = fabricateNeutralBuyer(70);
    const pLow = player(72), pHigh = player(85);
    const vLow = transferValuation(pLow, buyerId, "cpu_seller_x");
    const vHigh = transferValuation(pHigh, buyerId, "cpu_seller_x");
    CAREER.leagueSquads[buyerId] = backup;
    return { vLow, vHigh, baseLow: pLow.value, baseHigh: pHigh.value };
  }, buyerId);
  console.log("2) overall 70/potencial 85 vale mais que overall 70/potencial 72:", t2.vHigh > t2.vLow, JSON.stringify(t2));

  // ---------- TESTE 3 — Idade ----------
  // IMPORTANTE (documentado no relatório da Fase 1.3): a fórmula
  // EXISTENTE de valor (computeContractFields, reaproveitada como valor
  // base — regra fundamental da Fase 1.3, item 2/4) usa ageMult por
  // faixa (<=20:0.8, <=23:1.0, <=27:1.25, <=30:1.0, <=33:0.6, senão
  // 0.35) — ou seja, o PICO de valor já é na faixa de prime (24-27),
  // não aos 18-20 (potencial já é um campo separado, tratado no Teste
  // 2). Este teste confirma que transferValuation PRESERVA essa curva
  // já existente (não inventa uma segunda curva de idade por cima, o
  // que duplicaria o efeito) — exatamente o "comportamento equivalente
  // definido pela curva final" que a própria especificação permite
  // como alternativa ao "20 > 25 > 31" literal.
  const t3 = await page.evaluate((buyerId) => {
    function fabricateNeutralBuyer(overall) {
      const squad = [];
      for (let i = 0; i < 18; i++) {
        const cf = computeContractFields(overall, 26, null, () => 0.5);
        squad.push({ group: i % 4 === 0 ? "F" : i % 3 === 0 ? "M" : "D", overall, wage: cf.wage, origin: "principal" });
      }
      return squad;
    }
    function player(age) {
      const cf = computeContractFields(74, age, null, () => 0.5);
      return { id: "p", group: "F", overall: 74, age, potential: null, wage: cf.wage, value: cf.value, contractUntil: CAREER.seasonYear + 2 };
    }
    const backup = CAREER.leagueSquads[buyerId];
    CAREER.leagueSquads[buyerId] = fabricateNeutralBuyer(74);
    const p20 = player(20), p25 = player(25), p31 = player(31);
    const v20 = transferValuation(p20, buyerId, "cpu_seller_x");
    const v25 = transferValuation(p25, buyerId, "cpu_seller_x");
    const v31 = transferValuation(p31, buyerId, "cpu_seller_x");
    CAREER.leagueSquads[buyerId] = backup;
    return { v20, v25, v31, ageMultOrderMatchesBase: (v25 > v20) === (p25.value > p20.value) && (v20 > v31) === (p20.value > p31.value) };
  }, buyerId);
  console.log("3) transferValuation preserva a ordem da curva de idade JÁ EXISTENTE (25 prime > 20 > 31, ver nota no código):",
    t3.v25 > t3.v20 && t3.v20 > t3.v31 && t3.ageMultOrderMatchesBase, JSON.stringify(t3));

  // ---------- TESTE 4 — Contrato ----------
  const t4 = await page.evaluate((buyerId) => {
    function fabricateNeutralBuyer(overall) {
      const squad = [];
      for (let i = 0; i < 18; i++) {
        const cf = computeContractFields(overall, 26, null, () => 0.5);
        squad.push({ group: i % 4 === 0 ? "F" : i % 3 === 0 ? "M" : "D", overall, wage: cf.wage, origin: "principal" });
      }
      return squad;
    }
    function player(contractUntil) {
      const cf = computeContractFields(74, 26, null, () => 0.5);
      return { id: "p", group: "F", overall: 74, age: 26, potential: null, wage: cf.wage, value: cf.value, contractUntil };
    }
    const backup = CAREER.leagueSquads[buyerId];
    CAREER.leagueSquads[buyerId] = fabricateNeutralBuyer(74);
    const pShort = player(CAREER.seasonYear), pLong = player(CAREER.seasonYear + 4);
    const vShort = transferValuation(pShort, buyerId, "cpu_seller_x");
    const vLong = transferValuation(pLong, buyerId, "cpu_seller_x");
    CAREER.leagueSquads[buyerId] = backup;
    return { vShort, vLong, base: pShort.value };
  }, buyerId);
  console.log("4) Contrato curto (último ano) vale menos que contrato longo (+4 anos), mesmo jogador:", t4.vShort < t4.vLong, JSON.stringify(t4));

  // ---------- TESTE 5 — Necessidade ----------
  const t5 = await page.evaluate(() => {
    function fabricateSquad(n, avgOverall, forwards) {
      const squad = [];
      for (let i = 0; i < n; i++) {
        const cf = computeContractFields(avgOverall, 26, null, () => 0.5);
        squad.push({ group: i < forwards ? "F" : "D", overall: avgOverall, wage: cf.wage, origin: "principal" });
      }
      return squad;
    }
    const cf = computeContractFields(74, 26, null, () => 0.5);
    const p = { id: "p", group: "F", overall: 74, age: 26, potential: null, wage: cf.wage, value: cf.value, contractUntil: CAREER.seasonYear + 2 };
    const backup = JSON.parse(JSON.stringify(CAREER.leagueSquads));
    const carenteId = "fake_carente", servidoId = "fake_servido";
    CAREER.leagueSquads[carenteId] = fabricateSquad(18, 74, 0); // 0 atacantes
    CAREER.leagueSquads[servidoId] = fabricateSquad(18, 74, 8); // bem servido
    const vCarente = transferValuation(p, carenteId, "cpu_seller_x");
    const vServido = transferValuation(p, servidoId, "cpu_seller_x");
    delete CAREER.leagueSquads[carenteId]; delete CAREER.leagueSquads[servidoId];
    CAREER.leagueSquads = backup;
    return { vCarente, vServido, base: p.value, diffPct: Math.round(((vCarente - vServido) / p.value) * 100) };
  });
  // Nota: necessidadeScore entra 2x no resultado final — direto
  // (needFactor, ±5%) E indiretamente via transferScore (35% do peso
  // de interesse, então scoreFactor também se desloca) — por isso o
  // efeito combinado (~15-20%) é maior que qualquer camada isolada,
  // mas ainda moderado e sempre dentro do teto de 70%-150% (Teste 8).
  console.log("5) Clube carente oferece mais que clube bem servido pelo mesmo jogador (diferença moderada):",
    t5.vCarente > t5.vServido && Math.abs(t5.diffPct) <= 20, JSON.stringify(t5));

  // ---------- TESTE 6 — TransferScore (necessidade mantida constante,
  // só adequação/financeiro/contexto variam entre os 2 clubes) ----------
  const t6 = await page.evaluate(() => {
    function fabricateSquad(n, avgOverall, forwards) {
      const squad = [];
      for (let i = 0; i < n; i++) {
        const cf = computeContractFields(avgOverall, 26, null, () => 0.5);
        squad.push({ group: i < forwards ? "F" : "D", overall: avgOverall, wage: cf.wage, origin: "principal" });
      }
      return squad;
    }
    const cf = computeContractFields(74, 26, 80, () => 0.5);
    const p = { id: "p", group: "F", overall: 74, age: 26, potential: 80, wage: cf.wage, value: cf.value, contractUntil: CAREER.seasonYear + 2 };
    const backup = JSON.parse(JSON.stringify(CAREER.leagueSquads));
    // Mesma necessidade (2 de 18 -> mesma contagem/ideal nos 2 clubes),
    // só o overall médio muda (afeta adequação/contexto, não necessidade).
    const goodFitId = "fake_goodfit", badFitId = "fake_badfit";
    CAREER.leagueSquads[goodFitId] = fabricateSquad(18, 68, 2); // upgrade real pro clube
    CAREER.leagueSquads[badFitId] = fabricateSquad(18, 96, 2); // clube muito acima, sem necessidade real de upgrade
    const scoreGood = transferScore(p, goodFitId), scoreBad = transferScore(p, badFitId);
    const vGood = transferValuation(p, goodFitId, "cpu_seller_x");
    const vBad = transferValuation(p, badFitId, "cpu_seller_x");
    delete CAREER.leagueSquads[goodFitId]; delete CAREER.leagueSquads[badFitId];
    CAREER.leagueSquads = backup;
    return { scoreGood, scoreBad, vGood, vBad, base: p.value };
  });
  console.log("6) TransferScore alto (clube com bom fit) resulta em proposta maior que score baixo (mesmo jogador):",
    t6.scoreGood > t6.scoreBad && t6.vGood > t6.vBad, JSON.stringify(t6));

  // ---------- TESTE 7 — Financeiro (necessidade/overall do clube
  // idênticos; só o orçamento inferido muda, via wage bill artificial) ----------
  const t7 = await page.evaluate(() => {
    function fabricateSquad(n, overall, wage) {
      const squad = [];
      for (let i = 0; i < n; i++) squad.push({ group: i < 2 ? "F" : "D", overall, wage, origin: "principal" });
      return squad;
    }
    const cf = computeContractFields(74, 26, null, () => 0.5);
    const p = { id: "p", group: "F", overall: 74, age: 26, potential: null, wage: cf.wage, value: cf.value, contractUntil: CAREER.seasonYear + 2 };
    const backup = JSON.parse(JSON.stringify(CAREER.leagueSquads));
    const richId = "fake_rico", poorId = "fake_pobre";
    // MESMA composição/overall (necessidade e adequação idênticas) —
    // só o salário/orçamento inferido muda.
    CAREER.leagueSquads[richId] = fabricateSquad(18, 74, 500000); // clube com folha alta -> orçamento grande
    CAREER.leagueSquads[poorId] = fabricateSquad(18, 74, cf.wage); // clube com folha modesta, mas ainda elegível
    const finRich = financeiroScore(p, CAREER.leagueSquads[richId], richId);
    const finPoor = financeiroScore(p, CAREER.leagueSquads[poorId], poorId);
    const vRich = transferValuation(p, richId, "cpu_seller_x");
    const vPoor = transferValuation(p, poorId, "cpu_seller_x");
    delete CAREER.leagueSquads[richId]; delete CAREER.leagueSquads[poorId];
    CAREER.leagueSquads = backup;
    return { finRich, finPoor, vRich, vPoor, base: p.value, diffPct: Math.round(((vRich - vPoor) / p.value) * 100) };
  });
  console.log("7) Clube rico paga um pouco mais que clube apertado (mesmo jogador), mas sem desproporção (diferença pequena):",
    t7.vRich >= t7.vPoor && Math.abs(t7.diffPct) <= 10, JSON.stringify(t7));

  // ---------- TESTE 8 — Limites (vários combos extremos) ----------
  const t8 = await page.evaluate(() => {
    function fabricateSquad(n, overall, forwards, wage) {
      const squad = [];
      for (let i = 0; i < n; i++) squad.push({ group: i < forwards ? "F" : "D", overall, wage, origin: "principal" });
      return squad;
    }
    const backup = JSON.parse(JSON.stringify(CAREER.leagueSquads));
    const combos = [
      { overall: 60, age: 33, potential: null, contractUntil: CAREER.seasonYear, buyerOverall: 96, buyerForwards: 10, buyerWage: 10000 }, // pior caso: tudo contra
      { overall: 90, age: 25, potential: 95, contractUntil: CAREER.seasonYear + 4, buyerOverall: 60, buyerForwards: 0, buyerWage: 900000 }, // melhor caso: tudo a favor
      { overall: 74, age: 26, potential: null, contractUntil: CAREER.seasonYear + 2, buyerOverall: 74, buyerForwards: 2, buyerWage: 60000 }, // neutro
    ];
    const results = combos.map((c, i) => {
      const cf = computeContractFields(c.overall, c.age, c.potential, () => 0.5);
      const p = { id: `p${i}`, group: "F", overall: c.overall, age: c.age, potential: c.potential, wage: cf.wage, value: cf.value, contractUntil: c.contractUntil };
      const buyerId = `fake_limits_${i}`;
      CAREER.leagueSquads[buyerId] = fabricateSquad(18, c.buyerOverall, c.buyerForwards, c.buyerWage);
      const v = transferValuation(p, buyerId, "cpu_seller_x", { competitorCount: 5 }); // até concorrência no limite
      delete CAREER.leagueSquads[buyerId];
      return { base: p.value, v, min: Math.round(p.value * 0.70), max: Math.round(p.value * 1.50), withinLimits: v >= Math.round(p.value * 0.70) && v <= Math.round(p.value * 1.50) };
    });
    CAREER.leagueSquads = backup;
    return results;
  });
  const t8Ok = t8.every((r) => r.withinLimits);
  console.log("8) Nenhuma valuation sai de [70%, 150%] do valor base, mesmo em combos extremos:", t8Ok, JSON.stringify(t8));

  // ---------- TESTE 9 — Determinismo ----------
  const t9 = await page.evaluate((buyerId) => {
    const cf = computeContractFields(74, 26, 80, () => 0.5);
    const p = { id: "p", group: "F", overall: 74, age: 26, potential: 80, wage: cf.wage, value: cf.value, contractUntil: CAREER.seasonYear + 2 };
    const v1 = transferValuation(p, buyerId, "cpu_seller_x", { competitorCount: 1 });
    const v2 = transferValuation(p, buyerId, "cpu_seller_x", { competitorCount: 1 });
    const v3 = transferValuation({ ...p }, buyerId, "cpu_seller_x", { competitorCount: 1 });
    return { v1, v2, v3, allEqual: v1 === v2 && v2 === v3 };
  }, buyerId);
  console.log("9) Mesmos inputs produzem sempre o mesmo resultado (determinístico, sem RNG interno):", t9.allEqual, JSON.stringify(t9));

  // ---------- TESTE 10 — Integração real (maybeGenerateOffer) ----------
  // Mercado real (60 times) tem probabilidade baixa por tentativa
  // (OFFER_CHANCE_PER_ROUND=0.18 x offerProbabilityFromScore, que pode
  // ser só 2%-10% pra combinações medianas) — fabrica um cenário
  // favorável (mesmo padrão da Fase 1.2) só pra garantir alguma oferta
  // dentro de um número razoável de tentativas; o que este teste
  // verifica é a INTEGRAÇÃO (fee == transferValuation recalculado),
  // não a frequência (já coberta em test_transfer_ai_offers.js).
  const t10 = await page.evaluate(() => {
    function fabricateSquad(n, avgOverall, forwards) {
      const squad = [];
      for (let i = 0; i < n; i++) {
        const cf = computeContractFields(avgOverall, 26, null, () => 0.5);
        squad.push({ id: `fabg_${i}`, group: i < forwards ? "F" : "D", overall: avgOverall, wage: cf.wage, value: cf.value, origin: "principal" });
      }
      return squad;
    }
    const backupSquad = CAREER.squad.map((p) => ({ ...p }));
    const backupLeague = JSON.parse(JSON.stringify(CAREER.leagueSquads));
    CAREER.squad.filter((p) => p.origin === "principal").forEach((p) => {
      p.group = "F"; p.overall = 74; p.age = 26;
      const cf = computeContractFields(74, 26, 80, () => 0.5);
      p.wage = cf.wage; p.value = cf.value; p.potential = 80;
    });
    Object.keys(CAREER.leagueSquads).forEach((id) => { CAREER.leagueSquads[id] = fabricateSquad(18, 66, 0); });
    let found = null;
    for (let i = 0; i < 300 && !found; i++) {
      CAREER.pendingOffer = null;
      maybeGenerateOffer(CAREER.currentRound);
      if (CAREER.pendingOffer) found = { ...CAREER.pendingOffer };
    }
    let result;
    if (!found) {
      result = { ok: false, reason: "nenhuma oferta gerada em 300 tentativas (cenário favorável)" };
    } else {
      const player = CAREER.squad.find((p) => p.id === found.playerId);
      // Fase 1.4 — maybeGenerateOffer não usa mais transferValuation
      // pura direto: o fee final é o resultado de negotiateOffer
      // (reserva do vendedor vs. tolerância do comprador em cima do
      // valor inicial de transferValuation, ver carreira.js). A
      // checagem de integração vira "recalcular negotiateOffer pro
      // mesmo par bate com o fee gerado", não mais igualdade com
      // transferValuation puro (que continua sendo só o PONTO DE
      // PARTIDA, nunca mais necessariamente o valor final).
      const recomputedDeal = negotiateOffer(player, found.clubId, CAREER.clubId);
      const recomputed = recomputedDeal.outcome === "accepted" ? recomputedDeal.finalValue : null;
      result = { ok: true, fee: found.fee, recomputed, matches: found.fee === recomputed, base: player.value, withinLimits: found.fee >= Math.round(player.value * 0.70) && found.fee <= Math.round(player.value * 1.50) };
    }
    CAREER.pendingOffer = null;
    CAREER.squad = backupSquad;
    CAREER.leagueSquads = backupLeague;
    return result;
  });
  console.log("10) maybeGenerateOffer usa negotiateOffer de verdade (fee gerado == negotiateOffer recalculado pro mesmo par jogador/clube, Fase 1.4):",
    t10.ok && t10.matches && t10.withinLimits, JSON.stringify(t10));

  // ---------- TESTE 10b — Integração real (maybeSpawnListingOffer) ----------
  const t10b = await page.evaluate(() => {
    function fabricateSquad(n, avgOverall, forwards) {
      const squad = [];
      for (let i = 0; i < n; i++) {
        const cf = computeContractFields(avgOverall, 26, null, () => 0.5);
        squad.push({ id: `fabl_${i}`, group: i < forwards ? "F" : "D", overall: avgOverall, wage: cf.wage, value: cf.value, origin: "principal" });
      }
      return squad;
    }
    const backup = JSON.parse(JSON.stringify(CAREER.leagueSquads));
    Object.keys(CAREER.leagueSquads).forEach((id) => { CAREER.leagueSquads[id] = fabricateSquad(18, 66, 0); });
    const p = CAREER.squad.find((x) => x.origin === "principal");
    p.group = "F"; p.overall = 74; p.age = 26;
    const cf = computeContractFields(74, 26, 80, () => 0.5);
    p.wage = cf.wage; p.value = cf.value; p.potential = 80;
    const listing = { playerId: p.id, playerName: p.name, askingValue: p.value, marketValue: p.value, listedRound: CAREER.currentRound, offers: [] };
    let found = null;
    for (let i = 0; i < 80 && !found; i++) {
      listing.offers = [];
      maybeSpawnListingOffer(listing);
      if (listing.offers.length) found = listing.offers[0];
    }
    CAREER.leagueSquads = backup;
    if (!found) return { ok: false, reason: "nenhuma oferta gerada em 80 tentativas" };
    return { ok: true, value: found.value, withinLimits: found.value >= Math.round(listing.askingValue * 0.70) && found.value <= Math.round(listing.askingValue * 1.50) };
  });
  console.log("10b) maybeSpawnListingOffer usa transferValuation de verdade (valor dentro de [70%,150%] do valor pedido):",
    t10b.ok && t10b.withinLimits, JSON.stringify(t10b));

  // ---------- TESTE 10c — Integração real (maybeSpawnRivalOffer) ----------
  const t10c = await page.evaluate(() => {
    function fabricateSquad(n, avgOverall, forwards) {
      const squad = [];
      for (let i = 0; i < n; i++) {
        const cf = computeContractFields(avgOverall, 26, null, () => 0.5);
        squad.push({ id: `fabr_${i}`, group: i < forwards ? "F" : "D", overall: avgOverall, wage: cf.wage, value: cf.value, origin: "principal" });
      }
      return squad;
    }
    const backup = JSON.parse(JSON.stringify(CAREER.leagueSquads));
    const sellerId = Object.keys(CAREER.leagueSquads)[0];
    const cf = computeContractFields(74, 26, 80, () => 0.5);
    const player = { id: "riv_p1", name: "Rival Target", group: "F", overall: 74, age: 26, potential: 80, wage: cf.wage, value: cf.value, contractUntil: CAREER.seasonYear + 2 };
    CAREER.leagueSquads[sellerId] = [player, ...fabricateSquad(17, 60, 0)];
    Object.keys(CAREER.leagueSquads).filter((id) => id !== sellerId).forEach((id) => { CAREER.leagueSquads[id] = fabricateSquad(18, 66, 0); });
    const o = { playerId: player.id, playerName: player.name, clubId: sellerId, marketValue: player.value, offerValue: Math.round(player.value * 0.9), installments: 1, roundsLeft: 2, status: "pending", counterValue: null };
    let found = null;
    for (let i = 0; i < 200 && !found; i++) {
      o.rivalOffer = null;
      maybeSpawnRivalOffer(o);
      if (o.rivalOffer) found = { ...o.rivalOffer };
    }
    let result;
    if (!found) {
      result = { ok: false, reason: "nenhuma oferta rival gerada em 200 tentativas (cenário favorável)" };
    } else {
      // Fase 1.4 — mesmo ajuste do teste 10: recalcula via
      // negotiateOffer (não mais transferValuation puro).
      const recomputedDeal = negotiateOffer(player, found.clubId, sellerId, { baseValue: o.marketValue, competitorCount: 1 });
      const recomputed = recomputedDeal.outcome === "accepted" ? recomputedDeal.finalValue : null;
      result = { ok: true, offerValue: found.offerValue, recomputed, matches: found.offerValue === recomputed, withinLimits: found.offerValue >= Math.round(o.marketValue * 0.70) && found.offerValue <= Math.round(o.marketValue * 1.50) };
    }
    CAREER.leagueSquads = backup;
    return result;
  });
  console.log("10c) maybeSpawnRivalOffer usa negotiateOffer de verdade (offerValue == negotiateOffer recalculado, Fase 1.4):",
    t10c.ok && t10c.matches && t10c.withinLimits, JSON.stringify(t10c));

  await browser.close();
  console.log("OK");
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
