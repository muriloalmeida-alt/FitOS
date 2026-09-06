const { chromium } = require("playwright-core");

async function newCareer(page, base, email) {
  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Loan2 Test", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));

  const base = "http://localhost:8787";
  await newCareer(page, base, `loan2-${Date.now()}@teste.com`);
  await page.evaluate(() => { Math.random = () => 0.99; }); // garante comprador/interessado sempre

  // ===== TESTE 1: Empréstimo OUT de 6 meses com cláusula OBRIGATÓRIA =====
  let career = await getCareer(page);
  const startRound = career.currentRound;
  const outPlayer = career.squad.find((p) => p.origin === "principal");
  await page.click(".m3-nav-item[data-panel='mercado']");
  await page.waitForTimeout(300);
  await page.fill("#marketSearch", outPlayer.name);
  await page.waitForTimeout(200);
  await page.click(`[data-loanout="${outPlayer.id}"]`);
  await page.waitForSelector("#loanOverlay.open");
  // wagePctField deve estar ESCONDIDO no lado "out"
  const wagePctHiddenOut = await page.evaluate(() => document.getElementById("loanWagePctField").classList.contains("hidden"));
  await page.selectOption("#loanDurationSelect", "meia");
  await page.selectOption("#loanBuyClauseSelect", "obrigatoria");
  const buyValueFieldVisible = await page.evaluate(() => !document.getElementById("loanBuyValueField").classList.contains("hidden"));
  await page.fill("#loanBuyValueInput", "5000000");
  await page.click("#btnLoanConfirm");
  await page.waitForTimeout(300);
  career = await getCareer(page);
  const cashAfterLoanOut = career.finances.cash;
  let loanedOutFound = null;
  for (const [clubId, squad] of Object.entries(career.leagueSquads)) {
    const found = squad.find((p) => p.id === outPlayer.id);
    if (found) { loanedOutFound = { clubId, returnRound: found.loanReturnRound, buyOption: found.loanBuyOption }; break; }
  }
  console.log("1) Modal 'out': campo % salário escondido:", wagePctHiddenOut, "| campo valor cláusula aparece ao escolher 'obrigatoria':", buyValueFieldVisible);
  console.log("   Saiu do elenco:", !career.squad.some((p) => p.id === outPlayer.id), "| loanReturnRound = startRound+19:", loanedOutFound && loanedOutFound.returnRound === startRound + 19, "| cláusula obrigatória de 5M salva:", loanedOutFound && loanedOutFound.buyOption && loanedOutFound.buyOption.mandatory === true && loanedOutFound.buyOption.value === 5000000);

  // Avança rodadas até o loanReturnRound -- cláusula obrigatória deve
  // acionar automaticamente (transferência definitiva, sem retorno).
  career.currentRound = loanedOutFound.returnRound - 1;
  await putCareer(page, career);
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(800);
  await page.click("#btnSimulate");
  await page.waitForTimeout(400);
  await page.click("#btnMatchDetailContinue").catch(() => {});
  await page.waitForTimeout(300);
  await page.click("#btnRoundResultsContinue").catch(() => {});
  await page.waitForTimeout(300);
  career = await getCareer(page);
  const stillMineAfterClause = career.squad.some((p) => p.id === outPlayer.id);
  const permanentlyAtBuyer = (career.leagueSquads[String(loanedOutFound.clubId)] || []).find((p) => p.id === outPlayer.id);
  console.log("2) Após rodada da cláusula obrigatória -- jogador NÃO voltou (permanece vendido):", !stillMineAfterClause, "| está permanentemente no clube comprador sem onLoanFromClubId:", !!permanentlyAtBuyer && !permanentlyAtBuyer.onLoanFromClubId);
  console.log("   Caixa recebeu os 5M da cláusula:", career.finances.cash >= cashAfterLoanOut + 5000000 - 1);

  // ===== TESTE 2: Empréstimo IN com % de salário customizado (100%) e sem cláusula =====
  const otherEntry = await page.evaluate(() => {
    const entry = allMarketPlayers().find((e) => !e.mine);
    return { id: entry.p.id, name: entry.p.name, clubId: entry.club.id, wage: entry.p.wage };
  });
  await page.click(".m3-nav-item[data-panel='mercado']");
  await page.waitForTimeout(300);
  await page.fill("#marketSearch", otherEntry.name);
  await page.waitForTimeout(200);
  await page.click(`[data-loanin="${otherEntry.id}"]`);
  await page.waitForSelector("#loanOverlay.open");
  const wagePctVisibleIn = await page.evaluate(() => !document.getElementById("loanWagePctField").classList.contains("hidden"));
  await page.selectOption("#loanDurationSelect", "temporada");
  await page.selectOption("#loanWagePctSelect", "100");
  await page.click("#btnLoanConfirm");
  await page.waitForTimeout(300);
  career = await getCareer(page);
  const loanedIn = career.squad.find((p) => p.id === otherEntry.id);
  console.log("3) Modal 'in': campo % salário VISÍVEL:", wagePctVisibleIn);
  console.log("   Jogador emprestado IN com 100% do salário original:", loanedIn && loanedIn.wage === otherEntry.wage, "| loanReturnRound null (temporada inteira):", loanedIn && loanedIn.loanReturnRound == null);

  // ===== TESTE 3: virada de temporada devolve quem ficou pra "temporada inteira" =====
  career.currentRound = 39;
  await putCareer(page, career);
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(800);
  await page.click("#btnAdvanceSeason");
  await page.waitForTimeout(200);
  await page.click("#confirmOkBtn");
  await page.waitForTimeout(500);
  career = await getCareer(page);
  const inPlayerGone = !career.squad.some((p) => p.id === otherEntry.id);
  const backAtOrigin = (career.leagueSquads[String(otherEntry.clubId)] || []).find((p) => p.id === otherEntry.id);
  console.log("4) Empréstimo 'temporada inteira' voltou na virada de temporada:", inPlayerGone, "| salário restaurado no clube de origem:", backAtOrigin && backAtOrigin.wage === otherEntry.wage);

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
