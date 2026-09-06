// Verifica os 2 pedidos:
// 1) Botão "Simular rodada" da Central virou "Ir para o jogo", com o
//    mesmo estilo (.mt-btn-primary-gold) dos demais botões "Ir para o
//    jogo" já existentes.
// 2) Info de salários pagos/patrocínio/caixa saiu de "Resultados da
//    rodada" e passou a aparecer no cartão-resumo da tela de Notícias.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `irprojogo${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Ir Pro Jogo", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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
  await page.evaluate(() => {
    Object.keys(PRESS_CHANCE_BY_ID).forEach((k) => { PRESS_CHANCE_BY_ID[k] = 0; });
    PRESS_ALWAYS_IDS.clear();
  });

  // 1) Botão da Central.
  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(200);
  const btn1 = await page.evaluate(() => {
    const b = document.getElementById("btnSimulate");
    const gold = document.getElementById("btnPreMatchGo"); // referência de estilo já existente
    return {
      text: b.textContent.trim(),
      hasGoldClass: b.classList.contains("mt-btn-primary-gold"),
      hasGreenClass: b.classList.contains("mt-btn-primary"),
      sameClassAsReference: b.className === gold.className,
    };
  });
  console.log("1) Botão da Central agora diz 'Ir para o jogo':", btn1.text === "Ir para o jogo");
  console.log("   Tem a classe .mt-btn-primary-gold (mesmo estilo dos outros 'Ir para o jogo'), sem a verde antiga:", btn1.hasGoldClass && !btn1.hasGreenClass);

  // 2) Fluxo completo até Notícias — confere a linha financeira lá.
  await page.click("#btnSimulate");
  await page.waitForSelector("#preMatchOverlay.open", { timeout: 5000 });
  await page.click("#btnPreMatchGo");
  await page.waitForSelector("#liveMatchOverlay.open", { timeout: 5000 });
  await page.evaluate(() => skipLiveMatch());
  await page.waitForSelector("#matchDetailOverlay.open", { timeout: 5000 });
  await page.click("#btnMatchDetailContinue");
  await page.waitForTimeout(200);
  if (await page.evaluate(() => document.getElementById("pressOverlay").classList.contains("open"))) {
    await page.click("#pressOptions [data-press]");
    await page.waitForTimeout(200);
  }
  await page.waitForSelector("#newsOverlay.open", { timeout: 5000 });

  const newsFinance = await page.evaluate(() => document.getElementById("newsFinanceRow").textContent);
  console.log("2) Notícias mostra a linha financeira (salários pagos):", newsFinance.includes("Salários pagos"));
  console.log("   ...e a caixa restante:", newsFinance.includes("Caixa"));

  await page.click("#btnNewsContinue");
  await page.waitForSelector("#roundResultsOverlay.open", { timeout: 5000 });
  const roundResultsState = await page.evaluate(() => ({
    hasFinanceEl: !!document.getElementById("roundResultsFinance"),
    bodyText: document.querySelector("#roundResultsOverlay .ct-modal-body").textContent,
  }));
  console.log("3) Resultados da rodada NÃO tem mais a info financeira (elemento removido):", !roundResultsState.hasFinanceEl);
  console.log("   ...e o texto 'Salários pagos' não aparece mais lá:", !roundResultsState.bodyText.includes("Salários pagos"));

  // 4) Abrindo Notícias pelo menu (consulta, fora do pós-jogo) a linha
  // financeira fica vazia (não é dado que faz sentido fora do momento
  // exato da rodada que acabou de rolar).
  await page.click("#btnRoundResultsCloseFooter").catch(() => {});
  await page.waitForTimeout(150);
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='imprensa']");
  await page.click("#btnOpenNews");
  await page.waitForSelector("#newsOverlay.open");
  await page.waitForTimeout(150);
  const financeOutsideFlow = await page.evaluate(() => document.getElementById("newsFinanceRow").innerHTML.trim());
  console.log("4) Notícias aberta pelo menu (consulta) não mostra linha financeira de rodada nenhuma (vazia):", financeOutsideFlow === "");

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
