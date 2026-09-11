// GE-BALANCE-001 (issue #26) — teste e2e via UI real. Cobre o mecanismo
// novo "adversário motivado" (opponentMotivationMod, ver carreira.js):
// os degraus da função pura, o aviso pré-partida (princípio de
// explicabilidade, CLAUDE.md §45) e que uma carreira nova (sem
// sequência) continua sem esse bônus — nenhuma regressão no fluxo Ao
// Vivo de sempre (esse já é coberto por test_ao_vivo.js).
const { chromium } = require("playwright-core");

async function newCareer(page, base, email) {
  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "GE Balance Test", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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
  await newCareer(page, base, `gebalance001${Date.now()}@teste.com`);

  // 1) Degraus da função pura (determinística, sem depender de partida
  // real) batem com a especificação: <5 sem bônus, 5-7 → 1.04, 8-11 →
  // 1.08, 12+ → 1.12.
  const steps = await page.evaluate(() => {
    const out = {};
    [0, 4, 5, 7, 8, 11, 12, 20].forEach((s) => {
      CAREER.currentUnbeatenStreak = s;
      out[s] = opponentMotivationMod();
    });
    return out;
  });
  const stepsOk = steps[0] === 1 && steps[4] === 1 && steps[5] === 1.04 && steps[7] === 1.04
    && steps[8] === 1.08 && steps[11] === 1.08 && steps[12] === 1.12 && steps[20] === 1.12;
  console.log("1) Degraus de opponentMotivationMod batem com a especificação:", stepsOk, JSON.stringify(steps));

  // 2) Carreira nova (sequência 0) simulando uma rodada não mostra o
  // aviso "Adversário motivado" — nenhum efeito fora do gatilho.
  await page.evaluate(() => { CAREER.currentUnbeatenStreak = 0; });
  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(300);
  await page.click("#btnSimulate");
  await page.waitForSelector("#preMatchOverlay.open", { timeout: 5000 });
  await page.click("#btnPreMatchGo");
  await page.waitForSelector("#liveMatchOverlay.open", { timeout: 5000 });
  await page.waitForTimeout(150);
  const toastNoStreak = await page.evaluate(() => {
    const el = document.getElementById("toast");
    return { visible: el.style.display === "flex", title: el.querySelector(".ct-toast-title")?.textContent || null };
  });
  console.log("2) Carreira nova (sem sequência) NÃO mostra aviso de adversário motivado:",
    toastNoStreak.title !== "Adversário motivado", JSON.stringify(toastNoStreak));

  // Termina essa 1ª rodada rápido (pular pro fim) pra liberar a próxima —
  // mesma sequência de modais de sempre (ver test_ao_vivo.js): "Seu
  // jogo" → coletiva (se aparecer) → Notícias → Resultados da rodada →
  // proposta por jogador (se aparecer).
  await page.evaluate(() => { pauseLiveMatch(); skipLiveMatch(); });
  await page.waitForSelector("#matchDetailOverlay.open", { timeout: 5000 });
  await page.click("#btnMatchDetailContinue");
  await page.waitForTimeout(200);
  if (await page.evaluate(() => document.getElementById("pressOverlay").classList.contains("open"))) {
    await page.click("#pressOptions [data-press]");
  }
  await page.waitForSelector("#newsOverlay.open", { timeout: 5000 });
  await page.click("#btnNewsContinue");
  await page.waitForSelector("#roundResultsOverlay.open", { timeout: 5000 });
  await page.click("#btnRoundResultsContinue");
  await page.waitForTimeout(300);
  // Depois de "Continuar", o jogo abre OU a proposta por jogador (se
  // houver uma pendente) OU a Tabela (ver btnRoundResultsContinue em
  // carreira.js) — nunca os 2 juntos, então fecha o que tiver aberto.
  if (await page.waitForSelector("#playerOfferOverlay.open", { timeout: 1200 }).then(() => true).catch(() => false)) {
    await page.click("#playerOfferClose");
    await page.waitForTimeout(200);
  } else if (await page.evaluate(() => document.getElementById("tabelaModalOverlay").classList.contains("open"))) {
    await page.evaluate(() => closeTabelaModal());
    await page.waitForTimeout(200);
  }

  // 3) Forçando uma sequência de invencibilidade longa (>=12) ANTES de
  // simular a próxima rodada, o aviso pré-partida aparece — efeito
  // ligado de verdade ao gatilho, não decorativo.
  await page.evaluate(() => { CAREER.currentUnbeatenStreak = 14; });
  await page.click("#btnSimulate");
  await page.waitForSelector("#preMatchOverlay.open", { timeout: 5000 });
  await page.click("#btnPreMatchGo");
  await page.waitForSelector("#liveMatchOverlay.open", { timeout: 5000 });
  await page.waitForTimeout(150);
  const toastStreak = await page.evaluate(() => {
    const el = document.getElementById("toast");
    return { visible: el.style.display === "flex", title: el.querySelector(".ct-toast-title")?.textContent || null, detail: el.querySelector(".ct-toast-detail")?.textContent || null };
  });
  console.log("3) Sequência de 14 jogos invicto dispara o aviso 'Adversário motivado' antes da partida:",
    toastStreak.title === "Adversário motivado" && /14/.test(toastStreak.detail || ""), JSON.stringify(toastStreak));

  // 4) Nenhuma regressão: a partida com o mecanismo ativo ainda termina
  // normalmente (pular pro fim, rodada avança) e persistCareer() segue
  // funcionando.
  await page.evaluate(() => { pauseLiveMatch(); skipLiveMatch(); });
  await page.waitForTimeout(300);
  const roundAfter = await page.evaluate(() => CAREER.currentRound);
  const persistOk = await page.evaluate(async () => await persistCareer());
  console.log("5) Partida com adversário motivado termina normalmente (rodada avançou) e persistCareer() continua ok:",
    roundAfter >= 2 && persistOk, JSON.stringify({ roundAfter, persistOk }));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
