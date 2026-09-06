// Pedido do usuário: "Quero seguir pelo placar de led com altura fixa,
// largura de tela cheia e que feche ao clicar em cima" — valida o
// novo visual do toast (#toast/.ct-toast) escolhido do mockup de
// comparação (Opção C, toast-opcoes.html).
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
    args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `toastled${Date.now()}@teste.com`;

  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Toast LED", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(300);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.waitForTimeout(700);
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);

  // Nesse ponto o toast do login diário ("Recompensa diária coletada")
  // já deve ter aparecido — usa ele pra validar largura cheia + altura
  // fixa antes de disparar um novo manualmente.
  const geo = await page.evaluate(() => {
    const el = document.getElementById("toast");
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, width: r.width, height: r.height, viewportW: window.innerWidth, visible: getComputedStyle(el).display !== "none" };
  });
  console.log("1) Toast do login diário está visível:", geo.visible);
  console.log("2) Largura de tela cheia (left=0, right=viewport):", geo.left === 0 && Math.round(geo.right) === geo.viewportW, JSON.stringify(geo));
  console.log("3) Altura fixa em 60px:", geo.height === 60);

  // 4) Dispara uma mensagem simples (só título) via toast() e confere
  // que a altura continua EXATAMENTE a mesma (não cresce/encolhe).
  await page.evaluate(() => toast("Contrato assinado com Nike!", { type: "pos" }));
  await page.waitForTimeout(150);
  const h1 = await page.evaluate(() => document.getElementById("toast").getBoundingClientRect().height);
  console.log("4) Altura com mensagem simples (título só) continua 60px:", h1 === 60);

  // 5) Mensagem longa com detalhe (auto-split por " — ") não faz a
  // caixa crescer — texto trunca com reticências em vez de quebrar.
  await page.evaluate(() => toast("Y. Rocha recusou o empréstimo — quer continuar brigando por espaço no elenco principal, um texto propositalmente comprido pra testar o corte.", { type: "warn" }));
  await page.waitForTimeout(150);
  const longMsg = await page.evaluate(() => {
    const el = document.getElementById("toast");
    const detail = el.querySelector(".ct-toast-detail");
    return {
      height: el.getBoundingClientRect().height,
      scrollWidthBiggerThanBox: detail.scrollWidth > detail.getBoundingClientRect().width,
      ellipsis: getComputedStyle(detail).textOverflow,
    };
  });
  console.log("5) Mensagem longa mantém altura fixa (60px) e trunca com ellipsis:", longMsg.height === 60 && longMsg.ellipsis === "ellipsis", JSON.stringify(longMsg));

  // 6) Mensagem composta (stats) também cabe na mesma altura fixa,
  // com as pílulas coloridas certas (pos/neg).
  await page.evaluate(() => toast({ title: "Coletiva respondida", stats: [{ label: "Reputação", value: 1 }, { label: "Moral do elenco", value: -2 }] }, { type: "info" }));
  await page.waitForTimeout(150);
  const stats = await page.evaluate(() => {
    const el = document.getElementById("toast");
    const pills = [...el.querySelectorAll(".ct-toast-stat")].map((p) => ({ text: p.textContent, cls: p.className }));
    return { height: el.getBoundingClientRect().height, pills };
  });
  console.log("6) Mensagem com estatísticas mantém 60px, 2 pílulas (uma pos, uma neg):", stats.height === 60 && stats.pills.length === 2 && stats.pills[0].cls.includes("pos") && stats.pills[1].cls.includes("neg"), JSON.stringify(stats.pills));

  // 7) Fecha ao clicar em cima (sem esperar o timeout automático).
  const visibleBeforeClick = await page.evaluate(() => getComputedStyle(document.getElementById("toast")).display !== "none");
  await page.click("#toast");
  await page.waitForTimeout(100);
  const visibleAfterClick = await page.evaluate(() => getComputedStyle(document.getElementById("toast")).display !== "none");
  console.log("7) Fecha ao clicar em cima:", visibleBeforeClick === true && visibleAfterClick === false);

  // 8) Depois de fechado manualmente, disparar um NOVO toast continua
  // funcionando normalmente (não quebrou nenhum timer/listener).
  await page.evaluate(() => toast("Obra iniciada: Reforma do estádio.", { type: "pos" }));
  await page.waitForTimeout(150);
  const worksAgain = await page.evaluate(() => getComputedStyle(document.getElementById("toast")).display !== "none");
  console.log("8) Continua funcionando depois de fechar manualmente uma vez:", worksAgain);

  // 9) A cor de tipo (borda/brilho) muda de fato entre pos/warn/info
  // (--toast-c calculado por classe).
  const colors = {};
  for (const t of ["pos", "warn", "info"]) {
    await page.evaluate((type) => toast("teste de cor", { type }), t);
    await page.waitForTimeout(80);
    colors[t] = await page.evaluate(() => getComputedStyle(document.getElementById("toast")).borderTopColor);
  }
  const allDifferent = new Set(Object.values(colors)).size === 3;
  console.log("9) Cor da borda muda por tipo (pos/warn/info diferentes entre si):", allDifferent, JSON.stringify(colors));

  await browser.close();
  console.log("OK");
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
