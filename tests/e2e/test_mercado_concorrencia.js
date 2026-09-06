// Nova feature (Bloco 3, 2/4 — pedido do usuário, mockup
// brtreinadorbloco3pendentes.html "Comparar propostas") — concorrência
// real por um alvo: um clube CPU pode também ofertar pelo mesmo
// jogador enquanto sua proposta espera; comparação lado a lado +
// análise; quem "pesa" mais tem mais chance de vencer.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `mercadoconc${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Neg Concorrencia", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(300);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.waitForTimeout(1500);
  await page.click("#btnClaimDailyLogin").catch(() => {});
  await page.waitForTimeout(200);
  await page.click(".m3-nav-item[data-panel='mercado']");
  await page.waitForTimeout(300);

  // 1) Um concorrente NASCE (RNG forçado dentro da chance) numa
  // proposta pendente sem concorrente ainda.
  const target = await page.evaluate(() => {
    const row = document.querySelector("#marketList [data-buy]");
    return { clubId: row.dataset.club, playerId: row.dataset.buy };
  });
  const check1 = await page.evaluate((t) => {
    const p = leagueSquadFor(t.clubId).find((x) => x.id === t.playerId);
    CAREER.pendingOffersOut.push({
      id: "test_rival_spawn", playerId: p.id, playerName: p.name, clubId: t.clubId, clubName: teamById(t.clubId).name,
      marketValue: p.value, offerValue: Math.round(p.value * 0.8), installments: 1,
      roundsLeft: 3, status: "pending", counterValue: null, rivalOffer: null,
    });
    const o = CAREER.pendingOffersOut.find((x) => x.id === "test_rival_spawn");
    const orig = Math.random;
    Math.random = () => 0.01; // garante nascer (< RIVAL_OFFER_CHANCE_PER_ROUND) e o resto dos sorteios internos também caem em valores baixos
    maybeSpawnRivalOffer(o);
    Math.random = orig;
    return { hasRival: !!o.rivalOffer, rival: o.rivalOffer };
  }, target);
  console.log("1) Concorrente nasce numa proposta pendente (RNG dentro da chance):", check1.hasRival && !!check1.rival?.clubName && check1.rival?.offerValue > 0, JSON.stringify(check1));

  // 2) Nunca nasce um 2º concorrente pra mesma proposta (já tem um).
  const check2 = await page.evaluate(() => {
    const o = CAREER.pendingOffersOut.find((x) => x.id === "test_rival_spawn");
    const firstRivalClub = o.rivalOffer.clubName;
    const orig = Math.random;
    Math.random = () => 0.01;
    maybeSpawnRivalOffer(o);
    Math.random = orig;
    return { sameRival: o.rivalOffer.clubName === firstRivalClub };
  });
  console.log("2) Não nasce um 2º concorrente pra mesma proposta:", check2.sameRival, JSON.stringify(check2));

  // 3) "Minhas propostas" mostra o selo de concorrência + botão
  // "Comparar" (não "Aumentar" direto).
  await page.click("#btnOpenMyOffers");
  await page.waitForTimeout(200);
  const check3 = await page.evaluate(() => {
    const row = [...document.querySelectorAll("#myOffersList .mt-sponsor-proposal-row")].find((r) => r.querySelector('[data-compare="test_rival_spawn"]'));
    return {
      hasBadge: row ? row.textContent.includes("Concorrência") : false,
      hasCompareBtn: !!row?.querySelector('[data-compare="test_rival_spawn"]'),
      hasIncreaseBtn: !!row?.querySelector('[data-increase="test_rival_spawn"]'),
    };
  });
  console.log("3) 'Minhas propostas' mostra selo de concorrência + botão Comparar (não Aumentar direto):",
    check3.hasBadge && check3.hasCompareBtn && !check3.hasIncreaseBtn, JSON.stringify(check3));

  // 4) Abrir "Comparar propostas" mostra as 2 colunas com os valores
  // certos + análise não-vazia.
  await page.click('[data-compare="test_rival_spawn"]');
  await page.waitForTimeout(200);
  const check4 = await page.evaluate(() => {
    const o = CAREER.pendingOffersOut.find((x) => x.id === "test_rival_spawn");
    const cols = [...document.querySelectorAll("#offerCompareCard .mt-offercmp-col")];
    return {
      open: document.getElementById("offerCompareOverlay").classList.contains("open"),
      colCount: cols.length,
      hasMineValue: cols[0]?.textContent.includes(String(o.offerValue).slice(0, 3)), // aproximação (fmtBRL formata)
      hasRivalClub: cols[1]?.textContent.includes(o.rivalOffer.clubName),
      analysisLength: document.getElementById("offerCompareAnalysis").textContent.length,
      oneColLead: cols.some((c) => c.classList.contains("lead")) && !cols.every((c) => c.classList.contains("lead")),
    };
  });
  console.log("4) 'Comparar propostas' abre com as 2 colunas e uma análise não-vazia, só 1 lado em destaque:",
    check4.open && check4.colCount === 2 && check4.hasRivalClub && check4.analysisLength > 20 && check4.oneColLead, JSON.stringify(check4));
  await page.screenshot({ path: "screens/mercado_comparar_propostas.png" });

  // 5) "Aumentar proposta" (FAB da comparação) sobe pro valor do
  // concorrente e fecha a tela, voltando pra Minhas propostas.
  const rivalValueBefore = await page.evaluate(() => CAREER.pendingOffersOut.find((x) => x.id === "test_rival_spawn").rivalOffer.offerValue);
  await page.click("#btnOfferCompareIncrease");
  await page.waitForTimeout(200);
  const check5 = await page.evaluate((rivalVal) => {
    const o = CAREER.pendingOffersOut.find((x) => x.id === "test_rival_spawn");
    return {
      compareClosed: !document.getElementById("offerCompareOverlay").classList.contains("open"),
      newOfferValue: o.offerValue,
      matchesRival: o.offerValue >= rivalVal,
      roundsReset: o.roundsLeft,
    };
  }, rivalValueBefore);
  console.log("5) 'Aumentar proposta' sobe pro valor do concorrente e fecha a tela:",
    check5.compareClosed && check5.matchesRival, JSON.stringify(check5));

  // 6) Resolução COM concorrente: minha proposta "pesa mais" (valor
  // maior, mesmas parcelas) -- RNG forçado pra dentro da faixa de
  // vitória (80%) -- fecha o negócio de verdade.
  const target2 = await page.evaluate(() => {
    const row = document.querySelector("#marketList [data-buy]");
    return { clubId: row.dataset.club, playerId: row.dataset.buy };
  });
  const check6 = await page.evaluate((t) => {
    const p = leagueSquadFor(t.clubId).find((x) => x.id === t.playerId);
    CAREER.finances.wageCap = 999999999; CAREER.finances.cash = 999999999;
    CAREER.pendingOffersOut.push({
      id: "test_rival_win", playerId: p.id, playerName: p.name, clubId: t.clubId, clubName: teamById(t.clubId).name,
      marketValue: p.value, offerValue: p.value, installments: 1, roundsLeft: 1, status: "pending", counterValue: null,
      rivalOffer: { clubId: "xxx", clubName: "Rival FC", offerValue: Math.round(p.value * 0.9), installments: 1 },
    });
    const orig = Math.random;
    Math.random = () => 0.01; // dentro dos 80% de chance de vencer (minha oferta > rival)
    resolvePendingOffersOutRound(CAREER.currentRound);
    Math.random = orig;
    return { inSquad: !!CAREER.squad.find((x) => x.id === t.playerId), stillPending: !!CAREER.pendingOffersOut.find((x) => x.id === "test_rival_win") };
  }, target2);
  console.log("6) Minha proposta pesa mais que a do concorrente e vence (RNG dentro dos 80%):",
    check6.inSquad && !check6.stillPending, JSON.stringify(check6));

  await page.click('#pressOptions [data-press]').catch(() => {});
  await page.waitForTimeout(150);
  await page.evaluate(() => renderMercado());

  // 7) Resolução COM concorrente: minha proposta pesa MENOS -- RNG
  // forçado pra fora dos 25% de chance -- perco a disputa, sem entrar
  // no elenco nem gastar nada.
  const target3 = await page.evaluate(() => {
    const row = document.querySelector("#marketList [data-buy]");
    return { clubId: row.dataset.club, playerId: row.dataset.buy };
  });
  const check7 = await page.evaluate((t) => {
    const p = leagueSquadFor(t.clubId).find((x) => x.id === t.playerId);
    const cashBefore = CAREER.finances.cash;
    CAREER.pendingOffersOut.push({
      id: "test_rival_lose", playerId: p.id, playerName: p.name, clubId: t.clubId, clubName: teamById(t.clubId).name,
      marketValue: p.value, offerValue: Math.round(p.value * 0.85), installments: 1, roundsLeft: 1, status: "pending", counterValue: null,
      rivalOffer: { clubId: "yyy", clubName: "Concorrente United", offerValue: p.value, installments: 1 },
    });
    const orig = Math.random;
    Math.random = () => 0.9; // fora dos 25% de chance (minha oferta < rival)
    resolvePendingOffersOutRound(CAREER.currentRound);
    Math.random = orig;
    return {
      cashUnchanged: CAREER.finances.cash === cashBefore,
      notInMySquad: !CAREER.squad.find((x) => x.id === t.playerId),
      stillPending: !!CAREER.pendingOffersOut.find((x) => x.id === "test_rival_lose"),
    };
  }, target3);
  console.log("7) Minha proposta pesa menos e perco a disputa (RNG fora dos 25%), sem afetar meu caixa/elenco:",
    check7.cashUnchanged && check7.notInMySquad && !check7.stillPending, JSON.stringify(check7));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
