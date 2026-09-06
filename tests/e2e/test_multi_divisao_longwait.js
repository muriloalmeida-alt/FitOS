// Verifica o Modo Carreira multi-divisão: seletor de campeonato,
// Escolha do Clube restrita à divisão escolhida, CAREER.competitionId
// persistido, e reabertura (reload) carregando a divisão certa.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `multidiv${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Multi Divisao", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);

  // 1) Seletor de campeonato aparece primeiro (carreira nova).
  const pickerVisible = await page.evaluate(() => !document.getElementById("screenCompetitionPicker").classList.contains("hidden"));
  const cards = await page.evaluate(() => [...document.querySelectorAll(".mt-competition-card .mt-competition-title")].map((el) => el.textContent));
  console.log("1) Seletor de campeonato aparece com as 3 divisões:", pickerVisible && cards.length === 3, JSON.stringify(cards));

  // 2) Escolher Série B carrega os times certos (demo, plano freemium
  // -- sem chave de API neste ambiente) e mostra a Escolha do Clube.
  await page.click('.mt-competition-card[data-competition="serie_b"]');
  await page.waitForTimeout(500);
  const afterChoice = await page.evaluate(() => ({
    screenPickerVisible: !document.getElementById("screenPicker").classList.contains("hidden"),
    competitionId: CURRENT_COMPETITION_ID,
    teamCount: LEAGUE_TEAMS.length,
    hasCoritiba: LEAGUE_TEAMS.some((t) => t.name === "Coritiba"),
  }));
  console.log("2) Após escolher Série B: Escolha do Clube mostra os times certos:", afterChoice.screenPickerVisible && afterChoice.competitionId === "serie_b" && afterChoice.teamCount === 20 && afterChoice.hasCoritiba, JSON.stringify(afterChoice));

  // 3) Criar a carreira grava competitionId certo -- já estamos na
  // Escolha do Clube da Série B (passo 2 acima), sem precisar passar
  // pelo seletor de campeonato de novo.
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(600);
  const career = await page.evaluate(async () => (await (await fetch("/api/career")).json()).career);
  console.log("3) Carreira criada com competitionId='serie_b':", career.competitionId === "serie_b", career.competitionId);

  // 4) Recarregar a página (sessão + carreira salva) reabre DIRETO na
  // Série B, sem passar pelo seletor de novo, e sem misturar times de
  // outra divisão.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  const afterReload = await page.evaluate(() => ({
    gameVisible: !document.getElementById("screenGame").classList.contains("hidden"),
    competitionId: CURRENT_COMPETITION_ID,
    clubName: CAREER.clubName,
  }));
  console.log("4) Reload reabre direto no jogo, na Série B (sem passar pelo seletor de novo):", afterReload.gameVisible && afterReload.competitionId === "serie_b", JSON.stringify(afterReload));

  // 5) "Reiniciar" volta pro seletor de campeonato (não direto pro
  // picker de clube da mesma divisão de antes).
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#btnRestart");
  await page.waitForSelector("#confirmOverlay.open", { timeout: 3000 });
  await page.click("#confirmOkBtn");
  await page.waitForTimeout(2000);
  const afterRestart = await page.evaluate(() => !document.getElementById("screenCompetitionPicker").classList.contains("hidden"));
  console.log("5) 'Reiniciar' volta pro seletor de campeonato:", afterRestart);

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
