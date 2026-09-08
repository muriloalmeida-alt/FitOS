// FASE 1.3.1 — Balance Check do Transfer AI. Script de simulação
// TEMPORÁRIO (auditoria estatística, não faz parte da suíte de
// regressão permanente, não é comitado). Roda a pipeline REAL
// (transferScore -> offerProbabilityFromScore -> transferValuation) em
// escala, usando SEMPRE as funções de produção já implementadas (zero
// reimplementação de fórmula) contra a população real do mercado
// (60 clubes reais, 3 divisões, elenco real de cada um).
//
// Não altera nenhum arquivo de produção — só lê o estado em memória do
// app (CAREER/ALL_TEAMS_FLAT/leagueSquads) dentro do browser e devolve
// os dados coletados pro Node, que faz toda a agregação estatística
// aqui fora (percentis, tabelas, cortes) sem tocar em carreira.js.
//
// Metodologia (ver seção 2 do relatório final para a versão completa):
//   EXPERIMENTO A — chama os 3 wrappers de produção de verdade
//     (maybeGenerateOffer/maybeSpawnListingOffer/maybeSpawnRivalOffer),
//     exatamente como o jogo chamaria, incluindo as janelas de
//     exposição (OFFER_CHANCE_PER_ROUND etc.) — mede volume/frequência
//     real de ofertas. maybeGenerateOffer/maybeSpawnListingOffer só
//     têm o SEU clube como vendedor (limitação estrutural das próprias
//     funções, não da metodologia); maybeSpawnRivalOffer varia o
//     vendedor por toda a população de 60 clubes.
//   EXPERIMENTO B — amostra ampla (jogador real x clube comprador real)
//     de toda a população de 60 clubes/~1300+ jogadores, chamando
//     DIRETAMENTE as mesmas funções puras de produção
//     (financeiroScore -> transferScore -> offerProbabilityFromScore
//     -> Math.random() -> transferValuation) — a mesma pipeline exata
//     dos 3 wrappers, só que sem a restrição de vendedor ser sempre o
//     mesmo clube. É o dataset principal pras seções 4-14 do relatório.
//   EXPERIMENTO C — comparações controladas (seção 14: mesmo jogador,
//     só necessidade/interesse/idade variando).
const { chromium } = require("playwright-core");
const fs = require("fs");

const N_BROAD = 10000; // Experimento B
const N_WRAPPER = 3000; // Experimento A, por função

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `balancecheck${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Balance Check", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  console.log("Carreira real criada (multi-divisão). Rodando simulação em memória (sem persistir nenhuma mudança)...");

  const result = await page.evaluate(({ N_BROAD, N_WRAPPER }) => {
    CAREER.currentRound = 2; // dentro da janela de transferências (rodadas 1-3)

    // ---------- Monta a população real completa: todo jogador de
    // todos os 60 clubes (o seu + os 59 outros), cada um marcado com o
    // clube dono e a divisão de verdade. ----------
    function divisionOf(clubId) {
      if (isOwnDivisionTeam(clubId)) return CURRENT_COMPETITION_ID;
      const t = teamById(clubId);
      return t.competitionId || "desconhecida";
    }
    const allClubIds = [CAREER.clubId, ...Object.keys(CAREER.leagueSquads)];
    const population = [];
    allClubIds.forEach((clubId) => {
      const squad = clubId === CAREER.clubId ? CAREER.squad.filter((p) => p.origin === "principal") : leagueSquadFor(clubId);
      squad.forEach((p) => population.push({ player: p, ownerClubId: String(clubId), ownerDivision: divisionOf(clubId) }));
    });
    const clubMeta = allClubIds.map((id) => ({ id: String(id), name: teamById(id).name, division: divisionOf(id) }));

    function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    // ---------- EXPERIMENTO B — amostra ampla, chamando a MESMA
    // pipeline real (financeiroScore -> transferScore ->
    // offerProbabilityFromScore -> Math.random() -> transferValuation)
    // usada de verdade dentro dos 3 wrappers de produção. ----------
    const broad = [];
    for (let i = 0; i < N_BROAD; i++) {
      const target = pickRandom(population);
      const p = target.player;
      const buyerMeta = pickRandom(clubMeta.filter((c) => c.id !== target.ownerClubId));
      const buyerId = buyerMeta.id;
      const buyerSquad = buyerId === CAREER.clubId ? CAREER.squad.filter((x) => x.origin === "principal") : leagueSquadFor(buyerId);
      // Elegibilidade EXATA usada pelos 3 wrappers antes de pontuar.
      const hasSpace = buyerSquad.length < maxSquadSizeFor(buyerId);
      const fin = hasSpace ? financeiroScore(p, buyerSquad, buyerId) : 0;
      if (!hasSpace || fin <= 0) {
        broad.push({ eligible: false, playerId: p.id, ownerClubId: target.ownerClubId, ownerDivision: target.ownerDivision, buyerId, buyerDivision: buyerMeta.division, overall: p.overall, potential: p.potential, age: p.age, baseValue: p.value, contractUntil: p.contractUntil, group: p.group, financeiro: fin });
        continue;
      }
      const score = transferScore(p, buyerId);
      const necessidade = necessidadeScore(p, buyerSquad);
      const contexto = contextoScore(p, buyerSquad, buyerId);
      const prob = offerProbabilityFromScore(score);
      const roll = Math.random();
      const offered = roll < prob;
      const isStarter = target.ownerClubId === CAREER.clubId && (CAREER.lineup.starters || []).includes(p.id);
      let offerValue = null, ratio = null;
      if (offered) {
        offerValue = transferValuation(p, buyerId, target.ownerClubId);
        ratio = offerValue / p.value;
      }
      broad.push({
        eligible: true, playerId: p.id, playerName: p.name, ownerClubId: target.ownerClubId, ownerDivision: target.ownerDivision,
        buyerId, buyerName: buyerMeta.name, buyerDivision: buyerMeta.division,
        overall: p.overall, potential: p.potential, age: p.age, baseValue: p.value, wage: p.wage, contractUntil: p.contractUntil, group: p.group,
        isStarter, financeiro: fin, necessidade, contexto, score, prob, offered, offerValue, ratio,
      });
    }

    // ---------- EXPERIMENTO A — os 3 wrappers de produção de verdade,
    // sem reimplementar nada, N_WRAPPER tentativas cada. ----------
    // A.1 — maybeGenerateOffer (vendedor = sempre o seu clube).
    const wrapperGenerate = [];
    for (let i = 0; i < N_WRAPPER; i++) {
      CAREER.pendingOffer = null;
      maybeGenerateOffer(CAREER.currentRound);
      if (CAREER.pendingOffer) {
        const o = CAREER.pendingOffer;
        const p = CAREER.squad.find((x) => x.id === o.playerId);
        wrapperGenerate.push({ offered: true, playerId: o.playerId, buyerId: o.clubId, fee: o.fee, baseValue: p ? p.value : null, ratio: p ? o.fee / p.value : null });
      } else {
        wrapperGenerate.push({ offered: false });
      }
    }
    CAREER.pendingOffer = null;

    // A.2 — maybeSpawnListingOffer (vendedor = sempre o seu clube;
    // gira entre todos os seus jogadores principais pra variar).
    const wrapperListing = [];
    const myPrincipal = CAREER.squad.filter((p) => p.origin === "principal");
    for (let i = 0; i < N_WRAPPER; i++) {
      const p = myPrincipal[i % myPrincipal.length];
      const listing = { playerId: p.id, playerName: p.name, askingValue: p.value, marketValue: p.value, listedRound: CAREER.currentRound, offers: [] };
      maybeSpawnListingOffer(listing);
      if (listing.offers.length) {
        const o = listing.offers[0];
        wrapperListing.push({ offered: true, playerId: p.id, buyerId: o.clubId, value: o.value, baseValue: p.value, ratio: o.value / p.value });
      } else {
        wrapperListing.push({ offered: false });
      }
    }

    // A.3 — maybeSpawnRivalOffer (vendedor varia por TODA a população —
    // sorteia um jogador real de um clube CPU qualquer a cada
    // tentativa, cria uma "proposta em andamento" fictícia pra esse
    // jogador só pra a função ter o que disputar).
    const wrapperRival = [];
    const cpuOwned = population.filter((x) => x.ownerClubId !== CAREER.clubId);
    for (let i = 0; i < N_WRAPPER; i++) {
      const target = pickRandom(cpuOwned);
      const p = target.player;
      const o = { playerId: p.id, playerName: p.name, clubId: target.ownerClubId, marketValue: p.value, offerValue: Math.round(p.value * 0.9), installments: 1, roundsLeft: 2, status: "pending", counterValue: null, rivalOffer: null };
      maybeSpawnRivalOffer(o);
      if (o.rivalOffer) {
        wrapperRival.push({ offered: true, playerId: p.id, ownerClubId: target.ownerClubId, ownerDivision: target.ownerDivision, buyerId: o.rivalOffer.clubId, offerValue: o.rivalOffer.offerValue, baseValue: p.value, ratio: o.rivalOffer.offerValue / p.value });
      } else {
        wrapperRival.push({ offered: false });
      }
    }

    // ---------- EXPERIMENTO C — comparações controladas (seção 14).
    // Usa clubes/jogadores REAIS da população, escolhidos pra
    // contrastar exatamente 1 variável por vez. ----------
    function fabricateSquadLike(n, avgOverall, forwards) {
      // Só pra ISOLAR necessidade/interesse com o resto controlado —
      // ainda chama as MESMAS funções de produção depois, não
      // reimplementa nada. Documentado no relatório como cenário
      // controlado, não população real.
      const squad = [];
      for (let i = 0; i < n; i++) {
        const cf = computeContractFields(avgOverall, 26, null, () => 0.5);
        squad.push({ group: i < forwards ? "F" : "D", overall: avgOverall, wage: cf.wage, value: cf.value, origin: "principal" });
      }
      return squad;
    }
    const controlled = {};
    {
      const backup = JSON.parse(JSON.stringify(CAREER.leagueSquads));
      const cf = computeContractFields(74, 26, 78, () => 0.5);
      const player = { id: "ctrl_p", name: "Jogador de Controle", group: "F", overall: 74, age: 26, potential: 78, wage: cf.wage, value: cf.value, contractUntil: CAREER.seasonYear + 2 };

      // A/B — necessidade baixa vs alta (mesmo overall médio de clube).
      const lowNeedId = "ctrl_lowneed", highNeedId = "ctrl_highneed";
      CAREER.leagueSquads[lowNeedId] = fabricateSquadLike(18, 74, 8);   // bem servido
      CAREER.leagueSquads[highNeedId] = fabricateSquadLike(18, 74, 0); // carente
      controlled.necessidade = {
        low: { score: transferScore(player, lowNeedId), value: transferValuation(player, lowNeedId, "cpu_x") },
        high: { score: transferScore(player, highNeedId), value: transferValuation(player, highNeedId, "cpu_x") },
      };

      // C/D — interesse baixo vs alto (necessidade igual, overall do
      // clube muda pra afetar adequação/contexto, não necessidade).
      const lowFitId = "ctrl_lowfit", highFitId = "ctrl_highfit";
      CAREER.leagueSquads[lowFitId] = fabricateSquadLike(18, 96, 2);
      CAREER.leagueSquads[highFitId] = fabricateSquadLike(18, 66, 2);
      controlled.interesse = {
        low: { score: transferScore(player, lowFitId), value: transferValuation(player, lowFitId, "cpu_x") },
        high: { score: transferScore(player, highFitId), value: transferValuation(player, highFitId, "cpu_x") },
      };

      // E/F — jovem vs veterano equivalente (mesmo overall/potencial/
      // contrato, mesmo clube comprador neutro).
      const neutralId = "ctrl_neutral";
      CAREER.leagueSquads[neutralId] = fabricateSquadLike(18, 74, 2);
      const young = { ...player, id: "ctrl_young", age: 21 };
      const veteran = { ...player, id: "ctrl_vet", age: 32 };
      controlled.idade = {
        jovem21: { baseValue: computeContractFields(74, 21, 78, () => 0.5).value, value: transferValuation({ ...young, value: computeContractFields(74, 21, 78, () => 0.5).value }, neutralId, "cpu_x") },
        veterano32: { baseValue: computeContractFields(74, 32, 78, () => 0.5).value, value: transferValuation({ ...veteran, value: computeContractFields(74, 32, 78, () => 0.5).value }, neutralId, "cpu_x") },
      };

      delete CAREER.leagueSquads[lowNeedId]; delete CAREER.leagueSquads[highNeedId];
      delete CAREER.leagueSquads[lowFitId]; delete CAREER.leagueSquads[highFitId];
      delete CAREER.leagueSquads[neutralId];
      CAREER.leagueSquads = backup;
    }

    // ---------- Metadados de orçamento por clube (pra seção 10) ----------
    const clubBudgets = clubMeta.map((c) => {
      const squad = c.id === CAREER.clubId ? CAREER.squad.filter((p) => p.origin === "principal") : leagueSquadFor(c.id);
      const b = clubBudgetProxy(c.id);
      return { id: c.id, name: c.name, division: c.division, squadSize: squad.length, cash: b.cash, wageCap: b.wageCap };
    });

    return {
      populationSize: population.length,
      clubCount: clubMeta.length,
      clubMeta,
      clubBudgets,
      broad,
      wrapperGenerate,
      wrapperListing,
      wrapperRival,
      controlled,
    };
  }, { N_BROAD, N_WRAPPER });

  fs.writeFileSync("/tmp/claude-0/-home-user-FitOS/5759b827-dada-5ced-a576-23cb7d1511d8/scratchpad/transfer_ai_balance_raw.json", JSON.stringify(result));
  console.log(`Simulação concluída. Amostra ampla: ${result.broad.length} pares. Wrappers: ${N_WRAPPER} tentativas cada. Dados salvos em /tmp/.../scratchpad/transfer_ai_balance_raw.json`);

  await browser.close();
  console.log("OK");
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
