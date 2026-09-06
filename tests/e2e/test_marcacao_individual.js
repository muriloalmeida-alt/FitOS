// Nova feature — Marcação individual: escalar um jogador seu pra
// marcar um jogador específico do rival, com efeito REAL (reduz o peso
// de sorteio dele na simulação, nunca zera de vez).
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `marcacao${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Marcacao Individual", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  // 1) Abrir pelo Menu -> mostra o próximo adversário, meus titulares e
  // os 5 melhores jogadores de linha do rival, sem designação ativa.
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='tatica']");
  await page.click("#btnOpenMarking");
  await page.waitForTimeout(300);
  const check1 = await page.evaluate(() => ({
    open: document.getElementById("markingOverlay").classList.contains("open"),
    oppLabel: document.getElementById("markingOppLabel").textContent,
    myCount: document.querySelectorAll("#markingMyPlayers [data-id]").length,
    rivalCount: document.querySelectorAll("#markingRivalPlayers [data-id]").length,
    activeCardHidden: document.getElementById("markingActiveCard").style.display === "none",
    applyDisabled: document.getElementById("btnApplyMarking").disabled,
  }));
  // myCount = 10 (11 titulares MENOS o goleiro -- goleiro não marca
  // ninguém, ver filtro em renderManMarkingScreen).
  console.log("1) Abre com próximo adversário, 10 titulares de linha meus (sem goleiro) e 5 do rival, sem designação, Aplicar desabilitado:",
    check1.open && check1.oppLabel.includes("Próximo jogo") && check1.myCount === 10 && check1.rivalCount === 5 && check1.activeCardHidden && check1.applyDisabled,
    JSON.stringify(check1));

  // 2) Escolher 1 jogador meu + 1 do rival habilita "Aplicar"; aplicar
  // grava CAREER.manMarking e mostra a designação ativa.
  const ids = await page.evaluate(() => ({
    mine: document.querySelector("#markingMyPlayers [data-id]").dataset.id,
    rival: document.querySelector("#markingRivalPlayers [data-id]").dataset.id,
  }));
  await page.click(`#markingMyPlayers [data-id="${ids.mine}"]`);
  await page.click(`#markingRivalPlayers [data-id="${ids.rival}"]`);
  await page.waitForTimeout(150);
  const check2a = await page.evaluate(() => document.getElementById("btnApplyMarking").disabled);
  console.log("2) Escolher os 2 habilita 'Aplicar':", !check2a);
  await page.click("#btnApplyMarking");
  await page.waitForTimeout(200);
  const check2b = await page.evaluate((ids) => ({
    manMarking: JSON.stringify(CAREER.manMarking),
    matches: CAREER.manMarking && CAREER.manMarking.myPlayerId === ids.mine && CAREER.manMarking.rivalPlayerId === ids.rival,
    activeCardVisible: document.getElementById("markingActiveCard").style.display !== "none",
  }), ids);
  console.log("2b) Aplicar grava CAREER.manMarking com os ids certos, mostra designação ativa:", check2b.matches && check2b.activeCardVisible, JSON.stringify(check2b));

  await page.screenshot({ path: "screens/marcacao_individual.png" });

  // 3) Fechar e reabrir -- a designação persiste (mesmos 2 jogadores
  // marcados como "selected").
  await page.click("#markingClose");
  await page.waitForTimeout(150);
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='tatica']");
  await page.click("#btnOpenMarking");
  await page.waitForTimeout(200);
  const check3 = await page.evaluate((ids) => ({
    mineSelected: document.querySelector(`#markingMyPlayers [data-id="${ids.mine}"]`)?.classList.contains("selected"),
    rivalSelected: document.querySelector(`#markingRivalPlayers [data-id="${ids.rival}"]`)?.classList.contains("selected"),
  }), ids);
  console.log("3) Reabrir mantém a mesma designação selecionada:", check3.mineSelected && check3.rivalSelected, JSON.stringify(check3));

  // 4) Efeito REAL na simulação: com o jogador rival marcado
  // (factor 0.4), ele deve ser sorteado MENOS que o normal como
  // artilheiro/assistente em várias rodadas simuladas via attributeGoals
  // direto (sem depender de rodar o jogo inteiro pela UI) -- compara
  // contra o MESMO cenário sem marcação.
  const effectCheck = await page.evaluate((ids) => {
    const opponentId = CAREER.manMarking.opponentId;
    const rivalSquad = leagueSquadFor(opponentId);
    const marked = rivalSquad.find((p) => p.id === ids.rival);
    if (!marked) return { error: "jogador marcado não achado no elenco" };
    const N = 4000;
    let creditedWith = 0, creditedWithout = 0;
    for (let i = 0; i < N; i++) {
      const evWith = attributeGoals(rivalSquad, 1, activeManMarkingSuppression(opponentId));
      if (evWith.some((e) => e.player === marked.name)) creditedWith++;
      const evWithout = attributeGoals(rivalSquad, 1, null);
      if (evWithout.some((e) => e.player === marked.name)) creditedWithout++;
    }
    return { creditedWith, creditedWithout, N, ratio: creditedWith / creditedWithout };
  }, ids);
  console.log("4) Com marcação, o jogador marcado é sorteado como autor de gol/assistência bem menos vezes que sem marcação:",
    !effectCheck.error && effectCheck.creditedWith < effectCheck.creditedWithout * 0.75, JSON.stringify(effectCheck));

  // 5) Remover marcação limpa CAREER.manMarking e some a designação ativa.
  await page.click("#btnRemoveMarking");
  await page.waitForTimeout(150);
  const check5 = await page.evaluate(() => ({
    manMarking: CAREER.manMarking,
    activeCardHidden: document.getElementById("markingActiveCard").style.display === "none",
  }));
  console.log("5) Remover marcação limpa CAREER.manMarking:", check5.manMarking === null && check5.activeCardHidden, JSON.stringify(check5));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
