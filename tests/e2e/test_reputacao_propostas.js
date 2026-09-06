const { chromium } = require("playwright-core");

async function newCareer(page, base, email) {
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Reputacao Test", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(200);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
    args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("fonts.googleapis") && !m.text().includes("fundingchoices")) console.log("CONSOLE ERROR:", m.text()); });

  const base = "http://localhost:8787";
  await newCareer(page, base, `rep${Date.now()}@teste.com`);

  const r1 = await page.evaluate(() => {
    const out = {};
    out.repStarts50 = CAREER.reputation === 50;
    out.historyEmpty = (CAREER.clubHistory || []).length === 0;

    // 1) Meta batida sobe reputação; meta não batida desce.
    const before = CAREER.reputation;
    const awardNoTitle = { seasonYear: 1, brasileirao: { campeao: "outro", vice: null, artilheiro: null, assistencias: null, melhorJogador: null }, copaDoBrasil: { disputou: false, campeao: null, vice: null } };
    applySeasonReputationDelta(true, awardNoTitle);
    out.metaBatidaSobe = CAREER.reputation > before;
    const afterMet = CAREER.reputation;
    applySeasonReputationDelta(false, awardNoTitle);
    out.metaNaoBatidaDesce = CAREER.reputation < afterMet;

    // 2) Título soma reputação.
    CAREER.reputation = 50;
    const awardWithTitle = { seasonYear: 1, brasileirao: { campeao: CAREER.clubId, vice: null, artilheiro: null, assistencias: null, melhorJogador: null }, copaDoBrasil: { disputou: true, campeao: CAREER.clubId, vice: "outro" } };
    applySeasonReputationDelta(true, awardWithTitle); // meta batida + 2 títulos (Brasileirão + Copa)
    out.doisTitulosSomamMais = CAREER.reputation > (50 + 14 * 0.5); // mais do que só a meta sozinha renderia

    return out;
  });
  console.log("1) Reputação nasce em 50, sem currículo:", r1.repStarts50, r1.historyEmpty);
  console.log("2) Meta batida sobe / não batida desce:", r1.metaBatidaSobe, r1.metaNaoBatidaDesce);
  console.log("3) Títulos somam reputação além da meta sozinha:", r1.doisTitulosSomamMais);

  // 4) endCurrentClubStint registra no currículo e aplica penalidade de
  // demissão; TECHNICIAN_CARRY é consumido por startCareer() na
  // próxima carreira (reputação carrega, histórico também).
  const r2 = await page.evaluate(() => {
    CAREER.reputation = 60;
    CAREER.seasonHistory = [{ year: 1, position: 3 }, { year: 2, position: 5 }];
    CAREER.seasonAwards = [{ seasonYear: 2, brasileirao: { campeao: null }, copaDoBrasil: { disputou: false } }, { seasonYear: 1, brasileirao: { campeao: CAREER.clubId }, copaDoBrasil: { disputou: false } }];
    const prevClubName = CAREER.clubName;
    endCurrentClubStint("dismissed");
    return {
      carryReputation: TECHNICIAN_CARRY.reputation,
      carryHistoryLen: TECHNICIAN_CARRY.clubHistory.length,
      firstEntry: TECHNICIAN_CARRY.clubHistory[0],
      prevClubName,
    };
  });
  console.log("4) Demissão registra no currículo (1 entrada) com reason='dismissed':", r2.carryHistoryLen === 1 && r2.firstEntry.reason === "dismissed");
  console.log("   Penalidade de demissão aplicada (60 -> 35):", r2.carryReputation === 35);
  console.log("   Currículo tem 2 temporadas, 1 título, posição média 4:", r2.firstEntry.seasons === 2 && r2.firstEntry.titles === 1 && r2.firstEntry.avgPosition === 4);
  console.log("   Nome do clube anterior registrado:", r2.firstEntry.clubName === r2.prevClubName);

  // 5) startCareer() consome TECHNICIAN_CARRY -- reputação e currículo
  // sobrevivem à troca de "clube" (aqui simulada chamando startCareer
  // direto, sem passar pela tela, já que TECHNICIAN_CARRY já foi
  // deixado setado pelo passo anterior).
  const clubIds = await page.evaluate(() => LEAGUE_TEAMS.map((t) => String(t.id)));
  const otherClub = await page.evaluate((myId) => LEAGUE_TEAMS.map((t) => String(t.id)).find((id) => id !== String(myId)), await page.evaluate(() => CAREER.clubId));
  const r3 = await page.evaluate(async (otherClub) => {
    await startCareer(otherClub);
    return { reputation: CAREER.reputation, historyLen: (CAREER.clubHistory || []).length, carryCleared: TECHNICIAN_CARRY === null, clubId: CAREER.clubId };
  }, otherClub);
  console.log("5) Reputação sobrevive à troca de clube (35):", r3.reputation === 35, "| currículo com 1 entrada anterior:", r3.historyLen === 1);
  console.log("   TECHNICIAN_CARRY consumido/limpo:", r3.carryCleared, "| clube realmente trocou:", r3.clubId === otherClub);

  // 6) "Reiniciar" (via UI de verdade) NÃO carrega reputação -- nasce
  // limpo de novo (50, sem currículo).
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#btnRestart");
  await page.waitForTimeout(200);
  await page.click("#confirmOkBtn");
  await page.waitForTimeout(400);
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(200);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
  const r4 = await page.evaluate(() => ({ reputation: CAREER.reputation, historyLen: (CAREER.clubHistory || []).length }));
  console.log("6) 'Reiniciar' não carrega reputação (nasce 50, sem currículo):", r4.reputation === 50 && r4.historyLen === 0);

  // 7) maybeGenerateClubProposals gera proposta quando reputação bate o
  // patamar de um clube mais forte; some quando reputação é baixa.
  const r5 = await page.evaluate(() => {
    CAREER.clubProposals = [];
    CAREER.reputation = 5; // baixa demais pra qualquer proposta
    maybeGenerateClubProposals();
    const semProposta = (CAREER.clubProposals || []).length === 0;
    // Garante um gap de força real: derruba o overall do MEU elenco
    // principal bem abaixo de qualquer outro clube da liga, pra não
    // depender de qual clube saiu sorteado no teste.
    CAREER.squad.filter((p) => p.origin === "principal").forEach((p) => { p.overall = 30; });
    CAREER.reputation = 99; // alta o bastante pra qualquer clube mais forte
    maybeGenerateClubProposals();
    const comProposta = (CAREER.clubProposals || []).length > 0;
    // Não empilha 2ª proposta em cima da 1ª já pendente.
    maybeGenerateClubProposals();
    const naoEmpilha = (CAREER.clubProposals || []).length === 1;
    // maybeGenerateClubProposals() só mexe em CAREER -- quem decide se
    // o card aparece é renderCentral() (chamada em todo lugar que MUDA
    // esse estado de verdade no app; aqui é uma injeção direta via
    // evaluate, então precisa da mesma chamada manualmente).
    renderCentral();
    return { semProposta, comProposta, naoEmpilha, proposal: CAREER.clubProposals[0] };
  });
  console.log("7) Reputação baixa não gera proposta / alta gera:", r5.semProposta, r5.comProposta);
  console.log("   Não empilha 2ª proposta em cima da pendente:", r5.naoEmpilha);
  console.log("   Proposta tem clube/orçamento plausíveis:", !!r5.proposal.clubName && r5.proposal.budgetOffered > 0);

  // 8) Fluxo real via UI: card na aba Clube aparece (mora lá desde o
  // Bloco 1/4 -- pré-existente, sem relação com o checklist de UX
  // desta etapa), abre a modal, RECUSA (fica no mesmo clube, proposta
  // some).
  await page.click(".m3-nav-item[data-panel='clube']");
  await page.waitForTimeout(300);
  const cardVisible = await page.evaluate(() => document.getElementById("clubProposalCard").style.display !== "none");
  console.log("8) Card de proposta aparece na aba Clube:", cardVisible);
  await page.click("#btnViewClubProposal");
  await page.waitForSelector("#clubProposalOverlay.open");
  await page.waitForTimeout(150);
  const proposalModalText = await page.evaluate(() => document.getElementById("clubProposalText").textContent);
  console.log("   Modal mostra o clube ofertante:", proposalModalText.length > 20);
  await page.click("#btnClubProposalDecline");
  await page.waitForTimeout(300);
  const afterDecline = await page.evaluate(() => ({ pending: (CAREER.clubProposals || []).length, cardHidden: document.getElementById("clubProposalCard").style.display === "none" }));
  console.log("   Recusar remove a proposta e some o card:", afterDecline.pending === 0 && afterDecline.cardHidden);

  // 9) Fluxo real via UI: gera proposta de novo, ACEITA -- vai pra tela
  // de escolha de clube filtrada só no ofertante, com banner de
  // contexto, e o clique completa a troca.
  const clubBefore = await page.evaluate(() => {
    CAREER.clubProposals = [];
    CAREER.squad.filter((p) => p.origin === "principal").forEach((p) => { p.overall = 30; });
    CAREER.reputation = 99;
    maybeGenerateClubProposals();
    persistCareer();
    renderCentral();
    return { clubId: CAREER.clubId, clubName: CAREER.clubName, proposalClub: CAREER.clubProposals[0].clubName };
  });
  await page.click(".m3-nav-item[data-panel='clube']").catch(() => {});
  await page.waitForTimeout(300);
  await page.click("#btnViewClubProposal");
  await page.waitForSelector("#clubProposalOverlay.open");
  await page.waitForTimeout(150);
  await page.click("#btnClubProposalAccept");
  await page.waitForSelector("#screenPicker:not(.hidden)", { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);
  const pickerState = await page.evaluate(() => ({
    cardCount: document.querySelectorAll("#clubGrid .m3-club-row").length,
    bannerVisible: !document.getElementById("pickerContextBanner").hidden,
    bannerText: document.getElementById("pickerContextBanner").textContent,
  }));
  console.log("9) Tela de escolha reaparece filtrada só no clube ofertante:", pickerState.cardCount === 1);
  console.log("   Banner de contexto visível com o clube anterior:", pickerState.bannerVisible && pickerState.bannerText.includes(clubBefore.clubName));
  await page.click("#clubGrid .m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);
  const finalState = await page.evaluate(() => ({ clubName: CAREER.clubName, historyLen: (CAREER.clubHistory || []).length, lastReason: (CAREER.clubHistory || [])[0] && CAREER.clubHistory[0].reason }));
  console.log("   Clube realmente trocou:", finalState.clubName === clubBefore.proposalClub);
  console.log("   Currículo ganhou entrada com reason='accepted_proposal':", finalState.historyLen >= 1 && finalState.lastReason === "accepted_proposal");

  // 10) Perfil do técnico mostra reputação + currículo.
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='imprensa']");
  await page.click("#btnOpenCoachProfile");
  await page.waitForSelector("#coachProfileOverlay.open");
  await page.waitForTimeout(200);
  const profileText = await page.evaluate(() => document.getElementById("coachProfileBody").textContent);
  console.log("10) Perfil do técnico mostra Reputação e o clube anterior no currículo:", profileText.includes("Reputação") && profileText.includes(clubBefore.clubName));
  await page.click("#coachProfileClose");

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
