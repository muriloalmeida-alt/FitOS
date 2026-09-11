// Testa a migração de "Resumo da rodada" (S4-B3-006, issue #24) pro
// MatchCard (matchCardHTML(), S4-B3-005) no lugar do antigo
// .ct-round-result-row — cobre as 3 pontas em escopo (roundResultsList
// dentro de showRoundResultsModal(), o sub-bloco de Copa do Brasil
// dentro dela via cupRoundResultsHTML(), e rodadaList dentro de
// renderRodada()). Preserva 100% do comportamento: navegação atual/
// anterior, destaque do próprio clube, nomes clicáveis, "— x —" pra
// confronto ainda não jogado. Nenhuma regra de negócio nova.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("console", (msg) => { if (msg.type() === "error") console.log("CONSOLE ERROR:", msg.text()); });
  const base = "http://localhost:8787";
  const email = `s4b3006${Date.now()}@teste.com`;

  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "S4B3006 Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(300);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnOnboardSkip", { timeout: 2000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await page.click("#btnClaimDailyLogin").catch(() => {});
  await page.waitForTimeout(200);

  // 1) "Rodada" (menu) — Rodada 1, nada jogado ainda: 10 confrontos,
  // todos MatchCard (não .ct-round-result-row antigo), placar "— x —".
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='competicao']");
  await page.click("#btnOpenRodada");
  await page.waitForTimeout(300);
  const check1 = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("#rodadaList .m3-match-card")];
    const oldRows = document.querySelectorAll("#rodadaList .ct-round-result-row").length;
    const allPlaceholder = cards.every((c) => c.querySelector(".m3-mc-score").textContent.replace(/\s/g, "") === "—x—");
    const mine = cards.find((c) => c.parentElement.classList.contains("m3-mc-mine"));
    return { cardCount: cards.length, oldRows, allPlaceholder, hasMine: !!mine, hasCrest: !!cards[0]?.querySelector(".m3-mc-side img, .m3-mc-side") };
  });
  console.log("1) 'Rodada' (atual, nada jogado): 10 MatchCard, zero .ct-round-result-row antigo, placar '— x —', próprio clube destacado:",
    check1.cardCount === 10 && check1.oldRows === 0 && check1.allPlaceholder && check1.hasMine, JSON.stringify(check1));

  // 2) Nome do clube no MatchCard continua clicável (abre elenco).
  await page.click("#rodadaList .m3-match-card .m3-mc-side[data-openclub]");
  await page.waitForTimeout(150);
  const check2 = await page.evaluate(() => document.getElementById("clubRosterOverlay").classList.contains("open") || document.querySelector(".ct-panel.active")?.id === "panel-elenco");
  console.log("2) Clicar no nome do clube no MatchCard abre o elenco (ou vai pra Elenco, se for o meu):", check2);
  await page.evaluate(() => { document.getElementById("clubRosterOverlay").classList.remove("open"); });
  await page.click("#rodadaClose");
  await page.waitForTimeout(150);

  // 3) Jogar a rodada 1 de verdade -> "Resultados da rodada"
  // (showRoundResultsModal) usa MatchCard, 10 resultados com placar
  // real, próprio jogo destacado.
  await page.click("#btnSimulate");
  await page.waitForSelector("#preMatchOverlay.open", { timeout: 5000 });
  await page.click("#btnPreMatchGo");
  await page.waitForSelector("#liveMatchOverlay.open", { timeout: 5000 }).catch(() => {});
  await page.click("#btnLiveSkip").catch(() => {});
  await page.waitForSelector("#matchDetailOverlay.open, #roundResultsOverlay.open", { timeout: 15000 });
  await page.waitForTimeout(300);
  if (await page.evaluate(() => document.getElementById("matchDetailOverlay").classList.contains("open"))) {
    await page.click("#btnMatchDetailContinue");
    await page.waitForTimeout(300);
    if (await page.evaluate(() => document.getElementById("pressOverlay")?.classList.contains("open"))) {
      await page.click("#pressOptions [data-press]");
      await page.waitForTimeout(300);
    }
    await page.waitForSelector("#newsOverlay.open", { timeout: 5000 });
    await page.click("#btnNewsContinue");
    await page.waitForTimeout(300);
  }
  await page.waitForSelector("#roundResultsOverlay.open", { timeout: 8000 });
  const check3 = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("#roundResultsList .m3-match-card")];
    const oldRows = document.querySelectorAll("#roundResultsList .ct-round-result-row").length;
    const anyRealScore = cards.some((c) => !c.querySelector(".m3-mc-score").textContent.replace(/\s/g, "").includes("—x—"));
    const mine = cards.find((c) => c.parentElement.classList.contains("m3-mc-mine"));
    return { cardCount: cards.length, oldRows, anyRealScore, hasMine: !!mine };
  });
  console.log("3) 'Resultados da rodada' (pós-jogo): 10 MatchCard com placar real, zero .ct-round-result-row antigo, próprio jogo destacado:",
    check3.cardCount === 10 && check3.oldRows === 0 && check3.anyRealScore && check3.hasMine, JSON.stringify(check3));

  // 4) Copa do Brasil (sub-bloco dentro do mesmo modal, quando existe)
  // também usa MatchCard — força um cupResult sintético via
  // cupRoundResultsHTML() direto, sem depender de a carreira estar
  // numa rodada real de Copa (mesma técnica de outros testes desta
  // suíte pra estado difícil de alcançar via UI).
  const check4 = await page.evaluate(() => {
    const clubIds = Object.keys(CAREER.standings);
    const html = cupRoundResultsHTML({
      phase: "oitavas",
      results: [{ home: CAREER.clubId, away: clubIds.find((id) => String(id) !== String(CAREER.clubId)), gh: 2, ga: 2, penalties: true }],
    });
    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    const card = wrap.querySelector(".m3-match-card");
    const oldRow = wrap.querySelector(".ct-round-result-row");
    return {
      hasCard: !!card,
      oldRow: !!oldRow,
      scoreText: card?.querySelector(".m3-mc-score")?.textContent.replace(/\s/g, ""),
      hasPenaltiesTag: wrap.textContent.includes("Pênaltis"),
      hasStatusLine: wrap.textContent.includes("Oitavas"),
    };
  });
  console.log("4) Copa do Brasil (cupRoundResultsHTML) usa MatchCard, zero .ct-round-result-row antigo, mostra 'Pênaltis' e a fase:",
    check4.hasCard && !check4.oldRow && check4.scoreText === "2x2" && check4.hasPenaltiesTag && check4.hasStatusLine, JSON.stringify(check4));

  // 5) "Continuar" preserva o fluxo de sempre: fecha "Resultados da
  // rodada" e segue pra Tabela (ou pra proposta em destaque, se houver
  // uma pendente) — comportamento inalterado por esta migração visual.
  await page.click("#btnRoundResultsContinue");
  await page.waitForTimeout(300);
  const check5 = await page.evaluate(() => ({
    resultsClosed: !document.getElementById("roundResultsOverlay").classList.contains("open"),
    followUpOpen: document.getElementById("tabelaModalOverlay").classList.contains("open") || document.getElementById("playerOfferOverlay")?.classList.contains("open"),
  }));
  console.log("5) 'Continuar' fecha 'Resultados da rodada' e segue o fluxo de sempre (Tabela ou proposta em destaque):",
    check5.resultsClosed && check5.followUpOpen, JSON.stringify(check5));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
