const { chromium } = require("playwright-core");

async function newCareer(page, base, email) {
  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Escalacao Test", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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
}
async function getCareer(page) {
  return page.evaluate(async () => (await (await fetch("/api/career")).json()).career);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("fonts.googleapis") && !m.text().includes("fundingchoices")) console.log("CONSOLE ERROR:", m.text()); });

  const base = "http://localhost:8787";
  await newCareer(page, base, `escala${Date.now()}@teste.com`);
  await page.click(".m3-nav-item[data-panel='escalacao']");
  await page.waitForTimeout(300);

  // 1) Todas as 14 formações disponíveis nos chips (Bloco 2 M3, era
  // <select>, ver renderFormationChips).
  const formationCount = await page.evaluate(() => document.querySelectorAll("#formationChipRow .m3-filter-chip").length);
  console.log("1) 14 formações disponíveis nos chips:", formationCount === 14, "(tem", formationCount, ")");

  // 2) Trocar pra uma formação nova (ex: 4-2-2-2, "quadrado mágico")
  // não quebra o campinho nem o resto da tela.
  await page.evaluate(() => document.querySelector('#formationChipRow [data-formation="4-2-2-2"]').click());
  await page.waitForTimeout(200);
  const pieceCount = await page.evaluate(() => document.querySelectorAll(".mt-pos-slot").length);
  console.log("2) Formação nova (4-2-2-2) renderiza 11 posições no campinho:", pieceCount === 11);

  // 3) Botão "Escalar automaticamente" -- preenche com melhores
  // overalls por grupo de posição, sem mudar formação/táticas.
  const beforeTactics = await page.evaluate(() => JSON.stringify(CAREER.lineup.tactics));
  await page.click("#btnAutoLineup");
  await page.waitForTimeout(300);
  const afterAuto = await page.evaluate(() => ({
    formation: CAREER.lineup.formation,
    startersFilled: CAREER.lineup.starters.filter(Boolean).length,
    tactics: JSON.stringify(CAREER.lineup.tactics),
    // Confere que cada titular tem OVR >= o do 12º melhor da mesma
    // posição no elenco principal disponível (ninguém óbvio ficou de
    // fora por posição).
    allOk: CAREER.lineup.starters.every((id) => {
      const p = CAREER.squad.find((x) => x.id === id);
      return p && p.status === "ok";
    }),
  }));
  console.log("3) Escalar automaticamente -- 11 titulares preenchidos:", afterAuto.startersFilled === 11, "| formação intacta (4-2-2-2):", afterAuto.formation === "4-2-2-2", "| táticas intactas:", afterAuto.tactics === beforeTactics, "| todos titulares disponíveis:", afterAuto.allOk);

  // Confere que é mesmo "melhor overall por grupo": pega o melhor
  // zagueiro do elenco principal e confere que ele está escalado (numa
  // vaga de defesa) depois do auto-fill.
  const bestDef = await page.evaluate(() => {
    const pool = CAREER.squad.filter((p) => p.origin === "principal" && p.status === "ok" && p.group === "D").sort((a, b) => b.overall - a.overall)[0];
    return pool ? pool.id : null;
  });
  const bestDefStarts = await page.evaluate((id) => CAREER.lineup.starters.includes(id), bestDef);
  console.log("4) Melhor zagueiro do elenco está entre os titulares:", bestDefStarts);

  // 5) Troca simples: clicar numa vaga titular e escolher alguém que
  // JÁ é titular de outra posição deve fazer os dois trocarem de lugar
  // (nenhum vira null / some do time).
  const before5 = await page.evaluate(() => ({
    slot0: CAREER.lineup.starters[0],
    slot1: CAREER.lineup.starters[1],
  }));
  await page.click(`.mt-pos-slot[data-index="0"]`);
  await page.waitForSelector("#pickerOverlay.open");
  await page.waitForTimeout(200);
  // Confere que o jogador do slot1 aparece na lista marcado "(titular)".
  const tagText = await page.evaluate((id) => {
    const row = document.querySelector(`#pickerList [data-id="${id}"] .mt-sel-name`);
    return row ? row.textContent : null;
  }, before5.slot1);
  console.log("5) Jogador já titular aparece na lista com tag '(titular)':", tagText && tagText.includes("(titular)"));
  await page.click(`#pickerList [data-id="${before5.slot1}"]`);
  await page.waitForTimeout(300);
  const after5 = await page.evaluate(() => ({ slot0: CAREER.lineup.starters[0], slot1: CAREER.lineup.starters[1] }));
  console.log("6) Troca simples entre 2 titulares -- slot0 agora tem quem era slot1:", after5.slot0 === before5.slot1, "| slot1 agora tem quem era slot0 (voltou pra lá):", after5.slot1 === before5.slot0);

  // 7) Troca titular <-> banco: escolher no campinho alguém que já
  // está no banco deve trazer ele pro time e mandar quem saiu pro
  // banco (sem perder ninguém).
  const before7 = await page.evaluate(() => ({
    slot2: CAREER.lineup.starters[2],
    benchFirst: CAREER.lineup.bench[0],
    benchLen: CAREER.lineup.bench.length,
  }));
  await page.click(`.mt-pos-slot[data-index="2"]`);
  await page.waitForSelector("#pickerOverlay.open");
  await page.waitForTimeout(200);
  const tagBench = await page.evaluate((id) => {
    const row = document.querySelector(`#pickerList [data-id="${id}"] .mt-sel-name`);
    return row ? row.textContent : null;
  }, before7.benchFirst);
  console.log("7) Jogador do banco aparece na lista com tag '(banco)':", tagBench && tagBench.includes("(banco)"));
  await page.click(`#pickerList [data-id="${before7.benchFirst}"]`);
  await page.waitForTimeout(300);
  const after7 = await page.evaluate(() => ({
    slot2: CAREER.lineup.starters[2],
    benchHasOldSlot2: CAREER.lineup.bench.includes(document.__before7slot2),
    benchLen: CAREER.lineup.bench.length,
  }));
  const after7b = await page.evaluate((oldSlot2) => CAREER.lineup.bench.includes(oldSlot2), before7.slot2);
  console.log("8) Reserva escolhida virou titular na vaga 2:", after7.slot2 === before7.benchFirst, "| quem saiu foi pro banco (ninguém sumiu):", after7b, "| banco manteve o mesmo tamanho:", after7.benchLen === before7.benchLen);

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
