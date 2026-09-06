// Nova feature (Bloco 3 — pedido do usuário, mockups
// brtreinadorbloco3mercado.html/brtreinadorbloco3pendentes.html) —
// negociação de compra: proposta demora rodadas pra responder, pode
// aumentar/retirar, contraproposta do clube, parcelamento real.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `mercadoneg${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Neg Mercado", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  await page.click(".m3-nav-item[data-panel='mercado']");
  await page.waitForTimeout(300);

  // 1) Clicar "Comprar" abre a modal de PROPOSTA (não compra na hora)
  // -- valor pré-preenchido com o de mercado.
  const buyBtnInfo = await page.evaluate(() => {
    const btn = document.querySelector("#marketList [data-buy]");
    return { exists: !!btn, club: btn?.dataset.club, playerId: btn?.dataset.buy };
  });
  console.log("0) Achou um botão de propor no Mercado:", buyBtnInfo.exists, JSON.stringify(buyBtnInfo));
  await page.click("#marketList [data-buy]");
  await page.waitForTimeout(200);
  const modalInfo = await page.evaluate(() => ({
    open: document.getElementById("offerOverlay").classList.contains("open"),
    value: Number(document.getElementById("offerValueInput").value),
    sub: document.getElementById("offerSub").textContent,
  }));
  console.log("1) Clicar 'Comprar' abre a modal de proposta com o valor de mercado pré-preenchido:",
    modalInfo.open && modalInfo.value > 0 && modalInfo.sub.length > 5, JSON.stringify(modalInfo));

  // 2) Propor um valor MENOR que o de mercado, parcelado em 2x -- vira
  // pendingOffersOut, some da lista de compra (vira o ícone de
  // pendente), cash NÃO muda ainda (só quando aceitar).
  const cashBefore = await page.evaluate(() => CAREER.finances.cash);
  await page.evaluate((info) => {
    document.getElementById("offerValueInput").value = Math.round(info.value * 0.7);
    document.getElementById("offerInstallmentsSelect").value = "2";
  }, modalInfo);
  await page.click("#btnOfferConfirm");
  await page.waitForTimeout(200);
  const afterOffer = await page.evaluate((info) => {
    const o = CAREER.pendingOffersOut.find((x) => String(x.playerId) === String(info.playerId));
    return {
      cashUnchanged: CAREER.finances.cash === info.cashBefore,
      offer: o ? { offerValue: o.offerValue, installments: o.installments, roundsLeft: o.roundsLeft, status: o.status } : null,
      pendingIconShown: !!document.querySelector(`#marketList [data-viewoffer="${info.playerId}"]`),
      modalClosed: !document.getElementById("offerOverlay").classList.contains("open"),
    };
  }, { playerId: buyBtnInfo.playerId, cashBefore });
  console.log("2) Propor valor menor (70%) parcelado em 2x cria a proposta, cash não muda ainda, ícone vira 'pendente':",
    afterOffer.cashUnchanged && afterOffer.offer && afterOffer.offer.installments === 2 && afterOffer.offer.status === "pending"
    && afterOffer.pendingIconShown && afterOffer.modalClosed, JSON.stringify(afterOffer));

  // Enviar a proposta (#btnOfferConfirm) já fechou tudo e voltou pra
  // Início (Task #72) -- volta pro Mercado antes de continuar.
  await page.evaluate(() => switchToPanel("mercado"));
  await page.waitForTimeout(150);

  // 3) "Minhas propostas" mostra a proposta em andamento com o badge
  // certo; clicar no ícone de pendente no Mercado também abre essa tela.
  await page.click(`#marketList [data-viewoffer="${buyBtnInfo.playerId}"]`);
  await page.waitForTimeout(200);
  const myOffersInfo = await page.evaluate(() => ({
    open: document.getElementById("myOffersOverlay").classList.contains("open"),
    rowCount: document.querySelectorAll("#myOffersList .mt-sponsor-proposal-row").length,
    badgeText: document.getElementById("myOffersBadge").textContent,
    badgeHidden: document.getElementById("myOffersBadge").classList.contains("hidden"),
  }));
  console.log("3) 'Minhas propostas' abre com 1 proposta listada e o badge mostrando 1:",
    myOffersInfo.open && myOffersInfo.rowCount === 1 && myOffersInfo.badgeText === "1" && !myOffersInfo.badgeHidden, JSON.stringify(myOffersInfo));
  await page.click("#myOffersClose");
  await page.waitForTimeout(150);

  // 4) Retirar a proposta -- some de pendingOffersOut, volta o ícone
  // de "Comprar" normal no Mercado.
  const offerId1 = await page.evaluate((pid) => CAREER.pendingOffersOut.find((x) => String(x.playerId) === String(pid)).id, buyBtnInfo.playerId);
  await page.evaluate((id) => withdrawOffer(id), offerId1);
  await page.waitForTimeout(150);
  const afterWithdraw = await page.evaluate((pid) => ({
    stillPending: !!CAREER.pendingOffersOut.find((x) => String(x.playerId) === String(pid)),
    buyIconBack: !!document.querySelector(`#marketList [data-buy="${pid}"]`),
  }), buyBtnInfo.playerId);
  console.log("4) Retirar a proposta some da lista e volta o botão de propor normal:",
    !afterWithdraw.stillPending && afterWithdraw.buyIconBack, JSON.stringify(afterWithdraw));

  // 5) Proposta ACEITA (ratio 1.0, RNG forçado pra dentro da faixa de
  // aceite alta) -- parcelada em 3x: jogador entra no elenco, cash
  // desconta só a 1ª parcela, o resto vai pra pendingInstallments.
  const target = await page.evaluate(() => {
    const row = [...document.querySelectorAll("#marketList [data-buy]")][0];
    return { clubId: row.dataset.club, playerId: row.dataset.buy };
  });
  const check5 = await page.evaluate((t) => {
    const p = leagueSquadFor(t.clubId).find((x) => x.id === t.playerId);
    const cashBefore = CAREER.finances.cash;
    CAREER.pendingOffersOut.push({
      id: "test_offer_accept", playerId: p.id, playerName: p.name, clubId: t.clubId, clubName: teamById(t.clubId).name,
      marketValue: p.value, offerValue: p.value, installments: 3, roundsLeft: 1, status: "pending", counterValue: null,
    });
    const origRandom = Math.random;
    Math.random = () => 0.01; // garante aceite (ratio 1.0 cai na 1ª faixa, 85% de chance)
    resolvePendingOffersOutRound(CAREER.currentRound);
    Math.random = origRandom;
    const perInstallment = Math.round(p.value / 3 / 1000) * 1000;
    return {
      inSquad: !!CAREER.squad.find((x) => x.id === p.id),
      cashDelta: cashBefore - CAREER.finances.cash,
      expectedFirst: perInstallment,
      installmentsLeft: CAREER.pendingInstallments.filter((i) => i.label.includes(p.name)).length,
      installmentsAmount: CAREER.pendingInstallments.find((i) => i.label.includes(p.name))?.perRoundAmount,
      installmentsRoundsLeft: CAREER.pendingInstallments.find((i) => i.label.includes(p.name))?.roundsLeft,
      stillPending: !!CAREER.pendingOffersOut.find((x) => x.id === "test_offer_accept"),
    };
  }, target);
  console.log("5) Proposta aceita (ratio 1.0) entra no elenco, cobra só a 1ª de 3 parcelas, agenda as outras 2:",
    check5.inSquad && check5.cashDelta === check5.expectedFirst && check5.installmentsLeft === 1
    && check5.installmentsAmount === check5.expectedFirst && check5.installmentsRoundsLeft === 2 && !check5.stillPending,
    JSON.stringify(check5));

  // 5b) As parcelas restantes descontam o caixa a cada rodada
  // simulada (ver processPendingInstallments/finishRoundTail) até
  // quitar -- 2 chamadas diretas (evita depender do fluxo de partida
  // completo só pra isso).
  const check5b = await page.evaluate(() => {
    const before = CAREER.finances.cash;
    const paid1 = processPendingInstallments();
    const mid = CAREER.finances.cash;
    const paid2 = processPendingInstallments();
    const after = CAREER.finances.cash;
    return { before, mid, after, paid1, paid2, remaining: CAREER.pendingInstallments.length };
  });
  console.log("5b) Parcelas restantes descontam o caixa rodada a rodada e terminam quitadas:",
    check5b.before - check5b.mid === check5b.paid1 && check5b.mid - check5b.after === check5b.paid2
    && check5b.paid1 === check5b.paid2 && check5b.remaining === 0, JSON.stringify(check5b));

  // D. Souza tem overall >= 82 -- contratação "polêmica" (ver
  // finalizeIncomingPurchase) dispara uma coletiva de imprensa por
  // cima de tudo (mesmo clique defensivo já usado em outros testes
  // desta sessão pra esse mesmo modal).
  await page.click('#pressOptions [data-press]').catch(() => {});
  await page.waitForTimeout(150);

  // Re-renderiza o Mercado -- os passos 5/5b manipularam CAREER direto
  // via evaluate (sem passar pelos handlers de botão, que já chamam
  // renderMercado()/renderAll() sozinhos), então o DOM ainda mostra o
  // estado de ANTES da compra (real_19 apareceria como comprável de
  // novo, mesmo já estando no MEU elenco agora).
  await page.evaluate(() => renderMercado());

  // 6) Proposta RECUSADA (ratio bem baixo, RNG forçado pra fora de
  // qualquer faixa de aceite/contraproposta) -- jogador continua no
  // elenco de origem, cash intocado.
  const target2 = await page.evaluate(() => {
    const row = [...document.querySelectorAll("#marketList [data-buy]")][0];
    return { clubId: row.dataset.club, playerId: row.dataset.buy };
  });
  const check6 = await page.evaluate((t) => {
    const p = leagueSquadFor(t.clubId).find((x) => x.id === t.playerId);
    const cashBefore = CAREER.finances.cash;
    CAREER.pendingOffersOut.push({
      id: "test_offer_reject", playerId: p.id, playerName: p.name, clubId: t.clubId, clubName: teamById(t.clubId).name,
      marketValue: p.value, offerValue: Math.round(p.value * 0.5), installments: 1, roundsLeft: 1, status: "pending", counterValue: null,
    });
    resolvePendingOffersOutRound(CAREER.currentRound); // ratio 0.5 -- abaixo de 0.6, recusa direto, sem depender de RNG
    return {
      cashUnchanged: CAREER.finances.cash === cashBefore,
      stillInLeagueSquad: !!leagueSquadFor(t.clubId).find((x) => x.id === p.id),
      stillPending: !!CAREER.pendingOffersOut.find((x) => x.id === "test_offer_reject"),
    };
  }, target2);
  console.log("6) Proposta muito abaixo do valor de mercado (50%) é recusada direto, sem afetar nada:",
    check6.cashUnchanged && check6.stillInLeagueSquad && !check6.stillPending, JSON.stringify(check6));
  await page.evaluate(() => renderMercado());

  // 7) Contraproposta (ratio no meio-termo, RNG forçado pra cair
  // nessa faixa) -- vira status "countered", aceitar fecha na hora.
  const target3 = await page.evaluate(() => {
    const row = [...document.querySelectorAll("#marketList [data-buy]")][0];
    return { clubId: row.dataset.club, playerId: row.dataset.buy };
  });
  const check7 = await page.evaluate((t) => {
    const p = leagueSquadFor(t.clubId).find((x) => x.id === t.playerId);
    CAREER.pendingOffersOut.push({
      id: "test_offer_counter", playerId: p.id, playerName: p.name, clubId: t.clubId, clubName: teamById(t.clubId).name,
      marketValue: p.value, offerValue: Math.round(p.value * 0.65), installments: 1, roundsLeft: 1, status: "pending", counterValue: null,
    });
    const origRandom = Math.random;
    Math.random = () => 0.49; // ratio 0.65 cai na faixa [0.6,0.8) -- 0.49 < 0.5 -> contraproposta
    resolvePendingOffersOutRound(CAREER.currentRound);
    Math.random = origRandom;
    const o = CAREER.pendingOffersOut.find((x) => x.id === "test_offer_counter");
    return { countered: o && o.status === "countered", counterValue: o?.counterValue, offerValue: o?.offerValue, marketValue: p.value };
  }, target3);
  console.log("7) Ratio no meio-termo (65%) com RNG na faixa certa vira contraproposta (não recusa nem aceita direto):",
    check7.countered && check7.counterValue > check7.offerValue && check7.counterValue <= check7.marketValue, JSON.stringify(check7));

  // Responder a coletiva de imprensa da contratação polêmica (se
  // apareceu, ver comentário acima) também já fecha tudo e volta pra
  // Início (Task #72) -- volta pro Mercado antes de continuar.
  await page.evaluate(() => switchToPanel("mercado"));
  await page.waitForTimeout(150);
  await page.click("#btnOpenMyOffers");
  await page.waitForTimeout(200);
  const counterRowInfo = await page.evaluate(() => ({
    hasAcceptBtn: !!document.querySelector('[data-acceptcounter="test_offer_counter"]'),
    text: document.getElementById("myOffersList").textContent,
  }));
  console.log("7b) 'Minhas propostas' mostra a contraproposta com botão de aceitar:", counterRowInfo.hasAcceptBtn && counterRowInfo.text.includes("Contraproposta"), JSON.stringify({ hasAcceptBtn: counterRowInfo.hasAcceptBtn }));

  // Passos anteriores já compraram/parcelaram um craque nesta mesma
  // carreira de teste, deixando pouca (ou nenhuma) folga real de teto
  // salarial/caixa -- sobe os dois só pra este check isolar de verdade
  // o mecanismo de "aceitar contraproposta fecha na hora", sem
  // depender de quanto sobrou dos passos anteriores (a trava de
  // teto/caixa em si já é a MESMA de sempre, ver finalizeIncomingPurchase/
  // buyPlayer, não é o que este check quer provar).
  await page.evaluate(() => { CAREER.finances.wageCap = 999999999; CAREER.finances.cash = 999999999; });
  const check7c = await page.evaluate((t) => {
    const cashBefore = CAREER.finances.cash;
    const counterValue = CAREER.pendingOffersOut.find((x) => x.id === "test_offer_counter").counterValue;
    acceptCounterOffer("test_offer_counter");
    return {
      cashDelta: cashBefore - CAREER.finances.cash,
      counterValue,
      inSquad: !!CAREER.squad.find((x) => x.id === t.playerId),
      stillPending: !!CAREER.pendingOffersOut.find((x) => x.id === "test_offer_counter"),
    };
  }, target3);
  console.log("7c) Aceitar a contraproposta fecha na hora, cobrando o valor pedido pelo clube:",
    check7c.cashDelta === check7c.counterValue && check7c.inSquad && !check7c.stillPending, JSON.stringify(check7c));

  await page.screenshot({ path: "screens/mercado_minhas_propostas.png" });

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
