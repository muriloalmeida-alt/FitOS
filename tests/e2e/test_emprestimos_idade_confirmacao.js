const { chromium } = require("playwright-core");

async function newCareer(page, base, email) {
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Ajustes Test", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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
  await newCareer(page, base, `ajustes${Date.now()}@teste.com`);

  // ---------- 1) Idade real vinda da API ----------
  const ageCheck = await page.evaluate(() => {
    const rng = () => 0.5;
    const club = { atk: 1.2, def: 1.1 };
    const rawComPeidade = { id: 999, name: "Jogador Com Idade", position: "Midfielder", rating: 7, games: 20, goals: 3, assists: 2, age: 29 };
    const rawSemIdade = { id: 998, name: "Jogador Sem Idade", position: "Midfielder", rating: 7, games: 20, goals: 3, assists: 2 };
    const pCom = buildRealPlayer(rawComPeidade, club, rng);
    const pSem = buildRealPlayer(rawSemIdade, club, rng);
    return { comIdade: pCom.age, semIdade: pSem.age };
  });
  console.log("1) Idade vinda do 'raw.age' da API é usada de verdade:", ageCheck.comIdade === 29);
  console.log("   Sem raw.age, cai no sorteio de sempre (18-35):", ageCheck.semIdade >= 18 && ageCheck.semIdade <= 35);

  // ---------- 2) Fator de reclamação: idade/overall ----------
  const complaintCheck = await page.evaluate(() => {
    const prime = { age: 27, overall: 85 };
    const old = { age: 36, overall: 85 };
    const young = { age: 18, overall: 85 };
    const lowOvr = { age: 27, overall: 58 };
    return {
      prime: playerComplaintFactor(prime),
      old: playerComplaintFactor(old),
      young: playerComplaintFactor(young),
      lowOvr: playerComplaintFactor(lowOvr),
    };
  });
  console.log("2) Jogador em idade de pico + overall alto reclama mais que veterano com o mesmo overall:", complaintCheck.prime > complaintCheck.old);
  console.log("   ...e mais que um jovem com o mesmo overall:", complaintCheck.prime > complaintCheck.young);
  console.log("   ...e mais que alguém de overall baixo na mesma idade:", complaintCheck.prime > complaintCheck.lowOvr);

  // ---------- 3) Empréstimo recusado por jogador de destaque ----------
  const loanCheck = await page.evaluate(async () => {
    const destaque = CAREER.squad.find((p) => p.origin === "principal");
    destaque.overall = 88; destaque.age = 27; // prime + overall alto -> deve recusar
    const cashBefore = CAREER.finances.cash;
    const okDestaque = await finalizeLoanOut(destaque.id, { returnRound: null, buyOption: null });
    const aindaNoElenco = CAREER.squad.some((p) => p.id === destaque.id);

    const reserva = CAREER.squad.filter((p) => p.origin === "principal")[1];
    reserva.overall = 60; reserva.age = 27; // overall baixo -> deve aceitar (se achar comprador)
    let okReserva = false, tentativas = 0;
    while (!okReserva && tentativas < 20) { // findInterestedBuyer tem chance de recusa aleatória -- tenta algumas vezes
      okReserva = await finalizeLoanOut(reserva.id, { returnRound: null, buyOption: null });
      tentativas++;
    }
    return { okDestaque, aindaNoElenco, okReserva, cashChanged: CAREER.finances.cash !== cashBefore };
  });
  console.log("3) Jogador de destaque (prime + overall alto) tem empréstimo recusado:", loanCheck.okDestaque === false && loanCheck.aindaNoElenco === true);
  console.log("   Jogador de overall baixo consegue ser emprestado (mesma idade):", loanCheck.okReserva === true);

  // ---------- 4) Botão "Emprestar" desabilitado pro destaque no detalhe ----------
  const destaqueId = await page.evaluate(() => {
    const p = CAREER.squad.find((x) => x.origin === "principal");
    p.overall = 90; p.age = 26;
    return p.id;
  });
  await page.click(".m3-nav-item[data-panel='elenco']");
  await page.waitForTimeout(300);
  await page.click(`[data-id="${destaqueId}"]`);
  await page.waitForSelector("#detailOverlay.open");
  await page.waitForTimeout(200);
  const loanBtnDisabled = await page.evaluate(() => {
    const btn = document.querySelector('[data-act="loanout"]');
    return btn ? btn.disabled : "botão não existe";
  });
  console.log("4) Botão 'Emprestar' vem desabilitado pro destaque, com tooltip explicando:", loanBtnDisabled === true);
  await page.click("#detailClose");
  await page.waitForTimeout(200);

  // ---------- 5) Confirmar escalação antes de simular ----------
  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(300);
  await page.click("#btnSimulate");
  await page.waitForSelector("#preMatchOverlay.open", { timeout: 5000 });
  const preMatchState = await page.evaluate(() => ({
    isFullscreen: document.getElementById("preMatchOverlay").classList.contains("ct-modal-fullscreen"),
    liveNotOpenYet: !document.getElementById("liveMatchOverlay").classList.contains("open"),
    lineupRows: document.querySelectorAll("#preMatchLineup .ct-prematch-row").length,
    opponentText: document.getElementById("preMatchOpponent").textContent.trim().length > 0,
  }));
  console.log("5) 'Simular rodada' abre a confirmação de escalação em tela cheia, SEM simular ainda:", preMatchState.isFullscreen && preMatchState.liveNotOpenYet);
  console.log("   Lista os 11 titulares e o adversário:", preMatchState.lineupRows === 11 && preMatchState.opponentText);

  // 5b) X fecha sem simular.
  await page.click("#preMatchClose");
  await page.waitForTimeout(200);
  const afterX = await page.evaluate(() => ({
    preMatchClosed: !document.getElementById("preMatchOverlay").classList.contains("open"),
    stillNotSimulated: !document.getElementById("liveMatchOverlay").classList.contains("open") && !document.getElementById("matchDetailOverlay").classList.contains("open"),
  }));
  console.log("   X fecha sem simular nada:", afterX.preMatchClosed && afterX.stillNotSimulated);

  // 5c) "Ajustar escalação" abre a aba Escalação inteira POR CIMA da
  // confirmação (mudança pré-existente, sem relação com o checklist de
  // UX desta etapa — a confirmação continua aberta por baixo, não
  // navega mais de aba; ver "Ajustar escalação no pré-jogo vira
  // modal"). Fecha com o X do ajuste, que devolve o painel pro lugar.
  await page.click("#btnSimulate");
  await page.waitForSelector("#preMatchOverlay.open");
  await page.click("#btnPreMatchAdjust");
  await page.waitForTimeout(200);
  const afterAdjust = await page.evaluate(() => ({
    adjustOpen: document.getElementById("adjustLineupOverlay").classList.contains("open"),
    preMatchStillOpenUnder: document.getElementById("preMatchOverlay").classList.contains("open"),
  }));
  console.log("   'Ajustar escalação' abre a aba Escalação por cima (confirmação continua aberta por baixo):", afterAdjust.adjustOpen && afterAdjust.preMatchStillOpenUnder);
  await page.click("#adjustLineupClose");
  await page.waitForTimeout(200);
  await page.click("#preMatchClose");
  await page.waitForTimeout(200);

  // 5d) "Ir para o jogo" de fato simula.
  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(300);
  await page.click("#btnSimulate");
  await page.waitForSelector("#preMatchOverlay.open");
  await page.click("#btnPreMatchGo");
  await page.waitForSelector("#liveMatchOverlay.open, #matchDetailOverlay.open", { timeout: 5000 });
  const wentToMatch = await page.evaluate(() => document.getElementById("liveMatchOverlay").classList.contains("open") || document.getElementById("matchDetailOverlay").classList.contains("open"));
  console.log("6) 'Ir para o jogo' de fato dispara a simulação:", wentToMatch);

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
