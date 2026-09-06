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
  const email = `injuries${Date.now()}@teste.com`;

  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Injuries", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  // 1) Estatística: roda simulatePlayerEvents MUITAS vezes num time
  // fictício de 11 jogadores físico/condição médios, e conta as
  // gravidades sorteadas -- confirma que os 3 níveis aparecem e que a
  // distribuição bate aproximadamente com 70/25/5, e que dá pra ter
  // lesão de mais de 4 rodadas (o teto antigo).
  const stats = await page.evaluate(() => {
    const fakeSquad = () => Array.from({ length: 11 }, (_, i) => ({
      id: `fake${i}`, name: `Jogador ${i}`, group: "M", phys: 70, condition: 100, apps: 0, status: "ok", yellowCards: 0,
    }));
    const counts = { leve: 0, media: 0, grave: 0, none: 0, maxDur: 0 };
    for (let i = 0; i < 20000; i++) {
      const squad = fakeSquad();
      window.simulatePlayerEvents(squad, 0, 1);
      squad.forEach((p) => {
        if (p.status === "contundido") {
          counts[p.injurySeverity] = (counts[p.injurySeverity] || 0) + 1;
          counts.maxDur = Math.max(counts.maxDur, p.outUntilRound - 1);
        } else {
          counts.none++;
        }
      });
    }
    return counts;
  });
  console.log("1) Estatística de 20000x11 rolls de lesão:", stats);
  const total = stats.leve + stats.media + stats.grave;
  console.log("   Proporção leve/média/grave:", (stats.leve / total).toFixed(2), (stats.media / total).toFixed(2), (stats.grave / total).toFixed(2), "(esperado ~0.70/0.25/0.05)");
  console.log("   Maior duração observada (deve poder passar de 4, até 14):", stats.maxDur);

  // 2) injuryChanceFor varia com físico/condição
  const chances = await page.evaluate(() => ({
    saudavel: window.injuryChanceFor({ phys: 85, condition: 100 }),
    exausto: window.injuryChanceFor({ phys: 40, condition: 30 }),
  }));
  console.log("2) Chance jogador saudável (físico alto, condição cheia):", chances.saudavel, "| exausto (físico baixo, condição baixa):", chances.exausto, "(exausto deve ser maior)");

  // 3) Força um jogador MEU pra "contundido" com lesão grave (14
  // rodadas) e confirma: badge com gravidade, sumiço do picker, aviso
  // no detalhe.
  const targetId = await page.evaluate(async () => {
    const r = await fetch("/api/career");
    const data = await r.json();
    const career = data.career;
    const p = career.squad.find((x) => x.origin === "principal");
    p.status = "contundido"; p.outUntilRound = career.currentRound + 14; p.injurySeverity = "grave";
    await fetch("/api/career", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(career) });
    return p.id;
  });
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(800);
  await page.click(".m3-nav-item[data-panel='elenco']");
  await page.waitForTimeout(300);
  const badgeText = await page.evaluate((id) => document.querySelector(`[data-id="${id}"]`).textContent, targetId);
  console.log("3) Badge na lista do Elenco:", badgeText.trim());

  await page.click(`[data-id="${targetId}"]`);
  await page.waitForSelector("#detailOverlay.open");
  await page.waitForTimeout(200);
  const detailWarning = await page.evaluate(() => document.getElementById("detailBody").textContent.includes("Lesão Grave"));
  console.log("   Aviso de lesão grave no detalhe:", detailWarning);
  await page.click("#detailClose");
  await page.waitForTimeout(200);

  await page.click(".m3-nav-item[data-panel='escalacao']");
  await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector(".mt-pos-slot, .ct-piece, .button-disc")?.click());
  await page.waitForSelector("#pickerOverlay.open", { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(200);
  const excludedFromPicker = await page.evaluate((id) => !document.querySelector(`#pickerList [data-id="${id}"]`), targetId);
  console.log("   Sumiu do 'Escolher jogador' (deve ser true):", excludedFromPicker);
  await page.click("#pickerClose").catch(() => {});

  // 4) BUG CORRIGIDO: vira a temporada com esse jogador ainda lesionado
  // (outUntilRound bem além da rodada 38) -- na temporada nova ele deve
  // voltar a "ok".
  await page.evaluate(async () => {
    const r = await fetch("/api/career");
    const data = await r.json();
    data.career.currentRound = 39;
    await fetch("/api/career", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data.career) });
  });
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(800);
  await page.click("#btnAdvanceSeason");
  await page.waitForTimeout(200);
  await page.click("#confirmOkBtn");
  await page.waitForTimeout(400);
  const afterSeason = await page.evaluate(async (id) => {
    const career = (await (await fetch("/api/career")).json()).career;
    const p = career.squad.find((x) => x.id === id);
    return p ? { status: p.status, outUntilRound: p.outUntilRound } : "SAIU_DO_ELENCO";
  }, targetId);
  console.log("4) Jogador depois da virada de temporada (deve estar 'ok', outUntilRound null, a menos que tenha saído por fim de contrato):", afterSeason);

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
