const { chromium } = require("playwright-core");

async function newCareer(page, base, email) {
  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "AoVivo Test", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "load" });
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

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("fonts.googleapis") && !m.text().includes("fundingchoices")) console.log("CONSOLE ERROR:", m.text()); });

  const base = "http://localhost:8787";
  await newCareer(page, base, `aovivo${Date.now()}@teste.com`);
  await page.evaluate(() => { window.__origRandom = Math.random; });

  // 1) Clicar em "Simular rodada" abre a tela Ao Vivo (não o modal de
  // detalhe instantâneo de antes).
  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(300);
  await page.click("#btnSimulate");
  await page.waitForSelector("#preMatchOverlay.open", { timeout: 5000 });
  await page.click("#btnPreMatchGo");
  await page.waitForSelector("#liveMatchOverlay.open", { timeout: 5000 });
  console.log("1) Tela Ao Vivo abriu ao simular:", true);

  // Pausa a progressão automática IMEDIATAMENTE (evita timers reais
  // concorrendo com as chamadas manuais abaixo, ver comentário em
  // resolveLiveChunk/scheduleNextChunk). Esse teste dirige a partida
  // inteira manualmente via resolveLiveChunk() — inclusive o intervalo
  // automático do item 4, que também acontece numa chamada manual
  // (resolveLiveChunk não distingue quem chamou), então não precisa de
  // nenhum tratamento especial aqui além de continuar pausado.
  await page.evaluate(() => pauseLiveMatch());

  // 2) Substituição: troca um titular por alguém do banco, confere que
  // vale a partir do PRÓXIMO tempo (computeHumanStrength lê ao vivo).
  const before = await page.evaluate(() => ({
    outId: CAREER.lineup.starters.find((id) => id),
    benchId: CAREER.lineup.bench.find((id) => CAREER.squad.find((p) => p.id === id && p.status === "ok")),
  }));
  await page.evaluate(() => resolveLiveChunk()); // 1º tempo (0-15')
  await page.evaluate(({ outId, benchId }) => {
    document.getElementById("liveSubOutSelect").innerHTML = `<option value="${outId}">x</option>`;
    document.getElementById("liveSubInSelect").innerHTML = `<option value="${benchId}">y</option>`;
    confirmLiveSub();
  }, before);
  const afterSub = await page.evaluate((outId) => ({
    outStillStarter: CAREER.lineup.starters.includes(outId),
    subsUsed: LIVE_MATCH.subsUsed,
    paused: LIVE_MATCH.paused,
  }), before.outId);
  console.log("2) Substituição -- jogador que saiu não é mais titular:", !afterSub.outStillStarter, "| subsUsed=1:", afterSub.subsUsed === 1, "| partida retomada (paused=false):", afterSub.paused === false);
  // AJUSTE (item 4) — confirmLiveSub() retoma a progressão automática
  // sozinho (resumeLiveMatch) — repausa de novo aqui pra manter o
  // controle 100% manual dos "tempos" abaixo, sem um timer real
  // correndo por baixo e (com o intervalo automático agora existindo)
  // eventualmente disparando finishLiveMatch em paralelo com as
  // chamadas manuais mais adiante.
  await page.evaluate(() => pauseLiveMatch());

  // 3) Ajuste tático: troca de esquema aplica penalidade de familiaridade
  // por 2 tempos.
  await page.evaluate(() => { openLiveTacticsModal(); });
  const otherFormation = await page.evaluate(() => {
    const cur = CAREER.lineup.formation;
    return Object.keys(FORMATIONS).find((f) => f !== cur);
  });
  await page.evaluate((f) => {
    document.getElementById("liveTacticsFormation").value = f;
    confirmLiveTactics();
  }, otherFormation);
  const tacticsState = await page.evaluate((f) => ({
    formationChanged: CAREER.lineup.formation === f,
    penaltyChunks: LIVE_MATCH.formationPenaltyChunksLeft,
  }), otherFormation);
  console.log("3) Esquema trocado:", tacticsState.formationChanged, "| penalidade de familiaridade ativa (2 tempos):", tacticsState.penaltyChunks === 2);
  // AJUSTE (item 4) — confirmLiveTactics() também retoma sozinho.
  await page.evaluate(() => pauseLiveMatch());

  await page.evaluate(() => resolveLiveChunk()); // 2º tempo -- consome 1 de familiaridade
  await page.evaluate(() => resolveLiveChunk()); // 3º tempo -- consome o outro
  const penaltyAfter2 = await page.evaluate(() => LIVE_MATCH.formationPenaltyChunksLeft);
  console.log("4) Penalidade de familiaridade zerou depois de 2 tempos:", penaltyAfter2 === 0);

  // 5) Cota de substituição: máximo 5, e cartão vermelho libera bônus
  // extra sem contar na cota (força vermelho fixando Math.random baixo
  // pro time humano num tempo isolado).
  const maxSubsBefore = await page.evaluate(() => MAX_SUBS_PER_MATCH + LIVE_MATCH.subsBonus);
  await page.evaluate(() => { Math.random = () => 0.001; }); // garante vermelho em quem estiver em campo
  await page.evaluate(() => resolveLiveChunk()); // 4º tempo
  const afterRed = await page.evaluate(() => ({
    subsBonus: LIVE_MATCH.subsBonus,
    someoneSuspended: CAREER.squad.some((p) => p.status === "suspenso"),
  }));
  console.log("5) Expulsão liberou substituição extra (subsBonus > 0):", afterRed.subsBonus > 0, "| algum jogador ficou suspenso:", afterRed.someoneSuspended);

  // Restaura aleatoriedade normal e termina a partida com "Pular pro
  // fim" (sem esperar os timers reais).
  await page.evaluate(() => { Math.random = window.__origRandom; });
  const beforeSkip = await page.evaluate(() => CAREER.currentRound);
  await page.evaluate(() => skipLiveMatch());
  await page.waitForSelector("#matchDetailOverlay.open", { timeout: 5000 });
  const career1 = await getCareer(page);
  console.log("6) Partida terminou e rodada avançou (skipLiveMatch):", career1.currentRound === beforeSkip + 1);
  console.log("   Modal 'Seu jogo' mostra o placar final ao vivo:", true, "-- texto:", await page.evaluate(() => document.getElementById("matchDetailScore").textContent.trim()));

  await page.click("#btnMatchDetailContinue");
  await page.waitForTimeout(200);
  // FASE 4 (item 2) — coletiva de imprensa pode aparecer aqui (ver
  // determineMatchPressTrigger em carreira.js) — responde a 1ª opção
  // pra não travar o resto do fluxo.
  if (await page.evaluate(() => document.getElementById("pressOverlay").classList.contains("open"))) {
    await page.click("#pressOptions [data-press]");
  }
  // AJUSTE — tela de Notícias em tela cheia sempre aparece antes dos
  // Resultados da rodada agora (ver openNewsScreen em carreira.js).
  await page.waitForSelector("#newsOverlay.open", { timeout: 5000 });
  await page.click("#btnNewsContinue");
  await page.waitForSelector("#roundResultsOverlay.open", { timeout: 5000 });
  const resultsCount = await page.evaluate(() => document.querySelectorAll("#roundResultsList .ct-round-result-row").length);
  console.log("7) Resultados da rodada inteira (10 jogos, CPU x CPU incluídos):", resultsCount === 10);
  await page.click("#btnRoundResultsContinue");
  await page.waitForTimeout(300);
  // AJUSTE (item 6, pedido do usuário) — proposta por jogador pode
  // aparecer aqui antes da Tabela (sorteio de sempre) — fecha no X pra
  // não deixar sobrando por cima do resto do fluxo.
  if (await page.waitForSelector("#playerOfferOverlay.open", { timeout: 1200 }).then(() => true).catch(() => false)) {
    await page.click("#playerOfferClose");
    await page.waitForTimeout(200);
  }

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
