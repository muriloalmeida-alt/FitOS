// S4-B4-004 (issue #34) — teste e2e via UI real. Cobre 2 mudanças:
// (1) a lista de escolha (passo 1) passa a reaproveitar playerRow()/
// PlayerCard no lugar do .mt-sel-row ad hoc — DECISÃO OPOSTA à de
// Marcação individual (S4-B4-003): lá o componente foi recusado porque
// a lista mistura posições e o chip por linha era essencial; aqui o
// pool inteiro já é da MESMA subposição (filtro de negócio inalterado)
// e o subtítulo da tela já anuncia qual, então nada essencial se perde
// — mesmo raciocínio, veredito diferente, registrado nos 2 relatórios;
// (2) os tokens exclusivos do passo 2 (resultado) que a auditoria não
// tinha pego — .m3-compare-player b/.m3-compare-row/.m3-compare-val,
// --mt-ivory-50/--mt-navy-700/--mt-ink-muted → --m3-on-surface/
// --m3-outline-variant/--m3-on-surface-variant (Bebas Neue do nome
// mantida como BRDATA Extension, mesmo critério de Onboarding/Tática).
// Nenhuma mudança de comportamento (filtro por posição, exclusão do
// próprio jogador, cálculo de vencedor/custo-benefício) — cobertura de
// regressão fica com tests/e2e/test_comparar_jogadores.js (pré-
// existente, ajustado só na forma de checar "mesma posição" já que o
// chip por linha não existe mais).
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `s4b4004${Date.now()}@teste.com`;

  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Comparar M3", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  await page.click(".m3-nav-item[data-panel='elenco']");
  await page.waitForTimeout(300);
  await page.click("#squadMainList [data-id]");
  await page.waitForSelector("#detailOverlay.open");
  await page.click('[data-act="compare"]');
  await page.waitForTimeout(200);

  // 1) Passo 1 (picker) agora usa playerRow()/PlayerCard de verdade
  // (.m3-list-item, com nota de overall/idade/condição) no lugar do
  // .mt-sel-row antigo.
  const pickList = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("#comparePickList [data-id]")];
    return {
      allPlayerCard: rows.length > 0 && rows.every((r) => r.classList.contains("m3-list-item")),
      noneOldRow: !document.querySelector("#comparePickList .mt-sel-row"),
      hasRatingBadge: rows.every((r) => !!r.querySelector(".m3-li-rating")),
    };
  });
  console.log("1) Passo 1 (picker) usa playerRow()/PlayerCard (.m3-list-item), não mais .mt-sel-row:",
    pickList.allPlayerCard && pickList.noneOldRow && pickList.hasRatingBadge, JSON.stringify(pickList));

  // 2) Passo 2 (resultado): tokens exclusivos migrados — nome do
  // jogador (--m3-on-surface), borda de cada linha (--m3-outline-
  // variant), valor não-vencedor (--m3-on-surface-variant).
  await page.click("#comparePickList [data-id]");
  await page.waitForTimeout(200);
  const tokens = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const nameB = document.querySelector("#compareHeaderRow .m3-compare-player b");
    const row = document.querySelector("#compareRows .m3-compare-row");
    const nonWinVal = [...document.querySelectorAll("#compareRows .m3-compare-val")].find((v) => !v.classList.contains("win"));
    return {
      onSurface: root.getPropertyValue("--m3-on-surface").trim(),
      outlineVariant: root.getPropertyValue("--m3-outline-variant").trim(),
      onSurfaceVariant: root.getPropertyValue("--m3-on-surface-variant").trim(),
      nameColor: getComputedStyle(nameB).color,
      rowBorderColor: getComputedStyle(row).borderBottomColor,
      valColor: nonWinVal ? getComputedStyle(nonWinVal).color : null,
    };
  });
  const hexToRgb = (hex) => { const h = hex.replace("#", ""); const n = parseInt(h, 16); return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`; };
  const nameOk = tokens.nameColor === hexToRgb(tokens.onSurface);
  const borderOk = tokens.rowBorderColor === hexToRgb(tokens.outlineVariant);
  const valOk = tokens.valColor === hexToRgb(tokens.onSurfaceVariant);
  console.log("2) Passo 2 (resultado) migrado — nome --m3-on-surface, borda --m3-outline-variant, valor --m3-on-surface-variant:",
    nameOk && borderOk && valOk, JSON.stringify({ ...tokens, nameOk, borderOk, valOk }));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
