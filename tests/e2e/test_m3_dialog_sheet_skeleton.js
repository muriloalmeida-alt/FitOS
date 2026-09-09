// S3-DS20-S4-PREP-001 — Dialog/Bottom Sheet/Skeleton (--m3-*).
// Dialog é testado no fluxo REAL (Tabela -> elenco de outro clube ->
// perfil do jogador, ver openPlayerCard em carreira.js) — é o único
// ponto de integração pedido pela demanda. Bottom Sheet e Skeleton
// ainda não têm um ponto de uso real no produto (nenhuma tela P0
// legada foi tocada por esta demanda, de propósito — ver escopo em
// docs/HANDOFF_CLAUDE.md), então são testados chamando diretamente as
// funções públicas (openM3BottomSheet/m3SkeletonHTML) — mesmo padrão
// de "testar a API do componente" que os outros scripts desta suíte já
// usam pra funções puras (ex.: transferScore em
// test_transfer_ai_offers.js), só que aqui a "função pura" desenha DOM.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("console", (msg) => { if (msg.type() === "error") console.log("CONSOLE ERROR:", msg.text()); });
  const base = "http://localhost:8787";
  const email = `m3prep001_${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "M3 Prep001", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  const results = []; // { n, label, pass }
  function report(n, label, pass, extra) {
    results.push({ n, pass: !!pass });
    console.log(`${n}) ${label}:`, !!pass, extra !== undefined ? JSON.stringify(extra) : "");
  }

  // =========================================================
  // DIALOG — fluxo real: Menu > Tabela > clube adversário > jogador
  // =========================================================
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='competicao']");
  await page.click("#btnOpenTabela");
  await page.waitForTimeout(300);

  const rivalClicked = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("#standingsTable .mt-team-cell[data-openclub]")]
      .filter((el) => String(el.dataset.openclub) !== String(CAREER.clubId));
    if (!rows.length) return false;
    rows[0].click();
    return true;
  });
  report(1, "Tabela tem pelo menos 1 clube adversário clicável (pré-condição do teste)", rivalClicked);
  await page.waitForTimeout(250);

  // Elenco de outro clube abre (.ct-modal-overlay legado, NÃO tocado
  // por esta demanda) — clica no 1º jogador da lista pra abrir
  // openPlayerCard(), que é o fluxo migrado.
  const playerClicked = await page.evaluate(() => {
    const row = document.querySelector("#clubRosterBody [data-id]");
    if (!row) return false;
    row.click();
    return true;
  });
  report(2, "Elenco do adversário (legado, intacto) tem jogador clicável -> abre openPlayerCard()", playerClicked);
  await page.waitForTimeout(350);

  const dialogState1 = await page.evaluate(() => {
    const overlay = document.querySelector(".m3-dialog-overlay.open");
    if (!overlay) return { found: false };
    const card = overlay.querySelector(".m3-dialog");
    const h3 = card.querySelector("h3");
    return {
      found: true,
      role: card.getAttribute("role"),
      ariaModal: card.getAttribute("aria-modal"),
      labelledbyMatchesH3: card.getAttribute("aria-labelledby") === h3?.id && !!h3?.id,
      title: h3?.textContent,
      hasAttrBars: card.querySelectorAll(".m3-attr-bars .m3-attr-bar, .m3-attr-bars").length > 0,
      focusInsideCard: card.contains(document.activeElement),
      ctModalUntouched: !document.getElementById("detailOverlay").classList.contains("open"),
    };
  });
  report(3, "Dialog abre com role=dialog + aria-modal + aria-labelledby apontando pro <h3> real", dialogState1.found && dialogState1.role === "dialog" && dialogState1.ariaModal === "true" && dialogState1.labelledbyMatchesH3, dialogState1);
  report(4, "Dialog mostra 'Perfil do jogador' com conteúdo (barras de atributo) e NÃO abre o #detailOverlay legado (openDetail intocado)", dialogState1.title === "Perfil do jogador" && dialogState1.hasAttrBars && dialogState1.ctModalUntouched, dialogState1);
  report(5, "Foco preso dentro do Dialog ao abrir (acessibilidade — primeiro elemento focável, ex.: botão fechar)", dialogState1.focusInsideCard, dialogState1);

  // Fecha com Esc (não com o botão) — confirma o handler de teclado.
  const focusedBeforeEsc = await page.evaluate(() => document.activeElement === document.querySelector('[data-openclub]') ? "trigger" : document.activeElement?.tagName);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  const afterEsc = await page.evaluate(() => ({
    overlayGone: !document.querySelector(".m3-dialog-overlay"),
  }));
  report(6, "Esc fecha o Dialog (remove o overlay do DOM)", afterEsc.overlayGone, { focusedBeforeEsc, ...afterEsc });

  // Reabre e fecha clicando fora (no backdrop) — segundo mecanismo de fechar.
  await page.evaluate(() => document.querySelector("#clubRosterBody [data-id]").click());
  await page.waitForTimeout(300);
  const reopened = await page.evaluate(() => !!document.querySelector(".m3-dialog-overlay.open"));
  await page.evaluate(() => document.querySelector(".m3-dialog-overlay").click()); // clique no próprio overlay (fora do card)
  await page.waitForTimeout(150);
  const afterBackdropClick = await page.evaluate(() => !document.querySelector(".m3-dialog-overlay"));
  report(7, "Reabre normalmente e clique no backdrop (fora do card) também fecha", reopened && afterBackdropClick, { reopened, afterBackdropClick });

  // =========================================================
  // BOTTOM SHEET — API pública (sem tela P0 legada tocada)
  // =========================================================
  const sheetState = await page.evaluate(async () => {
    const id = openM3BottomSheet({ icon: "\u{1F4CB}", title: "Teste Bottom Sheet", subtitle: "Sub", bodyHTML: "<p>Conteudo</p>" });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); // openM3BottomSheet só adiciona .open/foco no frame seguinte (ver m3OpenOverlay)
    const overlay = document.getElementById(id);
    const card = overlay.querySelector(".m3-bottom-sheet");
    const state1 = {
      isOpenClass: overlay.classList.contains("open"),
      role: card.getAttribute("role"),
      ariaModal: card.getAttribute("aria-modal"),
      focusInside: card.contains(document.activeElement),
      alignedBottom: getComputedStyle(overlay).alignItems === "flex-end",
    };
    closeM3BottomSheet(id);
    const state2 = { removedFromDom: !document.getElementById(id) };
    return { ...state1, ...state2 };
  });
  report(8, "openM3BottomSheet cria overlay com role=dialog/aria-modal, alinhado embaixo (flex-end), foco preso", sheetState.isOpenClass && sheetState.role === "dialog" && sheetState.ariaModal === "true" && sheetState.alignedBottom && sheetState.focusInside, sheetState);
  report(9, "closeM3BottomSheet remove o overlay do DOM", sheetState.removedFromDom, sheetState);

  // Foco preso: Tab dentro de um sheet com 2 botões nunca escapa pro <body>.
  const focusTrapState = await page.evaluate(async () => {
    const id = openM3BottomSheet({ title: "Foco", bodyHTML: '<button id="sheetExtraBtn">Extra</button>' });
    await new Promise((r) => requestAnimationFrame(r));
    document.getElementById("sheetExtraBtn").focus();
    const overlay = document.getElementById(id);
    const card = overlay.querySelector(".m3-bottom-sheet");
    const ev = new KeyboardEvent("keydown", { key: "Tab", bubbles: true });
    card.dispatchEvent(ev);
    const stillInside = card.contains(document.activeElement);
    closeM3BottomSheet(id);
    return { stillInside };
  });
  report(10, "Tab a partir do último elemento focável do sheet não escapa do componente (wrap do focus trap)", focusTrapState.stillInside, focusTrapState);

  // =========================================================
  // SKELETON — primitiva pura (HTML string)
  // =========================================================
  const skeletonState = await page.evaluate(() => {
    const html3 = m3SkeletonHTML({ lines: 3 });
    const div = document.createElement("div");
    div.innerHTML = html3;
    const htmlAvatar = m3SkeletonHTML({ lines: 2, avatar: true });
    const divAvatar = document.createElement("div");
    divAvatar.innerHTML = htmlAvatar;
    return {
      ariaHidden: div.firstElementChild.getAttribute("aria-hidden") === "true",
      lineCount: div.querySelectorAll(".m3-skeleton-line").length,
      avatarPresent: divAvatar.querySelector(".m3-skeleton-avatar") !== null,
      avatarLineCount: divAvatar.querySelectorAll(".m3-skeleton-line").length,
    };
  });
  report(11, "m3SkeletonHTML({lines:3}) gera 3 linhas com aria-hidden (decorativo, não deve ser lido por leitor de tela)", skeletonState.ariaHidden && skeletonState.lineCount === 3, skeletonState);
  report(12, "m3SkeletonHTML({lines:2, avatar:true}) inclui avatar + 2 linhas", skeletonState.avatarPresent && skeletonState.avatarLineCount === 2, skeletonState);

  await page.screenshot({ path: "m3_prep001_dialog.png" }).catch(() => {});

  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passaram.`);
  if (failed.length) {
    console.log("Falharam:", failed.map((r) => r.n).join(", "));
    process.exit(1);
  }
  console.log("OK");
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
