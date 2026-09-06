// Verifica o novo componente de toast: largura fixa (igual ao botão
// "Ir para o jogo"), ícone por tipo, título/detalhe/estatísticas.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `toastcomp${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Toast Componente", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  // 1) Largura de TELA CHEIA + altura FIXA (pedido do usuário: "placar
  // de LED com altura fixa, largura de tela cheia"), ver Opção C do
  // mockup toast-opcoes.html — sem margem nenhuma, encosta nas 2
  // bordas, mesmo tratamento full-bleed que .m3-bottom-nav já usa.
  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(200);
  await page.evaluate(() => toast("Escalação e táticas salvas.", { type: "pos" }));
  await page.waitForTimeout(100);
  const widths = await page.evaluate(() => {
    const toastEl = document.getElementById("toast");
    const r = toastEl.getBoundingClientRect();
    return { left: r.left, rightGap: window.innerWidth - r.right, vw: window.innerWidth, height: r.height };
  });
  console.log("1) Toast em largura de tela cheia (sem margem) e altura fixa (60px):", widths.left === 0 && widths.rightGap === 0 && widths.height === 60, JSON.stringify(widths));

  // 2) Estrutura: ponto colorido (no lugar do ícone-quadrado antigo) +
  // título, classe de tipo certa.
  const s2 = await page.evaluate(() => {
    const el = document.getElementById("toast");
    return {
      hasIconClass: el.classList.contains("pos"),
      hasDot: !!el.querySelector(".ct-toast-dot"),
      title: el.querySelector(".ct-toast-title")?.textContent,
      hasDetail: !!el.querySelector(".ct-toast-detail"),
    };
  });
  console.log("2) Ponto renderizado, classe 'pos' aplicada, título correto, sem detalhe (mensagem simples):", s2.hasIconClass && s2.hasDot && s2.title === "Escalação e táticas salvas." && !s2.hasDetail);

  // 3) Mensagem com " — " quebra sozinha em título + detalhe.
  await page.evaluate(() => toast("Y. Rocha recusou o empréstimo — quer continuar brigando por espaço no elenco principal.", { type: "warn" }));
  await page.waitForTimeout(100);
  const s3 = await page.evaluate(() => {
    const el = document.getElementById("toast");
    return { title: el.querySelector(".ct-toast-title")?.textContent, detail: el.querySelector(".ct-toast-detail")?.textContent, type: el.classList.contains("warn") };
  });
  console.log("3) Mensagem com travessão quebra em título + detalhe (detalhe maiúsculo), tipo 'warn':",
    s3.title === "Y. Rocha recusou o empréstimo" && s3.detail === "Quer continuar brigando por espaço no elenco principal." && s3.type, JSON.stringify(s3));

  // 4) Mensagem com stats (reputação/moral) vira pílulas coloridas.
  await page.evaluate(() => toast({ title: "Coletiva respondida", stats: [{ label: "Reputação", value: 1 }, { label: "Moral do elenco", value: 3 }] }, { type: "pos" }));
  await page.waitForTimeout(100);
  const s4 = await page.evaluate(() => {
    const el = document.getElementById("toast");
    const stats = [...el.querySelectorAll(".ct-toast-stat")].map((s) => s.textContent);
    return { stats, allPos: [...el.querySelectorAll(".ct-toast-stat")].every((s) => s.classList.contains("pos")) };
  });
  console.log("4) Reputação/moral viram 2 pílulas separadas (não mais uma frase só):", s4.stats.length === 2 && s4.stats[0] === "Reputação+1" && s4.stats[1] === "Moral do elenco+3" && s4.allPos, JSON.stringify(s4.stats));

  // 5) Continua acima do chrome fixo (nav/FAB, não regrediu o fix
  // anterior) -- Início não usa mais .mt-action-bar desde a Fundação
  // M3 (virou FAB), checa contra a nav de baixo, sempre presente.
  const s5 = await page.evaluate(() => {
    const el = document.getElementById("toast");
    const nav = document.querySelector(".m3-bottom-nav");
    return { toastBottom: el.getBoundingClientRect().bottom, navTop: nav.getBoundingClientRect().top };
  });
  console.log("5) Toast continua acima da nav fixa (gap >= 0):", s5.navTop - s5.toastBottom >= 0, JSON.stringify(s5));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
