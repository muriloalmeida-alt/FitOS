// Verifica o Play-by-Play v1: banco de comentários com variações,
// eventos chance_perdida/defesa, controles de velocidade 1x/2x,
// destaque de gol em tela cheia, estatísticas agregadas na tela
// "Seu jogo" e o botão "Rever lances".
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `pbp${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "PBP Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(200);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);

  // 1) Iniciar partida ao vivo.
  await page.click("#btnSimulate");
  await page.waitForSelector("#preMatchOverlay.open", { timeout: 5000 });
  await page.click("#btnPreMatchGo");
  await page.waitForSelector("#liveMatchOverlay.open", { timeout: 5000 });
  console.log("1) Tela Ao Vivo abriu:", await page.locator("#liveMatchOverlay.open").count() === 1);

  // 2) Controles de velocidade — clicar 2x muda o estado ativo.
  await page.click("#liveSpeedToggle .mt-live-speed-btn[data-speed='2']");
  const speedState = await page.evaluate(() => ({
    speed: LIVE_MATCH.speed,
    activeBtn: document.querySelector("#liveSpeedToggle .mt-live-speed-btn.active").dataset.speed,
  }));
  console.log("2) Velocidade 2x aplicada (LIVE_MATCH.speed=2, botão 2x ativo):", speedState.speed === 2 && speedState.activeBtn === "2", JSON.stringify(speedState));
  await page.click("#liveSpeedToggle .mt-live-speed-btn[data-speed='1']");

  // 3) Espera alguns tempos passarem (2x = ~450ms por tempo) e checa
  // se chance_perdida/defesa já apareceram no feed (evento novo).
  await page.waitForTimeout(2500);
  const feedTypes = await page.evaluate(() => LIVE_MATCH ? [...new Set(LIVE_MATCH.events.map((e) => e.type))] : []);
  console.log("3) Feed já tem tipos de evento variados (chance_perdida ou defesa presentes):",
    feedTypes.includes("chance_perdida") || feedTypes.includes("defesa"), JSON.stringify(feedTypes));

  // 4) Pular pro fim e checar estado final.
  await page.click("#btnLiveSkip");
  await page.waitForSelector("#matchDetailOverlay.open", { timeout: 8000 });
  console.log("4) Partida terminou, modal 'Seu jogo' abriu:", true);

  // 5) Estatísticas (posse/finalizações/no alvo/faltas) aparecem.
  const stats = await page.evaluate(() => {
    const card = document.getElementById("matchDetailStatsCard");
    const rows = [...document.querySelectorAll(".mt-stat-bar-row")];
    return { visible: !card.classList.contains("hidden"), rowCount: rows.length, labels: rows.map((r) => r.querySelector(".mt-stat-bar-label").textContent) };
  });
  console.log("5) Cartão de estatísticas visível com 4 métricas:", stats.visible && stats.rowCount === 4, JSON.stringify(stats.labels));

  // 6) "Rever lances" abre o feed completo (inclui chance/defesa/sub).
  await page.click("#btnMatchDetailReplay");
  await page.waitForSelector("#matchReplayOverlay.open", { timeout: 3000 });
  const replay = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("#matchReplayFeed .mt-live-tl-event")];
    return { count: rows.length, hasText: rows.length > 0 && rows[0].querySelector(".mt-live-tl-desc").textContent.length > 0 };
  });
  console.log("6) 'Rever lances' mostra o feed completo (com texto de comentário):", replay.count > 0 && replay.hasText, replay.count);
  await page.click("#matchReplayClose");
  await page.waitForTimeout(200);

  // 7) Gol assistido: título + assistência como linha própria (não
  // mais um evento "Assistência" separado na lista).
  const goalRow = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("#matchDetailEvents .ct-event-row")];
    const withAssist = rows.find((r) => r.querySelector(".ct-event-assist"));
    return { totalRows: rows.length, hasAssistLine: !!withAssist, assistText: withAssist ? withAssist.querySelector(".ct-event-assist").textContent : null };
  });
  console.log("7) Lista de eventos (gol/cartão) sem linha 'Assistência' separada — vira sub-linha do gol:", JSON.stringify(goalRow));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
