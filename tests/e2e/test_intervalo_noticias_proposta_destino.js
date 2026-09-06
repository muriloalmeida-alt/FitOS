const { chromium } = require("playwright-core");

async function newCareer(page, base, email) {
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Batch Test", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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
  await newCareer(page, base, `batch${Date.now()}@teste.com`);

  // ---------- 4) Pausa no intervalo (45') ----------
  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(300);
  await page.click("#btnSimulate");
  await page.waitForSelector("#preMatchOverlay.open", { timeout: 5000 });
  await page.click("#btnPreMatchGo");
  await page.waitForSelector("#liveMatchOverlay.open", { timeout: 5000 });
  await page.waitForFunction(() => LIVE_MATCH && LIVE_MATCH.halftime === true, { timeout: 20000 });
  const halftimeState = await page.evaluate(() => ({
    paused: LIVE_MATCH.paused === true,
    bannerVisible: !document.getElementById("liveHalftimeBanner").classList.contains("hidden"),
    minuteText: document.getElementById("liveMatchMinute") ? document.getElementById("liveMatchMinute").textContent : (document.querySelector("[id*='inute']") ? "?" : "n/a"),
  }));
  console.log("4) Jogo pausa no intervalo (45'):", halftimeState.paused);
  console.log("   Banner de intervalo aparece:", halftimeState.bannerVisible);

  // não resume sozinho depois de esperar um pouco
  await page.waitForTimeout(1500);
  const stillPaused = await page.evaluate(() => LIVE_MATCH.halftime === true && LIVE_MATCH.paused === true);
  console.log("   Continua pausado sem clicar em nada:", stillPaused);

  // clicar em "Prosseguir" retoma o jogo
  await page.click("#btnLiveContinueSecondHalf");
  await page.waitForTimeout(300);
  const resumedState = await page.evaluate(() => ({
    halftime: LIVE_MATCH.halftime === true,
    bannerHidden: document.getElementById("liveHalftimeBanner").classList.contains("hidden"),
  }));
  console.log("   'Prosseguir' tira do intervalo e some com o banner:", !resumedState.halftime && resumedState.bannerHidden);

  // deixa terminar o jogo (pular pro fim ignora pausas)
  await page.click("#btnLiveSkip").catch(() => {});
  await page.waitForSelector("#matchDetailOverlay.open", { timeout: 15000 });
  console.log("   Jogo termina normalmente depois do intervalo:", true);

  // ---------- 5) Notícias no fluxo pós-jogo mostram só 3 da rodada ----------
  await page.click("#btnMatchDetailContinue").catch(async () => {
    // pode já ter ido direto pra coletiva/notícias dependendo do fluxo
  });
  await page.waitForTimeout(400);
  // avança por coletiva se aparecer
  const pressOpen = await page.evaluate(() => document.getElementById("pressOverlay").classList.contains("open"));
  if (pressOpen) { await page.click("#pressClose"); await page.waitForTimeout(400); }
  const newsOpen = await page.waitForSelector("#newsOverlay.open", { timeout: 5000 }).then(() => true).catch(() => false);
  console.log("5) Tela de notícias abre em tela cheia no fluxo pós-jogo:", newsOpen);
  if (newsOpen) {
    const newsRoundState = await page.evaluate(() => {
      const items = document.querySelectorAll("#newsFeatured, #newsList .ct-news-item");
      return { count: document.querySelectorAll("#newsFeatured .headline").length + document.querySelectorAll("#newsList .ct-news-item").length };
    });
    console.log("   Mostra no máximo 3 manchetes da rodada:", newsRoundState.count <= 3 && newsRoundState.count >= 1);
    await page.click("#btnNewsContinue");
    await page.waitForTimeout(400);
  }

  // Abrir pelo menu deve mostrar o histórico completo (sem limite de 3)
  const roundResultsOpenAfterNews = await page.evaluate(() => document.getElementById("roundResultsOverlay").classList.contains("open"));
  console.log("   Depois de notícias, segue pro modal de Resultados:", roundResultsOpenAfterNews);

  // ---------- 6) Proposta recebida em destaque ----------
  // força uma proposta pendente e reabre o fluxo pra checar o modal de destaque
  await page.evaluate(() => {
    const p = CAREER.squad.find((x) => x.origin === "principal");
    const club = LEAGUE_TEAMS.find((t) => String(t.id) !== String(CAREER.clubId));
    CAREER.pendingOffer = { playerId: p.id, playerName: p.name, clubId: String(club.id), clubName: club.name, fee: 5000000, round: CAREER.currentRound };
  });
  // fecha resultados se estiver aberto e clica em continuar de novo (simulação já rolou uma vez)
  const resultsOpen = await page.evaluate(() => document.getElementById("roundResultsOverlay").classList.contains("open"));
  if (!resultsOpen) {
    // gera manualmente o card e clica continuar simulando o fluxo real via central
    await page.evaluate(() => { document.getElementById("roundResultsOverlay").classList.add("open"); });
  }
  await page.click("#btnRoundResultsContinue");
  await page.waitForSelector("#playerOfferOverlay.open", { timeout: 5000 });
  const offerModalState = await page.evaluate(() => ({
    text: document.getElementById("playerOfferText").textContent,
    tabelaNotOpenYet: !document.getElementById("tabelaModalOverlay").classList.contains("open"),
  }));
  console.log("6) Proposta recebida abre modal de destaque com ação imediata:", offerModalState.text.length > 0 && offerModalState.tabelaNotOpenYet);

  // X fecha o modal mas segue o fluxo pra Tabela mesmo assim
  await page.click("#playerOfferClose");
  await page.waitForTimeout(300);
  const afterXState = await page.evaluate(() => ({
    offerClosed: !document.getElementById("playerOfferOverlay").classList.contains("open"),
    tabelaOpen: document.getElementById("tabelaModalOverlay").classList.contains("open"),
    offerStillPending: !!CAREER.pendingOffer,
  }));
  console.log("   X fecha sem decidir mas ainda segue o fluxo pra Tabela:", afterXState.offerClosed && afterXState.tabelaOpen);
  console.log("   Proposta continua pendente pra decidir depois:", afterXState.offerStillPending);
  await page.click("#tabelaModalClose");

  // Aceitar pelo modal de fato resolve a proposta
  await page.evaluate(() => { document.getElementById("roundResultsOverlay").classList.add("open"); });
  await page.click("#btnRoundResultsContinue");
  await page.waitForSelector("#playerOfferOverlay.open", { timeout: 5000 });
  const cashBefore = await page.evaluate(() => CAREER.finances.cash);
  await page.click("#btnPlayerOfferAccept");
  await page.waitForTimeout(300);
  const acceptState = await page.evaluate(() => ({
    pendingCleared: !CAREER.pendingOffer,
    cashIncreased: CAREER.finances.cash > 0,
    tabelaOpen: document.getElementById("tabelaModalOverlay").classList.contains("open"),
  }));
  console.log("   Aceitar no modal resolve a proposta e segue pra Tabela:", acceptState.pendingCleared && acceptState.tabelaOpen);
  await page.click("#tabelaModalClose");

  // ---------- 7) Confirmação de venda/empréstimo mostra o clube destino ----------
  await page.click(".m3-nav-item[data-panel='elenco']");
  await page.waitForTimeout(300);
  const sellDestId = await page.evaluate(() => {
    const p = CAREER.squad.filter((x) => x.origin === "principal")[2];
    p.overall = 60; p.age = 27; // não recusa por destaque
    return p.id;
  });
  await page.click(`[data-id="${sellDestId}"]`);
  await page.waitForSelector("#detailOverlay.open");
  await page.waitForTimeout(200);

  // intercepta confirmModal via avaliação: dispara "sell" e checa o texto exposto no confirm modal
  const sellConfirmText = await page.evaluate(async (id) => {
    // como confirmModal usa uma Promise resolvida por clique, aqui só
    // verificamos que o texto do modal de confirmação contém "pro "
    // (nome do clube) antes de decidir clicar em cancelar.
    return new Promise((resolve) => {
      const orig = window.confirmModal;
      window.confirmModal = async (text, label) => {
        resolve(text);
        return false; // cancela pra não mexer no estado
      };
      handlePlayerAction(id, "sell").finally(() => { window.confirmModal = orig; });
      setTimeout(() => resolve(null), 2000);
    });
  }, sellDestId);
  console.log("7) Confirmação de venda mostra o clube de destino:", !!sellConfirmText && / pro /.test(sellConfirmText));
  await page.click("#detailClose").catch(() => {});

  // Empréstimo: abrir o modal já mostra o clube destino no subtítulo
  await page.click(".m3-nav-item[data-panel='elenco']");
  await page.waitForTimeout(300);
  const loanDestId = await page.evaluate(() => {
    const p = CAREER.squad.filter((x) => x.origin === "principal")[3];
    p.overall = 58; p.age = 27; // não recusa por destaque
    return p.id;
  });
  await page.click(`[data-id="${loanDestId}"]`);
  await page.waitForSelector("#detailOverlay.open");
  await page.waitForTimeout(200);
  const loanBtn = await page.$('[data-act="loanout"]');
  let loanOpened = false, loanSubText = "";
  for (let i = 0; i < 15 && !loanOpened; i++) {
    await page.click('[data-act="loanout"]').catch(() => {});
    await page.waitForTimeout(200);
    loanOpened = await page.evaluate(() => document.getElementById("loanOverlay").classList.contains("open"));
    if (!loanOpened) continue;
    loanSubText = await page.evaluate(() => document.getElementById("loanSub").textContent);
    break;
  }
  console.log("   Modal de empréstimo mostra o clube de destino no subtítulo:", loanOpened && / para o /.test(loanSubText));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
