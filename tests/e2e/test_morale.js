const { chromium } = require("playwright-core");

async function newCareer(page, base, email) {
  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Morale Test", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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
  await newCareer(page, base, `morale${Date.now()}@teste.com`);

  // 1) Todo mundo nasce em 70
  let career = await getCareer(page);
  const allAt70 = career.squad.every((p) => p.morale === 70);
  console.log("1) Todo o elenco nasce em moral 70:", allAt70);

  // 2) AJUSTE (pedido do usuário: "remover o card de situação do
  // elenco") — o KPI "Moral do elenco" (média) morava nesse card,
  // removido da Central; a moral continua existindo e visível de
  // verdade só no detalhe de CADA jogador (ver checagem 3 abaixo).
  const squadKpisRemoved = await page.evaluate(() => !document.getElementById("squadKpis"));
  console.log("2) Card 'Situação do elenco' (com a média de moral) removido da Central:", squadKpisRemoved);

  // 3) KPI no detalhe do jogador
  const firstId = career.squad[0].id;
  await page.click(".m3-nav-item[data-panel='elenco']");
  await page.waitForTimeout(300);
  await page.click(`[data-id="${firstId}"]`);
  await page.waitForSelector("#detailOverlay.open");
  await page.waitForTimeout(200);
  const detailText = await page.evaluate(() => document.getElementById("detailBody").textContent);
  // AJUSTE (redesign, Tela 5) — rótulo do attr-grid agora é "MORAL"
  // (maiúsculas, igual ao mockup), não mais "Moral" — comparação
  // case-insensitive pra não depender de qual convenção de caixa a
  // tela usa.
  console.log("3) KPI 'Moral' aparece no detalhe:", detailText.toLowerCase().includes("moral"));
  await page.click("#detailClose");
  await page.waitForTimeout(200);

  // 4) Simula rodada 1 e confere reação da moral (titulares sobem, quem
  // não jogou desce)
  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(300);
  const startersBefore = career.lineup.starters.filter(Boolean);
  const benchBefore = career.lineup.bench;
  await page.click("#btnSimulate");
  await page.waitForSelector("#matchDetailOverlay.open, #roundResultsOverlay.open", { timeout: 10000 });
  await page.waitForTimeout(300);
  const matchOpen = await page.evaluate(() => document.getElementById("matchDetailOverlay").classList.contains("open"));
  if (matchOpen) { await page.click("#btnMatchDetailContinue"); await page.waitForTimeout(300); }
  const resOpen = await page.evaluate(() => document.getElementById("roundResultsOverlay").classList.contains("open"));
  if (resOpen) { await page.click("#btnRoundResultsContinue"); await page.waitForTimeout(300); }

  career = await getCareer(page);
  const starterMorales = career.squad.filter((p) => startersBefore.includes(p.id)).map((p) => p.morale);
  const benchMorales = career.squad.filter((p) => benchBefore.includes(p.id)).map((p) => p.morale);
  const restIds = new Set([...startersBefore, ...benchBefore]);
  const restMorales = career.squad.filter((p) => !restIds.has(p.id)).map((p) => p.morale);
  console.log("4) Moral dos titulares depois da rodada 1 (deve ter mudado de 70):", [...new Set(starterMorales)]);
  console.log("   Moral do banco:", [...new Set(benchMorales)]);
  console.log("   Moral de quem nem entrou na súmula (deve ser 68 = 70-2):", [...new Set(restMorales)]);

  // 5) Força moral baixa e testa recusa de renovação
  const p1 = career.squad.find((p) => p.origin === "principal");
  p1.morale = 20;
  p1.contractUntil = career.seasonYear;
  await putCareer(page, career);
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(800);
  await page.click(".m3-nav-item[data-panel='elenco']");
  await page.waitForTimeout(300);
  await page.click(`[data-id="${p1.id}"]`);
  await page.waitForSelector("#detailOverlay.open");
  await page.waitForTimeout(200);
  await page.click('[data-act="renew"]');
  await page.waitForSelector("#renewOverlay.open");
  await page.waitForTimeout(200);
  await page.fill("#renewWageInput", String(Math.round(p1.wage * 1.5))); // generosa mas dentro do orçamento
  await page.selectOption("#renewDurationSelect", "3"); // duração longa também, pra isolar só o efeito da moral baixa
  await page.click("#btnRenewPropose");
  await page.waitForTimeout(200);
  const toastLowMorale = await page.evaluate(() => document.getElementById("toast").textContent);
  console.log("5) Toast recusa por moral baixa (deve recusar mesmo com salário generoso e contrato longo):", toastLowMorale);

  // 6) Força moral alta e testa recusa de proposta de 1 ano
  career = await getCareer(page);
  const p2 = career.squad.find((p) => p.origin === "principal" && p.id !== p1.id);
  p2.morale = 90;
  p2.contractUntil = career.seasonYear;
  await putCareer(page, career);
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(800);
  await page.click(".m3-nav-item[data-panel='elenco']");
  await page.waitForTimeout(300);
  await page.click(`[data-id="${p2.id}"]`);
  await page.waitForSelector("#detailOverlay.open");
  await page.waitForTimeout(200);
  await page.click('[data-act="renew"]');
  await page.waitForSelector("#renewOverlay.open");
  await page.waitForTimeout(200);
  const suggested = await page.evaluate(() => document.getElementById("renewWageInput").value);
  await page.selectOption("#renewDurationSelect", "1");
  await page.click("#btnRenewPropose");
  await page.waitForTimeout(200);
  const toastHighMorale = await page.evaluate(() => document.getElementById("toast").textContent);
  console.log("6) Salário sugerido pra moral 90 (deve ser mais que 1.05x):", suggested, "| wage original:", p2.wage);
  console.log("   Toast recusa por duração curta + moral alta:", toastHighMorale);

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
