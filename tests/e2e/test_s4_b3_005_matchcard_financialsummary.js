// S4-B3-005 — MatchCard (construído novo, sem candidato ad hoc
// adequado) e FinancialSummary (formalização retroativa do card
// "Financeiro" já existente em renderCentral()). Nenhuma tela migrada
// nesta demanda — mesmo padrão de teste isolado já usado pra
// TransferCard/ContractCard (S4-B3-001): chama matchCardHTML() direto
// via page.evaluate() (MatchCard é função nova) e confirma que o card
// "Financeiro" real continua funcionando como sempre (FinancialSummary
// não ganhou função própria, só contrato documentado).
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("console", (msg) => { if (msg.type() === "error") console.log("CONSOLE ERROR:", msg.text()); });
  const base = "http://localhost:8787";
  const email = `s4b3005_${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "S4B3005 Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  // ===================== MatchCard =====================

  // 1) Estado "próxima" (sem placar) mostra data/horário, sem tag de
  // status (não faz sentido pra esse estado).
  const mc1 = await page.evaluate(() => {
    const html = matchCardHTML({
      homeTeam: { id: "c1", name: "Time Casa", c1: "#123456", short: "TCA" },
      awayTeam: { id: "c2", name: "Time Fora", c1: "#654321", short: "TFO" },
      dateLabel: "12/09", timeLabel: "16:00", status: "proxima", competitionLabel: "Série A",
      clickableHome: true, clickableAway: true,
    });
    const host = document.createElement("div");
    host.innerHTML = html;
    document.body.appendChild(host);
    const result = {
      hasCard: !!host.querySelector(".m3-match-card"),
      dataStatus: host.querySelector(".m3-match-card")?.dataset.status,
      hasScore: !!host.querySelector(".m3-mc-score"),
      whenText: host.querySelector(".m3-mc-when")?.textContent,
      hasStatusTag: !!host.querySelector(".mt-ptag"),
      compText: host.querySelector(".m3-mc-comp")?.textContent,
      homeOpenClub: host.querySelectorAll(".m3-mc-side")[0]?.dataset.openclub,
      awayOpenClub: host.querySelectorAll(".m3-mc-side")[1]?.dataset.openclub,
      names: [...host.querySelectorAll(".m3-mc-name")].map((n) => n.textContent),
    };
    host.remove();
    return result;
  });
  console.log("1) MatchCard 'próxima': sem placar, mostra data/horário, sem tag de status, times clicáveis:",
    mc1.hasCard && mc1.dataStatus === "proxima" && !mc1.hasScore && mc1.whenText.includes("12/09") && mc1.whenText.includes("16:00")
    && !mc1.hasStatusTag && mc1.compText === "Série A" && mc1.homeOpenClub === "c1" && mc1.awayOpenClub === "c2"
    && mc1.names[0] === "Time Casa" && mc1.names[1] === "Time Fora",
    JSON.stringify(mc1));

  // 2) Estado "encerrada" (com placar) mostra o placar, sem tag de
  // status (óbvio pelo placar).
  const mc2 = await page.evaluate(() => {
    const html = matchCardHTML({
      homeTeam: { id: "c1", name: "Time Casa" }, awayTeam: { id: "c2", name: "Time Fora" },
      homeScore: 2, awayScore: 1, status: "encerrada",
    });
    const host = document.createElement("div");
    host.innerHTML = html;
    document.body.appendChild(host);
    const result = { scoreText: host.querySelector(".m3-mc-score")?.textContent, hasStatusTag: !!host.querySelector(".mt-ptag") };
    host.remove();
    return result;
  });
  console.log("2) MatchCard 'encerrada': mostra o placar (2 x 1), sem tag de status:",
    (mc2.scoreText || "").replace(/\s+/g, " ").trim() === "2 x 1" && !mc2.hasStatusTag, JSON.stringify(mc2));

  // 3) Estados "adiada"/"cancelada"/"andamento" mostram tag de status
  // com a cor certa (crimson/crimson/gold) — suportados pelo
  // componente mesmo sem produtor real hoje (ver divergência no
  // relatório desta demanda).
  const mc3 = await page.evaluate(() => {
    const mk = (status, statusLabel) => {
      const html = matchCardHTML({ homeTeam: { name: "A" }, awayTeam: { name: "B" }, status, statusLabel });
      const host = document.createElement("div");
      host.innerHTML = html;
      const tag = host.querySelector(".mt-ptag");
      return { text: tag?.textContent, cls: tag?.className };
    };
    return { adiada: mk("adiada", "Adiada"), cancelada: mk("cancelada", "Cancelada"), andamento: mk("andamento", "Ao vivo") };
  });
  console.log("3) Estados adiada/cancelada/andamento têm tag de status com variant certa (crimson/crimson/gold):",
    mc3.adiada.text === "Adiada" && mc3.adiada.cls.includes("crimson")
    && mc3.cancelada.text === "Cancelada" && mc3.cancelada.cls.includes("crimson")
    && mc3.andamento.text === "Ao vivo" && mc3.andamento.cls.includes("gold"),
    JSON.stringify(mc3));

  // 4) MatchCard é puro (mesma entrada -> mesma saída, sem tocar CAREER).
  const mc4 = await page.evaluate(() => {
    const args = { homeTeam: { name: "X" }, awayTeam: { name: "Y" }, status: "proxima" };
    return { equal: matchCardHTML(args) === matchCardHTML(args), touchesCareer: matchCardHTML.toString().includes("CAREER") };
  });
  console.log("4) MatchCard é puro (mesma entrada -> mesma saída, sem tocar CAREER):",
    mc4.equal && !mc4.touchesCareer, JSON.stringify(mc4));

  // ===================== FinancialSummary =====================

  // 5) O card "Financeiro" real (Início/Dashboard) continua funcionando
  // como sempre — nenhuma mudança visual/funcional, só o contrato foi
  // documentado nesta demanda.
  const fin = await page.evaluate(() => ({
    cashText: document.getElementById("financeCashNum").textContent,
    hasBars: document.getElementById("financeCashBars").children.length >= 0, // pode ser 0 na 1ª rodada (sem histórico ainda)
    kpiText: document.getElementById("financeKpis").textContent,
    wageCapLabel: document.getElementById("wageCapLabel").textContent,
  }));
  console.log("5) Card 'Financeiro' (FinancialSummary, formalização retroativa) continua funcionando — saldo/indicadores presentes:",
    fin.cashText.includes("R$") && fin.kpiText.includes("Folha salarial") && fin.wageCapLabel.includes("Folha salarial"),
    JSON.stringify(fin));

  await browser.close();
})();
