// Fase 1.5 — Market Dynamics: simulação estatística (script TEMPORÁRIO,
// não commitado — mesmo padrão dos sims das Fases 1.3.1/1.3.2/1.4).
// Cria uma carreira real multi-divisão (60 clubes) e usa SÓ funções
// reais de produção (negotiateOffer/transferScore/necessidadeScore/
// financeiroScore/urgencyMultiplier/wasRecentlyDeclined/recordDecline
// — nada reimplementado).
//
// Dois experimentos, mesmo espírito das Fases anteriores:
//   A — JANELA REAL: avança uma carreira de verdade pelas 2 janelas de
//       transferência de uma temporada completa (rounds 1-3 e 20-22),
//       chamando exatamente as mesmas funções que finishRoundTail
//       chama a cada rodada (simulateAiTransfers, maybeGenerateOffer,
//       resolvePendingOffersOutRound, resolvePendingListingsRound) —
//       captura timing/cascata/necessidade antes-depois de verdade,
//       numa sequência temporal real.
//   B — AMOSTRA AMPLA: 10.000+ pares (jogador dono x clube comprador),
//       variando o ROUND explicitamente entre as posições possíveis
//       dentro de cada janela (1/2/3 e 20/21/22) — necessário pra
//       medir o efeito da urgência (item 12/13) e do cooldown de
//       recusa (item 11) em escala estatística, o que só rodadas reais
//       (só 6 rounds de mercado por temporada) não permitiriam.
//
// RNG global do jogo (Math.random()), sem seed — mesma documentação
// já usada em todos os sims anteriores desta sessão.
const { chromium } = require("playwright-core");
const fs = require("fs");

const N_BROAD = 12000;

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  const base = "http://localhost:8787";
  const email = `mktdynsim15_${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "MktDyn Sim 1.5", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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
  console.log("Carreira real criada (multi-divisão). Rodando Market Dynamics em memória (sem persistir nenhuma mudança)...");

  const result = await page.evaluate(({ N_BROAD }) => {
    function divisionOf(clubId) {
      const t = ALL_TEAMS_FLAT.find((x) => String(x.id) === String(clubId));
      return t ? t.competitionId : (String(clubId) === String(CAREER.clubId) ? CURRENT_COMPETITION_ID : "?");
    }
    function squadOf(clubId) {
      return String(clubId) === String(CAREER.clubId) ? CAREER.squad.filter((p) => p.origin === "principal") : leagueSquadFor(clubId);
    }
    function necessidadeMediaMercado() {
      // média de necessidadeScore de um candidato "genérico" (overall
      // médio da própria divisão) contra o próprio elenco de cada
      // clube — proxy simples e determinístico de "quão carente o
      // mercado está em geral", sem inventar nenhuma métrica nova de
      // fora do que necessidadeScore já produz.
      const ids = [CAREER.clubId, ...Object.keys(CAREER.leagueSquads)];
      const vals = ids.map((id) => {
        const squad = squadOf(id);
        const avg = squad.length ? squad.reduce((s, p) => s + p.overall, 0) / squad.length : 60;
        return necessidadeScore({ group: "M", overall: Math.round(avg) }, squad, id);
      });
      return vals.reduce((s, v) => s + v, 0) / vals.length;
    }

    // =========================================================
    // EXPERIMENTO A — JANELA REAL (temporada completa, 2 janelas)
    // =========================================================
    const clubMeta = [];
    const allClubIds = [CAREER.clubId, ...Object.keys(CAREER.leagueSquads)];
    allClubIds.forEach((clubId) => clubMeta.push({ id: String(clubId), name: teamById(clubId).name, division: divisionOf(clubId) }));

    // Réplicas independentes da MESMA temporada (22 rounds, 2 janelas
    // de mercado) — uma temporada só dá ~6 rounds de mercado ativo,
    // insuficiente pra qualquer estatística; N_REPLAYS réplicas
    // (restaurando o estado entre cada uma) acumulam uma amostra real
    // de eventos SEQUENCIAIS (timing/cascata de verdade), sem
    // reimplementar nada — cada réplica chama exatamente
    // simulateAiTransfers/maybeGenerateOffer/resolvePendingOffersOutRound/
    // resolvePendingListingsRound, a mesma sequência de finishRoundTail.
    const N_REPLAYS = 400;
    const snapshot = {
      leagueSquads: JSON.parse(JSON.stringify(CAREER.leagueSquads)),
      squad: JSON.parse(JSON.stringify(CAREER.squad)),
      finances: JSON.parse(JSON.stringify(CAREER.finances)),
      lineup: JSON.parse(JSON.stringify(CAREER.lineup)),
      currentRound: CAREER.currentRound,
      transferLog: JSON.parse(JSON.stringify(CAREER.transferLog || [])),
      recentDeclines: JSON.parse(JSON.stringify(CAREER.recentDeclines || [])),
      pendingOffer: CAREER.pendingOffer,
      pendingOffersOut: JSON.parse(JSON.stringify(CAREER.pendingOffersOut || [])),
      pendingListings: JSON.parse(JSON.stringify(CAREER.pendingListings || [])),
    };
    function restoreSnapshot() {
      CAREER.leagueSquads = JSON.parse(JSON.stringify(snapshot.leagueSquads));
      CAREER.squad = JSON.parse(JSON.stringify(snapshot.squad));
      CAREER.finances = JSON.parse(JSON.stringify(snapshot.finances));
      CAREER.lineup = JSON.parse(JSON.stringify(snapshot.lineup));
      CAREER.transferLog = JSON.parse(JSON.stringify(snapshot.transferLog));
      CAREER.recentDeclines = JSON.parse(JSON.stringify(snapshot.recentDeclines));
      CAREER.pendingOffer = snapshot.pendingOffer;
      CAREER.pendingOffersOut = JSON.parse(JSON.stringify(snapshot.pendingOffersOut));
      CAREER.pendingListings = JSON.parse(JSON.stringify(snapshot.pendingListings));
    }

    const eventsA = []; // toda transferência/oferta real observada, em TODAS as réplicas
    const purchasesByClub = {}; // clubId -> {count, spend}
    const salesByClub = {}; // clubId -> {count, revenue}
    const activityByRound = {}; // round -> contagem de eventos
    const activityByBucket = { "0-25": 0, "25-50": 0, "50-75": 0, "75-100": 0 };
    const necessidadeInicialPerReplay = [];
    const necessidadeFinalPerReplay = [];
    const eventsPerReplay = [];

    function bucketOfRound(round) {
      const win = TRANSFER_WINDOWS.find(([o, c]) => round >= o && round <= c);
      if (!win) return null;
      const [open, close] = win;
      const progress = (round - open) / Math.max(close - open, 1);
      if (progress < 0.25) return "0-25";
      if (progress < 0.5) return "25-50";
      if (progress < 0.75) return "50-75";
      return "75-100";
    }
    function recordTransferEvent(replay, round, kind, buyerId, sellerId, value) {
      eventsA.push({ replay, round, kind, buyerId: String(buyerId), sellerId: String(sellerId), value });
      activityByRound[round] = (activityByRound[round] || 0) + 1;
      const bucket = bucketOfRound(round);
      if (bucket) activityByBucket[bucket]++;
      purchasesByClub[buyerId] = purchasesByClub[buyerId] || { count: 0, spend: 0 };
      purchasesByClub[buyerId].count++; purchasesByClub[buyerId].spend += value;
      salesByClub[sellerId] = salesByClub[sellerId] || { count: 0, revenue: 0 };
      salesByClub[sellerId].count++; salesByClub[sellerId].revenue += value;
    }

    const namesByClub = {};
    clubMeta.forEach((c) => { namesByClub[c.name] = c.id; });
    function replayTransferLogSince(replay, sizeBefore, round) {
      const list = CAREER.transferLog || [];
      const added = list.slice(0, list.length - sizeBefore); // unshift -> novos ficam no início
      added.forEach((entry) => {
        // fmtBRL: toLocaleString("pt-BR", {style:"currency", currency:"BRL",
        // maximumFractionDigits:0}) -> "R$ 5.685.000" (sem decimais,
        // "." como separador de milhar) — nunca vírgula.
        const m = /^(.+?) contratou .+ do (.+?) por R\$\s?([\d.]+)\.$/.exec(entry.text);
        if (!m) return;
        const toName = m[1], fromName = m[2];
        const toId = namesByClub[toName], fromId = namesByClub[fromName];
        if (!toId || !fromId) return;
        const value = Number(m[3].replace(/\./g, ""));
        recordTransferEvent(replay, round, "cpu_x_cpu", toId, fromId, value);
      });
    }

    for (let replay = 0; replay < N_REPLAYS; replay++) {
      restoreSnapshot();
      const necInicial = necessidadeMediaMercado();
      let eventsBefore = eventsA.length;
      for (let round = 1; round <= 22; round++) {
        const win = transferWindowStatus(round);
        if (win.open) {
          const sizeBefore = (CAREER.transferLog || []).length;
          simulateAiTransfers(round);
          replayTransferLogSince(replay, sizeBefore, round);
          // maybeGenerateOffer só GERA a pendingOffer (o técnico
          // decidiria aceitar/recusar) — registramos o nascimento como
          // atividade da IA e simulamos aceite imediato só pra manter
          // o ciclo de reação-a-venda seguindo (o efeito cascata de
          // verdade precisa que a venda realmente aconteça, não fica
          // parado esperando um humano clicar).
          CAREER.pendingOffer = null;
          maybeGenerateOffer(round);
          if (CAREER.pendingOffer) {
            const offer = CAREER.pendingOffer;
            const p = CAREER.squad.find((x) => x.id === offer.playerId);
            if (p) {
              CAREER.finances.cash += offer.fee;
              CAREER.squad = CAREER.squad.filter((x) => x.id !== p.id);
              CAREER.lineup.starters = CAREER.lineup.starters.map((x) => (x === p.id ? null : x));
              CAREER.lineup.bench = (CAREER.lineup.bench || []).filter((x) => x !== p.id);
              (CAREER.leagueSquads[offer.clubId] = CAREER.leagueSquads[offer.clubId] || []).push(p);
              recordTransferEvent(replay, round, "cpu_buys_from_me", offer.clubId, CAREER.clubId, offer.fee);
            }
            CAREER.pendingOffer = null;
          }
        }
        resolvePendingOffersOutRound(round);
        resolvePendingListingsRound();
        CAREER.currentRound = round;
      }
      necessidadeInicialPerReplay.push(necInicial);
      necessidadeFinalPerReplay.push(necessidadeMediaMercado());
      eventsPerReplay.push(eventsA.length - eventsBefore);
    }
    restoreSnapshot(); // devolve o estado original antes do Experimento B usar a população real

    // =========================================================
    // EXPERIMENTO B — AMOSTRA AMPLA (10.000+, round variando)
    // =========================================================
    const population = [];
    allClubIds.forEach((clubId) => squadOf(clubId).forEach((p) => population.push({ player: p, ownerClubId: String(clubId), ownerDivision: divisionOf(clubId) })));
    function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    const ROUND_POSITIONS = [1, 2, 3, 20, 21, 22];

    const clubBudgets = clubMeta.map((c) => ({ ...c, squadSize: squadOf(c.id).length, ...clubBudgetProxy(c.id) }));

    const recordsB = [];
    for (let i = 0; i < N_BROAD; i++) {
      const target = pickRandom(population);
      const p = target.player;
      const buyerMeta = pickRandom(clubMeta.filter((c) => c.id !== target.ownerClubId));
      const buyerId = buyerMeta.id;
      const round = pickRandom(ROUND_POSITIONS);
      const buyerSquad = squadOf(buyerId);
      const hasSpace = buyerSquad.length < maxSquadSizeFor(buyerId);
      const fin = hasSpace ? financeiroScore(p, buyerSquad, buyerId) : 0;
      if (!hasSpace || fin <= 0) { recordsB.push({ eligible: false }); continue; }
      const score = transferScore(p, buyerId);
      const necessidade = necessidadeScore(p, buyerSquad, buyerId);
      const prob = offerProbabilityFromScore(score);
      const urgency = urgencyMultiplier(necessidade, round);
      const declined = wasRecentlyDeclined(p.id, buyerId, round);
      const roll = Math.random();
      const wouldOfferWithoutUrgency = roll < prob;
      const offeredGate = !declined && roll < prob * urgency;
      let deal = null;
      if (offeredGate) deal = negotiateOffer(p, buyerId, target.ownerClubId);
      const bucket = bucketOfRound(round);
      recordsB.push({
        eligible: true, playerId: p.id, ownerClubId: target.ownerClubId, ownerDivision: target.ownerDivision,
        buyerId, buyerDivision: buyerMeta.division, round, bucket, overall: p.overall, baseValue: p.value, group: p.group,
        financeiro: fin, necessidade, score, prob, urgency, declined,
        offeredGate, urgencyFlippedDecision: wouldOfferWithoutUrgency !== offeredGate && !declined,
        outcome: deal ? deal.outcome : null, finalValue: deal && deal.outcome === "accepted" ? deal.finalValue : null, rounds: deal ? deal.rounds : null,
      });
    }

    return {
      experimentA: {
        nReplays: N_REPLAYS, events: eventsA, purchasesByClub, salesByClub,
        necessidadeInicialPerReplay, necessidadeFinalPerReplay, eventsPerReplay,
        activityByRound, activityByBucket,
      },
      experimentB: { records: recordsB, populationSize: population.length },
      clubMeta, clubBudgets,
    };
  }, { N_BROAD });

  fs.writeFileSync("/tmp/claude-0/-home-user-FitOS/5759b827-dada-5ced-a576-23cb7d1511d8/scratchpad/market_dynamics_raw.json", JSON.stringify(result));
  console.log(`Simulação concluída. Experimento A: ${result.experimentA.events.length} eventos reais numa temporada completa (22 rounds, 2 janelas). Experimento B: ${result.experimentB.records.length} pares amplos.`);
  console.log("Dados salvos em /tmp/.../scratchpad/market_dynamics_raw.json");
  await browser.close();
  console.log("OK");
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
