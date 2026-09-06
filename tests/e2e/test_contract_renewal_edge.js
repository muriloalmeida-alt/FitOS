const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());

  const base = "http://localhost:8787";
  const email = `contractedge${Date.now()}@teste.com`;

  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Contract Edge", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  // Caso A: jogador jovem (<=23) -- proposta de 1 ano deve ser recusada
  // mesmo com salário generoso.
  const youngId = await page.evaluate(async () => {
    const r = await fetch("/api/career");
    const data = await r.json();
    const career = data.career;
    const p = career.squad.find((x) => x.origin === "principal" && x.age <= 23);
    p.contractUntil = career.seasonYear;
    await fetch("/api/career", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(career) });
    return p ? p.id : null;
  });
  console.log("Jovem escolhido:", youngId);
  if (youngId) {
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(800);
    await page.click(".m3-nav-item[data-panel='elenco']");
    await page.waitForTimeout(300);
    await page.click(`[data-id="${youngId}"]`);
    await page.waitForSelector("#detailOverlay.open");
    await page.waitForTimeout(200);
    await page.click('[data-act="renew"]');
    await page.waitForSelector("#renewOverlay.open");
    await page.waitForTimeout(200);
    await page.fill("#renewWageInput", "999999"); // salário generoso, bem acima do mínimo
    await page.selectOption("#renewDurationSelect", "1");
    await page.click("#btnRenewPropose");
    await page.waitForTimeout(200);
    const toastA = await page.evaluate(() => document.getElementById("toast").textContent);
    console.log("Caso A (jovem, 1 ano, salário alto) -- toast:", toastA);
  }

  // Caso B: propõe salário que estouraria o teto salarial -- sub-modal
  // deve continuar aberto (não fecha, não aplica nada).
  const targetB = await page.evaluate(async () => {
    const r = await fetch("/api/career");
    const data = await r.json();
    const career = data.career;
    const p = career.squad.find((x) => x.origin === "principal" && x.age > 26);
    p.contractUntil = career.seasonYear;
    await fetch("/api/career", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(career) });
    return { id: p.id, cap: career.finances.wageCap };
  });
  console.log("Alvo do caso B:", targetB);
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(800);
  await page.click(".m3-nav-item[data-panel='elenco']");
  await page.waitForTimeout(300);
  await page.click(`[data-id="${targetB.id}"]`);
  await page.waitForSelector("#detailOverlay.open");
  await page.waitForTimeout(200);
  await page.click('[data-act="renew"]');
  await page.waitForSelector("#renewOverlay.open");
  await page.waitForTimeout(200);
  await page.fill("#renewWageInput", String(targetB.cap * 5)); // bem acima do teto inteiro
  await page.click("#btnRenewPropose");
  await page.waitForTimeout(200);
  const toastB = await page.evaluate(() => document.getElementById("toast").textContent);
  const stillOpenB = await page.evaluate(() => document.getElementById("renewOverlay").classList.contains("open"));
  const wageUnchangedB = await page.evaluate(async (id) => (await (await fetch("/api/career")).json()).career.squad.find((p) => p.id === id).contractUntil, targetB.id);
  console.log("Caso B (estoura teto) -- toast:", toastB);
  console.log("  Sub-modal continua aberto (deve ser true):", stillOpenB, "| contractUntil ainda venceria essa temporada (deve ser igual a seasonYear, nada mudou):", wageUnchangedB);

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
