// Pedido do usuário (item 6 da lista de melhorias, "Vamos implementar
// todos na ordem abaixo"): "Histórico individual do jogador — o
// perfil de um jogador mostra só 1 linha ('gols na carreira: X') —
// dá pra abrir uma aba temporada-a-temporada por jogador (gols/
// assistências/jogos por ano no clube), reaproveitando os mesmos
// campos que já existem." Valida: sem histórico na 1ª temporada,
// snapshot correto na virada de temporada (apps/gols/assistências
// batendo com o que realmente aconteceu antes de zerar), reset dos
// contadores da temporada nova, e a linha aparecendo no detalhe do
// jogador.
const { chromium } = require("playwright-core");

async function newCareer(page, base, email) {
  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Historico Jogador", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "load" });
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(200);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnOnboardSkip", { timeout: 2000 }).catch(() => {});
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
}
// Roda a temporada inteira reaproveitando o MESMO caminho real de
// produção (simulateRound/skipLiveMatch/finishLiveMatch) em vez de
// reimplementar o motor — mais lento que chamar funções internas
// direto, mas impossível de divergir do comportamento de verdade.
// Fecha todas as modais pós-jogo na mão a cada rodada (coletiva/
// notícias/resultados/tabela/proposta) só pra não travar o próximo
// clique — não afeta os contadores que o teste está medindo.
async function simulateWholeSeasonFast(page) {
  for (let i = 0; i < 40; i++) {
    const round = await page.evaluate(() => CAREER.currentRound);
    if (round > 38) break;
    const result = await page.evaluate(() => simulateRound());
    if (result === "live") {
      await page.evaluate(() => skipLiveMatch());
      await page.waitForSelector("#matchDetailOverlay.open", { timeout: 8000 }).catch(() => {});
      await page.evaluate(() => {
        ["matchDetailOverlay", "roundResultsOverlay", "newsOverlay", "tabelaModalOverlay", "playerOfferOverlay", "pressOverlay"].forEach((id) => document.getElementById(id).classList.remove("open"));
        CAREER.pendingOffer = null;
      });
    }
    await page.waitForTimeout(60);
  }
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
  const base = "http://localhost:8787";
  await newCareer(page, base, `histjogador${Date.now()}@teste.com`);

  const playerId = await page.evaluate(() => CAREER.lineup.starters.find((id) => id));

  // 1) Antes de qualquer temporada terminar, o jogador não tem
  // histórico nenhum ainda (seasonHistory nunca foi criado).
  await page.click(".m3-nav-item[data-panel='elenco']");
  await page.waitForTimeout(300);
  await page.click(`[data-id="${playerId}"]`);
  await page.waitForSelector("#detailOverlay.open");
  const beforeHasHistory = await page.evaluate(() => document.getElementById("detailBody").innerHTML.includes("Histórico por temporada"));
  console.log("1) Sem histórico na 1ª temporada (nenhuma virada aconteceu ainda):", beforeHasHistory === false);
  await page.click("#detailClose");
  await page.waitForTimeout(200);

  // 2) Simula a temporada inteira pelo caminho real de produção.
  await simulateWholeSeasonFast(page);
  const beforeSnapshot = await page.evaluate((id) => {
    const p = CAREER.squad.find((x) => x.id === id);
    return p ? { apps: p.appsSeason || 0, goals: p.goalsSeason || 0, assists: p.assistsSeason || 0 } : null;
  }, playerId);
  console.log("2) Depois da temporada inteira, appsSeason acumulou de verdade:", !!beforeSnapshot && beforeSnapshot.apps > 0, JSON.stringify(beforeSnapshot));

  // 3) Vira a temporada (advanceSeason real) -- snapshot deve capturar
  // EXATAMENTE os números de cima, e os contadores da temporada zeram
  // pra 0 na temporada nova.
  await page.evaluate(async () => { await advanceSeason(); });
  await page.waitForTimeout(300);
  const stillOnSquad = await page.evaluate((id) => !!CAREER.squad.find((x) => x.id === id), playerId);
  const afterAdvance = stillOnSquad ? await page.evaluate((id) => {
    const p = CAREER.squad.find((x) => x.id === id);
    return { seasonHistory: p.seasonHistory, appsSeasonNow: p.appsSeason, goalsSeasonNow: p.goalsSeason, assistsSeasonNow: p.assistsSeason };
  }, playerId) : null;
  const snapshotMatches = !!afterAdvance && afterAdvance.seasonHistory && afterAdvance.seasonHistory.length === 1
    && afterAdvance.seasonHistory[0].apps === beforeSnapshot.apps
    && afterAdvance.seasonHistory[0].goals === beforeSnapshot.goals
    && afterAdvance.seasonHistory[0].assists === beforeSnapshot.assists
    && afterAdvance.appsSeasonNow === 0 && afterAdvance.goalsSeasonNow === 0 && afterAdvance.assistsSeasonNow === 0;
  console.log("3) Virada de temporada gravou o snapshot certo e zerou os contadores pra nova:",
    !stillOnSquad ? "jogador saiu por fim de contrato (não dá pra checar, pula)" : snapshotMatches,
    JSON.stringify({ stillOnSquad, afterAdvance }));

  // 4) A tela de detalhe agora mostra a seção "Histórico por
  // temporada" com a linha certa (só se o jogador continua no elenco).
  if (stillOnSquad) {
    await page.click(".m3-nav-item[data-panel='elenco']");
    await page.waitForTimeout(300);
    await page.click(`[data-id="${playerId}"]`);
    await page.waitForSelector("#detailOverlay.open");
    const historyRowText = await page.evaluate(() => {
      const rows = [...document.querySelectorAll("#detailBody .mt-mini-row")];
      return rows.length ? rows[0].textContent.replace(/\s+/g, " ").trim() : null;
    });
    console.log("4) Detalhe do jogador mostra a linha de histórico da temporada que passou:", !!historyRowText, historyRowText);
    await page.click("#detailClose");
  } else {
    console.log("4) (pulado -- jogador saiu do elenco por fim de contrato antes de checar a UI)");
  }

  await browser.close();
  console.log("OK");
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
