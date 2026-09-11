// S4-B4-003 (issue #33) — teste e2e via UI real. Cobre a migração de
// tokens de Marcação individual (.mt-sel-row/.mt-sel-name/.mt-info-line
// b, --mt-navy-700/--mt-ivory-50/--mt-ink-faint/--mt-ivory-100 →
// --m3-outline-variant/--m3-on-surface/--m3-on-surface-variant, via
// override ESCOPADO a #markingOverlay — a classe base continua legada
// pras outras 2 telas que a reaproveitam, Comparar jogadores e o
// seletor de substituição ao vivo, nenhuma das 2 em escopo aqui) e
// confirma que o estado "selecionado" pré-existente (.mt-sel-row.selected,
// já --m3-* antes desta demanda) continua intacto — o override escopado
// usa :not(.selected) de propósito pra não brigar de especificidade com
// ele. Decisão registrada (não reaproveitar playerRow()/PlayerCard: ver
// docs/HANDOFF_CLAUDE.md) verificada indiretamente por este teste não
// exigir nenhum dado de posição/subposição perdido. Nenhuma mudança de
// comportamento (aplicar/reaplicar/remover marcação, efeito real na
// simulação) — cobertura de regressão fica com
// tests/e2e/test_marcacao_individual.js (pré-existente).
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `s4b4003${Date.now()}@teste.com`;

  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Marcacao M3", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
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
  await page.waitForTimeout(1000);
  await page.click("#btnClaimDailyLogin").catch(() => {});
  await page.waitForTimeout(200);

  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='tatica']");
  await page.click("#btnOpenMarking");
  await page.waitForTimeout(300);

  // 1) Linhas NÃO selecionadas das 2 listas (minha/rival) resolvem pra
  // --m3-on-surface (nome) / --m3-on-surface-variant (meta) / --m3-
  // outline-variant (borda) — não mais --mt-ivory-50/--mt-ink-faint/
  // --mt-navy-700.
  const tokens = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const row = document.querySelector("#markingMyPlayers .mt-sel-row");
    const name = getComputedStyle(row.querySelector(".mt-sel-name"));
    const status = getComputedStyle(row.querySelector(".mt-sel-name .status"));
    const rowStyle = getComputedStyle(row);
    return {
      onSurface: root.getPropertyValue("--m3-on-surface").trim(),
      onSurfaceVariant: root.getPropertyValue("--m3-on-surface-variant").trim(),
      outlineVariant: root.getPropertyValue("--m3-outline-variant").trim(),
      nameColor: name.color, statusColor: status.color, borderColor: rowStyle.borderBottomColor,
    };
  });
  const hexToRgb = (hex) => { const h = hex.replace("#", ""); const n = parseInt(h, 16); return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`; };
  const nameOk = tokens.nameColor === hexToRgb(tokens.onSurface);
  const statusOk = tokens.statusColor === hexToRgb(tokens.onSurfaceVariant);
  const borderOk = tokens.borderColor === hexToRgb(tokens.outlineVariant);
  console.log("1) Linha não selecionada migrada (nome --m3-on-surface, meta --m3-on-surface-variant, borda --m3-outline-variant):",
    nameOk && statusOk && borderOk, JSON.stringify({ ...tokens, nameOk, statusOk, borderOk }));

  // 2) Selecionar os 2 e aplicar — o estado "selecionado" PRÉ-EXISTENTE
  // (já --m3-* antes desta demanda) continua intacto: fundo
  // --m3-primary-container, nome --m3-on-primary-container, sem borda
  // vazando por baixo do override escopado (guard :not(.selected)).
  const ids = await page.evaluate(() => ({
    mine: document.querySelector("#markingMyPlayers [data-id]").dataset.id,
    rival: document.querySelector("#markingRivalPlayers [data-id]").dataset.id,
  }));
  await page.click(`#markingMyPlayers [data-id="${ids.mine}"]`);
  await page.click(`#markingRivalPlayers [data-id="${ids.rival}"]`);
  await page.waitForTimeout(150);
  const selectedTokens = await page.evaluate((ids) => {
    const root = getComputedStyle(document.documentElement);
    const row = document.querySelector(`#markingMyPlayers [data-id="${ids.mine}"]`);
    const name = getComputedStyle(row.querySelector(".mt-sel-name"));
    const rowStyle = getComputedStyle(row);
    return {
      onPrimaryContainer: root.getPropertyValue("--m3-on-primary-container").trim(),
      nameColor: name.color, borderColor: rowStyle.borderBottomColor, isSelected: row.classList.contains("selected"),
    };
  }, ids);
  const selNameOk = selectedTokens.nameColor === hexToRgb(selectedTokens.onPrimaryContainer);
  console.log("2) Estado 'selecionado' pré-existente intacto (nome vira --m3-on-primary-container, sem regressão do override escopado):",
    selectedTokens.isSelected && selNameOk && selectedTokens.borderColor === "rgba(0, 0, 0, 0)", JSON.stringify({ ...selectedTokens, selNameOk }));

  // 3) Aplicar a marcação e confirmar que a designação ativa
  // (.mt-info-line b) também migrou pra --m3-on-surface.
  await page.click("#btnApplyMarking");
  await page.waitForTimeout(200);
  const activeTokens = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const b = document.querySelector("#markingActiveRow .mt-info-line b");
    return { onSurface: root.getPropertyValue("--m3-on-surface").trim(), boldColor: b ? getComputedStyle(b).color : null };
  });
  const boldOk = activeTokens.boldColor === hexToRgb(activeTokens.onSurface);
  console.log("3) Nomes em negrito da designação ativa migrados pra --m3-on-surface:", boldOk, JSON.stringify({ ...activeTokens, boldOk }));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
