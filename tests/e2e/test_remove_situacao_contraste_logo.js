// Pedido do usuário: (1) remover o card "Situação do elenco" da Central;
// (2) ajustar o fundo dos escudos reais pra contraste acessível (chapinha
// clara "gelo" em vez de transparente).
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `situacaocontraste${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Situacao Contraste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  // Série B (não Brasileirão) de propósito: é o único catálogo demo
  // deste sandbox com escudo REAL de verdade (DEMO_TEAMS_SERIE_B, ver
  // "Escudos reais pros 11 clubes da Série B" mais cedo nesta sessão) —
  // o Brasileirão demo local não tem nenhum `logo:` (só o catálogo
  // "frozen" de produção tem, que este sandbox não ativa).
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.click('.mt-competition-card[data-competition="serie_b"]');
  await page.waitForTimeout(300);
  // Goiás tem escudo real no catálogo (ver test_serie_b_escudos.js).
  await page.evaluate(() => {
    const row = [...document.querySelectorAll(".m3-club-row")].find((c) => c.textContent.includes("Goiás"));
    row.click();
  });
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.waitForTimeout(1500);
  await page.click("#btnClaimDailyLogin").catch(() => {});
  await page.waitForTimeout(200);
  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(300);

  // 1) Card "Situação do elenco" não existe mais na Central.
  const check1 = await page.evaluate(() => {
    const bodyText = document.getElementById("panel-central").textContent;
    return {
      hasTitle: bodyText.includes("Situação do elenco"),
      squadKpisExists: !!document.getElementById("squadKpis"),
      seasonYearLabelExists: !!document.getElementById("seasonYearLabel"),
    };
  });
  console.log("1) Card 'Situação do elenco' removido (sem título, sem #squadKpis/#seasonYearLabel):",
    !check1.hasTitle && !check1.squadKpisExists && !check1.seasonYearLabelExists, JSON.stringify(check1));

  // 2) Topbar continua mostrando "Temporada X" (não perdeu a info).
  const check2 = await page.evaluate(() => document.getElementById("topbarClubSub").textContent);
  console.log("2) Topbar continua com 'Temporada X' (info não se perdeu):", /Temporada \d{4}/.test(check2), check2);

  // 3) Card "Próximo jogo" continua funcionando normalmente (não quebrou
  //    nada ao remover o card vizinho).
  const check3 = await page.evaluate(() => !!document.getElementById("nextMatchBox").innerHTML.trim());
  console.log("3) Card 'Próximo jogo' segue funcionando:", check3);

  // 4) Contraste do escudo: pega um clube com logo real (frozen catalog
  //    tem escudo real pros times da Série A) e confere que o fundo do
  //    escudo NÃO é mais transparente -- é a chapinha clara (--mt-ivory-50).
  const crestCheck = await page.evaluate(() => {
    // Acha qualquer .ct-crest.has-logo renderizado na tela agora (Central
    // já mostra o escudo do próximo confronto, que deve ter escudo real
    // se o time tiver -- CAP tem escudo real no catálogo congelado).
    const el = document.querySelector(".ct-crest.has-logo");
    if (!el) return { found: false };
    const bg = getComputedStyle(el).backgroundColor;
    return { found: true, bg };
  });
  console.log("4) Escudo real (.ct-crest.has-logo) tem fundo claro (não transparente):",
    crestCheck.found ? crestCheck.bg !== "rgba(0, 0, 0, 0)" && crestCheck.bg !== "transparent" : "sem escudo real nesta tela",
    JSON.stringify(crestCheck));

  // 5) Topbar crest com escudo real também ganha o fundo claro.
  const topbarCrestCheck = await page.evaluate(() => {
    const el = document.getElementById("topbarClubCrest");
    const hasLogo = el.classList.contains("has-logo");
    const bg = getComputedStyle(el).backgroundColor;
    return { hasLogo, bg };
  });
  console.log("5) Topbar crest (se com escudo real) tem fundo claro:",
    topbarCrestCheck.hasLogo ? (topbarCrestCheck.bg !== "rgba(0, 0, 0, 0)") : "sem escudo real neste clube",
    JSON.stringify(topbarCrestCheck));

  await page.screenshot({ path: "screens/central_sem_situacao_elenco.png" });

  // 6) Escolha do clube: escudo dos clubes com logo real também com fundo
  //    claro (varre a lista inteira).
  await page.evaluate(async () => { await fetch("/api/career", { method: "DELETE" }); });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  await page.click('.mt-competition-card[data-competition="serie_b"]');
  await page.waitForTimeout(300);
  const pickerCheck = await page.evaluate(() => {
    const withLogo = [...document.querySelectorAll(".ct-crest.has-logo")];
    return { count: withLogo.length, allLightBg: withLogo.every((el) => getComputedStyle(el).backgroundColor !== "rgba(0, 0, 0, 0)") };
  });
  console.log("6) Escolha do clube: todos os escudos reais com fundo claro:", pickerCheck.count > 0 && pickerCheck.allLightBg, JSON.stringify(pickerCheck));
  await page.screenshot({ path: "screens/escolha_clube_contraste.png" });

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
