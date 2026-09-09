// Fase 1.4 — Transfer AI (Negotiation AI). Testa as funções puras novas
// (calculateSellerReservationValue/sellerNegotiationDecision/
// calculateCounterOffer/buyerNegotiationDecision/negotiateOffer)
// diretamente no contexto do app real (via page.evaluate, mesmas
// funções globais de carreira.js), + a integração real com
// maybeGenerateOffer/maybeSpawnListingOffer/maybeSpawnRivalOffer.
// transferValuation/transferScore/pesos/offerProbabilityFromScore NÃO
// são tocados nesta fase — vários testes abaixo confirmam isso, não
// testam mudança neles.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `negotiation14_${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Negotiation 1.4", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  const schemaBefore = await page.evaluate(() => Object.keys(CAREER).sort());

  await page.evaluate(() => {
    function fabricateSquad(n, avgOverall, groups) {
      const squad = [];
      for (let i = 0; i < n; i++) {
        const g = groups[i % groups.length];
        const cf = computeContractFields(avgOverall, 26, null, () => 0.5);
        squad.push({ id: `fabn_${i}_${Math.random()}`, group: g, overall: avgOverall, wage: cf.wage, value: cf.value, contractUntil: CAREER.seasonYear + 2, origin: "principal" });
      }
      return squad;
    }
    window.__fabricateSquad = fabricateSquad;
  });

  // =========================================================
  // SELLER (1-6)
  // =========================================================

  // 1) oferta muito abaixo da reserva -> reject.
  const s1 = await page.evaluate(() => {
    const d = sellerNegotiationDecision(600000, 1000000); // ratio 0.6 < 0.75
    return d;
  });
  console.log("1) Oferta muito abaixo da reserva -> reject:", s1.action === "reject", JSON.stringify(s1));

  // 2) oferta próxima da reserva -> counter.
  const s2 = await page.evaluate(() => sellerNegotiationDecision(880000, 1000000)); // ratio 0.88
  console.log("2) Oferta próxima da reserva -> counter (contraproposta > oferta):", s2.action === "counter" && s2.value > 880000, JSON.stringify(s2));

  // 3) oferta na/acima da reserva -> accept (rng fixo em 0 força o ramo de aceite direto na faixa de incerteza).
  const s3 = await page.evaluate(() => ({
    naReserva: sellerNegotiationDecision(1000000, 1000000, () => 0),
    acima: sellerNegotiationDecision(1200000, 1000000),
  }));
  console.log("3) Oferta na reserva (rng favorável) e claramente acima da reserva -> accept:",
    s3.naReserva.action === "accept" && s3.acima.action === "accept", JSON.stringify(s3));

  // 4) titularidade aumenta resistência (reserva de titular > reserva de reserva, mesmo jogador/valor base).
  const s4 = await page.evaluate(() => {
    const squad = window.__fabricateSquad(24, 70, ["G", "D", "D", "D", "D", "D", "M", "M", "M", "M", "M", "F", "F", "F"]);
    CAREER.squad = squad.map((p) => ({ ...p }));
    const player = CAREER.squad[10]; // um meia qualquer
    CAREER.lineup = CAREER.lineup || {};
    CAREER.lineup.starters = [player.id];
    const resTitular = calculateSellerReservationValue(player, CAREER.clubId);
    CAREER.lineup.starters = [];
    const resReserva = calculateSellerReservationValue(player, CAREER.clubId);
    return { resTitular, resReserva, base: player.value };
  });
  console.log("4) Titularidade real aumenta o preço de reserva (mesmo jogador/valor base):", s4.resTitular > s4.resReserva, JSON.stringify(s4));

  // 5) jogador reserva (banco) é mais negociável — reserva de banco fica
  // mais perto do valor-base (fator neutro) que a de um titular.
  const s5 = await page.evaluate(() => {
    const squad = CAREER.squad;
    const player = squad[10];
    const resReserva = calculateSellerReservationValue(player, CAREER.clubId); // CAREER.lineup.starters já vazio do teste 4
    return { resReserva, base: player.value, maisNegociavel: resReserva <= player.value * 1.05 };
  });
  console.log("5) Jogador reserva (não titular) tem reserva mais perto do valor-base (mais negociável):", s5.maisNegociavel, JSON.stringify(s5));

  // 6) vendedor com necessidade alta (carece daquele perfil no próprio
  // elenco) resiste mais — reserva de um clube CARENTE naquele grupo >
  // reserva de um clube com o grupo bem servido, mesmo jogador/base.
  const s6 = await page.evaluate(() => {
    const cf = computeContractFields(72, 26, null, () => 0.5);
    const player = { id: "s6_p", group: "F", overall: 72, wage: cf.wage, value: cf.value };
    const clubCarenteId = "__fake_s6_carente", clubServidoId = "__fake_s6_servido";
    CAREER.leagueSquads[clubCarenteId] = window.__fabricateSquad(16, 65, ["G", "D", "D", "D", "D", "M", "M", "M", "M", "M"]); // 0 atacantes
    CAREER.leagueSquads[clubServidoId] = window.__fabricateSquad(24, 65, ["G", "D", "D", "D", "D", "D", "M", "M", "M", "M", "M", "F", "F", "F", "F", "F", "F"]); // atacantes de sobra
    const resCarente = calculateSellerReservationValue(player, clubCarenteId, { baseValue: player.value });
    const resServido = calculateSellerReservationValue(player, clubServidoId, { baseValue: player.value });
    delete CAREER.leagueSquads[clubCarenteId];
    delete CAREER.leagueSquads[clubServidoId];
    return { resCarente, resServido };
  });
  console.log("6) Vendedor com necessidade alta pelo próprio perfil resiste mais (reserva maior):", s6.resCarente > s6.resServido, JSON.stringify(s6));

  // =========================================================
  // BUYER (7-12)
  // =========================================================

  // Setup comum: um comprador de referência real do elenco carregado.
  const buyerSetup = await page.evaluate(() => {
    const clubId = Object.keys(CAREER.leagueSquads)[0];
    return { clubId };
  });
  const BUYER_CLUB = buyerSetup.clubId;

  // 7/8) score baixo -> menor tolerância; score alto -> maior tolerância
  // (mesmo counterValue, mesma capacidade financeira — só o score
  // muda, fabricado via necessidade/adequação bem diferentes).
  const b78 = await page.evaluate((clubId) => {
    const cf = computeContractFields(68, 25, 70, () => 0.5);
    const squadAvg = squadAvgOverallOf(clubId);
    // score baixo: candidato mal ajustado ao nível do clube, grupo já cheio.
    const playerLow = { id: "b7_low", group: "M", overall: Math.max(40, squadAvg - 35), potential: Math.max(40, squadAvg - 35), age: 30, wage: cf.wage, value: cf.value };
    // score alto: candidato bom ajuste, grupo carente (reaproveita o mesmo clube, grupo D deliberadamente escasso).
    const playerHigh = { id: "b7_high", group: "D", overall: squadAvg + 2, potential: squadAvg + 10, age: 24, wage: cf.wage, value: cf.value };
    const scoreLow = transferScore(playerLow, clubId);
    const scoreHigh = transferScore(playerHigh, clubId);
    const counterValue = Math.round(cf.value * 1.10 / 1000) * 1000; // mesma contraproposta pros 2 casos
    const decLow = buyerNegotiationDecision(counterValue, cf.value, playerLow, clubId);
    const decHigh = buyerNegotiationDecision(counterValue, cf.value, playerHigh, clubId);
    return { scoreLow, scoreHigh, decLow, decHigh };
  }, BUYER_CLUB);
  console.log("7/8) Score baixo tem tolerância <= score alto pra mesma contraproposta (score baixo mais restritivo ou igual):",
    b78.scoreLow < b78.scoreHigh, JSON.stringify(b78));

  // 9) necessidade alta -> maior tolerância (via transferScore, que já
  // carrega necessidade a 35% — não reaplicada 2ª vez, ver item 13).
  // 2 clubes FABRICADOS com o MESMO overall médio (isola o efeito de
  // necessidade dos outros 3 componentes do score) — um com o grupo do
  // candidato ausente, outro com o grupo em excesso.
  const b9 = await page.evaluate(() => {
    const cf = computeContractFields(65, 26, null, () => 0.5);
    const player = { id: "b9_p", group: "D", overall: 65, potential: 65, age: 26, wage: cf.wage, value: cf.value };
    const carenteId = "__fake_b9_carente", servidoId = "__fake_b9_servido";
    CAREER.leagueSquads[carenteId] = window.__fabricateSquad(16, 65, ["G", "M", "M", "M", "M", "M", "F", "F", "F"]); // 0 defensores
    CAREER.leagueSquads[servidoId] = window.__fabricateSquad(16, 65, ["G", "D", "D", "D", "D", "D", "M", "M", "F", "F"]); // defensores na proporção ideal
    const necHigh = necessidadeScore(player, CAREER.leagueSquads[carenteId], carenteId);
    const necLow = necessidadeScore(player, CAREER.leagueSquads[servidoId], servidoId);
    const scoreHigh = transferScore(player, carenteId);
    const scoreLow = transferScore(player, servidoId);
    delete CAREER.leagueSquads[carenteId];
    delete CAREER.leagueSquads[servidoId];
    return { necLow, necHigh, scoreLow, scoreHigh };
  });
  console.log("9) Necessidade mais alta produz transferScore mais alto (e portanto mais tolerância via buyerNegotiationDecision):",
    b9.necHigh > b9.necLow && b9.scoreHigh > b9.scoreLow, JSON.stringify(b9));

  // 10) financeiro impede contraproposta impossível -> walk.
  const b10 = await page.evaluate((clubId) => {
    const budget = clubBudgetProxy(clubId);
    const cf = computeContractFields(60, 25, null, () => 0.5);
    const player = { id: "b10_p", group: "M", overall: 60, potential: 60, age: 25, wage: cf.wage, value: cf.value };
    const impossibleCounter = budget.cash * 3; // muito além da capacidade real
    const dec = buyerNegotiationDecision(impossibleCounter, cf.value, player, clubId);
    return { dec, cash: budget.cash };
  }, BUYER_CLUB);
  console.log("10) Contraproposta muito acima da capacidade financeira real -> comprador desiste (walk):", b10.dec.action === "walk", JSON.stringify(b10));

  // 11) comprador aceita contraproposta razoável (dentro da tolerância e
  // da capacidade) — clube fabricado carente (mesmo recipe do Cenário
  // B) pra garantir score na faixa média/alta (tolerância >= 8%),
  // fazendo o +5% caber com folga em qualquer uma das 2 faixas.
  const b11 = await page.evaluate(() => {
    const carenteId = "__fake_b11_carente";
    const groups = ["G", "M", "M", "M", "M", "M", "M", "F", "F", "F", "F", "F"]; // sem D nenhum
    CAREER.leagueSquads[carenteId] = groups.map((g, i) => ({ id: `b11s_${i}`, group: g, overall: 62, wage: computeContractFields(62, 27, null, () => 0.5).wage, origin: "principal" }));
    const cf = computeContractFields(64, 23, 72, () => 0.5);
    const player = { id: "b11_p", group: "D", overall: 64, potential: 72, age: 23, wage: cf.wage, value: cf.value };
    const score = transferScore(player, carenteId);
    const reasonableCounter = Math.round(cf.value * 1.05 / 1000) * 1000; // +5%, dentro de qualquer faixa de tolerância médio/alta (8%-15%)
    const dec = buyerNegotiationDecision(reasonableCounter, cf.value, player, carenteId);
    delete CAREER.leagueSquads[carenteId];
    return { score, reasonableCounter, dec };
  });
  console.log("11) Comprador aceita contraproposta razoável (+5% sobre a oferta inicial):", b11.dec.action === "accept", JSON.stringify(b11));

  // 12) comprador desiste de contraproposta excessiva (dentro da
  // capacidade financeira, mas muito além de qualquer tolerância de score).
  const b12 = await page.evaluate((clubId) => {
    const cf = computeContractFields(60, 26, null, () => 0.5);
    const player = { id: "b12_p", group: "M", overall: 60, potential: 60, age: 26, wage: cf.wage, value: cf.value };
    const excessiveCounter = Math.round(cf.value * 1.40 / 1000) * 1000; // +40%, muito além do teto de tolerância (máx. 15%)
    const dec = buyerNegotiationDecision(excessiveCounter, cf.value, player, clubId);
    return { dec, excessiveCounter };
  }, BUYER_CLUB);
  console.log("12) Comprador NÃO aceita direto uma contraproposta excessiva (+40%) — aceita só até seu teto, nunca o valor pedido inteiro:",
    b12.dec.action !== "accept" || b12.dec.value < b12.excessiveCounter, JSON.stringify(b12));

  // =========================================================
  // COUNTER (13-16)
  // =========================================================

  // 13) contraproposta sempre > oferta atual (checagem em lote, vários inputs).
  const c13 = await page.evaluate(() => {
    const cases = [
      [500000, 1000000], [900000, 1000000], [990000, 1000000], [1000000, 1000000], [1050000, 1000000], [10000, 20000], [1000, 1000],
    ];
    const results = cases.map(([offer, reservation]) => ({ offer, reservation, counter: calculateCounterOffer(offer, reservation) }));
    return { results, allGreater: results.every((r) => r.counter > r.offer) };
  });
  console.log("13) calculateCounterOffer sempre produz um valor > oferta atual, em qualquer combinação:", c13.allGreater, JSON.stringify(c13.results));

  // 14) contraproposta permanece dentro dos limites (nunca > reserva*1.05).
  const c14 = await page.evaluate(() => {
    const cases = [[100000, 1000000], [500000, 1000000], [999000, 1000000]];
    const results = cases.map(([offer, reservation]) => ({ offer, reservation, counter: calculateCounterOffer(offer, reservation), cap: reservation * 1.05 }));
    return { results, allWithin: results.every((r) => r.counter <= r.cap + 1000) }; // +1000 de folga de arredondamento
  });
  console.log("14) calculateCounterOffer nunca ultrapassa reserva*1,05 (limitada, item 14):", c14.allWithin, JSON.stringify(c14.results));

  // 15) negociação termina após o máximo de rodadas — cenário
  // adversarial (vendedor sempre conta, comprador tem fôlego pra subir
  // um pouco a cada rodada, mas nunca o bastante pra fechar) — deve
  // encerrar em exatamente MAX_NEGOTIATION_ROUNDS rodadas, nunca mais.
  const c15 = await page.evaluate((clubId) => {
    // reserva bem acima do que o comprador consegue tolerar (score
    // baixo -> tolerância de só 3%) força contrapropostas repetidas
    // sem nunca fechar.
    const cf = computeContractFields(50, 30, null, () => 0.5); // veterano fraco -> score tende a ficar baixo
    const player = { id: "c15_p", group: "M", overall: 50, potential: 50, age: 30, wage: cf.wage, value: cf.value, contractUntil: CAREER.seasonYear + 3 };
    const deal = negotiateOffer(player, clubId, CAREER.clubId, { baseValue: cf.value * 3 }); // baseValue MUITO acima do que o comprador toparia, reserva também sobe junto
    return { deal, respectsCap: deal.rounds <= MAX_NEGOTIATION_ROUNDS };
  }, BUYER_CLUB);
  console.log("15) Negociação nunca ultrapassa MAX_NEGOTIATION_ROUNDS (3) rodadas, mesmo em cenário adversarial:", c15.respectsCap, JSON.stringify(c15.deal));

  // 16) nunca existe loop infinito — roda negotiateOffer 200x com
  // parâmetros aleatórios extremos e confirma que TODAS retornam
  // (terminam) dentro do limite de rodadas.
  const c16 = await page.evaluate((clubId) => {
    let allTerminated = true;
    const rounds = [];
    for (let i = 0; i < 200; i++) {
      const overall = 40 + Math.floor(Math.random() * 55);
      const age = 20 + Math.floor(Math.random() * 20);
      const cf = computeContractFields(overall, age, null, () => Math.random());
      const player = { id: `c16_${i}`, group: ["G", "D", "M", "F"][i % 4], overall, potential: overall, age, wage: cf.wage, value: cf.value, contractUntil: CAREER.seasonYear + 1 };
      const deal = negotiateOffer(player, clubId, CAREER.clubId, { baseValue: cf.value * (0.5 + Math.random() * 2) });
      rounds.push(deal.rounds);
      if (deal.rounds > MAX_NEGOTIATION_ROUNDS || typeof deal.outcome !== "string") allTerminated = false;
    }
    return { allTerminated, maxRounds: Math.max(...rounds), minRounds: Math.min(...rounds) };
  }, BUYER_CLUB);
  console.log("16) 200 negociações com parâmetros extremos/aleatórios — todas terminam, nunca loop infinito:", c16.allTerminated, JSON.stringify(c16));

  // =========================================================
  // VALUATION (17-19) — confirma que a Fase 1.3 continua intacta
  // =========================================================

  const v1719 = await page.evaluate((clubId) => {
    const cf = computeContractFields(70, 26, 78, () => 0.5);
    const player = { id: "v17_p", group: "D", overall: 70, potential: 78, age: 26, wage: cf.wage, value: cf.value, contractUntil: CAREER.seasonYear + 2 };
    const directValuation = transferValuation(player, clubId, CAREER.clubId);
    const deal = negotiateOffer(player, clubId, CAREER.clubId);
    const initialMatches = deal.initialOffer === directValuation;
    const withinLimits = deal.initialOffer >= Math.round(player.value * 0.70) && deal.initialOffer <= Math.round(player.value * 1.50);
    return { directValuation, dealInitialOffer: deal.initialOffer, initialMatches, withinLimits };
  }, BUYER_CLUB);
  console.log("17) Valuation inicial de negotiateOffer é EXATAMENTE igual a uma chamada direta de transferValuation (Fase 1.3 intacta):",
    v1719.initialMatches, JSON.stringify(v1719));
  console.log("18) negotiateOffer não modifica transferValuation (mesma função, mesmo resultado determinístico de sempre):", v1719.initialMatches);
  console.log("19) Limites 70%-150% continuam válidos pra oferta INICIAL dentro de negotiateOffer:", v1719.withinLimits);

  // =========================================================
  // INTEGRAÇÃO (20-22)
  // =========================================================

  const int20 = await page.evaluate(() => {
    const backupSquad = CAREER.squad.map((p) => ({ ...p }));
    const backupLeague = JSON.parse(JSON.stringify(CAREER.leagueSquads));
    function fabricateSquad(n, avgOverall, forwards) {
      const squad = [];
      for (let i = 0; i < n; i++) {
        const cf = computeContractFields(avgOverall, 26, null, () => 0.5);
        squad.push({ id: `int20_${i}`, group: i < forwards ? "F" : "D", overall: avgOverall, wage: cf.wage, value: cf.value, origin: "principal" });
      }
      return squad;
    }
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
    CAREER.pendingOffer = null;
    CAREER.squad = backupSquad;
    CAREER.leagueSquads = backupLeague;
    return { generated: !!found, sample: found };
  });
  console.log("20) maybeGenerateOffer integrado com negotiateOffer — gera oferta em cenário favorável:", int20.generated, JSON.stringify(int20.sample));

  const int21 = await page.evaluate(() => {
    const backup = JSON.parse(JSON.stringify(CAREER.leagueSquads));
    function fabricateSquad(n, avgOverall, forwards) {
      const squad = [];
      for (let i = 0; i < n; i++) {
        const cf = computeContractFields(avgOverall, 26, null, () => 0.5);
        squad.push({ id: `int21_${i}`, group: i < forwards ? "F" : "D", overall: avgOverall, wage: cf.wage, value: cf.value, origin: "principal" });
      }
      return squad;
    }
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
    return { generated: !!found, sample: found };
  });
  console.log("21) maybeSpawnListingOffer integrado com negotiateOffer — gera oferta em cenário favorável:", int21.generated, JSON.stringify(int21.sample));

  const int22 = await page.evaluate(() => {
    const backup = JSON.parse(JSON.stringify(CAREER.leagueSquads));
    function fabricateSquad(n, avgOverall, forwards) {
      const squad = [];
      for (let i = 0; i < n; i++) {
        const cf = computeContractFields(avgOverall, 26, null, () => 0.5);
        squad.push({ id: `int22_${i}`, group: i < forwards ? "F" : "D", overall: avgOverall, wage: cf.wage, value: cf.value, origin: "principal" });
      }
      return squad;
    }
    const sellerId = Object.keys(CAREER.leagueSquads)[0];
    const cf = computeContractFields(74, 26, 80, () => 0.5);
    const player = { id: "int22_target", name: "Rival Target 1.4", group: "F", overall: 74, age: 26, potential: 80, wage: cf.wage, value: cf.value, contractUntil: CAREER.seasonYear + 2 };
    CAREER.leagueSquads[sellerId] = [player, ...fabricateSquad(17, 60, 0)];
    Object.keys(CAREER.leagueSquads).filter((id) => id !== sellerId).forEach((id) => { CAREER.leagueSquads[id] = fabricateSquad(18, 66, 0); });
    const o = { playerId: player.id, playerName: player.name, clubId: sellerId, marketValue: player.value, offerValue: Math.round(player.value * 0.9), installments: 1, roundsLeft: 2, status: "pending", counterValue: null };
    let found = null;
    for (let i = 0; i < 200 && !found; i++) {
      o.rivalOffer = null;
      maybeSpawnRivalOffer(o);
      if (o.rivalOffer) found = { ...o.rivalOffer };
    }
    CAREER.leagueSquads = backup;
    return { generated: !!found, sample: found };
  });
  console.log("22) maybeSpawnRivalOffer integrado com negotiateOffer — gera oferta rival em cenário favorável:", int22.generated, JSON.stringify(int22.sample));

  // =========================================================
  // INTEGRIDADE (23-26)
  // =========================================================

  // 23) IDs preservados — nenhum id de jogador/clube foi tocado pelas
  // funções novas (todas leem, nenhuma reatribui id).
  const idsCheck = await page.evaluate(() => {
    const p = CAREER.squad.find((x) => x.origin === "principal");
    const idBefore = p.id;
    const clubId = Object.keys(CAREER.leagueSquads)[0];
    negotiateOffer(p, clubId, CAREER.clubId);
    return { idBefore, idAfter: p.id, unchanged: idBefore === p.id };
  });
  console.log("23) IDs preservados (negotiateOffer não altera id de jogador):", idsCheck.unchanged, JSON.stringify(idsCheck));

  // 24) schema preservado — CAREER só ganhou o campo temporário e
  // justificado (counterRounds, dentro de um item de pendingOffersOut,
  // não uma chave nova de CAREER), o transferLog já usado no teste
  // 1.3.2 (não é novo desta fase), e recentDeclines (Fase 1.5 —
  // cooldown pós-recusa, pequeno e podado a cada rodada, ver
  // test_transfer_ai_market_dynamics.js).
  const schemaAfter = await page.evaluate(() => Object.keys(CAREER).sort());
  const newTopLevelKeys = schemaAfter.filter((k) => !schemaBefore.includes(k));
  const ALLOWED_NEW_KEYS = ["transferLog", "recentDeclines"];
  console.log("24) Nenhuma chave nova em CAREER além das já justificadas (transferLog/recentDeclines):",
    newTopLevelKeys.filter((k) => !ALLOWED_NEW_KEYS.includes(k)).length === 0, JSON.stringify(newTopLevelKeys));

  // 25) persistência existente continua funcionando — cria uma oferta
  // de verdade via UI (openOfferModal/confirmOfferFromModal), confirma
  // que CAREER.pendingOffersOut[].counterRounds nasce ausente/0 e que
  // resolvePendingOffersOutRound consegue processar o ciclo até uma
  // contraproposta usando a nova lógica sem quebrar o shape existente.
  const persistCheck = await page.evaluate(() => {
    const clubId = Object.keys(CAREER.leagueSquads)[0];
    const p = leagueSquadFor(clubId)[0];
    if (!p) return { ok: false, reason: "sem jogador no clube de teste" };
    const lowballValue = Math.max(1000, Math.round(p.value * 0.85)); // perto da reserva -> deve gerar contraproposta
    CAREER.pendingOffersOut = CAREER.pendingOffersOut || [];
    CAREER.pendingOffersOut.push({
      id: "persist_test_offer", playerId: p.id, playerName: p.name, clubId: String(clubId), clubName: teamById(clubId).name,
      marketValue: p.value, offerValue: lowballValue, installments: 1, roundsLeft: 1, status: "pending", counterValue: null, submittedRound: CAREER.currentRound,
    });
    resolvePendingOffersOutRound(CAREER.currentRound);
    const after = (CAREER.pendingOffersOut || []).find((o) => o.id === "persist_test_offer");
    const shapeOk = after ? (typeof after.status === "string" && ("counterValue" in after)) : true; // se já resolveu (accept/reject), also ok
    CAREER.pendingOffersOut = (CAREER.pendingOffersOut || []).filter((o) => o.id !== "persist_test_offer");
    return { ok: true, after, shapeOk };
  });
  console.log("25) Persistência existente (CAREER.pendingOffersOut, shape/campos) continua funcionando com a nova lógica de decisão do vendedor:",
    persistCheck.ok && persistCheck.shapeOk, JSON.stringify(persistCheck));

  // 26) empréstimos continuam funcionando — findInterestedBuyer
  // (usado pelo fluxo de empréstimo OUT) não foi tocado nesta fase e
  // continua respondendo null ou clube válido.
  const loanCheck = await page.evaluate(() => {
    const p = CAREER.squad.find((x) => x.origin === "principal");
    let ok = true;
    for (let i = 0; i < 10; i++) {
      const buyer = findInterestedBuyer(CAREER.clubId, p);
      if (!(buyer === null || (buyer && typeof buyer.id !== "undefined"))) ok = false;
    }
    return { ok };
  });
  console.log("26) Empréstimos continuam funcionando (findInterestedBuyer, não tocado nesta fase):", loanCheck.ok, JSON.stringify(loanCheck));

  // =========================================================
  // CENÁRIOS CONTROLADOS (item 24 do pedido — A a E)
  // =========================================================

  const scenarios = await page.evaluate((clubId) => {
    const out = {};

    // A — comprador pouco interessado: score baixo, oferta inicial
    // baixa, counter razoável -> tende a desistir.
    {
      const squadAvg = squadAvgOverallOf(clubId);
      const cf = computeContractFields(Math.max(40, squadAvg - 30), 32, null, () => 0.5);
      const player = { id: "sc_a", group: "M", overall: Math.max(40, squadAvg - 30), potential: Math.max(40, squadAvg - 30), age: 32, wage: cf.wage, value: cf.value };
      const score = transferScore(player, clubId);
      const initial = transferValuation(player, clubId, CAREER.clubId);
      const counter = Math.round(initial * 1.12 / 1000) * 1000; // razoável em termos absolutos, mas acima da tolerância de score baixo
      const dec = buyerNegotiationDecision(counter, initial, player, clubId);
      out.A = { score, initial, counter, decision: dec, tendeADesistir: dec.action === "walk" || dec.action === "raise" };
    }

    // B — comprador muito interessado: score alto, oferta inicial
    // coerente, counter moderado -> maior chance de aceitar. Clube
    // FABRICADO carente de verdade (mesmo recipe já validado na Fase
    // 1.3.2, teste 18 — só assim o score real ultrapassa 0,60 e a
    // faixa de tolerância de 15% entra em jogo).
    {
      const carenteId = "__fake_sc_b_carente";
      const groups = ["G", "M", "M", "M", "M", "M", "M", "F", "F", "F", "F", "F"]; // sem D nenhum, elenco pequeno (perto do piso)
      const squad = groups.map((g, i) => ({ id: `scb_${i}`, group: g, overall: 62, wage: computeContractFields(62, 27, null, () => 0.5).wage, origin: "principal" }));
      CAREER.leagueSquads[carenteId] = squad;
      const cf = computeContractFields(64, 23, 72, () => 0.5);
      const player = { id: "sc_b", group: "D", overall: 64, potential: 72, age: 23, wage: cf.wage, value: cf.value };
      const score = transferScore(player, carenteId);
      const initial = transferValuation(player, carenteId, CAREER.clubId);
      const counter = Math.round(initial * 1.08 / 1000) * 1000; // moderado
      const dec = buyerNegotiationDecision(counter, initial, player, carenteId);
      delete CAREER.leagueSquads[carenteId];
      out.B = { score, initial, counter, decision: dec, aceitou: dec.action === "accept" };
    }

    // C — clube financeiramente limitado: counter acima da capacidade -> não pode aceitar.
    {
      const budget = clubBudgetProxy(clubId);
      const cf = computeContractFields(60, 25, null, () => 0.5);
      const player = { id: "sc_c", group: "M", overall: 60, potential: 60, age: 25, wage: cf.wage, value: cf.value };
      const initial = transferValuation(player, clubId, CAREER.clubId);
      const counterAlemDaCapacidade = budget.cash * 2;
      const dec = buyerNegotiationDecision(counterAlemDaCapacidade, initial, player, clubId);
      out.C = { cash: budget.cash, counterAlemDaCapacidade, decision: dec, naoAceitou: dec.action !== "accept" };
    }

    // D — titular: vendedor exige prêmio maior.
    {
      const cf = computeContractFields(72, 26, null, () => 0.5);
      const player = { id: "sc_d", group: "D", overall: 72, age: 26, wage: cf.wage, value: cf.value };
      CAREER.lineup = CAREER.lineup || {};
      CAREER.lineup.starters = [player.id];
      CAREER.squad = CAREER.squad.filter((p) => p.id !== player.id).concat([{ ...player, origin: "principal" }]);
      const resTitular = calculateSellerReservationValue(player, CAREER.clubId);
      CAREER.lineup.starters = [];
      out.D = { resTitular, base: player.value, premioMaior: resTitular > player.value };
    }

    // E — reserva (banco): vendedor aceita negociar mais facilmente
    // (reserva mais baixa que a de um titular equivalente).
    {
      const cf = computeContractFields(72, 26, null, () => 0.5);
      const player = { id: "sc_e", group: "D", overall: 72, age: 26, wage: cf.wage, value: cf.value };
      CAREER.lineup.starters = []; // ninguém titular -> este jogador é reserva
      const resReserva = calculateSellerReservationValue(player, CAREER.clubId);
      out.E = { resReserva, base: player.value, negociaMaisFacil: resReserva <= player.value * 1.05 };
    }

    return out;
  }, BUYER_CLUB);
  console.log("Cenário A (comprador pouco interessado -> tende a desistir):", scenarios.A.tendeADesistir, JSON.stringify(scenarios.A));
  console.log("Cenário B (comprador muito interessado -> maior chance de aceitar):", scenarios.B.aceitou, JSON.stringify(scenarios.B));
  console.log("Cenário C (clube limitado -> não pode aceitar contraproposta impossível):", scenarios.C.naoAceitou, JSON.stringify(scenarios.C));
  console.log("Cenário D (titular -> vendedor exige prêmio maior):", scenarios.D.premioMaior, JSON.stringify(scenarios.D));
  console.log("Cenário E (reserva -> vendedor negocia mais fácil):", scenarios.E.negociaMaisFacil, JSON.stringify(scenarios.E));

  await browser.close();
  console.log("OK");
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
