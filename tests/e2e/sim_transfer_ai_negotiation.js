// Fase 1.4 — Negotiation AI: simulação estatística (script TEMPORÁRIO,
// não commitado — mesmo padrão de sim_transfer_ai_balance.js das Fases
// 1.3.1/1.3.2). Cria uma carreira real multi-divisão (60 clubes) e
// chama SÓ as funções reais de produção (negotiateOffer, que por sua
// vez chama transferValuation/transferScore/necessidadeScore/
// financeiroScore/calculateSellerReservationValue/
// sellerNegotiationDecision/buyerNegotiationDecision — nada
// reimplementado) sobre uma amostra ampla de pares (jogador dono ×
// clube comprador), registrando o resultado de CADA negociação.
//
// RNG global do jogo (Math.random()), sem seed determinístico — a
// única fonte de não-determinismo é o pequeno nudge de
// sellerNegotiationDecision na faixa perto da reserva (ver
// carreira.js) — documentado aqui como já foi na Fase 1.3.1.
const { chromium } = require("playwright-core");
const fs = require("fs");

const N_SAMPLE = 10000;

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  const base = "http://localhost:8787";
  const email = `negsim14_${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Neg Sim 1.4", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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
  console.log("Carreira real criada (multi-divisão). Rodando simulação de negociação em memória (sem persistir nenhuma mudança)...");

  const result = await page.evaluate((N) => {
    function divisionOf(clubId) {
      const t = ALL_TEAMS_FLAT.find((x) => String(x.id) === String(clubId));
      return t ? t.competitionId : (String(clubId) === String(CAREER.clubId) ? CURRENT_COMPETITION_ID : "?");
    }
    function squadOf(clubId) {
      return String(clubId) === String(CAREER.clubId) ? CAREER.squad.filter((p) => p.origin === "principal") : leagueSquadFor(clubId);
    }
    const population = [];
    const clubMeta = [];
    const allClubIds = [CAREER.clubId, ...Object.keys(CAREER.leagueSquads)];
    allClubIds.forEach((clubId) => {
      clubMeta.push({ id: String(clubId), name: teamById(clubId).name, division: divisionOf(clubId) });
      squadOf(clubId).forEach((p) => population.push({ player: p, ownerClubId: String(clubId), ownerDivision: divisionOf(clubId) }));
    });
    function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    const clubBudgets = clubMeta.map((c) => ({ ...c, squadSize: squadOf(c.id).length, ...clubBudgetProxy(c.id) }));

    const records = [];
    for (let i = 0; i < N; i++) {
      const target = pickRandom(population);
      const p = target.player;
      const buyerMeta = pickRandom(clubMeta.filter((c) => c.id !== target.ownerClubId));
      const buyerId = buyerMeta.id;
      const buyerSquad = squadOf(buyerId);
      const hasSpace = buyerSquad.length < maxSquadSizeFor(buyerId);
      const fin = hasSpace ? financeiroScore(p, buyerSquad, buyerId) : 0;
      if (!hasSpace || fin <= 0) {
        records.push({ eligible: false });
        continue;
      }
      const score = transferScore(p, buyerId);
      const necessidade = necessidadeScore(p, buyerSquad, buyerId);
      const isStarter = target.ownerClubId === CAREER.clubId && (CAREER.lineup.starters || []).includes(p.id);
      const deal = negotiateOffer(p, buyerId, target.ownerClubId);
      records.push({
        eligible: true, playerId: p.id, ownerClubId: target.ownerClubId, ownerDivision: target.ownerDivision,
        mine: target.ownerClubId === CAREER.clubId,
        buyerId, buyerDivision: buyerMeta.division, overall: p.overall, potential: p.potential, age: p.age,
        baseValue: p.value, group: p.group, isStarter, financeiro: fin, necessidade, score,
        outcome: deal.outcome, initialOffer: deal.initialOffer, reservation: deal.reservation, finalValue: deal.finalValue, rounds: deal.rounds,
      });
    }
    return { records, clubMeta, clubBudgets, populationSize: population.length, myClubId: String(CAREER.clubId) };
  }, N_SAMPLE);

  fs.writeFileSync("/tmp/claude-0/-home-user-FitOS/5759b827-dada-5ced-a576-23cb7d1511d8/scratchpad/negotiation_sim_raw.json", JSON.stringify(result));
  console.log(`Simulação concluída. Amostra: ${result.records.length} pares. Dados salvos em /tmp/.../scratchpad/negotiation_sim_raw.json`);
  await browser.close();
  console.log("OK");
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
