// Testa o componente Skeleton M3 (.m3-skeleton*, S3-DS20-S4-PREP-001,
// issue #10). Diferente de Dialog/Bottom Sheet, não é um overlay com
// estado — é um helper que devolve HTML (m3SkeletonHTML()), no mesmo
// padrão de attrBarHTML/crestImg já usado no resto do arquivo. Cobre
// as 3 variantes (text/block/circle), a última linha de texto mais
// curta (evita parecer um bloco reto), a keyframe de shimmer aplicada,
// e o respeito a prefers-reduced-motion (S3.1 §38 — nenhum requisito
// de acessibilidade tratado como atividade posterior).
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("console", (msg) => { if (msg.type() === "error") console.log("CONSOLE ERROR:", msg.text()); });
  const base = "http://localhost:8787";
  const email = `m3skel${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "M3 Skeleton Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(300);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnOnboardSkip", { timeout: 2000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300);

  // Injeta um container de teste na tela pra renderizar as 3 variantes
  // (não existe nenhum ponto de integração real ainda — fora de
  // escopo desta demanda, ver especificação).
  await page.evaluate(() => {
    const div = document.createElement("div");
    div.id = "m3SkeletonTestHost";
    div.innerHTML = `
      <div id="skelText">${window.m3SkeletonHTML("text", 3)}</div>
      <div id="skelBlock">${window.m3SkeletonHTML("block")}</div>
      <div id="skelCircle">${window.m3SkeletonHTML("circle")}</div>`;
    document.body.appendChild(div);
  });

  // 1) Variante "text" com count=3: 3 linhas, só a última mais curta
  // (70%) — as 2 primeiras não têm width inline nenhum.
  const textVariant = await page.evaluate(() => {
    const lines = [...document.querySelectorAll("#skelText .m3-skeleton-text")];
    return { count: lines.length, lastWidth: lines[2]?.style.width, firstWidth: lines[0]?.style.width };
  });
  console.log("1) Skeleton texto: 3 linhas, só a última com width:70%:",
    textVariant.count === 3 && textVariant.lastWidth === "70%" && !textVariant.firstWidth,
    JSON.stringify(textVariant));

  // 2) Variantes "block" e "circle" existem com as classes certas.
  const otherVariants = await page.evaluate(() => ({
    hasBlock: !!document.querySelector("#skelBlock .m3-skeleton.m3-skeleton-block"),
    hasCircle: !!document.querySelector("#skelCircle .m3-skeleton.m3-skeleton-circle"),
  }));
  console.log("2) Variantes block/circle existem:", otherVariants.hasBlock && otherVariants.hasCircle, JSON.stringify(otherVariants));

  await page.screenshot({ path: "m3_skeleton_01_variants.png" }).catch(() => {});

  // 3) Shimmer aplicado (keyframe m3Shimmer no ::after) por padrão.
  const shimmerAnim = await page.evaluate(() => {
    const el = document.querySelector("#skelBlock .m3-skeleton-block");
    return getComputedStyle(el, "::after").animationName;
  });
  console.log("3) Shimmer (keyframe m3Shimmer) aplicado por padrão:", shimmerAnim === "m3Shimmer", shimmerAnim);

  // 4) prefers-reduced-motion: reduce desativa a animação (S3.1 §38 —
  // acessibilidade não é atividade posterior).
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(100);
  const shimmerReduced = await page.evaluate(() => {
    const el = document.querySelector("#skelBlock .m3-skeleton-block");
    return getComputedStyle(el, "::after").animationName;
  });
  console.log("4) prefers-reduced-motion:reduce desativa o shimmer:", shimmerReduced === "none", shimmerReduced);

  await browser.close();
})();
