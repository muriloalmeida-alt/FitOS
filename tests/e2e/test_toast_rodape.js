// Verifica que o toast nunca fica atrás/colado nos botões fixos do
// rodapé (nav, barra de ação, rodapé de modal) em várias situações.
const { chromium } = require("playwright-core");

function toastVsChrome(page, chromeSelector) {
  return page.evaluate((sel) => {
    const toastEl = document.getElementById("toast");
    // pega o elemento REALMENTE visível entre os que casam o seletor
    // (pode haver mais de um .mt-action-bar no DOM, só um visível).
    const candidates = [...document.querySelectorAll(sel)];
    const chromeEl = candidates.find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }) || candidates[0];
    const t = toastEl.getBoundingClientRect();
    const c = chromeEl.getBoundingClientRect();
    return { toastTop: t.top, toastBottom: t.bottom, chromeTop: c.top, chromeBottom: c.bottom, gap: c.top - t.bottom, toastVisible: toastEl.style.display === "flex" };
  }, chromeSelector);
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 700 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `toastfix${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Toast Fix", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  // 1) Escalação: "Escalar automaticamente" dispara toast -- não pode
  // ficar atrás da barra de ação nem da nav.
  await page.click(".m3-nav-item[data-panel='escalacao']");
  await page.waitForTimeout(200);
  await page.click("#btnAutoLineup");
  await page.waitForTimeout(100);
  const r1 = await toastVsChrome(page, ".mt-action-bar");
  console.log("1) Escalação (auto-escalar) -- toast acima da barra de ação (gap >= 0):", r1.toastVisible && r1.gap >= 0, JSON.stringify(r1));

  // 2) Salvar escalação e táticas -- mesma barra de ação.
  await page.click("#btnSaveLineup");
  await page.waitForTimeout(100);
  const r2 = await toastVsChrome(page, ".mt-action-bar");
  console.log("2) Escalação (salvar) -- toast acima da barra de ação:", r2.toastVisible && r2.gap >= 0, JSON.stringify(r2));

  // 3) Aba SEM barra de ação (Elenco) -- toast deve subir acima da nav
  // mesmo sem action-bar (algum toast simples: usa o helper direto).
  await page.click(".m3-nav-item[data-panel='elenco']");
  await page.waitForTimeout(150);
  await page.evaluate(() => toast("Teste de toast sem barra de ação"));
  await page.waitForTimeout(100);
  const r3 = await toastVsChrome(page, ".m3-bottom-nav");
  console.log("3) Elenco (sem barra de ação) -- toast acima da nav:", r3.toastVisible && r3.gap >= 0, JSON.stringify(r3));

  // 4) Dentro da modal "Ajustar escalação" (dois rodapés fixos
  // empilhados: o da modal por cima do Confirmar escalação por baixo)
  // -- "Escalar automaticamente" ali dispara o mesmo toast; deve subir
  // acima do rodapé DA MODAL (não da nav, escondida atrás dela).
  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(200);
  await page.click("#btnSimulate");
  await page.waitForSelector("#preMatchOverlay.open", { timeout: 5000 });
  await page.click("#btnPreMatchAdjust");
  await page.waitForSelector("#adjustLineupOverlay.open", { timeout: 5000 });
  await page.click("#btnAutoLineup");
  await page.waitForTimeout(100);
  const r4 = await toastVsChrome(page, "#adjustLineupOverlay .ct-modal-footer");
  console.log("4) Dentro de 'Ajustar escalação' -- toast acima do rodapé DESSA modal:", r4.toastVisible && r4.gap >= 0, JSON.stringify(r4));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
