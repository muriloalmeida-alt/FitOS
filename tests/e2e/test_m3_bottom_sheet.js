// Testa o componente Bottom Sheet M3 (.m3-bottom-sheet*,
// S3-DS20-S4-PREP-001, issue #10). Sem ponto de integração obrigatório
// nesta demanda (ver escopo — nenhuma tela chama openM3BottomSheet()
// ainda), então o teste exercita a API diretamente via
// window.openM3BottomSheet(), o mesmo contrato genérico
// (m3OpenOverlay) já coberto ponta-a-ponta pelo Dialog em
// test_m3_dialog.js — aqui o foco é: título/corpo populados
// corretamente, e foco preso alternando entre 2 elementos focáveis
// (fechar + um botão de teste no corpo), caso não coberto pelo Dialog
// (corpo somente-leitura, só 1 focável).
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("console", (msg) => { if (msg.type() === "error") console.log("CONSOLE ERROR:", msg.text()); });
  const base = "http://localhost:8787";
  const email = `m3sheet${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "M3 Sheet Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(300);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnOnboardSkip", { timeout: 2000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300);

  // Abre com um botão de teste no corpo (2º elemento focável, além do
  // botão fechar) — exercita o wrap-around do foco preso nos 2 lados.
  await page.evaluate(() => {
    window.openM3BottomSheet({ title: "Teste E2E", bodyHTML: '<button id="testSheetBtn">Ação de teste</button>' });
  });
  await page.waitForTimeout(200);

  // 1) Abriu com role/aria-modal/aria-labelledby resolvendo pro título
  // passado, e o corpo populado com o HTML passado.
  const state = await page.evaluate(() => {
    const overlay = document.getElementById("m3BottomSheetOverlay");
    const labelId = overlay.getAttribute("aria-labelledby");
    return {
      open: overlay.classList.contains("open"),
      role: overlay.getAttribute("role"),
      ariaModal: overlay.getAttribute("aria-modal"),
      labelText: labelId ? document.getElementById(labelId).textContent : null,
      hasTestBtn: !!document.getElementById("testSheetBtn"),
    };
  });
  console.log("1) Bottom Sheet abriu com título/corpo corretos e role=dialog/aria-modal:",
    state.open && state.role === "dialog" && state.ariaModal === "true" && state.labelText === "Teste E2E" && state.hasTestBtn,
    JSON.stringify(state));

  // 2) Foco moveu pro primeiro focável (botão fechar, antes do corpo
  // no DOM).
  const focusedOnOpen = await page.evaluate(() => document.activeElement.id);
  console.log("2) Foco movido pro 1º focável (botão fechar) ao abrir:", focusedOnOpen === "m3BottomSheetClose", focusedOnOpen);

  await page.screenshot({ path: "m3_bottom_sheet_01_open.png" }).catch(() => {});

  // 3) Tab avança pro 2º focável (botão de teste no corpo) — 2
  // elementos focáveis, diferente do Dialog (só 1).
  await page.keyboard.press("Tab");
  const focusedAfterTab1 = await page.evaluate(() => document.activeElement.id);
  console.log("3) Tab avança pro botão do corpo:", focusedAfterTab1 === "testSheetBtn", focusedAfterTab1);

  // 4) Tab de novo dá a volta (wrap-around) de volta pro botão fechar.
  await page.keyboard.press("Tab");
  const focusedAfterTab2 = await page.evaluate(() => document.activeElement.id);
  console.log("4) Tab dá a volta de volta pro botão fechar (foco preso):", focusedAfterTab2 === "m3BottomSheetClose", focusedAfterTab2);

  // 5) Shift+Tab do primeiro focável dá a volta pro último (wrap
  // reverso).
  await page.keyboard.press("Shift+Tab");
  const focusedAfterShiftTab = await page.evaluate(() => document.activeElement.id);
  console.log("5) Shift+Tab do primeiro dá a volta pro último (wrap reverso):", focusedAfterShiftTab === "testSheetBtn", focusedAfterShiftTab);

  // 6) Esc fecha.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  const closedByEsc = await page.evaluate(() => !document.getElementById("m3BottomSheetOverlay").classList.contains("open"));
  console.log("6) Esc fecha o Bottom Sheet:", closedByEsc);

  // 7) Reabrir com conteúdo diferente funciona (sem listener vazado) e
  // clique no backdrop fecha.
  await page.evaluate(() => window.openM3BottomSheet({ title: "Segunda abertura", bodyHTML: "<p>Outro conteúdo</p>" }));
  await page.waitForTimeout(200);
  const secondOpenTitle = await page.evaluate(() => document.getElementById("m3BottomSheetTitle").textContent);
  await page.evaluate(() => document.getElementById("m3BottomSheetOverlay").click());
  await page.waitForTimeout(150);
  const closedByBackdrop = await page.evaluate(() => !document.getElementById("m3BottomSheetOverlay").classList.contains("open"));
  console.log("7) Reabre com conteúdo novo e clique no backdrop fecha (sem listener vazado):", secondOpenTitle === "Segunda abertura" && closedByBackdrop);

  await browser.close();
})();
