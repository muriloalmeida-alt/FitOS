const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("dialog", (d) => d.accept());

  const base = "http://localhost:8787";
  const email = `mercado2_${Date.now()}@teste.com`;

  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Mercado Dois", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });

  await page.goto(base + "/carreira.html", { waitUntil: "load" });
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(200);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnOnboardSkip", { timeout: 2000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
  await page.click(".m3-nav-item[data-panel='mercado']");
  await page.waitForTimeout(300);

  // Colocar um jogador à venda direto do Mercado -- Bloco 3 (pedido do
  // usuário) trocou "Vender" instantâneo (confirmModal) por um anúncio
  // real (openListModal/#listOverlay), que só vira dinheiro quando uma
  // proposta chega e o técnico aceita (ver acceptListingOffer). Teste
  // atualizado: anuncia, força uma proposta chegar na hora (RNG) e
  // aceita, pra continuar cobrindo o mesmo cenário ("vendeu um
  // jogador") sem depender de rodadas reais passarem.
  const cashBefore = await page.evaluate(async () => (await (await fetch("/api/career")).json()).career.finances.cash);
  // Fase 1.4 (Negotiation AI) — a negociação agora respeita a
  // capacidade financeira REAL do comprador (buyerHardCap), não só a
  // elegibilidade graduada de financeiroScore (Fase 1.3.2, que permite
  // um clube "esticado" pontuar >0 mesmo sem caixa pra fechar o
  // negócio de verdade). O 1º jogador da lista (ordem por posição,
  // GOL primeiro) podia ser o mais caro do elenco — nenhum dos 19
  // clubes reais do Brasileirão desta carreira teria caixa suficiente
  // pra realmente pagar por ele. Lista o jogador de MENOR valor
  // (ainda "principal") pra um cenário plausível de venda de verdade.
  // Filtra o Mercado pro PRÓPRIO clube (senão o jogador mais barato do
  // seu elenco fica fora dos 40 primeiros da lista global, ordenada
  // por valor decrescente entre TODOS os ~1300 jogadores do mercado).
  await page.evaluate(() => {
    const sel = document.getElementById("marketClubFilter");
    sel.value = String(CAREER.clubId);
    sel.dispatchEvent(new Event("change"));
  });
  await page.waitForTimeout(150);
  const cheapestId = await page.evaluate(() => {
    const cheapest = CAREER.squad.filter((p) => p.origin === "principal").sort((a, b) => a.value - b.value)[0];
    return cheapest.id;
  });
  const listBtn = await page.$(`[data-list="${cheapestId}"]`);
  await listBtn.click();
  await page.waitForSelector("#listOverlay.open", { timeout: 5000 });
  await page.click("#btnListConfirm");
  await page.waitForTimeout(250);
  // Fase 1.4 (Negotiation AI) — maybeSpawnListingOffer não gera mais a
  // oferta direto de transferValuation: agora passa por negotiateOffer
  // (reserva do vendedor vs. tolerância do comprador), que pode
  // legitimamente terminar em "walked" pro primeiro clube sorteado.
  // Forçar Math.random pra um valor fixo único (0.01) deixou de
  // garantir oferta sempre — precisa de várias tentativas com RNG real
  // pra dar chance de outro comprador/negociação ter sucesso, mesmo
  // padrão já usado nos testes da Fase 1.2/1.3/1.4 ("cenário favorável,
  // até N tentativas").
  await page.evaluate(() => {
    const listing = CAREER.pendingListings[0];
    for (let i = 0; i < 300 && listing.offers.length === 0; i++) maybeSpawnListingOffer(listing);
  });
  await page.evaluate(() => {
    const listing = CAREER.pendingListings[0];
    const offer = listing.offers[0];
    if (offer) acceptListingOffer(listing.id, offer.id);
  });
  await page.waitForTimeout(300);
  // FASE 4 (item 2) — venda de jogador de overall alto pode abrir a
  // coletiva "venda de jogador querido pela torcida" (mesmo padrão já
  // usado em outros testes desta sessão, ex.: test_confirm_modals.js).
  if (await page.evaluate(() => document.getElementById("pressOverlay").classList.contains("open"))) {
    await page.click("#pressOptions [data-press]");
    await page.waitForTimeout(300);
  }
  await page.evaluate(async () => { await persistCareer(); });
  const afterSell = await page.evaluate(async () => {
    const r = await (await fetch("/api/career")).json();
    return { cash: r.career.finances.cash, squadLen: r.career.squad.length };
  });
  console.log(`Vendeu: caixa ${cashBefore} -> ${afterSell.cash}, elenco tem ${afterSell.squadLen} jogadores`);
  await page.screenshot({ path: "mercado2-depois-vender.png" });

  // Confirmar o anúncio (#btnListConfirm) já fechou tudo e voltou pra
  // Início (Task #72) -- volta pro Mercado antes de continuar.
  await page.evaluate(() => switchToPanel("mercado"));
  await page.waitForTimeout(150);
  // Desfaz o filtro "meu clube" usado só pra achar o jogador mais
  // barato pra vender (senão a lista de "comprar" abaixo fica vazia,
  // já que não dá pra comprar de você mesmo).
  await page.evaluate(() => {
    const sel = document.getElementById("marketClubFilter");
    sel.value = "";
    sel.dispatchEvent(new Event("change"));
  });
  await page.waitForTimeout(150);

  // Comprar um jogador barato -- Bloco 3 (pedido do usuário, mockups
  // brtreinadorbloco3mercado.html) mudou "Comprar" pra abrir uma
  // NEGOCIAÇÃO (ver openOfferModal em carreira.js), não mais compra
  // instantânea via confirmModal. Propõe o valor de mercado à vista
  // (garante aceite quase certo) e resolve na hora (RNG forçado),
  // igual ao script dedicado test_mercado_negociacao.js.
  const buyBtns = await page.$$("[data-buy]");
  const cheapestBuy = buyBtns[buyBtns.length - 1];
  await cheapestBuy.click();
  await page.waitForSelector("#offerOverlay.open", { timeout: 5000 });
  await page.click("#btnOfferConfirm");
  await page.waitForTimeout(200);
  await page.evaluate(async () => {
    const orig = Math.random;
    Math.random = () => 0.01;
    resolvePendingOffersOutRound(CAREER.currentRound); // OFFER_WAIT_ROUNDS=2 -- 1ª chamada só decrementa
    resolvePendingOffersOutRound(CAREER.currentRound); // 2ª chamada zera o prazo e resolve de verdade
    Math.random = orig;
    renderMercado();
    await persistCareer(); // "afterBuy" abaixo lê /api/career (servidor), precisa estar salvo
  });
  await page.waitForTimeout(300);
  // FASE 4 (item 2) — mesma ideia, agora pro lado de "contratação
  // polêmica anunciada" (buyPlayer, overall >= 82).
  if (await page.evaluate(() => document.getElementById("pressOverlay").classList.contains("open"))) {
    await page.click("#pressOptions [data-press]");
    await page.waitForTimeout(300);
  }
  const afterBuy = await page.evaluate(async () => {
    const r = await (await fetch("/api/career")).json();
    return { cash: r.career.finances.cash, squadLen: r.career.squad.length };
  });
  console.log(`Comprou: caixa -> ${afterBuy.cash}, elenco tem ${afterBuy.squadLen} jogadores`);

  // Enviar a proposta (#btnOfferConfirm) já fechou tudo e voltou pra
  // Início (Task #72) -- volta pro Mercado antes de continuar.
  await page.evaluate(() => switchToPanel("mercado"));
  await page.waitForTimeout(150);

  // Filtro por posição
  await page.selectOption("#marketPosFilter", "G");
  await page.waitForTimeout(200);
  const rows = await page.$$eval(".m3-op-card", (els) => els.map((e) => e.querySelector(".mt-pos-chip").textContent));
  console.log("Filtro GOL - posições encontradas:", [...new Set(rows)]);
  await page.screenshot({ path: "mercado2-filtro-gol.png" });

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
