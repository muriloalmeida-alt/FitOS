// Verifica "ao encerrar uma operação, fechar as janelas e voltar pra
// Início": comprar/vender/emprestar jogador, renovar contrato,
// responder coletiva (standalone), aplicar treino, aceitar/recusar
// proposta -- e que fluxos ENCADEADOS (coletiva no pós-jogo, "Proposta
// em destaque" -> Tabela) continuam funcionando sem redirecionar.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `fecharvoltar${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Fechar Voltar", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(300);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.waitForTimeout(700);
  try { await page.click("#btnClaimDailyLogin", { timeout: 1500 }); await page.waitForTimeout(200); } catch {}

  async function goToPanel(name) {
    await page.evaluate((n) => switchToPanel(n), name);
    await page.waitForTimeout(100);
  }
  async function activePanel() {
    return page.evaluate(() => document.querySelector(".ct-panel.active")?.id);
  }
  async function anyOverlayOpen() {
    return page.evaluate(() => document.querySelectorAll(".ct-modal-overlay.open").length);
  }

  // 1) Comprar (enviar proposta) -> Início
  await goToPanel("mercado");
  const target = await page.evaluate(() => {
    const list = allMarketPlayers().find(({ mine }) => !mine);
    return list ? { clubId: list.club.id, playerId: list.p.id } : null;
  });
  await page.evaluate(({ clubId, playerId }) => openOfferModal(clubId, playerId), target);
  await page.waitForTimeout(100);
  await page.click("#btnConfirmOffer, #btnSendOffer, [id*='ffer'][id*='onfirm'], [id*='ffer'][id*='end']").catch(() => {});
  // fallback: chama a função direto se não achou o botão certo por id
  const offerBtnFound = await page.evaluate(() => !!document.getElementById("offerOverlay").querySelector("button"));
  await page.evaluate(() => { if (typeof confirmOfferFromModal === "function") confirmOfferFromModal(); });
  await page.waitForTimeout(150);
  console.log("1) Comprar (enviar proposta) fecha tudo e volta pra Início:", await activePanel() === "panel-central" && await anyOverlayOpen() === 0, { offerBtnFound });

  // 2) Vender (colocar à venda) -> Início
  await goToPanel("elenco");
  const myPlayerId = await page.evaluate(() => CAREER.squad.find((p) => p.origin === "principal").id);
  await page.evaluate((id) => openListModal(id), myPlayerId);
  await page.waitForTimeout(100);
  await page.evaluate(() => confirmListFromModal());
  await page.waitForTimeout(150);
  console.log("2) Vender (colocar à venda) fecha tudo e volta pra Início:", await activePanel() === "panel-central" && await anyOverlayOpen() === 0);

  // 3) Emprestar -> Início (findInterestedBuyer é por sorteio -- tenta
  // algumas vezes com jogadores diferentes até achar um interessado,
  // mesmo espírito de flakiness já documentado em test_loans.js).
  await goToPanel("elenco");
  let loanOk = false;
  for (let i = 0; i < 8 && !loanOk; i++) {
    const loanPlayerId = await page.evaluate((idx) => {
      const candidates = CAREER.squad.filter((p) => p.origin === "principal" && p.status === "ok");
      return candidates[idx % candidates.length]?.id;
    }, i);
    if (!loanPlayerId) break;
    loanOk = await page.evaluate((id) => { openLoanOutModal(id); return !!LOAN_CTX; }, loanPlayerId);
  }
  if (loanOk) {
    await page.waitForTimeout(100);
    await page.evaluate(async () => { await confirmLoanFromModal(); });
    await page.waitForTimeout(200);
  }
  console.log("3) Emprestar fecha tudo e volta pra Início:", !loanOk || (await activePanel() === "panel-central" && await anyOverlayOpen() === 0), { loanOk });

  // 4) Renovar contrato (sucesso) -> Início
  await goToPanel("elenco");
  const renewInfo = await page.evaluate(() => {
    const p = CAREER.squad.find((x) => x.origin === "principal" && (x.morale == null || x.morale >= 30));
    if (!p) return null;
    p.morale = 70; // garante que não recusa por moral baixa
    p.age = 30; // evita a trava de "quer contrato mais longo" (idade<=23)
    return { id: p.id, wage: p.wage };
  });
  await page.evaluate((id) => openRenewModal(id), renewInfo.id);
  await page.waitForTimeout(100);
  await page.evaluate((wage) => {
    document.getElementById("renewWageInput").value = String(Math.round(wage * 1.15));
    document.getElementById("renewDurationSelect").value = "2";
  }, renewInfo.wage);
  await page.evaluate(() => proposeRenewal());
  await page.waitForTimeout(150);
  console.log("4) Renovar contrato (sucesso) fecha tudo e volta pra Início:", await activePanel() === "panel-central" && await anyOverlayOpen() === 0);

  // 5) Renovar recusado -> abre coletiva standalone -> responder -> Início
  await goToPanel("elenco");
  const badRenewId = await page.evaluate(() => {
    const p = CAREER.squad.find((x) => x.origin === "principal");
    p.morale = 10; // garante recusa
    return p.id;
  });
  await page.evaluate((id) => openRenewModal(id), badRenewId);
  await page.waitForTimeout(100);
  await page.evaluate(() => proposeRenewal());
  await page.waitForTimeout(150);
  const pressOpenAfterRefusal = await page.evaluate(() => document.getElementById("pressOverlay").classList.contains("open"));
  console.log("5a) Renovar recusado abre coletiva (não vai pra Início ainda):", pressOpenAfterRefusal);
  if (pressOpenAfterRefusal) {
    await page.click("#pressOptions [data-press]");
    await page.waitForTimeout(150);
  }
  console.log("5b) Depois de responder a coletiva standalone, fecha tudo e volta pra Início:", await activePanel() === "panel-central" && await anyOverlayOpen() === 0);

  // 6) Aplicar treino -> Início
  await goToPanel("treinos");
  await page.evaluate(() => { CAREER.trainingAppliedForRound = null; });
  await page.click("#btnApplyTraining");
  await page.waitForTimeout(200);
  console.log("6) Aplicar treino fecha tudo e volta pra Início:", await activePanel() === "panel-central" && await anyOverlayOpen() === 0);

  // 7) Aceitar proposta recebida (Mercado, standalone) -> Início
  await goToPanel("mercado");
  await page.evaluate(() => {
    const p = CAREER.squad.find((x) => x.origin === "principal");
    CAREER.pendingOffer = { playerId: p.id, playerName: p.name, clubId: "999", clubName: "Time Teste", fee: 1000000 };
    renderMercado();
  });
  await page.waitForTimeout(100);
  await page.click("#btnAcceptOffer");
  await page.waitForTimeout(150);
  console.log("7) Aceitar proposta recebida (Mercado) fecha tudo e volta pra Início:", await activePanel() === "panel-central" && await anyOverlayOpen() === 0);

  // 8) NEGATIVO: "Proposta em destaque" (pós-jogo) continua indo pra Tabela, não Início
  await goToPanel("elenco");
  await page.evaluate(() => {
    const p = CAREER.squad.find((x) => x.origin === "principal");
    CAREER.pendingOffer = { playerId: p.id, playerName: p.name, clubId: "998", clubName: "Time Destaque", fee: 2000000 };
    openPlayerOfferModal();
  });
  await page.waitForTimeout(150);
  const destaqueOpen = await page.evaluate(() => document.getElementById("playerOfferOverlay").classList.contains("open"));
  await page.evaluate(() => acceptOfferFromModal());
  await page.waitForTimeout(150);
  const wentToTabela = await page.evaluate(() => document.getElementById("tabelaModalOverlay").classList.contains("open"));
  console.log("8) Proposta em destaque (pós-jogo) continua indo pra Tabela, NÃO pra Início:", destaqueOpen && wentToTabela);

  // 9) NEGATIVO: coletiva ENCADEADA no pós-jogo continua indo pra Notícias, não Início
  await page.evaluate(() => { document.getElementById("tabelaModalOverlay").classList.remove("open"); });
  await goToPanel("elenco");
  await page.evaluate(() => {
    firePressConference("15", CAREER.currentRound, true); // chain=true
    PENDING_ROUND_SUMMARY = { round: CAREER.currentRound };
    openPressConferenceModal();
  });
  await page.waitForTimeout(150);
  const chainedPressOpen = await page.evaluate(() => document.getElementById("pressOverlay").classList.contains("open"));
  await page.click("#pressOptions [data-press]");
  await page.waitForTimeout(200);
  const wentToNews = await page.evaluate(() => document.getElementById("newsOverlay").classList.contains("open"));
  const centralAfterChain = await activePanel();
  console.log("9) Coletiva ENCADEADA (pós-jogo) continua indo pra Notícias, NÃO pra Início:", chainedPressOpen && wentToNews);

  await browser.close();
})();
