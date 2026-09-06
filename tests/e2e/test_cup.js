const { chromium } = require("playwright-core");

async function newCareer(page, base, email) {
  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Cup Test", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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
  await newCareer(page, base, `cup${Date.now()}@teste.com`);

  // 1) Estrutura inicial do chaveamento
  let career = await getCareer(page);
  console.log("1) cup.active:", career.cup.active, "| phase:", career.cup.phase, "| r16 length (deve ser 8):", career.cup.ties.r16.length);
  const allR16Clubs = career.cup.ties.r16.flatMap((t) => [String(t.home), String(t.away)]);
  console.log("   16 clubes únicos no sorteio (deve ser true):", new Set(allR16Clubs).size === 16);
  console.log("   Meu clube está no chaveamento (deve bater com cup.active):", allR16Clubs.includes(String(career.clubId)));

  // 2) Simula até a rodada 6 (fase R16) e confirma que resolve nesse clique
  career.currentRound = 6;
  await putCareer(page, career);
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(800);
  await page.click("#btnSimulate");
  await page.waitForSelector("#matchDetailOverlay.open, #roundResultsOverlay.open", { timeout: 10000 });
  await page.waitForTimeout(300);
  const matchOpen = await page.evaluate(() => document.getElementById("matchDetailOverlay").classList.contains("open"));
  if (matchOpen) { await page.click("#btnMatchDetailContinue"); await page.waitForTimeout(300); }
  await page.waitForSelector("#roundResultsOverlay.open", { timeout: 5000 });
  const cupSectionHTML = await page.evaluate(() => document.getElementById("roundResultsCup").innerHTML);
  console.log("2) Seção de Copa no modal de resultados apareceu (deve ter conteúdo):", cupSectionHTML.length > 0);
  console.log("   Contém 'Oitavas de final':", cupSectionHTML.includes("Oitavas de final"));
  await page.click("#btnRoundResultsContinue");
  await page.waitForTimeout(300);

  career = await getCareer(page);
  console.log("   Fase depois de resolver R16 (deve ser 'qf' ou 'done'/eliminado, nunca mais 'r16'):", career.cup.phase);
  console.log("   qf tem 4 confrontos (se ainda ativo):", career.cup.phase === "qf" ? career.cup.ties.qf.length === 4 : "N/A (eliminado ou não ativo)");

  // 3) Tab Tabela mostra o card de Copa
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='competicao']");
  await page.click("#btnOpenTabela");
  await page.waitForTimeout(300);
  const cupStatusText = await page.evaluate(() => document.getElementById("cupStatusText").textContent);
  console.log("3) Texto de status na aba Tabela:", cupStatusText);

  // 4) Força estado de CAMPEÃO diretamente (pula pra final já resolvida) e confere a renderização
  career = await getCareer(page);
  career.cup.phase = "done";
  career.cup.champion = career.clubId;
  career.cup.championIsHuman = true;
  career.cup.humanAlive = true;
  await putCareer(page, career);
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(800);
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='competicao']");
  await page.click("#btnOpenTabela");
  await page.waitForTimeout(300);
  const championText = await page.evaluate(() => document.getElementById("cupStatusText").innerHTML);
  console.log("4) Texto de campeão:", championText);

  // 5) Força "não classificado" e confere o texto
  career = await getCareer(page);
  career.cup.active = false;
  await putCareer(page, career);
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(800);
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='competicao']");
  await page.click("#btnOpenTabela");
  await page.waitForTimeout(300);
  const notQualifiedText = await page.evaluate(() => document.getElementById("cupStatusText").textContent);
  console.log("5) Texto de não classificado:", notQualifiedText);

  // 6) Migração: remove CAREER.cup, força rodada 20 (entre qf=14 e sf=22), recarrega
  career = await getCareer(page);
  delete career.cup;
  career.currentRound = 20;
  await putCareer(page, career);
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(800);
  career = await getCareer(page);
  console.log("6) Migração com rodada 20 -- cup existe:", !!career.cup, "| fase (deve ser 'sf', já puladas r16/qf por trás):", career.cup.phase);

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
