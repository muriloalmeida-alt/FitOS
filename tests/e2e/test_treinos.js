// Testa o Módulo de Treinos (nova aba "Treinos", ver panel-treinos em
// carreira.html + applyWeeklyTraining/renderTreinos em carreira.js):
// esquemas prontos, edição manual de dia (vira "Personalizado"),
// picker de jogador pro treino individual, aplicar treino (ganho de
// atributo + fadiga + idempotência por rodada) e a nav de 6 itens
// (Menu no lugar do hambúrguer do topo).
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `treinos${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Treinos Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(500);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(700);

  // 0) Redesign M3 — nav de 5 itens (Início/Elenco/Tática/Mercado/
  // Clube) + Menu; Treinos saiu do rodapé, mora dentro do Menu agora.
  const navLabels = await page.evaluate(() => [...document.querySelectorAll(".m3-nav-item")].map((b) => b.textContent.trim()));
  console.log("0) Nav com 5 itens + Menu (Treinos mora no Menu agora):", JSON.stringify(navLabels), navLabels.length === 6 && !navLabels.includes("Treinos") && navLabels.includes("Menu"));

  // 1) Abrir a aba Treinos — esquema padrão "Equilíbrio Semanal" ativo,
  // 5 cartões de esquema, 7 células na semana.
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='equipe']");
  await page.click("#btnOpenTreinos");
  await page.waitForTimeout(200);
  const initial = await page.evaluate(() => ({
    panelVisible: document.getElementById("panel-treinos").classList.contains("active"),
    schemeCards: document.querySelectorAll(".mt-scheme-card").length,
    activeScheme: document.querySelector(".mt-scheme-card.active .name")?.textContent,
    weekLabel: document.getElementById("trainingWeekLabel").textContent,
    dayCells: document.querySelectorAll(".mt-day-cell").length,
    trainingSchemeId: CAREER.trainingSchemeId,
    gameDayLocked: document.getElementById("trainingDayPanel").textContent.includes("Dia de jogo"),
  }));
  console.log("1) Aba Treinos abre com esquema padrão + 5 cartões + 7 dias:", initial.panelVisible && initial.schemeCards === 5 && initial.activeScheme === "Equilíbrio Semanal" && initial.dayCells === 7 && initial.trainingSchemeId === "equilibrio", JSON.stringify(initial));

  // Selecionar o dia de sábado (jogo, índice 5) -- deve mostrar aviso
  // de "sem treino configurável", sem segmented controls.
  await page.click('.mt-day-cell[data-day="5"]');
  await page.waitForTimeout(150);
  const gameDay = await page.evaluate(() => ({
    text: document.getElementById("trainingDayPanel").textContent,
    segGroups: document.querySelectorAll("#trainingDayPanel .mt-seg-group").length,
  }));
  console.log("1b) Dia de jogo (sábado) mostra aviso e não tem controles:", gameDay.text.includes("Dia de jogo") && gameDay.segGroups === 0, JSON.stringify(gameDay));

  // 2) Selecionar outro esquema pronto -- muda o plano inteiro.
  await page.click('.mt-scheme-card[data-scheme="pretemporada"]');
  await page.waitForTimeout(200);
  const afterScheme = await page.evaluate(() => ({
    trainingSchemeId: CAREER.trainingSchemeId,
    day0: { ...CAREER.trainingPlan[0] },
    activeCardName: document.querySelector(".mt-scheme-card.active .name")?.textContent,
  }));
  console.log("2) Trocar de esquema aplica o plano inteiro (Pré-Temporada Física):", afterScheme.trainingSchemeId === "pretemporada" && afterScheme.day0.foco === "fisico" && afterScheme.day0.intensidade === "intensa" && afterScheme.activeCardName === "Pré-Temporada Física", JSON.stringify(afterScheme));

  // 3) Editar manualmente o dia 0 (segunda) -- vira "Personalizado".
  await page.click('.mt-day-cell[data-day="0"]');
  await page.waitForTimeout(150);
  await page.click('.mt-seg-btn[data-seg="foco"][data-value="tecnico"]');
  await page.waitForTimeout(150);
  const afterEdit = await page.evaluate(() => ({
    trainingSchemeId: CAREER.trainingSchemeId,
    day0: { ...CAREER.trainingPlan[0] },
    weekLabel: document.getElementById("trainingWeekLabel").textContent,
    noActiveCard: document.querySelectorAll(".mt-scheme-card.active").length === 0,
  }));
  console.log("3) Editar manualmente um dia vira 'Personalizado' (nenhum esquema ativo):", afterEdit.trainingSchemeId === null && afterEdit.day0.foco === "tecnico" && afterEdit.weekLabel.includes("Personalizado") && afterEdit.noActiveCard, JSON.stringify(afterEdit));

  // 3b) Editar o dia protegido (sexta, índice 4) pra um foco de treino
  // -- deve mostrar o aviso de folga sobrescrita.
  await page.click('.mt-day-cell[data-day="4"]');
  await page.waitForTimeout(150);
  await page.click('.mt-seg-btn[data-seg="foco"][data-value="fisico"]');
  await page.waitForTimeout(150);
  const violated = await page.evaluate(() => ({
    warning: !!document.querySelector(".mt-training-warning"),
    dayCellViolated: document.querySelector('.mt-day-cell[data-day="4"]').classList.contains("dviolated"),
  }));
  console.log("3c) Sobrescrever folga protegida (sexta) mostra aviso + marca o dia:", violated.warning && violated.dayCellViolated, JSON.stringify(violated));

  // Volta sexta pro padrão (descanso) antes de seguir, senão o teste
  // de aplicar treino abaixo ficaria com um dia a mais custando fadiga
  // -- não é o foco deste teste.
  await page.click('.mt-seg-btn[data-seg="foco"][data-value="descanso"]');
  await page.waitForTimeout(150);

  // 4) Grupo "Individual" no dia 0 -- abre o picker, escolher um
  // jogador grava individualPlayerId (não mexe em escalação nenhuma).
  await page.click('.mt-day-cell[data-day="0"]');
  await page.waitForTimeout(150);
  await page.click('.mt-seg-btn[data-seg="grupo"][data-value="individual"]');
  await page.waitForTimeout(150);
  await page.click("#btnPickTrainingPlayer");
  await page.waitForTimeout(200);
  const pickerOpen = await page.evaluate(() => document.getElementById("pickerOverlay").classList.contains("open"));
  const firstPlayerId = await page.evaluate(() => document.querySelector("#pickerList [data-id]")?.dataset.id);
  await page.click("#pickerList [data-id]");
  await page.waitForTimeout(200);
  const afterPick = await page.evaluate(({ firstPlayerId }) => ({
    pickerClosed: !document.getElementById("pickerOverlay").classList.contains("open"),
    individualPlayerId: CAREER.trainingPlan[0].individualPlayerId,
    btnShowsName: document.getElementById("btnPickTrainingPlayer")?.textContent.trim(),
    matches: CAREER.trainingPlan[0].individualPlayerId === firstPlayerId,
  }), { firstPlayerId });
  console.log("4) Picker de treino individual grava o jogador escolhido (sem tocar escalação):", pickerOpen && afterPick.pickerClosed && afterPick.matches && afterPick.btnShowsName.length > 0, JSON.stringify(afterPick));

  // Volta o dia 0 pra "principal" (elenco todo) antes de aplicar --
  // simplifica a checagem de ganho abaixo (afeta todo mundo).
  await page.click('.mt-seg-btn[data-seg="grupo"][data-value="principal"]');
  await page.waitForTimeout(150);

  // 5) Aplicar treino da semana -- ganho de atributo + fadiga real no
  // elenco, idempotente na mesma rodada (botão desabilita).
  const beforeApply = await page.evaluate(() => ({
    round: CAREER.currentRound,
    appliedFor: CAREER.trainingAppliedForRound,
    p0: { ...CAREER.squad[0] },
  }));
  await page.click("#btnApplyTraining");
  await page.waitForTimeout(300);
  const afterApply = await page.evaluate(() => ({
    appliedFor: CAREER.trainingAppliedForRound,
    btnDisabled: document.getElementById("btnApplyTraining").disabled,
    btnLabel: document.getElementById("btnApplyTrainingLabel").textContent,
    p0Condition: CAREER.squad[0].condition,
  }));
  console.log("5) Aplicar treino marca a rodada como feita e desabilita o botão:", afterApply.appliedFor === beforeApply.round && afterApply.btnDisabled && afterApply.btnLabel.includes("já aplicado"), JSON.stringify({ beforeApply, afterApply }));

  // "Aplicar treino" já fechou tudo e voltou pra Início (Task #72) --
  // volta pra Treinos antes de repetir o clique.
  await page.evaluate(() => switchToPanel("treinos"));
  await page.waitForTimeout(150);

  // Aplicar de novo (clique redundante) não deve mudar nada -- já
  // aplicado pra essa rodada (idempotência).
  const conditionBefore2ndClick = afterApply.p0Condition;
  await page.evaluate(() => document.getElementById("btnApplyTraining").disabled = false); // força o clique só pra provar que a FUNÇÃO (não só o botão) é idempotente
  await page.click("#btnApplyTraining");
  await page.waitForTimeout(200);
  const conditionAfter2ndClick = await page.evaluate(() => CAREER.squad[0].condition);
  console.log("5b) applyWeeklyTraining() é idempotente na mesma rodada mesmo forçando o clique:", conditionAfter2ndClick === conditionBefore2ndClick, { conditionBefore2ndClick, conditionAfter2ndClick });

  // 6) Lista de elenco reaproveita mtConditionBarHTML/playerRow --
  // barra de condição visível, clicar num jogador abre o detalhe.
  const rosterOk = await page.evaluate(() => document.querySelectorAll("#trainingRosterList .mt-condition-bar").length > 15);
  console.log("6) Lista de elenco mostra barra de condição por jogador:", rosterOk);
  await page.click("#trainingRosterList .m3-list-item");
  await page.waitForTimeout(200);
  const detailOpen = await page.evaluate(() => document.getElementById("detailOverlay").classList.contains("open"));
  console.log("6b) Clicar num jogador do elenco (Treinos) abre o detalhe:", detailOpen);
  if (detailOpen) { await page.click("#detailClose"); await page.waitForTimeout(150); }

  // 7) Botão "Menu" no rodapé abre o mesmo popover de sempre — redesign
  // M3: Mercado voltou pra nav direta, Tabela/Treinos é que moraram
  // pro Menu agora.
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  const menu = await page.evaluate(() => ({
    open: document.getElementById("topbarMenu").classList.contains("open"),
    hasTabela: !!document.getElementById("btnOpenTabela"),
    hasEstatisticas: !!document.getElementById("btnOpenEstatisticas"),
  }));
  console.log("7) Menu (antes hambúrguer) abre com Tabela/Estatísticas dentro:", menu.open && menu.hasTabela && menu.hasEstatisticas, JSON.stringify(menu));
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='competicao']");
  await page.click("#btnOpenTabela");
  await page.waitForTimeout(200);
  const tabelaOpen = await page.evaluate(() => document.getElementById("panel-tabela").classList.contains("active"));
  console.log("7b) Clicar 'Tabela' no menu troca de fato pra aba Tabela:", tabelaOpen);

  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='equipe']");
  await page.click("#btnOpenTreinos");
  await page.waitForTimeout(200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  await page.screenshot({ path: "treinos_01_esquemas.png" });
  await page.click('.mt-day-cell[data-day="1"]');
  await page.waitForTimeout(150);
  await page.screenshot({ path: "treinos_02_dia.png" });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(150);
  await page.screenshot({ path: "treinos_03_elenco.png" });

  await browser.close();
})();
