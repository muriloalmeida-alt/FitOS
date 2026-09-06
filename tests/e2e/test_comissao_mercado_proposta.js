// Nova feature (pedido do usuário: "no Mercado deu certo mas precisa
// funcionar também na Comissão Técnica") — aceitar a sugestão de
// Mercado da Comissão Técnica (Início ou tela cheia) agora abre a
// MESMA proposta real do Mercado (openOfferModal), em vez de comprar
// na hora (buyPlayer, removida). Ver suggestMarket em carreira.js.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `comissaomercado${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Comissao Mercado", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(300);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.waitForTimeout(3000);
  await page.click("#btnClaimDailyLogin").catch(() => {});
  await page.waitForTimeout(200);

  // Contrata a Comissão Técnica (Menu > Equipe & Treinos).
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='equipe']");
  await page.click("#btnOpenCommission");
  await page.waitForTimeout(200);
  await page.click("#btnHireCommission");
  await page.waitForTimeout(150);
  await page.click("#confirmOkBtn");
  await page.waitForTimeout(200);
  await page.click("#commissionClose");
  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(300);

  // Se não houver sugestão de mercado agora (depende do elenco
  // sorteado), força uma via evaluate -- sem inventar uma mecânica
  // nova, só garante que o teste sempre tem o que clicar.
  await page.evaluate(() => {
    const s = suggestMarket();
    if (!s.canApply) {
      // Fallback: monta um cenário trivial (titular mais fraco vs. um
      // jogador melhor barato de outro time) só pra garantir canApply.
      const starter = CAREER.squad.find((p) => CAREER.lineup.starters.includes(p.id));
      if (starter) starter.overall = 40;
    }
    renderAll();
  });
  await page.waitForTimeout(200);

  const suggestionBefore = await page.evaluate(() => suggestMarket());
  const marketBtnInfo = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("#commissionSummaryList .m3-commission-icon-btn")].find((b) => b.title.startsWith("Mercado:"));
    return btn ? { disabled: btn.disabled, hasSuggestion: btn.classList.contains("has-suggestion"), title: btn.title } : null;
  });
  console.log("1) Botão de Mercado está clicável (has-suggestion) com sugestão de verdade:",
    !!marketBtnInfo && !marketBtnInfo.disabled && marketBtnInfo.hasSuggestion, JSON.stringify({ suggestionBefore, marketBtnInfo }));

  const cashBefore = await page.evaluate(() => CAREER.finances.cash);
  const squadCountBefore = await page.evaluate(() => CAREER.squad.length);

  await page.click('#commissionSummaryList .m3-commission-icon-btn[title^="Mercado:"]');
  await page.waitForTimeout(300);

  // 2) Clicar NÃO compra na hora -- abre a proposta real (offerOverlay),
  // pré-preenchida com o jogador/clube certos, sem tocar no caixa/elenco.
  const afterClick = await page.evaluate(() => ({
    offerOpen: document.getElementById("offerOverlay").classList.contains("open"),
    offerSub: document.getElementById("offerSub").textContent,
    offerCtx: OFFER_CTX,
    cash: CAREER.finances.cash,
    squadCount: CAREER.squad.length,
    toastVisible: getComputedStyle(document.getElementById("toast")).display !== "none" && document.getElementById("toast").classList.contains("show"),
  }));
  console.log("2) Clicar abre a proposta real (não compra na hora, caixa/elenco intactos):",
    afterClick.offerOpen && !!afterClick.offerCtx && afterClick.cash === cashBefore && afterClick.squadCount === squadCountBefore,
    JSON.stringify({ offerOpen: afterClick.offerOpen, offerSub: afterClick.offerSub, offerCtx: afterClick.offerCtx, cashChanged: afterClick.cash !== cashBefore, squadChanged: afterClick.squadCount !== squadCountBefore }));

  // 2b) Não mostra o toast genérico de "aceita/aplicada" (seria
  // enganoso -- nada foi decidido ainda, só abriu a tela).
  console.log("2b) Sem toast de 'aceita' precoce (a confirmação real é dentro da proposta):", !afterClick.toastVisible, afterClick.toastVisible);

  // 3) Confirmar a proposta dentro do modal cria a negociação de
  // verdade (CAREER.pendingOffersOut), com o toast certo de "enviada".
  await page.click("#btnOfferConfirm");
  await page.waitForTimeout(300);
  const afterConfirm = await page.evaluate(() => ({
    offerClosed: !document.getElementById("offerOverlay").classList.contains("open"),
    pendingCount: (CAREER.pendingOffersOut || []).length,
    toastTitle: document.querySelector("#toast .ct-toast-title")?.textContent || document.getElementById("toast").textContent,
  }));
  console.log("3) Confirmar dentro do modal cria a proposta de verdade (pendingOffersOut) e mostra 'enviada ao <clube>':",
    afterConfirm.offerClosed && afterConfirm.pendingCount === 1 && afterConfirm.toastTitle.includes("enviada"), JSON.stringify(afterConfirm));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
