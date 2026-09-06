const { chromium } = require("playwright-core");

async function newCareer(page, base, email) {
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Noticias Test", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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
  await newCareer(page, base, `noticias${Date.now()}@teste.com`);

  const results = await page.evaluate(() => {
    const teamIds = LEAGUE_TEAMS.map((t) => t.id).filter((id) => String(id) !== String(CAREER.clubId));
    const [A, B, C, D, E, F] = teamIds; // 6 times CPU quaisquer, fora o seu

    const out = {};

    // 1) Líder: standingsBefore diz que A NÃO lidera; standings atual
    // (mockado na hora) diz que A lidera.
    const standingsBefore1 = cloneStandings(CAREER.standings);
    standingsBefore1[A] = { ...standingsBefore1[A], pts: 0 };
    standingsBefore1[B] = { ...standingsBefore1[B], pts: 99 }; // B "liderava" antes
    const savedStandings = CAREER.standings;
    CAREER.standings = cloneStandings(CAREER.standings);
    CAREER.standings[A] = { ...CAREER.standings[A], pts: 99 }; // A lidera agora
    CAREER.standings[B] = { ...CAREER.standings[B], pts: 0 };
    const newsLider = generateRoundNews(5, [], standingsBefore1);
    out.lider = newsLider.some((n) => n.type === "lider" && n.texto.includes(teamById(A).name));
    CAREER.standings = savedStandings;

    // 2) Zebra + goleada na mesma partida: acha um par de clubes CPU
    // com diferença real de overall >= 6, força o mais fraco vencendo
    // de goleada.
    let zebraPair = null;
    for (const x of teamIds) for (const y of teamIds) {
      if (x === y) continue;
      const ox = squadAvgOverallOf(x), oy = squadAvgOverallOf(y);
      if (ox != null && oy != null && ox <= oy - 6) { zebraPair = { fraco: x, forte: y }; break; }
      if (zebraPair) break;
    }
    if (zebraPair) {
      const resultZebra = { home: zebraPair.fraco, away: zebraPair.forte, gh: 4, ga: 0 };
      const newsZebra = generateRoundNews(6, [resultZebra], cloneStandings(CAREER.standings));
      out.zebra = newsZebra.some((n) => n.type === "zebra");
      out.goleada = newsZebra.some((n) => n.type === "goleada");
    } else {
      out.zebra = "sem par com gap de overall suficiente pra testar";
      out.goleada = "sem par pra testar goleada junto";
    }

    // 3) Empate defendido: mesmo par (fraco em casa, forte fora), empate.
    if (zebraPair) {
      const resultDraw = { home: zebraPair.fraco, away: zebraPair.forte, gh: 1, ga: 1 };
      const newsDraw = generateRoundNews(7, [resultDraw], cloneStandings(CAREER.standings));
      out.empateDefendido = newsDraw.some((n) => n.type === "empate_defendido");
    } else {
      out.empateDefendido = "sem par pra testar";
    }

    // 4) Jejum quebrado: força streak alto pro time C, C vence D.
    const streakBackup = { ...(CAREER.teamWinlessStreak || {}) };
    CAREER.teamWinlessStreak[String(C)] = 7;
    const resultJejum = { home: C, away: D, gh: 2, ga: 1 };
    const newsJejum = generateRoundNews(8, [resultJejum], cloneStandings(CAREER.standings));
    out.jejum = newsJejum.some((n) => n.type === "jejum_quebrado" && n.texto.includes("7"));
    CAREER.teamWinlessStreak = streakBackup;

    // 5) Lanterna reage: standingsBefore diz que E é o último colocado
    // (20º), E vence F.
    const standingsBeforeLanterna = cloneStandings(CAREER.standings);
    const allIds = Object.keys(standingsBeforeLanterna);
    allIds.forEach((id, i) => { standingsBeforeLanterna[id].pts = 100 - i; }); // ordem qualquer, só != empatado
    standingsBeforeLanterna[String(E)].pts = -999; // garante que E é o 20º (último)
    const resultLanterna = { home: E, away: F, gh: 1, ga: 0 };
    const newsLanterna = generateRoundNews(9, [resultLanterna], standingsBeforeLanterna);
    out.lanterna = newsLanterna.some((n) => n.type === "lanterna_reage");

    // 6) Prioridade: manchete do MEU clube sempre primeiro, mesmo que
    // seja de tipo "menor" (goleada) contra um líder virando em outro
    // jogo (tipo mais prioritário na ordem normal, mas não é meu clube
    // -- goleada só depende do placar, sem incerteza de overall).
    const myId = CAREER.clubId;
    const oppId = teamIds.find((id) => id !== A && id !== B) || A;
    const forcedMineGoleada = { home: myId, away: oppId, gh: 4, ga: 0 };
    const standingsBeforeMisto = cloneStandings(CAREER.standings);
    standingsBeforeMisto[B] = { ...standingsBeforeMisto[B], pts: 99 };
    const standingsAfterMistoBackup = CAREER.standings;
    CAREER.standings = cloneStandings(CAREER.standings);
    CAREER.standings[A] = { ...CAREER.standings[A], pts: 99 };
    CAREER.standings[B] = { ...CAREER.standings[B], pts: 0 };
    const newsMisto = generateRoundNews(10, [forcedMineGoleada], standingsBeforeMisto);
    out.prioridadeMinhaPrimeiro = newsMisto.length > 1 && newsMisto[0].mine === true && newsMisto.some((n) => n.type === "lider" && !n.mine);
    CAREER.standings = standingsAfterMistoBackup;

    // 7) Fallback genérico quando nada dispara.
    const newsVazia = generateRoundNews(11, [], null);
    out.generico = newsVazia.length === 1 && newsVazia[0].type === "generico";

    return out;
  });

  console.log("1) Líder detectado:", results.lider);
  console.log("2) Zebra detectada:", results.zebra, "| Goleada detectada:", results.goleada);
  console.log("3) Empate defendido detectado:", results.empateDefendido);
  console.log("4) Jejum quebrado (7 jogos) detectado:", results.jejum);
  console.log("5) Lanterna reage detectado:", results.lanterna);
  console.log("6) Manchete do meu clube vem primeiro mesmo sendo tipo menos prioritário:", results.prioridadeMinhaPrimeiro);
  console.log("7) Fallback genérico quando nada dispara:", results.generico);

  // 8) Fluxo real via UI -- modal de resultados mostra o bloco de
  // notícias (pelo menos o fallback genérico, nunca vazio).
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
  await page.waitForTimeout(200);
  // AJUSTE (pedido do usuário, revisão das modais de pós-jogo) — a
  // seção "Rádio Data FM" foi removida de Resultados da rodada (a
  // cobertura completa já mora na tela de Notícias, que abre antes
  // dela no mesmo fluxo); o teste agora confirma a AUSÊNCIA da seção.
  const hasNewsSection = await page.evaluate(() => !!document.getElementById("roundResultsNews"));
  console.log("8) Modal de resultados NÃO mostra mais o bloco de notícias (Rádio Data FM, removido):", !hasNewsSection);

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
