// Verifica os 5 ajustes pedidos na revisão das modais de pós-jogo:
// a) Seu jogo — botão Fechar abaixo de Continuar
// b) Notícias — botão Fechar abaixo de Continuar
// c) Resultados da rodada — "Ver tabela atualizada" virou "Continuar" + Fechar
// d) Resultados da rodada — seção de notícias (Rádio Data FM) removida
// e) Tabela da carreira — mesmo layout de rodapé fixo, só com Fechar
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `posjogo${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Pos Jogo", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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
  // Zera a chance de coletiva de imprensa (mesmo hábito de sempre) pra
  // esse teste ser determinístico — o foco aqui é a sequência de
  // botões das modais, não a coletiva.
  await page.evaluate(() => {
    Object.keys(PRESS_CHANCE_BY_ID).forEach((k) => { PRESS_CHANCE_BY_ID[k] = 0; });
    PRESS_ALWAYS_IDS.clear();
  });
  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(200);
  await page.click("#btnSimulate");
  await page.waitForSelector("#preMatchOverlay.open", { timeout: 5000 });
  await page.click("#btnPreMatchGo");
  await page.waitForSelector("#liveMatchOverlay.open", { timeout: 5000 });
  await page.evaluate(() => skipLiveMatch());
  await page.waitForSelector("#matchDetailOverlay.open", { timeout: 5000 });

  // a) Seu jogo — "Fechar" abaixo de "Continuar", mesmo rodapé, e
  // clicar nele SÓ fecha (não avança pra Notícias).
  const a1 = await page.evaluate(() => {
    const cont = document.getElementById("btnMatchDetailContinue");
    const close = document.getElementById("btnMatchDetailCloseFooter");
    return {
      sameFooter: cont.closest(".ct-modal-footer") === close.closest(".ct-modal-footer"),
      closeIsAfter: !!(cont.compareDocumentPosition(close) & Node.DOCUMENT_POSITION_FOLLOWING),
      closeText: close.textContent.trim(),
    };
  });
  console.log("a) Seu jogo — 'Fechar' no mesmo rodapé, logo abaixo de 'Continuar':", a1.sameFooter && a1.closeIsAfter, "| texto:", a1.closeText);
  await page.click("#btnMatchDetailCloseFooter");
  await page.waitForTimeout(200);
  const a2 = await page.evaluate(() => ({
    matchDetailClosed: !document.getElementById("matchDetailOverlay").classList.contains("open"),
    newsOpened: document.getElementById("newsOverlay").classList.contains("open"),
  }));
  console.log("   'Fechar' só fecha (não abre Notícias em seguida):", a2.matchDetailClosed && !a2.newsOpened);

  // Reabre o fluxo do zero pra testar Notícias/Resultados/Tabela.
  await page.click("#btnSimulate");
  await page.waitForSelector("#preMatchOverlay.open", { timeout: 5000 });
  await page.click("#btnPreMatchGo");
  await page.waitForSelector("#liveMatchOverlay.open", { timeout: 5000 });
  await page.evaluate(() => skipLiveMatch());
  await page.waitForSelector("#matchDetailOverlay.open", { timeout: 5000 });
  await page.click("#btnMatchDetailContinue");
  await page.waitForTimeout(200);
  // Coletiva de imprensa é probabilística mesmo com a chance zerada
  // (PRESS_ALWAYS_IDS cobre só uma parte dos gatilhos) — se aparecer,
  // responde a primeira opção pra seguir o fluxo até Notícias.
  if (await page.evaluate(() => document.getElementById("pressOverlay").classList.contains("open"))) {
    await page.click("#pressOptions [data-press]");
    await page.waitForTimeout(200);
  }
  await page.waitForSelector("#newsOverlay.open", { timeout: 5000 });

  // b) Notícias — "Fechar" abaixo de "Continuar".
  const b1 = await page.evaluate(() => {
    const cont = document.getElementById("btnNewsContinue");
    const close = document.getElementById("btnNewsCloseFooter");
    return {
      sameFooter: cont.closest(".ct-modal-footer") === close.closest(".ct-modal-footer"),
      closeIsAfter: !!(cont.compareDocumentPosition(close) & Node.DOCUMENT_POSITION_FOLLOWING),
      bothVisible: cont.getBoundingClientRect().height > 0 && close.getBoundingClientRect().height > 0,
    };
  });
  console.log("b) Notícias — 'Fechar' no mesmo rodapé, logo abaixo de 'Continuar', ambos visíveis:", b1.sameFooter && b1.closeIsAfter && b1.bothVisible);
  await page.click("#btnNewsCloseFooter");
  await page.waitForTimeout(200);
  const b2 = await page.evaluate(() => ({
    newsClosed: !document.getElementById("newsOverlay").classList.contains("open"),
    roundResultsOpened: document.getElementById("roundResultsOverlay").classList.contains("open"),
  }));
  console.log("   'Fechar' só fecha (não abre Resultados da rodada em seguida):", b2.newsClosed && !b2.roundResultsOpened);

  // Reabre de novo pra chegar em Resultados da rodada.
  await page.click("#btnSimulate");
  await page.waitForSelector("#preMatchOverlay.open", { timeout: 5000 });
  await page.click("#btnPreMatchGo");
  await page.waitForSelector("#liveMatchOverlay.open", { timeout: 5000 });
  await page.evaluate(() => skipLiveMatch());
  await page.waitForSelector("#matchDetailOverlay.open", { timeout: 5000 });
  await page.click("#btnMatchDetailContinue");
  await page.waitForTimeout(200);
  if (await page.evaluate(() => document.getElementById("pressOverlay").classList.contains("open"))) {
    await page.click("#pressOptions [data-press]");
    await page.waitForTimeout(200);
  }
  await page.waitForSelector("#newsOverlay.open", { timeout: 5000 });
  await page.click("#btnNewsContinue");
  await page.waitForSelector("#roundResultsOverlay.open", { timeout: 5000 });

  // c) Resultados da rodada — botão renomeado pra "Continuar" + "Fechar" abaixo.
  const c1 = await page.evaluate(() => {
    const cont = document.getElementById("btnRoundResultsContinue");
    const close = document.getElementById("btnRoundResultsCloseFooter");
    return {
      contText: cont.textContent.trim(),
      sameFooter: cont.closest(".ct-modal-footer") === close.closest(".ct-modal-footer"),
      closeIsAfter: !!(cont.compareDocumentPosition(close) & Node.DOCUMENT_POSITION_FOLLOWING),
    };
  });
  console.log("c) Resultados da rodada — botão renomeado pra 'Continuar':", c1.contText === "Continuar", "| 'Fechar' no mesmo rodapé, logo abaixo:", c1.sameFooter && c1.closeIsAfter);

  // d) Seção de notícias (Rádio Data FM) removida.
  const d1 = await page.evaluate(() => ({
    noNewsSection: !document.getElementById("roundResultsNews"),
    noRadioText: !document.querySelector("#roundResultsOverlay")?.textContent.includes("Rádio Data FM"),
  }));
  console.log("d) Seção 'Rádio Data FM' removida de Resultados da rodada:", d1.noNewsSection && d1.noRadioText);

  // "Fechar" só fecha, sem abrir Tabela/proposta em seguida.
  await page.click("#btnRoundResultsCloseFooter");
  await page.waitForTimeout(200);
  const c2 = await page.evaluate(() => ({
    roundResultsClosed: !document.getElementById("roundResultsOverlay").classList.contains("open"),
    tabelaOpened: document.getElementById("tabelaModalOverlay").classList.contains("open"),
  }));
  console.log("   'Fechar' só fecha (não abre Tabela/proposta em seguida):", c2.roundResultsClosed && !c2.tabelaOpened);

  // e) Tabela da carreira — mesmo layout (rodapé fixo), só "Fechar".
  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(200);
  await page.evaluate(() => openTabelaModal());
  await page.waitForSelector("#tabelaModalOverlay.open", { timeout: 5000 });
  const e1 = await page.evaluate(() => {
    const close = document.getElementById("btnTabelaModalCloseFooter");
    const footer = close.closest(".ct-modal-footer");
    const body = close.closest(".ct-modal-body");
    return {
      insideFooter: !!footer,
      insideBody: !!body,
      onlyButton: footer.querySelectorAll("button").length === 1,
      footerFlexShrink0: footer ? getComputedStyle(footer).flexShrink === "0" : false,
    };
  });
  console.log("e) Tabela da carreira — rodapé fixo (mesmo layout), só com 'Fechar':", e1.insideFooter && !e1.insideBody && e1.onlyButton && e1.footerFlexShrink0);
  await page.click("#btnTabelaModalCloseFooter");
  await page.waitForTimeout(150);
  const e2 = await page.evaluate(() => !document.getElementById("tabelaModalOverlay").classList.contains("open"));
  console.log("   'Fechar' fecha a Tabela normalmente:", e2);

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
