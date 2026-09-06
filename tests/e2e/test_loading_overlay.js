// Nova feature — tela de loading genérica: aparece só se uma ação
// (qualquer chamada de rede via fetchJSON) demorar mais de 3s, some
// assim que termina.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `loadingoverlay${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Loading Overlay", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(300);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.waitForTimeout(1500);
  await page.click("#btnClaimDailyLogin").catch(() => {});
  await page.waitForTimeout(200);

  // 1) Ação RÁPIDA (fetchJSON normal, sem atraso artificial) nunca
  // mostra o overlay -- persistCareer() de verdade, servidor local
  // responde bem antes de 3s.
  await page.evaluate(() => persistCareer());
  await page.waitForTimeout(300);
  const check1 = await page.evaluate(() => document.getElementById("actionLoadingOverlay").classList.contains("open"));
  console.log("1) Ação rápida nunca mostra o overlay:", !check1, check1);

  // 2) Ação que demora MAIS de 3s mostra o overlay depois de 3s (não
  // antes) e some assim que termina -- monkey-patch em window.fetch
  // (não a rede de verdade, ver nota abaixo) atrasando só a PRÓXIMA
  // chamada em 6s antes de repassar pro fetch real (bem mais que os 3s
  // do timer, pra sobrar uma janela folgada de observação ANTES da
  // chamada terminar — um atraso perto demais do ponto de checagem, tipo
  // 3.5s pra checar em 3.7s, é frágil: qualquer overhead de I/O real
  // (round-trip do Playwright, disco, rede local) pode terminar a
  // chamada ANTES do ponto de checagem, escondendo o overlay de novo e
  // gerando falso negativo -- foi exatamente isso que aconteceu numa
  // 1ª versão deste teste, ver diagnóstico no histórico do commit).
  // NOTA: tentei via page.route() interceptando a rede de verdade, mas
  // o Chromium headless deste sandbox não reinterceptou uma 2ª
  // requisição idêntica à mesma URL já feita antes (bug/particularidade
  // do ambiente, não do app) — atrasar window.fetch em si (mesma
  // função que fetchJSON chama) testa exatamente o mesmo mecanismo sem
  // depender da camada de rede do Playwright.
  const origFetchRef = await page.evaluateHandle(() => window.fetch);
  await page.evaluate((orig) => {
    window.__origFetchForTest = orig;
    window.fetch = (...args) => new Promise((resolve) => setTimeout(() => resolve(orig(...args)), 6000));
  }, origFetchRef);
  const fetchPromise = page.evaluate(() => fetchJSON("/api/career"));
  await page.waitForTimeout(2000);
  const stillHiddenAt2s = await page.evaluate(() => !document.getElementById("actionLoadingOverlay").classList.contains("open"));
  await page.waitForTimeout(2000); // total ~4s desde o início da chamada -- depois do timer de 3s, bem antes da chamada terminar em ~6s
  const visibleAt4s = await page.evaluate(() => document.getElementById("actionLoadingOverlay").classList.contains("open"));
  await fetchPromise;
  await page.waitForTimeout(100);
  const hiddenAfterDone = await page.evaluate(() => !document.getElementById("actionLoadingOverlay").classList.contains("open"));
  console.log("2) Overlay escondido em 2s, visível em 4s, escondido de novo assim que a chamada termina:",
    stillHiddenAt2s && visibleAt4s && hiddenAfterDone,
    JSON.stringify({ stillHiddenAt2s, visibleAt4s, hiddenAfterDone }));

  // 3) Chamadas SIMULTÂNEAS: só esconde quando a ÚLTIMA também termina
  // (uma rápida, outra lenta, ao mesmo tempo) -- restaura o fetch
  // original de verdade (guardado antes do check 2) e atrasa só UMA
  // chamada específica via um contador, senão o patch do check 2 (que
  // atrasa TODA chamada) continuaria ativo e a "rápida" também ficaria
  // lenta, invalidando o teste.
  await page.evaluate(() => {
    let n = 0;
    const orig = window.__origFetchForTest;
    window.fetch = (...args) => {
      n++;
      if (n === 1) return new Promise((resolve) => setTimeout(() => resolve(orig(...args)), 6000)); // 1ª chamada = lenta
      return orig(...args); // demais = normais
    };
  });
  const check3 = await page.evaluate(async () => {
    const slow = fetchJSON("/api/career"); // 1ª chamada -- vai demorar 6s
    const fast = fetchJSON("/api/career"); // 2ª chamada -- normal, termina rápido
    await fast;
    const overlayRightAfterFastDone = document.getElementById("actionLoadingOverlay").classList.contains("open");
    await slow;
    await new Promise((r) => setTimeout(r, 100));
    const overlayAfterSlowDone = document.getElementById("actionLoadingOverlay").classList.contains("open");
    return { overlayRightAfterFastDone, overlayAfterSlowDone };
  });
  console.log("3) Com 2 chamadas simultâneas, some só quando a última (mais lenta) termina:",
    check3.overlayRightAfterFastDone === false && check3.overlayAfterSlowDone === false, JSON.stringify(check3));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
