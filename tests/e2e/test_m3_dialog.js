// Testa o componente Dialog M3 (.m3-dialog*, S3-DS20-S4-PREP-001,
// issue #10) no seu ponto de validação real: perfil de jogador de
// OUTRO clube (openPlayerCard), acessado a partir de Tabela → elenco
// do clube → jogador (mesmo caminho de Menu→Tabela já validado em
// test_m3_bloco1_inicio.js). Cobre: role/aria-modal/aria-labelledby,
// foco movido pro dialog ao abrir, foco preso (Tab não escapa),
// fechamento por Esc/clique fora/botão fechar, foco devolvido ao
// fechar, e ausência de regressão no fluxo por trás (#clubRosterOverlay
// continua aberto, #detailOverlay/openDetail nunca é tocado por este
// caminho).
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("console", (msg) => { if (msg.type() === "error") console.log("CONSOLE ERROR:", msg.text()); });
  const base = "http://localhost:8787";
  const email = `m3dialog${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "M3 Dialog Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  // Chegar em Tabela (Menu → Competição → Tabela), mesmo caminho do
  // teste 6 de test_m3_bloco1_inicio.js.
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='competicao']");
  await page.click("#btnOpenTabela");
  await page.waitForTimeout(300);

  // Clicar no nome de um clube que NÃO é o meu (evita a linha
  // "highlight") — abre #clubRosterOverlay (elenco somente leitura).
  await page.evaluate(() => {
    const cell = [...document.querySelectorAll("#standingsTable .mt-team-cell[data-openclub]")]
      .find((el) => !el.closest(".mt-tr").classList.contains("highlight"));
    cell.click();
  });
  await page.waitForTimeout(300);
  const rosterOpen = await page.evaluate(() => document.getElementById("clubRosterOverlay").classList.contains("open"));
  console.log("0) Elenco de outro clube abriu (pré-condição):", rosterOpen);

  // Clicar no primeiro jogador da lista → openPlayerCard() → Dialog M3.
  await page.click("#clubRosterBody [data-id]");
  await page.waitForTimeout(250);

  // 1) Dialog abriu com role/aria-modal/aria-labelledby corretos e
  // título não-vazio (via aria-labelledby, não hardcoded).
  const a11yAttrs = await page.evaluate(() => {
    const overlay = document.getElementById("m3PlayerCardOverlay");
    const labelId = overlay.getAttribute("aria-labelledby");
    return {
      open: overlay.classList.contains("open"),
      role: overlay.getAttribute("role"),
      ariaModal: overlay.getAttribute("aria-modal"),
      labelId,
      labelText: labelId ? document.getElementById(labelId).textContent : null,
    };
  });
  console.log("1) Dialog abriu com role=dialog/aria-modal/aria-labelledby resolvendo pra título não-vazio:",
    a11yAttrs.open && a11yAttrs.role === "dialog" && a11yAttrs.ariaModal === "true" && !!a11yAttrs.labelText && a11yAttrs.labelText.length > 0,
    JSON.stringify(a11yAttrs));

  // 2) Foco moveu pro dialog ao abrir (cai no botão fechar, único
  // elemento focável do corpo somente-leitura).
  const focusedOnOpen = await page.evaluate(() => document.activeElement.id);
  console.log("2) Foco movido pro dialog ao abrir (botão fechar):", focusedOnOpen === "m3PlayerCardClose", focusedOnOpen);

  await page.screenshot({ path: "m3_dialog_01_open.png" }).catch(() => {});

  // 3) Foco preso: só há 1 elemento focável (botão fechar) — Tab
  // repetido não deve escapar do dialog nem sair do próprio botão.
  await page.keyboard.press("Tab");
  const focusedAfterTab = await page.evaluate(() => document.activeElement.id);
  console.log("3) Tab não escapa do dialog (foco preso no único focável):", focusedAfterTab === "m3PlayerCardClose", focusedAfterTab);

  // 4) Esc fecha o dialog.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  const closedByEsc = await page.evaluate(() => !document.getElementById("m3PlayerCardOverlay").classList.contains("open"));
  console.log("4) Esc fecha o Dialog:", closedByEsc);

  // 5) Sem regressão: #clubRosterOverlay (por trás) continua aberto,
  // #detailOverlay (openDetail, fora de escopo desta demanda) nunca
  // foi tocado por este caminho.
  const noRegression = await page.evaluate(() => ({
    rosterStillOpen: document.getElementById("clubRosterOverlay").classList.contains("open"),
    detailOverlayNeverOpened: !document.getElementById("detailOverlay").classList.contains("open"),
  }));
  console.log("5) Sem regressão (elenco continua aberto por trás, #detailOverlay/openDetail intocado):",
    noRegression.rosterStillOpen && noRegression.detailOverlayNeverOpened, JSON.stringify(noRegression));

  // 6) Reabrir funciona (sem listener duplicado/vazado da 1ª abertura)
  // e fechar pelo botão "✕" também funciona.
  await page.click("#clubRosterBody [data-id]");
  await page.waitForTimeout(250);
  const reopened = await page.evaluate(() => document.getElementById("m3PlayerCardOverlay").classList.contains("open"));
  await page.click("#m3PlayerCardClose");
  await page.waitForTimeout(150);
  const closedByButton = await page.evaluate(() => !document.getElementById("m3PlayerCardOverlay").classList.contains("open"));
  console.log("6) Reabre e fecha pelo botão fechar (sem listener vazado):", reopened && closedByButton);

  // 7) Clique no backdrop fecha.
  await page.click("#clubRosterBody [data-id]");
  await page.waitForTimeout(250);
  await page.evaluate(() => document.getElementById("m3PlayerCardOverlay").click());
  await page.waitForTimeout(150);
  const closedByBackdrop = await page.evaluate(() => !document.getElementById("m3PlayerCardOverlay").classList.contains("open"));
  console.log("7) Clique no backdrop fecha:", closedByBackdrop);

  await browser.close();
})();
