// GE-COPA-001 (issue #28) — teste REESCRITO nesta demanda. Antes desta
// mudança, toda carreira nova tinha uma Copa de 16 clubes/jogo único
// que fechava/pulava fase inteira num ÚNICO clique de "Simular
// rodada" (por isso o teste original saltava currentRound direto via
// API) — agora TODA carreira nova (sistema de divisões sempre ativo)
// nasce com a Copa EXPANDIDA (60 clubes, ida e volta), que exige as
// rodadas passarem em ORDEM (a perna de volta depende da de ida já
// resolvida — pular rodada quebra esse encadeamento, e o jogo de
// verdade NUNCA pula rodada, só avança 1 de cada vez). Passos
// adaptados pra avançar rodada a rodada de verdade (mesma função
// resolveRoundInstant que "Simular rodada" chama, mais
// maybeStartPendingCupLegLive/skipLiveMatch quando o confronto do
// técnico vira ao vivo — reaproveita exatamente o que
// tests/e2e/sim_ge_copa_001.js já validou em escala; este teste foca
// na REPRESENTAÇÃO NA UI (texto da aba Tabela, seção de Copa no modal
// de resultados), não na estatística do chaveamento.
const { chromium } = require("playwright-core");

async function newCareer(page, base, email) {
  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Cup Test", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "load" });
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(200);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnOnboardSkip", { timeout: 2000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
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
// Avança exatamente 1 rodada pela pipeline real (mesma função que
// "Simular rodada" chama por trás — ver simulateRound/resolveRoundInstant),
// resolvendo ao vivo (via skip, sem esperar timer real) qualquer perna
// da Copa que sobrar pendente pro confronto do técnico.
async function resolveOneRoundProgrammatic(page) {
  return page.evaluate(async () => {
    const round = CAREER.currentRound;
    const fixtures = CAREER.schedule[round] || [];
    const standingsBefore = JSON.parse(JSON.stringify(CAREER.standings));
    resolveRoundInstant(round, fixtures, standingsBefore);
    let guard = 0;
    while (CAREER.cup && CAREER.cup.pendingLiveLeg && guard++ < 3) {
      if (!maybeStartPendingCupLegLive()) break;
      pauseLiveMatch();
      skipLiveMatch();
      let waited = 0;
      while (LIVE_MATCH && waited < 100) { await new Promise((r) => setTimeout(r, 20)); waited++; }
    }
    return CAREER.currentRound;
  });
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));

  const base = "http://localhost:8787";
  await newCareer(page, base, `cup${Date.now()}@teste.com`);

  // 1) Estrutura inicial do chaveamento expandido — 60 clubes (56 na
  // Fase 1 + 4 cabeças de chave direto na r32), seu clube em algum dos
  // 2 grupos.
  let career = await getCareer(page);
  const fase1Clubs = career.cup.ties.fase1.flatMap((t) => [String(t.home), String(t.away)]);
  const seeds = career.cup.seeds || [];
  console.log("1) cup.expanded:", career.cup.expanded, "| phase:", career.cup.phase, "| Fase 1 tem 56 clubes (28 confrontos):", fase1Clubs.length === 56, "| 4 cabeças de chave:", seeds.length === 4);
  const meInFase1 = fase1Clubs.includes(String(career.clubId));
  const meIsSeed = seeds.map(String).includes(String(career.clubId));
  console.log("   Meu clube participa (Fase 1 OU cabeça de chave, nunca os 2):", meInFase1 !== meIsSeed);

  // 2) Avança rodada a rodada (3 = ida da Fase 1) ATÉ RESOLVER a
  // rodada 6 (volta da Fase 1, inclusive) — mesma pipeline real,
  // decidindo ao vivo se sobrar confronto do técnico pendente.
  while (await page.evaluate(() => CAREER.currentRound) <= 6) {
    await resolveOneRoundProgrammatic(page);
  }
  career = await getCareer(page);
  console.log("2) Depois da rodada 6 (volta da Fase 1), avançou pra r32 (se o técnico seguiu vivo) ou ficou eliminado — fase:", career.cup.phase, "| humanAlive:", career.cup.humanAlive);
  console.log("   r32 tem 32 clubes (16 confrontos), se ainda ativo:", career.cup.phase === "r32" ? new Set(career.cup.ties.r32.flatMap((t) => [String(t.home), String(t.away)])).size === 32 : "N/A (eliminado)");
  // Se o confronto do técnico virou ao vivo em alguma dessas rodadas
  // (ver finishCupLegLive), a MESMA cadeia normal de pós-rodada já
  // abriu proposta/Tabela sozinha ao terminar — fecha antes de seguir,
  // mesmo tratamento que o técnico faria clicando no X.
  await page.evaluate(() => {
    if (document.getElementById("tabelaModalOverlay").classList.contains("open")) closeTabelaModal();
    if (document.getElementById("playerOfferOverlay").classList.contains("open")) closePlayerOfferModal();
  });

  // 3) Tab Tabela mostra o card de Copa com o rótulo certo da fase atual.
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='competicao']");
  await page.click("#btnOpenTabela");
  await page.waitForTimeout(300);
  const cupStatusText = await page.evaluate(() => document.getElementById("cupStatusText").textContent);
  console.log("3) Texto de status na aba Tabela:", cupStatusText);
  await page.evaluate(() => closeTabelaModal());
  await page.waitForTimeout(200);

  // 4) Força estado de CAMPEÃO diretamente (pula pro fim já resolvido)
  // e confere a renderização — mesmo texto/estilo de sempre, formato
  // não muda essa parte.
  career = await getCareer(page);
  career.cup.phase = "done";
  career.cup.champion = career.clubId;
  career.cup.championIsHuman = true;
  career.cup.humanAlive = true;
  await putCareer(page, career);
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(800);
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='competicao']");
  await page.click("#btnOpenTabela");
  await page.waitForTimeout(300);
  const championText = await page.evaluate(() => document.getElementById("cupStatusText").innerHTML);
  console.log("4) Texto de campeão:", championText);

  // 5) Força "não classificado" (cup.active=false) e confere o texto —
  // não acontece mais na prática pro formato expandido (todos os 60
  // participam), mas o código de exibição continua genérico/correto
  // pra esse estado (só existe de verdade hoje no formato legado).
  career = await getCareer(page);
  career.cup.active = false;
  await putCareer(page, career);
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(800);
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='competicao']");
  await page.click("#btnOpenTabela");
  await page.waitForTimeout(300);
  const notQualifiedText = await page.evaluate(() => document.getElementById("cupStatusText").textContent);
  console.log("5) Texto de não classificado:", notQualifiedText);

  // 6) Migração: remove CAREER.cup, força rodada 20 (entre r16.volta=18
  // e qf.ida=21 no calendário expandido), recarrega — setupCup deve
  // fechar por trás (silent) até a fase que ainda está por vir.
  career = await getCareer(page);
  delete career.cup;
  career.currentRound = 20;
  await putCareer(page, career);
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(800);
  career = await getCareer(page);
  console.log("6) Migração com rodada 20 -- cup existe:", !!career.cup, "| expanded:", career.cup.expanded, "| fase (deve ser 'qf', já fechadas fase1/r32/r16 por trás):", career.cup.phase);

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
