// Fase 1.1 — Transfer AI (TransferScore). Testa as funções puras
// (necessidadeScore/adequacaoScore/financeiroScore/contextoScore/
// clubPositionFactor/clubAmbitionFactor/transferScore/
// pickWeightedByScore) diretamente no contexto do app real (via
// page.evaluate, já que são funções globais de carreira.js, não um
// módulo isolado) + o comportamento observável de
// simulateAiTransfers/findInterestedBuyer numa carreira real.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `transferai${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Transfer AI Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  // ---------- Teste 11 — curva de adequação: crescente até diff=20,
  // depois decrescente suave, nunca toca 0 nem satura em 1 antes de
  // diff=8. Jogador muito melhor NÃO é penalizado como um jogador
  // muito pior.
  const curve = await page.evaluate(() => {
    const diffs = [-30, -20, -15, -10, -5, 0, 4, 8, 12, 16, 20, 25, 30, 40];
    return diffs.map((d) => ({ diff: d, fit: overallFitCurve(d) }));
  });
  const curveVals = curve.map((c) => c.fit);
  const isMonotonicUpTo20 = curve.every((c, i) => i === 0 || c.diff > 20 || curveVals[i] >= curveVals[i - 1] - 1e-9);
  const neverZero = curveVals.every((v) => v > 0);
  const neverOneBeforeDiff8 = curve.filter((c) => c.diff < 8).every((c) => c.fit < 1);
  const decaysGentlyAfter20 = curve.filter((c) => c.diff > 20).every((c) => c.fit >= 0.55);
  console.log("11) Curva de adequação crescente até +20, decai suave depois, nunca zera nem satura cedo:",
    isMonotonicUpTo20 && neverZero && neverOneBeforeDiff8 && decaysGentlyAfter20, JSON.stringify(curve));

  // ---------- Teste 12 — clubPositionFactor bate com a MESMA ordenação
  // de sortedStandings()/myLeaguePosition() (nenhuma 2ª lógica de
  // classificação).
  const posCheck = await page.evaluate(() => {
    const myPos = myLeaguePosition(); // já existe, 1-based
    const total = Object.keys(CAREER.standings).length;
    const factor = clubPositionFactor(CAREER.clubId);
    const expected = 1 - (myPos - 1) / (total - 1);
    return { myPos, total, factor, expected, matches: Math.abs(factor - expected) < 1e-9 };
  });
  console.log("12) clubPositionFactor(meu clube) bate com myLeaguePosition()/sortedStandings():", posCheck.matches, JSON.stringify(posCheck));

  // ---------- Teste 13 — necessidadeScore escala com squad.length, sem
  // nenhuma constante fixa de tamanho de elenco.
  const necessidadeCheck = await page.evaluate(() => {
    const grp = "F";
    const results = [12, 16, 24, 26].map((len) => {
      const squad = Array.from({ length: len }, (_, i) => ({ group: i < 2 ? "F" : "D" })); // sempre 2 atacantes, resto defensor
      const ideal = idealCountForGroup(squad, grp);
      const score = necessidadeScore({ group: grp }, squad);
      return { len, ideal, score };
    });
    // ideal deve crescer com squad.length (nunca o mesmo valor fixo pros 4 tamanhos)
    const idealsDistinct = new Set(results.map((r) => r.ideal)).size > 1;
    return { results, idealsDistinct };
  });
  console.log("13) necessidadeScore/idealCountForGroup escalam com squad.length (sem constante fixa):", necessidadeCheck.idealsDistinct, JSON.stringify(necessidadeCheck.results));

  // ---------- Exemplo A/B/C do documento de proposta — reproduzido
  // com dados fabricados, confirma a leitura qualitativa (clube médio
  // carente pontua mais alto que o forte já servido; clube fraco é
  // barrado pelo financeiro antes mesmo do score).
  const abcCheck = await page.evaluate(() => {
    // Salário/valor via computeContractFields (a MESMA fórmula real do
    // jogo, exponencial em overall) — não um valor linear inventado,
    // pra reproduzir de verdade a distância econômica entre clube forte/
    // médio/fraco que a fórmula real produz.
    const cf = computeContractFields(74, 24, 80, () => 0.5);
    const candidate = { group: "F", overall: 74, potential: 80, age: 24, value: cf.value, wage: cf.wage };
    function fabricateSquad(n, avgOverall, forwards) {
      const squad = [];
      for (let i = 0; i < n; i++) {
        const wage = computeContractFields(avgOverall, 26, null, () => 0.5).wage;
        squad.push({ group: i < forwards ? "F" : "D", overall: avgOverall, wage, origin: "principal" }); // origin obrigatório — wageBillOf só soma "principal"/"loan"
      }
      return squad;
    }
    const clubes = {
      forte: fabricateSquad(24, 78, 5),
      medio: fabricateSquad(15, 66, 1),
      fraco: fabricateSquad(13, 58, 2),
    };
    const out = {};
    Object.entries(clubes).forEach(([nome, squad]) => {
      const fakeClubId = `__fake_${nome}`;
      // financeiroScore/adequacaoScore/contextoScore precisam de um
      // clubId real pra leagueSquadFor/squadAvgOverallOf — simula
      // registrando o elenco fabricado temporariamente.
      CAREER.leagueSquads[fakeClubId] = squad;
      const financeiro = financeiroScore(candidate, squad, fakeClubId);
      const necessidade = necessidadeScore(candidate, squad);
      const adequacao = adequacaoScore(candidate, squad, fakeClubId);
      const score = financeiro > 0 ? transferScore(candidate, fakeClubId) : null;
      out[nome] = { financeiro, necessidade: Math.round(necessidade * 100) / 100, adequacao: Math.round(adequacao * 100) / 100, score: score == null ? null : Math.round(score * 100) / 100 };
      delete CAREER.leagueSquads[fakeClubId];
    });
    return out;
  });
  const abcOk = abcCheck.fraco.financeiro === 0 && abcCheck.medio.score !== null && abcCheck.forte.score !== null && abcCheck.medio.score > abcCheck.forte.score;
  console.log("14) Clube fraco eliminado pelo financeiro; clube médio carente pontua mais que o forte já servido:", abcOk, JSON.stringify(abcCheck));

  // ---------- Comportamento observável: findInterestedBuyer(excludeId, player)
  // ainda funciona (assinatura nova, compat mantida) e simulateAiTransfers
  // roda sem erro por várias rodadas, sem estourar limites de elenco.
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#btnOpenMercado").catch(() => {});
  await page.waitForTimeout(200);
  const squadLimitsBefore = await page.evaluate(() => {
    const bad = [];
    Object.keys(CAREER.leagueSquads || {}).forEach((id) => {
      const n = CAREER.leagueSquads[id].length;
      const max = maxSquadSizeFor(id), min = minSquadSizeFor(id);
      if (n > max || n < min - 4) bad.push({ id, n, max, min }); // -4 de folga (empréstimos/vendas em trânsito)
    });
    return bad;
  });
  console.log("15) Elencos CPU dentro dos limites ANTES de simular (baseline):", squadLimitsBefore.length === 0, JSON.stringify(squadLimitsBefore));

  // Simula 15 rodadas de transferência AI direto (sem depender do
  // motor de partida inteiro) pra checar estabilidade de limites.
  const afterSim = await page.evaluate(() => {
    for (let i = 0; i < 15; i++) simulateAiTransfers(1);
    const bad = [];
    Object.keys(CAREER.leagueSquads || {}).forEach((id) => {
      const n = CAREER.leagueSquads[id].length;
      const max = maxSquadSizeFor(id), min = minSquadSizeFor(id);
      if (n > max || n < min - 4) bad.push({ id, n, max, min });
    });
    return { bad, ranTwice: typeof transferScore === "function" };
  });
  console.log("16) Nenhum elenco ultrapassa os limites após 15 rodadas de simulateAiTransfers:", afterSim.bad.length === 0, JSON.stringify(afterSim.bad));

  // findInterestedBuyer com jogador real do próprio elenco (fluxo de
  // empréstimo de verdade).
  const loanCheck = await page.evaluate(() => {
    const p = CAREER.squad.find((x) => x.origin === "principal");
    const buyer = findInterestedBuyer(CAREER.clubId, p);
    return { hasPlayer: !!p, buyerIsNullOrObject: buyer === null || (buyer && typeof buyer.id !== "undefined") };
  });
  console.log("17) findInterestedBuyer(excludeId, player) continua funcionando (null ou clube válido):", loanCheck.buyerIsNullOrObject, JSON.stringify(loanCheck));

  await browser.close();
  console.log("OK");
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
