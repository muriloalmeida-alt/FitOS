const { chromium } = require("playwright-core");
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `bloco1reorg${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Reorg Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(300);

  // 1) Confirmar clube só aparece depois de selecionar; clicar 1 vez NÃO inicia a carreira.
  const beforeSelect = await page.evaluate(() => ({
    fabHidden: document.getElementById("btnConfirmClub").classList.contains("hidden"),
    screenPickerVisible: !document.getElementById("screenPicker").classList.contains("hidden"),
  }));
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  const afterSelect = await page.evaluate(() => ({
    fabHidden: document.getElementById("btnConfirmClub").classList.contains("hidden"),
    selectedRow: document.querySelector(".m3-club-row.selected")?.querySelector(".m3-club-name")?.textContent,
    stillOnPicker: !document.getElementById("screenPicker").classList.contains("hidden"),
  }));
  console.log("1) Selecionar NÃO inicia carreira (só marca):", beforeSelect.fabHidden && !afterSelect.fabHidden && afterSelect.stillOnPicker, JSON.stringify({ beforeSelect, afterSelect }));

  await page.click("#btnConfirmClub");
  await page.waitForTimeout(700);
  const afterConfirm = await page.evaluate(() => ({ gameVisible: !document.getElementById("screenGame").classList.contains("hidden") }));
  console.log("2) Confirmar clube inicia a carreira de fato:", afterConfirm.gameVisible);

  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300);

  // 3) Elenco: filter chips existem e filtram.
  await page.click(".m3-nav-item[data-panel='elenco']");
  await page.waitForTimeout(300);
  const chipsBefore = await page.evaluate(() => ({
    chips: [...document.querySelectorAll("#elencoFilterRow .m3-filter-chip")].map((c) => c.textContent),
    baseCardVisible: !document.getElementById("squadBaseCard").classList.contains("hidden"),
    mainCardVisible: !document.getElementById("squadMainCard").classList.contains("hidden"),
  }));
  console.log("3) Chips certos, os 2 cards visíveis em 'Todos':", chipsBefore.chips.length === 4 && chipsBefore.baseCardVisible && chipsBefore.mainCardVisible, JSON.stringify(chipsBefore));

  await page.click('#elencoFilterRow .m3-filter-chip[data-filter="base"]');
  await page.waitForTimeout(150);
  const afterBaseFilter = await page.evaluate(() => ({
    baseCardVisible: !document.getElementById("squadBaseCard").classList.contains("hidden"),
    mainCardVisible: !document.getElementById("squadMainCard").classList.contains("hidden"),
    chipOn: document.querySelector('#elencoFilterRow .m3-filter-chip.on')?.dataset.filter,
  }));
  console.log("4) Filtro 'Base' esconde o principal, mostra só a base:", afterBaseFilter.baseCardVisible && !afterBaseFilter.mainCardVisible && afterBaseFilter.chipOn === "base", JSON.stringify(afterBaseFilter));

  await page.click('#elencoFilterRow .m3-filter-chip[data-filter="titulares"]');
  await page.waitForTimeout(150);
  const afterTitularesFilter = await page.evaluate(() => ({
    rows: document.querySelectorAll("#squadMainList [data-id]").length,
    baseCardVisible: !document.getElementById("squadBaseCard").classList.contains("hidden"),
  }));
  console.log("5) Filtro 'Titulares' mostra só 11 (ou menos) e some com a base:", afterTitularesFilter.rows <= 11 && !afterTitularesFilter.baseCardVisible, JSON.stringify(afterTitularesFilter));

  await page.click('#elencoFilterRow .m3-filter-chip[data-filter="todos"]');
  await page.waitForTimeout(150);

  // 6) Perfil do jogador: barras de atributo em vez de blocos.
  await page.click("#squadMainList [data-id]");
  await page.waitForSelector("#detailOverlay.open");
  await page.waitForTimeout(200);
  const perfil = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("#detailBody .m3-attr-row")];
    return {
      count: rows.length,
      labels: rows.map((r) => r.querySelector(".m3-attr-label").textContent),
      hasOldBlocks: !!document.querySelector("#detailBody .mt-attr-grid"),
      firstFillWidth: rows[0]?.querySelector(".m3-attr-fill")?.style.width,
    };
  });
  console.log("6) Perfil do jogador com 5 barras de atributo (Geral/Ataque/Defesa/Físico/Moral), sem blocos:", perfil.count === 5 && !perfil.hasOldBlocks && perfil.firstFillWidth, JSON.stringify(perfil));

  await page.screenshot({ path: "m3_27_onboarding_selecionado.png" });
  await page.click("#detailClose");
  await page.waitForTimeout(200);
  await page.click(".m3-nav-item[data-panel='elenco']");
  await page.waitForTimeout(300);
  await page.screenshot({ path: "m3_28_elenco_filtros.png" });

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
