const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));

  const base = "http://localhost:8787";
  const email = `contractrenew${Date.now()}@teste.com`;

  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Contract Renew", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  // Força o contrato de um jogador do elenco principal, velho/baixo
  // overall (evita cair na regra de "quer mais tempo"), pra vencer
  // NESSA temporada.
  const targetId = await page.evaluate(async () => {
    const r = await fetch("/api/career");
    const data = await r.json();
    const career = data.career;
    const p = career.squad.find((x) => x.origin === "principal" && x.age > 26 && x.overall < 80);
    p.contractUntil = career.seasonYear;
    await fetch("/api/career", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(career) });
    return p.id;
  });
  console.log("Jogador escolhido pro teste:", targetId);

  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(800);
  await page.click(".m3-nav-item[data-panel='elenco']");
  await page.waitForTimeout(300);

  // 1) Tag "Fim de contrato" aparece na lista
  const tagVisible = await page.evaluate((id) => {
    const row = document.querySelector(`[data-id="${id}"]`);
    return row ? row.textContent.includes("Fim de contrato") : null;
  }, targetId);
  console.log("1) Tag 'Fim de contrato' na lista do Elenco:", tagVisible);

  // 2) Abre detalhe -- aviso + botão Renovar aparecem
  await page.click(`[data-id="${targetId}"]`);
  await page.waitForSelector("#detailOverlay.open");
  await page.waitForTimeout(200);
  const detailHasWarning = await page.evaluate(() => document.getElementById("detailBody").textContent.includes("sai de graça"));
  const renewBtnExists = await page.evaluate(() => !!document.querySelector('[data-act="renew"]'));
  console.log("2) Aviso no detalhe:", detailHasWarning, "| botão Renovar existe:", renewBtnExists);

  // 3) Abre sub-modal de renovação -- campos vêm prefilled
  await page.click('[data-act="renew"]');
  await page.waitForSelector("#renewOverlay.open");
  await page.waitForTimeout(200);
  const prefill = await page.evaluate(() => ({
    wageValue: document.getElementById("renewWageInput").value,
    suggestedText: document.getElementById("renewSuggestedWage").textContent,
    durationValue: document.getElementById("renewDurationSelect").value,
  }));
  console.log("3) Pré-preenchido:", prefill);

  // 4) Recusa por salário abaixo do mínimo
  const wageBefore = await page.evaluate(async (id) => (await (await fetch("/api/career")).json()).career.squad.find((p) => p.id === id).wage, targetId);
  await page.fill("#renewWageInput", "1");
  await page.click("#btnRenewPropose");
  await page.waitForTimeout(200);
  const toastLow = await page.evaluate(() => document.getElementById("toast").textContent);
  const renewOverlayClosedAfterLow = await page.evaluate(() => !document.getElementById("renewOverlay").classList.contains("open"));
  const wageAfterLow = await page.evaluate(async (id) => (await (await fetch("/api/career")).json()).career.squad.find((p) => p.id === id).wage, targetId);
  console.log("4) Toast (salário baixo):", toastLow);
  console.log("   Sub-modal fechou:", renewOverlayClosedAfterLow, "| salário mudou (deve ser false):", wageAfterLow !== wageBefore);

  // 5) O detalhe continua aberto por baixo (recusa só fecha o sub-modal
  // de renovação, ver proposeRenewal) -- propõe de novo com o valor
  // sugerido + 2 anos, agora deve aceitar.
  await page.click('[data-act="renew"]');
  await page.waitForSelector("#renewOverlay.open");
  await page.waitForTimeout(200);
  await page.selectOption("#renewDurationSelect", "2");
  await page.click("#btnRenewPropose");
  await page.waitForTimeout(200);
  const toastSuccess = await page.evaluate(() => document.getElementById("toast").textContent);
  const after = await page.evaluate(async (id) => {
    const career = (await (await fetch("/api/career")).json()).career;
    return { contractUntil: career.squad.find((p) => p.id === id).contractUntil, wage: career.squad.find((p) => p.id === id).wage, seasonYear: career.seasonYear };
  }, targetId);
  console.log("5) Toast (sucesso):", toastSuccess);
  console.log("   contractUntil depois:", after.contractUntil, "(deve ser seasonYear+2 =", after.seasonYear + 2, ") | salário:", after.wage);

  // 6) Tag "Fim de contrato" some da lista agora
  await page.waitForTimeout(200);
  const tagGone = await page.evaluate((id) => {
    const row = document.querySelector(`[data-id="${id}"]`);
    return row ? !row.textContent.includes("Fim de contrato") : null;
  }, targetId);
  console.log("6) Tag sumiu da lista (deve ser true):", tagGone);

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
