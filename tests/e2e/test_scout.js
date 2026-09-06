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
  const email = `scout${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Scout Test", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  // 1) Determinismo + limites da faixa (rodado direto no client)
  const stats = await page.evaluate(() => {
    const base = CAREER.squad.filter((p) => p.origin === "base");
    return base.map((p) => {
      const r1 = scoutedPotentialRange(p);
      const r2 = scoutedPotentialRange(p);
      return {
        deterministico: r1.lo === r2.lo && r1.hi === r2.hi,
        loMaiorOuIgualOverall: r1.lo >= p.overall,
        hiMenorOuIgual99: r1.hi <= 99,
        loMenorOuIgualHi: r1.lo <= r1.hi,
        potencialDentroDaFaixaOuPerto: p.potential >= r1.lo - 1 && p.potential <= r1.hi + 1, // tolerância de arredondamento
      };
    });
  });
  console.log("1) Checks de", stats.length, "jogadores da base:");
  console.log("   Todos determinísticos:", stats.every((s) => s.deterministico));
  console.log("   Todos com lo >= overall:", stats.every((s) => s.loMaiorOuIgualOverall));
  console.log("   Todos com hi <= 99:", stats.every((s) => s.hiMenorOuIgual99));
  console.log("   Todos com lo <= hi:", stats.every((s) => s.loMenorOuIgualHi));

  // 2) Jogador principal SEM espaço real de crescimento (potential ===
  // overall, ver derivePotentialForAdult -- todo adulto agora tem
  // potential, mas só mostra faixa de olheiro quando ainda há espaço
  // de verdade) não tem faixa.
  const noRangeForReal = await page.evaluate(() => {
    const real = CAREER.squad.find((p) => p.origin === "principal");
    real.potential = real.overall; // força "sem espaço", igual um veterano de verdade
    return scoutedPotentialRange(real) === null;
  });
  console.log("2) Jogador principal sem espaço real de crescimento não tem faixa:", noRangeForReal);

  // 3) Aparece na lista do Elenco (categoria de base)
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.click(".m3-nav-item[data-panel='elenco']");
  await page.waitForTimeout(300);
  const baseRowText = await page.evaluate(() => {
    const list = document.getElementById("squadBaseList");
    return list.querySelector(".m3-list-item").textContent;
  });
  console.log("3) Texto da 1ª linha da base (deve conter 'pot.'):", baseRowText.trim());

  // 4) Aparece no detalhe do jogador
  const baseId = await page.evaluate(() => CAREER.squad.find((p) => p.origin === "base").id);
  await page.click(`#squadBaseList [data-id="${baseId}"]`);
  await page.waitForSelector("#detailOverlay.open");
  await page.waitForTimeout(200);
  const detailText = await page.evaluate(() => document.getElementById("detailBody").textContent);
  console.log("4) Avaliação do olheiro aparece no detalhe:", detailText.includes("Avaliação do olheiro"));
  await page.click("#detailClose");
  await page.waitForTimeout(200);

  // 5) Jogador principal REAL não mostra "Avaliação do olheiro" no detalhe
  const realId = await page.evaluate(() => CAREER.squad.find((p) => p.origin === "principal").id);
  await page.click(".m3-nav-item[data-panel='elenco']");
  await page.waitForTimeout(300);
  await page.click(`#squadMainList [data-id="${realId}"]`);
  await page.waitForSelector("#detailOverlay.open");
  await page.waitForTimeout(200);
  const detailTextReal = await page.evaluate(() => document.getElementById("detailBody").textContent);
  console.log("5) Jogador principal NÃO mostra avaliação do olheiro (deve ser false):", detailTextReal.includes("Avaliação do olheiro"));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
