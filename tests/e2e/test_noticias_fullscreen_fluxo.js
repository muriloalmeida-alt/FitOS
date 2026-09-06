const { chromium } = require("playwright-core");

async function newCareer(page, base, email) {
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Fluxo Noticias", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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
  await newCareer(page, base, `fluxonoticias${Date.now()}@teste.com`);

  // Zera a chance de coletiva de imprensa pra esse teste ser
  // determinístico (ver PRESS_CHANCE_BY_ID) — o foco aqui é o fluxo
  // Notícias -> Resultados, não a coletiva (já testada à parte).
  await page.evaluate(() => {
    Object.keys(PRESS_CHANCE_BY_ID).forEach((k) => { PRESS_CHANCE_BY_ID[k] = 0; });
    PRESS_ALWAYS_IDS.clear();
    // Força um jogador contundido e outro suspenso pra testar a seção
    // "Notícias do seu time".
    const injured = CAREER.squad.find((p) => p.origin === "principal");
    injured.status = "contundido"; injured.injurySeverity = "media"; injured.outUntilRound = CAREER.currentRound + 5;
    const suspended = CAREER.squad.filter((p) => p.origin === "principal")[1];
    suspended.status = "suspenso"; suspended.outUntilRound = CAREER.currentRound + 1;
    window.__injuredName = injured.name;
    window.__suspendedName = suspended.name;
  });

  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(300);
  await page.click("#btnSimulate");
  await page.waitForSelector("#preMatchOverlay.open", { timeout: 5000 });
  await page.click("#btnPreMatchGo");
  // AJUSTE (item 4, pedido do usuário: "o jogo deve pausar no
  // intervalo (45) e aguardar que o técnico clique em prosseguir") —
  // clica em "Prosseguir" se o jogo parar no intervalo antes de seguir
  // esperando o resto do fluxo.
  await page.waitForSelector("#liveMatchOverlay.open", { timeout: 5000 }).catch(() => {});
  await page.waitForFunction(() => typeof LIVE_MATCH !== 'undefined' && LIVE_MATCH && (LIVE_MATCH.halftime || LIVE_MATCH.finished), { timeout: 15000 }).catch(() => {});
  if (await page.evaluate(() => typeof LIVE_MATCH !== 'undefined' && LIVE_MATCH && LIVE_MATCH.halftime)) {
    await page.click("#btnLiveContinueSecondHalf");
  }
  await page.waitForSelector("#liveMatchOverlay.open", { timeout: 5000 });
  await page.evaluate(() => skipLiveMatch());
  await page.waitForSelector("#matchDetailOverlay.open", { timeout: 5000 });
  await page.click("#btnMatchDetailContinue");
  await page.waitForTimeout(300);

  // 1) A tela de Notícias aparece (tela cheia) ANTES dos Resultados da
  // rodada, sem precisar passar pela coletiva (throttle zerado acima).
  const newsState = await page.evaluate(() => ({
    newsOpen: document.getElementById("newsOverlay").classList.contains("open"),
    isFullscreen: document.getElementById("newsOverlay").classList.contains("ct-modal-fullscreen"),
    roundResultsOpen: document.getElementById("roundResultsOverlay").classList.contains("open"),
    continueVisible: !document.getElementById("newsFooter").classList.contains("hidden"),
  }));
  console.log("1) Notícias abre em tela cheia ANTES dos Resultados da rodada:", newsState.newsOpen && newsState.isFullscreen && !newsState.roundResultsOpen);
  console.log("   Botão Continuar aparece (faz parte do fluxo pós-jogo):", newsState.continueVisible);

  // 2) Seção "Notícias do Brasileirão" com o feed de sempre.
  const brasileiraoSection = await page.evaluate(() => document.getElementById("newsFeatured").textContent.trim().length > 5);
  console.log("2) Seção 'Notícias do Brasileirão' preenchida:", brasileiraoSection);

  // 3) Seção "Notícias do seu time" mostra o lesionado e o suspenso.
  const teamNewsText = await page.evaluate(() => document.getElementById("newsTeamStatus").textContent);
  const injuredName = await page.evaluate(() => window.__injuredName);
  const suspendedName = await page.evaluate(() => window.__suspendedName);
  console.log("3) Notícias do seu time mostra o lesionado:", teamNewsText.includes(injuredName.split(" ")[0]) || teamNewsText.includes("está fora, lesionado"));
  console.log("   ...e o suspenso:", teamNewsText.includes(suspendedName.split(" ")[0]) || teamNewsText.includes("está suspenso"));

  // 4) Botão de classificação abre o modal de tabela POR CIMA da tela
  // de notícias (sem fechar as notícias).
  await page.click("#btnNewsOpenTabela");
  await page.waitForTimeout(200);
  const tabelaState = await page.evaluate(() => ({
    tabelaOpen: document.getElementById("tabelaModalOverlay").classList.contains("open"),
    newsStillOpen: document.getElementById("newsOverlay").classList.contains("open"),
    rows: document.querySelectorAll("#standingsTableModal .mt-tr").length,
  }));
  console.log("4) 'Ver classificação atualizada' abre o modal de tabela por cima:", tabelaState.tabelaOpen && tabelaState.newsStillOpen && tabelaState.rows === 20);
  await page.click("#tabelaModalClose");
  await page.waitForTimeout(200);

  // 5) "Continuar" fecha as Notícias e segue pros Resultados da rodada.
  await page.click("#btnNewsContinue");
  await page.waitForTimeout(300);
  const afterContinue = await page.evaluate(() => ({
    newsClosed: !document.getElementById("newsOverlay").classList.contains("open"),
    roundResultsOpen: document.getElementById("roundResultsOverlay").classList.contains("open"),
  }));
  console.log("5) 'Continuar' fecha Notícias e abre Resultados da rodada:", afterContinue.newsClosed && afterContinue.roundResultsOpen);
  await page.click("#btnRoundResultsContinue").catch(() => {});
  await page.waitForTimeout(200);
  await page.click("#tabelaModalClose").catch(() => {});
  await page.waitForTimeout(200);

  // 6) Aberta pelo menu "≡" (fora do fluxo pós-jogo), "Continuar" NÃO
  // aparece -- é só uma tela de consulta, X fecha normalmente.
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='imprensa']");
  await page.click("#btnOpenNews");
  await page.waitForSelector("#newsOverlay.open");
  await page.waitForTimeout(150);
  const menuMode = await page.evaluate(() => document.getElementById("newsFooter").classList.contains("hidden"));
  console.log("6) Aberta pelo menu, 'Continuar' fica escondido (é só consulta):", menuMode);
  await page.click("#newsClose");

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
