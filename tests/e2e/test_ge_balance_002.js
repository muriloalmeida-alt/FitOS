// GE-BALANCE-002 (issue #27) — teste e2e via UI real. Cobre o
// mecanismo novo "reprieve de tradição" (CLUB_TRADITION_IDS/
// TRADITION_REPRIEVE_CHANCE/applyTraditionReprieve, ver carreira.js):
// a lista curada, o sorteio determinístico (dá pra sair dos 2 jeitos
// dependendo do seedKey — não é sempre true nem sempre false), os
// invariantes do swap (tamanho da zona preservado, só clube de
// tradição é afetado), e a integração com applyPromotionRelegation
// (cascata real). A distribuição estatística do mecanismo (~50% de
// redução) já foi validada em tests/e2e/sim_ge_balance_002.js — este
// teste é sobre regressão de wiring/invariantes, não estatística.
const { chromium } = require("playwright-core");

async function newCareer(page, base, email) {
  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "GE Balance 002 Test", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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
  await newCareer(page, base, `gebalance002${Date.now()}@teste.com`);

  // 1) Lista curada de tradição — os 12 clubes esperados, nada a mais.
  const list = await page.evaluate(() => [...CLUB_TRADITION_IDS].sort());
  const expected = ["bot", "cam", "cor", "cru", "flu", "fla", "gre", "int", "pal", "san", "sao", "vas"].sort();
  console.log("1) CLUB_TRADITION_IDS tem exatamente os 12 clubes esperados:",
    JSON.stringify(list) === JSON.stringify(expected), JSON.stringify(list));

  // 2) O sorteio realmente pode sair dos 2 jeitos (não é sempre
  // true/sempre false) — varre vários seedKeys com o MESMO cenário
  // sintético (1 clube de tradição na zona) até achar 1 de cada.
  const rolls = await page.evaluate(() => {
    // 20 times sintéticos, "fla" (tradição) em último; resto não-tradição.
    const sortedRows = Array.from({ length: 20 }, (_, i) => ({ id: i === 19 ? "fla" : `x${i}`, pts: 60 - i }));
    const zone = relegationZoneIds(sortedRows, 4);
    const outcomes = [];
    for (let i = 0; i < 30; i++) {
      const result = applyTraditionReprieve(zone, sortedRows, `probe-${i}`);
      outcomes.push({ seedKey: `probe-${i}`, reprieved: !result.includes("fla"), zoneSize: result.length });
    }
    return outcomes;
  });
  const anyReprieved = rolls.some((r) => r.reprieved);
  const anyNotReprieved = rolls.some((r) => !r.reprieved);
  const allZoneSize4 = rolls.every((r) => r.zoneSize === 4);
  console.log("2) O sorteio determinístico sai dos 2 jeitos ao variar o seedKey (não é sempre true/false), zona sempre com 4:",
    anyReprieved && anyNotReprieved && allZoneSize4,
    JSON.stringify({ anyReprieved, anyNotReprieved, allZoneSize4, sample: rolls.slice(0, 6) }));

  // 3) Clube NÃO-tradicional nunca é afetado pelo mecanismo (mesmo
  // cenário sintético, mas zona toda de não-tradição).
  const noTraditionCase = await page.evaluate(() => {
    const sortedRows = Array.from({ length: 20 }, (_, i) => ({ id: `y${i}`, pts: 60 - i }));
    const zone = relegationZoneIds(sortedRows, 4);
    const result = applyTraditionReprieve(zone, sortedRows, "no-tradition-probe");
    return { same: JSON.stringify(result.slice().sort()) === JSON.stringify(zone.slice().sort()) };
  });
  console.log("3) Zona sem nenhum clube de tradição não muda nada (mecanismo é inerte fora do seu escopo):",
    noTraditionCase.same, JSON.stringify(noTraditionCase));

  // 4) Integração real: applyPromotionRelegation com um clube de
  // tradição QUE NÃO É o do técnico forçado em último — cascata
  // continua consistente (20/20/20/20, zona sempre com 4) não importa
  // se o reprieve disparou ou não pra esse clube.
  const integration = await page.evaluate(async () => {
    // "cor" (Corinthians) é de tradição e não é o clube do técnico
    // nesta carreira (o seletor sempre abre o Flamengo primeiro — ver
    // test_rebaixamento.js); se por acaso FOR (não deveria, mas
    // defensivo), troca o alvo pra outro clube de tradição garantido
    // de não ser o do técnico.
    const target = String(CAREER.clubId) === "cor" ? "pal" : "cor";
    const teamsA = CAREER.divisionTeams.brasileirao.map((t) => String(t.id));
    teamsA.forEach((id, i) => { CAREER.standings[id] = { id, j: 38, v: teamsA.length - i, e: 0, d: i, gp: 50, gc: 10, sg: 40, pts: (teamsA.length - i) * 3 }; });
    const lastId = teamsA[teamsA.length - 1];
    [CAREER.standings[target].pts, CAREER.standings[lastId].pts] = [CAREER.standings[lastId].pts, CAREER.standings[target].pts];
    [CAREER.standings[target].v, CAREER.standings[lastId].v] = [CAREER.standings[lastId].v, CAREER.standings[target].v];
    const pr = await applyPromotionRelegation();
    return {
      target,
      countsOk: CAREER.divisionTeams.brasileirao.length === 20 && CAREER.divisionTeams.serie_b.length === 20 && CAREER.divisionTeams.serie_c.length === 20 && CAREER.serieDPool.length === 20,
      relegatedACount: pr.relegatedA.length,
      targetRelegated: pr.relegatedA.some((t) => String(t.id) === target),
      targetStillInA: CAREER.divisionTeams.brasileirao.some((t) => String(t.id) === target),
    };
  });
  console.log("4) applyPromotionRelegation com um clube de tradição forçado em último continua consistente (20/20/20/20, zona=4), com ou sem reprieve:",
    integration.countsOk && integration.relegatedACount === 4 && (integration.targetRelegated !== integration.targetStillInA),
    JSON.stringify(integration));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
