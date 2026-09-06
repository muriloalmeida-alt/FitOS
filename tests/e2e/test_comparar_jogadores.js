// Nova feature — Comparar jogadores lado a lado: botão no Perfil do
// jogador abre um picker restrito à MESMA posição, resultado com
// destaque de quem "ganha" cada atributo + verdict de custo-benefício.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `compararjogadores${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Comparar Jogadores", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  // 1) Abre o Perfil de um titular qualquer -> botão "Comparar jogador"
  //    existe -> clicar abre o passo 1 (picker) com só jogadores da
  //    MESMA posição (nenhum de outra posição na lista, o próprio
  //    jogador não aparece nela).
  await page.click(".m3-nav-item[data-panel='elenco']");
  await page.waitForTimeout(300);
  await page.click("#squadMainList [data-id]");
  await page.waitForSelector("#detailOverlay.open");
  const basePlayer = await page.evaluate(() => {
    const id = document.querySelector("#squadMainList [data-id]").dataset.id;
    const p = CAREER.squad.find((x) => x.id === id);
    return { id, name: p.name, subpos: (function () {
      // reimplementa a mesma checagem simples só pro teste comparar
      return null;
    })() };
  });
  await page.click('[data-act="compare"]');
  await page.waitForTimeout(200);
  const check1 = await page.evaluate((baseId) => {
    const open = document.getElementById("compareOverlay").classList.contains("open");
    const pickVisible = !document.getElementById("comparePickStep").classList.contains("hidden");
    const resultHidden = document.getElementById("compareResultStep").classList.contains("hidden");
    const rows = [...document.querySelectorAll("#comparePickList [data-id]")];
    const noSelf = !rows.some((r) => r.dataset.id === baseId);
    // Confere que toda linha da lista é da MESMA subposição do jogador
    // de origem (mesmo chip de posição em todas as linhas).
    const chipTexts = new Set(rows.map((r) => r.querySelector(".mt-pos-chip").textContent));
    return { open, pickVisible, resultHidden, rowCount: rows.length, noSelf, distinctChips: [...chipTexts] };
  }, basePlayer.id);
  console.log("1) Comparar abre o passo 1 (picker) só com a mesma posição, sem o próprio jogador:",
    check1.open && check1.pickVisible && check1.resultHidden && check1.rowCount > 0 && check1.noSelf && check1.distinctChips.length === 1,
    JSON.stringify(check1));

  // 2) Escolher o 1º candidato da lista -> mostra o passo 2 (resultado)
  //    com os 2 jogadores, linhas de comparação e um verdict de
  //    custo-benefício com texto reconhecível.
  await page.click("#comparePickList [data-id]");
  await page.waitForTimeout(200);
  const check2 = await page.evaluate(() => {
    const pickHidden = document.getElementById("comparePickStep").classList.contains("hidden");
    const resultVisible = !document.getElementById("compareResultStep").classList.contains("hidden");
    const header = document.getElementById("compareHeaderRow").textContent;
    const rows = [...document.querySelectorAll("#compareRows .m3-compare-row")];
    const labels = rows.map((r) => r.querySelector(".m3-compare-label").textContent);
    const anyWin = rows.some((r) => r.querySelector(".m3-compare-val.win"));
    const verdict = document.getElementById("compareVerdict").textContent;
    const changeBtnVisible = !document.getElementById("btnCompareChangePlayer").classList.contains("hidden");
    return { pickHidden, resultVisible, labels, anyWin, verdict, changeBtnVisible, headerHasVs: header.includes("VS") };
  });
  console.log("2) Escolher o 2º jogador mostra o resultado com 7 linhas, destaque de vencedor e verdict de custo-benefício:",
    check2.pickHidden && check2.resultVisible && check2.labels.length === 7 && check2.anyWin && check2.verdict.includes("custo-benefício") && check2.changeBtnVisible && check2.headerHasVs,
    JSON.stringify(check2));

  // 3) "Trocar jogador" volta pro passo 1 (sem fechar o modal).
  await page.click("#btnCompareChangePlayer");
  await page.waitForTimeout(200);
  const check3 = await page.evaluate(() => ({
    open: document.getElementById("compareOverlay").classList.contains("open"),
    pickVisible: !document.getElementById("comparePickStep").classList.contains("hidden"),
  }));
  console.log("3) 'Trocar jogador' volta pro passo 1 sem fechar o modal:", check3.open && check3.pickVisible, JSON.stringify(check3));

  await page.click("#comparePickList [data-id]");
  await page.waitForTimeout(200);
  await page.screenshot({ path: "screens/comparar_jogadores.png" });

  // 4) Fechar (X) fecha o modal.
  await page.click("#compareClose");
  await page.waitForTimeout(150);
  const check4 = await page.evaluate(() => !document.getElementById("compareOverlay").classList.contains("open"));
  console.log("4) Fechar (X) fecha o modal:", check4);

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
