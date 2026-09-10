// Testa a migração da tela Perfil do jogador pro Design System novo
// (S4-B2-005, issue #16, última do Batch 2). Cobre só o que foi de
// fato alterado (2 seletores exclusivos de openDetail() que
// duplicavam papel semântico já coberto por --m3-*, seguindo o mesmo
// mapeamento já estabelecido pelo PlayerCard/.m3-li-name em
// S3-DS20-S4-PREP-002): o nome/subtítulo do "hero" do jogador
// (.mt-player-hero-info) e o aviso de teto salarial estourado ao
// promover. As setas de tendência (▲/▼ de atributos e moral, hoje
// --brd-green/--brd-red — um 3º sistema de tokens sem equivalente
// --m3-* já estabelecido em nenhum outro lugar do app) NÃO foram
// alteradas — registradas como divergência em aberto no relatório —
// então não são testadas aqui como "migradas".
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("console", (msg) => { if (msg.type() === "error") console.log("CONSOLE ERROR:", msg.text()); });
  const base = "http://localhost:8787";
  const email = `s4b2005${Date.now()}@teste.com`;

  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "S4B2005 Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  await page.click(".m3-nav-item[data-panel='elenco']");
  await page.waitForTimeout(300);

  // 1) Abre o Perfil de um jogador do elenco principal (openDetail) e
  // confirma que o "hero" (nome + subtítulo) usa --m3-on-surface/
  // --m3-on-surface-variant (era --mt-ivory-50/--mt-ink-muted) — mesmo
  // mapeamento já usado pelo PlayerCard (.m3-li-name/.m3-li-side).
  await page.click("#squadMainList .m3-list-item");
  await page.waitForTimeout(200);
  const hero = await page.evaluate(() => {
    const overlayOpen = document.getElementById("detailOverlay").classList.contains("open");
    const b = document.querySelector("#detailBody .mt-player-hero-info b");
    const span = document.querySelector("#detailBody .mt-player-hero-info span");
    return { overlayOpen, nameColor: b ? getComputedStyle(b).color : null, subColor: span ? getComputedStyle(span).color : null };
  });
  // --m3-on-surface:#E7E2DE = rgb(231,226,222); --m3-on-surface-variant:#CBC5BE = rgb(203,197,190).
  console.log("1) Perfil abre e hero (nome/subtítulo) usa tokens --m3-on-surface/--m3-on-surface-variant:",
    hero.overlayOpen && hero.nameColor === "rgb(231, 226, 222)" && hero.subColor === "rgb(203, 197, 190)", JSON.stringify(hero));

  // 2) Todas as seções esperadas continuam presentes: atributos,
  // condição, histórico por temporada (se houver), relacionamento/
  // moral, salário/contrato/valor, ações.
  const sections = await page.evaluate(() => {
    const body = document.getElementById("detailBody");
    const text = body.textContent;
    return {
      hasAttrs: !!body.querySelector(".m3-attr-bars"),
      hasCondition: /Condição:/.test(text),
      hasRelacionamento: /Relacionamento:/.test(text),
      hasSalario: /Salário:/.test(text),
      hasActions: body.querySelectorAll(".mt-action-list button").length > 0,
    };
  });
  console.log("2) Seções da especificação continuam presentes (atributos/condição/relacionamento/salário/ações):",
    Object.values(sections).every(Boolean), JSON.stringify(sections));

  // 3) Força o teto salarial pra estourar num jogador de base e
  // confirma que o aviso usa --m3-error (era --mt-crimson-400).
  const wageWarning = await page.evaluate(() => {
    const basePlayer = CAREER.squad.find((p) => p.origin === "base");
    if (!basePlayer) return null;
    CAREER.finances.wageCap = 1; // qualquer promoção estoura
    openDetail(basePlayer.id);
    const el = [...document.querySelectorAll("#detailBody .mt-info-line")].find((p) => p.textContent.includes("acima do teto"));
    return el ? getComputedStyle(el).color : null;
  });
  console.log("3) Aviso de teto salarial estourado usa --m3-error (não mais --mt-crimson-400):",
    wageWarning === "rgb(255, 84, 73)", wageWarning);

  await page.screenshot({ path: "s4_b2_005_perfil_hero.png" }).catch(() => {});

  // 4) Preservação funcional: fechar o Perfil e reabrir outro jogador
  // continua funcionando (nenhuma mudança de regra nesta demanda).
  const stillWorks = await page.evaluate(() => {
    document.getElementById("detailOverlay").classList.remove("open");
    const otherId = CAREER.squad.find((p) => p.origin === "principal")?.id;
    if (otherId) openDetail(otherId);
    return { reopened: document.getElementById("detailOverlay").classList.contains("open"), nameShown: document.querySelector("#detailBody .mt-player-hero-info b")?.textContent };
  });
  console.log("4) Fechar e reabrir o Perfil de outro jogador continua funcionando:",
    stillWorks.reopened && !!stillWorks.nameShown, JSON.stringify(stillWorks));

  await browser.close();
})();
