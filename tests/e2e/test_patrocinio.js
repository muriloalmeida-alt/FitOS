const { chromium } = require("playwright-core");

async function newCareer(page, base, email) {
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Patrocinio Test", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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
  await newCareer(page, base, `patro${Date.now()}@teste.com`);

  // 1) Carreira nova já nasce com os 2 contratos de patrocínio.
  let career = await getCareer(page);
  console.log("1) Nasce com contrato master:", !!career.sponsorship.master, "| material:", !!career.sponsorship.material);
  console.log("   Valores plausíveis:", career.sponsorship.master.valorTemporada > 0, career.sponsorship.material.valorTemporada > 0);

  // 2) Card "Patrocínios" aparece na Central com os 2 contratos.
  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(300);
  const boxText = await page.evaluate(() => document.getElementById("sponsorshipBox").textContent);
  console.log("2) Card mostra Patrocinador Master e Material Esportivo:", boxText.includes("Patrocinador Master") && boxText.includes("Material Esportivo"));

  // 3) Contrato vence (temporadasRestantes chega a 0) -- vira propostas
  // pendentes e o botão "Ver propostas" aparece.
  career = await getCareer(page);
  career.sponsorship.master.temporadasRestantes = 1;
  career.currentRound = 39; // temporada terminada, pronta pra avançar
  await putCareer(page, career);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(300);
  await page.click("#btnAdvanceSeason");
  await page.waitForTimeout(200);
  await page.click("#confirmOkBtn");
  await page.waitForTimeout(500);
  career = await getCareer(page);
  console.log("3) Contrato master venceu (null) e virou propostas pendentes:", career.sponsorship.master === null, "| 3 propostas:", (career.sponsorProposals.master || []).length === 3);
  console.log("   Material (tinha mais tempo) continua igual:", !!career.sponsorship.material);

  // Fecha o modal de nova temporada pra poder navegar.
  await page.click("#btnSeasonContinue").catch(() => {});
  await page.waitForTimeout(300);
  // O card de Patrocínios mora na aba Clube desde o reskin M3 (Bloco 1,
  // Início/Clube) — não mais na Central (pré-existente, sem relação
  // com o checklist de UX desta etapa; o teste nunca foi atualizado).
  await page.click(".m3-nav-item[data-panel='clube']");
  await page.waitForTimeout(300);

  // 4) Botão "Ver propostas" aparece só pro master (vencido).
  const hasBtnMaster = await page.evaluate(() => !!document.querySelector('[data-sponsor-choose="master"]'));
  const hasBtnMaterial = await page.evaluate(() => !!document.querySelector('[data-sponsor-choose="material"]'));
  console.log("4) Botão 'Ver propostas' só aparece pro master:", hasBtnMaster && !hasBtnMaterial);

  // 5) Abre o modal, assina uma proposta, confere que o contrato é
  // atualizado e o caixa cresce nas rodadas seguintes.
  const cashBefore = career.finances.cash;
  await page.click('[data-sponsor-choose="master"]');
  await page.waitForSelector("#sponsorProposalsOverlay.open");
  await page.waitForTimeout(200);
  const proposalRows = await page.evaluate(() => document.querySelectorAll("#sponsorProposalsList .mt-sponsor-proposal-row").length);
  await page.click('[data-sponsor-sign="0"]');
  await page.waitForTimeout(300);
  career = await getCareer(page);
  console.log("5) Modal mostrou 3 propostas:", proposalRows === 3, "| contrato master assinado (não é mais null):", !!career.sponsorship.master);

  // "Ir para o jogo" mora na aba Início -- volta pra lá antes de continuar.
  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(200);

  // 6) Receita de patrocínio soma no caixa a cada rodada simulada.
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
  // FASE 4 (item 2) — coletiva de imprensa pode aparecer aqui antes
  // dos Resultados da rodada (ver determineMatchPressTrigger).
  if (await page.evaluate(() => document.getElementById("pressOverlay").classList.contains("open"))) {
    await page.click("#pressOptions [data-press]");
    await page.waitForTimeout(300);
  }
  await page.waitForSelector("#newsOverlay.open", { timeout: 5000 });
  // A linha financeira da rodada (salários/patrocínio/caixa) mora em
  // Notícias (#newsFinanceRow) desde uma mudança anterior desta sessão
  // ("resumo financeiro movido pras Notícias") -- não mais em
  // Resultados da rodada (pré-existente, sem relação com o checklist
  // de UX desta etapa; o teste nunca foi atualizado).
  const financeText = await page.evaluate(() => document.getElementById("newsFinanceRow").textContent);
  console.log("6) Linha financeira da rodada menciona patrocínio:", financeText.includes("Patrocínio"));
  await page.click("#btnNewsContinue");
  await page.waitForTimeout(300);
  await page.click("#btnRoundResultsContinue").catch(() => {});
  await page.waitForTimeout(200);
  await page.click("#tabelaModalClose").catch(() => {});
  await page.waitForTimeout(200);

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
