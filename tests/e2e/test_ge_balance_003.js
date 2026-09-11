// GE-BALANCE-003 (issue #30) — teste e2e via UI real. Confirma, usando
// o MOTOR REAL carregado no navegador (resolveCpuFixture/suggestTactics
// — chamados de verdade, não reimplementados), que a correção da
// fórmula de gol (atk/def -> atk*def, ver comentário em simulateCupLeg)
// produz a direção certa: clube com defesa mais forte (club.def menor
// — confirmado com evidência: buildRealPlayer/buildGeneratedProPlayer
// já fazem (2-club.def) pra inverter isso quando precisam de "maior=
// melhor") sofre MENOS gols em média contra o mesmo ataque, não mais.
// Validação estatística mais ampla (300 temporadas, 20 clubes reais do
// Brasileirão, distribuição de pontos/gols antes/depois) já foi feita
// em tests/e2e/sim_ge_balance_003.js — este teste é sobre o motor de
// verdade rodando dentro da UI, não sobre estatística agregada.
const { chromium } = require("playwright-core");

async function newCareer(page, base, email) {
  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "GE Balance 003 Test", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "load" });
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(200);
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
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("fonts.googleapis") && !m.text().includes("fundingchoices")) console.log("CONSOLE ERROR:", m.text()); });

  const base = "http://localhost:8787";
  await newCareer(page, base, `gebalance003${Date.now()}@teste.com`);

  // 1) resolveCpuFixture (função REAL de produção, chamada direto —
  // não reimplementada) — o mesmo clube ATACANTE fixo (Grêmio, "gre")
  // marca MENOS gols esperados de verdade contra a defesa mais forte
  // do Brasileirão real (Palmeiras, "pal", def=0.75) do que contra a
  // mais fraca (Cuiabá, "cui", def=1.32). 300 confrontos simulados (o
  // sorteio Poisson é aleatório, precisa de volume pra medir a média
  // com confiança) — mesma técnica de sim_ge_balance_003.js, mas aqui
  // chamando resolveCpuFixture() de verdade dentro do navegador.
  const check1 = await page.evaluate(() => {
    const N = 300;
    let goalsVsElite = 0, goalsVsWeak = 0;
    for (let i = 0; i < N; i++) {
      const rEliteRound = CAREER.currentRound;
      const rElite = resolveCpuFixture({ home: "gre", away: "pal" }, rEliteRound);
      goalsVsElite += rElite.gh; // gols do Grêmio (mandante) contra a defesa do Palmeiras
      const rWeak = resolveCpuFixture({ home: "gre", away: "cui" }, rEliteRound);
      goalsVsWeak += rWeak.gh; // gols do Grêmio (mandante) contra a defesa do Cuiabá
    }
    return { avgGoalsVsElite: goalsVsElite / N, avgGoalsVsWeak: goalsVsWeak / N };
  });
  console.log("1) resolveCpuFixture REAL: Grêmio marca MENOS gols em média contra a defesa elite (Palmeiras, def=0.75) do que contra a defesa fraca (Cuiabá, def=1.32):",
    check1.avgGoalsVsElite < check1.avgGoalsVsWeak, JSON.stringify(check1));

  // 2) suggestTactics (sugestão tática) usa a MESMA fórmula corrigida —
  // roda sem erro contra o próximo adversário de verdade da carreira.
  const check2 = await page.evaluate(() => {
    const opponentId = nextOpponentId();
    if (!opponentId) return { skipped: true };
    const s = suggestTactics();
    return { text: s.text, canApply: s.canApply };
  });
  console.log("2) suggestTactics roda sem erro com a fórmula corrigida:", check2.skipped || (typeof check2.text === "string" && check2.text.length > 5), JSON.stringify(check2));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
