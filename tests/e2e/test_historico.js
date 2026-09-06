// Verifica a página estática de histórico de atualizações: lista de
// versões, modal de detalhe ao clicar, link no menu hambúrguer.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `historico${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Historico Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  // 1) Link no menu hambúrguer navega pra página nova.
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(200);
  const hasLink = await page.evaluate(() => !!document.querySelector('a[href="historico.html"]'));
  console.log("1) Menu hambúrguer tem o link 'Histórico de Atualizações':", hasLink);
  await page.click('a[href="historico.html"]');
  await page.waitForFunction(() => location.href.includes('historico.html'), { timeout: 8000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(300);

  // 2) Página carrega com as 19 versões, mais recente primeiro.
  const cards = await page.evaluate(() => [...document.querySelectorAll(".version-card .version-tag")].map((el) => el.textContent));
  console.log("2) 19 versões listadas, mais recente primeiro (v2.8):", cards.length === 19 && cards[0] === "v2.8", JSON.stringify(cards));

  // 3) Clicar numa versão abre a modal com os itens certos.
  await page.click(".version-card:nth-child(1)");
  await page.waitForTimeout(150);
  const modalOpen = await page.evaluate(() => document.getElementById("versionOverlay").classList.contains("open"));
  const modalInfo = await page.evaluate(() => ({
    tag: document.getElementById("modalVersionTag").textContent,
    title: document.getElementById("modalTitle").textContent,
    itemCount: document.querySelectorAll("#modalItems li").length,
  }));
  console.log("3) Modal abre com versão/título/itens certos:", modalOpen && modalInfo.tag === "v2.8" && modalInfo.itemCount === 6, JSON.stringify(modalInfo));

  // 4) Fechar a modal (botão rodapé) funciona.
  await page.click("#modalCloseFooter");
  await page.waitForTimeout(150);
  const modalClosed = await page.evaluate(() => !document.getElementById("versionOverlay").classList.contains("open"));
  console.log("4) Modal fecha ao clicar em 'Fechar':", modalClosed);

  // 5) Clicar numa versão diferente mostra os itens certos dessa versão.
  await page.click(".version-card:nth-child(19)"); // v1.0
  await page.waitForTimeout(150);
  const v10 = await page.evaluate(() => ({
    tag: document.getElementById("modalVersionTag").textContent,
    itemCount: document.querySelectorAll("#modalItems li").length,
  }));
  console.log("5) Versão v1.0 mostra os itens certos (11 itens):", v10.tag === "v1.0" && v10.itemCount === 11, JSON.stringify(v10));

  // 6) Botão "Voltar" leva de volta pro Modo Carreira.
  await page.click("#modalClose");
  await page.click("#btnBack");
  await page.waitForFunction(() => location.href.includes('carreira.html'), { timeout: 8000 });
  console.log("6) Botão 'Voltar' leva de volta pro Modo Carreira:", true);

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
