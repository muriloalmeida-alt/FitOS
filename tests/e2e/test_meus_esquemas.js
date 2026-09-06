// Nova feature — Meus esquemas: biblioteca de esquemas táticos
// completos (formação+titulares+banco+táticas juntos).
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `meusesquemas${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Meus Esquemas", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  // 1) Abrir pelo Menu -> estado vazio (nenhum esquema salvo ainda).
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='tatica']");
  await page.click("#btnOpenSchemes");
  await page.waitForTimeout(300);
  const check1 = await page.evaluate(() => ({
    open: document.getElementById("schemesOverlay").classList.contains("open"),
    count: document.getElementById("schemesCountLabel").textContent,
    emptyMsg: document.getElementById("schemesList").textContent.includes("Nenhum esquema salvo"),
  }));
  console.log("1) Abre vazio (nenhum esquema salvo ainda):", check1.open && check1.count.includes("0") && check1.emptyMsg, JSON.stringify(check1));
  await page.click("#schemesClose");
  await page.waitForTimeout(200);

  // 2) Configura uma tática específica na aba Tática, salva como
  // "Retranca fora" -> aparece na lista, marcado ATIVO.
  await page.click(".m3-nav-item[data-panel='escalacao']");
  await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('#formationChipRow [data-formation="5-3-2"]').click());
  await page.evaluate(() => document.querySelector('#tacticAxisRows .m3-instr-row[data-axis="pressao"] .m3-seg[data-level="1"]').click());
  await page.click("#btnSaveLineup"); // comita a tática (pressão=1) em CAREER
  await page.waitForTimeout(200);
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='tatica']");
  await page.click("#btnOpenSchemes");
  await page.waitForTimeout(200);
  await page.click("#btnNewScheme");
  await page.waitForTimeout(150);
  await page.fill("#newSchemeNameInput", "Retranca fora");
  await page.click("#btnConfirmNewScheme");
  await page.waitForTimeout(200);
  const check2 = await page.evaluate(() => {
    const row = document.querySelector('#schemesList .m3-scheme-row');
    return {
      count: document.getElementById("schemesCountLabel").textContent,
      name: row?.querySelector(".m3-scheme-name")?.textContent,
      icon: row?.querySelector(".m3-scheme-icon")?.textContent,
      isActive: row?.classList.contains("active"),
      badge: row?.querySelector(".m3-scheme-badge")?.textContent,
      careerFormation: CAREER.lineup.formation,
      careerPressao: CAREER.lineup.tactics.pressao,
    };
  });
  console.log("2) Salvar 'Retranca fora' aparece na lista, marcado ATIVO, com o esquema 5-3-2:",
    check2.count.includes("1") && check2.name === "Retranca fora" && check2.icon === "5-3-2" && check2.isActive && check2.badge === "ATIVO"
    && check2.careerFormation === "5-3-2" && check2.careerPressao === 1, JSON.stringify(check2));

  // 3) Mexer na formação DEPOIS de salvar desvincula (deixa de estar ATIVO).
  await page.click("#schemesClose");
  await page.waitForTimeout(150);
  await page.evaluate(() => document.querySelector('#formationChipRow [data-formation="4-3-3"]').click());
  await page.waitForTimeout(150);
  const activeAfterEdit = await page.evaluate(() => CAREER.activeSchemeId);
  console.log("3) Trocar a formação depois de salvar desvincula (activeSchemeId volta a null):", activeAfterEdit === null, activeAfterEdit);
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='tatica']");
  await page.click("#btnOpenSchemes");
  await page.waitForTimeout(200);
  const check3 = await page.evaluate(() => {
    const row = document.querySelector('#schemesList .m3-scheme-row');
    return { isActive: row?.classList.contains("active"), hasDelete: !!row?.querySelector(".m3-scheme-delete") };
  });
  console.log("   Esquema salvo não aparece mais marcado ATIVO, ganhou botão de apagar:", !check3.isActive && check3.hasDelete, JSON.stringify(check3));

  // 4) Clicar no esquema salvo (não no botão de apagar) REAPLICA o
  // esquema inteiro (formação 5-3-2 de volta + pressão=1).
  await page.click('#schemesList .m3-scheme-row');
  await page.waitForTimeout(200);
  const check4 = await page.evaluate(() => ({
    formation: CAREER.lineup.formation,
    pressao: CAREER.lineup.tactics.pressao,
    activeSchemeId: CAREER.activeSchemeId,
  }));
  console.log("4) Clicar no esquema reaplica formação+tática por inteiro:", check4.formation === "5-3-2" && check4.pressao === 1 && !!check4.activeSchemeId, JSON.stringify(check4));

  await page.screenshot({ path: "screens/meus_esquemas.png" });

  // 5) Apagar o esquema (confirmação) some da lista e volta ao estado vazio.
  await page.click('#schemesList [data-delete]');
  await page.waitForTimeout(200);
  await page.click("#confirmOkBtn");
  await page.waitForTimeout(200);
  const check5 = await page.evaluate(() => ({
    count: document.getElementById("schemesCountLabel").textContent,
    emptyMsg: document.getElementById("schemesList").textContent.includes("Nenhum esquema salvo"),
    schemesArr: CAREER.tacticalSchemes.length,
  }));
  console.log("5) Apagar o esquema volta ao estado vazio:", check5.count.includes("0") && check5.emptyMsg && check5.schemesArr === 0, JSON.stringify(check5));

  // 6) Limite de esquemas — força 8 esquemas e confere que o 9º é
  // recusado com um aviso, sem estourar o array.
  await page.evaluate(() => {
    for (let i = 0; i < 8; i++) saveTacticalScheme(`Esquema ${i}`);
  });
  await page.click("#schemesClose").catch(() => {});
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='tatica']");
  await page.click("#btnOpenSchemes");
  await page.waitForTimeout(200);
  await page.click("#btnNewScheme");
  await page.waitForTimeout(150);
  await page.fill("#newSchemeNameInput", "Esquema demais");
  await page.click("#btnConfirmNewScheme");
  await page.waitForTimeout(200);
  const check6 = await page.evaluate(() => ({
    total: CAREER.tacticalSchemes.length,
    toastText: document.getElementById("toast")?.textContent || "",
  }));
  console.log("6) Limite de 8 esquemas bloqueia o 9º com aviso:", check6.total === 8 && check6.toastText.toLowerCase().includes("limite"), JSON.stringify(check6));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
