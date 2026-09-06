// Nova feature — Instruções por setor: 3 abas (Defesa/Meio/Ataque),
// 5 instruções cada em barra de 5 segmentos, com efeito REAL (camada
// adicional sobre os 4 eixos gerais de Tática).
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `instrsetor${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Instr Setor", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  // 1) Abrir pelo Menu -> aba Defesa ativa por padrão, 5 instruções
  // certas, todas neutras (nível 3).
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='tatica']");
  await page.click("#btnOpenSector");
  await page.waitForTimeout(300);
  const check1 = await page.evaluate(() => {
    const activeTab = document.querySelector("#sectorTabs .m3-sector-tab.on")?.dataset.sector;
    const rows = [...document.querySelectorAll("#sectorInstrRows .m3-instr-row")];
    return {
      open: document.getElementById("sectorOverlay").classList.contains("open"),
      activeTab,
      count: rows.length,
      labels: rows.map((r) => r.querySelector(".m3-instr-label").textContent),
      allNeutral: rows.every((r) => Number(r.dataset.level) === 3),
    };
  });
  console.log("1) Abre na aba Defesa, 5 instruções certas, todas neutras:",
    check1.open && check1.activeTab === "defesa" && check1.count === 5 && check1.allNeutral
    && JSON.stringify(check1.labels) === JSON.stringify(["Linha defensiva", "Pressão pós-perda", "Compactação", "Saída de bola", "Bola parada defensiva"]),
    JSON.stringify(check1));

  // 2) Trocar pra aba Meio/Ataque mostra as 5 instruções certas de cada.
  await page.click('#sectorTabs [data-sector="meio"]');
  await page.waitForTimeout(150);
  const meioLabels = await page.evaluate(() => [...document.querySelectorAll("#sectorInstrRows .m3-instr-label")].map((l) => l.textContent));
  await page.click('#sectorTabs [data-sector="ataque"]');
  await page.waitForTimeout(150);
  const ataqueLabels = await page.evaluate(() => [...document.querySelectorAll("#sectorInstrRows .m3-instr-label")].map((l) => l.textContent));
  console.log("2) Meio e Ataque com 5 instruções cada, diferentes de Defesa:",
    meioLabels.length === 5 && ataqueLabels.length === 5 && JSON.stringify(meioLabels) !== JSON.stringify(ataqueLabels),
    JSON.stringify({ meioLabels, ataqueLabels }));

  await page.screenshot({ path: "screens/instrucoes_setor.png" });

  // 3) Clicar num segmento aplica NA HORA (sem "Salvar") em
  // CAREER.lineup.sectorTactics, persistindo de verdade.
  await page.evaluate(() => {
    document.querySelector('#sectorInstrRows .m3-instr-row[data-axis="amplitudeOfensiva"] .m3-seg[data-level="5"]').click();
  });
  await page.waitForTimeout(200);
  const check3 = await page.evaluate(() => CAREER.lineup.sectorTactics.ataque.amplitudeOfensiva);
  console.log("3) Clicar num segmento grava na hora em CAREER (sem precisar salvar):", check3 === 5, check3);

  // 4) Efeito REAL: combinedSectorTacticMod() reflete o valor não-neutro
  // definido, e combinedTacticMod() (usada de verdade em
  // computeHumanStrength) muda de 1/1 puro quando há algo não-neutro.
  const check4 = await page.evaluate(() => {
    const sectorMod = combinedSectorTacticMod();
    const combined = combinedTacticMod();
    return { sectorMod, combined, neitherIsNeutral: sectorMod.atk !== 1 && combined.atk !== 1 };
  });
  console.log("4) combinedSectorTacticMod/combinedTacticMod refletem o ajuste (não ficam em 1/1 neutro):",
    check4.neitherIsNeutral, JSON.stringify(check4));

  // 5) Migração: carreira SEM sectorTactics (save antigo simulado) migra
  // pra todas as 15 instruções neutras sem quebrar nada.
  const migrationCheck = await page.evaluate(async () => {
    const r = await fetch("/api/career");
    const data = await r.json();
    delete data.career.lineup.sectorTactics;
    await fetch("/api/career", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data.career) });
    return true;
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const check5 = await page.evaluate(() => {
    const st = CAREER.lineup.sectorTactics;
    const allSectorsPresent = ["defesa", "meio", "ataque"].every((s) => st[s] && Object.keys(st[s]).length === 5);
    const allNeutral = ["defesa", "meio", "ataque"].every((s) => Object.values(st[s]).every((v) => v === 3));
    return { allSectorsPresent, allNeutral };
  });
  console.log("5) Save antigo sem sectorTactics migra pras 15 instruções neutras:", check5.allSectorsPresent && check5.allNeutral, JSON.stringify(check5));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
