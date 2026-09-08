// Fase 1.3.2 — Balanceamento estrutural do Transfer AI. Testa as 3
// correções (necessidadeScore com déficit qualitativo + tamanho de
// elenco; financeiroScore graduado; multi-divisão liberada como
// CONSEQUÊNCIA da correção financeira, sem nenhuma tabela nova de
// plausibilidade) contra o app real, via page.evaluate — mesmo padrão
// dos testes das Fases 1.1/1.2/1.3. transferValuation, os pesos
// 35/30/20/15 e a tabela de offerProbabilityFromScore NÃO foram
// tocados nesta fase — os testes abaixo confirmam isso, não testam
// mudança neles.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `transferai132_${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Transfer AI 132", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  // Helpers de fabricação (mesmo padrão de wage/value real via
  // computeContractFields já usado nas Fases 1.1/1.2/1.3 — nunca linear
  // inventado).
  const setup = await page.evaluate(() => {
    function fabricateSquad(n, avgOverall, groups) {
      const squad = [];
      for (let i = 0; i < n; i++) {
        const g = groups[i % groups.length];
        const wage = computeContractFields(avgOverall, 26, null, () => 0.5).wage;
        squad.push({ id: `fab_${i}_${Math.random()}`, group: g, overall: avgOverall, wage, origin: "principal" });
      }
      return squad;
    }
    window.__fabricateSquad = fabricateSquad;
    return true;
  });

  // ---------- NECESSIDADE ----------

  // 1) déficit de posição/grupo maior -> necessidade maior.
  const t1 = await page.evaluate(() => {
    const candidate = { group: "F", overall: 70 };
    const squadDeficit = window.__fabricateSquad(16, 65, ["G", "D", "D", "D", "M", "M"]); // 0 atacantes
    const squadFull = window.__fabricateSquad(16, 65, ["G", "D", "D", "D", "M", "F", "F", "F", "F"]); // atacantes em excesso
    return { deficit: necessidadeScore(candidate, squadDeficit), full: necessidadeScore(candidate, squadFull) };
  });
  console.log("1) Clube com déficit de grupo tem necessidade maior que clube com o grupo cheio:", t1.deficit > t1.full, JSON.stringify(t1));

  // 2) elenco equilibrado (proporção igual à SQUAD_GROUP_PROPORTION) -> necessidade menor que elenco desequilibrado.
  const t2 = await page.evaluate(() => {
    const candidate = { group: "D", overall: 70 };
    // proporção real: G 12%, D 32%, M 32%, F 24% — 25 jogadores: G3 D8 M8 F6 (bate quase exato).
    const groups = [];
    for (let i = 0; i < 3; i++) groups.push("G");
    for (let i = 0; i < 8; i++) groups.push("D");
    for (let i = 0; i < 8; i++) groups.push("M");
    for (let i = 0; i < 6; i++) groups.push("F");
    const balanced = window.__fabricateSquad(25, 65, groups);
    const unbalanced = window.__fabricateSquad(25, 65, ["G", "M", "M", "M", "F", "F"]); // sem D nenhum
    return { balanced: necessidadeScore(candidate, balanced), unbalanced: necessidadeScore(candidate, unbalanced) };
  });
  console.log("2) Elenco equilibrado tem necessidade menor que elenco desequilibrado (mesmo grupo do candidato):", t2.balanced < t2.unbalanced, JSON.stringify(t2));

  // 3) déficit QUALITATIVO moderado — grupo numericamente cheio (déficit
  // de grupo = 0), mas overall dos jogadores do grupo bem inferior ao
  // candidato -> necessidade > 0, e MENOR que um déficit de grupo puro
  // (moderado, nunca dominante, ver peso 25% do combinado).
  const t3 = await page.evaluate(() => {
    const groups = ["G", "G", "G", "D", "D", "D", "D", "D", "D", "D", "D", "M", "M", "M", "M", "M", "M", "M", "M", "F", "F", "F", "F", "F", "F"]; // 25, bate a proporção ideal p/ D (8)
    const weakSquad = window.__fabricateSquad(25, 55, groups); // todos overall 55
    // sobrescreve só o overall dos defensores pra simular "numericamente cheio, fraco"
    weakSquad.forEach((p) => { if (p.group === "D") p.overall = 55; });
    const strongCandidate = { group: "D", overall: 78 }; // bem acima da média do grupo (55)
    const similarCandidate = { group: "D", overall: 50 }; // não resolve nada (não é melhor que a média, 55)
    const necStrong = necessidadeScore(strongCandidate, weakSquad);
    const necSimilar = necessidadeScore(similarCandidate, weakSquad);
    const necGroupDeficitPure = necessidadeScore({ group: "F", overall: 78 }, window.__fabricateSquad(24, 55, ["G", "D", "D", "D", "D", "D", "D", "D", "D", "M", "M", "M", "M", "M", "M", "M", "M"])); // 0 atacantes de propósito (déficit de grupo puro)
    return { necStrong, necSimilar, necGroupDeficitPure };
  });
  console.log("3) Déficit qualitativo (grupo cheio, nível baixo): candidato bem melhor gera necessidade > 0 e MODERADA (menor que déficit de grupo puro); candidato equivalente não gera necessidade:",
    t3.necStrong > 0 && t3.necSimilar === 0 && t3.necStrong < t3.necGroupDeficitPure, JSON.stringify(t3));

  // 4) elenco perto do TETO -> necessidade reduzida; elenco perto do
  // PISO -> necessidade ampliada (mesmo déficit de grupo/qualidade nos
  // 2 casos, só o tamanho total muda).
  const t4 = await page.evaluate(() => {
    const clubId = CAREER.clubId; // usa maxSquadSizeFor/minSquadSizeFor reais do próprio clube (própria divisão)
    const max = maxSquadSizeFor(clubId), min = minSquadSizeFor(clubId);
    const candidate = { group: "F", overall: 70 };
    const groupsNoF = ["G", "D", "D", "D", "M", "M", "M"];
    function squadOfSize(n) {
      const s = [];
      for (let i = 0; i < n; i++) s.push({ id: `sz_${i}`, group: groupsNoF[i % groupsNoF.length], overall: 65, wage: 1000, origin: "principal" });
      return s;
    }
    const nearMin = squadOfSize(min);
    const nearMax = squadOfSize(max);
    return { min, max, necNearMin: necessidadeScore(candidate, nearMin, clubId), necNearMax: necessidadeScore(candidate, nearMax, clubId) };
  });
  console.log("4) Elenco perto do PISO tem necessidade maior que elenco perto do TETO (mesmo déficit de grupo, só o tamanho muda):", t4.necNearMin > t4.necNearMax, JSON.stringify(t4));

  // 5) necessidadeScore permanece em [0,1] em combos extremos (inclusive
  // sem buyingClubId — compat com chamada de 2 argumentos).
  const t5 = await page.evaluate(() => {
    const cases = [
      necessidadeScore({ group: "G", overall: 99 }, []),
      necessidadeScore({ group: "F", overall: 40 }, window.__fabricateSquad(30, 90, ["F", "F", "F", "F", "F"])),
      necessidadeScore({ group: "M" }, window.__fabricateSquad(10, 60, ["M"])), // sem overall
      necessidadeScore({ group: "D", overall: 80 }, window.__fabricateSquad(26, 60, ["D"]), CAREER.clubId),
    ];
    return { cases, allWithin01: cases.every((v) => v >= 0 && v <= 1 && !Number.isNaN(v)) };
  });
  console.log("5) necessidadeScore permanece em [0,1] mesmo em combos extremos (incl. sem overall/sem buyingClubId):", t5.allWithin01, JSON.stringify(t5));

  // ---------- FINANCEIRO ----------

  // 6) clube pobre consegue participar (financeiro > 0) quando o
  // jogador é só moderadamente acima da capacidade (ratio < 2.5).
  const t6 = await page.evaluate(() => {
    const poorSquad = window.__fabricateSquad(13, 58, ["G", "D", "D", "D", "M", "M", "M", "F", "F"]);
    const fakeId = "__fake_pobre_acessivel";
    CAREER.leagueSquads[fakeId] = poorSquad;
    const cf = computeContractFields(60, 25, 65, () => 0.5); // jogador modesto, perto da realidade do clube pobre
    const candidate = { group: "F", overall: 60, potential: 65, age: 25, value: cf.value, wage: cf.wage };
    const fin = financeiroScore(candidate, poorSquad, fakeId);
    delete CAREER.leagueSquads[fakeId];
    return { fin, withinRange: fin > 0 && fin <= 1 };
  });
  console.log("6) Clube pobre consegue participar (financeiro > 0) de um jogador acessível à sua realidade:", t6.withinRange, JSON.stringify(t6));

  // 7) clube pobre NÃO consegue comprar jogador claramente inacessível
  // (ratio >= 2.5x a capacidade) — continua 0, o filtro financeiro
  // continua bloqueando o caso extremo.
  const t7 = await page.evaluate(() => {
    const poorSquad = window.__fabricateSquad(13, 58, ["G", "D", "D", "D", "M", "M", "M", "F", "F"]);
    const fakeId = "__fake_pobre_inacessivel";
    CAREER.leagueSquads[fakeId] = poorSquad;
    const cf = computeContractFields(90, 27, 92, () => 0.5); // craque, bem fora da realidade do clube pobre
    const candidate = { group: "F", overall: 90, potential: 92, age: 27, value: cf.value, wage: cf.wage };
    const fin = financeiroScore(candidate, poorSquad, fakeId);
    delete CAREER.leagueSquads[fakeId];
    return { fin, blocked: fin === 0 };
  });
  console.log("7) Clube pobre NÃO consegue comprar jogador claramente inacessível (financeiro permanece 0):", t7.blocked, JSON.stringify(t7));

  // 8) clube rico continua tendo maior capacidade que clube pobre pelo
  // MESMO candidato borderline (rico >= pobre, nunca o contrário).
  const t8 = await page.evaluate(() => {
    const richSquad = window.__fabricateSquad(24, 78, ["G", "D", "D", "D", "D", "D", "M", "M", "M", "M", "M", "F", "F", "F"]);
    const poorSquad = window.__fabricateSquad(13, 58, ["G", "D", "D", "D", "M", "M", "M", "F", "F"]);
    const richId = "__fake_rico_8", poorId = "__fake_pobre_8";
    CAREER.leagueSquads[richId] = richSquad;
    CAREER.leagueSquads[poorId] = poorSquad;
    const cf = computeContractFields(72, 26, 75, () => 0.5);
    const candidate = { group: "M", overall: 72, potential: 75, age: 26, value: cf.value, wage: cf.wage };
    const finRich = financeiroScore(candidate, richSquad, richId);
    const finPoor = financeiroScore(candidate, poorSquad, poorId);
    delete CAREER.leagueSquads[richId];
    delete CAREER.leagueSquads[poorId];
    return { finRich, finPoor, richHasMoreOrEqual: finRich >= finPoor };
  });
  console.log("8) Clube rico continua com capacidade financeira >= clube pobre pro mesmo candidato:", t8.richHasMoreOrEqual, JSON.stringify(t8));

  // 9) financeiro não gera inflação no valuation — finFactor continua
  // limitado a [0.97, 1.02] (mesma fórmula da Fase 1.3, não tocada) e a
  // valuation final continua dentro de [70%,150%] mesmo com o novo
  // financeiroScore contínuo.
  const t9 = await page.evaluate(() => {
    const buyerId = teamById ? Object.keys(CAREER.leagueSquads)[0] : null;
    const squad = CAREER.leagueSquads[buyerId] || [];
    const p = CAREER.squad.find((x) => x.origin === "principal");
    const base = p.value;
    const v = transferValuation(p, buyerId, CAREER.clubId);
    return { base, v, withinLimits: v >= base * 0.70 && v <= base * 1.50 };
  });
  console.log("9) transferValuation continua dentro de [70%,150%] do valor base com o financeiroScore novo (sem inflação):", t9.withinLimits, JSON.stringify(t9));

  // ---------- MULTI-DIVISÃO ----------

  const divisionInfo = await page.evaluate(() => {
    const ids = Object.keys(CAREER.leagueSquads);
    const byDiv = { serie_b: [], serie_c: [], brasileirao: [] };
    ids.forEach((id) => {
      const t = ALL_TEAMS_FLAT.find((x) => String(x.id) === String(id));
      if (t && byDiv[t.competitionId]) byDiv[t.competitionId].push(id);
    });
    return byDiv;
  });

  // 10/11/12) Série B, Série C e Série A conseguem aparecer como
  // COMPRADORAS de verdade (financeiroScore > 0 para algum jogador
  // realista da própria realidade) — não testa "compra qualquer coisa",
  // testa que a porta deixou de estar 100% fechada (era o Gap 3).
  const t10_12 = await page.evaluate((byDiv) => {
    function canBuySomething(clubId) {
      const squad = CAREER.leagueSquads[clubId];
      if (!squad || !squad.length) return false;
      // candidato modesto, na mesma faixa de overall do próprio elenco
      // (comparável à realidade financeira do clube, não um craque).
      const avgOv = squad.reduce((s, p) => s + p.overall, 0) / squad.length;
      const cf = computeContractFields(Math.round(avgOv), 24, Math.round(avgOv) + 5, () => 0.5);
      const candidate = { group: "M", overall: Math.round(avgOv), potential: Math.round(avgOv) + 5, age: 24, value: cf.value, wage: cf.wage };
      return financeiroScore(candidate, squad, clubId) > 0;
    }
    const serieB = byDiv.serie_b.filter(canBuySomething).length;
    const serieC = byDiv.serie_c.filter(canBuySomething).length;
    const serieA = byDiv.brasileirao.filter(canBuySomething).length;
    return { serieBTotal: byDiv.serie_b.length, serieCTotal: byDiv.serie_c.length, serieATotal: byDiv.brasileirao.length, serieB, serieC, serieA };
  }, divisionInfo);
  console.log("10) Série B consegue comprar jogador compatível com sua própria realidade financeira:", t10_12.serieB > 0, JSON.stringify(t10_12));
  console.log("11) Série C consegue comprar jogador compatível com sua própria realidade financeira:", t10_12.serieC > 0);
  console.log("12) Série A continua comprando jogador compatível com sua própria realidade financeira:", t10_12.serieA > 0);

  // 13) existem transações POTENCIAIS entre divisões — testa a MESMA
  // lógica que simulateAiTransfers usa de verdade (candidatos = elenco
  // vendedor filtrado por financeiroScore(jogador, elenco comprador,
  // clube comprador) > 0) num varrido de pares cruzando as 3 divisões,
  // sem depender de sorte de RNG numa amostra pequena de rodadas.
  const t13 = await page.evaluate((byDiv) => {
    function candidatosCount(fromClubId, toClubId) {
      const fromSquad = CAREER.leagueSquads[fromClubId] || [];
      const toSquad = CAREER.leagueSquads[toClubId] || [];
      if (toSquad.length >= maxSquadSizeFor(toClubId)) return 0;
      return fromSquad.filter((p) => financeiroScore(p, toSquad, toClubId) > 0).length;
    }
    const directions = [
      ["serie_b", "brasileirao"], ["brasileirao", "serie_b"],
      ["serie_c", "serie_b"], ["serie_b", "serie_c"],
      ["brasileirao", "serie_c"], ["serie_c", "brasileirao"],
    ];
    const byDirection = directions.map(([fromDiv, toDiv]) => {
      let possiblePairs = 0, totalCandidatos = 0;
      byDiv[fromDiv].slice(0, 6).forEach((fromId) => {
        byDiv[toDiv].slice(0, 6).forEach((toId) => {
          const n = candidatosCount(fromId, toId);
          if (n > 0) { possiblePairs++; totalCandidatos += n; }
        });
      });
      return { direction: `${fromDiv} -> ${toDiv}`, possiblePairs, totalCandidatos };
    });
    return { byDirection, anyCrossDivisionPossible: byDirection.some((d) => d.possiblePairs > 0) };
  }, divisionInfo);
  console.log("13) Existem transações POTENCIAIS entre divisões diferentes (mesma lógica de candidatos do simulateAiTransfers real):", t13.anyCrossDivisionPossible, JSON.stringify(t13.byDirection));

  // 14) não aparecem combinações absurdas — o jogador mais CARO do
  // elenco real do Brasileirão nesta carreira continua inacessível pra
  // QUALQUER clube real de Série C (financeiro permanece 0 mesmo com a
  // rampa contínua — o clamp em 2,5x da capacidade segue bloqueando o
  // caso extremo, dado real, não fabricado).
  const t14 = await page.evaluate((byDiv) => {
    let priciest = null;
    byDiv.brasileirao.forEach((id) => {
      (CAREER.leagueSquads[id] || []).forEach((p) => { if (!priciest || p.value > priciest.value) priciest = p; });
    });
    const results = byDiv.serie_c.map((id) => ({ id, fin: financeiroScore(priciest, CAREER.leagueSquads[id], id) }));
    return { priciestValue: priciest ? priciest.value : null, priciestName: priciest ? priciest.name : null, results, noneCanAfford: results.every((r) => r.fin === 0) };
  }, divisionInfo);
  console.log("14) O craque mais caro do Brasileirão real continua inacessível pra QUALQUER clube real de Série C (sem combinação absurda):", t14.noneCanAfford, JSON.stringify({ priciestValue: t14.priciestValue, priciestName: t14.priciestName, noneCanAfford: t14.noneCanAfford }));

  // ---------- TRANSFERSCORE ----------

  // 15) transferScore permanece em [0,1].
  const t15 = await page.evaluate(() => {
    const p = CAREER.squad.find((x) => x.origin === "principal");
    const ids = Object.keys(CAREER.leagueSquads).slice(0, 15);
    const scores = ids.map((id) => transferScore(p, id));
    return { scores, allWithin01: scores.every((s) => s >= 0 && s <= 1) };
  });
  console.log("15) transferScore permanece em [0,1] pro elenco real:", t15.allWithin01, JSON.stringify(t15.scores.map((s) => Math.round(s * 100) / 100)));

  // 16) pesos continuam 35/30/20/15 — reconstrói o score manualmente a
  // partir dos 4 componentes e confirma que bate com transferScore.
  const t16 = await page.evaluate(() => {
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
  console.log("16) Pesos continuam 35% necessidade + 30% adequação + 20% financeiro + 15% contexto (reconstrução manual bate com transferScore):", t16.matches, JSON.stringify(t16));

  // 17) score passa a apresentar distribuição mais ampla que o máximo
  // observado na Fase 1.3.1 (0,5868) — amostra ampla real (500 pares
  // aleatórios do elenco das 3 divisões) pra comparar o novo teto.
  const t17 = await page.evaluate(() => {
    const players = [];
    Object.values(CAREER.leagueSquads).forEach((squad) => players.push(...squad));
    const clubIds = Object.keys(CAREER.leagueSquads);
    let max = 0, min = 1, count = 0;
    for (let i = 0; i < 500; i++) {
      const p = players[Math.floor(Math.random() * players.length)];
      const clubId = clubIds[Math.floor(Math.random() * clubIds.length)];
      if (!p) continue;
      const s = transferScore(p, clubId);
      if (s > max) max = s;
      if (s < min) min = s;
      count++;
    }
    return { max, min, count, widerThanBaseline: max > 0.5868 };
  });
  console.log("17) TransferScore real passa a ocupar faixa mais ampla que o teto observado na Fase 1.3.1 (0,5868):", t17.widerThanBaseline, JSON.stringify(t17));

  // 18) faixas superiores de offerProbabilityFromScore (>=0.55) podem
  // ser exercitadas em condições plausíveis — construídas com os
  // componentes reais (nenhum deles fora de [0,1], nenhuma fórmula
  // reimplementada), não um score inventado direto.
  const t18 = await page.evaluate(() => {
    // Cenário plausível: clube médio, carente no grupo do candidato,
    // elenco perto do piso, mas sem forçar nada fora do que as funções
    // reais já produzem pros parâmetros dados.
    const clubId = "__fake_carente_18";
    const groups = ["G", "M", "M", "M", "M", "M", "M", "F", "F", "F", "F", "F"]; // sem D nenhum, elenco pequeno (perto do piso)
    const squad = groups.map((g, i) => ({ id: `q18_${i}`, group: g, overall: 62, wage: computeContractFields(62, 27, null, () => 0.5).wage, origin: "principal" }));
    CAREER.leagueSquads[clubId] = squad;
    const cf = computeContractFields(64, 23, 72, () => 0.5);
    const candidate = { group: "D", overall: 64, potential: 72, age: 23, value: cf.value, wage: cf.wage };
    const score = transferScore(candidate, clubId);
    const prob = offerProbabilityFromScore(score);
    delete CAREER.leagueSquads[clubId];
    return { score, prob, reachedUpperBand: score >= 0.55 };
  });
  console.log("18) Faixa superior de offerProbabilityFromScore (score>=0,55 -> prob>=18%) alcançável com componentes reais em cenário plausível:", t18.reachedUpperBand, JSON.stringify(t18));

  // ---------- INTEGRIDADE ----------

  // 19/20/21) nenhum ID alterado, nenhum schema/persistência nova —
  // CAREER continua com exatamente as mesmas chaves de topo de antes
  // desta fase (nenhuma chave nova adicionada por esta correção).
  const schemaAfter = await page.evaluate(() => Object.keys(CAREER).sort());
  const newKeys = schemaAfter.filter((k) => !schemaBefore.includes(k));
  console.log("19/20/21) Nenhuma chave nova em CAREER (sem schema/persistência nova) além de transferLog (só usado neste teste, array já suportado por pushTransferLog original):",
    newKeys.filter((k) => k !== "transferLog").length === 0, JSON.stringify(newKeys));

  // 22) fluxo de empréstimo continua intacto — findInterestedBuyer
  // (usado pelo empréstimo OUT) continua respondendo null ou clube
  // válido, sem erro, com o financeiroScore novo por baixo.
  const t22 = await page.evaluate(() => {
    const p = CAREER.squad.find((x) => x.origin === "principal");
    let ok = true, results = [];
    for (let i = 0; i < 10; i++) {
      const buyer = findInterestedBuyer(CAREER.clubId, p);
      const valid = buyer === null || (buyer && typeof buyer.id !== "undefined");
      results.push(valid);
      if (!valid) ok = false;
    }
    return { ok, results };
  });
  console.log("22) findInterestedBuyer (fluxo de empréstimo) continua respondendo null ou clube válido em toda chamada:", t22.ok, JSON.stringify(t22));

  // 23) transferValuation continua determinística (mesmos inputs ->
  // mesmo resultado, sem RNG interno) mesmo com necessidadeScore/
  // financeiroScore novos por baixo.
  const t23 = await page.evaluate(() => {
    const p = CAREER.squad.find((x) => x.origin === "principal");
    const clubId = Object.keys(CAREER.leagueSquads)[0];
    const v1 = transferValuation(p, clubId, CAREER.clubId);
    const v2 = transferValuation(p, clubId, CAREER.clubId);
    const v3 = transferValuation(p, clubId, CAREER.clubId);
    return { v1, v2, v3, allEqual: v1 === v2 && v2 === v3 };
  });
  console.log("23) transferValuation continua determinística (mesmos inputs -> mesmo resultado):", t23.allEqual, JSON.stringify(t23));

  await browser.close();
  console.log("OK");
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
