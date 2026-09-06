const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => { console.log("!!! DIALOG NATIVO APARECEU (não deveria mais):", d.message()); d.dismiss(); });
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));

  const base = "http://localhost:8787";
  const email = `confirmmodal${Date.now()}@teste.com`;

  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Confirm Modal", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  // Teste 1: vender jogador (via Mercado) -- desde o Bloco 3 ("Colocar
  // à venda"), vender não usa mais o confirmModal() genérico testado
  // aqui: abre o sheet de anúncio (#listOverlay/data-list), que só vira
  // dinheiro quando uma proposta chega e é aceita (ver
  // test_colocar_a_venda.js) -- pré-existente, sem relação com o
  // checklist de UX desta etapa; o teste nunca foi atualizado. Aqui só
  // confere que abre/cancela sem nenhum diálogo NATIVO aparecer.
  await page.click(".m3-nav-item[data-panel='mercado']");
  await page.waitForTimeout(300);
  const listBtn = await page.$("[data-list]");
  await listBtn.click();
  await page.waitForTimeout(250);
  const listOpenSell = await page.evaluate(() => document.getElementById("listOverlay").classList.contains("open"));
  console.log("Sheet de anúncio (vender) abriu:", listOpenSell);
  await page.screenshot({ path: "print-confirm-vender.png" });
  // Cancela (X do sheet, não confirma o anúncio).
  await page.click("#listClose");
  await page.waitForTimeout(200);
  const closedAfterCancel = await page.evaluate(() => !document.getElementById("listOverlay").classList.contains("open"));
  const cashUnchanged = await page.evaluate(async () => (await (await fetch("/api/career")).json()).career.finances.cash);
  console.log("Fechou ao cancelar:", closedAfterCancel, "| Caixa sem mudar (cancelou de verdade):", cashUnchanged);

  // Teste 2: comprar jogador -- Bloco 3 (pedido do usuário) mudou
  // "Comprar" pra abrir uma NEGOCIAÇÃO (openOfferModal), não mais o
  // confirmModal() genérico testado aqui — não é mais um dos diálogos
  // desse tipo, então só confere que abre a sheet certa (o texto é
  // testado a fundo em test_mercado_negociacao.js) e fecha sem enviar.
  const buyBtns = await page.$$("[data-buy]");
  await buyBtns[buyBtns.length - 1].click();
  await page.waitForTimeout(300);
  const offerSheetOpen = await page.evaluate(() => document.getElementById("offerOverlay").classList.contains("open"));
  console.log("Comprar agora abre a sheet de proposta (não mais confirmModal):", offerSheetOpen);
  await page.click("#offerClose");
  await page.waitForTimeout(300);

  // Teste 3: Reiniciar (menu hambúrguer)
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(200);
  await page.click("#btnRestart");
  await page.waitForTimeout(300);
  const confirmTextRestart = await page.evaluate(() => document.getElementById("confirmText").textContent);
  console.log("Texto confirmação reiniciar:", confirmTextRestart);
  await page.screenshot({ path: "print-confirm-reiniciar.png" });
  await page.click("#confirmCancelBtn"); // cancela, não quer reiniciar de verdade
  await page.waitForTimeout(200);

  // Teste 4: Avançar temporada
  await page.evaluate(async () => {
    const r = await fetch("/api/career");
    const data = await r.json();
    data.career.currentRound = 39;
    await fetch("/api/career", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data.career) });
  });
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(800);
  await page.click("#btnAdvanceSeason");
  await page.waitForTimeout(300);
  const confirmTextSeason = await page.evaluate(() => document.getElementById("confirmText").textContent);
  console.log("Texto confirmação avançar temporada:", confirmTextSeason);
  await page.click("#confirmOkBtn");
  await page.waitForTimeout(500);
  const seasonModalOpen = await page.evaluate(() => document.getElementById("seasonOverlay").classList.contains("open"));
  console.log("Modal de nova temporada abriu depois de confirmar:", seasonModalOpen);
  await page.click("#btnSeasonContinue");
  await page.waitForTimeout(300);

  console.log("--- Nenhum 'DIALOG NATIVO' deve ter aparecido acima ---");

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
