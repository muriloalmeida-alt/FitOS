const { chromium } = require("playwright-core");

async function newCareer(page, base, email) {
  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Train Test", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "load" });
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(200);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
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
async function simulateOneRound(page) {
  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(300);
  await page.click("#btnSimulate");
  await page.waitForSelector("#preMatchOverlay.open", { timeout: 5000 });
  await page.click("#btnPreMatchGo");
  // AJUSTE (item 4, pedido do usuário: "o jogo deve pausar no
  // intervalo (45) e aguardar que o técnico clique em prosseguir") —
  // clica em "Prosseguir" se o jogo parar no intervalo antes de seguir;
  // depois disso ESPERA de verdade o jogo terminar (2º tempo ainda
  // corre em tempos reais de ~900ms por chunk) antes de tentar os
  // cliques seguintes -- sem essa espera os cliques abaixo caíam todos
  // no catch (nada tinha aberto ainda) e a rodada nunca avançava de
  // verdade.
  await page.waitForSelector("#liveMatchOverlay.open", { timeout: 5000 }).catch(() => {});
  await page.waitForFunction(() => typeof LIVE_MATCH !== 'undefined' && LIVE_MATCH && (LIVE_MATCH.halftime || LIVE_MATCH.finished), { timeout: 15000 }).catch(() => {});
  if (await page.evaluate(() => typeof LIVE_MATCH !== 'undefined' && LIVE_MATCH && LIVE_MATCH.halftime)) {
    await page.click("#btnLiveContinueSecondHalf");
  }
  await page.waitForSelector("#matchDetailOverlay.open, #roundResultsOverlay.open", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(300);
  await page.click("#btnMatchDetailContinue").catch(() => {});
  await page.waitForTimeout(200);
  await page.click("#pressOptions [data-press]").catch(() => {});
  await page.waitForTimeout(200);
  await page.click("#btnNewsContinue").catch(() => {});
  await page.waitForTimeout(200);
  await page.click("#btnRoundResultsContinue").catch(() => {});
  await page.waitForTimeout(200);
  // AJUSTE (item 6, pedido do usuário) — proposta por jogador pode
  // aparecer aqui antes da Tabela (sorteio de sempre) — fecha no X.
  await page.click("#playerOfferClose").catch(() => {});
  await page.waitForTimeout(200);
  // "Ver tabela atualizada" agora abre um modal tela cheia por cima
  // da tela (ver openTabelaModal) em vez de trocar de aba -- fecha
  // ele aqui pra não bloquear os cliques seguintes do teste.
  await page.click("#tabelaModalClose").catch(() => {});
  await page.waitForTimeout(200);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("fonts.googleapis") && !m.text().includes("fundingchoices")) console.log("CONSOLE ERROR:", m.text()); });

  const base = "http://localhost:8787";
  await newCareer(page, base, `train${Date.now()}@teste.com`);
  let career = await getCareer(page);

  // Pega um titular de idade "prime" (22-29) pra teste determinístico
  // de crescimento focado, e um jogador NÃO titular e idoso (30+) pra
  // teste de declínio. Força o jogador prime pro time titular (não dá
  // pra confiar que a escalação automática já tenha um) via PUT direto.
  let primePlayer = career.squad.find((p) => p.age >= 22 && p.age <= 29 && p.status === "ok" && career.lineup.starters.includes(p.id));
  if (!primePlayer) {
    primePlayer = career.squad.find((p) => p.age >= 22 && p.age <= 29 && p.status === "ok" && p.origin === "principal");
    career.lineup.starters[0] = primePlayer.id;
    await putCareer(page, career);
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(800);
  }
  const starterId = primePlayer.id;
  const starter = primePlayer;
  console.log("Titular escolhido:", starter.name, "idade", starter.age, "atk", starter.atk);

  const oldBench = career.squad.find((p) => p.age >= 32 && !career.lineup.starters.includes(p.id) && p.status === "ok");
  console.log("Banco veterano escolhido:", oldBench ? `${oldBench.name} (${oldBench.age} anos)` : "NENHUM ENCONTRADO");

  const cpuClubId = Object.keys(career.leagueSquads)[0];
  const cpuPlayerBefore = career.leagueSquads[cpuClubId][0];

  // AJUSTE (Módulo de Treinos, ver applyWeeklyTraining em carreira.js)
  // -- o "foco de treino" com dobra de chance aleatória saiu de vez
  // (TRAINING_OPTIONS/TRAINING_MOD removidos); virou o plano semanal
  // determinístico da aba Treinos (ganho = round(2*mult), sem RNG
  // nenhum). Isola o dia 0 num treino TÉCNICO/moderada/elenco e o
  // resto da semana em descanso (menos jogo/folga protegida, que já
  // são fixos) pra testar só o efeito desse dia, sem precisar mexer em
  // Math.random -- diferente do applyNaturalAgingEvolution (ver
  // abaixo), este mecanismo nunca teve sorteio.
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='equipe']");
  await page.click("#btnOpenTreinos");
  await page.waitForTimeout(300);
  await page.evaluate(async (starterId) => {
    // Nova feature (pedido do usuário: "atributos precisam ser mais
    // reais... evolução menos agressiva") — o ganho de treino agora
    // respeita o teto de cada jogador (p.potential) com retorno
    // decrescente perto dele (ver attributeTrainingGain) — pra manter
    // este teste determinístico (+2 garantido), força bastante espaço
    // de sobra (potential = overall + 20, folga >= 15 = sempre o ganho
    // cheio, ver a fórmula) — a nuance de teto/decrescimento tem
    // cobertura própria em test_evolucao_atributos.js.
    const p = CAREER.squad.find((x) => x.id === starterId);
    p.potential = Math.min(99, p.overall + 20);
    CAREER.trainingPlan[0] = { foco: "tecnico", intensidade: "moderada", grupo: "principal" };
    // Os outros dias viram {} (sem foco) -- applyWeeklyTraining pula
    // um dia sem foco de vez (nem fadiga, nem recuperação de descanso),
    // isolando o efeito só do dia 0 pro teste de condição abaixo (um
    // dia 0 sozinho + vários "descanso" de +12 cada mascarava a queda
    // de fadiga, sempre saturando de volta em 100).
    for (let i = 1; i < 7; i++) { if (i !== TRAINING_GAME_DAY) CAREER.trainingPlan[i] = {}; }
    applyWeeklyTraining();
    // getCareer() (abaixo) lê do SERVIDOR (GET /api/career) -- sem
    // persistir aqui, o teste compararia contra o save antigo, ainda
    // sem o treino aplicado.
    await persistCareer();
  }, starterId);
  career = await getCareer(page);
  const starterAfter = career.squad.find((p) => p.id === starterId);
  console.log("1) Titular prime com treino técnico moderado -- overall cresceu (+2, round(2*1)):", starterAfter.overall === starter.overall + 2);
  console.log("   atk/def NÃO mudam com treino (só overall/phys, ver mapeamento técnico->overall):", starterAfter.atk === starter.atk && starterAfter.def === starter.def);
  console.log("   condição caiu com a fadiga (-6, round(6*1)):", starterAfter.condition === 100 - 6);

  const cpuPlayerAfter = career.leagueSquads[cpuClubId].find((p) => p.id === cpuPlayerBefore.id);
  console.log("2) Jogador CPU não evolui com o treino do técnico (atk/def/phys/overall iguais):", cpuPlayerAfter && cpuPlayerAfter.atk === cpuPlayerBefore.atk && cpuPlayerAfter.def === cpuPlayerBefore.def && cpuPlayerAfter.overall === cpuPlayerBefore.overall);

  // Indicador de tendência no detalhe -- deve aparecer ▲ só na linha
  // de GERAL (overall, o único atributo que o treino técnico mexeu).
  await page.click(".m3-nav-item[data-panel='elenco']");
  await page.waitForTimeout(300);
  await page.click(`[data-id="${starterId}"]`);
  await page.waitForSelector("#detailOverlay.open");
  await page.waitForTimeout(200);
  const kpiHtml = await page.evaluate(() => document.getElementById("detailBody").querySelector(".m3-attr-bars").innerHTML);
  const arrowCount = (kpiHtml.match(/▲|▼/g) || []).length;
  // AJUSTE (ripple .mt-attr-grid -> .m3-attr-bars, Tela "Perfil do
  // jogador: atributos em barra") -- label real é "Geral" (Title Case,
  // CSS só deixa visualmente maiúsculo), não mais "GERAL" solto no
  // innerHTML; recorta a seção entre "Geral" e "Ataque" (próxima linha)
  // pra confirmar que a seta está na linha certa.
  const geralSection = kpiHtml.split("Geral")[1]?.split("Ataque")[0] || "";
  console.log("3) Só 1 seta de tendência aparece (na de Geral):", arrowCount === 1, "| a seta está na linha de Geral:", /▲|▼/.test(geralSection));
  await page.click("#detailClose");
  await page.waitForTimeout(200);

  // Reabre o mesmo jogador -- seta deve ter sumido (já foi "checado").
  await page.click(`[data-id="${starterId}"]`);
  await page.waitForSelector("#detailOverlay.open");
  await page.waitForTimeout(200);
  const kpiHtml2 = await page.evaluate(() => document.getElementById("detailBody").querySelector(".m3-attr-bars").innerHTML);
  console.log("4) Seta sumiu depois de já ter sido checada:", !/▲|▼/.test(kpiHtml2));
  await page.click("#detailClose");
  await page.waitForTimeout(200);

  // Simula 1 rodada de verdade (motor de partida + applyNaturalAgingEvolution,
  // o que sobrou do antigo applyTrainingEvolution) -- confirma que o
  // fluxo inteiro (Central -> jogo -> resultado -> tabela) continua
  // funcionando igual, sem relação nenhuma com o treino já aplicado
  // acima (idempotente por rodada, ver trainingAppliedForRound).
  await simulateOneRound(page);

  // Teste de declínio: fixa Math.random alto (só passa no ramo de
  // declínio de quem NÃO jogou e já passou da idade de declínio).
  if (oldBench) {
    // Recaptura o estado ATUAL do veterano (não o snapshot de antes da
    // rodada 1) -- applyNaturalAgingEvolution já rodou uma vez de
    // verdade em simulateOneRound() acima com Math.random de VERDADE
    // (sem mock, diferente do treino determinístico), então os 4
    // atributos podem ter mudado nessa rodada; comparar contra o
    // snapshot velho daria falso negativo aqui.
    const beforeDecline = await page.evaluate((id) => {
      const p = CAREER.squad.find((x) => x.id === id);
      return { atk: p.atk, def: p.def, phys: p.phys, overall: p.overall };
    }, oldBench.id);
    // Chama simulateRound() DIRETO em vez de clicar no botão -- o
    // ambiente sandbox tem resets de rede intermitentes (ERR_
    // CONNECTION_RESET) que às vezes derrubam o PUT /api/career do
    // fluxo normal de clique (ver persistCareer); rodando direto no
    // client, sem depender de fetch/persistência, o teste da lógica de
    // declínio fica imune a esse ruído de ambiente.
    // FASE 3 (item 1 da spec de "Ao Vivo") — simulateRound() agora só
    // ABRE a tela Ao Vivo quando existe jogo seu (resolve em tempos,
    // ver startLiveMatch); pra manter esse teste síncrono/determinístico,
    // dirige os tempos manualmente em vez de esperar os timers reais.
    await page.evaluate(() => { Math.random = () => 0.999; });
    const afterDecline = await page.evaluate((id) => {
      simulateRound();
      // skipLiveMatch() resolve os tempos restantes e chama
      // finishLiveMatch() (sem esperar o timer) -- a parte síncrona
      // dela, que inclui applyNaturalAgingEvolution (Módulo de Treinos
      // renomeou de applyTrainingEvolution -- só a metade de evolução
      // por IDADE sobrou, a metade de foco dobrado saiu de vez), já
      // roda antes desse evaluate devolver (só o persistCareer() em
      // diante é assíncrono).
      skipLiveMatch();
      return CAREER.squad.find((p) => p.id === id);
    }, oldBench.id);
    const declined = ["atk", "def", "phys", "overall"].every((k) => afterDecline[k] === beforeDecline[k] - 1);
    console.log("5) Veterano no banco regrediu em TODOS os 4 atributos:", declined, JSON.stringify(beforeDecline), "->", JSON.stringify({ atk: afterDecline.atk, def: afterDecline.def, phys: afterDecline.phys, overall: afterDecline.overall }));
  }

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
