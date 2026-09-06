const { chromium } = require("playwright-core");

async function newCareer(page, base, email) {
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Cond Ajuda Test", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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
}
async function getCareer(page) {
  return page.evaluate(async () => (await (await fetch("/api/career")).json()).career);
}
async function putCareer(page, career) {
  await page.evaluate(async (career) => {
    await fetch("/api/career", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(career) });
  }, career);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
    args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));

  const base = "http://localhost:8787";
  await newCareer(page, base, `condajuda${Date.now()}@teste.com`);

  // 1) conditionRating()/mtConditionBarHTML() -- checagem direta da
  // função pura. AJUSTE (redesign, Tela 4) — conditionDotsHTML()
  // (ct-cond-dot) foi removida (só existia pro Elenco); mtConditionBarHTML()
  // é quem monta a barra em segmentos hoje, mesma nota 1-5, classes novas.
  const ratingChecks = await page.evaluate(() => ({
    r100: conditionRating(100), r95: conditionRating(95), r75: conditionRating(75),
    r55: conditionRating(55), r35: conditionRating(35), r10: conditionRating(10),
    segs5: (mtConditionBarHTML(100).match(/class="seg on"/g) || []).length,
    isFull5: mtConditionBarHTML(100).includes('mt-condition-bar full'),
    isMid3: mtConditionBarHTML(55).includes('mt-condition-bar mid'),
    isLow1: mtConditionBarHTML(10).includes('mt-condition-bar low'),
  }));
  console.log("1) Faixas de nota corretas:", JSON.stringify(ratingChecks));

  // 2) Elenco mostra barra em segmentos (não mais barra de %) na linha do jogador.
  await page.click(".m3-nav-item[data-panel='elenco']");
  await page.waitForTimeout(300);
  const rowHtml = await page.evaluate(() => document.querySelector("#squadMainList .m3-list-item").outerHTML);
  console.log("2) Linha do Elenco usa mt-condition-bar (não mais ct-cond-track/%):", rowHtml.includes("mt-condition-bar") && !rowHtml.includes("ct-cond-track"));

  // 3) Detalhe do jogador mostra "Condição: N/5 (Label)".
  await page.click("#squadMainList .m3-list-item");
  await page.waitForSelector("#detailOverlay.open");
  await page.waitForTimeout(200);
  const detailText = await page.evaluate(() => document.getElementById("detailBody").textContent);
  console.log("3) Detalhe mostra nota de 1 a 5 (não mais %):", /Condição: \d\/5 \(/.test(detailText), "| não tem mais '%':", !detailText.includes("Condição:") || !/Condição: \d+%/.test(detailText));
  await page.click("#detailClose");
  await page.waitForTimeout(200);

  // 4) Retorno de lesão baixa a condição -- marca um jogador com lesão
  // GRAVE prestes a acabar (outUntilRound == currentRound), condição
  // alta (recuperou descansando), avança 1 rodada e confere que caiu
  // pro teto de "grave" (45).
  let career = await getCareer(page);
  const p = career.squad.find((x) => x.origin === "principal" && !career.lineup.starters.includes(x.id));
  p.status = "contundido"; p.injurySeverity = "grave"; p.outUntilRound = career.currentRound; p.condition = 100;
  await putCareer(page, career);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await page.evaluate(() => { refreshAvailability(CAREER.currentRound + 1); });
  const afterReturn = await page.evaluate((id) => CAREER.squad.find((x) => x.id === id), p.id);
  console.log("4) Retorno de lesão GRAVE baixa condição pro teto (45), mesmo tendo 100 antes:", afterReturn.status === "ok" && afterReturn.condition === 45);

  // 5) Ícone de ajuda -- some por padrão, aparece ao clicar, esconde de novo ao clicar de novo.
  await page.click(".m3-nav-item[data-panel='elenco']");
  await page.waitForTimeout(300);
  const helpBefore = await page.evaluate(() => document.getElementById("helpElencoPrincipal").hidden);
  await page.click('[data-help="helpElencoPrincipal"]');
  await page.waitForTimeout(150);
  const helpAfterClick = await page.evaluate(() => document.getElementById("helpElencoPrincipal").hidden);
  await page.click('[data-help="helpElencoPrincipal"]');
  await page.waitForTimeout(150);
  const helpAfterSecondClick = await page.evaluate(() => document.getElementById("helpElencoPrincipal").hidden);
  console.log("5) Texto de ajuda escondido por padrão:", helpBefore === true, "| aparece ao clicar:", helpAfterClick === false, "| some de novo no 2º clique:", helpAfterSecondClick === true);

  // 6) Outros 4 pontos de ajuda também existem e funcionam (Categoria
  // de base, Instruções táticas, Tabela, Mercado).
  const otherHelps = ["helpCategoriaBase", "helpInstrucoesTaticas", "helpTabelaCarreira", "helpMercado"];
  const allExistHiddenByDefault = await page.evaluate((ids) => ids.every((id) => {
    const el = document.getElementById(id);
    return el && el.hidden === true;
  }), otherHelps);
  console.log("6) Os outros 4 textos de ajuda existem e começam escondidos:", allExistHiddenByDefault);

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
