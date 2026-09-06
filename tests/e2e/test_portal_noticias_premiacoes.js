const { chromium } = require("playwright-core");

async function newCareer(page, base, email) {
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Portal Test", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
    args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("fonts.googleapis") && !m.text().includes("fundingchoices")) console.log("CONSOLE ERROR:", m.text()); });

  const base = "http://localhost:8787";
  await newCareer(page, base, `portal${Date.now()}@teste.com`);

  // 1) Tela de Notícias vazia mostra estado vazio explicativo.
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='imprensa']");
  await page.click("#btnOpenNews");
  await page.waitForSelector("#newsOverlay.open");
  await page.waitForTimeout(150);
  const emptyState = await page.evaluate(() => ({
    hasMasthead: document.querySelector(".mt-news-masthead .brand").textContent.includes("Jornal do Brasileirão"),
    tagline: document.getElementById("newsTagline").textContent,
    emptyText: document.getElementById("newsList").textContent,
  }));
  console.log("1) Masthead do portal presente:", emptyState.hasMasthead, "| tagline com o clube:", emptyState.tagline.length > 10);
  console.log("   Estado vazio explicativo antes de qualquer rodada:", emptyState.emptyText.includes("Nenhuma notícia"));
  await page.click("#newsClose");
  await page.waitForTimeout(150);

  // 2) Gera manchetes determinísticas via generateRoundNews (mesma
  // técnica de test_noticias_rodada.js) e injeta no feed navegável
  // como finishRoundTail faria, pra testar a tela cheia de verdade.
  const seeded = await page.evaluate(() => {
    const teamIds = LEAGUE_TEAMS.map((t) => t.id).filter((id) => String(id) !== String(CAREER.clubId));
    const [A, B] = teamIds;
    const myId = CAREER.clubId;
    // Rodada 1: notícia "minha" (goleada, só depende do placar).
    const news1 = generateRoundNews(10, [{ home: myId, away: A, gh: 4, ga: 0 }], cloneStandings(CAREER.standings));
    CAREER.newsFeed = news1.map((n) => ({ ...n, round: 10, seasonYear: CAREER.seasonYear })).concat(CAREER.newsFeed || []);
    // Rodada 2 (mais nova): notícia genérica (sem meu clube envolvido).
    const news2 = generateRoundNews(11, [], null);
    CAREER.newsFeed = news2.map((n) => ({ ...n, round: 11, seasonYear: CAREER.seasonYear })).concat(CAREER.newsFeed || []);
    persistCareer();
    return { feedLen: CAREER.newsFeed.length, topType: CAREER.newsFeed[0].type };
  });
  console.log("2) Feed acumulou as 2 rodadas (mais nova primeiro):", seeded.feedLen >= 2 && seeded.topType === "generico");

  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='imprensa']");
  await page.click("#btnOpenNews");
  await page.waitForSelector("#newsOverlay.open");
  await page.waitForTimeout(150);
  const filled = await page.evaluate(() => ({
    featuredText: document.getElementById("newsFeatured").textContent,
    listText: document.getElementById("newsList").textContent,
    hasTag: !!document.querySelector(".mt-news-sq"),
    hasRoundMeta: document.getElementById("newsList").textContent.includes("Rodada 10"),
  }));
  console.log("3) Manchete em destaque preenchida:", filled.featuredText.trim().length > 10);
  console.log("   Feed abaixo mostra a notícia da rodada anterior com round/temporada:", filled.hasRoundMeta);
  console.log("   Quadrado de categoria aparece nos itens do feed:", filled.hasTag);
  await page.click("#newsClose");
  await page.waitForTimeout(150);

  // 4) Fluxo real: simula uma rodada de verdade e confere que o feed
  // navegável ganhou uma entrada nova (além do flash de sempre no
  // modal de resultados).
  const before = await page.evaluate(() => (CAREER.newsFeed || []).length);
  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(300);
  await page.click("#btnSimulate");
  await page.waitForSelector("#preMatchOverlay.open", { timeout: 5000 });
  await page.click("#btnPreMatchGo");
  // AJUSTE (item 4, pedido do usuário: "o jogo deve pausar no
  // intervalo (45) e aguardar que o técnico clique em prosseguir") —
  // clica em "Prosseguir" se o jogo parar no intervalo antes de seguir
  // esperando o resto do fluxo.
  await page.waitForSelector("#liveMatchOverlay.open", { timeout: 5000 }).catch(() => {});
  await page.waitForFunction(() => typeof LIVE_MATCH !== 'undefined' && LIVE_MATCH && (LIVE_MATCH.halftime || LIVE_MATCH.finished), { timeout: 15000 }).catch(() => {});
  if (await page.evaluate(() => typeof LIVE_MATCH !== 'undefined' && LIVE_MATCH && LIVE_MATCH.halftime)) {
    await page.click("#btnLiveContinueSecondHalf");
  }
  await page.waitForSelector("#liveMatchOverlay.open", { timeout: 5000 });
  await page.evaluate(() => skipLiveMatch());
  await page.waitForSelector("#matchDetailOverlay.open", { timeout: 5000 });
  await page.click("#btnMatchDetailContinue");
  await page.waitForTimeout(200);
  if (await page.evaluate(() => document.getElementById("pressOverlay").classList.contains("open"))) {
    await page.click("#pressOptions [data-press]");
  }
  await page.waitForSelector("#newsOverlay.open", { timeout: 5000 });
  await page.click("#btnNewsContinue");
  await page.waitForSelector("#roundResultsOverlay.open");
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => (CAREER.newsFeed || []).length);
  console.log("4) Simular rodada de verdade acrescenta ao feed navegável:", after > before);
  await page.click("#btnRoundResultsContinue").catch(() => {});
  await page.waitForTimeout(200);
  await page.click("#tabelaModalClose").catch(() => {});
  await page.waitForTimeout(200);

  // 5) Premiações: monta uma temporada com título + prêmios individuais
  // do meu clube e confere o design novo (hero de currículo, pódio com
  // escudo, faixa de campeão, prêmios em blocos).
  const award = await page.evaluate(async () => {
    const teamIds = Object.keys(CAREER.leagueSquads);
    const [teamB] = teamIds;
    const myPlayer = CAREER.squad.find((p) => p.origin === "principal");
    myPlayer.goalsSeason = 30; myPlayer.overall = 99; myPlayer.apps = 10;
    CAREER.standings[CAREER.clubId].pts = 999;
    CAREER.standings[teamB].pts = 900;
    CAREER.cup = CAREER.cup || {};
    CAREER.cup.active = true; CAREER.cup.phase = "done"; CAREER.cup.champion = CAREER.clubId;
    CAREER.cup.ties = { final: [{ home: CAREER.clubId, away: teamB, winner: CAREER.clubId }] };
    CAREER.currentRound = 39;
    await advanceSeason();
    return { clubName: CAREER.clubName };
  });
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='progresso']");
  await page.click("#btnOpenAwards");
  await page.waitForSelector("#awardsOverlay.open");
  await page.waitForTimeout(200);
  const awardsUI = await page.evaluate(() => ({
    heroText: document.getElementById("awardsHero").textContent,
    hasChampionCard: !!document.querySelector(".ct-award-season.champion"),
    hasRibbon: !!document.querySelector(".ct-award-season .ribbon"),
    hasPodium: !!document.querySelector(".ct-award-podium .slot"),
    // AJUSTE (redesign "jogo mobile", fase 1) — crestImg() agora sempre
    // devolve um <span class="ct-crest"> (escudo hexagonal via
    // clip-path, ver carreira.html), com ou sem <img> real dentro —
    // antes era <img> OU <div style="border-radius:50%"> direto.
    hasCrestInPodium: !!document.querySelector(".ct-award-podium .slot .ct-crest"),
    hasStatTiles: document.querySelectorAll(".ct-award-stat").length >= 3,
    mineStatHighlighted: !!document.querySelector(".ct-award-stat.mine"),
    minePodiumHighlighted: !!document.querySelector(".ct-award-podium .slot.mine"),
  }));
  console.log("5) Hero mostra total de títulos do currículo:", awardsUI.heroText.includes("🏆") || awardsUI.heroText.includes("Brasileirão"));
  console.log("   Card da temporada campeã tem borda/faixa de destaque:", awardsUI.hasChampionCard && awardsUI.hasRibbon);
  console.log("   Pódio com escudo do clube:", awardsUI.hasPodium && awardsUI.hasCrestInPodium);
  console.log("   Prêmios individuais em blocos (>=3):", awardsUI.hasStatTiles);
  console.log("   Destaque dourado quando o prêmio/pódio é meu:", awardsUI.mineStatHighlighted, awardsUI.minePodiumHighlighted);
  await page.click("#awardsClose");
  await page.waitForTimeout(200);

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
