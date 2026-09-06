// Bloco 2 (brtreinadorbloco2tatica.html): campo hero sem card, chips de
// formação, 4 eixos táticos reais em barra de 5 segmentos, FAB salvar.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `bloco2tatica${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Bloco2 Tatica", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  await page.click(".m3-nav-item[data-panel='escalacao']");
  await page.waitForTimeout(300);

  // 1) Formação em chips (não <select> nenhum) — 4-3-3 marcado como padrão.
  const chips = await page.evaluate(() => {
    const row = [...document.querySelectorAll("#formationChipRow .m3-filter-chip")];
    return { count: row.length, hasSelect: !!document.getElementById("formationSelect"), onChip: row.find((c) => c.classList.contains("on"))?.textContent };
  });
  console.log("1) Formação em chips (sem <select>), uma marcada 'on':", chips.count > 0 && !chips.hasSelect && !!chips.onChip, JSON.stringify(chips));

  // 2) Pitch sem card ao redor — #pitchLines não é filho direto de .mt-card.
  const pitchWrap = await page.evaluate(() => {
    const pl = document.getElementById("pitchLines");
    return { parentIsCard: pl.parentElement.classList.contains("mt-card"), hasPitch: !!pl.querySelector(".mt-pitch") };
  });
  console.log("2) Pitch é hero (pai não é .mt-card), .mt-pitch renderizado:", !pitchWrap.parentIsCard && pitchWrap.hasPitch, JSON.stringify(pitchWrap));

  // 3) "Instruções de jogo" com os 4 eixos certos, cada um com 5
  // segmentos, nível 3 (neutro) por padrão — 3 segmentos "on".
  const axes = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("#tacticAxisRows .m3-instr-row")];
    return rows.map((r) => ({
      axis: r.dataset.axis,
      label: r.querySelector(".m3-instr-label").textContent,
      level: Number(r.dataset.level),
      onCount: r.querySelectorAll(".m3-seg.on").length,
      segCount: r.querySelectorAll(".m3-seg").length,
    }));
  });
  const axesOk = axes.length === 4 && axes.every((a) => a.segCount === 5 && a.level === 3 && a.onCount === 3);
  console.log("3) 4 eixos táticos com 5 segmentos, nível neutro (3) por padrão:", axesOk, JSON.stringify(axes));

  // 4) Clicar no 5º segmento de "Ritmo de jogo" muda o nível pra 5
  // (mas NÃO grava em CAREER ainda, só ao salvar).
  await page.evaluate(() => {
    const row = document.querySelector('#tacticAxisRows .m3-instr-row[data-axis="ritmo"]');
    row.querySelectorAll(".m3-seg")[4].click();
  });
  const afterClick = await page.evaluate(() => {
    const row = document.querySelector('#tacticAxisRows .m3-instr-row[data-axis="ritmo"]');
    return { domLevel: Number(row.dataset.level), domOnCount: row.querySelectorAll(".m3-seg.on").length, careerLevel: CAREER.lineup.tactics.ritmo };
  });
  console.log("4) Clicar no 5º segmento muda o visual pra nível 5, mas CAREER só grava ao Salvar:",
    afterClick.domLevel === 5 && afterClick.domOnCount === 5 && afterClick.careerLevel === 3, JSON.stringify(afterClick));

  // 5) Botão salvar é FAB (position:fixed), não mais barra de ação
  // full-width — e salvar de fato grava o nível 5 em CAREER.
  const fabCheck = await page.evaluate(() => {
    const btn = document.getElementById("btnSaveLineup");
    const isFab = btn.classList.contains("m3-fab");
    const pos = getComputedStyle(btn).position;
    return { isFab, pos };
  });
  console.log("5) Botão salvar é .m3-fab, position:fixed:", fabCheck.isFab && fabCheck.pos === "fixed", JSON.stringify(fabCheck));
  await page.click("#btnSaveLineup");
  await page.waitForTimeout(200);
  const savedLevel = await page.evaluate(() => CAREER.lineup.tactics.ritmo);
  console.log("6) Salvar grava o nível 5 em CAREER.lineup.tactics.ritmo:", savedLevel === 5, savedLevel);

  // 7) Trocar de formação via chip aplica na hora (comportamento
  // imediato, igual o <select> antigo já tinha).
  await page.evaluate(() => {
    const chip = [...document.querySelectorAll("#formationChipRow .m3-filter-chip")].find((c) => c.textContent === "4-4-2");
    if (chip) chip.click();
  });
  await page.waitForTimeout(150);
  const formationAfter = await page.evaluate(() => CAREER.lineup.formation);
  console.log("7) Trocar formação via chip aplica na hora:", formationAfter === "4-4-2", formationAfter);

  await page.screenshot({ path: "screens/bloco2_tatica.png" });

  // 8) Sub-modal de ajuste tático ao vivo também usa os 4 eixos (não
  // mais os 3 <select> antigos) — simula uma rodada e abre a modal.
  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(200);
  await page.click("#btnSimulate");
  await page.waitForSelector("#preMatchOverlay.open", { timeout: 5000 });
  await page.click("#btnPreMatchGo");
  await page.waitForSelector("#liveMatchOverlay.open", { timeout: 5000 }).catch(() => {});
  await page.click("#btnLiveTactics").catch(() => {});
  await page.waitForTimeout(300);
  const liveAxes = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("#liveTacticAxisRows .m3-instr-row")];
    return { count: rows.length, hasOldSelects: !!document.getElementById("liveTacticsMentality") };
  });
  console.log("8) Sub-modal ao vivo com os 4 eixos (sem os <select> antigos):", liveAxes.count === 4 && !liveAxes.hasOldSelects, JSON.stringify(liveAxes));
  await page.screenshot({ path: "screens/bloco2_ajuste_tatico_ao_vivo.png" });

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
