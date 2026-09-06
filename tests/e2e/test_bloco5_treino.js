// Bloco 5 (mockups brtreinadorbloco5treino.html/brtreinadorbloco5pendentes.html)
// — pedido do usuário: foco "Tático" (evolui ataque+defesa), duração
// informativa por dia (stepper), resumo semanal (fadiga média/moral/
// folga protegida) + aviso do jogador em maior risco, e a nova tela
// "Histórico de fadiga" (gráfico semanal + lesões do período). Decisões
// confirmadas via AskUserQuestion: manter 1 configuração por dia (sem
// virar lista de exercícios) e manter a edição instantânea (sem
// bottom sheet de confirmação por dia).
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `bloco5treino${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Bloco5 Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(300);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.waitForTimeout(3000);
  await page.click("#btnClaimDailyLogin").catch(() => {});
  await page.waitForTimeout(300);
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='equipe']");
  await page.click("#btnOpenTreinos");
  await page.waitForTimeout(300);

  // 1) Resumo semanal aparece com os 3 cards certos.
  const summary = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("#trainingWeekSummary .mt-stat-block")];
    return { count: cards.length, labels: cards.map((c) => c.querySelector(".lbl")?.textContent) };
  });
  console.log("1) Resumo semanal com 3 cards (fadiga média/moral/folga protegida):",
    summary.count === 3 && summary.labels.includes("Fadiga média") && summary.labels.includes("Moral do elenco") && summary.labels.includes("Folga protegida"),
    JSON.stringify(summary));

  // 1b) "Histórico de fadiga" abre vazio ANTES de qualquer treino ser
  // aplicado (carreira acabou de nascer) -- checado aqui, antes da
  // checagem 2b aplicar treino de verdade.
  await page.click("#btnOpenFatigueHistory");
  await page.waitForTimeout(200);
  const emptyHist = await page.evaluate(() => ({
    open: document.getElementById("fatigueHistoryOverlay").classList.contains("open"),
    hasOptions: document.getElementById("fatigueHistoryPlayerSelect").options.length > 15,
    chartEmpty: !document.getElementById("fatigueHistoryChartEmpty").classList.contains("hidden"),
  }));
  console.log("1b) Histórico de fadiga abre com o seletor cheio, gráfico vazio (carreira nova):", emptyHist.open && emptyHist.hasOptions && emptyHist.chartEmpty, JSON.stringify(emptyHist));
  await page.click("#fatigueHistoryClose");
  await page.waitForTimeout(150);

  // 2) Foco "Tático" está disponível no dia 0 e, ao aplicar, evolui
  // ATAQUE e DEFESA (não overall/phys) do elenco afetado.
  await page.click('.mt-day-cell[data-day="0"]');
  await page.waitForTimeout(150);
  const hasTatico = await page.evaluate(() => !!document.querySelector('.mt-seg-btn[data-seg="foco"][data-value="tatico"]'));
  await page.click('.mt-seg-btn[data-seg="foco"][data-value="tatico"]');
  await page.waitForTimeout(150);
  const afterTatico = await page.evaluate(() => ({ ...CAREER.trainingPlan[0] }));
  console.log("2) 'Tático' existe como foco e fica ativo no dia:", hasTatico && afterTatico.foco === "tatico", JSON.stringify(afterTatico));

  const before = await page.evaluate(() => CAREER.squad.filter((p) => p.origin === "principal" || p.origin === "loan").map((p) => ({ id: p.id, atk: p.atk, def: p.def, overall: p.overall, phys: p.phys })));
  await page.click("#btnApplyTraining");
  await page.waitForTimeout(300);
  const check2 = await page.evaluate((before) => {
    const after = CAREER.squad.filter((p) => p.origin === "principal" || p.origin === "loan");
    const b = new Map(before.map((p) => [p.id, p]));
    // Pelo menos ALGUM jogador (não necessariamente todos, teto de
    // potencial pode zerar ganho pra quem já está no limite) subiu
    // atk OU def, e ninguém teve overall/phys alterado só por causa do
    // dia 0 tático (os outros dias do esquema padrão continuam
    // técnico/físico —檢ncestas isoladas não dá, então só confere que
    // atk/def tiveram ALGUM ganho em algum jogador).
    const anyAtkOrDefGain = after.some((p) => { const pb = b.get(p.id); return pb && (p.atk > pb.atk || p.def > pb.def); });
    return { anyAtkOrDefGain };
  }, before);
  console.log("2b) Aplicar treino com dia 'Tático' evolui ataque e/ou defesa de algum jogador:", check2.anyAtkOrDefGain, JSON.stringify(check2));

  // Ao concluir a operação "Aplicar treino da semana", o app agora
  // fecha tudo e volta pra Início (pedido do usuário: "ao encerrar uma
  // operação sempre... devolver o jogador para a página de Início") --
  // volta pra Treinos pra continuar as checagens seguintes, que ainda
  // dependem de elementos dessa aba.
  await page.evaluate(() => switchToPanel("treinos"));
  await page.waitForTimeout(150);

  // 3) Duração: default por intensidade (60 pra moderada) e o stepper
  // funciona (+15/-15, clamped 15-120).
  const initialDur = await page.evaluate(() => document.querySelector(".mt-dur-val")?.textContent);
  await page.click("#btnTrainingDurPlus");
  await page.waitForTimeout(150);
  const afterPlus = await page.evaluate(() => ({ label: document.querySelector(".mt-dur-val")?.textContent, duracao: CAREER.trainingPlan[0].duracao }));
  await page.click("#btnTrainingDurMinus");
  await page.click("#btnTrainingDurMinus");
  await page.waitForTimeout(150);
  const afterMinus = await page.evaluate(() => ({ label: document.querySelector(".mt-dur-val")?.textContent, duracao: CAREER.trainingPlan[0].duracao }));
  console.log("3) Duração default 60min (moderada) e stepper +15/-15 funciona:",
    initialDur === "60 min" && afterPlus.duracao === 75 && afterMinus.duracao === 45,
    JSON.stringify({ initialDur, afterPlus, afterMinus }));

  // 4) Aviso de jogador em risco: força um jogador perto do limite de
  // fadiga e confirma que o card aparece com o nome dele; depois força
  // todo mundo saudável e confirma que o card some. Chama renderTreinos()
  // direto (mais confiável que navegar de aba pra forçar re-render).
  await page.evaluate(() => {
    CAREER.squad.forEach((p) => { p.condition = 100; });
    CAREER.squad[0].condition = 10; // fica bem fadigado -- deve estourar 80% projetado
    renderTreinos();
  });
  await page.waitForTimeout(150);
  const riskShown = await page.evaluate(() => document.querySelector("#trainingRiskWarning .mt-training-warning") ? document.getElementById("trainingRiskWarning").textContent : null);
  console.log("4) Aviso de risco aparece pro jogador bem fadigado:", !!riskShown && riskShown.includes("% de fadiga"), riskShown);

  await page.evaluate(() => { CAREER.squad.forEach((p) => { p.condition = 100; }); renderTreinos(); });
  await page.waitForTimeout(150);
  const riskHidden = await page.evaluate(() => document.getElementById("trainingRiskWarning").innerHTML.trim() === "");
  console.log("4b) Aviso de risco some quando ninguém está em risco:", riskHidden);

  // 6) Simula mais 2 rodadas de treino aplicado (a rodada 1 já foi
  // aplicada na checagem 2b) -- gráfico acumula 3 barras no total pro
  // jogador selecionado, rótulos com a rodada certa.
  const targetId = await page.evaluate(() => CAREER.squad.find((p) => p.origin === "principal").id);
  // Chama applyWeeklyTraining() direto (mesma função do botão) --
  // clicar o botão de novo exigiria re-renderizar pra ele reabilitar
  // sozinho, sem relação nenhuma com o que este passo quer provar
  // (acúmulo de histórico ao longo de rodadas).
  await page.evaluate(() => {
    for (let i = 0; i < 2; i++) {
      CAREER.currentRound += 1;
      CAREER.trainingAppliedForRound = null;
      applyWeeklyTraining();
    }
    persistCareer();
  });
  await page.waitForTimeout(150);
  await page.click("#btnOpenFatigueHistory");
  await page.waitForTimeout(200);
  await page.selectOption("#fatigueHistoryPlayerSelect", targetId);
  await page.waitForTimeout(200);
  const withHistory = await page.evaluate((targetId) => ({
    bars: document.querySelectorAll("#fatigueHistoryChart .mt-fatigue-bar").length,
    labels: [...document.querySelectorAll("#fatigueHistoryLabels span")].map((s) => s.textContent),
    fatigueHistoryLen: CAREER.squad.find((p) => p.id === targetId).fatigueHistory.length,
  }), targetId);
  console.log("6) Gráfico mostra 1 barra por rodada aplicada, com rótulo de rodada:",
    withHistory.bars === withHistory.fatigueHistoryLen && withHistory.bars >= 3 && withHistory.labels.every((l) => /^R\d+$/.test(l)),
    JSON.stringify(withHistory));

  // 7) Lesão registrada aparece cruzada com a fadiga do período (força
  // via injeção direta, já que lesão de verdade só acontece em partida).
  await page.evaluate((targetId) => {
    const p = CAREER.squad.find((x) => x.id === targetId);
    p.injuryHistory = p.injuryHistory || [];
    p.injuryHistory.push({ round: CAREER.currentRound, severity: "media", durationRounds: 4, fadigaAtInjury: 72 });
  }, targetId);
  await page.evaluate(() => {}); // no-op, só documenta a injeção acima
  await page.click("#fatigueHistoryPlayerSelect"); // reabre o mesmo select, força re-render manual abaixo
  const injuryShown = await page.evaluate(() => { renderFatigueHistoryScreen(); return document.getElementById("fatigueHistoryInjuries").textContent; });
  console.log("7) Lesão registrada aparece na lista cruzada com a fadiga do momento:",
    injuryShown.includes("Lesão") && injuryShown.includes("72%"), injuryShown.trim());

  await page.click("#btnFatigueHistoryCloseFooter");
  await page.waitForTimeout(150);
  const closedOk = await page.evaluate(() => !document.getElementById("fatigueHistoryOverlay").classList.contains("open"));
  console.log("8) 'Fechar' no rodapé fecha a tela:", closedOk);

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
