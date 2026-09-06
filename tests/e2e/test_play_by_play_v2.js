// Verifica o Play-by-Play v2: lesão narrada, pênalti (marcado/perdido),
// VAR e a barra de posse ao vivo. Roda VÁRIAS partidas (eventos raros)
// até achar cada tipo pelo menos uma vez, ou desiste depois de um
// número razoável de tentativas (são decorativos/probabilísticos).
const { chromium } = require("playwright-core");

async function playOneMatch(page) {
  await page.click("#btnSimulate");
  await page.waitForSelector("#preMatchOverlay.open", { timeout: 5000 });
  await page.click("#btnPreMatchGo");
  await page.waitForSelector("#liveMatchOverlay.open", { timeout: 5000 });
  await page.click("#btnLiveSkip");
  await page.waitForSelector("#matchDetailOverlay.open", { timeout: 8000 });
  const allEvents = await page.evaluate(() => (typeof PENDING_ROUND_SUMMARY !== "undefined" && PENDING_ROUND_SUMMARY && PENDING_ROUND_SUMMARY.humanMatch && PENDING_ROUND_SUMMARY.humanMatch.allEvents) || []);
  await page.click("#btnMatchDetailCloseFooter");
  await page.waitForTimeout(150);
  return allEvents.map((e) => e.type);
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `pbpv2_${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "PBP V2", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  // 1) Barra de posse ao vivo aparece com valores plausíveis já no
  // início da partida (antes de qualquer tempo resolver -- 50/50).
  await page.click("#btnSimulate");
  await page.waitForSelector("#preMatchOverlay.open", { timeout: 5000 });
  await page.click("#btnPreMatchGo");
  await page.waitForSelector("#liveMatchOverlay.open", { timeout: 5000 });
  const possInitial = await page.evaluate(() => ({
    mine: document.getElementById("livePossMineLabel").textContent,
    opp: document.getElementById("livePossOppLabel").textContent,
  }));
  console.log("1) Barra de posse inicia 50%/50%:", possInitial.mine === "50%" && possInitial.opp === "50%", JSON.stringify(possInitial));
  await page.waitForTimeout(2000);
  const possAfter = await page.evaluate(() => ({
    mine: document.getElementById("livePossMineLabel").textContent,
    opp: document.getElementById("livePossOppLabel").textContent,
  }));
  const sumOk = parseInt(possAfter.mine) + parseInt(possAfter.opp) === 100;
  console.log("2) Barra de posse atualiza depois de alguns tempos (soma 100%):", sumOk, JSON.stringify(possAfter));
  await page.click("#btnLiveSkip");
  await page.waitForSelector("#matchDetailOverlay.open", { timeout: 8000 });
  await page.click("#btnMatchDetailCloseFooter");
  await page.waitForTimeout(200);

  // 2) Roda várias partidas seguidas até achar os 4 tipos raros do v2.
  const found = new Set();
  const wanted = ["lesao", "penalty_awarded", "penalty_missed", "var_check"];
  for (let i = 0; i < 32 && wanted.some((t) => !found.has(t)); i++) {
    const seasonOver = await page.evaluate(() => document.getElementById("btnSimulate").classList.contains("hidden"));
    if (seasonOver) { console.log("   (temporada acabou antes de achar tudo, parando o loop)"); break; }
    const types = await playOneMatch(page);
    types.forEach((t) => found.add(t));
  }
  console.log("3) Tipos v2 encontrados rodando várias partidas:", JSON.stringify([...found].filter((t) => wanted.includes(t))));
  wanted.forEach((t) => console.log(`   - ${t} apareceu:`, found.has(t)));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
