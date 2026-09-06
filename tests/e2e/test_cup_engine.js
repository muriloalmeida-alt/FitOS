const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));

  const base = "http://localhost:8787";
  const email = `cupengine${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Cup Engine", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "load" });
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(200);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);

  // Testa resolveCupPhase diretamente no client, forçando CAREER.cup em
  // cada fase e conferindo prêmio/avanço/eliminação isoladamente.
  const results = await page.evaluate(() => {
    const out = {};
    const otherClub = LEAGUE_TEAMS.find((t) => String(t.id) !== String(CAREER.clubId)).id;

    // Caso 1: vence a fase (R16) -> avança pra QF com prêmio.
    CAREER.cup = {
      active: true, phase: "r16", humanAlive: true, humanEliminatedAtRound: null, humanEliminatedStage: null,
      champion: null, championIsHuman: false,
      ties: { r16: [{ home: CAREER.clubId, away: otherClub, gh: null, ga: null, winner: null, penalties: false }], qf: [], sf: [], final: [] },
    };
    const cashBefore = CAREER.finances.cash;
    // Substitui simulateCupTie temporariamente pra forçar vitória 3x0 sem pênaltis.
    const origSim = simulateCupTie;
    simulateCupTie = () => ({ gh: 3, ga: 0, penalties: false, winner: CAREER.clubId });
    const r1 = resolveCupPhase(6);
    simulateCupTie = origSim;
    out.venceu = {
      phaseResolvida: r1.phase, novaFase: CAREER.cup.phase, humanAlive: CAREER.cup.humanAlive,
      qfTemMeuClube: CAREER.cup.ties.qf.some((t) => String(t.home) === String(CAREER.clubId) || String(t.away) === String(CAREER.clubId)),
      caixaAumentou: CAREER.finances.cash > cashBefore,
      delta: CAREER.finances.cash - cashBefore,
    };

    // Caso 2: perde a fase (SF) -> elimina, sem prêmio.
    CAREER.cup = {
      active: true, phase: "sf", humanAlive: true, humanEliminatedAtRound: null, humanEliminatedStage: null,
      champion: null, championIsHuman: false,
      ties: { r16: [], qf: [], sf: [{ home: CAREER.clubId, away: otherClub, gh: null, ga: null, winner: null, penalties: false }], final: [] },
    };
    const cashBefore2 = CAREER.finances.cash;
    simulateCupTie = () => ({ gh: 0, ga: 2, penalties: false, winner: otherClub });
    const r2 = resolveCupPhase(22);
    simulateCupTie = origSim;
    out.perdeu = {
      humanAlive: CAREER.cup.humanAlive, stage: CAREER.cup.humanEliminatedStage, round: CAREER.cup.humanEliminatedAtRound,
      caixaMudou: CAREER.finances.cash !== cashBefore2,
    };

    // Caso 3: vence a FINAL -> campeão, prêmio de campeão.
    CAREER.cup = {
      active: true, phase: "final", humanAlive: true, humanEliminatedAtRound: null, humanEliminatedStage: null,
      champion: null, championIsHuman: false,
      ties: { r16: [], qf: [], sf: [], final: [{ home: CAREER.clubId, away: otherClub, gh: null, ga: null, winner: null, penalties: false }] },
    };
    const cashBefore3 = CAREER.finances.cash;
    simulateCupTie = () => ({ gh: 1, ga: 0, penalties: false, winner: CAREER.clubId });
    resolveCupPhase(30);
    simulateCupTie = origSim;
    out.campeao = {
      phase: CAREER.cup.phase, championIsHuman: CAREER.cup.championIsHuman, champion: CAREER.cup.champion,
      delta: CAREER.finances.cash - cashBefore3,
    };

    // Caso 4: perde a FINAL -> vice, prêmio de vice.
    CAREER.cup = {
      active: true, phase: "final", humanAlive: true, humanEliminatedAtRound: null, humanEliminatedStage: null,
      champion: null, championIsHuman: false,
      ties: { r16: [], qf: [], sf: [], final: [{ home: CAREER.clubId, away: otherClub, gh: null, ga: null, winner: null, penalties: false }] },
    };
    const cashBefore4 = CAREER.finances.cash;
    simulateCupTie = () => ({ gh: 0, ga: 1, penalties: false, winner: otherClub });
    resolveCupPhase(30);
    simulateCupTie = origSim;
    out.vice = {
      phase: CAREER.cup.phase, championIsHuman: CAREER.cup.championIsHuman, humanAlive: CAREER.cup.humanAlive,
      delta: CAREER.finances.cash - cashBefore4,
    };

    return out;
  });
  console.log(JSON.stringify(results, null, 2));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
