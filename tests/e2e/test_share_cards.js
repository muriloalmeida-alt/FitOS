// Pedido do usuário (item 4 da lista de melhorias, "Vamos implementar
// todos na ordem abaixo"): "Compartilhar resultado como imagem —
// nenhum 'share card' existe (resultado da rodada, título conquistado,
// marco de carreira). É o gancho clássico de manager game pra
// reels/stories." Valida os 3 gatilhos (canvas gerado + Web Share API
// com fallback pra download direto do PNG, já que o Chromium headless
// deste ambiente não implementa navigator.share/canShare).
const { chromium } = require("playwright-core");

async function newCareer(page, base, email) {
  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Share Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "load" });
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(200);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnOnboardSkip", { timeout: 2000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
    args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 }, acceptDownloads: true });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("fonts.googleapis") && !m.text().includes("fundingchoices")) console.log("CONSOLE ERROR:", m.text()); });

  const base = "http://localhost:8787";
  await newCareer(page, base, `share${Date.now()}@teste.com`);

  // 1) "Compartilhar" existe no modal "Seu jogo" (Resultado da rodada)
  // e gera uma imagem PNG de verdade (fallback de download, já que
  // este Chromium headless não implementa a Web Share API).
  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(300);
  await page.click("#btnSimulate");
  await page.waitForSelector("#preMatchOverlay.open", { timeout: 5000 });
  await page.click("#btnPreMatchGo");
  await page.waitForSelector("#liveMatchOverlay.open", { timeout: 5000 });
  await page.click("#btnLiveSkip");
  await page.waitForSelector("#matchDetailOverlay.open", { timeout: 10000 });
  const shareBtnExists = await page.$("#btnMatchDetailShare");
  const [download1] = await Promise.all([
    page.waitForEvent("download", { timeout: 8000 }),
    page.click("#btnMatchDetailShare"),
  ]);
  console.log("1) Botão 'Compartilhar' existe em 'Seu jogo' e gera um PNG de verdade:", !!shareBtnExists && download1.suggestedFilename().endsWith(".png"), download1.suggestedFilename());

  // Fecha o fluxo pós-jogo pra não interferir com o resto do teste.
  await page.click("#btnMatchDetailCloseFooter", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(200);

  // 2) Conquista desbloqueada: botão "Compartilhar" gera imagem (era só
  // texto antes desta mudança).
  await page.evaluate(() => { setAchievementProgress("ach_fairplay", 1); });
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click('[data-submenu="progresso"]');
  await page.waitForTimeout(150);
  await page.click("#btnOpenConquistas");
  await page.waitForTimeout(200);
  await page.click('[data-achievement="ach_fairplay"]');
  await page.waitForTimeout(150);
  const shareVisible = await page.evaluate(() => !document.getElementById("btnShareAchievement").hidden);
  const [download2] = await Promise.all([
    page.waitForEvent("download", { timeout: 8000 }),
    page.click("#btnShareAchievement"),
  ]);
  console.log("2) Conquista desbloqueada mostra 'Compartilhar' e gera um PNG (não é mais só texto):", shareVisible && download2.suggestedFilename().endsWith(".png"), download2.suggestedFilename());
  await page.click("#achievementDetailClose", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(150);

  // 3) Título conquistado: sem ser campeão, o botão fica escondido;
  // sendo campeão (Brasileirão OU Copa), aparece e gera imagem.
  const hiddenWhenNotChampion = await page.evaluate(() => {
    showSeasonModal({ finishedYear: 2026, finishedPos: 8, finishedGoal: { label: "teste" }, goalWasMet: true, newYear: 2027, humanRenewal: { leavingNames: [], newBaseCount: 0, newPrincipalCount: 0 }, newGoal: { label: "teste" }, promotionRelegation: null, wasCupChampion: false });
    return document.getElementById("btnShareTitle").hidden;
  });
  await page.click("#seasonModalClose", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(100);
  const championState = await page.evaluate(() => {
    showSeasonModal({ finishedYear: 2026, finishedPos: 1, finishedGoal: { label: "teste" }, goalWasMet: true, newYear: 2027, humanRenewal: { leavingNames: [], newBaseCount: 0, newPrincipalCount: 0 }, newGoal: { label: "teste" }, promotionRelegation: null, wasCupChampion: false });
    return document.getElementById("btnShareTitle").hidden;
  });
  const [download3] = await Promise.all([
    page.waitForEvent("download", { timeout: 8000 }),
    page.click("#btnShareTitle"),
  ]);
  console.log("3) 'Compartilhar título' some sem título e aparece + gera PNG sendo campeão:", hiddenWhenNotChampion === true && championState === false && download3.suggestedFilename().endsWith(".png"), download3.suggestedFilename());

  await browser.close();
  console.log("OK");
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
