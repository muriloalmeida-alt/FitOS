// SAVE-LIMIT-001 (issue #29) — teste e2e via UI real. Cobre o que a
// lógica pura de careerStore.js (ver
// test_save_limit_001_careerstore.js) não alcança: o fluxo real do
// cliente (persistCareer()) contra o servidor real, a resposta HTTP
// comprimida (Content-Encoding: gzip em GET /api/career), e o cap
// novo de CLUB_HISTORY_MAX no cliente (carreira.js).
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `savelimit001${Date.now()}@teste.com`;

  let putStatus = null, putBodyBytes = null;
  page.on("response", (res) => {
    if (res.url().includes("/api/career") && res.request().method() === "PUT") {
      putStatus = res.status();
      putBodyBytes = Buffer.byteLength(res.request().postData() || "", "utf8");
    }
  });

  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Save Limit", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForSelector(".m3-club-row", { timeout: 15000 });
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

  // 1) Carreira "multi" real (marketScope sempre "multi" hoje) salva
  // sem 413 — o cenário relatado pelo usuário ("save ficou grande
  // demais") era exatamente na criação/1ª tentativa de salvar.
  console.log("1) Carreira 'multi' real (~500-600KB de JSON bruto) salva sem 413:",
    putStatus === 200, JSON.stringify({ putStatus, putBodyBytes }));

  // 2) GET /api/career volta comprimido (Content-Encoding: gzip) e os
  // dados batem 1:1 com o que está em memória.
  const check2 = await page.evaluate(async () => {
    const res = await fetch("/api/career");
    const data = await res.json();
    return { contentEncoding: res.headers.get("content-encoding"), matches: JSON.stringify(data.career) === JSON.stringify(CAREER) };
  });
  console.log("2) GET /api/career comprimido (Content-Encoding: gzip) e os dados batem 1:1:",
    check2.contentEncoding === "gzip" && check2.matches, JSON.stringify(check2));

  // 3) CLUB_HISTORY_MAX: forçar 20 trocas de clube nunca deixa mais de
  // 15 entradas (gap confirmado e corrigido nesta demanda).
  const check3 = await page.evaluate(() => {
    for (let i = 0; i < 20; i++) {
      endCurrentClubStint("dismissed");
      CAREER.clubHistory = TECHNICIAN_CARRY.clubHistory;
    }
    return { length: CAREER.clubHistory.length };
  });
  console.log("3) CLUB_HISTORY_MAX capa em 15 mesmo depois de 20 trocas de clube:", check3.length === 15, JSON.stringify(check3));

  // 4) Save antigo (sem o cap novo, > 15 entradas) é normalizado ao
  // carregar — mesmo tratamento de compatibilidade de qualquer outro
  // *_MAX (ver migrateCareerDefaults em carreira.js).
  const check4 = await page.evaluate(() => {
    CAREER.clubHistory = Array.from({ length: 30 }, (_, i) => ({ clubId: "x" + i, clubName: "X" + i, seasons: 1, titles: 0, avgPosition: 10, reason: "dismissed" }));
    migrateCareerDefaults();
    return { length: CAREER.clubHistory.length };
  });
  console.log("4) Save antigo com clubHistory > 15 é normalizado ao carregar (compatibilidade preservada):", check4.length === 15, JSON.stringify(check4));

  // 5) Depois de tudo isso, salvar continua funcionando normalmente
  // (nenhuma regressão na persistência normal do jogo).
  const ok5 = await page.evaluate(async () => await persistCareer());
  console.log("5) persistCareer() continua funcionando normalmente depois de tudo isso:", ok5);

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
