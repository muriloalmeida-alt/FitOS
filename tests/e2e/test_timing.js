const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
  const base = "http://localhost:8787";
  const email = `timing${Date.now()}@teste.com`;

  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Timing", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });

  await page.goto(base + "/carreira.html", { waitUntil: "load" });
  // O seletor de competição (Série A/B/C) vem ANTES da escolha de
  // clube desde o multi-divisão (pré-existente, sem relação com o
  // checklist de UX desta etapa) -- ".m3-club-row" só existe depois
  // de escolher a competição.
  await page.waitForSelector('.mt-competition-card[data-competition="brasileirao"]');
  const t0 = Date.now();
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(200);
  await page.waitForSelector(".m3-club-row");
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForSelector("#screenGame:not(.hidden)", { timeout: 30000 });
  const t1 = Date.now();
  console.log("Tempo pra criar carreira (buildSquad + buildLeagueSquads pros 20 times):", t1 - t0, "ms");

  // Confere que os leagueSquads foram criados
  const info = await page.evaluate(async () => {
    const r = await fetch("/api/career");
    const data = await r.json();
    const leagueSquads = data.career.leagueSquads || {};
    const counts = Object.entries(leagueSquads).map(([id, squad]) => [id, squad.length]);
    return { numClubs: Object.keys(leagueSquads).length, counts };
  });
  console.log("Clubes com elenco:", info.numClubs);
  console.log("Tamanhos:", JSON.stringify(info.counts));

  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='competicao']");
  await page.click("#btnOpenEstatisticas");
  await page.waitForTimeout(300);
  await page.screenshot({ path: "timing-estatisticas-vazio.png" });

  // Simula uma rodada e reconfere estatísticas
  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(300);
  await page.click("#btnSimulate");
  await page.waitForSelector("#preMatchOverlay.open", { timeout: 5000 });
  await page.click("#btnPreMatchGo");
  await page.waitForSelector("#liveMatchOverlay.open", { timeout: 5000 });
  await page.click("#btnLiveSkip");
  await page.waitForSelector("#matchDetailOverlay.open, #roundResultsOverlay.open", { timeout: 10000 });
  await page.waitForTimeout(300);
  const matchOpen = await page.evaluate(() => document.getElementById("matchDetailOverlay").classList.contains("open"));
  await page.screenshot({ path: "timing-matchmodal.png" });
  if (matchOpen) {
    await page.click("#btnMatchDetailContinue");
    await page.waitForTimeout(300);
    if (await page.evaluate(() => document.getElementById("pressOverlay").classList.contains("open"))) {
      await page.click("#pressOptions [data-press]");
      await page.waitForTimeout(300);
    }
    await page.waitForSelector("#newsOverlay.open", { timeout: 5000 }).catch(() => {});
    if (await page.evaluate(() => document.getElementById("newsOverlay").classList.contains("open"))) {
      await page.click("#btnNewsContinue");
      await page.waitForTimeout(300);
    }
  }
  const resOpen = await page.evaluate(() => document.getElementById("roundResultsOverlay").classList.contains("open"));
  if (resOpen) {
    await page.click("#btnRoundResultsContinue");
    await page.waitForTimeout(300);
    // "Continuar" encadeia pra "Proposta em destaque" quando houver
    // uma, senão direto pra Tabela (mesmo fluxo de sempre) -- resolve
    // qualquer uma das 2 antes de seguir.
    if (await page.evaluate(() => document.getElementById("playerOfferOverlay")?.classList.contains("open"))) {
      await page.click("#btnPlayerOfferDecline");
      await page.waitForTimeout(300);
    }
    if (await page.evaluate(() => document.getElementById("tabelaModalOverlay")?.classList.contains("open"))) {
      await page.click("#tabelaModalClose");
      await page.waitForTimeout(200);
    }
  }

  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='competicao']");
  await page.click("#btnOpenEstatisticas");
  await page.waitForTimeout(300);
  await page.screenshot({ path: "timing-estatisticas-com-dados.png" });

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
