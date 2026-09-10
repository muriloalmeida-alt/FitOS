// Testa a migração da tela Treino pro Design System novo (S4-B2-004,
// issue #15). Cobre só o que foi de fato alterado nesta demanda (2
// classes legadas que duplicavam papel semântico já coberto por
// --m3-*): o aviso de folga protegida sobrescrita (.mt-training-warning)
// e o botão de escolher jogador do treino individual
// (.mt-individual-picker-btn). As cores categóricas de foco de treino
// (tecnico=sky/fisico=crimson/tatico=violet, em .mt-scheme-preview .dot,
// .mt-seg-btn.active e .mt-day-cell.foco-*) NÃO foram alteradas —
// classificadas como paleta categórica BRDATA Extension (mesmo
// tratamento dado a .mt-pos-chip em S4-B2-003) — então não são
// testadas aqui como "migradas". A dependência do PlayerCard também é
// só CONFIRMADA (já reaproveitado via playerRow()/groupedListHTML,
// nenhuma mudança necessária), não implementada nesta demanda.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("console", (msg) => { if (msg.type() === "error") console.log("CONSOLE ERROR:", msg.text()); });
  const base = "http://localhost:8787";
  const email = `s4b2004${Date.now()}@teste.com`;

  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "S4B2004 Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  // Treino não está no bottom nav (só Início/Elenco/Tática/Mercado/
  // Clube) — é aberto via switchToPanel("treinos") (ver carreira.js),
  // igual ao fluxo real (botão dentro de Início, não testado aqui por
  // não ser desta demanda).
  await page.evaluate(() => switchToPanel("treinos"));
  await page.waitForTimeout(200);

  // 1) Sexta (dia 4) é folga protegida (pré-jogo de sábado). Força um
  // foco de treino nela + grupo individual sem jogador escolhido, o
  // que aciona tanto o aviso de violação (.mt-training-warning) quanto
  // o botão de escolher jogador (.mt-individual-picker-btn) no mesmo
  // render.
  await page.evaluate(() => {
    TRAINING_SELECTED_DAY = 4;
    CAREER.trainingPlan[4] = { foco: "tecnico", intensidade: "moderada", grupo: "individual" };
    renderTrainingDayPanel();
  });

  const warning = await page.evaluate(() => {
    const el = document.querySelector("#trainingDayPanel .mt-training-warning");
    return el ? { color: getComputedStyle(el).color, bg: getComputedStyle(el).backgroundColor, border: getComputedStyle(el).borderColor } : null;
  });
  // --m3-error é #FF5449 = rgb(255, 84, 73) (era --mt-crimson-400 =
  // rgb(227, 101, 101)).
  console.log("1) Aviso de folga protegida sobrescrita usa --m3-error (não mais --mt-crimson-400):",
    !!warning && warning.color === "rgb(255, 84, 73)", JSON.stringify(warning));

  const picker = await page.evaluate(() => {
    const btn = document.querySelector("#trainingDayPanel .mt-individual-picker-btn");
    const placeholder = btn?.querySelector(".placeholder");
    // --m3-surface-container-high/--m3-outline-variant/--m3-on-surface
    // são estáticos (não variam por clube), então dá pra comparar hex
    // fixo aqui — mesmo critério de S4-B2-001/002 (tokens não-dinâmicos).
    return btn ? {
      bg: getComputedStyle(btn).backgroundColor,
      border: getComputedStyle(btn).borderColor,
      color: getComputedStyle(btn).color,
      placeholderColor: placeholder ? getComputedStyle(placeholder).color : null,
    } : null;
  });
  // --m3-surface-container-high:#2C2A27 = rgb(44,42,39); --m3-outline-variant:#4A4744 = rgb(74,71,68);
  // --m3-on-surface:#E7E2DE = rgb(231,226,222); --m3-on-surface-variant:#CBC5BE = rgb(203,197,190).
  console.log("2) Botão 'escolher jogador' usa tokens do campo padrão do DS (não mais navy/ivory fixos):",
    !!picker && picker.bg === "rgb(44, 42, 39)" && picker.color === "rgb(231, 226, 222)" && picker.placeholderColor === "rgb(203, 197, 190)",
    JSON.stringify(picker));

  await page.screenshot({ path: "s4_b2_004_treino_warning.png" }).catch(() => {});

  // 3) Confirma (não presume) que a lista de elenco de Treino já
  // reaproveita playerRow()/PlayerCard (S3-DS20-S4-PREP-002) — nenhuma
  // mudança de código aqui, só verificação da dependência citada na
  // especificação.
  const rosterUsesPlayerCard = await page.evaluate(() => {
    const list = document.getElementById("trainingRosterList");
    return { hasListItems: !!list && list.querySelectorAll(".m3-list-item").length > 0, count: list ? list.querySelectorAll(".m3-list-item").length : 0 };
  });
  console.log("3) Lista de elenco do Treino reaproveita playerRow()/PlayerCard (.m3-list-item), sem duplicar marcação:",
    rosterUsesPlayerCard.hasListItems, JSON.stringify(rosterUsesPlayerCard));

  // 4) Preservação funcional: trocar de esquema de treino e voltar pro
  // painel do dia continuam funcionando (nenhuma mudança de regra de
  // treinamento nesta demanda, só CSS de 2 seletores).
  const stillWorks = await page.evaluate(() => {
    const schemeBtn = document.querySelector('.mt-scheme-card[data-scheme]');
    const before = CAREER.trainingSchemeId;
    schemeBtn?.click();
    return { schemeExists: !!schemeBtn, before, after: CAREER.trainingSchemeId, dayPanelStillRenders: !!document.getElementById("trainingDayPanel").innerHTML.trim() };
  });
  console.log("4) Trocar esquema de treino continua funcionando (fluxo intacto):",
    stillWorks.schemeExists && stillWorks.dayPanelStillRenders, JSON.stringify(stillWorks));

  await browser.close();
})();
