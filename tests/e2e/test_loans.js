const { chromium } = require("playwright-core");

async function newCareer(page, base, email) {
  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Loan Test", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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
  await newCareer(page, base, `loans${Date.now()}@teste.com`);

  // 1) Empréstimo OUT: força comprador garantido (random alto).
  let career = await getCareer(page);
  const outPlayer = career.squad.find((p) => p.origin === "principal");
  await page.click(".m3-nav-item[data-panel='mercado']");
  await page.waitForTimeout(300);
  await page.evaluate(() => { Math.random = () => 0.99; });
  const cashBefore = career.finances.cash;
  // Busca pelo nome pra garantir que aparece na lista (sem busca só
  // mostra os 40 mais valiosos, ver renderMercado).
  await page.fill("#marketSearch", outPlayer.name);
  await page.waitForTimeout(200);
  await page.click(`[data-loanout="${outPlayer.id}"]`);
  await page.waitForSelector("#loanOverlay.open");
  await page.click("#btnLoanConfirm");
  await page.waitForTimeout(300);
  career = await getCareer(page);
  const stillMine = career.squad.some((p) => p.id === outPlayer.id);
  let foundInClub = null;
  for (const [clubId, squad] of Object.entries(career.leagueSquads)) {
    const found = squad.find((p) => p.id === outPlayer.id);
    if (found) { foundInClub = { clubId, onLoanFromClubId: found.onLoanFromClubId }; break; }
  }
  console.log("1) Empréstimo OUT -- saiu do meu elenco:", !stillMine, "| encontrado em outro clube com onLoanFromClubId correto:", foundInClub && String(foundInClub.onLoanFromClubId) === String(career.clubId));
  console.log("   Caixa aumentou (taxa de empréstimo):", career.finances.cash > cashBefore, "| delta:", career.finances.cash - cashBefore);

  // 2) Jogador emprestado NÃO aparece na lista de "outros" do Mercado (allMarketPlayers)
  const marketHasLoanedPlayer = await page.evaluate((id) => {
    return allMarketPlayers().some((entry) => entry.p.id === id);
  }, outPlayer.id);
  console.log("2) Jogador emprestado NÃO aparece no Mercado (deve ser false):", marketHasLoanedPlayer);

  // 3) Empréstimo IN: pega um jogador de outro clube emprestado.
  const otherEntry = await page.evaluate(() => {
    const entry = allMarketPlayers().find((e) => !e.mine);
    return { id: entry.p.id, name: entry.p.name, clubId: entry.club.id, wage: entry.p.wage, contractUntil: entry.p.contractUntil };
  });
  await page.fill("#marketSearch", otherEntry.name);
  await page.waitForTimeout(200);
  await page.click(`[data-loanin="${otherEntry.id}"]`);
  await page.waitForSelector("#loanOverlay.open");
  await page.click("#btnLoanConfirm");
  await page.waitForTimeout(300);
  career = await getCareer(page);
  const loanedInPlayer = career.squad.find((p) => p.id === otherEntry.id);
  console.log("3) Jogador emprestado IN entrou no elenco:", !!loanedInPlayer, "| origin:", loanedInPlayer && loanedInPlayer.origin, "| salário reduzido pra metade:", loanedInPlayer && loanedInPlayer.wage === Math.round((otherEntry.wage * 0.5) / 100) * 100, "| loanOriginalWage guardado:", loanedInPlayer && loanedInPlayer.loanOriginalWage === otherEntry.wage);

  // 4) Aparece no Elenco (Elenco principal) com tag "emprestado"
  await page.click(".m3-nav-item[data-panel='elenco']");
  await page.waitForTimeout(300);
  const rowText = await page.evaluate((id) => {
    const row = document.querySelector(`[data-id="${id}"]`);
    return row ? row.textContent : null;
  }, otherEntry.id);
  console.log("4) Jogador emprestado aparece na lista do Elenco com tag:", rowText ? rowText.includes("emprestado") : "NÃO ENCONTRADO NA LISTA");

  // 5) Detalhe do jogador emprestado -- sem vender/dispensar/renovar
  await page.click(`[data-id="${otherEntry.id}"]`);
  await page.waitForSelector("#detailOverlay.open");
  await page.waitForTimeout(200);
  const detailButtons = await page.evaluate(() => Array.from(document.querySelectorAll("#detailBody [data-act]")).map((b) => b.dataset.act));
  const detailText = await page.evaluate(() => document.getElementById("detailBody").textContent);
  console.log("5) Botões no detalhe do emprestado (não deve ter sell/release/renew/promote/demote):", detailButtons);
  console.log("   Texto explicativo de empréstimo presente:", detailText.includes("Emprestado do"));
  await page.click("#detailClose");
  await page.waitForTimeout(200);

  // 6) wageBillOf inclui o salário do emprestado
  const wageBillIncludesLoan = await page.evaluate(() => wageBillOf(CAREER.squad) > 0);
  console.log("6) wageBillOf > 0 (inclui loan):", wageBillIncludesLoan);

  // 7) Virada de temporada -- os 2 empréstimos voltam pro dono de origem
  career = await getCareer(page);
  career.currentRound = 39;
  await putCareer(page, career);
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(800);
  await page.click("#btnAdvanceSeason");
  await page.waitForTimeout(200);
  await page.click("#confirmOkBtn");
  await page.waitForTimeout(500);
  career = await getCareer(page);
  const outPlayerBack = career.squad.some((p) => p.id === outPlayer.id);
  const inPlayerGone = !career.squad.some((p) => p.id === otherEntry.id);
  const inPlayerBackAtOriginalClub = (career.leagueSquads[String(otherEntry.clubId)] || []).find((p) => p.id === otherEntry.id);
  console.log("7) Empréstimo OUT voltou pro meu elenco:", outPlayerBack);
  console.log("   Empréstimo IN saiu do meu elenco:", inPlayerGone, "| voltou pro clube de origem com salário original restaurado:", inPlayerBackAtOriginalClub && inPlayerBackAtOriginalClub.wage === otherEntry.wage && inPlayerBackAtOriginalClub.origin === "principal");

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
