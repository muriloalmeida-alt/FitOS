const { chromium } = require("playwright-core");

async function newCareer(page, base, email) {
  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Tabela Modal Test", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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
  await newCareer(page, base, `tabmodal${Date.now()}@teste.com`);

  // Fica na aba Elenco de propósito -- pra provar que "Ver tabela
  // atualizada" NÃO troca de aba (pedido do usuário).
  await page.click(".m3-nav-item[data-panel='elenco']");
  await page.waitForTimeout(300);

  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(300);
  // Volta pra Elenco antes de simular, só pra deixar registrado que a
  // aba ativa é Elenco quando o fluxo de simular começa.
  await page.click(".m3-nav-item[data-panel='elenco']");
  await page.waitForTimeout(200);
  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(200);

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
  await page.waitForTimeout(200);
  if (await page.evaluate(() => document.getElementById("pressOverlay").classList.contains("open"))) {
    await page.click("#pressOptions [data-press]");
  }
  await page.waitForSelector("#newsOverlay.open", { timeout: 5000 });
  await page.click("#btnNewsContinue");
  await page.waitForSelector("#roundResultsOverlay.open");
  await page.waitForTimeout(200);

  // Marca a aba ativa ANTES de clicar em "Ver tabela atualizada".
  const activePanelBefore = await page.evaluate(() => document.querySelector(".ct-panel.active").id);
  await page.click("#btnRoundResultsContinue");
  // AJUSTE (item 6, pedido do usuário) — pode ter surgido proposta por
  // jogador nessa rodada (sorteio de sempre, ver maybeGenerateOffer);
  // nesse caso o modal de destaque aparece ANTES da Tabela — fecha no X
  // (não decide nada, só segue o fluxo, ver closePlayerOfferModal) pra
  // não travar esse teste, que não é sobre isso.
  if (await page.waitForSelector("#playerOfferOverlay.open", { timeout: 1500 }).then(() => true).catch(() => false)) {
    await page.click("#playerOfferClose");
  }
  await page.waitForSelector("#tabelaModalOverlay.open", { timeout: 5000 });
  const activePanelAfter = await page.evaluate(() => document.querySelector(".ct-panel.active").id);
  console.log("1) Modal da tabela abriu:", true, "| aba ativa não mudou:", activePanelBefore === activePanelAfter, `(${activePanelBefore})`);

  // Modal é tela cheia.
  const modalInfo = await page.evaluate(() => {
    const overlay = document.getElementById("tabelaModalOverlay");
    const modal = overlay.querySelector(".ct-modal");
    const rect = modal.getBoundingClientRect();
    return { hasClass: overlay.classList.contains("ct-modal-fullscreen"), w: rect.width, h: rect.height, vw: window.innerWidth, vh: window.innerHeight };
  });
  console.log("2) Modal é tela cheia:", modalInfo.hasClass, "| ocupa toda largura:", modalInfo.w >= modalInfo.vw - 2, "| ocupa toda altura:", modalInfo.h >= modalInfo.vh - 2);

  // Tabela dentro do modal tem os mesmos dados da aba Tabela.
  const rowsMatch = await page.evaluate(() => {
    const modalRows = document.querySelectorAll("#standingsTableModal .mt-tr").length;
    return modalRows;
  });
  console.log("3) Tabela do modal tem 20 linhas (times):", rowsMatch === 20);

  const meRow = await page.evaluate(() => {
    const tr = document.querySelector("#standingsTableModal .mt-tr.highlight");
    return tr ? tr.textContent.includes("Flamengo") : false;
  });
  console.log("4) Linha do próprio clube aparece destacada:", meRow);

  // Fecha no X e confirma que continua na mesma aba (sem navegar).
  await page.click("#tabelaModalClose");
  await page.waitForTimeout(200);
  const stillClosed = await page.evaluate(() => !document.getElementById("tabelaModalOverlay").classList.contains("open"));
  const panelAfterClose = await page.evaluate(() => document.querySelector(".ct-panel.active").id);
  console.log("5) X fecha o modal:", stillClosed, "| continua na mesma aba de antes:", panelAfterClose === activePanelBefore);

  // A aba Tabela normal (clicando na nav) continua funcionando do jeito
  // de sempre, sem modal.
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='competicao']");
  await page.click("#btnOpenTabela");
  await page.waitForTimeout(300);
  const tabRows = await page.evaluate(() => document.querySelectorAll("#standingsTable .mt-tr").length);
  const modalStillClosed = await page.evaluate(() => !document.getElementById("tabelaModalOverlay").classList.contains("open"));
  console.log("6) Aba Tabela de sempre continua funcionando (20 linhas, sem modal aberto):", tabRows === 20, modalStillClosed);

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
