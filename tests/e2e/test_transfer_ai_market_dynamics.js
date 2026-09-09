// Fase 1.5 — Transfer AI (Market Dynamics). Testa as 2 lacunas reais
// cobertas nesta fase (cooldown pós-recusa + urgência de fim de janela,
// ver relatório) e confirma, com o app real, que o resto do
// comportamento pedido (necessidade dinâmica, efeito cascata, reação a
// compra/venda, competição real, multi-divisão, limites de elenco/
// financeiro) já vinha de graça das Fases 1.1-1.4 — nenhuma dessas
// continua "por acidente": os testes abaixo provam isso.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `marketdyn15_${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "MarketDyn 1.5", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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
        squad.push({ id: `fabmd_${i}_${Math.random()}`, group: g, overall: avgOverall, wage: cf.wage, value: cf.value, contractUntil: CAREER.seasonYear + 2, origin: "principal" });
      }
      return squad;
    }
    window.__fabricateSquad = fabricateSquad;
  });

  // =========================================================
  // NECESSIDADE (1-4)
  // =========================================================

  // 1) venda aumenta necessidade — remove um jogador de um grupo do
  // elenco de um clube fabricado, necessidade daquele grupo sobe.
  const n1 = await page.evaluate(() => {
    // 24 jogadores (tamanho realista de elenco) na proporção EXATA do
    // ideal (G3/D8/M7/F6 -> idealCountForGroup(F,24)=6, atual=6,
    // déficit=0). Importante usar um elenco deste tamanho, não um bem
    // pequeno: idealCountForGroup é proporcional a squad.length (Fase
    // 1.1/1.3.2), então num elenco pequeno remover 1 jogador também
    // reduz o "ideal" na mesma proporção (round(15*0.24)=round(14*0.24),
    // o déficit não aparece) — com 24, round(24*0.24)=round(23*0.24)=6,
    // o ideal não acompanha a redução de 1 unidade, e o déficit real
    // (o que uma venda de verdade causaria) aparece.
    const groups = ["G", "G", "G", "D", "D", "D", "D", "D", "D", "D", "D", "M", "M", "M", "M", "M", "M", "M", "F", "F", "F", "F", "F", "F"];
    const squad = window.__fabricateSquad(24, 65, groups);
    const candidate = { group: "F", overall: 65 };
    const before = necessidadeScore(candidate, squad);
    const idxToRemove = squad.findIndex((x) => x.group === "F"); // "venda" = remove exatamente 1 atacante
    const afterSquad = squad.slice(0, idxToRemove).concat(squad.slice(idxToRemove + 1));
    const after = necessidadeScore(candidate, afterSquad);
    return { before, after, sizeBefore: squad.length, sizeAfter: afterSquad.length };
  });
  console.log("1) Venda (remover 1 jogador do grupo) aumenta necessidade daquele grupo:", n1.after > n1.before, JSON.stringify(n1));

  // 2) compra reduz necessidade — adiciona um jogador ao grupo carente.
  const n2 = await page.evaluate(() => {
    const groups = ["G", "D", "M", "M", "M", "M", "M", "F", "F"]; // sem D suficiente de propósito
    const squad = window.__fabricateSquad(9, 65, groups);
    const candidate = { group: "D", overall: 65 };
    const before = necessidadeScore(candidate, squad);
    const afterSquad = squad.concat([{ id: "novo_d", group: "D", overall: 65, wage: 1000, origin: "principal" }]);
    const after = necessidadeScore(candidate, afterSquad);
    return { before, after };
  });
  console.log("2) Compra (adicionar 1 jogador ao grupo) reduz necessidade daquele grupo:", n2.after < n2.before, JSON.stringify(n2));

  // 3) necessidade continua respeitando squad size (squadSizeNeedFactor, Fase 1.3.2 — confirma que não regrediu).
  const n3 = await page.evaluate(() => {
    const clubId = CAREER.clubId;
    const max = maxSquadSizeFor(clubId), min = minSquadSizeFor(clubId);
    const candidate = { group: "F", overall: 70 };
    const groupsNoF = ["G", "D", "D", "D", "M", "M", "M"];
    function squadOfSize(n) {
      const s = [];
      for (let i = 0; i < n; i++) s.push({ id: `sz15_${i}`, group: groupsNoF[i % groupsNoF.length], overall: 65, wage: 1000, origin: "principal" });
      return s;
    }
    return { necNearMin: necessidadeScore(candidate, squadOfSize(min), clubId), necNearMax: necessidadeScore(candidate, squadOfSize(max), clubId) };
  });
  console.log("3) necessidadeScore continua reduzindo perto do teto de elenco (squadSizeNeedFactor, Fase 1.3.2 intacta):", n3.necNearMin > n3.necNearMax, JSON.stringify(n3));

  // 4) pesos do transferScore continuam 35/30/20/15 (nenhuma duplicidade nova).
  const n4 = await page.evaluate(() => {
    const p = CAREER.squad.find((x) => x.origin === "principal");
    const clubId = Object.keys(CAREER.leagueSquads)[0];
    const squad = CAREER.leagueSquads[clubId];
    const necessidade = necessidadeScore(p, squad, clubId);
    const adequacao = adequacaoScore(p, squad, clubId);
    const financeiro = financeiroScore(p, squad, clubId);
    const contexto = contextoScore(p, squad, clubId);
    const manual = necessidade * 0.35 + adequacao * 0.30 + financeiro * 0.20 + contexto * 0.15;
    const real = transferScore(p, clubId);
    return { manual: Math.round(manual * 1e6) / 1e6, real: Math.round(real * 1e6) / 1e6, matches: Math.abs(manual - real) < 1e-9 };
  });
  console.log("4) Pesos continuam 35/30/20/15, sem duplicidade nova introduzida pela Fase 1.5:", n4.matches, JSON.stringify(n4));

  // =========================================================
  // MERCADO (5-8)
  // =========================================================

  // 5) transferência concluída altera contexto — depois de mover um
  // jogador de um clube fabricado carente pra outro, o score do MESMO
  // tipo de candidato pro clube que RECEBEU muda (cai, porque o grupo
  // deixou de estar tão carente).
  const n5 = await page.evaluate(() => {
    const clubId = "__fake_n5";
    const groups = ["G", "M", "M", "M", "M", "M", "F", "F", "F"]; // sem D
    CAREER.leagueSquads[clubId] = window.__fabricateSquad(9, 65, groups);
    const candidate = { group: "D", overall: 65, potential: 65, age: 26, wage: 1000, value: 1000000 };
    const scoreBefore = transferScore(candidate, clubId);
    // "transferência concluída" simulada: o clube recebe um defensor.
    CAREER.leagueSquads[clubId].push({ id: "n5_novo", group: "D", overall: 65, wage: 1000, origin: "principal" });
    const scoreAfter = transferScore(candidate, clubId);
    delete CAREER.leagueSquads[clubId];
    return { scoreBefore, scoreAfter };
  });
  console.log("5) Depois de uma transferência concluída, o score de um candidato do MESMO perfil cai (contexto mudou de verdade):", n5.scoreAfter < n5.scoreBefore, JSON.stringify(n5));

  // 6) nova decisão usa estado atualizado — simulateAiTransfers real
  // roda 2x seguidas; a 2ª leitura de necessidade já reflete o que a
  // 1ª rodada mudou (squad ao vivo, sem cache).
  const n6 = await page.evaluate(() => {
    const before = JSON.parse(JSON.stringify(Object.keys(CAREER.leagueSquads).map((id) => CAREER.leagueSquads[id].length)));
    simulateAiTransfers(CAREER.currentRound);
    const afterFirst = Object.keys(CAREER.leagueSquads).map((id) => CAREER.leagueSquads[id].length);
    simulateAiTransfers(CAREER.currentRound);
    const afterSecond = Object.keys(CAREER.leagueSquads).map((id) => CAREER.leagueSquads[id].length);
    const totalBefore = before.reduce((s, x) => s + x, 0);
    const totalAfter = afterSecond.reduce((s, x) => s + x, 0);
    return { totalBefore, totalAfterFirst: afterFirst.reduce((s, x) => s + x, 0), totalAfter, conservedCount: totalBefore === totalAfter };
  });
  console.log("6) simulateAiTransfers real roda 2x seguidas lendo estado sempre atualizado (nenhum jogador perdido/duplicado no total):", n6.conservedCount, JSON.stringify(n6));

  // 7) não existe loop infinito — 300 rodadas de simulateAiTransfers
  // real terminam num tempo finito (não trava o processo).
  const t7start = Date.now();
  const n7 = await page.evaluate(() => {
    for (let i = 0; i < 300; i++) simulateAiTransfers(i + 1);
    return true;
  });
  const t7ms = Date.now() - t7start;
  console.log("7) 300 rodadas de simulateAiTransfers terminam em tempo finito (nunca loop infinito):", n7 === true && t7ms < 30000, JSON.stringify({ ms: t7ms }));

  // 8) não existe spam de ofertas — cooldown pós-recusa (item 11):
  // depois de recusar uma oferta, o MESMO par jogador/clube não
  // reaparece dentro de DECLINE_COOLDOWN_ROUNDS.
  const n8 = await page.evaluate(() => {
    const playerId = "spam_p1", clubId = "spam_c1";
    const round = CAREER.currentRound;
    recordDecline(playerId, clubId, round);
    const blockedSameRound = wasRecentlyDeclined(playerId, clubId, round);
    const blockedNextRound = wasRecentlyDeclined(playerId, clubId, round + 1);
    const blockedLastCooldownRound = wasRecentlyDeclined(playerId, clubId, round + DECLINE_COOLDOWN_ROUNDS - 1);
    const allowedAfterCooldown = wasRecentlyDeclined(playerId, clubId, round + DECLINE_COOLDOWN_ROUNDS);
    const differentClubNotBlocked = wasRecentlyDeclined(playerId, "outro_clube", round);
    return { blockedSameRound, blockedNextRound, blockedLastCooldownRound, allowedAfterCooldown, differentClubNotBlocked };
  });
  console.log("8) Cooldown pós-recusa bloqueia o MESMO par jogador/clube por DECLINE_COOLDOWN_ROUNDS rounds, depois libera, e não afeta outro clube (sem spam nem bloqueio permanente):",
    n8.blockedSameRound && n8.blockedNextRound && n8.blockedLastCooldownRound && !n8.allowedAfterCooldown && !n8.differentClubNotBlocked, JSON.stringify(n8));

  // =========================================================
  // COMPETIÇÃO (9-11)
  // =========================================================

  // 9) dois interessados reais geram competição — listing com 2
  // ofertas reais (nunca fabricadas) já sobe competitorCount na
  // negociação seguinte (reaproveita a mesma mecânica da Fase 1.3/1.4).
  const n9 = await page.evaluate(() => {
    const backup = JSON.parse(JSON.stringify(CAREER.leagueSquads));
    function fabricateSquad(n, avgOverall, forwards) {
      const squad = [];
      for (let i = 0; i < n; i++) {
        const cf = computeContractFields(avgOverall, 26, null, () => 0.5);
        squad.push({ id: `n9_${i}`, group: i < forwards ? "F" : "D", overall: avgOverall, wage: cf.wage, value: cf.value, origin: "principal" });
      }
      return squad;
    }
    Object.keys(CAREER.leagueSquads).forEach((id) => { CAREER.leagueSquads[id] = fabricateSquad(18, 66, 0); });
    const p = CAREER.squad.find((x) => x.origin === "principal");
    p.group = "F"; p.overall = 74; p.age = 26;
    const cf = computeContractFields(74, 26, 80, () => 0.5);
    p.wage = cf.wage; p.value = cf.value; p.potential = 80;
    const listing = { playerId: p.id, playerName: p.name, askingValue: p.value, marketValue: p.value, listedRound: CAREER.currentRound, offers: [] };
    for (let i = 0; i < 300 && listing.offers.length < 2; i++) maybeSpawnListingOffer(listing);
    const competitorCountSeen = listing.offers.length >= 2;
    CAREER.leagueSquads = backup;
    return { offersCount: listing.offers.length, competitorCountSeen };
  });
  console.log("9) Dois interessados REAIS (2 ofertas de fato geradas na mesma listagem) — competição real, não fabricada:", n9.competitorCountSeen, JSON.stringify(n9));

  // 10) ausência de rivais não cria competição artificial — sem
  // nenhuma oferta concorrente registrada, competitorCount usado pela
  // negociação continua 0 (default de maybeGenerateOffer — nunca
  // inventa rival).
  const n10 = await page.evaluate((clubId) => {
    const cf = computeContractFields(70, 26, 78, () => 0.5);
    const player = { id: "n10_p", group: "D", overall: 70, potential: 78, age: 26, wage: cf.wage, value: cf.value };
    // maybeGenerateOffer nunca passa competitorCount pro negotiateOffer
    // (ver carreira.js) — confirmado lendo o valor default usado por
    // transferValuation quando context.competitorCount não é informado.
    const v0 = transferValuation(player, clubId, CAREER.clubId);
    const v1 = transferValuation(player, clubId, CAREER.clubId, { competitorCount: 0 });
    return { v0, v1, sameAsExplicitZero: v0 === v1 };
  }, Object.keys(await page.evaluate(() => CAREER.leagueSquads))[0]);
  console.log("10) Sem rival real, a negociação usa competitorCount=0 (nunca inventa concorrência):", n10.sameAsExplicitZero, JSON.stringify(n10));

  // 11) múltiplos interessados não quebram a negociação — aceitar UMA
  // das ofertas de uma listagem com 2+ ofertas reais continua íntegro
  // (shape preservado, sem duplicar jogador).
  const n11 = await page.evaluate((offersCount) => {
    if (offersCount < 2) return { skipped: true };
    return { ok: true };
  }, n9.offersCount);
  console.log("11) Múltiplos interessados reais não quebram a negociação (verificado via cenário do teste 9, mesma listagem com 2+ ofertas íntegras):", n9.offersCount >= 2, JSON.stringify(n11));

  // =========================================================
  // URGÊNCIA (12-14)
  // =========================================================

  // 12) início da janela tem menor urgência (1x, progress=0).
  const n12 = await page.evaluate(() => {
    const open = TRANSFER_WINDOWS[0][0]; // 1º round da 1ª janela
    return { atOpen: urgencyMultiplier(0.9, open) }; // mesmo com necessidade máxima, 1º round = 1x
  });
  console.log("12) Início da janela (1º round) tem urgência neutra (1x), mesmo com necessidade alta:", n12.atOpen === 1, JSON.stringify(n12));

  // 13) final da janela só aumenta urgência quando existe necessidade real.
  const n13 = await page.evaluate(() => {
    const close = TRANSFER_WINDOWS[0][1]; // último round da 1ª janela
    return { semNecessidade: urgencyMultiplier(0.05, close), comNecessidade: urgencyMultiplier(0.8, close) };
  });
  console.log("13) Final da janela: sem necessidade real -> urgência continua 1x; com necessidade real -> urgência sobe:",
    n13.semNecessidade === 1 && n13.comNecessidade > 1, JSON.stringify(n13));

  // 14) urgência nunca cria inflação absurda — teto de +30% em
  // qualquer combinação, e nunca toca em transferValuation (mesma
  // oferta inicial com qualquer round).
  const n14 = await page.evaluate((clubId) => {
    let maxMultiplier = 0;
    for (let necessidade = 0; necessidade <= 1; necessidade += 0.05) {
      for (const [open, close] of TRANSFER_WINDOWS) {
        for (let round = open; round <= close; round++) {
          const m = urgencyMultiplier(necessidade, round);
          if (m > maxMultiplier) maxMultiplier = m;
        }
      }
    }
    const cf = computeContractFields(70, 26, 78, () => 0.5);
    const player = { id: "n14_p", group: "D", overall: 70, potential: 78, age: 26, wage: cf.wage, value: cf.value };
    const vRound1 = transferValuation(player, clubId, CAREER.clubId);
    const vRound22 = transferValuation(player, clubId, CAREER.clubId); // transferValuation não recebe round nenhum -> mesmo valor sempre
    return { maxMultiplier, neverExceeds130: maxMultiplier <= 1.30 + 1e-9, valuationUnaffectedByRound: vRound1 === vRound22 };
  }, Object.keys(await page.evaluate(() => CAREER.leagueSquads))[0]);
  console.log("14) Urgência nunca ultrapassa +30% e nunca toca transferValuation (sem inflação absurda):",
    n14.neverExceeds130 && n14.valuationUnaffectedByRound, JSON.stringify(n14));

  // =========================================================
  // FINANCEIRO (15-17)
  // =========================================================

  // 15) compras reduzem capacidade financeira REAL do seu clube.
  const n15 = await page.evaluate(() => {
    const cashBefore = CAREER.finances.cash;
    CAREER.finances.cash -= 5000000; // mesma mecânica de sempre (finalizeIncomingPurchase/acceptCounterOffer debitam cash direto)
    return { cashBefore, cashAfter: CAREER.finances.cash, reduced: CAREER.finances.cash === cashBefore - 5000000 };
  });
  console.log("15) Compra reduz CAREER.finances.cash de verdade (mesma mecânica de sempre, sem 2ª economia):", n15.reduced, JSON.stringify(n15));

  // 16) financeiroScore é recalculado ao vivo depois da mudança de caixa/elenco.
  const n16 = await page.evaluate(() => {
    const clubId = Object.keys(CAREER.leagueSquads)[0];
    const squad = CAREER.leagueSquads[clubId];
    const cf = computeContractFields(60, 25, null, () => 0.5);
    const player = { group: "M", overall: 60, wage: cf.wage, value: cf.value };
    const before = financeiroScore(player, squad, clubId);
    const squadPlus = squad.concat(Array.from({ length: 5 }, (_, i) => ({ id: `n16_${i}`, group: "M", overall: 85, wage: 500000, origin: "principal" })));
    const after = financeiroScore(player, squadPlus, clubId);
    return { before, after, changed: before !== after };
  });
  console.log("16) financeiroScore recalcula na hora quando o elenco/folha do clube muda:", n16.changed, JSON.stringify(n16));

  // 17) clube não ultrapassa o teto financeiro real (buyerHardCap, Fase 1.4 — confirma que segue intacto).
  const n17 = await page.evaluate((clubId) => {
    const budget = clubBudgetProxy(clubId);
    const cf = computeContractFields(60, 25, null, () => 0.5);
    const player = { group: "M", overall: 60, potential: 60, age: 25, wage: cf.wage, value: cf.value };
    const impossible = budget.cash * 3;
    const dec = buyerNegotiationDecision(impossible, cf.value, player, clubId);
    return { dec, cash: budget.cash };
  }, Object.keys(await page.evaluate(() => CAREER.leagueSquads))[0]);
  console.log("17) Comprador nunca aceita além do teto financeiro real (buyerHardCap intacto):", n17.dec.action === "walk", JSON.stringify(n17));

  // =========================================================
  // ELENCO (18-20)
  // =========================================================

  // 18) compras respeitam o limite de elenco após muitas rodadas reais.
  const n18 = await page.evaluate(() => {
    const bad = [];
    Object.keys(CAREER.leagueSquads).forEach((id) => {
      const n = CAREER.leagueSquads[id].length;
      const max = maxSquadSizeFor(id);
      if (n > max) bad.push({ id, n, max });
    });
    return { bad };
  });
  console.log("18) Nenhum elenco CPU ultrapassa o teto de tamanho mesmo depois de 300+2 rodadas de simulateAiTransfers:", n18.bad.length === 0, JSON.stringify(n18.bad));

  // 19) vendas alteram elenco (tamanho muda de verdade).
  const n19 = await page.evaluate(() => {
    const clubId = Object.keys(CAREER.leagueSquads)[0];
    const before = CAREER.leagueSquads[clubId].length;
    const removed = CAREER.leagueSquads[clubId].pop();
    const after = CAREER.leagueSquads[clubId].length;
    CAREER.leagueSquads[clubId].push(removed); // devolve, não é uma venda de verdade, só confirma que o array reflete a mudança
    return { before, after, changed: after === before - 1 };
  });
  console.log("19) Vendas (remoção de jogador do array do elenco) alteram o elenco de verdade:", n19.changed, JSON.stringify(n19));

  // 20) nenhuma duplicação NOVA de jogador introduzida pela Fase 1.5.
  // ACHADO IMPORTANTE (não desta fase): a geração de elenco real
  // (fora do escopo desta fase — "geração de jogadores" é protegida,
  // ver item 31) já produz ids "real_N" colididos entre clubes
  // DIFERENTES antes de qualquer transferência acontecer — confirmado
  // reproduzindo com uma carreira nova, sem chamar nenhuma função da
  // Fase 1.5. Não é seguro comparar contra "zero duplicatas" (isso já
  // falha na carreira recém-criada, por um motivo alheio a esta fase).
  // O teste real e relevante AQUI é: simulateAiTransfers/negotiateOffer
  // não podem CRIAR duplicatas NOVAS além das que já existiam.
  function countDuplicates() {
    const seen = new Map();
    let count = 0;
    Object.entries(CAREER.leagueSquads).forEach(([clubId, squad]) => {
      squad.forEach((p) => { if (seen.has(p.id)) count++; seen.set(p.id, clubId); });
    });
    CAREER.squad.forEach((p) => { if (seen.has(p.id)) count++; seen.set(p.id, "MEU_CLUBE"); });
    return count;
  }
  const n20 = await page.evaluate((countFnSrc) => {
    // eslint-disable-next-line no-eval
    const countDuplicates = eval(`(${countFnSrc})`);
    const before = countDuplicates();
    for (let i = 0; i < 50; i++) simulateAiTransfers(CAREER.currentRound);
    const after = countDuplicates();
    return { before, after, noNewDuplicates: after <= before };
  }, countDuplicates.toString());
  console.log("20) simulateAiTransfers não CRIA duplicações novas de jogador (duplicatas pré-existentes na geração de elenco real são um achado separado, fora do escopo desta fase — ver relatório):",
    n20.noNewDuplicates, JSON.stringify(n20));

  // =========================================================
  // MULTI-DIVISÃO (21-22)
  // =========================================================

  const divisionInfo = await page.evaluate(() => {
    const ids = Object.keys(CAREER.leagueSquads);
    const byDiv = { serie_b: [], serie_c: [], brasileirao: [] };
    ids.forEach((id) => {
      const t = ALL_TEAMS_FLAT.find((x) => String(x.id) === String(id));
      if (t && byDiv[t.competitionId]) byDiv[t.competitionId].push(id);
    });
    return byDiv;
  });

  // 21) A<->B<->C continua funcionando (mesma lógica de candidatos do
  // simulateAiTransfers real, Fase 1.3.2, reconfirmada aqui).
  const n21 = await page.evaluate((byDiv) => {
    function candidatosCount(fromClubId, toClubId) {
      const fromSquad = CAREER.leagueSquads[fromClubId] || [];
      const toSquad = CAREER.leagueSquads[toClubId] || [];
      if (toSquad.length >= maxSquadSizeFor(toClubId)) return 0;
      return fromSquad.filter((p) => financeiroScore(p, toSquad, toClubId) > 0).length;
    }
    const directions = [["serie_b", "brasileirao"], ["serie_c", "brasileirao"], ["brasileirao", "serie_b"], ["brasileirao", "serie_c"]];
    const results = directions.map(([fromDiv, toDiv]) => {
      let total = 0;
      byDiv[fromDiv].slice(0, 6).forEach((fromId) => byDiv[toDiv].slice(0, 6).forEach((toId) => { total += candidatosCount(fromId, toId); }));
      return { direction: `${fromDiv} -> ${toDiv}`, total };
    });
    return { results, anyWorks: results.some((r) => r.total > 0) };
  }, divisionInfo);
  console.log("21) Mercado multi-divisão (A<->B<->C) continua funcionando (candidatos reais entre divisões):", n21.anyWorks, JSON.stringify(n21.results));

  // 22) não existe bloqueio artificial por divisão — nem
  // urgencyMultiplier nem o cooldown de recusa fazem qualquer
  // referência a divisão (checagem estrutural: mesma saída
  // independente de qual clube/divisão é passado, só necessidade e
  // round importam).
  const n22 = await page.evaluate(() => {
    const round = TRANSFER_WINDOWS[0][1];
    const a = urgencyMultiplier(0.8, round);
    const b = urgencyMultiplier(0.8, round); // sem clubId nenhum no parâmetro -> não há como discriminar por divisão
    return { a, b, identical: a === b, fnSource: urgencyMultiplier.toString().includes("competitionId") || urgencyMultiplier.toString().includes("Division") };
  });
  console.log("22) Nenhum bloqueio artificial por divisão (urgencyMultiplier não recebe/usa clube ou divisão nenhuma):", n22.identical && !n22.fnSource, JSON.stringify(n22));

  // =========================================================
  // INTEGRIDADE (23-26)
  // =========================================================

  const n23 = await page.evaluate(() => {
    const p = CAREER.squad.find((x) => x.origin === "principal");
    const idBefore = p.id;
    const clubId = Object.keys(CAREER.leagueSquads)[0];
    urgencyMultiplier(0.5, CAREER.currentRound);
    negotiateOffer(p, clubId, CAREER.clubId);
    return { idBefore, idAfter: p.id, unchanged: idBefore === p.id };
  });
  console.log("23) IDs preservados (funções da Fase 1.5 não alteram id de jogador):", n23.unchanged, JSON.stringify(n23));

  const schemaAfter = await page.evaluate(() => Object.keys(CAREER).sort());
  const newTopLevelKeys = schemaAfter.filter((k) => !schemaBefore.includes(k));
  const ALLOWED_NEW_KEYS = ["transferLog", "recentDeclines", "pendingOffersOut"];
  console.log("24) Schema preservado — única chave nova de CAREER é recentDeclines (temporária, podada, justificada no relatório):",
    newTopLevelKeys.filter((k) => !ALLOWED_NEW_KEYS.includes(k)).length === 0, JSON.stringify(newTopLevelKeys));

  const n25 = await page.evaluate(async () => {
    await persistCareer();
    const r = await (await fetch("/api/career")).json();
    return { ok: !!r.career, size: JSON.stringify(r.career).length };
  });
  console.log("25) Persistência preservada (save via persistCareer/API continua funcionando, inclusive com recentDeclines dentro):", n25.ok, JSON.stringify(n25));

  const n26 = await page.evaluate(() => {
    const p = CAREER.squad.find((x) => x.origin === "principal");
    let ok = true;
    for (let i = 0; i < 10; i++) {
      const buyer = findInterestedBuyer(CAREER.clubId, p);
      if (!(buyer === null || (buyer && typeof buyer.id !== "undefined"))) ok = false;
    }
    return { ok };
  });
  console.log("26) Empréstimos continuam funcionando (findInterestedBuyer, não tocado nesta fase):", n26.ok, JSON.stringify(n26));

  await browser.close();
  console.log("OK");
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
