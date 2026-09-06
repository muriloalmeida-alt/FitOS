// Nova feature — Resumo da rodada: lista TODOS os confrontos da rodada
// (não só o seu), aberta a qualquer momento pelo Menu, com 2 estados de
// verdade (Atual = não jogada ainda, Anterior = com placar real).
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `resumorodada${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Resumo Rodada", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  // 1) Abre pelo Menu -> mostra a Rodada 1 (atual), sem tab "Anterior"
  //    (1ª rodada da carreira, nenhuma rodada anterior existe ainda),
  //    e todo confronto ainda "— x —" (nada foi jogado).
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='competicao']");
  await page.click("#btnOpenRodada");
  await page.waitForTimeout(300);
  const check1 = await page.evaluate(() => {
    const open = document.getElementById("rodadaOverlay").classList.contains("open");
    const label = document.getElementById("rodadaRoundLabel").textContent;
    const rows = [...document.querySelectorAll("#rodadaList .ct-round-result-row")];
    const allPlaceholder = rows.every((r) => r.querySelector(".ct-rr-score").textContent.replace(/\s/g, "").includes("—x—"));
    const tabAnteriorHidden = document.getElementById("rodadaTabAnterior").classList.contains("hidden");
    return { open, label, rowCount: rows.length, allPlaceholder, tabAnteriorHidden };
  });
  console.log("1) Modal abre na Rodada 1, sem histórico, 10 confrontos '— x —', sem tab Anterior:",
    check1.open && check1.label.includes("1") && check1.rowCount === 10 && check1.allPlaceholder && check1.tabAnteriorHidden,
    JSON.stringify(check1));
  await page.click("#rodadaClose");
  await page.waitForTimeout(200);

  // 2) Simula a rodada 1 de verdade via UI (Ir para o jogo -> pular ->
  //    fechar sequência pós-jogo) e reabre o Resumo da rodada: agora
  //    currentRound é 2, a tab "Anterior" aparece e mostra a Rodada 1
  //    com placares reais (>=1 gol total esperado entre 10 jogos).
  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(200);
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
    if (await page.evaluate(() => document.getElementById("pressOverlay").classList.contains("open"))) {
      await page.click("#pressOptions [data-press]");
      await page.waitForTimeout(300);
    }
    await page.waitForSelector("#newsOverlay.open", { timeout: 5000 });
    await page.click("#btnNewsContinue");
    await page.waitForTimeout(300);
  }
  if (await page.evaluate(() => document.getElementById("roundResultsOverlay").classList.contains("open"))) {
    await page.click("#btnRoundResultsCloseFooter");
    await page.waitForTimeout(200);
  }
  if (await page.evaluate(() => document.getElementById("playerOfferOverlay")?.classList.contains("open"))) {
    await page.click("#playerOfferClose");
    await page.waitForTimeout(200);
  }

  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(200);
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='competicao']");
  await page.click("#btnOpenRodada");
  await page.waitForTimeout(300);
  const check2 = await page.evaluate(() => {
    const currentRound = typeof CAREER !== "undefined" && CAREER ? CAREER.currentRound : null;
    const label = document.getElementById("rodadaRoundLabel").textContent;
    const tabAnteriorVisible = !document.getElementById("rodadaTabAnterior").classList.contains("hidden");
    const rows = [...document.querySelectorAll("#rodadaList .ct-round-result-row")];
    const allPlaceholderAtual = rows.every((r) => r.querySelector(".ct-rr-score").textContent.replace(/\s/g, "").includes("—x—"));
    return { currentRound, label, tabAnteriorVisible, rowCountAtual: rows.length, allPlaceholderAtual };
  });
  console.log("2) Depois de jogar a rodada 1: currentRound=2, mostra Rodada 2 atual (placeholder), tab Anterior visível:",
    check2.currentRound === 2 && check2.label.includes("2") && check2.tabAnteriorVisible && check2.rowCountAtual === 10 && check2.allPlaceholderAtual,
    JSON.stringify(check2));

  // 3) Clica em "Rodada anterior" -> mostra Rodada 1 com placares reais.
  await page.click("#rodadaTabAnterior");
  await page.waitForTimeout(200);
  const check3 = await page.evaluate(() => {
    const label = document.getElementById("rodadaRoundLabel").textContent;
    const rows = [...document.querySelectorAll("#rodadaList .ct-round-result-row")];
    const scores = rows.map((r) => r.querySelector(".ct-rr-score").textContent.trim());
    const anyRealScore = scores.some((s) => !s.replace(/\s/g, "").includes("—x—"));
    const meRow = rows.find((r) => r.classList.contains("me"));
    return { label, rowCount: rows.length, anyRealScore, hasMeHighlight: !!meRow, sampleScores: scores.slice(0, 3) };
  });
  console.log("3) Rodada anterior mostra a Rodada 1 com placares reais e destaque do próprio clube:",
    check3.label.includes("1") && check3.rowCount === 10 && check3.anyRealScore && check3.hasMeHighlight,
    JSON.stringify(check3));

  await page.screenshot({ path: "screens/resumo_rodada_anterior.png" });
  await page.click("#rodadaTabAtual");
  await page.waitForTimeout(200);
  await page.screenshot({ path: "screens/resumo_rodada_atual.png" });

  await page.click("#btnRodadaCloseFooter");
  await page.waitForTimeout(150);
  const check4 = await page.evaluate(() => !document.getElementById("rodadaOverlay").classList.contains("open"));
  console.log("4) Fechar fecha o modal:", check4);

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
