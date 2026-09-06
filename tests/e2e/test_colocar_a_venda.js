// Nova feature (Bloco 3, 3/4 — pedido do usuário: "colocar à venda")
// — "Vender" vira um anúncio de verdade (CAREER.pendingListings), com
// múltiplas propostas reais chegando ao longo das rodadas, em vez de
// vender na hora pro 1º interessado aleatório (sellPlayer, removida).
// Ver openListModal/resolvePendingListingsRound/acceptListingOffer em
// carreira.js.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `colocaravenda${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Colocar Venda", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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
  await page.click(".m3-nav-item[data-panel='mercado']");
  await page.waitForTimeout(300);
  // Folga o teto/caixa pra nenhuma trava de orçamento atrapalhar as
  // checagens (o foco aqui é o fluxo de anúncio, não finanças).
  await page.evaluate(() => { CAREER.finances.wageCap = 999999999; CAREER.finances.cash = 999999999; });

  // 0) Achar um jogador MEU no Mercado (busca vazia + scroll não
  // garante, então busca pelo nome de um jogador do próprio elenco).
  const target = await page.evaluate(() => {
    const p = CAREER.squad.find((x) => x.origin === "principal");
    return { id: p.id, name: p.name, value: p.value };
  });
  await page.fill("#marketSearch", target.name.split(" ")[0]);
  await page.waitForTimeout(200);

  // 1) Botão "Colocar à venda" (não mais "Vender" instantâneo) abre o
  // sheet de anúncio, pré-preenchido com o valor de mercado.
  await page.click(`[data-list="${target.id}"]`);
  await page.waitForTimeout(200);
  const check1 = await page.evaluate((v) => ({
    open: document.getElementById("listOverlay").classList.contains("open"),
    value: Number(document.getElementById("listValueInput").value),
    sub: document.getElementById("listSub").textContent,
  }), target.value);
  console.log("1) 'Colocar à venda' abre o sheet pré-preenchido com o valor de mercado:",
    check1.open && check1.value === target.value, JSON.stringify(check1));

  // 2) Confirmar cria o anúncio (sem vender na hora) — caixa/elenco
  // intactos, jogador continua no time, ícone vira 'pendente'.
  const cashBefore = await page.evaluate(() => CAREER.finances.cash);
  const squadBefore = await page.evaluate(() => CAREER.squad.length);
  await page.click("#btnListConfirm");
  await page.waitForTimeout(300);
  const check2b = await page.evaluate(({ id, cashBefore, squadBefore }) => ({
    listingCount: (CAREER.pendingListings || []).length,
    cashUnchanged: CAREER.finances.cash === cashBefore,
    squadUnchanged: CAREER.squad.length === squadBefore,
    modalClosed: !document.getElementById("listOverlay").classList.contains("open"),
    pendingIconShown: !!document.querySelector(`[data-viewlisting="${id}"]`),
  }), { id: target.id, cashBefore, squadBefore });
  console.log("2) Confirmar cria o anúncio sem vender na hora (caixa/elenco intactos, ícone vira 'pendente'):",
    check2b.listingCount === 1 && check2b.cashUnchanged && check2b.squadUnchanged && check2b.modalClosed && check2b.pendingIconShown,
    JSON.stringify(check2b));

  // Confirmar o anúncio agora fecha tudo e volta pra Início (Task #72
  // -- "ao encerrar uma operação... devolver o jogador para a página
  // de Início") -- volta pro Mercado antes de continuar.
  await page.evaluate(() => switchToPanel("mercado"));
  await page.waitForTimeout(150);

  // 3) 'Minhas vendas' mostra o anúncio, sem proposta nenhuma ainda.
  await page.click("#btnOpenMySales");
  await page.waitForTimeout(200);
  const check3 = await page.evaluate(() => ({
    open: document.getElementById("mySalesOverlay").classList.contains("open"),
    countLabel: document.getElementById("mySalesCountLabel").textContent,
    hasEmptyOffersMsg: document.getElementById("mySalesList").textContent.includes("Nenhuma proposta ainda"),
    badge: document.getElementById("mySalesBadge").textContent,
  }));
  console.log("3) 'Minhas vendas' abre com o anúncio listado, sem proposta ainda:",
    check3.open && check3.countLabel.includes("1") && check3.hasEmptyOffersMsg && check3.badge === "1", JSON.stringify(check3));

  // 4) Rodando resolvePendingListingsRound com RNG forçado dentro da
  // chance, uma proposta de verdade chega pro anúncio.
  const check4 = await page.evaluate(() => {
    const orig = Math.random;
    Math.random = () => 0.01; // dentro da chance (< LISTING_OFFER_CHANCE_PER_ROUND) e sorteios internos em valores baixos
    resolvePendingListingsRound();
    Math.random = orig;
    const listing = CAREER.pendingListings[0];
    return { offerCount: listing.offers.length, offer: listing.offers[0] };
  });
  console.log("4) Proposta nasce de verdade (clube com nome/valor plausíveis):",
    check4.offerCount === 1 && !!check4.offer?.clubName && check4.offer?.value > 0, JSON.stringify(check4));
  await page.evaluate(() => renderMySalesScreen());
  await page.waitForTimeout(200);
  const check4b = await page.evaluate(() => document.getElementById("mySalesList").textContent);
  console.log("4b) 'Minhas vendas' mostra a proposta recebida:", check4b.includes(check4.offer.clubName), check4b.includes(check4.offer.clubName) ? "ok" : check4b);

  // 5) Recusar a proposta some só ela — o anúncio continua ativo.
  await page.click("button[data-rejectlisting]");
  await page.waitForTimeout(200);
  const check5 = await page.evaluate(() => ({
    listingStillThere: (CAREER.pendingListings || []).length === 1,
    offerGone: CAREER.pendingListings[0].offers.length === 0,
  }));
  console.log("5) Recusar a proposta some só ela, anúncio continua ativo:", check5.listingStillThere && check5.offerGone, JSON.stringify(check5));

  // 6) Nova proposta à vista -- aceitar fecha a venda de verdade:
  // jogador sai do elenco, vai pro elenco do comprador, caixa recebe o
  // valor cheio na hora.
  const check6 = await page.evaluate((id) => {
    const listing = CAREER.pendingListings.find((l) => l.playerId === id);
    listing.offers.push({ id: "offer_avista", clubId: "gre", clubName: "Grêmio", value: 5000000, installments: 1, round: CAREER.currentRound });
    renderMySalesScreen();
    return true;
  }, target.id);
  const cashBefore6 = await page.evaluate(() => CAREER.finances.cash);
  await page.click(`[data-acceptlisting][data-offer="offer_avista"]`);
  await page.waitForTimeout(300);
  const check6b = await page.evaluate(({ id, cashBefore6 }) => ({
    playerGone: !CAREER.squad.find((p) => p.id === id),
    playerInBuyerSquad: (CAREER.leagueSquads["gre"] || []).some((p) => p.id === id),
    cashDelta: CAREER.finances.cash - cashBefore6,
    listingGone: !CAREER.pendingListings.find((l) => l.playerId === id),
  }), { id: target.id, cashBefore6 });
  console.log("6) Aceitar proposta à vista fecha a venda de verdade (jogador sai, vai pro comprador, caixa recebe tudo na hora):",
    check6b.playerGone && check6b.playerInBuyerSquad && check6b.cashDelta === 5000000 && check6b.listingGone, JSON.stringify(check6b));

  // 7) Novo jogador anunciado + proposta parcelada -- aceitar paga só
  // a 1ª parcela na hora, o resto vira recebível processado rodada a
  // rodada (ver processPendingReceivables).
  const target2 = await page.evaluate(() => {
    const p = CAREER.squad.find((x) => x.origin === "principal");
    return { id: p.id, value: p.value };
  });
  await page.evaluate((id) => {
    CAREER.pendingListings.push({
      id: "listing_parcelado", playerId: id, playerName: CAREER.squad.find((p) => p.id === id).name,
      askingValue: 9000000, marketValue: 9000000, listedRound: CAREER.currentRound,
      offers: [{ id: "offer_parcelado", clubId: "bah", clubName: "Bahia", value: 9000000, installments: 3, round: CAREER.currentRound }],
    });
    renderMySalesScreen();
  }, target2.id);
  // Aceitar a proposta à vista (item 6) já fechou tudo e voltou pra
  // Início (Task #72) -- reabre "Minhas vendas" antes de aceitar a
  // próxima oferta.
  await page.evaluate(() => switchToPanel("mercado"));
  await page.waitForTimeout(100);
  await page.click("#btnOpenMySales");
  await page.waitForTimeout(150);
  const cashBefore7 = await page.evaluate(() => CAREER.finances.cash);
  await page.click(`[data-acceptlisting][data-offer="offer_parcelado"]`);
  await page.waitForTimeout(300);
  const check7 = await page.evaluate(({ id, cashBefore7 }) => ({
    firstPaymentDelta: CAREER.finances.cash - cashBefore7,
    expectedFirst: 3000000,
    receivablesCount: (CAREER.pendingReceivables || []).length,
  }), { id: target2.id, cashBefore7 });
  console.log("7) Proposta parcelada (3x) paga só 1/3 na hora, resto agendado como recebível:",
    check7.firstPaymentDelta === check7.expectedFirst && check7.receivablesCount !== 0, JSON.stringify(check7));
  const receivablesBefore = await page.evaluate(() => JSON.parse(JSON.stringify(CAREER.pendingReceivables)));
  const cashBeforeProcess = await page.evaluate(() => CAREER.finances.cash);
  const received = await page.evaluate(() => processPendingReceivables());
  const check7b = await page.evaluate((cashBeforeProcess) => CAREER.finances.cash - cashBeforeProcess, cashBeforeProcess);
  console.log("7b) processPendingReceivables credita o caixa e decrementa as rodadas restantes:",
    check7b === received && received > 0, JSON.stringify({ receivablesBefore, received, check7b }));

  // 8) Cancelar um anúncio (sem proposta nenhuma) tira o jogador da
  // vitrine sem vender nada -- ele continua no elenco normal.
  // Aceitar a proposta parcelada (item 7) já fechou tudo e voltou pra
  // Início (Task #72) -- "Minhas vendas" não está mais aberta, então
  // não há nada pra fechar aqui.
  await page.click("#mySalesClose").catch(() => {});
  await page.waitForTimeout(150);
  const target3 = await page.evaluate(() => {
    const p = CAREER.squad.find((x) => x.origin === "principal" && !CAREER.pendingListings.some((l) => l.playerId === x.id));
    return p ? p.id : null;
  });
  await page.evaluate((id) => { openListModal(id); }, target3);
  await page.waitForTimeout(150);
  await page.click("#btnListConfirm");
  await page.waitForTimeout(200);
  await page.evaluate(() => switchToPanel("mercado"));
  await page.waitForTimeout(100);
  await page.click("#btnOpenMySales");
  await page.waitForTimeout(200);
  await page.click("button[data-cancellisting]");
  await page.waitForTimeout(200);
  const check8 = await page.evaluate((id) => ({
    listingGone: !CAREER.pendingListings.some((l) => l.playerId === id),
    stillInSquad: !!CAREER.squad.find((p) => p.id === id),
  }), target3);
  console.log("8) Cancelar o anúncio tira da vitrine sem vender (jogador continua no elenco):", check8.listingGone && check8.stillInSquad, JSON.stringify(check8));
  await page.click("#mySalesClose");
  await page.waitForTimeout(150);

  // 9) Detalhe do jogador: "Vender" agora abre o mesmo sheet de
  // anúncio (não vende na hora) — e mostra "Ver anúncio de venda" pra
  // quem já está anunciado.
  const target4 = await page.evaluate(() => {
    const p = CAREER.squad.find((x) => x.origin === "principal" && !CAREER.pendingListings.some((l) => l.playerId === x.id));
    return p.id;
  });
  await page.evaluate((id) => openDetail(id), target4);
  await page.waitForTimeout(200);
  const sellBtnLabelBefore = await page.evaluate(() => document.querySelector('[data-act="sell"]')?.textContent);
  await page.click('[data-act="sell"]');
  await page.waitForTimeout(200);
  const check9 = await page.evaluate(() => ({
    listOpen: document.getElementById("listOverlay").classList.contains("open"),
    detailStillOpen: document.getElementById("detailOverlay").classList.contains("open"),
  }));
  console.log("9) 'Vender' no detalhe abre o sheet de anúncio (detalhe continua aberto por baixo, não vende na hora):",
    check9.listOpen && check9.detailStillOpen, JSON.stringify({ sellBtnLabelBefore, ...check9 }));
  await page.click("#btnListConfirm");
  await page.waitForTimeout(200);
  await page.evaluate((id) => openDetail(id), target4);
  await page.waitForTimeout(200);
  const check9b = await page.evaluate(() => document.querySelector('[data-act="sell"]')?.textContent);
  console.log("9b) Depois de anunciado, o botão muda pra 'Ver anúncio de venda':", check9b === "Ver anúncio de venda", check9b);

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
