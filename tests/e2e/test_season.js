const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));

  const base = "http://localhost:8787";
  const email = `season${Date.now()}@teste.com`;

  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Season Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  // Força contrato de alguns jogadores pra vencer JÁ (testa a saída de
  // verdade), e pula direto pro fim da temporada via API (evita simular
  // 38 rodadas de verdade pelo Playwright).
  const before = await page.evaluate(async () => {
    const r = await fetch("/api/career");
    const data = await r.json();
    data.career.currentRound = 39;
    // força alguns contratos a vencer JÁ (contractUntil == seasonYear atual, que vai virar seasonYear+1 na troca)
    data.career.squad.slice(0, 3).forEach((p) => { p.contractUntil = data.career.seasonYear; });
    const squadBefore = data.career.squad.length;
    const baseBefore = data.career.squad.filter((p) => p.origin === "base").length;
    await fetch("/api/career", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data.career) });
    return { squadBefore, baseBefore, seasonYear: data.career.seasonYear, ages: data.career.squad.slice(0, 3).map((p) => p.age) };
  });
  console.log("Antes de avançar:", JSON.stringify(before));

  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: "season-1-ended.png" });

  const btnVisible = await page.evaluate(() => !document.getElementById("btnAdvanceSeason").classList.contains("hidden"));
  const simulateHidden = await page.evaluate(() => document.getElementById("btnSimulate").classList.contains("hidden"));
  console.log("Botão avançar temporada visível:", btnVisible, "| Simular rodada escondido:", simulateHidden);

  // #btnAdvanceSeason abre o confirmModal() próprio do app
  // (#confirmOverlay), não um diálogo NATIVO -- pré-existente, sem
  // relação com o checklist de UX desta etapa.
  await page.click("#btnAdvanceSeason");
  await page.waitForSelector("#confirmOverlay.open", { timeout: 5000 });
  await page.click("#confirmOkBtn");
  await page.waitForTimeout(500);
  await page.screenshot({ path: "season-2-modal.png" });

  await page.click("#btnSeasonContinue");
  await page.waitForTimeout(500);
  await page.screenshot({ path: "season-3-nova-temporada.png" });

  const after = await page.evaluate(async () => {
    const r = await fetch("/api/career");
    const data = await r.json();
    return {
      currentRound: data.career.currentRound,
      seasonYear: data.career.seasonYear,
      squadLen: data.career.squad.length,
      baseLen: data.career.squad.filter((p) => p.origin === "base").length,
      firstThreeAges: data.career.squad.slice(0, 5).map((p) => ({ name: p.name, age: p.age })),
      finances: data.career.finances,
      history: data.career.seasonHistory,
      standingsReset: Object.values(data.career.standings)[0],
    };
  });
  console.log("Depois de avançar:", JSON.stringify(after, null, 2));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
