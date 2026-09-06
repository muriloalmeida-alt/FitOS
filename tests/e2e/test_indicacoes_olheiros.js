// Nova feature (pedido do usuário: "mostrar a posição do atleta e
// incluir um botão recusar sugestão para que a janela feche e o
// atleta seja excluído da lista de olheiros") — "Indicações dos
// olheiros": lista de jogadores de outros clubes com espaço real de
// crescimento, buscada sob demanda (botão "Buscar indicações"),
// aceitar abre a proposta real do Mercado, recusar só tira da lista.
// Ver searchScoutSuggestions/acceptScoutSuggestion/rejectScoutSuggestion
// em carreira.js.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `olheiros${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Olheiros Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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
  await page.evaluate(() => { CAREER.finances.wageCap = 999999999; CAREER.finances.cash = 999999999; });

  // 1) Abre vazia, com o botão "Buscar indicações" disponível.
  await page.click("#btnOpenScoutSuggestions");
  await page.waitForTimeout(200);
  const check1 = await page.evaluate(() => ({
    open: document.getElementById("scoutSuggestionsOverlay").classList.contains("open"),
    countLabel: document.getElementById("scoutSuggestionsCountLabel").textContent,
    hasEmptyMsg: document.getElementById("scoutSuggestionsEmpty").classList.contains("hidden") === false,
    searchDisabled: document.getElementById("btnScoutSearch").disabled,
  }));
  console.log("1) Tela abre vazia, com 'Buscar indicações' disponível:",
    check1.open && check1.hasEmptyMsg && !check1.searchDisabled, JSON.stringify(check1));

  // 2) Clicar em "Buscar indicações" traz jogadores de verdade, cada
  // um com POSIÇÃO mostrada (chip .mt-pos-chip), clube e valor.
  await page.click("#btnScoutSearch");
  await page.waitForTimeout(300);
  const check2 = await page.evaluate(() => {
    const suggestions = CAREER.scoutSuggestions || [];
    const rows = [...document.querySelectorAll("#scoutSuggestionsList .mt-sponsor-proposal-row")];
    return {
      suggestionCount: suggestions.length,
      allHavePotentialGap: suggestions.every((s) => s.potential - s.overall >= 5),
      rowCount: rows.length,
      firstRowHasPosChip: !!rows[0]?.querySelector(".mt-pos-chip"),
      firstRowPosText: rows[0]?.querySelector(".mt-pos-chip")?.textContent,
      firstSuggestionSubpos: suggestions[0]?.subpos,
    };
  });
  console.log("2) 'Buscar indicações' traz jogadores de verdade (espaço real de crescimento) com a POSIÇÃO mostrada:",
    check2.suggestionCount > 0 && check2.allHavePotentialGap && check2.rowCount === check2.suggestionCount
    && check2.firstRowHasPosChip && check2.firstRowPosText === check2.firstSuggestionSubpos, JSON.stringify(check2));

  // 3) Cooldown: buscar de novo na MESMA rodada não traz nada a mais
  // (botão fica desabilitado).
  const countBefore3 = await page.evaluate(() => CAREER.scoutSuggestions.length);
  const check3 = await page.evaluate(() => document.getElementById("btnScoutSearch").disabled);
  await page.click("#btnScoutSearch").catch(() => {});
  await page.waitForTimeout(200);
  const countAfter3 = await page.evaluate(() => CAREER.scoutSuggestions.length);
  console.log("3) Cooldown de 1x por rodada — botão desabilitado, buscar de novo não muda a lista:",
    check3 && countAfter3 === countBefore3, JSON.stringify({ check3, countBefore3, countAfter3 }));

  // 4) "Recusar" tira SÓ aquele jogador da lista (a janela continua
  // aberta, só o item some).
  const firstId = await page.evaluate(() => CAREER.scoutSuggestions[0].id);
  const countBefore4 = await page.evaluate(() => CAREER.scoutSuggestions.length);
  await page.click(`[data-rejectscout="${firstId}"]`);
  await page.waitForTimeout(200);
  const check4 = await page.evaluate((firstId) => ({
    stillOpen: document.getElementById("scoutSuggestionsOverlay").classList.contains("open"),
    gone: !CAREER.scoutSuggestions.some((s) => s.id === firstId),
    countAfter: CAREER.scoutSuggestions.length,
  }), firstId);
  console.log("4) 'Recusar' tira só aquele jogador da lista, sem fechar a tela:",
    check4.stillOpen && check4.gone && check4.countAfter === countBefore4 - 1, JSON.stringify(check4));

  // 5) "Aceitar" abre a MESMA proposta real do Mercado (openOfferModal)
  // pro jogador certo, tira da lista de olheiros e fecha a tela de
  // indicações (sem comprar na hora).
  const secondId = await page.evaluate(() => CAREER.scoutSuggestions[0]?.id);
  const secondSuggestion = await page.evaluate((id) => CAREER.scoutSuggestions.find((s) => s.id === id), secondId);
  await page.click(`[data-acceptscout="${secondId}"]`);
  await page.waitForTimeout(300);
  const check5 = await page.evaluate(({ id, playerId, clubId }) => ({
    scoutOverlayClosed: !document.getElementById("scoutSuggestionsOverlay").classList.contains("open"),
    offerOpen: document.getElementById("offerOverlay").classList.contains("open"),
    offerCtxMatches: OFFER_CTX && String(OFFER_CTX.playerId) === String(playerId) && String(OFFER_CTX.clubId) === String(clubId),
    removedFromScoutList: !CAREER.scoutSuggestions.some((s) => s.id === id),
  }), { id: secondId, playerId: secondSuggestion.playerId, clubId: secondSuggestion.clubId });
  console.log("5) 'Aceitar' abre a proposta real do jogador certo (sem comprar na hora), some da lista de olheiros:",
    check5.scoutOverlayClosed && check5.offerOpen && check5.offerCtxMatches && check5.removedFromScoutList, JSON.stringify(check5));
  await page.click("#offerClose");
  await page.waitForTimeout(200);

  // 6) Simular 1 rodada libera o cooldown de novo.
  await page.evaluate(() => { CAREER.currentRound += 1; });
  await page.click("#btnOpenScoutSuggestions");
  await page.waitForTimeout(200);
  const check6 = await page.evaluate(() => document.getElementById("btnScoutSearch").disabled);
  console.log("6) Cooldown libera de novo numa rodada nova:", !check6, check6);

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
