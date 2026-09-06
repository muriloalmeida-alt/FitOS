const { chromium } = require("playwright-core");

async function newCareer(page, base, email) {
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Premiacoes Test", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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
async function getCareer(page) {
  return page.evaluate(async () => (await (await fetch("/api/career")).json()).career);
}
async function putCareer(page, career) {
  await page.evaluate(async (career) => {
    await fetch("/api/career", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(career) });
  }, career);
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
  await newCareer(page, base, `premios${Date.now()}@teste.com`);

  const result = await page.evaluate(async () => {
    const teamIds = Object.keys(CAREER.leagueSquads);
    const [teamA, teamB, teamC] = teamIds;

    // Monta um cenário controlado: teamA lidera (campeão), teamB é
    // vice, meu jogador titular vira artilheiro/assistências/melhor
    // do torneio (com menos jogos que um "concorrente" empatado, pra
    // provar o desempate), Copa do Brasil "feita" com teamC campeão.
    Object.values(CAREER.standings).forEach((s, i) => { s.pts = 50 - i; s.v = 10; s.sg = 5; s.gp = 20; });
    CAREER.standings[teamA].pts = 99;
    CAREER.standings[teamB].pts = 90;

    const myPlayer = CAREER.squad.find((p) => p.origin === "principal");
    myPlayer.goalsSeason = 25; myPlayer.assistsSeason = 15; myPlayer.overall = 99; myPlayer.apps = 30;
    // "Concorrente" empatado em tudo, mas com MAIS jogos (deve perder
    // o desempate pro meu jogador, que tem menos apps).
    const rivalSquad = CAREER.leagueSquads[teamB];
    const rival = rivalSquad[0];
    rival.goalsSeason = 25; rival.assistsSeason = 15; rival.overall = 99; rival.apps = 34;

    CAREER.cup = CAREER.cup || {};
    CAREER.cup.active = true;
    CAREER.cup.phase = "done";
    CAREER.cup.champion = teamC;
    CAREER.cup.ties = CAREER.cup.ties || {};
    CAREER.cup.ties.final = [{ home: teamC, away: teamA, winner: teamC }];

    const moraleBefore = myPlayer.morale;
    CAREER.currentRound = 39;
    const summary = await advanceSeason();
    const award = CAREER.seasonAwards[0];
    const myPlayerAfter = CAREER.squad.find((p) => p.id === myPlayer.id);

    return {
      dismissed: summary.dismissed,
      campeao: award.brasileirao.campeao,
      vice: award.brasileirao.vice,
      teamA, teamB, teamC,
      artilheiro: award.brasileirao.artilheiro,
      assistencias: award.brasileirao.assistencias,
      melhorJogador: award.brasileirao.melhorJogador,
      myPlayerId: myPlayer.id,
      copaDoBrasil: award.copaDoBrasil,
      moraleBefore, moraleAfter: myPlayerAfter ? myPlayerAfter.morale : null,
      goalsSeasonReset: myPlayerAfter ? myPlayerAfter.goalsSeason : "jogador não encontrado (saiu por fim de contrato)",
    };
  });

  console.log("1) Campeão/vice corretos:", result.campeao === result.teamA, result.vice === result.teamB);
  console.log("2) Artilheiro é o MEU jogador (desempate por menos jogos):", result.artilheiro && result.artilheiro.jogadorId === result.myPlayerId, "| gols:", result.artilheiro && result.artilheiro.valor);
  console.log("3) Mais assistências é o MEU jogador:", result.assistencias && result.assistencias.jogadorId === result.myPlayerId);
  console.log("4) Melhor do torneio é o MEU jogador:", result.melhorJogador && result.melhorJogador.jogadorId === result.myPlayerId);
  console.log("5) Copa do Brasil disputada com campeão certo:", result.copaDoBrasil.disputou && result.copaDoBrasil.campeao === result.teamC);
  console.log("6) Moral do jogador premiado subiu:", result.moraleAfter > result.moraleBefore, `(${result.moraleBefore} -> ${result.moraleAfter})`);
  console.log("7) goalsSeason zerou na virada de temporada:", result.goalsSeasonReset === 0);

  // 8) Tela de premiações (menu ≡) mostra a temporada com destaque
  // dourado pro que é meu.
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(200);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='progresso']");
  await page.click("#btnOpenAwards");
  await page.waitForSelector("#awardsOverlay.open");
  await page.waitForTimeout(200);
  const awardsText = await page.evaluate(() => document.getElementById("awardsList").textContent);
  // AJUSTE (design novo, ver renderAwardsScreen): destaque dourado
  // agora é classe CSS (.mine / .champion / .ribbon), não mais style
  // inline — checa pelas classes novas em vez do seletor antigo.
  const hasGold = await page.evaluate(() => !!document.querySelector("#awardsList .champion, #awardsList .mine, #awardsList .ribbon"));
  console.log("8) Tela de premiações mostra Campeão/Artilheiro/Copa do Brasil:", awardsText.includes("Campeão") && awardsText.includes("Artilheiro") && awardsText.includes("Copa do Brasil"), "| tem destaque dourado:", hasGold);
  await page.click("#awardsClose");
  await page.waitForTimeout(200);

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
