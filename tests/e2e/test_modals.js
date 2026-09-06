const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("console", (msg) => { if (msg.type() === "error") console.log("CONSOLE ERROR:", msg.text()); });
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));

  const base = "http://localhost:8787";

  // signup + login
  await page.goto(base + "/", { waitUntil: "load" });
  const email = `modaltest${Date.now()}@teste.com`;
  // Try to find a signup link/flow generically
  await page.screenshot({ path: "00-landing.png" });

  // Use API directly to create account + login for speed/reliability
  const signupResp = await page.evaluate(async ({ email }) => {
    const r = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Teste Modais", email, password: "senha123", phone: "11999999999", plan: "freemium" }),
    });
    return { status: r.status, body: await r.text() };
  }, { email });
  console.log("signup:", signupResp.status, signupResp.body.slice(0, 200));

  const loginResp = await page.evaluate(async ({ email }) => {
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "senha123" }),
    });
    return { status: r.status, body: await r.text() };
  }, { email });
  console.log("login:", loginResp.status, loginResp.body.slice(0, 200));

  await page.goto(base + "/carreira.html", { waitUntil: "load" });
  await page.screenshot({ path: "01-carreira-initial.png" });

  // Check if we need to start a career (club picker) — try to detect state
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
  console.log("BODY TEXT SNIPPET:", bodyText);

  // Escolhe um clube
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(200);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForSelector("#screenGame.active, #panel-elenco", { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: "02-game-screen.png" });

  // Abre modal de detalhe do jogador (Elenco)
  await page.click(".m3-nav-item[data-panel='elenco']");
  await page.waitForTimeout(300);
  await page.click("#squadMainList [data-id]");
  await page.waitForSelector("#detailOverlay.open", { timeout: 5000 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: "03-detail-modal.png" });
  await page.click("#detailClose");
  await page.waitForTimeout(200);

  // Vai pra aba Escalação e abre o modal picker (trocar jogador)
  await page.click(".m3-nav-item[data-panel='escalacao']");
  await page.waitForTimeout(300);
  await page.screenshot({ path: "04-escalacao.png" });
  // Clica num disco do campinho pra abrir o picker de troca
  const pieceClicked = await page.evaluate(() => {
    const piece = document.querySelector(".mt-pos-slot, .ct-piece, .button-disc");
    if (piece) { piece.click(); return true; }
    return false;
  });
  console.log("piece clicked:", pieceClicked);
  await page.waitForSelector("#pickerOverlay.open", { timeout: 5000 }).catch((e) => console.log("picker did not open:", e.message));
  await page.waitForTimeout(200);
  await page.screenshot({ path: "05-picker-modal.png" });
  await page.click("#pickerClose").catch(() => {});
  await page.waitForTimeout(200);

  // Vai pra aba Central e simula a rodada -> modal de detalhe do jogo
  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(300);
  await page.click("#btnSimulate");
  await page.waitForSelector("#matchDetailOverlay.open, #roundResultsOverlay.open", { timeout: 10000 });
  await page.waitForTimeout(300);
  const matchModalOpen = await page.evaluate(() => document.getElementById("matchDetailOverlay").classList.contains("open"));
  console.log("match detail modal open:", matchModalOpen);
  await page.screenshot({ path: "06-match-detail-modal.png" });

  if (matchModalOpen) {
    await page.click("#btnMatchDetailContinue");
    await page.waitForSelector("#roundResultsOverlay.open", { timeout: 5000 });
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: "07-round-results-modal.png" });

  await page.click("#btnRoundResultsContinue");
  await page.waitForTimeout(300);
  await page.screenshot({ path: "08-tabela-after.png" });

  // Aba estatísticas
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='competicao']");
  await page.click("#btnOpenEstatisticas");
  await page.waitForTimeout(300);
  await page.screenshot({ path: "09-estatisticas.png" });

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
