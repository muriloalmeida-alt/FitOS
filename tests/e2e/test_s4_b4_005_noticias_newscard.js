// S4-B4-005 (issue #35) — teste e2e via UI real. Cobre a formalização
// do NewsCard (newsCardHTML(), Product Pattern novo) e a migração de
// tokens da tela de Notícias/Eventos: newsItemHTML() (que já cobria
// sozinha o layout de linha do feed com o shape de dado certo, mesmo
// caminho de PlayerCard) virou newsCardHTML(n) — a manchete em
// destaque, que antes vivia como HTML inline dentro de
// renderNewsScreen() (nunca uma função própria), foi absorvida como a
// variação newsCardHTML(n, {featured:true}) do MESMO componente.
// --mt-gold-400/--mt-gold-600 (destaque dourado) → --m3-secondary,
// --mt-ivory-*/--mt-ink-*/--mt-navy-700 → --m3-on-surface(-variant)/
// --m3-outline-variant. Categorias decorativas (.m3-news-sq.lider/
// zebra/etc, rgba direto) e Bebas Neue do masthead/manchete
// preservados de propósito (cor categórica/BRDATA Extension, mesmo
// critério de .m3-form-dot e Onboarding/Comparar). Nenhuma mudança de
// comportamento (feed navegável, manchete em destaque, filtro por
// rodada atual, resumo financeiro/status do time) — cobertura de
// regressão fica com os 3 testes pré-existentes desta tela
// (test_portal_noticias_premiacoes.js, test_noticias_fullscreen_fluxo.js,
// test_intervalo_noticias_proposta_destino.js).
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `s4b4005${Date.now()}@teste.com`;

  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Noticias M3", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForSelector(".m3-club-row", { timeout: 15000 });
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnOnboardSkip", { timeout: 2000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await page.click("#btnClaimDailyLogin").catch(() => {});
  await page.waitForTimeout(200);

  // Semeia 2 manchetes determinísticas (mesma técnica de
  // test_portal_noticias_premiacoes.js) — 1 "minha" (goleada) + 1
  // genérica mais nova (vira a featured).
  await page.evaluate(() => {
    const teamIds = LEAGUE_TEAMS.map((t) => t.id).filter((id) => String(id) !== String(CAREER.clubId));
    const [A] = teamIds;
    const myId = CAREER.clubId;
    const news1 = generateRoundNews(10, [{ home: myId, away: A, gh: 4, ga: 0 }], cloneStandings(CAREER.standings));
    CAREER.newsFeed = news1.map((n) => ({ ...n, round: 10, seasonYear: CAREER.seasonYear })).concat(CAREER.newsFeed || []);
    const news2 = generateRoundNews(11, [], null);
    CAREER.newsFeed = news2.map((n) => ({ ...n, round: 11, seasonYear: CAREER.seasonYear })).concat(CAREER.newsFeed || []);
    persistCareer();
  });
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='imprensa']");
  await page.click("#btnOpenNews");
  await page.waitForSelector("#newsOverlay.open");
  await page.waitForTimeout(150);

  // 1) newsCardHTML() existe globalmente e devolve HTML consistente
  // pros 2 layouts (featured vs. linha do feed) a partir do MESMO item.
  const contract = await page.evaluate(() => {
    const n = { type: "lider", mine: true, texto: "Teste de contrato", round: 5, seasonYear: 2026 };
    const featuredHtml = newsCardHTML(n, { featured: true });
    const briefHtml = newsCardHTML(n);
    return {
      isFunction: typeof newsCardHTML === "function",
      featuredHasKicker: featuredHtml.includes("m3-news-kicker"),
      featuredHasHeadline: featuredHtml.includes("m3-news-headline") && featuredHtml.includes("Teste de contrato"),
      briefHasSq: briefHtml.includes("m3-news-sq") && briefHtml.includes("Teste de contrato"),
      briefIsMine: briefHtml.includes("m3-news-brief mine"),
    };
  });
  console.log("1) newsCardHTML() formalizado — mesmo item vira featured (kicker+headline) ou linha compacta (sq), conforme a opção:",
    contract.isFunction && contract.featuredHasKicker && contract.featuredHasHeadline && contract.briefHasSq && contract.briefIsMine,
    JSON.stringify(contract));

  // 2) Tela renderizada de verdade usa as classes novas (.m3-news-*),
  // nenhuma .mt-news-kicker/-headline/-brief/-sq restante.
  const rendered = await page.evaluate(() => ({
    hasNewFeatured: !!document.querySelector("#newsFeatured .m3-news-featured"),
    hasNewKicker: !!document.querySelector("#newsFeatured .m3-news-kicker"),
    hasNewBrief: !!document.querySelector("#newsList .m3-news-brief"),
    noneOldClasses: !document.querySelector(".mt-news-kicker, .mt-news-headline, .mt-news-brief, .mt-news-sq"),
  }));
  console.log("2) Tela renderizada usa as classes novas do NewsCard (.m3-news-*), nenhuma .mt-news-* de layout restante:",
    rendered.hasNewFeatured && rendered.hasNewKicker && rendered.hasNewBrief && rendered.noneOldClasses, JSON.stringify(rendered));

  // 3) Tokens migrados: kicker/headline/brief-title resolvem pros
  // --m3-* certos (não mais --mt-gold-400/--mt-ivory-50).
  const tokens = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const kicker = document.querySelector("#newsFeatured .m3-news-kicker");
    const headline = document.querySelector("#newsFeatured .m3-news-headline");
    const briefTitle = document.querySelector("#newsList .m3-news-title");
    return {
      secondary: root.getPropertyValue("--m3-secondary").trim(),
      onSurface: root.getPropertyValue("--m3-on-surface").trim(),
      kickerColor: getComputedStyle(kicker).color,
      headlineColor: getComputedStyle(headline).color,
      briefTitleColor: briefTitle ? getComputedStyle(briefTitle).color : null,
    };
  });
  const hexToRgb = (hex) => { const h = hex.replace("#", ""); const n = parseInt(h, 16); return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`; };
  const kickerOk = tokens.kickerColor === hexToRgb(tokens.secondary);
  const headlineOk = tokens.headlineColor === hexToRgb(tokens.onSurface);
  const briefTitleOk = tokens.briefTitleColor === hexToRgb(tokens.onSurface);
  console.log("3) Tokens migrados — kicker --m3-secondary, headline/título da linha --m3-on-surface (não mais --mt-gold-400/--mt-ivory-50):",
    kickerOk && headlineOk && briefTitleOk, JSON.stringify({ ...tokens, kickerOk, headlineOk, briefTitleOk }));

  // 4) Comportamento preservado: manchete em destaque é a mais nova
  // (genérica, rodada 11), feed abaixo mostra a rodada anterior (10,
  // "minha", destacada).
  const behavior = await page.evaluate(() => ({
    featuredText: document.getElementById("newsFeatured").textContent,
    listHasRound10: document.getElementById("newsList").textContent.includes("Rodada 10"),
    mineBriefExists: !!document.querySelector("#newsList .m3-news-brief.mine"),
  }));
  console.log("4) Comportamento preservado — destaque é a manchete mais nova, feed mostra a rodada anterior com destaque 'mine':",
    behavior.featuredText.includes("Rodada 11") && behavior.listHasRound10 && behavior.mineBriefExists, JSON.stringify(behavior));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
