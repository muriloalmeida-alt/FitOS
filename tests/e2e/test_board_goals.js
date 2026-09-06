const { chromium } = require("playwright-core");

async function forceStandings(page, { rank }) {
  // rank: "first" (bate qualquer meta) ou "last" (falha qualquer meta)
  await page.evaluate(async (rank) => {
    const r = await fetch("/api/career");
    const data = await r.json();
    const career = data.career;
    const ids = Object.keys(career.standings);
    ids.forEach((id, i) => {
      const s = career.standings[id];
      if (String(id) === String(career.clubId)) {
        s.pts = rank === "first" ? 999 : -999;
        s.v = rank === "first" ? 38 : 0;
        s.sg = rank === "first" ? 100 : -100;
        s.gp = rank === "first" ? 100 : 0;
      } else {
        s.pts = rank === "first" ? i : 500 - i;
      }
    });
    career.currentRound = 39;
    await fetch("/api/career", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(career) });
  }, rank);
}
async function setStreak(page, n) {
  await page.evaluate(async (n) => {
    const r = await fetch("/api/career");
    const data = await r.json();
    data.career.negativeSeasonsStreak = n;
    await fetch("/api/career", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data.career) });
  }, n);
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
  const email = `boardgoals${Date.now()}@teste.com`;

  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Board Goals", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  // 1) Meta existe já na criação da carreira e aparece na Central
  const initial = await page.evaluate(async () => (await (await fetch("/api/career")).json()).career.boardGoal);
  console.log("1) Meta inicial:", initial);
  const labelText = await page.evaluate(() => document.getElementById("boardGoalLabel").textContent);
  console.log("   Label na Central:", labelText);

  // 2) Cenário A: streak=2, temporada RUIM (última posição) -> demissão (streak vira 3)
  await setStreak(page, 2);
  await forceStandings(page, { rank: "last" });
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(800);
  await page.click("#btnAdvanceSeason");
  await page.waitForTimeout(200);
  await page.click("#confirmOkBtn");
  await page.waitForTimeout(400);
  const dismissalOpen = await page.evaluate(() => document.getElementById("dismissalOverlay").classList.contains("open"));
  const seasonOpenA = await page.evaluate(() => document.getElementById("seasonOverlay").classList.contains("open"));
  const dismissalText = await page.evaluate(() => document.getElementById("dismissalText").textContent);
  console.log("2) Cenário A (streak 2 + temporada ruim) -- modal de demissão abriu:", dismissalOpen, "| modal de nova temporada abriu (deve ser false):", seasonOpenA);
  console.log("   Texto da demissão:", dismissalText);

  // 3) Confirma "Escolher outro clube" -- deve voltar pro picker e apagar o save
  await page.click("#btnDismissalContinue");
  await page.waitForTimeout(400);
  // AJUSTE (feature/carreira-multi-divisao) -- "Escolher outro clube" agora
  // volta pro SELETOR DE COMPETIÇÃO (nova 1ª etapa), não direto pro
  // seletor de clube.
  const pickerVisible = await page.evaluate(() => !document.getElementById("screenCompetitionPicker").classList.contains("hidden"));
  const careerGone = await page.evaluate(async () => (await (await fetch("/api/career")).json()).career);
  console.log("3) Voltou pro seletor de competição:", pickerVisible, "| save apagado (career null):", careerGone === null);

  // 4) Cenário B: nova carreira, streak=2, mas temporada BOA -> reseta streak, NÃO demite
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(200);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
  await setStreak(page, 2);
  await forceStandings(page, { rank: "first" });
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(800);
  await page.click("#btnAdvanceSeason");
  await page.waitForTimeout(200);
  await page.click("#confirmOkBtn");
  await page.waitForTimeout(400);
  const seasonOpenB = await page.evaluate(() => document.getElementById("seasonOverlay").classList.contains("open"));
  const dismissalOpenB = await page.evaluate(() => document.getElementById("dismissalOverlay").classList.contains("open"));
  const summaryTextB = await page.evaluate(() => document.getElementById("seasonSummaryText").textContent);
  const streakAfterB = await page.evaluate(async () => (await (await fetch("/api/career")).json()).career.negativeSeasonsStreak);
  console.log("4) Cenário B (streak 2 + temporada boa) -- modal de nova temporada abriu:", seasonOpenB, "| demissão abriu (deve ser false):", dismissalOpenB);
  console.log("   Resumo:", summaryTextB);
  console.log("   Streak depois (deve ser 0):", streakAfterB);

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
