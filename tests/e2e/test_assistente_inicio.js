// Pedido do usuário: "Ao iniciar o jogo, antes de carregar a página de
// início e após escolher a divisão e o clube quero que você crie
// perguntas (formato onboarding) para que o treinador monte sua
// formação favorita, contrate comissão e olheiros e faça tudo o que
// for necessário para iniciar o jogo." Decisões confirmadas via
// AskUserQuestion: 4 passos (Formação+titulares, Comissão Técnica,
// Olheiros, Táticas básicas), todos puláveis, aparece em TODA carreira
// nova (não só a 1ª da conta), tutorial de navegação existente continua
// rodando ANTES dele na 1ª carreira.
const { chromium } = require("playwright-core");

async function newAccount(page, base, email) {
  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Wizard Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
}
async function pickClub(page, base) {
  await page.goto(base + "/carreira.html", { waitUntil: "load" });
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(300);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
    args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";

  // 1) 1ª carreira da conta: tutorial de navegação abre PRIMEIRO, e só
  // depois dele fechar (Pular) o assistente de início aparece.
  await newAccount(page, base, `wizard${Date.now()}@teste.com`);
  await pickClub(page, base);
  await page.waitForTimeout(600);
  const onboardOpen = await page.evaluate(() => document.getElementById("onboardingOverlay").classList.contains("open"));
  const wizardOpenBefore = await page.evaluate(() => document.getElementById("startupWizardOverlay").classList.contains("open"));
  console.log("1) Tutorial de navegação abre primeiro (assistente ainda não, sobrepostos nunca):", onboardOpen && !wizardOpenBefore);
  await page.click("#btnOnboardSkip");
  await page.waitForTimeout(400);
  const wizardOpenAfter = await page.evaluate(() => document.getElementById("startupWizardOverlay").classList.contains("open"));
  const step1 = await page.evaluate(() => ({
    title: document.getElementById("wizardStepTitle").textContent,
    sub: document.getElementById("wizardStepSub").textContent,
    hasFormationChips: document.querySelectorAll("#wizardStepFormacao #formationChipRow .m3-filter-chip").length > 0,
    hasPitch: !!document.querySelector("#wizardStepFormacao .mt-pitch"),
  }));
  console.log("2) Assistente abre depois do tutorial fechar, no Passo 1 (Formação, com chips+campinho reais):", wizardOpenAfter && step1.title === "Monte sua formação favorita" && step1.sub === "Passo 1 de 4" && step1.hasFormationChips && step1.hasPitch, JSON.stringify(step1));

  // 3) Trocar a formação no Passo 1 aplica de verdade em CAREER.
  const formBefore = await page.evaluate(() => CAREER.lineup.formation);
  const otherFormation = await page.evaluate((cur) => Object.keys(FORMATIONS).find((f) => f !== cur), formBefore);
  await page.click(`#wizardStepFormacao [data-formation="${otherFormation}"]`);
  await page.waitForTimeout(150);
  const formAfter = await page.evaluate(() => CAREER.lineup.formation);
  console.log("3) Trocar formação no assistente aplica de verdade em CAREER.lineup:", formAfter === otherFormation && formAfter !== formBefore, `${formBefore} -> ${formAfter}`);
  await page.click("#btnWizardContinue");
  await page.waitForTimeout(200);

  // 4) Passo 2 — Comissão Técnica: mostra custo real, contratar aplica
  // de verdade (CAREER.technicalStaff.hired) e persiste.
  const step2Before = await page.evaluate(() => ({
    title: document.getElementById("wizardStepTitle").textContent,
    sub: document.getElementById("wizardStepSub").textContent,
    cost: document.getElementById("wizardCommissionCost").textContent,
    hiredBefore: CAREER.technicalStaff.hired,
  }));
  console.log("4) Passo 2 é Comissão Técnica com custo real mostrado:", step2Before.title === "Comissão Técnica" && step2Before.sub === "Passo 2 de 4" && /R\$/.test(step2Before.cost) && step2Before.hiredBefore === false, JSON.stringify(step2Before));
  await page.click("#btnWizardHireCommission");
  await page.waitForTimeout(150);
  const step2After = await page.evaluate(() => ({
    hired: CAREER.technicalStaff.hired,
    noteHidden: document.getElementById("wizardCommissionHiredNote").hidden,
    btnDisabled: document.getElementById("btnWizardHireCommission").disabled,
  }));
  console.log("5) Contratar comissão no assistente aplica de verdade (CAREER.technicalStaff.hired) e atualiza a tela:", step2After.hired === true && step2After.noteHidden === false && step2After.btnDisabled === true, JSON.stringify(step2After));
  await page.click("#btnWizardContinue");
  await page.waitForTimeout(200);

  // 6) Passo 3 — Olheiros: lista real do SCOUT_MARKET, contratar
  // aplica de verdade (CAREER.scouts).
  const step3Before = await page.evaluate(() => ({
    title: document.getElementById("wizardStepTitle").textContent,
    sub: document.getElementById("wizardStepSub").textContent,
    scoutRows: document.querySelectorAll("#wizardScoutList .m3-list-item").length,
    scoutsBefore: (CAREER.scouts || []).length,
  }));
  console.log("6) Passo 3 é Olheiros com a lista real do SCOUT_MARKET:", step3Before.title === "Contrate olheiros" && step3Before.sub === "Passo 3 de 4" && step3Before.scoutRows === 3 && step3Before.scoutsBefore === 0, JSON.stringify(step3Before));
  await page.click("#wizardScoutList [data-hire]");
  await page.waitForTimeout(150);
  const step3After = await page.evaluate(() => (CAREER.scouts || []).length);
  console.log("7) Contratar olheiro no assistente aplica de verdade (CAREER.scouts):", step3After === 1, step3After);
  await page.click("#btnWizardContinue");
  await page.waitForTimeout(200);

  // 8) Passo 4 — Táticas básicas: reaproveita os mesmos 4 eixos reais
  // (TACTIC_AXES), mudar um segmento e continuar aplica em
  // CAREER.lineup.tactics.
  const step4Before = await page.evaluate(() => ({
    title: document.getElementById("wizardStepTitle").textContent,
    sub: document.getElementById("wizardStepSub").textContent,
    hasAxisRows: document.querySelectorAll("#wizardStepTaticas #tacticAxisRows .m3-instr-row").length,
    btnLabel: document.getElementById("btnWizardContinue").textContent,
  }));
  console.log("8) Passo 4 é Táticas com os 4 eixos reais, botão final vira 'Começar a temporada':", step4Before.title === "Táticas básicas" && step4Before.sub === "Passo 4 de 4" && step4Before.hasAxisRows === 4 && step4Before.btnLabel === "Começar a temporada", JSON.stringify(step4Before));
  // Sobe o eixo "Pressão" pro nível 5 (clicando no 5º segmento).
  await page.click('#wizardStepTaticas .m3-instr-row[data-axis="pressao"] .m3-seg[data-level="5"]');
  await page.waitForTimeout(100);
  await page.click("#btnWizardContinue");
  await page.waitForTimeout(400);

  // 9) Assistente fecha, tela de início (Central) aparece, e os 2
  // blocos (formação/campinho/banco + táticas) voltaram pro
  // #panel-escalacao original, intactos e funcionando.
  const afterFinish = await page.evaluate(() => ({
    wizardOpen: document.getElementById("startupWizardOverlay").classList.contains("open"),
    gameVisible: document.getElementById("screenGame").classList.contains("hidden") === false,
    tacticsPressao: CAREER.lineup.tactics.pressao,
    formationApplied: CAREER.lineup.formation,
    startupWizardSeen: CAREER.startupWizardSeen,
    technicalStaffHired: CAREER.technicalStaff.hired,
    scoutsCount: (CAREER.scouts || []).length,
    formationBlockBackHome: document.getElementById("panel-escalacao").contains(document.getElementById("escalacaoFormationBlock")),
    tacticsBlockBackHome: document.getElementById("panel-escalacao").contains(document.getElementById("escalacaoTacticsBlock")),
  }));
  console.log("9) Assistente termina, tudo aplicado e persistido, e os blocos voltam pro painel de Escalação real:",
    !afterFinish.wizardOpen && afterFinish.gameVisible && afterFinish.tacticsPressao === 5 && afterFinish.formationApplied === otherFormation
    && afterFinish.startupWizardSeen === true && afterFinish.technicalStaffHired === true && afterFinish.scoutsCount === 1
    && afterFinish.formationBlockBackHome && afterFinish.tacticsBlockBackHome,
    JSON.stringify(afterFinish));

  // 10) Login diário abre em seguida (fila continua depois do
  // assistente, mesmo comportamento de sempre) — precisa fechar ANTES
  // de mexer em qualquer outra tela (modal cheia por cima de tudo).
  const dailyLoginOpen = await page.evaluate(() => document.getElementById("dailyLoginOverlay").classList.contains("open"));
  console.log("10) Login diário abre em seguida ao assistente terminar (fila continua):", dailyLoginOpen);
  await page.waitForSelector("#dailyLoginOverlay.open", { timeout: 6000 }).catch(() => {});
  await page.click("#btnClaimDailyLogin", { timeout: 6000 }).catch(() => {});
  await page.waitForSelector("#dailyLoginOverlay:not(.open)", { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(300);

  // 11) Aba Tática (Escalação) real continua funcionando depois, com o
  // esquema/tática aplicados pelo assistente refletidos lá.
  await page.click(".m3-nav-item[data-panel='escalacao']");
  await page.waitForTimeout(300);
  const realTab = await page.evaluate(() => ({
    panelActive: document.getElementById("panel-escalacao").classList.contains("active"),
    formationShown: document.querySelector("#formationChipRow .m3-filter-chip.on")?.dataset.formation,
    pitchVisible: !!document.querySelector("#pitchLines .mt-pitch"),
    pressaoShown: document.querySelector('#tacticAxisRows .m3-instr-row[data-axis="pressao"]')?.dataset.level,
  }));
  console.log("11) Aba Tática real (Escalação) mostra o que o assistente aplicou, e continua funcionando:",
    realTab.panelActive && realTab.formationShown === otherFormation && realTab.pitchVisible && Number(realTab.pressaoShown) === 5,
    JSON.stringify(realTab));

  // 12) 2ª carreira da MESMA conta (via "Reiniciar"): tutorial de
  // navegação NÃO reaparece (onboardingSeen já true), mas o assistente
  // de início aparece de novo (decisão confirmada: toda carreira nova).
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#btnRestart");
  await page.waitForTimeout(300);
  await page.click("#confirmOkBtn", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);
  const pickerVisible = await page.evaluate(() => document.getElementById("screenCompetitionPicker")?.classList.contains("hidden") === false);
  console.log("(info) Voltou pro seletor de competição após reiniciar:", pickerVisible);
  if (pickerVisible) {
    await page.click('.mt-competition-card[data-competition="brasileirao"]');
    await page.waitForTimeout(300);
    await page.click(".m3-club-row");
    await page.waitForTimeout(150);
    await page.click("#btnConfirmClub");
    await page.waitForTimeout(600);
    const secondCareer = await page.evaluate(() => ({
      onboardOpen: document.getElementById("onboardingOverlay").classList.contains("open"),
      wizardOpen: document.getElementById("startupWizardOverlay").classList.contains("open"),
      wizardStepSub: document.getElementById("wizardStepSub").textContent,
    }));
    console.log("12) 2ª carreira (Reiniciar): tutorial de navegação NÃO reaparece, assistente de início aparece de novo:",
      !secondCareer.onboardOpen && secondCareer.wizardOpen && secondCareer.wizardStepSub === "Passo 1 de 4", JSON.stringify(secondCareer));
    // Pula todos os passos desta vez, pra confirmar que "Pular" também funciona ponta a ponta.
    await page.click("#btnWizardSkip"); await page.waitForTimeout(150);
    await page.click("#btnWizardSkip"); await page.waitForTimeout(150);
    await page.click("#btnWizardSkip"); await page.waitForTimeout(150);
    await page.click("#btnWizardSkip"); await page.waitForTimeout(400);
    const afterSkipAll = await page.evaluate(() => ({
      wizardOpen: document.getElementById("startupWizardOverlay").classList.contains("open"),
      gameVisible: document.getElementById("screenGame").classList.contains("hidden") === false,
      startupWizardSeen: CAREER.startupWizardSeen,
      technicalStaffHired: CAREER.technicalStaff.hired,
      scoutsCount: (CAREER.scouts || []).length,
    }));
    console.log("13) 'Pular esta etapa' nos 4 passos fecha o assistente sem contratar nada, e a carreira segue normal:",
      !afterSkipAll.wizardOpen && afterSkipAll.gameVisible && afterSkipAll.startupWizardSeen === true && afterSkipAll.technicalStaffHired === false && afterSkipAll.scoutsCount === 0,
      JSON.stringify(afterSkipAll));
  } else {
    console.log("13) (pulado — não achou o fluxo de reiniciar por essa rota de UI)");
  }

  await browser.close();
  console.log("OK");
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
