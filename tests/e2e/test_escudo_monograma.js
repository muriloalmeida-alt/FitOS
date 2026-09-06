// Verifica o fallback de monograma em crestImg() (times sem logo real)
// e o tratamento "Opção B" (escudo maior + halo) só no card "Próximo
// jogo" da Central, sem regressão nas outras telas que usam crestImg().
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `escudomono${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Escudo Mono", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(200);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);

  // 1) Central: escudo 72px, com monograma e halo, "Próximo jogo"/nome
  // do time com a cor normal (sem vazamento de tingimento do halo).
  const central = await page.evaluate(() => {
    const spot = document.querySelector(".mt-nextmatch-spot .ct-crest");
    const mono = document.querySelector(".mt-nextmatch-spot .ct-crest-mono");
    const title = document.querySelector(".mt-card-title");
    const name = document.querySelector("#nextMatchBox .n");
    return {
      crestSize: spot ? spot.getBoundingClientRect().width : null,
      monoText: mono ? mono.textContent : null,
      titleColor: getComputedStyle(title).color,
      nameColor: getComputedStyle(name).color,
    };
  });
  console.log("1) Escudo do 'Próximo jogo' em 72px:", central.crestSize === 72, central.crestSize);
  console.log("   Monograma (sigla do clube) renderizado:", !!central.monoText, central.monoText);
  console.log("   Título/nome SEM tingimento do halo (cor normal ivory):", central.titleColor.includes("245") || central.titleColor.includes("232"), central.titleColor, central.nameColor);

  // 2) Tabela: crestImg() padrão (24-32px) continua com monograma,
  // sem o tratamento de halo (só existe em Central).
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='competicao']");
  await page.click("#btnOpenTabela");
  await page.waitForTimeout(300);
  const tabela = await page.evaluate(() => {
    const crest = document.querySelector("#standingsTable .ct-crest, #standingsTableModal .ct-crest, .mt-tr .ct-crest");
    const mono = document.querySelector(".mt-tr .ct-crest-mono");
    const glow = document.querySelector(".mt-tr .mt-nextmatch-glow");
    return { hasCrest: !!crest, hasMono: !!mono, hasGlow: !!glow, monoText: mono ? mono.textContent : null };
  });
  console.log("2) Tabela: escudo com monograma (sem halo, tratamento exclusivo da Central):", tabela.hasCrest && tabela.hasMono && !tabela.hasGlow, JSON.stringify(tabela));

  // 3) Escolha do clube (logout e reabrir o picker por uma carreira nova)
  // -- reaproveita o catálogo local, então também cai no fallback.
  await page.evaluate(() => fetch("/api/career", { method: "DELETE" }));
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(300);
  const picker = await page.evaluate(() => {
    const card = document.querySelector(".m3-club-row");
    const mono = card ? card.querySelector(".ct-crest-mono") : null;
    return { hasCard: !!card, monoText: mono ? mono.textContent : null };
  });
  console.log("3) Escolha do clube: cards com monograma no escudo:", picker.hasCard && !!picker.monoText, picker.monoText);

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
