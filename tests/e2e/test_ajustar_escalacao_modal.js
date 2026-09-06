// Verifica o novo fluxo de "Ajustar escalação" dentro do Confirmar
// escalação (pré-jogo): deve abrir uma MODAL (não navegar pra aba)
// com todos os controles da Escalação e um botão "Ir para o jogo".
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `ajustesc${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Ajuste Escalacao", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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
  await page.evaluate(() => {
    Object.keys(PRESS_CHANCE_BY_ID).forEach((k) => { PRESS_CHANCE_BY_ID[k] = 0; });
    PRESS_ALWAYS_IDS.clear();
  });

  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(200);
  await page.click("#btnSimulate");
  await page.waitForSelector("#preMatchOverlay.open", { timeout: 5000 });

  // 1) Clicar "Ajustar escalação" abre uma MODAL (não navega de aba) —
  // a modal de confirmar escalação continua aberta por baixo.
  await page.click("#btnPreMatchAdjust");
  await page.waitForTimeout(200);
  const s1 = await page.evaluate(() => ({
    adjustOpen: document.getElementById("adjustLineupOverlay").classList.contains("open"),
    preMatchStillOpen: document.getElementById("preMatchOverlay").classList.contains("open"),
    stillOnCentralPanel: document.getElementById("panel-central").classList.contains("active"),
  }));
  console.log("1) 'Ajustar escalação' abre uma modal (Confirmar escalação continua aberta por baixo, sem navegar de aba):", s1.adjustOpen && s1.preMatchStillOpen && s1.stillOnCentralPanel);

  // 2) A modal tem TODAS as opções da tela de Escalação: chips de
  // formação (Bloco 2 M3, era <select>), botão de auto-escalar, toggle
  // de incluir base, campinho (titulares clicáveis), banco, e os 4
  // eixos táticos em barra segmentada (era 3 <select> nomeados).
  const s2 = await page.evaluate(() => {
    const body = document.getElementById("adjustLineupBody");
    return {
      hasFormationChips: body.querySelectorAll("#formationChipRow .m3-filter-chip").length,
      hasAutoLineupBtn: !!body.querySelector("#btnAutoLineup"),
      hasIncludeBaseToggle: !!body.querySelector("#autoLineupIncludeBase"),
      pitchSlots: body.querySelectorAll(".mt-pos-slot").length,
      hasBenchList: !!body.querySelector("#benchList"),
      tacticAxes: body.querySelectorAll("#tacticAxisRows .m3-instr-row").length,
      // AJUSTE (Módulo de Treinos): "Foco de treino" saiu da Escalação
      // por completo, virou a aba própria "Treinos" -- não deve mais
      // existir aqui dentro (nem em nenhum outro lugar).
      noTrainingFocus: !body.querySelector("#trainingFocus"),
      // o FAB da ABA ("Salvar escalação e táticas", era barra de ação
      // full-width) não deve aparecer aqui dentro -- a modal tem seu
      // próprio rodapé.
      fabHidden: body.querySelector(".m3-fab").classList.contains("hidden"),
    };
  });
  console.log("2) Modal tem todos os controles da Escalação (chips de formação/auto/base/campinho 11 posições/banco/4 eixos táticos, sem foco de treino):",
    s2.hasFormationChips > 0 && s2.hasAutoLineupBtn && s2.hasIncludeBaseToggle && s2.pitchSlots === 11 && s2.hasBenchList
    && s2.tacticAxes === 4 && s2.noTrainingFocus, JSON.stringify(s2));
  console.log("   FAB da aba (Salvar) escondido dentro da modal:", s2.fabHidden);

  // 3) Tem o botão "Ir para o jogo" no rodapé.
  const s3 = await page.evaluate(() => {
    const btn = document.getElementById("btnAdjustLineupGo");
    return { exists: !!btn, text: btn.textContent.trim(), inFooter: !!btn.closest(".ct-modal-footer") };
  });
  console.log("3) Modal tem botão 'Ir para o jogo' no rodapé:", s3.exists && s3.text === "Ir para o jogo" && s3.inFooter);

  // 4) Trocar a formação (chip) e um eixo tático (segmento) dentro da
  // modal reflete de verdade em CAREER (não é só um formulário
  // decorativo) — formação aplica na hora; eixo tático só ao Salvar/Ir
  // pro jogo (mesmo padrão "comita ao confirmar" de sempre).
  await page.evaluate(() => {
    document.querySelector('#adjustLineupBody #formationChipRow [data-formation="4-4-2"]').click();
  });
  await page.waitForTimeout(150);
  const s4 = await page.evaluate(() => ({ formation: CAREER.lineup.formation }));
  console.log("4) Trocar o esquema na modal (chip) já aplica de verdade (4-4-2):", s4.formation === "4-4-2");

  // 5) Fechar a modal (X) SEM ir pro jogo volta pra Confirmar
  // escalação, que reflete a mudança de esquema feita na modal, e o
  // painel de Escalação volta pro lugar de sempre (fora da modal).
  await page.click("#adjustLineupClose");
  await page.waitForTimeout(200);
  const s5 = await page.evaluate(() => {
    const anchor = document.getElementById("escalacaoPanelAnchor");
    const panel = document.getElementById("panel-escalacao");
    return {
      adjustClosed: !document.getElementById("adjustLineupOverlay").classList.contains("open"),
      preMatchStillOpen: document.getElementById("preMatchOverlay").classList.contains("open"),
      panelBackInPlace: anchor.nextSibling === panel || panel.nextSibling === anchor,
      preMatchMetaText: document.getElementById("preMatchMeta").textContent,
    };
  });
  console.log("5) 'X' fecha só a modal de ajuste, Confirmar escalação continua aberta refletindo a mudança:",
    s5.adjustClosed && s5.preMatchStillOpen && s5.panelBackInPlace && s5.preMatchMetaText.includes("4-4-2"));

  // 6) A escalação NÃO some da aba normal depois de tudo isso (o nó
  // realmente volta pro lugar) -- fecha a confirmação e visita a aba
  // Escalação de verdade.
  await page.click("#preMatchClose");
  await page.waitForTimeout(150);
  await page.click(".m3-nav-item[data-panel='escalacao']");
  await page.waitForTimeout(200);
  const s6 = await page.evaluate(() => ({
    panelVisible: document.getElementById("panel-escalacao").classList.contains("active"),
    formationOnChip: document.querySelector("#formationChipRow .m3-filter-chip.on")?.dataset.formation,
    pitchSlots: document.querySelectorAll("#pitchLines .mt-pos-slot").length,
  }));
  console.log("6) Aba Escalação normal continua funcionando depois (mesmo esquema 4-4-2, campinho com 11 posições):",
    s6.panelVisible && s6.formationOnChip === "4-4-2" && s6.pitchSlots === 11, JSON.stringify(s6));

  // 7) Reabre o fluxo, entra na modal de ajuste, clica "Ir para o
  // jogo" DIRETO da modal -- deve ir pro jogo (fechar as 2 modais,
  // abrir Ao Vivo/resultado), sem precisar voltar pra Confirmar
  // escalação primeiro.
  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(200);
  await page.click("#btnSimulate");
  await page.waitForSelector("#preMatchOverlay.open", { timeout: 5000 });
  await page.click("#btnPreMatchAdjust");
  await page.waitForSelector("#adjustLineupOverlay.open", { timeout: 5000 });
  // Eixo "Pressão" pro nível 1 (1º segmento) dentro da modal.
  await page.evaluate(() => {
    document.querySelector('#adjustLineupBody #tacticAxisRows .m3-instr-row[data-axis="pressao"] .m3-seg[data-level="1"]').click();
  });
  await page.click("#btnAdjustLineupGo");
  await page.waitForTimeout(300);
  const s7 = await page.evaluate(() => ({
    adjustClosed: !document.getElementById("adjustLineupOverlay").classList.contains("open"),
    preMatchClosed: !document.getElementById("preMatchOverlay").classList.contains("open"),
    liveOpen: document.getElementById("liveMatchOverlay").classList.contains("open"),
    pressaoCommitted: CAREER.lineup.tactics.pressao === 1,
  }));
  console.log("7) 'Ir para o jogo' na modal de ajuste fecha as 2 modais e vai pro jogo direto, tática mudada foi salva:",
    s7.adjustClosed && s7.preMatchClosed && s7.liveOpen && s7.pressaoCommitted, JSON.stringify(s7));
  if (s7.liveOpen) { await page.evaluate(() => skipLiveMatch()); await page.waitForTimeout(300); }

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
