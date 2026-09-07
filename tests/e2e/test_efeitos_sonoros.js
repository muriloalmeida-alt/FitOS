// Pedido do usuário (item 3 da lista de melhorias, "Vamos implementar
// todos na ordem abaixo"): "Efeitos sonoros leves — apito de início/
// fim, som de gol, torcida ambiente. Reforça a identidade 'estádio à
// noite' sem custo de dado, e nenhum som existe hoje no app inteiro."
// Valida o módulo de som (Web Audio API, sem arquivo de áudio nenhum):
// toggle em Configurações persiste por dispositivo (localStorage), as
// funções não estouram erro quando ligadas/desligadas, e os 3 hooks
// reais (apito de início/fim + som de gol) disparam sem quebrar a
// partida ao vivo de verdade.
const { chromium } = require("playwright-core");

async function newCareer(page, base, email) {
  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "SFX Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "load" });
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(200);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnOnboardSkip", { timeout: 2000 }).catch(() => {});
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
    args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("fonts.googleapis") && !m.text().includes("fundingchoices")) console.log("CONSOLE ERROR:", m.text()); });

  const base = "http://localhost:8787";
  await newCareer(page, base, `sfx${Date.now()}@teste.com`);

  // 1) Default é ligado (sem nada salvo ainda em localStorage).
  const defaultOn = await page.evaluate(() => typeof SFX_ENABLED === "boolean" && SFX_ENABLED === true);
  console.log("1) Efeitos sonoros vêm ligados por padrão:", defaultOn);

  // 2) Toggle em Configurações desliga de verdade e persiste em
  // localStorage (dado de DISPOSITIVO, não de conta/carreira).
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#btnOpenSettings");
  await page.waitForTimeout(200);
  const sfxToggle = await page.$("#settingsSfxToggleBtn");
  console.log("2a) Toggle 'Efeitos sonoros' existe em Configurações:", !!sfxToggle);
  await page.click("#settingsSfxToggleBtn");
  await page.waitForTimeout(100);
  const offState = await page.evaluate(() => ({ sfxEnabled: SFX_ENABLED, stored: localStorage.getItem("mt_sfx_enabled"), toggleOn: document.getElementById("settingsSfxToggleBtn").classList.contains("on") }));
  console.log("2b) Desligar o toggle atualiza SFX_ENABLED, localStorage e a classe visual:", offState.sfxEnabled === false && offState.stored === "0" && offState.toggleOn === false, JSON.stringify(offState));

  // 3) Com som desligado, chamar as funções de som não cria contexto
  // nenhum (sfxCtx() retorna null) nem estoura erro.
  const disabledNoop = await page.evaluate(() => {
    playWhistle(1); playGoal(true); playGoal(false); startCrowdAmbience(); stopCrowdAmbience();
    return SFX_CTX === null;
  });
  console.log("3) Com som desligado, as funções não criam AudioContext (no-op silencioso):", disabledNoop);

  // 4) Religar o toggle e confirmar que as funções agora criam um
  // AudioContext de verdade e não estouram erro nenhum.
  await page.click("#settingsSfxToggleBtn");
  await page.waitForTimeout(100);
  const enabledWorks = await page.evaluate(() => {
    playWhistle(1);
    playGoal(true);
    playGoal(false);
    startCrowdAmbience();
    const hasCtx = SFX_CTX instanceof (window.AudioContext || window.webkitAudioContext);
    const hasCrowd = !!SFX_CROWD_SOURCE;
    stopCrowdAmbience();
    return { stored: localStorage.getItem("mt_sfx_enabled"), hasCtx, hasCrowd, crowdStoppedAfter: SFX_CROWD_SOURCE === null };
  });
  console.log("4) Religado, as funções criam AudioContext real e a torcida ambiente liga/desliga:", enabledWorks.stored === "1" && enabledWorks.hasCtx && enabledWorks.hasCrowd && enabledWorks.crowdStoppedAfter, JSON.stringify(enabledWorks));

  // Fecha Configurações antes de seguir pro fluxo real de partida.
  await page.evaluate(() => { closeSettingsScreen(); });
  await page.waitForTimeout(150);

  // 5) Fluxo real: abrir a partida ao vivo chama playWhistle(1) +
  // startCrowdAmbience() (kickoff) — confirma que o hook de
  // startLiveMatch está de fato ligado, sem quebrar a abertura da tela.
  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(300);
  await page.click("#btnSimulate");
  await page.waitForSelector("#preMatchOverlay.open", { timeout: 5000 });
  await page.click("#btnPreMatchGo");
  await page.waitForSelector("#liveMatchOverlay.open", { timeout: 5000 });
  const kickoff = await page.evaluate(() => ({ hasCtx: !!SFX_CTX, hasCrowd: !!SFX_CROWD_SOURCE }));
  console.log("5) Apito de início + torcida ambiente disparam ao abrir a partida:", kickoff.hasCtx && kickoff.hasCrowd, JSON.stringify(kickoff));

  // 6) "Pular pro fim" resolve a partida inteira (com possíveis gols,
  // cada um chamando playGoal via showNextGoalHighlight) sem nenhum
  // erro de página, e finishLiveMatch para a torcida ambiente no fim.
  await page.click("#btnLiveSkip");
  await page.waitForSelector("#liveMatchOverlay:not(.open)", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(600);
  const afterMatch = await page.evaluate(() => ({ overlayOpen: document.getElementById("liveMatchOverlay").classList.contains("open"), crowdStopped: SFX_CROWD_SOURCE === null }));
  console.log("6) Partida termina normalmente (sem travar) e a torcida ambiente para no apito final:", !afterMatch.overlayOpen && afterMatch.crowdStopped, JSON.stringify(afterMatch));

  await browser.close();
  console.log("OK");
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
