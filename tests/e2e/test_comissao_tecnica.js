// Nova feature — Comissão Técnica: assistente que SUGERE (escalação,
// treinos, tática, mercado), o técnico decide se aplica. Custa salário
// mensal quando contratada.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `comissao${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Comissao Tecnica", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(300);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.waitForTimeout(1500);
  await page.click("#btnClaimDailyLogin").catch(() => {});
  await page.waitForTimeout(200);

  // 1) Abrir pelo Menu -> estado "não contratada" com custo estimado.
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='equipe']");
  await page.click("#btnOpenCommission");
  await page.waitForTimeout(300);
  const check1 = await page.evaluate(() => ({
    open: document.getElementById("commissionOverlay").classList.contains("open"),
    notHiredVisible: !document.getElementById("commissionNotHiredState").classList.contains("hidden"),
    hiredHidden: document.getElementById("commissionHiredState").classList.contains("hidden"),
    costText: document.getElementById("commissionCostEstimate").textContent,
  }));
  console.log("1) Abre no estado 'não contratada' com custo estimado:", check1.open && check1.notHiredVisible && check1.hiredHidden && check1.costText.includes("R$"), JSON.stringify(check1));

  // 2) Contratar -> vira "contratada", mostra os 4 cards de sugestão.
  await page.click("#btnHireCommission");
  await page.waitForTimeout(150);
  await page.click("#confirmOkBtn");
  await page.waitForTimeout(200);
  const check2 = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("#commissionCards .mt-card")];
    return {
      hired: CAREER.technicalStaff.hired,
      hiredVisible: !document.getElementById("commissionHiredState").classList.contains("hidden"),
      cardCount: cards.length,
      titles: cards.map((c) => c.querySelector(".mt-card-title").textContent),
    };
  });
  console.log("2) Contratar mostra os 4 cards (Escalação/Treinos/Tática/Mercado):",
    check2.hired && check2.hiredVisible && check2.cardCount === 4
    && check2.titles.some((t) => t.includes("Escalação")) && check2.titles.some((t) => t.includes("Treinos"))
    && check2.titles.some((t) => t.includes("Tática")) && check2.titles.some((t) => t.includes("Mercado")),
    JSON.stringify(check2));

  await page.screenshot({ path: "screens/comissao_tecnica.png" });

  // 3) Sugestão de Treinos: rodada 1 -> recomenda "Pré-Temporada
  // Física" (regra real: round===1). Aplicar de fato muda
  // CAREER.trainingSchemeId.
  const check3a = await page.evaluate(() => suggestTraining());
  console.log("3) Sugestão de treino na rodada 1 recomenda Pré-Temporada Física:", check3a.text.includes("Pré-Temporada Física"), JSON.stringify(check3a));
  const trainingCardIdx = await page.evaluate(() => [...document.querySelectorAll("#commissionCards .mt-card")].findIndex((c) => c.querySelector(".mt-card-title").textContent.includes("Treinos")));
  await page.click(`#commissionCards .mt-card:nth-child(${trainingCardIdx + 1}) [data-apply]`);
  await page.waitForTimeout(300);
  const check3b = await page.evaluate(() => CAREER.trainingSchemeId);
  console.log("3b) Aplicar a sugestão de treino grava de verdade o esquema:", check3b === "pretemporada", check3b);

  // 4) Sugestão de Tática: compara força real do clube com o próximo
  // adversário (dado real do catálogo, não texto de enchimento).
  const check4 = await page.evaluate(() => {
    const s = suggestTactics();
    return { hasText: !!s.text, mentionsOpponent: /favorito|equilibrado|parelh/.test(s.text) };
  });
  console.log("4) Sugestão de tática compara com o próximo adversário de verdade:", check4.hasText && check4.mentionsOpponent, JSON.stringify(check4));

  // 5) Sugestão de Escalação: reaproveita autoLineup -- se aplicar,
  // titulares mudam pros melhores overalls disponíveis.
  const beforeStarters = await page.evaluate(() => [...CAREER.lineup.starters]);
  const lineupSuggestion = await page.evaluate(() => suggestLineup());
  console.log("5) Sugestão de escalação calculada (canApply ou já é a melhor):", typeof lineupSuggestion.canApply === "boolean", JSON.stringify(lineupSuggestion));
  if (lineupSuggestion.canApply) {
    await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='equipe']").catch(() => {});
    await page.click("#btnOpenCommission").catch(() => {});
  }

  // 6) Custo mensal é debitado do caixa a cada rodada simulada (1/4 do
  // valor mensal), igual à folha salarial. Simula a MESMA rodada 2
  // vezes a partir do MESMO estado salvo (uma com a comissão contratada,
  // outra sem) com Math.random() REPRODUZIDO igual nas duas (grava a
  // sequência de números aleatórios na 1ª rodada, reproduz a mesma
  // sequência na 2ª) — isola só o efeito da comissão, sem depender de
  // sorte (bilheteria/gols variam por partida, mas ficam IDÊNTICOS nas
  // duas rodadas já que o sorteio é o mesmo).
  await page.click("#commissionClose").catch(() => {});
  const snapshot = await page.evaluate(async () => (await (await fetch("/api/career")).json()).career);
  const monthlyCost = await page.evaluate(() => technicalStaffMonthlyCost());

  async function simulateOneRoundDeterministic(hired) {
    await page.evaluate(async ({ snap, hired }) => {
      snap.technicalStaff = { hired };
      await fetch("/api/career", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(snap) });
    }, { snap: snapshot, hired });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    // Grava a sequência de Math.random() na 1ª chamada (hired=true) e
    // reproduz a MESMA sequência na 2ª (hired=false) — window persiste
    // entre reloads? NÃO — precisa gravar/ler via localStorage, que
    // sobrevive ao reload.
    await page.evaluate(() => {
      const stored = localStorage.getItem("__rngSeq");
      const seq = stored ? JSON.parse(stored) : [];
      let idx = 0;
      const orig = Math.random;
      Math.random = () => {
        if (idx < seq.length) return seq[idx++];
        const v = orig();
        seq.push(v);
        idx++;
        return v;
      };
      window.__saveRng = () => localStorage.setItem("__rngSeq", JSON.stringify(seq));
    });
    const before = await page.evaluate(() => CAREER.finances.cash);
    await page.click(".m3-nav-item[data-panel='central']");
    await page.waitForTimeout(200);
    await page.click("#btnSimulate");
    await page.waitForSelector("#preMatchOverlay.open", { timeout: 5000 });
    await page.click("#btnPreMatchGo");
    await page.waitForSelector("#liveMatchOverlay.open", { timeout: 5000 }).catch(() => {});
    await page.evaluate(() => skipLiveMatch());
    // finishRoundTail() já rodou e atualizou CAREER.finances.cash de
    // verdade nesse ponto (síncrono, antes de qualquer modal pós-jogo
    // aparecer) — não precisa navegar pelo resto do fluxo (Seu jogo/
    // Notícias/Resultados/Tabela) só pra ler o caixa; cada rodada
    // recomeça de um reload+PUT novo mesmo, então não precisa "limpar"
    // a tela pra próxima chamada.
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => CAREER.finances.cash);
    await page.evaluate(() => window.__saveRng());
    return after - before;
  }

  await page.evaluate(() => localStorage.removeItem("__rngSeq"));
  const deltaHired = await simulateOneRoundDeterministic(true);
  const deltaNotHired = await simulateOneRoundDeterministic(false);
  const observedCommissionCost = deltaNotHired - deltaHired;
  const expectedCommissionDeduction = Math.round(monthlyCost / 4);
  console.log("6) Rodando a MESMA rodada (sorteio idêntico) com e sem comissão, a diferença de caixa bate com 1/4 do custo mensal:",
    observedCommissionCost === expectedCommissionDeduction,
    JSON.stringify({ deltaHired, deltaNotHired, observedCommissionCost, expectedCommissionDeduction }));

  // Volta pra um estado limpo (Central, sem nenhum modal pós-jogo
  // aberto) pro resto do teste — a 2ª rodada determinística deixou
  // alguma sequência de modais pra trás, sem precisar navegar por ela.
  await page.evaluate(async () => {
    const r = await fetch("/api/career");
    const data = await r.json();
    data.career.technicalStaff = { hired: true };
    await fetch("/api/career", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data.career) });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);

  // 7) Demitir -> volta pro estado "não contratada", sem mais custo.
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='equipe']");
  await page.click("#btnOpenCommission");
  await page.waitForTimeout(200);
  await page.click("#btnFireCommission");
  await page.waitForTimeout(150);
  await page.click("#confirmOkBtn");
  await page.waitForTimeout(200);
  const check7 = await page.evaluate(() => ({
    hired: CAREER.technicalStaff.hired,
    notHiredVisible: !document.getElementById("commissionNotHiredState").classList.contains("hidden"),
  }));
  console.log("7) Demitir volta ao estado 'não contratada':", !check7.hired && check7.notHiredVisible, JSON.stringify(check7));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
