/* ===================================================================
   APP.JS — BRDATA · Simulador Brasileirão 2026
   -------------------------------------------------------------------
   Modelo de dados (igual em modo demo ou ao vivo):
     TEAMS         -> array de times ativos
     ALL_ROUNDS    -> { 1: [{home,away,fixtureId?,date?}], ..., N: [...] }
     MATCH_RESULTS -> { "round_home_away": resultado }  (jogos decididos)
=================================================================== */

let TEAMS = DEMO_TEAMS;
let ALL_ROUNDS = {};
let MATCH_RESULTS = {};
let TOTAL_ROUNDS = 38;
let LIVE_MODE = false;
// Elenco fictício ativo (modo demo) — troca junto com TEAMS a cada
// switchCompetition(). Nome separado de DEMO_PLAYERS (que continua
// sendo só o elenco do Brasileirão, em data.js) pra não confundir.
let activeDemoPlayers = DEMO_PLAYERS;

const state = {
  page: "dashboard",
  competitionId: "brasileirao", // ver server/src/competitions.js e DEMO_DATA_BY_COMPETITION (data.js)
  jogosRound: 1,
  simRound: 1,
  jogosSub: "rodadas",
  estatisticasSub: "times",
  probSort: "campeao",
  probResults: null,
  oddsRange: "7d",
  whatifN: 5,
  whatifTeamId: null,
  favorites: [],
  favoriteClubId: null,
  selectedTeamId: null,
  selectedPlayerId: null,
  rosterExpanded: false,
  pageBeforeDetail: "dashboard",
};

// Dados de apresentação (marca/branding) de cada campeonato no
// Dashboard — mesmas chaves de id do registro do backend (server/src/
// competitions.js) e do DEMO_DATA_BY_COMPETITION (data.js). emblemImg
// null usa a bandeirinha (flag) como emblema em vez de uma imagem.
const COMPETITION_META = {
  brasileirao:     { name: "Brasileirão", seasonLabel: "2026", emblemImg: "img/cbf-logo.png", flag: "🇧🇷", subtitle: "Série A" },
  serie_b:         { name: "Brasileirão", seasonLabel: "2026", emblemImg: "img/cbf-logo.png", flag: "🇧🇷", subtitle: "Série B" },
  serie_c:         { name: "Brasileirão", seasonLabel: "2026", emblemImg: "img/cbf-logo.png", flag: "🇧🇷", subtitle: "Série C" },
  copa_do_brasil:  { name: "Copa do Brasil", seasonLabel: "2026", emblemImg: "img/cbf-logo.png", flag: "🇧🇷", subtitle: "Mata-mata" },
  // Série D não tem entrada aqui — desligada de propósito por enquanto
  // (nem existe no registro do backend, ver server/src/competitions.js).
};
function applyCompetitionBranding(id) {
  const meta = COMPETITION_META[id] || COMPETITION_META.brasileirao;
  const emblemBox = document.getElementById("dashEmblemBox");
  if (emblemBox) {
    emblemBox.innerHTML = meta.emblemImg
      ? `<img class="brasileirao-emblem" src="${meta.emblemImg}" alt="">`
      : `<span class="brasileirao-emblem-flag">${meta.flag}</span>`;
  }
  const titleWord = document.getElementById("dashTitleWord");
  if (titleWord) titleWord.innerHTML = `${meta.name.toUpperCase()} <span>${meta.seasonLabel}</span>`;
  document.title = `BRDATA · ${meta.name} ${meta.seasonLabel}`;
}

/* ---------- Boot ---------- */
function setActiveTeams(teams) { TEAMS = teams; setTeamMap(teams); }

// Usuário logado (null se ninguém logado ainda) — ver renderAuthGate()
// mais abaixo. Cadastro/login é obrigatório: enquanto não tiver
// currentUser com planStatus "active", só o #authGate é mostrado, o
// resto do app (.shell) fica escondido e nenhum dado é carregado.
let currentUser = null;
// true depois que o fluxo de login/app já rodou pelo menos uma vez —
// evita refazer tudo de novo só porque a janela foi redimensionada
// (ver evaluateDesktopGate).
let appBooted = false;

/* ================= Regras de acesso por plano =================
   Freemium e Lite: sem Comparador de times, Probabilidades ou
   Simulador — essas 3 seções mostram um card de upsell no lugar (ver
   lockedFeatureHTML) em vez do conteúdo real. Pro e Enterprise têm
   as 3 liberadas. Bloqueio só de interface (o cálculo roda no
   navegador com dados já públicos) — é um soft paywall, não segurança
   de dado sensível. */
function planAllowsAdvanced() {
  const p = currentUser && currentUser.plan;
  return p === "pro" || p === "enterprise";
}
// Atualiza os itens de Série B/C na barra lateral com o que o plano do
// usuário logado realmente libera (ver GET /api/competitions,
// server/src/competitions.js). Os dois já nascem "disabled" no HTML
// (nada real pra mostrar ainda em nenhum plano) — isso aqui só ajusta
// o texto/badge pra deixar claro se é "em breve mesmo pro seu plano"
// ou "em breve + precisa de upgrade".
// Cache do último GET /api/competitions — consultado no clique de
// Série B/C (ver onCompetitionNavClick) pra decidir na hora "troca de
// campeonato" ou "manda pra Apoie o BR Data".
let competitionsInfo = null;

// Copa do Brasil NÃO entra aqui de propósito — ver aviso grande em
// DEMO_DATA_BY_COMPETITION (data.js): o formato real dela (mata-mata
// direto) não bate com o molde de pontos corridos que o resto do app
// assume, então o botão dela na sidebar/menu fica sempre com a cara de
// "em breve" (disabled já no HTML) e nunca chama switchCompetition —
// só Série B/C entram no switcher de verdade, igual Série A. (Série D
// também tinha esse problema, mas nem chegou a ganhar botão — foi
// desligada de propósito por enquanto, ver server/src/competitions.js.)
function applyCompetitionsSidebar(data) {
  competitionsInfo = data;
  if (!data || !data.competitions) return;
  // Cada competição tem 2 elementos — o da sidebar de desktop e o
  // equivalente na página "Mais" do mobile (a sidebar inteira some
  // em telas ≤1024px, ver style.css) — os dois atualizados juntos.
  const elIdsByCompetition = {
    serie_b: ["navSerieB", "navSerieBMobile"],
    serie_c: ["navSerieC", "navSerieCMobile"],
  };
  data.competitions.forEach((c) => {
    (elIdsByCompetition[c.id] || []).forEach((elId) => {
      const el = document.getElementById(elId);
      if (!el) return;
      const badge = el.querySelector(".badge-pro");
      if (c.locked) {
        // Fora do plano: continua com a cara de "em breve/bloqueado" já
        // usada pelas outras competições ainda não implementadas — clicar
        // manda pra Apoie o BR Data (ver onCompetitionNavClick).
        el.classList.add("disabled");
        el.title = `${c.flag} ${c.name} — disponível a partir do plano Pro`;
        if (badge) badge.style.display = "inline-block";
      } else {
        // Plano libera: já dá pra trocar de campeonato de verdade (modo
        // exemplo hoje; ao vivo automaticamente assim que a API-Sports
        // real estiver configurada e habilitada pra essa liga).
        el.classList.remove("disabled");
        el.title = `${c.flag} ${c.name}`;
        if (badge) badge.style.display = "none";
      }
      el.classList.toggle("active", c.id === state.competitionId);
    });
  });
  document.getElementById("navBrasileirao")?.classList.toggle("active", state.competitionId === "brasileirao");
  document.getElementById("navBrasileiraoMobile")?.classList.toggle("active", state.competitionId === "brasileirao");
}

// Clique em Série B/C na barra lateral — troca de campeonato se o
// plano libera, ou manda pra Apoie o BR Data se não.
function onCompetitionNavClick(compId) {
  const info = competitionsInfo?.competitions?.find((c) => c.id === compId);
  if (info && info.locked) { setActivePage("apoie"); return; }
  switchCompetition(compId);
}

function lockedFeatureHTML(title, desc) {
  return `<div class="card locked-feature">
    <div class="locked-feature-icon">🔒</div>
    <h3>${title}</h3>
    <p>${desc}</p>
    <button class="btn btn-primary" onclick="setActivePage('apoie')">Ver planos Pro e Enterprise</button>
  </div>`;
}

/* ================= Modal de anúncio em vídeo (Freemium) =================
   SIMULADO por enquanto — sem integração com rede de anúncios de
   verdade (ver comentário em cima de .ad-modal-overlay no style.css
   pra saber onde plugar isso depois). Só roda pro plano Freemium.

   Regras:
   - 1º anúncio aparece AD_FIRST_DELAY_MS depois do login; os
     seguintes, a cada AD_INTERVAL_MS.
   - Não soma tempo com a aba em segundo plano (document.hidden) — só
     pula aquele ciclo e tenta de novo no próximo, então nunca acumula
     vários anúncios de uma vez pra descarregar quando o usuário volta.
   - Só fecha depois que o "vídeo" (barra de progresso simulando
     AD_DURATION_S) termina — sem opção de pular, nem pelo link de
     upgrade (que também fica inerte até lá). */
const AD_FIRST_DELAY_MS = 60 * 1000; // 1 minuto depois do login
const AD_INTERVAL_MS = 5 * 60 * 1000; // depois do 1º, a cada 5 minutos
const AD_DURATION_S = 15; // duração do "vídeo" simulado
let adFirstTimeoutId = null;
let adTimerId = null;
let adProgressIntervalId = null;
let adModalUnlocked = false; // true só quando a barra de progresso completa

function startAdTimer() {
  stopAdTimer();
  adFirstTimeoutId = setTimeout(() => {
    adFirstTimeoutId = null;
    tryShowAd();
    adTimerId = setInterval(tryShowAd, AD_INTERVAL_MS);
  }, AD_FIRST_DELAY_MS);
}
function tryShowAd() {
  if (document.hidden) return; // app em segundo plano, tenta de novo no próximo ciclo
  if (!currentUser || currentUser.plan !== "freemium") { stopAdTimer(); return; }
  showAdModal();
}
function stopAdTimer() {
  if (adFirstTimeoutId) { clearTimeout(adFirstTimeoutId); adFirstTimeoutId = null; }
  if (adTimerId) { clearInterval(adTimerId); adTimerId = null; }
}

function showAdModal() {
  const modal = document.getElementById("adModal");
  if (!modal || modal.style.display === "flex") return; // já tem um aberto, não empilha
  modal.style.display = "flex";
  const closeBtn = document.getElementById("adModalClose");
  const footer = document.getElementById("adModalFooter");
  const fill = document.getElementById("adModalProgressFill");
  adModalUnlocked = false;
  closeBtn.disabled = true;
  closeBtn.textContent = "Aguarde o fim do vídeo...";
  footer.classList.add("locked");
  if (fill) fill.style.width = "0%";
  let elapsedMs = 0;
  clearInterval(adProgressIntervalId);
  adProgressIntervalId = setInterval(() => {
    elapsedMs += 200;
    const pct = Math.min(100, (elapsedMs / (AD_DURATION_S * 1000)) * 100);
    if (fill) fill.style.width = pct + "%";
    if (elapsedMs >= AD_DURATION_S * 1000) {
      clearInterval(adProgressIntervalId);
      adModalUnlocked = true;
      closeBtn.disabled = false;
      closeBtn.textContent = "Fechar anúncio ✕";
      footer.classList.remove("locked");
    }
  }, 200);
}

function closeAdModal() {
  const modal = document.getElementById("adModal");
  if (modal) modal.style.display = "none";
  clearInterval(adProgressIntervalId);
}

/* ================= Gate de desktop (foco 100% PWA/mobile) =================
   Telas maiores que DESKTOP_BREAKPOINT mostram uma página pra baixar/
   instalar o app em vez do login — tem prioridade sobre tudo, inclusive
   sobre quem já está logado. Reavaliado no boot() e a cada resize da
   janela. "Continuar no navegador" grava um flag em localStorage que
   pula esse gate dali pra frente, nesse mesmo navegador. */
const DESKTOP_BREAKPOINT = 1024; // mesmo breakpoint dos media queries responsivos do resto do CSS
const DESKTOP_BYPASS_KEY = "brdata_desktop_bypass";

function hasDesktopBypass() {
  try { return localStorage.getItem(DESKTOP_BYPASS_KEY) === "1"; } catch { return false; }
}
function setDesktopBypass() {
  try { localStorage.setItem(DESKTOP_BYPASS_KEY, "1"); } catch {}
}
function isDesktopWidth() { return window.innerWidth > DESKTOP_BREAKPOINT; }

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function renderDesktopGateQR() {
  const box = document.getElementById("desktopGateQr");
  const urlEl = document.getElementById("desktopGateUrl");
  const url = `${location.origin}/`;
  if (urlEl) urlEl.textContent = url;
  if (!box) return;
  try {
    const qr = qrcode(0, "M"); // qrcode-lib.js (vendorizado, ver public/js/qrcode-lib.js) — sem depender de serviço externo
    qr.addData(url);
    qr.make();
    box.innerHTML = qr.createSvgTag(6, 4);
  } catch (err) {
    console.warn("[desktop-gate] falha ao gerar QR code:", err);
  }
}

// Decide se mostra o gate de desktop. Retorna true se mostrou (chamado
// tanto no boot quanto a cada resize da janela).
function evaluateDesktopGate() {
  const shouldGate = isDesktopWidth() && !hasDesktopBypass();
  document.getElementById("desktopGate").style.display = shouldGate ? "flex" : "none";
  if (shouldGate) {
    document.getElementById("authGate").style.display = "none";
    document.querySelector(".shell").style.display = "none";
  } else if (appBooted) {
    // Saiu do gate de desktop (redimensionou pra baixo, ou clicou
    // "continuar") depois do app já ter carregado 1x — só devolve a
    // visibilidade certa (logado ou tela de login), sem refazer o
    // boot inteiro de novo.
    setGateVisible(!(currentUser && currentUser.planStatus === "active"));
  }
  return shouldGate;
}

async function boot() {
  // Liga os listeners 1x só, logo de cara — os elementos do gate (login/
  // cadastro) e do shell (app "de verdade") já existem os dois no DOM
  // desde o carregamento, só um dos dois fica visível por vez (display
  // controlado por setGateVisible). Assim não corre risco de re-ligar
  // listener duplicado quando o login acontece sem reload de página.
  setupEventListeners();
  initTheme(); // roda antes do login pra o próprio gate já respeitar o tema salvo
  renderDesktopGateQR();

  window.addEventListener("resize", debounce(() => {
    const gated = evaluateDesktopGate();
    if (!gated && !appBooted) startAuthFlow();
  }, 200));

  if (evaluateDesktopGate()) return; // tela de desktop sem bypass — só a página de download, nada mais carrega
  await startAuthFlow();
}

async function startAuthFlow() {
  appBooted = true;
  const authState = await checkAuth();

  if (!authState.authenticated) {
    await renderAuthGate();
    setGateVisible(true);
    return;
  }
  if (authState.user.planStatus !== "active") {
    currentUser = authState.user;
    renderAvatar(authState.user);
    renderGatePending(authState.user);
    setGateVisible(true);
    return;
  }

  await startApp(authState.user);
}

// Chamado (a) no boot normal, já logado, e (b) logo depois de um login
// bem-sucedido dentro do gate — sem precisar recarregar a página.
async function startApp(user) {
  currentUser = user;
  setGateVisible(false);
  renderAvatar(user);

  state.competitionId = "brasileirao";
  loadFavorites();
  loadFavoriteClub();
  await loadCompetitionData("brasileirao");

  populateAllSelects();
  renderMyTeamsSidebar();
  setActivePage("dashboard");

  if (user.plan === "freemium") startAdTimer(); else stopAdTimer();
  loadCompetitionsInfo().then(applyCompetitionsSidebar);
}

// Busca (ou gera, em modo exemplo) os dados de UM campeonato — times,
// calendário, resultados — e atualiza os globais TEAMS/ALL_ROUNDS/
// MATCH_RESULTS/TOTAL_ROUNDS/LIVE_MODE de acordo. Tenta dado ao vivo
// primeiro (via tryLoadLiveData, que já sabe cair fora sozinho se não
// tiver API_SPORTS_KEY, ou se esse campeonato especificamente ainda
// não estiver habilitado no backend — ver server/src/competitions.js)
// e cai pro modo exemplo desse mesmo campeonato (DEMO_DATA_BY_COMPETITION,
// em data.js) se o dado ao vivo não vier. Chamado tanto no boot quanto
// a cada troca de campeonato (ver switchCompetition).
async function loadCompetitionData(id) {
  const meta = COMPETITION_META[id] || COMPETITION_META.brasileirao;
  const demo = DEMO_DATA_BY_COMPETITION[id] || DEMO_DATA_BY_COMPETITION.brasileirao;
  setActiveTeams(demo.teams);
  activeDemoPlayers = demo.players;

  const live = await tryLoadLiveData(LIVE_SEASON, id);

  if (live) {
    LIVE_MODE = true;
    setActiveTeams(live.teams);
    ALL_ROUNDS = live.allRounds;
    MATCH_RESULTS = live.results;
    TOTAL_ROUNDS = live.totalRounds;
    document.getElementById("dashSub").textContent = `${meta.subtitle} · Temporada ${live.season}`;
  } else {
    LIVE_MODE = false;
    initDemoSeason(demo.teams);
    document.getElementById("dashSub").textContent = `${meta.subtitle} · dados de exemplo`;
  }

  const modePill = document.getElementById("modePill");
  modePill.textContent = LIVE_MODE ? "● Ao vivo" : "● Exemplo";
  modePill.className = "mode-pill " + (LIVE_MODE ? "live" : "demo");
  updateRefreshButtonVisibility();

  state.jogosRound = Math.max(1, firstUndecidedRound() - 1) || 1;
  state.simRound = firstUndecidedRound();

  applyCompetitionBranding(id);
}

// Troca o campeonato ativo (chamado pelos itens Brasileirão/Série B/
// Série C da barra lateral — ver onCompetitionNavClick).
// Favoritos e clube favorito são por campeonato (ver loadFavorites/
// loadFavoriteClub) — time/jogador selecionados são zerados porque o
// id de um time do Brasileirão não existe nos outros campeonatos (e
// vice-versa).
async function switchCompetition(id) {
  if (id === state.competitionId) { setActivePage("dashboard"); return; }
  state.competitionId = id;
  state.selectedTeamId = null;
  state.selectedPlayerId = null;
  state.probResults = null;
  playersListCache = null;
  teamRosterCacheDemo = null;
  playersLeadersCache = null; // ver liveData.js -- lista de líderes é por campeonato

  await loadCompetitionData(id);
  loadFavorites();
  loadFavoriteClub();
  populateAllSelects();
  renderMyTeamsSidebar();
  applyCompetitionsSidebar(competitionsInfo); // reaplica pra atualizar qual item fica "active"
  setActivePage("dashboard");
}

function initDemoSeason(teams = DEMO_TEAMS) {
  ALL_ROUNDS = generateAllRounds(teams.map(t => t.id));
  TOTAL_ROUNDS = Object.keys(ALL_ROUNDS).length;
  MATCH_RESULTS = {};
  const rng = mulberry32(2026);
  const turnoRounds = TOTAL_ROUNDS / 2;
  for (let r = 1; r <= turnoRounds; r++) {
    ALL_ROUNDS[r].forEach(fx => {
      const m = simulateMatch(fx.home, fx.away, rng);
      m.round = r; m.official = true;
      MATCH_RESULTS[keyFor(r, fx.home, fx.away)] = m;
    });
  }
}

/* ---------- Helpers de estado / dados derivados ---------- */
function keyFor(round, home, away) { return `${round}_${home}_${away}`; }
function getRoundFixtures(round) { return ALL_ROUNDS[round] || []; }

function getRoundMatches(round) {
  return getRoundFixtures(round).map(fx => {
    const k = keyFor(round, fx.home, fx.away);
    if (MATCH_RESULTS[k]) return MATCH_RESULTS[k];
    return { home: fx.home, away: fx.away, round, fixtureId: fx.fixtureId, date: fx.date, venue: fx.venue, pending: true };
  });
}
// Local do jogo: usa o venue vindo da API-Sports quando disponível;
// senão cai no estádio-sede do time mandante (funciona em modo demo,
// onde DEMO_TEAMS já tem o estádio real de cada clube).
function venueFor(m) {
  return m.venue || TEAM_MAP[m.home]?.venue || null;
}
function allDecidedMatches() { return Object.values(MATCH_RESULTS); }

function computeRemaining(decidedMap) {
  const out = [];
  for (let r = 1; r <= TOTAL_ROUNDS; r++) {
    getRoundFixtures(r).forEach(fx => {
      if (!decidedMap[keyFor(r, fx.home, fx.away)]) out.push({ home: fx.home, away: fx.away });
    });
  }
  return out;
}
function remainingUndecidedFixtures() { return computeRemaining(MATCH_RESULTS); }

function teamFutureFixtures(teamId) {
  const out = [];
  for (let r = 1; r <= TOTAL_ROUNDS; r++) {
    getRoundFixtures(r).forEach(fx => {
      if (fx.home !== teamId && fx.away !== teamId) return;
      if (!MATCH_RESULTS[keyFor(r, fx.home, fx.away)]) out.push({ round: r, home: fx.home, away: fx.away });
    });
  }
  return out;
}

function isRoundDecided(round) {
  const fixtures = getRoundFixtures(round);
  return fixtures.length > 0 && fixtures.every(fx => MATCH_RESULTS[keyFor(round, fx.home, fx.away)]);
}
// AJUSTE DE LÓGICA (13/08/2026): em modo ao vivo, "próxima rodada" usa
// o CALENDÁRIO (data de cada jogo) em vez de olhar se todo mundo já
// tem resultado gravado — antes, se um resultado não fosse lido certo
// (ex.: campo de placar num formato inesperado vindo do fornecedor), a
// rodada nunca virava "decidida" mesmo já tendo acontecido de verdade,
// travando a rodada "atual" do app pra trás. Uma rodada com pelo menos
// 1 jogo hoje ou no futuro ainda é a atual/próxima pelo calendário,
// independente do que MATCH_RESULTS diz. Em modo exemplo não tem data
// de verdade (ver generateAllRounds em data.js — só {home, away}, sem
// data), então continua usando a lógica antiga (baseada no que o
// simulador já decidiu).
function firstUndecidedRoundByCalendar() {
  const today = new Date();
  for (let r = 1; r <= TOTAL_ROUNDS; r++) {
    const fixtures = getRoundFixtures(r);
    if (!fixtures.length) continue;
    const stillOpen = fixtures.some(fx => !fx.date || new Date(fx.date) >= today);
    if (stillOpen) return r;
  }
  return TOTAL_ROUNDS;
}
function firstUndecidedRound() {
  if (LIVE_MODE) return firstUndecidedRoundByCalendar();
  for (let r = 1; r <= TOTAL_ROUNDS; r++) if (!isRoundDecided(r)) return r;
  return TOTAL_ROUNDS;
}
function currentStandings() { return computeStandings(allDecidedMatches()); }
function decidedCount() { return allDecidedMatches().length; }
function aprov(pts, j) { return j ? Math.round((pts / (j * 3)) * 100) : 0; }

/* ---------- UI helpers ---------- */
// Escapa valores antes de embutir em atributos HTML (evita quebrar o
// parsing quando nome/short do time contém aspas, "&", "<" etc.).
function escAttr(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
// Brasões salvos localmente (public/img/teams/*.svg) — usados quando a
// API-Sports está fora do ar/sem chave, ou como o próprio brasão do modo
// de exemplo. Cobre 19 dos 20 clubes da Série A 2026 (falta Mirassol, que
// cai pro fallback de iniciais coloridas mesmo). Fonte: pacote npm
// "react-brasileirao-logos" (14 clubes) + repositório público
// "hugomiura/escudos-times-brasil-svg" (5 clubes) — ver public/img/teams/README.md.
const LOCAL_CREST_MAP = {
  fla: ["flamengo"],
  pal: ["palmeiras"],
  bot: ["botafogo"],
  for: ["fortaleza"],
  int: ["internacional"],
  sao: ["sao paulo"],
  cor: ["corinthians"],
  gre: ["gremio"],
  cap: ["athletico paranaense", "atletico paranaense", "athletico pr", "atletico pr"],
  cru: ["cruzeiro"],
  cam: ["atletico mineiro", "atletico mg", "clube atletico mineiro"],
  bah: ["bahia"],
  vas: ["vasco da gama", "vasco"],
  flu: ["fluminense"],
  san: ["santos"],
  bra: ["bragantino", "red bull bragantino", "rb bragantino"],
  vit: ["vitoria"],
  juv: ["juventude"],
  cui: ["cuiaba"],
};
// Remove acentos e pontuação pra comparar nomes de forma tolerante (ex:
// "Atlético-MG" e "Atletico Mineiro" viram "atletico mg"/"atletico mineiro").
function normalizeTeamName(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function localCrestFor(team) {
  if (!team) return null;
  // Modo de exemplo: o id já é a sigla local (fla, pal, bot...).
  if (team.id && LOCAL_CREST_MAP[team.id]) return `img/teams/${team.id}.svg`;
  // Modo ao vivo: id é o id numérico da API-Sports — casa pelo nome.
  const norm = normalizeTeamName(team.name);
  for (const [localId, aliases] of Object.entries(LOCAL_CREST_MAP)) {
    if (aliases.some(a => norm.includes(a))) return `img/teams/${localId}.svg`;
  }
  return null;
}
function crestEl(team, size) {
  const localSrc = localCrestFor(team);
  const primarySrc = team.logo || localSrc;
  if (!primarySrc) return crestFallback(team, size);
  // Se a fonte principal for a API-Sports E existir um brasão local
  // diferente, guarda o caminho local como plano B antes das iniciais.
  const retrySrc = (team.logo && localSrc && localSrc !== team.logo) ? localSrc : "";
  // Passa os dados do fallback via data-* (em vez de embutir HTML cru
  // dentro do atributo onerror) — assim aspas dentro do HTML de
  // crestFallback() não colidem com as aspas do próprio atributo, o
  // que antes quebrava o fallback e deixava o ícone de imagem
  // quebrada do navegador aparecer no lugar do brasão/iniciais.
  return `<img class="crest" src="${escAttr(primarySrc)}" alt="${escAttr(team.short || "")}" width="${size}" height="${size}"
    style="width:${size}px;height:${size}px;background:#fff;border:1px solid var(--border);padding:2px;"
    data-short="${escAttr(team.short || team.name || "?")}" data-c1="${escAttr(team.c1 || "#0057B8")}" data-c2="${escAttr(team.c2 || "#062B5C")}" data-size="${size}"
    data-retry="${escAttr(retrySrc)}"
    onerror="crestFallbackHandler(this)">`;
}
function crestFallbackHandler(img) {
  const retry = img.dataset.retry;
  if (retry) {
    // Já tentou a API-Sports e falhou — tenta o brasão salvo localmente
    // antes de desistir e cair pras iniciais coloridas.
    img.dataset.retry = "";
    img.src = retry;
    return;
  }
  img.outerHTML = crestFallback(
    { short: img.dataset.short, c1: img.dataset.c1, c2: img.dataset.c2 },
    parseInt(img.dataset.size, 10) || 24
  );
}
function crestFallback(team, size) {
  return `<div class="crest" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.34)}px;background:linear-gradient(135deg, ${team.c1 || "#0057B8"}, ${team.c2 || "#062B5C"})">${(team.short || team.name || "?").slice(0, 3)}</div>`;
}
function zoneColor(zone) {
  return { campeao: "var(--brd-yellow)", libertadores: "var(--brd-blue)", sulamericana: "var(--brd-info)", rebaixamento: "var(--brd-red)", meio: "var(--brd-gray-600)" }[zone];
}
function watchLink(homeTeam, awayTeam, gh, ga) {
  const compName = (COMPETITION_META[state.competitionId] || COMPETITION_META.brasileirao).name;
  const q = encodeURIComponent(`${homeTeam.name} ${gh}x${ga} ${awayTeam.name} ${compName} gols melhores momentos`);
  return `<a class="watch-link" target="_blank" rel="noopener" href="https://www.youtube.com/results?search_query=${q}">
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 8l6 4-6 4V8z"/><rect x="2" y="4" width="20" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>
    Assistir gols e melhores momentos</a>`;
}
function fmtFixtureDate(dateIso, round) {
  if (!dateIso) return `Rodada ${round}`;
  const d = new Date(dateIso);
  if (isNaN(d)) return `Rodada ${round}`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " · " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/* ================= LINHAS DE TABELA ================= */
// favId + pinned: quando o clube favorito é passado, destaca a linha
// dele em negrito (.fav-row); pinned marca que essa linha foi "presa"
// no fim da lista porque o time não estava entre os primeiros
// exibidos (ver renderDashboard) — só some uma borda de separação.
function dashRowHTML(row, pos, favId, pinned = false) {
  const team = TEAM_MAP[row.id];
  const zone = zoneOfPosition(pos);
  const isFav = favId && team.id === favId;
  const cls = [isFav ? "fav-row" : "", pinned ? "fav-row-pinned" : ""].filter(Boolean).join(" ");
  return `<tr data-zone="${zone}"${cls ? ` class="${cls}"` : ""}>
    <td><span class="pos">${pos}</span></td>
    <td class="clickable-team" onclick="goToTeam('${team.id}')">${crestEl(team, 22)}</td>
    <td class="team-cell clickable-team" onclick="goToTeam('${team.id}')">${isFav ? "⭐ " : ""}${team.name}</td>
    <td class="num">${row.pts}</td><td class="num">${row.j}</td>
    <td class="num">${row.sg > 0 ? "+" + row.sg : row.sg}</td>
  </tr>`;
}
// Colunas reduzidas de propósito (#, Time, Pontos, Jogos, Saldo de
// Gols) — com nomes de time longos (ex: "Athletico Paranaense",
// "Vasco da Gama") e mais colunas, o nome quebrava em duas linhas e
// deixava as linhas da tabela com alturas diferentes.
function fullRowHTML(row, pos) {
  const team = TEAM_MAP[row.id];
  const isFav = state.favorites.includes(team.id);
  const zone = zoneOfPosition(pos);
  return `<tr data-zone="${zone}">
    <td><span class="pos">${pos}</span></td>
    <td class="clickable-team" onclick="goToTeam('${team.id}')">${crestEl(team, 24)}</td>
    <td><div class="team-cell clickable-team" onclick="goToTeam('${team.id}')"><span class="tname-ellipsis">${team.name}</span><span class="fav-heart ${isFav ? "active" : ""}" data-team="${team.id}" title="Favoritar">${isFav ? "♥" : "♡"}</span></div></td>
    <td class="num">${row.pts}</td><td class="num">${row.j}</td>
    <td class="num">${row.sg > 0 ? "+" + row.sg : row.sg}</td>
  </tr>`;
}
// Linha compacta pra tabela da barra lateral do Simulador (espaço estreito).
function simTableRowHTML(row, pos) {
  const team = TEAM_MAP[row.id];
  const zone = zoneOfPosition(pos);
  return `<tr data-zone="${zone}">
    <td><span class="pos">${pos}</span></td>
    <td class="clickable-team" onclick="goToTeam('${team.id}')">${crestEl(team, 20)}</td>
    <td class="team-cell clickable-team" onclick="goToTeam('${team.id}')">${team.short}</td>
    <td class="num">${row.pts}</td>
    <td class="num only-desktop">${row.sg > 0 ? "+" + row.sg : row.sg}</td>
  </tr>`;
}

/* ================= PÁGINA: DASHBOARD ================= */
function renderDashboard() {
  const standings = currentStandings();
  document.getElementById("roundPill").textContent = `Rodada ${Math.min(firstUndecidedRound(), TOTAL_ROUNDS)}/${TOTAL_ROUNDS}`;

  renderFavoriteClubCard(standings);
  renderDashKpis(standings);
  renderDashStandings(standings);
  renderDashTitleChance();
  renderDashNextFixtures();
  renderDashOdds();
  renderDashNewsMini();
}

// Tabela de classificação do Dashboard — top 6 de sempre. Com um Clube
// Favorito selecionado, a linha dele vem em negrito (⭐); se ele não
// estiver entre os 6 primeiros, a linha é "presa" no fim da lista, sem
// tirar ninguém do topo — assim o destaque nunca fica de fora.
function renderDashStandings(standings) {
  const favId = state.favoriteClubId;
  const top = standings.slice(0, 6);
  let rowsHTML = top.map((r, i) => dashRowHTML(r, i + 1, favId)).join("");
  if (favId && !top.some(r => r.id === favId)) {
    const idx = standings.findIndex(r => r.id === favId);
    if (idx >= 0) rowsHTML += dashRowHTML(standings[idx], idx + 1, favId, true);
  }
  document.getElementById("dashStandings").innerHTML = rowsHTML || `<tr><td colspan="6" class="empty">Sem jogos decididos ainda.</td></tr>`;
}

// "há Xmin/Xh/Xd" a partir de uma data (pubDate do RSS, formato RFC
// 822 tipo "Tue, 11 Aug 2026 12:00:00 GMT" — new Date() já entende).
function timeAgo(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return "";
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)}d`;
}
// Com Clube Favorito ativo, busca notícias daquele time específico
// (ver /api/news?team=... e newsSource.js) em vez do feed genérico de
// Brasileirão — mesmo card, foco diferente.
async function renderDashNewsMini() {
  const box = document.getElementById("dashNewsMini");
  if (!box) return;
  const favTeam = activeFavoriteTeam();
  const items = (await loadNews(favTeam?.name || "")).slice(0, 3);
  if (activeFavoriteTeam()?.id !== favTeam?.id) return; // favorito mudou enquanto buscava — deixa a chamada mais nova escrever
  box.innerHTML = items.length
    ? items.map(n => `
      <a class="news-mini" href="${n.link}" target="_blank" rel="noopener">
        <div class="thumb"></div>
        <div><h4>${n.title}</h4><div class="meta">${n.source || "Notícia"} · ${timeAgo(n.pubDate)}</div></div>
      </a>`).join("")
    : `<div class="empty" style="padding:8px 0;">${favTeam ? `Não foi possível carregar notícias de ${favTeam.name} agora.` : "Não foi possível carregar notícias agora."}</div>`;
}

// Estatísticas de UM time específico (usadas nos cards de KPI do
// Dashboard quando há um Clube Favorito ativo — ver renderDashKpis).
function teamKpiStats(teamId) {
  const matches = allDecidedMatches().filter(m => m.home === teamId || m.away === teamId);
  const withStats = matches.filter(m => m.stats);
  let goalsFor = 0, homeGames = 0, homeWins = 0;
  matches.forEach(m => {
    const isHome = m.home === teamId;
    goalsFor += isHome ? m.gh : m.ga;
    if (isHome) { homeGames++; if (m.gh > m.ga) homeWins++; }
  });
  const posseAvg = withStats.length
    ? Math.round(withStats.reduce((s, m) => s + (m.home === teamId ? m.stats.posse[0] : m.stats.posse[1]), 0) / withStats.length)
    : 0;
  return {
    goalsAvg: matches.length ? (goalsFor / matches.length).toFixed(2) : "0.00",
    goalsTotal: goalsFor,
    posseAvg,
    homeWinPct: homeGames ? Math.round((homeWins / homeGames) * 100) : 0,
  };
}
function renderDashKpis(standings) {
  const favTeam = activeFavoriteTeam();
  const goalsAvgLabel = document.getElementById("kpiGoalsAvgLabel");
  const possAvgLabel = document.getElementById("kpiPossAvgLabel");
  const goalsTotalLabel = document.getElementById("kpiGoalsTotalLabel");
  const homeWinLabel = document.getElementById("kpiHomeWinLabel");

  if (favTeam) {
    // Clube Favorito ativo: os KPIs passam a ser do time selecionado,
    // não mais da liga inteira.
    const t = teamKpiStats(favTeam.id);
    if (goalsAvgLabel) goalsAvgLabel.textContent = "Gols/jogo";
    if (possAvgLabel) possAvgLabel.textContent = "Posse média";
    if (goalsTotalLabel) goalsTotalLabel.textContent = "Gols na temporada";
    if (homeWinLabel) homeWinLabel.textContent = "Vitórias em casa";
    document.getElementById("kpiGoalsAvg").textContent = t.goalsAvg;
    document.getElementById("kpiPossAvg").textContent = t.posseAvg ? t.posseAvg + "%" : "—";
    document.getElementById("kpiGoalsTotal").textContent = t.goalsTotal;
    document.getElementById("kpiHomeWin").textContent = t.homeWinPct + "%";
  } else {
    // Sem favorito: KPIs da liga inteira (comportamento padrão).
    const matches = allDecidedMatches();
    const withStats = matches.filter(m => m.stats);
    const totalGols = matches.reduce((s, m) => s + m.gh + m.ga, 0);
    const mediaGols = matches.length ? (totalGols / matches.length).toFixed(2) : "0.00";
    const posseAvg = withStats.length ? Math.round(withStats.reduce((s, m) => s + m.stats.posse[0] + m.stats.posse[1], 0) / (withStats.length * 2)) : 0;
    const homeWins = matches.filter(m => m.gh > m.ga).length;
    const homeWinPct = matches.length ? Math.round((homeWins / matches.length) * 100) : 0;

    if (goalsAvgLabel) goalsAvgLabel.textContent = "Média de gols";
    if (possAvgLabel) possAvgLabel.textContent = "Posse média";
    if (goalsTotalLabel) goalsTotalLabel.textContent = "Total de gols";
    if (homeWinLabel) homeWinLabel.textContent = "% mandantes";
    document.getElementById("kpiGoalsAvg").textContent = mediaGols;
    document.getElementById("kpiPossAvg").textContent = posseAvg ? posseAvg + "%" : "—";
    document.getElementById("kpiGoalsTotal").textContent = totalGols;
    document.getElementById("kpiHomeWin").textContent = homeWinPct + "%";
  }

  // Destaque do Dashboard: o clube favorito (se escolhido em "Clube
  // Favorito", no máximo 1) substitui o líder do campeonato. Sem
  // seleção, o destaque continua sendo o líder normalmente.
  const favIdx = favTeam ? standings.findIndex(r => r.id === favTeam.id) : -1;
  const isFavoriteActive = favTeam && favIdx >= 0;
  const highlightRow = isFavoriteActive ? standings[favIdx] : standings[0];
  const highlightRank = isFavoriteActive ? favIdx + 1 : 1;
  const highlightTeam = highlightRow ? TEAM_MAP[highlightRow.id] : null;
  const highlightLabel = isFavoriteActive ? "Seu clube" : "Líder";
  const highlightIcon = isFavoriteActive ? "⭐" : "🏆";

  document.getElementById("kpiLeaderLabel").textContent = highlightLabel;
  document.getElementById("kpiLeaderIcon").textContent = highlightIcon;
  document.getElementById("kpiLeader").innerHTML = highlightRow ? `${highlightTeam.short} <small>${highlightRow.pts} pts</small>` : "—";

  if (highlightRow) {
    document.getElementById("liderCrest").innerHTML = crestEl(highlightTeam, 52);
    document.getElementById("liderTeamName").textContent = highlightTeam.name;
    document.getElementById("liderLabel").textContent = highlightLabel;
    document.getElementById("liderPts").textContent = highlightRow.pts;
    document.getElementById("liderRank").textContent = isFavoriteActive ? `${highlightRank}º colocado` : "";
    const heroCrest = document.getElementById("liderCrest"), heroName = document.getElementById("liderTeamName");
    heroCrest.classList.add("clickable-team"); heroCrest.onclick = () => goToTeam(highlightTeam.id);
    heroName.classList.add("clickable-team"); heroName.onclick = () => goToTeam(highlightTeam.id);
  }

  // Com favorito ativo, o card "Clube Favorito" (que já ganhou a cor
  // do time — ver renderFavoriteClubCard) já mostra brasão/nome/pts/
  // posição, então esse hero mobile ficaria repetindo a mesma info
  // logo abaixo — escondido nesse caso. Sem favorito, ele volta a
  // aparecer normalmente (mobile-only) mostrando o líder.
  const liderHeroEl = document.getElementById("liderHero");
  if (liderHeroEl) liderHeroEl.style.display = isFavoriteActive ? "none" : "";
}

// Chance de título do Dashboard — top 5 de sempre. Com um Clube
// Favorito selecionado, o nome dele vem em negrito; se não estiver
// entre os 5 primeiros, entra como 6º item só nessa lista (mesma
// lógica de "presa no fim" da tabela de classificação).
function renderDashTitleChance() {
  const liberado = planAllowsAdvanced();
  document.getElementById("dashTitleChanceContent").style.display = liberado ? "block" : "none";
  document.getElementById("dashTitleChanceLocked").style.display = liberado ? "none" : "block";
  if (!liberado) {
    document.getElementById("dashTitleChanceLocked").innerHTML = lockedFeatureHTML(
      "Probabilidades é exclusivo Pro/Enterprise",
      "Veja as chances de título de cada time — desbloqueie fazendo upgrade do seu plano."
    );
    return;
  }
  if (!state.probResults) { runProbabilitiesQuiet(); }
  const favId = state.favoriteClubId;
  const allRanked = TEAMS.map(t => ({ team: t, p: state.probResults[t.id] })).filter(x => x.p).sort((a, b) => b.p.campeao - a.p.campeao);
  let ordered = allRanked.slice(0, 5);
  if (favId && !ordered.some(x => x.team.id === favId)) {
    const favEntry = allRanked.find(x => x.team.id === favId);
    if (favEntry) ordered = [...ordered, favEntry];
  }
  document.getElementById("dashTitleChance").innerHTML = ordered.map(({ team, p }) => `
    <div class="prob-row">
      <div class="top-line">${teamLinkHTML(team, 20, "name", favId && team.id === favId)}<b>${(p.campeao * 100).toFixed(1)}%</b></div>
      <div class="prob-track"><div class="prob-fill" style="width:${Math.max(p.campeao * 100, 1)}%; background:var(--brd-yellow);"></div></div>
    </div>`).join("");
}

// Próximos jogos do Dashboard — com Clube Favorito ativo, mostra os
// próximos jogos DAQUELE time (em vez dos próximos jogos da liga em
// geral), com o nome dele em negrito em cada linha.
function renderDashNextFixtures() {
  const favTeam = activeFavoriteTeam();
  const out = favTeam ? teamNextFixtures(favTeam.id, 4) : leagueNextFixtures(4);
  document.getElementById("dashNextFixtures").innerHTML = out.length
    ? out.map(m => fixtureRowHTML(m, favTeam?.id)).join("")
    : `<div class="empty">Sem jogos futuros cadastrados.</div>`;
}
function leagueNextFixtures(count) {
  const out = [];
  for (let r = firstUndecidedRound(); r <= TOTAL_ROUNDS && out.length < count; r++) {
    getRoundMatches(r).filter(m => m.pending).forEach(m => { if (out.length < count) out.push(m); });
  }
  return out;
}
// Próximos jogos de UM time específico — usada no card "Próximos
// jogos" do Dashboard (quando há favorito) e na página do Time.
function teamNextFixtures(teamId, count) {
  const out = [];
  for (let r = 1; r <= TOTAL_ROUNDS && out.length < count; r++) {
    getRoundMatches(r).filter(m => m.pending && (m.home === teamId || m.away === teamId)).forEach(m => { if (out.length < count) out.push(m); });
  }
  return out;
}

// favId: destaca (negrito) o lado que for o Clube Favorito, quando a
// linha envolve times diferentes (usado no Dashboard). undefined em
// outros lugares (ex: página do Time) não destaca ninguém.
function fixtureRowHTML(m, favId) {
  const H = TEAM_MAP[m.home], A = TEAM_MAP[m.away];
  const domId = `fxrow-odds-${m.round}-${m.home}-${m.away}`;
  if (LIVE_MODE && m.fixtureId) {
    loadFixtureOdds(m.fixtureId).then(odds => {
      const el = document.getElementById(domId);
      if (el && odds) el.innerHTML = `<span>${odds.home?.toFixed(2) ?? "-"}</span><span>${odds.draw?.toFixed(2) ?? "-"}</span><span>${odds.away?.toFixed(2) ?? "-"}</span>`;
    }).catch(() => {});
  }
  return `
  <div class="rail-fixture">
    <div class="when">${fmtFixtureDate(m.date, m.round)}</div>
    <div class="teams">${teamLinkHTML(H, 20, "short", H.id === favId)}<span class="vs">×</span>${teamLinkHTML(A, 20, "short", A.id === favId)}</div>
    <div class="odds3" id="${domId}"><span>—</span><span>—</span><span>—</span></div>
  </div>`;
}

/* ---------- Forma recente ---------- */
function renderFormaInto(containerId, teamId) {
  const list = allDecidedMatches().filter(m => m.home === teamId || m.away === teamId).sort((a, b) => b.round - a.round).slice(0, 5).reverse();
  if (!list.length) { document.getElementById(containerId).innerHTML = `<div class="empty">Sem jogos suficientes.</div>`; return; }
  let v = 0, e = 0, d = 0;
  const dots = list.map(m => {
    const isHome = m.home === teamId;
    const gf = isHome ? m.gh : m.ga, ga = isHome ? m.ga : m.gh;
    let cls, letter;
    if (gf > ga) { cls = "v"; letter = "V"; v++; } else if (gf === ga) { cls = "e"; letter = "E"; e++; } else { cls = "d"; letter = "D"; d++; }
    return `<div class="form-dot ${cls}">${letter}</div>`;
  }).join("");
  const pct = Math.round(((v * 3 + e) / (list.length * 3)) * 100);
  document.getElementById(containerId).innerHTML = `
    <div class="form-dots" style="margin-bottom:12px;">${dots}</div>
    <div style="font-size:12px; color:var(--text-1);">${v} vitória${v !== 1 ? "s" : ""}, ${e} empate${e !== 1 ? "s" : ""}, ${d} derrota${d !== 1 ? "s" : ""}</div>
    <div style="font-size:11px; color:var(--text-2); margin-top:2px;">Aproveitamento: ${pct}%</div>`;
}

/* ---------- Desempenho ofensivo (radar) ---------- */
function radarMetrics() {
  const agg = aggregateTeamStats(allDecidedMatches());
  const per = {};
  Object.entries(agg).forEach(([id, v]) => {
    const j = v.j || 1;
    per[id] = {
      gols: v.gp / j,
      finalizacoes: v.finalizacoes / j,
      escanteios: v.escanteios / j,
      posse: v.j ? v.posseSum / j : 0,
      grandesChances: (v.finalizacoes / j) * 0.35,          // estimado (não vem da API gratuita)
      passesCertos: v.j ? clamp(70 + (v.posseSum / j - 50) * 0.6, 55, 92) : 70, // estimado
    };
  });
  return per;
}
function buildRadarSVG(axes) {
  const cx = 105, cy = 100, maxR = 68, n = axes.length;
  const ang = i => (-90 + i * (360 / n)) * Math.PI / 180;
  const pt = (i, pct) => { const r = maxR * Math.max(pct, 3) / 100; return [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))]; };
  const grid = [0.33, 0.66, 1].map(f => {
    const pts = axes.map((_, i) => { const r = maxR * f; return `${cx + r * Math.cos(ang(i))},${cy + r * Math.sin(ang(i))}`; }).join(" ");
    return `<polygon points="${pts}" fill="none" stroke="var(--border)" stroke-width="1"/>`;
  }).join("");
  const axisLines = axes.map((_, i) => { const x = cx + maxR * Math.cos(ang(i)), y = cy + maxR * Math.sin(ang(i)); return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--border)" stroke-width="1"/>`; }).join("");
  const dataPts = axes.map((a, i) => pt(i, a.pct).join(",")).join(" ");
  const labels = axes.map((a, i) => { const x = cx + (maxR + 26) * Math.cos(ang(i)), y = cy + (maxR + 26) * Math.sin(ang(i)); return `<text x="${x}" y="${y}" font-size="8.5" fill="var(--text-2)" text-anchor="middle" dominant-baseline="middle">${a.label}</text>`; }).join("");
  return `<svg width="230" height="215" viewBox="0 0 210 200">${grid}${axisLines}<polygon points="${dataPts}" fill="rgba(0,87,184,.22)" stroke="var(--brd-blue)" stroke-width="2"/>${labels}</svg>`;
}
function renderRadarInto(containerId, teamId) {
  const metrics = radarMetrics();
  const m = metrics[teamId];
  const el = document.getElementById(containerId);
  if (!m) { el.innerHTML = `<div class="empty">Sem dados suficientes.</div>`; return; }
  const maxOf = key => Math.max(...Object.values(metrics).map(v => v[key]), 0.01);
  const axes = [
    { label: "Gols", pct: m.gols / maxOf("gols") * 100 },
    { label: "Finalizações", pct: m.finalizacoes / maxOf("finalizacoes") * 100 },
    { label: "Posse", pct: m.posse / maxOf("posse") * 100 },
    { label: "Passes certos", pct: m.passesCertos / maxOf("passesCertos") * 100 },
    { label: "Grandes chances", pct: m.grandesChances / maxOf("grandesChances") * 100 },
    { label: "Escanteios", pct: m.escanteios / maxOf("escanteios") * 100 },
  ];
  el.innerHTML = buildRadarSVG(axes) + `<div style="grid-column:1/-1; font-size:9.5px; color:var(--text-2); text-align:center; margin-top:4px;">Grandes chances e passes certos são estimados a partir de outras métricas.</div>`;
}

/* ---------- Comparativo entre times ---------- */
function compareRow(label, a, b, unit = "") {
  const total = a + b || 1;
  return `
  <div class="compare-row">
    <div class="compare-vals"><span>${a.toFixed ? a.toFixed(1) : a}${unit}</span><span>${b.toFixed ? b.toFixed(1) : b}${unit}</span></div>
    <div class="compare-track"><div class="compare-a" style="width:${(a / total) * 100}%"></div><div class="compare-b" style="width:${(b / total) * 100}%"></div></div>
    <div class="compare-label">${label}</div>
  </div>`;
}
function renderCompareInto(containerId, teamAId, teamBId) {
  const el = document.getElementById(containerId);
  if (!teamAId || !teamBId) { el.innerHTML = `<div class="empty">Selecione dois times.</div>`; return; }
  const agg = aggregateTeamStats(allDecidedMatches());
  const A = agg[teamAId], B = agg[teamBId];
  if (!A || !B) { el.innerHTML = `<div class="empty">Sem dados suficientes.</div>`; return; }
  const jA = A.j || 1, jB = B.j || 1;
  el.innerHTML =
    compareRow("Gols marcados/jogo", A.gp / jA, B.gp / jB) +
    compareRow("Gols sofridos/jogo", A.gc / jA, B.gc / jB) +
    compareRow("Posse de bola", A.j ? A.posseSum / jA : 0, B.j ? B.posseSum / jB : 0, "%") +
    compareRow("Finalizações/jogo", A.finalizacoes / jA, B.finalizacoes / jB) +
    compareRow("Escanteios/jogo", A.escanteios / jA, B.escanteios / jB);
}

/* ---------- Odds — próximo jogo + afiliados ---------- */
function nextFixtureWithId() {
  for (let r = firstUndecidedRound(); r <= TOTAL_ROUNDS; r++) {
    const m = getRoundMatches(r).find(x => x.pending);
    if (m) return m;
  }
  return null;
}
// Jogo usado nos cards "Odds — próximo jogo" e "Movimentação de odds"
// do Dashboard: com Clube Favorito ativo, o próximo jogo DAQUELE time;
// sem favorito, o próximo jogo da liga (comportamento padrão).
function dashOddsFixture() {
  const favTeam = activeFavoriteTeam();
  if (favTeam) {
    const fx = teamNextFixtures(favTeam.id, 1)[0];
    if (fx) return fx;
  }
  return nextFixtureWithId();
}
// Tira de afiliados + aviso legal — compartilhada entre o card de odds
// do Dashboard (1 jogo) e o board de odds por rodada em Jogos (vários
// jogos). Nunca duplicar essa lista/aviso em mais de um lugar.
function affiliateComplianceHTML(extraNote = "") {
  const affiliateStrip = AFFILIATE_OPERATORS.map(op => `
    <a class="affiliate-chip ${op.url === "#" ? "disabled" : ""}" style="background:${op.color}" href="${op.url}" target="_blank" rel="sponsored noopener"
       ${op.url === "#" ? 'onclick="return false;" title="Configure em js/affiliates.js"' : ""}>${op.name}</a>`).join("");
  return `
    <div class="affiliate-strip">${affiliateStrip}</div>
    <div class="compliance-line">🔞 Publicidade${extraNote}. Proibido para menores de 18 anos. Jogue com responsabilidade — aposta não é investimento.
      <a href="${RESPONSIBLE_GAMBLING_URL}" target="_blank" rel="noopener">Autoexclusão (gov.br)</a></div>`;
}

// Odds de 1 jogo — real (API-Sports, modo ao vivo) se já tiver
// carregado; senão, em modo de exemplo, cai pra uma odd SIMULADA
// (calculada a partir da mesma força de ataque/defesa que já alimenta
// o simulador — não é número aleatório solto, ver simulatedOddsFor em
// engine.js). Nunca fica sem nada pra mostrar, mas deixa claro quando
// é simulação (ver affiliateComplianceHTML).
function matchOdds(m) {
  if (m.odds) return { odds: m.odds, simulated: false };
  if (!LIVE_MODE) return { odds: simulatedOddsFor(m.home, m.away), simulated: true };
  return { odds: null, simulated: false };
}
function oddsPillsHTML(odds, isLoading, compact = false) {
  if (odds) {
    return `<div class="odds-pills3${compact ? " odds-pills3-compact" : ""}">
      <div class="odds-pill3"><span>Casa</span><b>${odds.home.toFixed(2)}</b></div>
      <div class="odds-pill3"><span>Empate</span><b>${odds.draw.toFixed(2)}</b></div>
      <div class="odds-pill3"><span>Fora</span><b>${odds.away.toFixed(2)}</b></div>
    </div>`;
  }
  return `<div class="empty" style="padding:10px 0;">${isLoading ? "Carregando odds..." : "Odds não disponíveis para este jogo/plano."}</div>`;
}
// Mesmo card de jogo usado na aba Jogos (fullMatchCardHTML) — igual
// visual, igual comportamento (expande "Ver detalhes", odds+parceiros
// já visíveis antes de expandir), só que aqui é sempre o próximo jogo
// em destaque (do Clube Favorito, se houver; senão, o da liga).
function renderDashOdds() {
  const m = dashOddsFixture();
  document.getElementById("dashOddsBlock").innerHTML = m ? fullMatchCardHTML(m) : `<div class="empty">Sem próximos jogos cadastrados.</div>`;
}

/* ---------- Odds + parceiros dentro do próprio card de jogo ----------
   O item de monetização em si: mostra odds (Casa/Empate/Fora) + tira
   de parceiros direto no card de cada jogo pendente, ANTES do botão
   "Ver detalhes" — sem precisar expandir nada. Mantém o layout de
   sempre (1 card por jogo); só jogo pendente (rodada em andamento ou
   prevista) ganha esse bloco — jogo já encerrado não tem valor de
   monetização. Usada por fullMatchCardHTML. */
function matchOddsStripHTML(m) {
  const domId = `oddsstrip-${m.round}-${m.home}-${m.away}`;
  const needsLazyLoad = LIVE_MODE && m.fixtureId && m.odds === undefined;
  if (needsLazyLoad) {
    loadFixtureOdds(m.fixtureId).then(odds => { m.odds = odds; const el = document.getElementById(domId); if (el) el.outerHTML = matchOddsStripHTML(m); })
      .catch(() => { m.odds = null; const el = document.getElementById(domId); if (el) el.outerHTML = matchOddsStripHTML(m); });
  }
  const { odds, simulated } = matchOdds(m);
  return `
    <div class="match-odds-strip" id="${domId}">
      ${oddsPillsHTML(odds, needsLazyLoad, true)}
      ${affiliateComplianceHTML(simulated ? " (odds simuladas — sem integração com casas de apostas ainda)" : "")}
    </div>`;
}

/* ---------- Movimentação de odds ---------- */
function buildLineSVG(points) {
  if (!points.length) return `<div class="empty">Sem histórico de odds ainda — volte depois de algumas consultas.</div>`;
  const W = 300, H = 90, pad = 6;
  const ts = points.map(p => p.t), vs = points.map(p => p.v);
  const minT = Math.min(...ts), maxT = Math.max(...ts) || minT + 1;
  const minV = Math.min(...vs), maxV = Math.max(...vs);
  const spanV = (maxV - minV) || 0.1;
  const xFor = t => pad + (W - 2 * pad) * ((t - minT) / ((maxT - minT) || 1));
  const yFor = v => H - pad - (H - 2 * pad) * ((v - minV) / spanV);
  const pathPts = points.map(p => `${xFor(p.t).toFixed(1)},${yFor(p.v).toFixed(1)}`).join(" ");
  return `<svg width="100%" height="90" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><polyline points="${pathPts}" fill="none" stroke="var(--brd-blue)" stroke-width="2.2"/></svg>`;
}
function syntheticOddsHistory(seedKey, range) {
  const n = { "24h": 8, "7d": 14, "30d": 24 }[range] || 14;
  const spanMs = { "24h": 24 * 60 * 60 * 1000, "7d": 7 * 24 * 60 * 60 * 1000, "30d": 30 * 24 * 60 * 60 * 1000 }[range] || 7 * 24 * 60 * 60 * 1000;
  const rng = mulberry32(Array.from(seedKey).reduce((s, c) => s + c.charCodeAt(0), 0));
  let v = 1.8 + rng() * 1.2;
  const now = Date.now();
  const points = [];
  for (let i = 0; i < n; i++) {
    v = clamp(v + (rng() - 0.5) * 0.15, 1.3, 4.5);
    points.push({ t: now - spanMs + (spanMs / (n - 1)) * i, v: parseFloat(v.toFixed(2)) });
  }
  return points;
}
// Movimentação de odds do PRÓXIMO jogo do time — vive só na página do
// Time agora (ver renderTeamPage), sempre do time em questão.
async function renderOddsChart(teamId) {
  const m = teamNextFixtures(teamId, 1)[0];
  const box = document.getElementById("oddsChart");
  if (!m) { box.innerHTML = `<div class="empty">Sem próximos jogos.</div>`; return; }
  let points;
  if (LIVE_MODE && m.fixtureId) points = await loadOddsHistory(m.fixtureId, state.oddsRange);
  else points = syntheticOddsHistory(`${m.home}-${m.away}`, state.oddsRange);

  const last = points[points.length - 1], first = points[0];
  const delta = last && first ? (((last.v - first.v) / first.v) * 100).toFixed(1) : null;
  const deltaHTML = delta !== null ? `<small class="${delta >= 0 ? "up" : "down"}">${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)}%</small>` : "";
  box.innerHTML = `
    <div class="linechart-val">${last ? last.v.toFixed(2) : "—"} ${deltaHTML}</div>
    <div style="font-size:10.5px; color:var(--text-2); margin-bottom:6px;">${TEAM_MAP[m.home].short} vencer${!LIVE_MODE ? " · dado ilustrativo" : ""}</div>
    ${buildLineSVG(points)}`;
}

/* ---------- Simulador "E se..." ---------- */
function renderWhatIf() {
  const box = document.getElementById("whatifResults");
  const teamId = state.whatifTeamId;
  document.getElementById("whatifN").textContent = state.whatifN;
  if (!teamId) { box.innerHTML = `<div class="empty">Selecione um time.</div>`; return; }
  box.innerHTML = `<div class="empty">Calculando...</div>`;
  setTimeout(() => {
    const result = computeWhatIf(teamId, state.whatifN);
    box.innerHTML = `
      <div class="whatif-tile" style="margin-bottom:10px;"><div class="lbl">Sua posição seria</div><div class="val">${result.pos}º</div></div>
      <div class="whatif-results">
        <div class="whatif-tile"><div class="lbl">Prob. de título</div><div class="val">${(result.scenario.campeao * 100).toFixed(1)}%</div><div class="delta ${result.deltaTitle >= 0 ? "up" : "down"}">${result.deltaTitle >= 0 ? "▲" : "▼"} ${Math.abs(result.deltaTitle).toFixed(1)} p.p.</div></div>
        <div class="whatif-tile"><div class="lbl">Prob. de G4</div><div class="val">${(result.scenario.top4 * 100).toFixed(1)}%</div><div class="delta ${result.deltaG4 >= 0 ? "up" : "down"}">${result.deltaG4 >= 0 ? "▲" : "▼"} ${Math.abs(result.deltaG4).toFixed(1)} p.p.</div></div>
      </div>`;
  }, 20);
}
function computeWhatIf(teamId, n) {
  const baseline = runMonteCarlo(allDecidedMatches(), remainingUndecidedFixtures(), 500, 111)[teamId];
  const future = teamFutureFixtures(teamId).slice(0, n);
  const scratch = { ...MATCH_RESULTS };
  future.forEach(fx => {
    const homeWins = fx.home === teamId;
    scratch[keyFor(fx.round, fx.home, fx.away)] = { home: fx.home, away: fx.away, gh: homeWins ? 2 : 0, ga: homeWins ? 0 : 2, round: fx.round, whatif: true };
  });
  const scenarioRemaining = computeRemaining(scratch);
  const scenario = runMonteCarlo(Object.values(scratch), scenarioRemaining, 500, 222)[teamId];
  return {
    pos: Math.max(1, Math.round(scenario.posMedia)),
    scenario,
    deltaTitle: (scenario.campeao - baseline.campeao) * 100,
    deltaG4: (scenario.top4 - baseline.top4) * 100,
  };
}

/* ================= PÁGINA: JOGOS ================= */
function statBarRow(label, a, b, unit = "") {
  const total = a + b || 1;
  return `
  <div class="stat-bar-row">
    <div class="labels"><span>${a}${unit}</span><span>${b}${unit}</span></div>
    <div class="track"><div class="fill-a" style="width:${(a / total) * 100}%"></div><div class="fill-b" style="width:${(b / total) * 100}%"></div></div>
    <div class="name">${label}</div>
  </div>`;
}
/* ---------- Escalação / substituições (compartilhado entre jogo
   encerrado e jogo futuro) ---------- */
function lineupPlayerLine(p) {
  // Só clicável quando tem id (modo ao vivo) — nomes de escalação do
  // modo demo são fictícios, gerados só pra aquela partida, sem
  // registro persistente pra abrir uma página de detalhe de verdade.
  const nameHTML = p.id
    ? `<span class="lp-name clickable-player" onclick="goToPlayer(${p.id})">${p.name}</span>`
    : `<span class="lp-name">${p.name}</span>`;
  return `<div class="lineup-player"><span class="lp-num">${p.number ?? "-"}</span>${nameHTML}<span class="lp-pos">${p.pos || ""}</span></div>`;
}
function lineupSideHTML(team, lineup) {
  if (!lineup || !lineup.startXI || !lineup.startXI.length) {
    return `<div class="lineup-side"><div class="lineup-head">${teamLinkHTML(team, 20, "short")}</div><div class="empty" style="padding:8px 0;">Escalação ainda não divulgada.</div></div>`;
  }
  return `
    <div class="lineup-side">
      <div class="lineup-head">${teamLinkHTML(team, 20, "short")}${lineup.formation ? `<span class="lineup-formation">${lineup.formation}</span>` : ""}</div>
      ${lineup.coach ? `<div class="lineup-coach">Técnico: ${lineup.coach}</div>` : ""}
      <div class="lineup-list">${lineup.startXI.map(lineupPlayerLine).join("")}</div>
      ${lineup.substitutes && lineup.substitutes.length ? `<div class="lineup-subtitle">Banco</div><div class="lineup-list lineup-subs">${lineup.substitutes.map(lineupPlayerLine).join("")}</div>` : ""}
    </div>`;
}
function lineupsBlockHTML(H, A, lineups) {
  const homeLineup = lineups && lineups[H.id];
  const awayLineup = lineups && lineups[A.id];
  return `<div class="lineups-grid">${lineupSideHTML(H, homeLineup)}${lineupSideHTML(A, awayLineup)}</div>`;
}
function substitutionsHTML(subs) {
  if (!subs || !subs.length) return "";
  return `
    <div class="detail-subtitle">Substituições</div>
    <div class="subs-list">${subs.map(s => {
      const team = TEAM_MAP[s.team];
      const outHTML = s.outId ? `<span class="clickable-player" onclick="goToPlayer(${s.outId})">${s.out}</span>` : s.out;
      const inHTML = s.inId ? `<span class="clickable-player" onclick="goToPlayer(${s.inId})">${s.in}</span>` : s.in;
      return `<div class="sub-line"><b>${s.min}'</b> ${team ? team.short : ""} — <span class="sub-out">↓ ${outHTML}</span> <span class="sub-in">↑ ${inHTML}</span></div>`;
    }).join("")}</div>`;
}
function venueLineHTML(m) {
  const venue = venueFor(m);
  if (!venue) return "";
  return `<div class="venue-line">📍 ${venue.name}${venue.city ? " · " + venue.city : ""}</div>`;
}
// Emissora de TV: em modo ao vivo tenta a fonte comunitária
// (TheSportsDB, via loadBroadcastInfo) — se achar, mostra com um
// aviso de que é dado da comunidade, não confirmado oficialmente.
// Sem achar (ou em modo demo, onde não existe "hoje" real pra
// consultar), cai no texto genérico de sempre.
function watchTvHTML(m) {
  if (LIVE_MODE && m.broadcast) {
    return `<div class="tv-line">📺 <b>${m.broadcast}</b><div class="tv-source">Fonte comunitária (TheSportsDB) — confirme antes de assistir.</div></div>`;
  }
  if (LIVE_MODE && m.broadcast === undefined) {
    return `<div class="tv-line">📺 Buscando emissora...</div>`;
  }
  return `<div class="tv-line">📺 Confira a emissora responsável pela transmissão no guia de programação da sua TV/streaming.</div>`;
}
function demoSeedFor(m) { return keyFor(m.round, m.home, m.away); }
function ensureDemoLineups(m) {
  if (!m.lineups) m.lineups = buildDemoLineups(demoSeedFor(m), m.home, m.away);
  return m.lineups;
}

/* ---------- Corpo expandido: jogo já encerrado ---------- */
function decidedMatchDetailHTML(m, domId) {
  const needsLazyLoad = LIVE_MODE && m.fixtureId && !m.stats;
  if (needsLazyLoad) {
    loadFixtureDetails(m.fixtureId, m.home, m.away).then(det => {
      m.stats = det.stats; m.goals = det.goals; m.substitutions = det.substitutions; m.lineups = det.lineups;
      const el = document.getElementById(domId); if (el) el.outerHTML = fullMatchCardHTML(m);
    }).catch(() => {});
    return `<div class="empty">Carregando detalhes da partida...</div>`;
  }
  if (!m.stats) return `<div class="empty">Estatísticas não disponíveis para este jogo.</div>`;
  if (!LIVE_MODE) ensureDemoLineups(m);
  if (!LIVE_MODE && !m.substitutions) m.substitutions = buildDemoSubstitutions(demoSeedFor(m), m.home, m.away, m.lineups);

  const H = TEAM_MAP[m.home], A = TEAM_MAP[m.away];
  const goals = m.goals || [];
  const goalsHTML = goals.length ? `
    <div class="goals-list">${goals.map(g => {
      const scorer = g.player || ("Camisa " + g.camisa);
      const scorerHTML = g.playerId ? `<span class="clickable-player" onclick="goToPlayer(${g.playerId})">${scorer}</span>` : scorer;
      return `<div class="goal-line"><b>${g.min}'</b> ⚽ ${TEAM_MAP[g.team].short} · ${scorerHTML}</div>`;
    }).join("")}</div>`
    : `<div class="goals-list"><div class="goal-line">Sem gols na partida.</div></div>`;
  const s = m.stats;
  return `
    <div class="detail-subtitle">Gols</div>
    ${goalsHTML}
    ${substitutionsHTML(m.substitutions)}
    <div class="detail-subtitle">Escalações</div>
    ${lineupsBlockHTML(H, A, m.lineups)}
    <div class="detail-subtitle">Estatísticas gerais</div>
    <div>
      ${statBarRow("Posse de bola", s.posse[0], s.posse[1], "%")}
      ${statBarRow("Finalizações", s.finalizacoes[0], s.finalizacoes[1])}
      ${statBarRow("Escanteios", s.escanteios[0], s.escanteios[1])}
      ${statBarRow("Cartões amarelos", s.amarelos[0], s.amarelos[1])}
    </div>
    ${watchLink(H, A, m.gh, m.ga)}`;
}

/* ---------- Corpo expandido: jogo futuro ---------- */
function pendingMatchDetailHTML(m, domId) {
  const H = TEAM_MAP[m.home], A = TEAM_MAP[m.away];
  if (!LIVE_MODE) ensureDemoLineups(m);
  const needsLazyLoad = LIVE_MODE && m.fixtureId && m.lineups === undefined;
  if (needsLazyLoad) {
    loadFixtureLineups(m.fixtureId).then(lineups => {
      m.lineups = lineups; const el = document.getElementById(domId); if (el) el.outerHTML = fullMatchCardHTML(m);
    }).catch(() => { m.lineups = {}; });
  }
  const needsBroadcastLoad = LIVE_MODE && m.date && m.broadcast === undefined;
  if (needsBroadcastLoad) {
    loadBroadcastInfo(m.date, H.name, A.name).then(station => {
      m.broadcast = station; const el = document.getElementById(domId); if (el) el.outerHTML = fullMatchCardHTML(m);
    }).catch(() => { m.broadcast = null; });
  }
  return `
    <div class="detail-subtitle">Escalação provável</div>
    ${m.lineups === undefined ? `<div class="empty">Carregando escalação...</div>` : lineupsBlockHTML(H, A, m.lineups)}
    <div class="detail-subtitle">Onde e quando</div>
    <div class="venue-line">🗓️ ${fmtFixtureDate(m.date, m.round)}</div>
    ${venueLineHTML(m)}
    ${watchTvHTML(m)}`;
}

function fullMatchCardHTML(m) {
  const H = TEAM_MAP[m.home], A = TEAM_MAP[m.away];
  const domId = `match-${m.round}-${m.home}-${m.away}`;
  MATCH_REGISTRY[domId] = m;
  const scoreHTML = m.pending ? `<span class="dash">vs</span>` : `${m.gh} <span class="dash">×</span> ${m.ga}`;
  const metaHTML = m.pending
    ? `<span class="pending-tag">${fmtFixtureDate(m.date, m.round)}</span>`
    : `Rodada ${m.round} ${m.simulated ? "· simulado" : "· encerrado"}`;
  // Só monta (e só dispara os fetches lazy de dentro de pending/decidedMatchDetailHTML)
  // quando o card está de fato expandido — fechado, nem consulta a API nem gasta cota.
  const detailHTML = !m.expanded ? "" : (m.pending ? pendingMatchDetailHTML(m, domId) : decidedMatchDetailHTML(m, domId));
  return `
    <div class="match-card" id="${domId}">
      <div class="match-teams">
        <div class="match-team clickable-team" onclick="goToTeam('${H.id}')">${crestEl(H, 40)}<span class="tname">${H.name}</span></div>
        <div class="match-score">${scoreHTML}</div>
        <div class="match-team clickable-team" onclick="goToTeam('${A.id}')">${crestEl(A, 40)}<span class="tname">${A.name}</span></div>
      </div>
      <div class="match-meta">${metaHTML}</div>
      ${m.pending ? matchOddsStripHTML(m) : ""}
      <button class="match-toggle" onclick="toggleMatchExpand('${domId}')">${m.expanded ? "Ocultar detalhes ▴" : "Ver detalhes ▾"}</button>
      <div class="match-detail" style="display:${m.expanded ? "block" : "none"};">${detailHTML}</div>
    </div>`;
}
const MATCH_REGISTRY = {};
function toggleMatchExpand(domId) {
  const m = MATCH_REGISTRY[domId];
  if (!m) return;
  m.expanded = !m.expanded;
  const el = document.getElementById(domId);
  if (el) el.outerHTML = fullMatchCardHTML(m);
}
function renderJogos() {
  document.getElementById("roundLabel").textContent = `Rodada ${state.jogosRound}`;
  document.getElementById("roundSubLabel").textContent = isRoundDecided(state.jogosRound) ? "encerrada" : (state.jogosRound === firstUndecidedRound() ? "em andamento" : "a definir");
  document.getElementById("matchesList").innerHTML = getRoundMatches(state.jogosRound).map(fullMatchCardHTML).join("");
  renderEstatisticasConsolidadas("statTiles", "leaderAtaque", "leaderDefesa");
}

function aggregateTeamStats(matches) {
  const agg = {};
  Object.keys(TEAM_MAP).forEach(id => agg[id] = { finalizacoes: 0, escanteios: 0, amarelos: 0, vermelhos: 0, gp: 0, gc: 0, j: 0, posseSum: 0 });
  matches.forEach(m => {
    const H = agg[m.home], A = agg[m.away];
    H.j++; A.j++;
    H.gp += m.gh; H.gc += m.ga; A.gp += m.ga; A.gc += m.gh;
    if (m.stats) {
      H.finalizacoes += m.stats.finalizacoes[0]; A.finalizacoes += m.stats.finalizacoes[1];
      H.escanteios += m.stats.escanteios[0]; A.escanteios += m.stats.escanteios[1];
      H.amarelos += m.stats.amarelos[0]; A.amarelos += m.stats.amarelos[1];
      H.vermelhos += m.stats.vermelhos[0]; A.vermelhos += m.stats.vermelhos[1];
      H.posseSum += m.stats.posse[0]; A.posseSum += m.stats.posse[1];
    }
  });
  return agg;
}
function renderEstatisticasConsolidadas(tilesId, ataqueId, defesaId, cartoesId) {
  const matches = allDecidedMatches();
  const agg = aggregateTeamStats(matches);
  const totalGols = matches.reduce((s, m) => s + m.gh + m.ga, 0);
  const withStats = matches.filter(m => m.stats);
  const totalCartoes = withStats.reduce((s, m) => s + m.stats.amarelos[0] + m.stats.amarelos[1] + m.stats.vermelhos[0] + m.stats.vermelhos[1], 0);
  const mediaGols = matches.length ? (totalGols / matches.length).toFixed(2) : "0.00";
  document.getElementById(tilesId).innerHTML = `
    <div class="card kpi"><div class="ico blue">⚽</div><div><div class="lbl">Jogos</div><div class="val">${matches.length}</div></div></div>
    <div class="card kpi"><div class="ico green">🥅</div><div><div class="lbl">Gols marcados</div><div class="val">${totalGols}</div></div></div>
    <div class="card kpi"><div class="ico yellow">📊</div><div><div class="lbl">Média de gols</div><div class="val">${mediaGols}</div></div></div>
    <div class="card kpi"><div class="ico navy">🟨</div><div><div class="lbl">Cartões</div><div class="val">${totalCartoes}</div></div></div>`;
  const leaderRow = (id, value) => { const t = TEAM_MAP[id]; return `<tr><td>${teamLinkHTML(t, 22)}</td><td class="num" style="font-weight:700;">${value}</td></tr>`; };
  const byAtaque = Object.entries(agg).filter(([,v]) => v.j > 0).sort((a, b) => b[1].gp - a[1].gp).slice(0, 5);
  const byDefesa = Object.entries(agg).filter(([,v]) => v.j > 0).sort((a, b) => a[1].gc - b[1].gc).slice(0, 5);
  document.getElementById(ataqueId).innerHTML = byAtaque.length ? byAtaque.map(([id, v]) => leaderRow(id, `${v.gp} gols`)).join("") : `<tr><td class="empty">Sem dados.</td></tr>`;
  document.getElementById(defesaId).innerHTML = byDefesa.length ? byDefesa.map(([id, v]) => leaderRow(id, `${v.gc} sofridos`)).join("") : `<tr><td class="empty">Sem dados.</td></tr>`;
  if (cartoesId) {
    const byCartoes = Object.entries(agg).filter(([,v]) => v.j > 0).sort((a, b) => (b[1].amarelos + b[1].vermelhos * 2) - (a[1].amarelos + a[1].vermelhos * 2)).slice(0, 5);
    document.getElementById(cartoesId).innerHTML = byCartoes.length ? byCartoes.map(([id, v]) => leaderRow(id, `${v.amarelos + v.vermelhos} cartões`)).join("") : `<tr><td class="empty">Sem dados.</td></tr>`;
  }
}

/* ================= PÁGINA: TABELA ================= */
function renderTabela() {
  const standings = currentStandings();
  document.getElementById("tabelaHint").textContent = LIVE_MODE ? "dados ao vivo" : `${firstUndecidedRound() - 1}ª rodada`;
  document.getElementById("fullStandings").innerHTML = standings.map((r, i) => fullRowHTML(r, i + 1)).join("") || `<tr><td colspan="6" class="empty">Sem jogos decididos ainda.</td></tr>`;
  document.querySelectorAll("#fullStandings .fav-heart").forEach(h => h.addEventListener("click", onToggleFavoriteClick));
}

/* ================= PÁGINA: ESTATÍSTICAS ================= */
function renderEstatisticasPage() {
  renderEstatisticasConsolidadas("statTiles2", "leaderAtaque2", "leaderDefesa2", "leaderCartoes2");
  const comparadorLiberado = planAllowsAdvanced();
  document.getElementById("comparativoCardContent").style.display = comparadorLiberado ? "block" : "none";
  document.getElementById("comparativoCardLocked").style.display = comparadorLiberado ? "none" : "block";
  if (comparadorLiberado) {
    renderCompareInto("compareBody2", document.getElementById("compareTeamA2").value, document.getElementById("compareTeamB2").value);
  } else {
    document.getElementById("comparativoCardLocked").innerHTML = lockedFeatureHTML(
      "Comparador de times é exclusivo Pro/Enterprise",
      "Compare o desempenho entre dois times lado a lado — desbloqueie fazendo upgrade do seu plano."
    );
  }
  renderRadarInto("radarChart2", document.getElementById("radarTeamSelect2").value);
  if (state.estatisticasSub === "jogadores") renderJogadoresPage();
}

/* ---------- Jogadores (sub-aba de Estatísticas) ---------- */
// Modo demo: elenco fictício de data.js, já pronto. Modo ao vivo:
// busca uma vez só (lazy) os rankings da API-Sports e guarda em
// memória — reabrir a sub-aba depois não gera novas chamadas.
let playersListCache = null;
async function ensurePlayersLoaded() {
  if (playersListCache) return playersListCache;
  playersListCache = LIVE_MODE ? await loadPlayersLeaders(LIVE_SEASON, state.competitionId) : activeDemoPlayers;
  return playersListCache;
}
function playerCardsValue(p) { return p.yellow + p.red * 2; }
// Linha compacta pro card de cada categoria — mesmo visual das
// listas "Melhor ataque/defesa" (crest + nome + valor em destaque).
function playerLeaderRowHTML(p, valueLabel) {
  const team = TEAM_MAP[p.teamId];
  return `<tr>
    <td><div class="team-cell">${team ? crestEl(team, 22) : ""}<b class="clickable-player" onclick="goToPlayer(${p.id})">${p.name}</b>${team ? `<span class="clickable-team" onclick="goToTeam('${team.id}')" style="color:var(--text-2); font-weight:500;"> · ${team.short}</span>` : ""}</div></td>
    <td class="num" style="font-weight:700;">${valueLabel}</td>
  </tr>`;
}
function renderPlayerLeaderCard(elId, players, count = 5) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = players.length
    ? players.slice(0, count).map(([p, label]) => playerLeaderRowHTML(p, label)).join("")
    : `<tr><td class="empty">Sem dados.</td></tr>`;
}
async function renderJogadoresPage() {
  const hint = document.getElementById("playersHint");
  ["playersGoals", "playersAssists", "playersCards", "playersRating"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<tr><td class="empty">Carregando...</td></tr>`;
  });
  const players = await ensurePlayersLoaded();
  if (state.estatisticasSub !== "jogadores") return; // usuário já trocou de sub-aba enquanto carregava

  const byGoals = [...players].sort((a, b) => b.goals - a.goals).map(p => [p, `${p.goals} gols`]);
  const byAssists = [...players].sort((a, b) => b.assists - a.assists).map(p => [p, `${p.assists} assist.`]);
  const byCards = [...players].sort((a, b) => playerCardsValue(b) - playerCardsValue(a))
    .map(p => [p, p.red > 0 ? `${p.yellow} <span style="color:var(--brd-red);">+${p.red}V</span>` : `${p.yellow}`]);
  const rated = players.filter(p => p.rating != null);
  const byRating = rated.sort((a, b) => b.rating - a.rating).map(p => [p, p.rating.toFixed(1)]);

  renderPlayerLeaderCard("playersGoals", byGoals);
  renderPlayerLeaderCard("playersAssists", byAssists);
  renderPlayerLeaderCard("playersCards", byCards);
  renderPlayerLeaderCard("playersRating", byRating);
  if (hint) hint.textContent = LIVE_MODE ? "top 5 de cada categoria · dados ao vivo" : "top 5 de cada categoria · dados de exemplo";
}

/* ================= PÁGINA: SIMULADOR ================= */
function renderSimulador() {
  const compName = (COMPETITION_META[state.competitionId] || COMPETITION_META.brasileirao).name;
  document.getElementById("simuladorSub").textContent = `Monte o final do ${compName}, rodada a rodada`;
  const liberado = planAllowsAdvanced();
  document.getElementById("simuladorContent").style.display = liberado ? "grid" : "none";
  document.getElementById("simuladorLocked").style.display = liberado ? "none" : "block";
  if (!liberado) {
    document.getElementById("simuladorLocked").innerHTML = lockedFeatureHTML(
      "Simulador é exclusivo Pro/Enterprise",
      "Monte o final do Brasileirão rodada a rodada e veja a tabela reagir em tempo real — desbloqueie fazendo upgrade do seu plano."
    );
    return;
  }
  document.getElementById("simRoundLabel").textContent = `Rodada ${state.simRound}`;
  document.getElementById("simRoundSubLabel").textContent = LIVE_MODE ? "Projeção" : "Returno";
  const fixtures = getRoundFixtures(state.simRound);
  document.getElementById("simMatchesList").innerHTML = fixtures.map(fx => {
    const H = TEAM_MAP[fx.home], A = TEAM_MAP[fx.away];
    const k = keyFor(state.simRound, fx.home, fx.away);
    const existing = MATCH_RESULTS[k];
    const locked = existing && existing.official;
    return `
    <div class="sim-card" data-key="${k}" data-home="${fx.home}" data-away="${fx.away}">
      <div class="sim-teams">
        <div class="match-team clickable-team" onclick="goToTeam('${H.id}')" style="flex-direction:row; gap:8px;">${crestEl(H, 30)}<span class="tname">${H.short}</span></div>
        <div class="sim-inputs">
          <input class="score-input inp-h" type="number" min="0" max="15" value="${existing ? existing.gh : ""}" placeholder="-" ${locked ? "disabled" : ""}>
          <span class="dash">×</span>
          <input class="score-input inp-a" type="number" min="0" max="15" value="${existing ? existing.ga : ""}" placeholder="-" ${locked ? "disabled" : ""}>
        </div>
        <div class="match-team clickable-team" onclick="goToTeam('${A.id}')" style="flex-direction:row-reverse; gap:8px;">${crestEl(A, 30)}<span class="tname">${A.short}</span></div>
      </div>
      <div class="match-actions">
        ${locked ? `<div class="pending-tag" style="margin:0 auto;">Resultado real confirmado</div>` : `<button class="btn-sm btn-dice">🎲 Aleatório</button><button class="btn-sm primary btn-confirm">${existing ? "✔ Atualizar" : "Confirmar"}</button>`}
      </div>
    </div>`;
  }).join("");
  document.querySelectorAll(".btn-confirm").forEach(btn => btn.addEventListener("click", onConfirmSim));
  document.querySelectorAll(".btn-dice").forEach(btn => btn.addEventListener("click", onDiceSim));
  renderSimStandings();
}
// Tabela na barra lateral do Simulador — chamada de dentro de
// renderSimulador(), então atualiza sozinha a cada confirmação,
// "Aleatório", "Simular rodada/temporada" ou "Limpar simulações"
// (todos passam por refreshAll() -> setActivePage() -> renderSimulador()).
function renderSimStandings() {
  const el = document.getElementById("simStandings");
  if (!el) return;
  const standings = currentStandings();
  el.innerHTML = standings.map((r, i) => simTableRowHTML(r, i + 1)).join("")
    || `<tr><td colspan="5" class="empty">Sem jogos decididos ainda.</td></tr>`;
}
function onConfirmSim(e) {
  const card = e.target.closest(".sim-card");
  const home = card.dataset.home, away = card.dataset.away;
  const gh = parseInt(card.querySelector(".inp-h").value, 10), ga = parseInt(card.querySelector(".inp-a").value, 10);
  if (isNaN(gh) || isNaN(ga) || gh < 0 || ga < 0) { card.querySelector(".inp-h").focus(); return; }
  MATCH_RESULTS[card.dataset.key] = buildMatchFromScore(home, away, gh, ga, state.simRound, freshRng());
  refreshAll();
}
function onDiceSim(e) {
  const card = e.target.closest(".sim-card");
  const r = simulateMatch(card.dataset.home, card.dataset.away, freshRng());
  r.round = state.simRound; r.simulated = true;
  MATCH_RESULTS[card.dataset.key] = r;
  refreshAll();
}
function buildMatchFromScore(homeId, awayId, gh, ga, round, rng) {
  const posseHome = clamp(Math.round(50 + (gh - ga) * 5 + (rng() - 0.5) * 10), 30, 70);
  const finalizacoesHome = clamp(Math.round(8 + gh * 2.2 + rng() * 6), 4, 24);
  const finalizacoesAway = clamp(Math.round(8 + ga * 2.2 + rng() * 6), 4, 24);
  const escanteiosHome = clamp(Math.round(3 + rng() * 6 + gh), 1, 14);
  const escanteiosAway = clamp(Math.round(3 + rng() * 6 + ga), 1, 14);
  const amarelosHome = clamp(Math.round(rng() * 4), 0, 6);
  const amarelosAway = clamp(Math.round(rng() * 4), 0, 6);
  const goals = [];
  for (let i = 0; i < gh; i++) goals.push({ team: homeId, min: 1 + Math.floor(rng() * 90), camisa: 1 + Math.floor(rng() * 30) });
  for (let i = 0; i < ga; i++) goals.push({ team: awayId, min: 1 + Math.floor(rng() * 90), camisa: 1 + Math.floor(rng() * 30) });
  goals.sort((a, b) => a.min - b.min);
  return {
    home: homeId, away: awayId, gh, ga, round, simulated: true,
    stats: { posse: [posseHome, 100 - posseHome], finalizacoes: [finalizacoesHome, finalizacoesAway], escanteios: [escanteiosHome, escanteiosAway], amarelos: [amarelosHome, amarelosAway], vermelhos: [rng() < 0.04 ? 1 : 0, rng() < 0.04 ? 1 : 0] },
    goals,
  };
}
function freshRng() { return mulberry32(Math.floor(Math.random() * 1e9)); }

/* ================= PÁGINA: PROBABILIDADES ================= */
function runProbabilitiesQuiet() {
  state.probResults = runMonteCarlo(allDecidedMatches(), remainingUndecidedFixtures(), 1200, Math.floor(Math.random() * 1e9));
}
function runProbabilities() {
  const btn = document.getElementById("btnRecalc");
  if (btn) btn.textContent = "Calculando...";
  setTimeout(() => {
    runProbabilitiesQuiet();
    if (btn) btn.textContent = "🔁 Recalcular simulação (1.500 cenários)";
    renderProbList();
    if (state.page === "dashboard") renderDashTitleChance();
  }, 30);
}
function renderProbList() {
  const container = document.getElementById("probList");
  if (!state.probResults) { container.innerHTML = `<div class="card empty">Toque em "Recalcular simulação" para estimar as chances.</div>`; return; }
  const sortKey = state.probSort;
  const ordered = TEAMS.map(t => ({ team: t, p: state.probResults[t.id] })).filter(x => x.p).sort((a, b) => b.p[sortKey] - a.p[sortKey]);
  container.innerHTML = ordered.map(({ team, p }) => `
    <div class="card" style="margin-bottom:12px;">
      <div class="card-head"><div class="team-cell clickable-team" onclick="goToTeam('${team.id}')">${crestEl(team, 26)}<span style="font-weight:700;">${team.name}</span></div><span style="font-size:10.5px; color:var(--text-2);">pos. média ${p.posMedia.toFixed(1)}</span></div>
      <div class="tubes">
        <div class="tube campeao"><span class="pct">${(p.campeao * 100).toFixed(0)}%</span><div class="liquid" style="height:${Math.max(p.campeao * 100, 2)}%"></div></div>
        <div class="tube libertadores"><span class="pct">${(p.libertadores * 100).toFixed(0)}%</span><div class="liquid" style="height:${Math.max(p.libertadores * 100, 2)}%"></div></div>
        <div class="tube sula"><span class="pct">${(p.sulamericana * 100).toFixed(0)}%</span><div class="liquid" style="height:${Math.max(p.sulamericana * 100, 2)}%"></div></div>
        <div class="tube rebaixamento"><span class="pct">${(p.rebaixamento * 100).toFixed(0)}%</span><div class="liquid" style="height:${Math.max(p.rebaixamento * 100, 2)}%"></div></div>
      </div>
      <div class="tube-labels"><span>Título</span><span>Liberta</span><span>Sula</span><span>Z4</span></div>
    </div>`).join("");
}

/* ================= FAVORITOS / MEUS TIMES ================= */
// Favoritos são por campeonato (o id de um time do Brasileirão não
// existe nos outros campeonatos, e vice-versa) — chave de storage leva
// o sufixo da competição ativa. Pra quem já tinha favoritos salvos
// antes dessa mudança (só existia Brasileirão), migra automaticamente
// da chave antiga (sem sufixo) na primeira leitura desse campeonato.
function favoritesStorageKey() { return `brdata_favorites_${state.competitionId}`; }
function loadFavorites() {
  try {
    let raw = localStorage.getItem(favoritesStorageKey());
    if (raw === null && state.competitionId === "brasileirao") raw = localStorage.getItem("brdata_favorites");
    state.favorites = raw ? JSON.parse(raw) : [];
  } catch { state.favorites = []; }
}
function saveFavorites() {
  try { localStorage.setItem(favoritesStorageKey(), JSON.stringify(state.favorites)); } catch {}
}
function toggleFavorite(teamId) {
  const i = state.favorites.indexOf(teamId);
  if (i >= 0) state.favorites.splice(i, 1); else state.favorites.push(teamId);
  saveFavorites();
  renderMyTeamsSidebar();
  if (state.page === "tabela") renderTabela();
  if (state.page === "favoritos") renderFavoritosPage();
}
function onToggleFavoriteClick(e) { e.stopPropagation(); toggleFavorite(e.currentTarget.dataset.team); }

function renderMyTeamsSidebar() {
  const box = document.getElementById("myTeamsList");
  if (!state.favorites.length) { box.innerHTML = `<div style="font-size:11.5px; color:#8FA3C7; padding:4px 10px 8px;">Nenhum time favoritado ainda.</div>`; return; }
  box.innerHTML = state.favorites.map(id => {
    const t = TEAM_MAP[id]; if (!t) return "";
    return `<div class="side-link clickable-team" onclick="goToTeam('${id}')">${crestEl(t, 18)}<span style="margin-left:2px;">${t.name}</span><span class="heart" data-team="${id}" title="Remover">✕</span></div>`;
  }).join("");
  box.querySelectorAll(".heart").forEach(h => h.addEventListener("click", (e) => { e.stopPropagation(); toggleFavorite(h.dataset.team); }));
}
function renderFavoritosPage() {
  const box = document.getElementById("favoritesList");
  if (!state.favorites.length) { box.innerHTML = `<div class="empty">Você ainda não favoritou nenhum time. Clique no ♡ ao lado de um time na Tabela.</div>`; return; }
  const standings = currentStandings();
  box.innerHTML = state.favorites.map(id => {
    const idx = standings.findIndex(r => r.id === id);
    const row = standings[idx];
    const t = TEAM_MAP[id];
    return `<div class="fixture-row">
      <div class="fixture-teams clickable-team" onclick="goToTeam('${id}')">${crestEl(t, 26)}<span>${t.name}</span></div>
      <div style="font-size:12px; color:var(--text-1);">${row ? `${idx + 1}º · ${row.pts} pts` : "—"}</div>
    </div>`;
  }).join("");
}

/* ================= CLUBE FAVORITO (destaque da página inicial) =========
   Diferente de FAVORITOS acima (lista de vários times, pra acompanhar na
   barra lateral) — aqui é NO MÁXIMO 1 clube, que substitui o líder do
   campeonato no destaque do Dashboard. Sem seleção, volta a mostrar o
   líder normalmente. */
// Mesma lógica de escopo por competição (+ migração) dos favoritos
// acima, pro clube favorito único do Dashboard.
function favoriteClubStorageKey() { return `brdata_favorite_club_${state.competitionId}`; }
function loadFavoriteClub() {
  try {
    let v = localStorage.getItem(favoriteClubStorageKey());
    if (v === null && state.competitionId === "brasileirao") v = localStorage.getItem("brdata_favorite_club");
    state.favoriteClubId = v || null;
  } catch { state.favoriteClubId = null; }
}
function saveFavoriteClub() {
  try {
    if (state.favoriteClubId) localStorage.setItem(favoriteClubStorageKey(), state.favoriteClubId);
    else localStorage.removeItem(favoriteClubStorageKey());
  } catch {}
}
function applyFavoriteClub(newId) {
  state.favoriteClubId = newId || null;
  saveFavoriteClub();
  renderDashboard();
}
function onFavoriteClubChange(e) { applyFavoriteClub(e.target.value); }
function clearFavoriteClub() { applyFavoriteClub(null); }

// Card "Clube Favorito" do Dashboard — dois estados:
// 1) Sem favorito: card neutro com o seletor de time.
// 2) Com favorito: o seletor some, e o card inteiro vira as cores do
//    clube (ex: Flamengo = vermelho/preto), com um botão pra trocar.
function renderFavoriteClubCard(standings) {
  const box = document.getElementById("favClubCard");
  if (!box) return;
  const favTeam = activeFavoriteTeam();

  if (!favTeam) {
    box.style.cssText = "margin-bottom:16px;";
    box.innerHTML = `
      <div class="card-head"><h3>⭐ Clube Favorito</h3></div>
      <p class="fav-club-hint">Escolha 1 clube para deixá-lo em destaque na página inicial no lugar do líder do campeonato. Sem seleção, o destaque continua sendo o líder.</p>
      <select class="compare-select fav-club-select" id="favoriteClubSelect"></select>`;
    const sel = document.getElementById("favoriteClubSelect");
    const sorted = [...TEAMS].sort((a, b) => a.name.localeCompare(b.name));
    sel.innerHTML = `<option value="">— Nenhum (exibir líder do campeonato) —</option>` +
      sorted.map(t => `<option value="${t.id}">${t.name}</option>`).join("");
    sel.value = "";
    sel.addEventListener("change", onFavoriteClubChange);
    return;
  }

  // Camada escura semi-transparente sobre o gradiente do clube — sem
  // isso, times com uma cor clara (ex: Botafogo preto/BRANCO) deixavam
  // o texto/botão brancos ilegíveis do lado claro do degradê.
  box.style.cssText = `margin-bottom:16px; border:none; color:#fff;
    background:linear-gradient(135deg, rgba(0,0,0,.4), rgba(0,0,0,.12)), linear-gradient(135deg, ${favTeam.c1 || "#0057B8"}, ${favTeam.c2 || "#062B5C"});`;
  // Posição/pontos do time (mesma informação que o hero mobile
  // "Líder/Seu clube" mostrava) — trazida pra cá pra esse card ser a
  // única fonte de destaque do favorito; ver ocultação do .lider-hero
  // em renderDashKpis, que evita repetir os dois cards no mobile.
  const idx = standings ? standings.findIndex(r => r.id === favTeam.id) : -1;
  const metaHTML = idx >= 0 ? `<div class="fav-club-active-meta">${idx + 1}º colocado · ${standings[idx].pts} pts</div>` : "";
  box.innerHTML = `
    <div class="fav-club-active">
      <div class="fav-club-active-info">
        ${crestEl(favTeam, 46)}
        <div>
          <div class="fav-club-active-lbl">⭐ Clube Favorito</div>
          <div class="fav-club-active-name">${favTeam.name}</div>
          ${metaHTML}
        </div>
      </div>
      <button class="fav-club-remove" onclick="clearFavoriteClub()">Trocar time</button>
    </div>`;
}

/* ================= TEMA CLARO/ESCURO ================= */
function initTheme() {
  let theme = "light";
  try { theme = localStorage.getItem("brdata_theme") || "light"; } catch {}
  document.documentElement.setAttribute("data-theme", theme);
  document.getElementById("themeSwitch").classList.toggle("on", theme === "dark");
  document.getElementById("themeSwitchMobile")?.classList.toggle("on", theme === "dark");
}
function toggleTheme() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const next = isDark ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  document.getElementById("themeSwitch").classList.toggle("on", next === "dark");
  document.getElementById("themeSwitchMobile")?.classList.toggle("on", next === "dark");
  try { localStorage.setItem("brdata_theme", next); } catch {}
}

/* ================= Botão "Atualizar app" (PWA + modo Exemplo) =================
   Só some do jeito certo se: (a) o site está instalado/rodando como
   PWA (display-mode: standalone — iOS mais antigo usa
   navigator.standalone, que o media query não cobre) e (b) o app caiu
   no modo Exemplo (sem dado real). Nessas condições, dá pra estar
   vendo uma versão desatualizada do app shell (JS/CSS) cacheada pelo
   service worker — o botão limpa esse cache e recarrega, forçando
   buscar tudo de novo do servidor. */
function isStandalonePWA() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
}

function updateRefreshButtonVisibility() {
  const btn = document.getElementById("btnForceRefresh");
  if (!btn) return;
  btn.style.display = (isStandalonePWA() && !LIVE_MODE) ? "flex" : "none";
}

async function forceRefreshApp() {
  const btn = document.getElementById("btnForceRefresh");
  if (btn) { btn.disabled = true; btn.classList.add("spinning"); }
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    // Também pede pro service worker checar se sw.js mudou — não é
    // estritamente necessário (o server já manda sw.js com
    // Cache-Control: no-cache, e o install/activate dele já ativa a
    // versão nova na hora), mas não custa garantir.
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
  } catch (err) {
    console.warn("[refresh] falha ao limpar cache:", err);
  }
  location.reload();
}

/* ================= NOTÍCIAS ================= */
// Feed RSS real (busca do Google Notícias por "Brasileirão"/"futebol
// brasileiro", agregando vários veículos — ver server/src/newsSource.js).
async function renderNews() {
  const box = document.getElementById("newsList");
  box.innerHTML = `<div class="empty" style="padding:12px 0;">Carregando notícias...</div>`;
  const items = await loadNews();
  box.innerHTML = items.length
    ? items.map(n => `
      <a class="news-item" href="${n.link}" target="_blank" rel="noopener">
        <div class="news-thumb"></div>
        <div><span class="tag tag-blue">${n.source || "Notícia"}</span><h4>${n.title}</h4><div class="meta">${timeAgo(n.pubDate)}</div></div>
      </a>`).join("")
    : `<div class="empty" style="padding:12px 0;">Não foi possível carregar notícias agora. Tente novamente mais tarde.</div>`;
}

/* ================= Login / Cadastro obrigatório =================
   Fluxo:
   1) boot() pergunta pro backend GET /api/auth/me. Sem sessão válida
      -> renderAuthGate() (tela cheia, .shell escondida).
   2) No gate, escolhe um plano (inclusive Freemium, grátis) + preenche
      nome/telefone/e-mail/senha -> POST /api/auth/signup.
        - Freemium: conta já ativa, só falta logar -> mostra a view de
          login com um aviso.
        - Plano pago: backend já devolve a URL de checkout do Mercado
          Pago (cartão/PIX) -> sai do site, vai pra lá.
   3) Mercado Pago traz o usuário de volta (?status=...&external_
      reference=...) -> gate detecta, confirma com o backend, mostra o
      resultado e empurra pra view de login.
   4) POST /api/auth/login -> cookie de sessão -> startApp() sem
      precisar recarregar a página.
   5) Se a sessão existe mas o pagamento ainda não confirmou
      (planStatus != "active"), mostra a view "pending" — permite
      retomar o pagamento (POST /api/support/checkout, agora
      autenticado) ou sair.
   Depois de logado, a página "Apoie o BR Data" (renderApoiePage) vira
   tela de UPGRADE de plano — mesmos cards, sem formulário (já temos
   nome/telefone/e-mail da conta). */

let apoiePlansCache = null;
let apoieReturnStatus = null; // { status, ref } | null — lido 1x na 1ª renderização do gate
let gateSelectedPlan = null;

function fmtBRL(v) {
  if (!v || v <= 0) return "Grátis";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function loadSupportPlans() {
  if (apoiePlansCache) return apoiePlansCache;
  try {
    const res = await fetch("/api/support/plans");
    const data = await res.json();
    apoiePlansCache = data.plans || [];
  } catch {
    apoiePlansCache = [];
  }
  return apoiePlansCache;
}

// selectedId: plano marcado como "escolhido" (gate de cadastro).
// currentId: plano que o usuário já tem (página de upgrade, logado) —
// esse fica com o card desabilitado ("Plano atual").
function planCardHTML(plan, selectedId, currentId) {
  const selected = selectedId === plan.id;
  const isCurrent = currentId === plan.id;
  const btnLabel = isCurrent ? "Plano atual" : (selected ? "✓ Selecionado" : `Escolher ${plan.title}`);
  return `
    <div class="plan-card${plan.highlight ? " highlight" : ""}${selected ? " selected" : ""}${isCurrent ? " current" : ""}" data-plan="${plan.id}">
      ${plan.highlight ? `<span class="plan-badge">Mais popular</span>` : ""}
      <div class="plan-title">${plan.title}</div>
      <div class="plan-tagline">${plan.tagline || ""}</div>
      <div class="plan-price">${fmtBRL(plan.price)}${plan.price > 0 ? "<small> pagamento único</small>" : ""}</div>
      <ul class="plan-features">${(plan.features || []).map(f => `<li>${f}</li>`).join("")}</ul>
      <button type="button" class="btn ${selected ? "btn-accent" : "btn-secondary"} full plan-select-btn"${isCurrent ? " disabled" : ""}>${btnLabel}</button>
    </div>`;
}

/* ---- Chamadas de auth ---- */
async function checkAuth() {
  try {
    const res = await fetch("/api/auth/me");
    return await res.json();
  } catch {
    return { authenticated: false };
  }
}

function setGateVisible(visible) {
  document.getElementById("authGate").style.display = visible ? "flex" : "none";
  document.querySelector(".shell").style.display = visible ? "none" : "";
}

function showGateView(view) {
  document.getElementById("gateSignupView").style.display = view === "signup" ? "block" : "none";
  document.getElementById("gateLoginView").style.display = view === "login" ? "block" : "none";
  document.getElementById("gatePendingView").style.display = view === "pending" ? "block" : "none";
}

function gateShowMsg(elId, msg, cls = "error") {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!msg) { el.style.display = "none"; el.textContent = ""; el.className = "apoie-form-error"; return; }
  if (cls === "error") {
    el.className = "apoie-form-error";
    el.textContent = msg;
  } else {
    el.className = `apoie-status-banner ${cls}`;
    el.innerHTML = `<span class="icon">${cls === "success" ? "✅" : "ℹ️"}</span><div><p>${msg}</p></div>`;
  }
  el.style.display = "block";
}

function gateSelectPlan(planId, plans) {
  gateSelectedPlan = planId;
  const plan = plans.find(p => p.id === planId);
  document.querySelectorAll("#gatePlansGrid .plan-card").forEach(card => {
    const isSel = card.dataset.plan === planId;
    card.classList.toggle("selected", isSel);
    const btn = card.querySelector(".plan-select-btn");
    const p = plans.find(pp => pp.id === card.dataset.plan);
    if (btn && p) {
      btn.textContent = isSel ? "✓ Selecionado" : `Escolher ${p.title}`;
      btn.className = `btn ${isSel ? "btn-accent" : "btn-secondary"} full plan-select-btn`;
    }
  });
  const submitBtn = document.getElementById("gateSignupSubmit");
  submitBtn.disabled = false;
  submitBtn.textContent = plan && plan.price > 0 ? `Continuar — ${fmtBRL(plan.price)}` : "Criar conta grátis";
}

async function renderAuthGate() {
  captureApoieReturnParams();
  const plans = await loadSupportPlans();
  const grid = document.getElementById("gatePlansGrid");
  grid.innerHTML = plans.length
    ? plans.map(p => planCardHTML(p, gateSelectedPlan, null)).join("")
    : `<div class="empty">Não foi possível carregar os planos agora. Recarregue a página.</div>`;
  grid.querySelectorAll(".plan-card").forEach(card => {
    card.addEventListener("click", () => gateSelectPlan(card.dataset.plan, plans));
  });

  // Login é sempre a tela padrão. Se estiver voltando de um checkout
  // de cadastro pago, o resultado aparece ali mesmo, na view de login
  // (é o próximo passo de qualquer jeito — ver renderStatusBanner).
  showGateView("login");
  if (apoieReturnStatus) await renderStatusBanner("gateLoginNotice");
}

function renderGatePending(user) {
  showGateView("pending");
  const planNames = { freemium: "Freemium", lite: "Lite", pro: "Pro", enterprise: "Enterprise" };
  document.getElementById("gatePendingMsg").textContent =
    `Sua conta foi criada. Finalize o pagamento do plano ${planNames[user.plan] || user.plan} pra liberar seu acesso.`;
  document.getElementById("gatePendingPayBtn").onclick = () => retryPendingPayment(user.plan);
}

async function retryPendingPayment(planId) {
  const btn = document.getElementById("gatePendingPayBtn");
  const originalLabel = btn.textContent;
  btn.disabled = true; btn.textContent = "Preparando pagamento...";
  try {
    const res = await fetch("/api/support/checkout", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: planId }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.checkoutUrl) throw new Error(data?.error || "Não foi possível iniciar o pagamento.");
    window.location.href = data.checkoutUrl;
  } catch (err) {
    document.getElementById("gatePendingBanner").innerHTML =
      `<div class="apoie-status-banner error"><span class="icon">❌</span><div><b>Erro</b><p>${err.message}</p></div></div>`;
    btn.disabled = false; btn.textContent = originalLabel;
  }
}

async function submitGateSignup(e) {
  e.preventDefault();
  gateShowMsg("gateSignupError", "");
  const name = document.getElementById("gateName").value.trim();
  const phone = document.getElementById("gatePhone").value.trim();
  const email = document.getElementById("gateEmail").value.trim();
  const password = document.getElementById("gatePassword").value;

  if (!gateSelectedPlan) return gateShowMsg("gateSignupError", "Escolha um plano acima antes de continuar.");
  if (name.length < 2) return gateShowMsg("gateSignupError", "Informe seu nome completo.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return gateShowMsg("gateSignupError", "Informe um e-mail válido.");
  if (phone.replace(/\D/g, "").length < 8) return gateShowMsg("gateSignupError", "Informe um telefone válido, com DDD.");
  if (password.length < 8) return gateShowMsg("gateSignupError", "A senha precisa ter pelo menos 8 caracteres.");

  const btn = document.getElementById("gateSignupSubmit");
  const originalLabel = btn.textContent;
  btn.disabled = true; btn.textContent = "Criando conta...";
  try {
    const res = await fetch("/api/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, email, password, plan: gateSelectedPlan }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "Não foi possível criar sua conta agora.");

    if (data.requiresPayment && data.checkoutUrl) {
      window.location.href = data.checkoutUrl; // sai do site — checkout hospedado do Mercado Pago
      return;
    }
    document.getElementById("gateLoginEmail").value = email;
    if (data.requiresPayment && !data.checkoutUrl) {
      // conta criada mas a preference falhou (raro) — desloga pro
      // fluxo de login normal, de lá dá pra tentar de novo (gatePendingView)
      gateShowMsg("gateLoginNotice", data.warning || "Conta criada — faça login pra continuar.", "pending");
    } else {
      gateShowMsg("gateLoginNotice", "Conta criada! Faça login pra continuar.", "success");
    }
    showGateView("login");
  } catch (err) {
    gateShowMsg("gateSignupError", err.message || "Não foi possível criar sua conta agora.");
  } finally {
    btn.disabled = false; btn.textContent = originalLabel;
  }
}

async function submitGateLogin(e) {
  e.preventDefault();
  gateShowMsg("gateLoginError", "");
  const email = document.getElementById("gateLoginEmail").value.trim();
  const password = document.getElementById("gateLoginPassword").value;
  if (!email || !password) return gateShowMsg("gateLoginError", "Informe e-mail e senha.");

  const btn = e.target.querySelector("button[type=submit]");
  const originalLabel = btn.textContent;
  btn.disabled = true; btn.textContent = "Entrando...";
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "E-mail ou senha incorretos.");
    if (data.user.planStatus !== "active") {
      currentUser = data.user;
      renderAvatar(data.user);
      renderGatePending(data.user);
    } else {
      await startApp(data.user);
    }
  } catch (err) {
    gateShowMsg("gateLoginError", err.message || "Não foi possível entrar agora.");
    btn.disabled = false; btn.textContent = originalLabel;
  }
}

async function logout() {
  try { await fetch("/api/auth/logout", { method: "POST" }); } catch { /* segue mesmo se falhar */ }
  location.reload();
}

function renderAvatar(user) {
  if (!user) return;
  const planNames = { freemium: "Freemium", lite: "Lite", pro: "Pro", enterprise: "Enterprise" };
  const initial = (user.name || "?").trim()[0]?.toUpperCase() || "?";
  const firstName = (user.name || "").split(" ")[0] || "Conta";
  const planLabel = `Plano ${planNames[user.plan] || user.plan}`;
  document.getElementById("avatarInitial").textContent = initial;
  document.getElementById("avatarName").textContent = firstName;
  document.getElementById("avatarEmail").textContent = user.email || "";
  document.getElementById("avatarPlan").textContent = planLabel;
  document.getElementById("maisAvatarInitial").textContent = initial;
  document.getElementById("maisAvatarName").textContent = user.name || "";
  document.getElementById("maisAvatarPlan").textContent = planLabel;
}

/* ---- Página "Apoie o BR Data" já logado (upgrade de plano) ---- */
async function renderApoiePage() {
  if (!currentUser) return;
  const grid = document.getElementById("plansGrid");
  grid.innerHTML = `<div class="empty">Carregando planos...</div>`;
  const plans = await loadSupportPlans();
  grid.innerHTML = plans.length
    ? plans.map(p => planCardHTML(p, null, currentUser.plan)).join("")
    : `<div class="empty">Não foi possível carregar os planos agora. Recarregue a página.</div>`;
  grid.querySelectorAll(".plan-card").forEach(card => {
    if (card.classList.contains("current")) return;
    card.addEventListener("click", () => upgradeToPlan(card.dataset.plan, plans));
  });
  renderApoieCurrentPlanCard();
  renderStatusBanner("apoieStatusBanner");
}

function renderApoieCurrentPlanCard() {
  const el = document.getElementById("apoieCurrentPlanCard");
  if (!el || !currentUser) return;
  const planNames = { freemium: "Freemium", lite: "Lite", pro: "Pro", enterprise: "Enterprise" };
  const pendingTxt = currentUser.pendingPlan
    ? ` <span style="color:var(--text-2); font-weight:600;">· upgrade pra ${planNames[currentUser.pendingPlan] || currentUser.pendingPlan} pendente de pagamento</span>`
    : "";
  el.innerHTML = `<span class="lbl">Seu plano atual</span><span class="val">${planNames[currentUser.plan] || currentUser.plan}${pendingTxt}</span>`;
}

async function upgradeToPlan(planId, plans) {
  const plan = plans.find(p => p.id === planId);
  if (!plan) return;
  if (plan.price <= 0) return; // não deveria acontecer (freemium nunca é upgrade pago), defensivo
  if (!confirm(`Trocar pro plano ${plan.title} por ${fmtBRL(plan.price)}?`)) return;
  try {
    const res = await fetch("/api/support/checkout", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: planId }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.checkoutUrl) throw new Error(data?.error || "Não foi possível iniciar o pagamento.");
    window.location.href = data.checkoutUrl;
  } catch (err) {
    alert(err.message || "Não foi possível iniciar o pagamento agora.");
  }
}

/* ---- Retorno do checkout do Mercado Pago (compartilhado gate + upgrade) ---- */

// Lido 1x, a partir da URL de retorno do Mercado Pago (?status=...&
// external_reference=... — anexados por eles no back_url configurado).
// Limpa a URL logo em seguida pra não reaparecer num refresh.
function captureApoieReturnParams() {
  const params = new URLSearchParams(location.search);
  const status = params.get("collection_status") || params.get("status");
  const ref = params.get("external_reference");
  if (!status && !ref) return;
  apoieReturnStatus = { status: status || "", ref: ref || "" };
  history.replaceState(null, "", location.pathname);
}

const APOIE_STATUS_LABELS = {
  approved: { cls: "success", icon: "✅", title: "Pagamento aprovado!", msg: "Obrigado por apoiar o BR Data 💛" },
  pending: { cls: "pending", icon: "⏳", title: "Pagamento pendente", msg: "Assim que for confirmado — pode levar alguns minutos, principalmente no PIX — seu acesso é liberado." },
  in_process: { cls: "pending", icon: "⏳", title: "Pagamento em análise", msg: "Estamos aguardando a confirmação. Não precisa fazer nada, já vamos atualizar aqui." },
  rejected: { cls: "error", icon: "❌", title: "Pagamento não aprovado", msg: "Seu pagamento não foi aprovado. Você pode tentar de novo com outro cartão ou via PIX." },
};

// Confirma o status direto com o backend (mais confiável que o valor
// que veio na URL — cobre o caso do PIX, que às vezes confirma alguns
// segundos depois do redirect de volta pro site). Devolve o status
// resolvido pra quem chamou poder reagir (ex.: pular pra tela de login).
async function renderStatusBanner(targetId) {
  const box = document.getElementById(targetId);
  if (!box) return null;
  if (!apoieReturnStatus) { box.innerHTML = ""; return null; }

  let status = apoieReturnStatus.status;
  if (apoieReturnStatus.ref) {
    try {
      const res = await fetch(`/api/support/status?ref=${encodeURIComponent(apoieReturnStatus.ref)}`);
      const data = await res.json().catch(() => null);
      if (data?.status) status = data.status;
    } catch { /* mantém o status que veio na URL */ }
  }

  const info = APOIE_STATUS_LABELS[status] || { cls: "pending", icon: "ℹ️", title: "Pagamento em processamento", msg: "Vamos confirmar o status assim que possível." };
  box.innerHTML = `<div class="apoie-status-banner ${info.cls}"><span class="icon">${info.icon}</span><div><b>${info.title}</b><p>${info.msg}</p></div></div>`;
  return status;
}

/* ================= NAVEGAÇÃO PRA DETALHE (time/jogador) ================= */
const POSITION_LABELS = { Goalkeeper: "Goleiro", Defender: "Zagueiro", Midfielder: "Meio-campo", Attacker: "Atacante" };
function translatePosition(pos) { return POSITION_LABELS[pos] || pos || ""; }
function initialsOf(name) { return (name || "?").split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase(); }
// Crest + nome do time, clicável — abre a página de detalhe do time.
// nameKey escolhe "name" (nome completo) ou "short" (sigla). bold
// destaca o nome (usado pro Clube Favorito nas listas com vários times).
function teamLinkHTML(team, size, nameKey = "name", bold = false) {
  if (!team) return "";
  return `<span class="clickable-team team-link" onclick="goToTeam('${team.id}')">${crestEl(team, size)}<span class="tname${bold ? " tname-fav" : ""}">${team[nameKey]}</span></span>`;
}
// Time favorito ativo (ver "Clube Favorito" no Dashboard) — null se
// nenhum estiver selecionado.
function activeFavoriteTeam() {
  return state.favoriteClubId ? TEAM_MAP[state.favoriteClubId] || null : null;
}

function goToTeam(teamId) {
  if (state.page !== "time" && state.page !== "jogador") state.pageBeforeDetail = state.page;
  state.selectedTeamId = teamId;
  setActivePage("time");
}
function goToPlayer(playerId) {
  if (state.page !== "time" && state.page !== "jogador") state.pageBeforeDetail = state.page;
  state.selectedPlayerId = playerId;
  setActivePage("jogador");
}
function goBackFromDetail() {
  setActivePage(state.pageBeforeDetail || "dashboard");
}

/* ================= PÁGINA: DETALHE DO TIME ================= */
function teamLastMatchRowHTML(m, teamId) {
  const isHome = m.home === teamId;
  const opp = TEAM_MAP[isHome ? m.away : m.home];
  const gf = isHome ? m.gh : m.ga, ga = isHome ? m.ga : m.gh;
  const cls = gf > ga ? "v" : gf === ga ? "e" : "d";
  const letter = gf > ga ? "V" : gf === ga ? "E" : "D";
  return `
  <div class="rail-fixture">
    <div class="when">Rodada ${m.round} · ${isHome ? "em casa" : "fora"}${m.simulated ? " · simulado" : ""}</div>
    <div class="teams">
      <div class="form-dot ${cls}" style="flex-shrink:0;">${letter}</div>
      ${opp ? teamLinkHTML(opp, 20) : ""}
      <span class="vs">${gf} × ${ga}</span>
    </div>
  </div>`;
}
// Elenco (modo demo: DEMO_PLAYERS já pronto. Modo ao vivo: busca
// lazy — não fica pré-carregado, só quando a página do time abre).
let teamRosterCacheDemo = null; // não precisa de cache específico, DEMO_PLAYERS já é síncrono
async function resolveTeamRoster(teamId) {
  if (!LIVE_MODE) return activeDemoPlayers.filter(p => p.teamId === teamId);
  return loadTeamRoster(teamId);
}
// Lista (não mais grade de cards): nome + posição + partidas
// jogadas/gols/assistências, uma linha por jogador — mesmo padrão visual
// das outras tabelas do app (.table-std).
function playerRosterRowHTML(p) {
  const avatar = p.photo ? `<img src="${escAttr(p.photo)}" alt="">` : initialsOf(p.name);
  return `
  <tr class="clickable-player" onclick="goToPlayer(${p.id})">
    <td><div class="team-cell"><div class="roster-avatar-sm">${avatar}</div><div><div class="rname">${p.name}</div><div class="rmeta">${translatePosition(p.position)}</div></div></div></td>
    <td class="num">${p.games ?? "—"}</td>
    <td class="num">${p.goals ?? 0}</td>
    <td class="num">${p.assists ?? 0}</td>
  </tr>`;
}
const ROSTER_POSITION_ORDER = { Goalkeeper: 0, Defender: 1, Midfielder: 2, Attacker: 3 };
const ROSTER_PREVIEW_COUNT = 8;
let currentRosterSorted = []; // elenco (já ordenado) do time aberto no momento — evita re-buscar ao expandir/recolher
async function renderTeamRoster(teamId) {
  const box = document.getElementById("teamPageRoster");
  if (!box) return;
  box.innerHTML = `<tr><td colspan="4" class="empty">Carregando elenco...</td></tr>`;
  state.rosterExpanded = false;
  const roster = await resolveTeamRoster(teamId);
  if (state.selectedTeamId !== teamId) return; // usuário já trocou de time enquanto carregava
  currentRosterSorted = [...roster].sort((a, b) =>
    (ROSTER_POSITION_ORDER[a.position] ?? 9) - (ROSTER_POSITION_ORDER[b.position] ?? 9) || a.name.localeCompare(b.name)
  );
  renderRosterRows();
}
// Só redesenha a lista (linhas + botão) a partir do elenco já
// carregado — usado tanto no primeiro render quanto ao expandir/recolher.
function renderRosterRows() {
  const box = document.getElementById("teamPageRoster");
  const hint = document.getElementById("teamPageRosterHint");
  const toggleBox = document.getElementById("teamPageRosterToggle");
  if (!box) return;
  const sorted = currentRosterSorted;
  const showAll = state.rosterExpanded || sorted.length <= ROSTER_PREVIEW_COUNT;
  const visible = showAll ? sorted : sorted.slice(0, ROSTER_PREVIEW_COUNT);
  box.innerHTML = visible.length
    ? visible.map(playerRosterRowHTML).join("")
    : `<tr><td colspan="4" class="empty">Elenco não disponível.</td></tr>`;
  if (hint) hint.textContent = `${sorted.length} jogador${sorted.length === 1 ? "" : "es"} · ${LIVE_MODE ? "dados ao vivo" : "dados de exemplo"}`;
  if (toggleBox) {
    toggleBox.innerHTML = sorted.length > ROSTER_PREVIEW_COUNT
      ? `<button class="btn-sm roster-toggle-btn" onclick="toggleRosterExpand()">${showAll ? "Mostrar menos ▴" : `Ver todos os ${sorted.length} jogadores ▾`}</button>`
      : "";
  }
}
function toggleRosterExpand() {
  state.rosterExpanded = !state.rosterExpanded;
  renderRosterRows();
}
/* ---------- Escalação titular do último jogo, estilo "jogo de botão" ----------
   Reaproveita a mesma escalação já usada no card expandido de "Jogos"
   (buildDemoLineups no modo exemplo / loadFixtureLineups no modo ao vivo,
   ambos com cache próprio) — aqui só desenha o time da própria página
   nas linhas do campinho (goleiro embaixo, ataque em cima). */
function lastNameOf(name) {
  const parts = String(name || "").trim().split(/\s+/);
  return parts[parts.length - 1] || name || "?";
}
function buttonPieceHTML(p, team) {
  const nameHTML = p.id
    ? `<span class="btn-name clickable-player" onclick="goToPlayer(${p.id})">${lastNameOf(p.name)}</span>`
    : `<span class="btn-name">${lastNameOf(p.name)}</span>`;
  return `
  <div class="button-piece" title="${escAttr(p.name)}">
    <div class="button-disc" style="background:linear-gradient(160deg, ${team.c1 || "#0057B8"}, ${team.c2 || "#062B5C"});">${p.number ?? "-"}</div>
    ${nameHTML}
  </div>`;
}
const BUTTON_POS_ORDER = ["G", "D", "M", "F"];
function formationPitchHTML(team, lineup) {
  if (!lineup || !lineup.startXI || !lineup.startXI.length) {
    return `<div class="empty" style="padding:8px 0;">Escalação não disponível para o último jogo.</div>`;
  }
  const byPos = BUTTON_POS_ORDER.map(code => lineup.startXI.filter(p => (p.pos || "").toUpperCase() === code));
  const placed = new Set(byPos.flat());
  const others = lineup.startXI.filter(p => !placed.has(p));
  const rows = [byPos[0], byPos[1], others.length ? others : null, byPos[2], byPos[3]].filter(r => r && r.length);
  return `
    <div class="formation-meta">
      ${lineup.formation ? `<span class="lineup-formation">${lineup.formation}</span>` : ""}
      ${lineup.coach ? `<span class="formation-coach">Técnico: ${lineup.coach}</span>` : ""}
    </div>
    <div class="button-pitch">
      ${rows.map(row => `<div class="button-row">${row.map(p => buttonPieceHTML(p, team)).join("")}</div>`).join("")}
    </div>`;
}
async function renderTeamLastLineup(teamId, lastMatch) {
  const box = document.getElementById("teamPageLastLineup");
  const hint = document.getElementById("teamPageLineupHint");
  if (!box) return;
  const team = TEAM_MAP[teamId];

  if (!lastMatch) {
    box.innerHTML = `<div class="empty">Sem jogos decididos ainda.</div>`;
    if (hint) hint.textContent = "";
    return;
  }
  const opp = TEAM_MAP[lastMatch.home === teamId ? lastMatch.away : lastMatch.home];
  if (hint) hint.textContent = opp ? `${team.short} ${lastMatch.gh}×${lastMatch.ga} ${opp.short} · rodada ${lastMatch.round}` : "";

  if (!LIVE_MODE) {
    ensureDemoLineups(lastMatch); // mesma escalação fictícia já usada no card do jogo em "Jogos"
    box.innerHTML = formationPitchHTML(team, lastMatch.lineups[teamId]);
    return;
  }
  if (lastMatch.lineups) {
    box.innerHTML = formationPitchHTML(team, lastMatch.lineups[teamId]);
    return;
  }
  if (!lastMatch.fixtureId) {
    box.innerHTML = `<div class="empty">Escalação não disponível para este jogo.</div>`;
    return;
  }
  box.innerHTML = `<div class="empty">Carregando escalação...</div>`;
  try {
    const lineups = await loadFixtureLineups(lastMatch.fixtureId); // já cacheado por fixtureId em liveData.js
    lastMatch.lineups = lineups;
    if (state.selectedTeamId !== teamId) return; // usuário já trocou de time enquanto carregava
    box.innerHTML = formationPitchHTML(team, lineups[teamId]);
  } catch {
    box.innerHTML = `<div class="empty">Não foi possível carregar a escalação.</div>`;
  }
}

function renderTeamPage() {
  const teamId = state.selectedTeamId;
  const team = TEAM_MAP[teamId];
  if (!team) { goBackFromDetail(); return; }

  document.getElementById("teamPageCrest").innerHTML = crestEl(team, 56);
  document.getElementById("teamPageName").textContent = team.name;
  const compSubtitle = (COMPETITION_META[state.competitionId] || COMPETITION_META.brasileirao).subtitle;
  document.getElementById("teamPageSub").textContent = [team.uf, team.venue?.name, team.venue?.city].filter(Boolean).join(" · ")
    || `${compSubtitle} · ${LIVE_MODE ? "dados ao vivo" : "dados de exemplo"}`;

  const standings = currentStandings();
  const pos = standings.findIndex(r => r.id === teamId) + 1;
  const row = standings.find(r => r.id === teamId);
  document.getElementById("teamPageKpis").innerHTML = row ? `
    <div class="card kpi"><div class="ico yellow">🏆</div><div><div class="lbl">Posição</div><div class="val">${pos}º</div></div></div>
    <div class="card kpi"><div class="ico blue">⭐</div><div><div class="lbl">Pontos</div><div class="val">${row.pts}</div></div></div>
    <div class="card kpi"><div class="ico green">⚽</div><div><div class="lbl">Gols marcados</div><div class="val">${row.gp}</div></div></div>
    <div class="card kpi"><div class="ico navy">🥅</div><div><div class="lbl">Gols sofridos</div><div class="val">${row.gc}</div></div></div>
  ` : `<div class="card empty" style="grid-column:1/-1;">Sem jogos decididos ainda.</div>`;

  renderFormaInto("teamPageForma", teamId);
  renderRadarInto("teamPageRadar", teamId);

  const upcoming = teamNextFixtures(teamId, 4);
  document.getElementById("teamPageNextFixtures").innerHTML = upcoming.length ? upcoming.map(fixtureRowHTML).join("") : `<div class="empty">Sem jogos futuros cadastrados.</div>`;

  const last = allDecidedMatches().filter(m => m.home === teamId || m.away === teamId).sort((a, b) => b.round - a.round).slice(0, 6);
  document.getElementById("teamPageLastMatches").innerHTML = last.length ? last.map(m => teamLastMatchRowHTML(m, teamId)).join("") : `<div class="empty">Sem jogos decididos ainda.</div>`;

  renderTeamCompare(teamId, standings);
  renderTeamRoster(teamId);
  renderTeamLastLineup(teamId, last[0]);

  // Movimentação de odds + simulador "E se..." — sempre do time desta
  // página (não existem mais no Dashboard).
  renderOddsChart(teamId);
  state.whatifTeamId = teamId;
  renderWhatIf();
}
// "Comparar com outro time" — time A é sempre o time da página atual;
// só o time B (adversário) é escolhido no seletor.
function renderTeamCompare(teamId, standings) {
  const sel = document.getElementById("teamPageCompareSelect");
  const liberado = planAllowsAdvanced();
  sel.style.display = liberado ? "" : "none";
  document.getElementById("teamPageCompareBody").style.display = liberado ? "block" : "none";
  document.getElementById("teamPageCompareLocked").style.display = liberado ? "none" : "block";
  if (!liberado) {
    document.getElementById("teamPageCompareLocked").innerHTML = lockedFeatureHTML(
      "Comparador de times é exclusivo Pro/Enterprise",
      "Compare o desempenho entre dois times lado a lado — desbloqueie fazendo upgrade do seu plano."
    );
    return;
  }
  const others = [...TEAMS].filter(t => t.id !== teamId).sort((a, b) => a.name.localeCompare(b.name));
  sel.innerHTML = others.map(t => `<option value="${t.id}">${t.name}</option>`).join("");
  const defaultOpponent = standings.find(r => r.id !== teamId)?.id || others[0]?.id;
  sel.value = state.teamCompareOpponent && others.some(t => t.id === state.teamCompareOpponent) ? state.teamCompareOpponent : defaultOpponent;
  state.teamCompareOpponent = sel.value;
  renderCompareInto("teamPageCompareBody", teamId, sel.value);
}

/* ================= PÁGINA: DETALHE DO JOGADOR ================= */
async function resolvePlayer(playerId) {
  if (!LIVE_MODE) return activeDemoPlayers.find(p => p.id === playerId) || null;
  const fromLeaders = (playersListCache || []).find(p => p.id === playerId);
  if (fromLeaders) return fromLeaders;
  for (const roster of teamRosterCache.values()) {
    const found = (await roster).find(p => p.id === playerId);
    if (found) return found;
  }
  return loadPlayerById(playerId);
}
async function renderPlayerPage() {
  const playerId = state.selectedPlayerId;
  document.getElementById("playerPageAvatar").innerHTML = `<div class="player-avatar-lg">${initialsOf("")}</div>`;
  document.getElementById("playerPageName").textContent = "Carregando...";
  document.getElementById("playerPageSub").textContent = "";
  document.getElementById("playerPageBody").innerHTML = "";

  const player = await resolvePlayer(playerId);
  if (state.selectedPlayerId !== playerId) return; // usuário já trocou de jogador enquanto carregava

  if (!player) {
    document.getElementById("playerPageAvatar").innerHTML = `<div class="player-avatar-lg">?</div>`;
    document.getElementById("playerPageName").textContent = "Jogador não encontrado";
    document.getElementById("playerPageBody").innerHTML = `<div class="card empty">Não temos estatísticas detalhadas desse jogador ainda.</div>`;
    return;
  }

  const team = TEAM_MAP[player.teamId];
  document.getElementById("playerPageAvatar").innerHTML = `<div class="player-avatar-lg">${player.photo ? `<img src="${player.photo}" alt="">` : initialsOf(player.name)}</div>`;
  document.getElementById("playerPageName").textContent = player.name;
  document.getElementById("playerPageSub").innerHTML = [
    team ? teamLinkHTML(team, 18) : "",
    translatePosition(player.position),
  ].filter(Boolean).join(" · ");

  document.getElementById("playerPageBody").innerHTML = `
    <div class="grid grid-kpi" style="margin-bottom:16px;">
      <div class="card kpi"><div class="ico green">⚽</div><div><div class="lbl">Gols</div><div class="val">${player.goals}</div></div></div>
      <div class="card kpi"><div class="ico blue">🎯</div><div><div class="lbl">Assistências</div><div class="val">${player.assists}</div></div></div>
      <div class="card kpi"><div class="ico yellow">🟨</div><div><div class="lbl">Cartões amarelos</div><div class="val">${player.yellow}</div></div></div>
      <div class="card kpi"><div class="ico navy">🟥</div><div><div class="lbl">Cartões vermelhos</div><div class="val">${player.red || 0}</div></div></div>
      <div class="card kpi"><div class="ico blue">⭐</div><div><div class="lbl">Nota média</div><div class="val">${player.rating != null ? player.rating.toFixed(1) : "-"}</div></div></div>
    </div>
    ${team ? `<div class="card-link" onclick="goToTeam('${team.id}')" style="display:inline-block;">Ver página de ${team.name} →</div>` : ""}`;
}

/* ================= SELECTS (comparador / radar / forma / e-se) ================= */
function populateSelect(sel, defaultId) {
  const sorted = [...TEAMS].sort((a, b) => a.name.localeCompare(b.name));
  sel.innerHTML = sorted.map(t => `<option value="${t.id}">${t.name}</option>`).join("");
  if (defaultId) sel.value = defaultId;
}
function populateAllSelects() {
  const standings = currentStandings();
  const leader = standings[0]?.id, second = standings[1]?.id;
  populateSelect(document.getElementById("radarTeamSelect2"), leader);
  populateSelect(document.getElementById("compareTeamA2"), leader);
  populateSelect(document.getElementById("compareTeamB2"), second);
}

/* ================= NAVEGAÇÃO ================= */
const PAGES = ["dashboard", "jogos", "tabela", "estatisticas", "simulador", "favoritos", "noticias", "apoie", "time", "jogador", "mais"];
function setActivePage(name, opts = {}) {
  state.page = name;
  PAGES.forEach(p => document.getElementById(`page-${p}`)?.classList.toggle("active", p === name));
  document.querySelectorAll(".top-tab").forEach(t => t.classList.toggle("active", t.dataset.page === name));
  document.querySelectorAll(".side-link[data-page]").forEach(t => t.classList.toggle("active", t.dataset.page === name && !t.dataset.jsub));
  document.querySelectorAll(".bn-item").forEach(t => t.classList.toggle("active", t.dataset.page === name || (name !== "dashboard" && name !== "jogos" && name !== "tabela" && name !== "estatisticas" && t.dataset.page === "mais")));
  document.getElementById("sidebar").classList.remove("open");

  if (name === "dashboard") renderDashboard();
  if (name === "jogos") renderJogos();
  if (name === "tabela") renderTabela();
  if (name === "estatisticas") renderEstatisticasPage();
  if (name === "simulador") renderSimulador();
  if (name === "favoritos") renderFavoritosPage();
  if (name === "noticias") renderNews();
  if (name === "apoie") renderApoiePage();
  if (name === "time") renderTeamPage();
  if (name === "jogador") renderPlayerPage();

  // Cada página troca de conteúdo (às vezes bem mais curto/mais longo
  // que a anterior) mas o scroll é da janela toda (sidebar é que tem
  // scroll próprio) — sem isso, navegar pra uma página mais curta
  // enquanto rolado lá embaixo deixava a tela em branco/cortada, e em
  // geral a página nova não abria com foco no topo. opts.scrollTo
  // (link direto pra uma seção específica, ex.: Comparador de Times)
  // continua tendo prioridade sobre esse reset.
  if (opts.scrollTo) {
    setTimeout(() => document.getElementById(opts.scrollTo)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  } else {
    window.scrollTo(0, 0);
  }
}

// Troca a sub-aba de Jogos (Rodadas / Estatísticas consolidadas /
// Probabilidades). Extraída à parte pra poder ser chamada tanto pelo
// clique direto no chip quanto por atalhos de fora da página (sidebar,
// card do dashboard, menu "Mais") via [data-jsub] — ver setupEventListeners.
function setJogosSub(sub) {
  state.jogosSub = sub;
  document.querySelectorAll('.sort-chip[data-sub]').forEach(c => c.classList.toggle("active", c.dataset.sub === sub));
  document.getElementById("sub-rodadas").style.display = sub === "rodadas" ? "block" : "none";
  document.getElementById("sub-stats").style.display = sub === "stats" ? "block" : "none";
  document.getElementById("sub-probabilidades").style.display = sub === "probabilidades" ? "block" : "none";
  if (sub === "probabilidades") {
    const liberado = planAllowsAdvanced();
    document.getElementById("probabilidadesContent").style.display = liberado ? "block" : "none";
    document.getElementById("probabilidadesLocked").style.display = liberado ? "none" : "block";
    if (liberado) {
      if (!state.probResults) runProbabilities(); else renderProbList();
    } else {
      document.getElementById("probabilidadesLocked").innerHTML = lockedFeatureHTML(
        "Probabilidades é exclusivo Pro/Enterprise",
        "Veja as chances de título, Libertadores, Sul-Americana e rebaixamento de cada time — desbloqueie fazendo upgrade do seu plano."
      );
    }
  }
}

function setupEventListeners() {
  document.querySelectorAll("[data-page]").forEach(el => {
    el.addEventListener("click", () => {
      setActivePage(el.dataset.page, { scrollTo: el.dataset.scroll });
      if (el.dataset.jsub) setJogosSub(el.dataset.jsub);
    });
  });

  document.getElementById("btnHamburger").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));
  document.getElementById("themeSwitch").addEventListener("click", toggleTheme);
  // Os 3 botões "Seja Premium"/"Assinar agora" navegam pra página
  // "Apoie o BR Data" (data-page="apoie" no HTML) — já cobertos pelo
  // listener genérico de [data-page] logo acima, nada extra aqui.
  document.getElementById("themeSwitchMobile")?.addEventListener("click", () => { toggleTheme(); document.getElementById("themeSwitchMobile").classList.toggle("on", document.documentElement.getAttribute("data-theme") === "dark"); });

  // ---- Gate de login/cadastro ----
  document.getElementById("gateSignupForm").addEventListener("submit", submitGateSignup);
  document.getElementById("gateLoginForm").addEventListener("submit", submitGateLogin);
  document.getElementById("gateGoLogin").addEventListener("click", (e) => { e.preventDefault(); gateShowMsg("gateLoginNotice", ""); showGateView("login"); });
  document.getElementById("gateGoSignup").addEventListener("click", (e) => { e.preventDefault(); showGateView("signup"); });
  document.getElementById("gatePendingLogoutBtn").addEventListener("click", logout);

  // ---- Avatar (topbar desktop) e "Sair" (mobile, página Mais) ----
  document.getElementById("avatarBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    document.getElementById("avatarMenu").classList.toggle("open");
  });
  document.addEventListener("click", () => document.getElementById("avatarMenu")?.classList.remove("open"));
  document.getElementById("btnLogout").addEventListener("click", logout);
  document.getElementById("btnLogoutMobile").addEventListener("click", logout);
  document.getElementById("btnForceRefresh").addEventListener("click", forceRefreshApp);
  document.getElementById("desktopGateContinue").addEventListener("click", (e) => {
    e.preventDefault();
    setDesktopBypass();
    const gated = evaluateDesktopGate();
    if (!gated && !appBooted) startAuthFlow();
  });

  // ---- Modal de anúncio (Freemium) ----
  // Os dois só agem depois que o "vídeo" termina (adModalUnlocked) —
  // nem o link de assinar Premium pula o anúncio antes da hora.
  document.getElementById("adModalClose").addEventListener("click", () => {
    if (adModalUnlocked) closeAdModal();
  });
  document.getElementById("adModalUpsellLink").addEventListener("click", () => {
    if (adModalUnlocked) { closeAdModal(); setActivePage("apoie"); }
  });

  // ---- Seletor de campeonato (barra lateral no desktop, página "Mais" no mobile) ----
  // Copa do Brasil fica sem listener de propósito — sempre "em breve"
  // (ver aviso em applyCompetitionsSidebar acima). Série D nem tem
  // botão (desligada de propósito, ver server/src/competitions.js).
  document.getElementById("navBrasileirao").addEventListener("click", () => switchCompetition("brasileirao"));
  document.getElementById("navSerieB").addEventListener("click", () => onCompetitionNavClick("serie_b"));
  document.getElementById("navSerieC").addEventListener("click", () => onCompetitionNavClick("serie_c"));
  document.getElementById("navBrasileiraoMobile").addEventListener("click", () => switchCompetition("brasileirao"));
  document.getElementById("navSerieBMobile").addEventListener("click", () => onCompetitionNavClick("serie_b"));
  document.getElementById("navSerieCMobile").addEventListener("click", () => onCompetitionNavClick("serie_c"));

  document.getElementById("btnAddTeam").addEventListener("click", () => {
    const existing = document.getElementById("quickAddSelect");
    if (existing) { existing.remove(); return; }
    const available = TEAMS.filter(t => !state.favorites.includes(t.id)).sort((a, b) => a.name.localeCompare(b.name));
    if (!available.length) return;
    const sel = document.createElement("select");
    sel.id = "quickAddSelect";
    sel.className = "compare-select";
    sel.style.width = "100%"; sel.style.marginTop = "6px";
    sel.innerHTML = `<option value="">Escolha um time…</option>` + available.map(t => `<option value="${t.id}">${t.name}</option>`).join("");
    sel.addEventListener("change", () => { if (sel.value) { toggleFavorite(sel.value); sel.remove(); } });
    document.getElementById("btnAddTeam").insertAdjacentElement("afterend", sel);
  });

  // Jogos: sub-abas + navegação de rodada
  document.querySelectorAll(".sort-chip[data-sub]").forEach(chip => chip.addEventListener("click", () => setJogosSub(chip.dataset.sub)));
  document.getElementById("roundPrev").addEventListener("click", () => { state.jogosRound = Math.max(1, state.jogosRound - 1); renderJogos(); });
  document.getElementById("roundNext").addEventListener("click", () => { state.jogosRound = Math.min(TOTAL_ROUNDS, state.jogosRound + 1); renderJogos(); });

  // Estatísticas: sub-abas Times / Jogadores
  document.querySelectorAll(".sort-chip[data-esub]").forEach(chip => chip.addEventListener("click", () => {
    document.querySelectorAll(".sort-chip[data-esub]").forEach(c => c.classList.remove("active"));
    chip.classList.add("active"); state.estatisticasSub = chip.dataset.esub;
    document.getElementById("esub-times").style.display = state.estatisticasSub === "times" ? "block" : "none";
    document.getElementById("esub-jogadores").style.display = state.estatisticasSub === "jogadores" ? "block" : "none";
    if (state.estatisticasSub === "jogadores") renderJogadoresPage();
  }));

  // Simulador
  document.getElementById("btnSimRound").addEventListener("click", () => {
    getRoundFixtures(state.simRound).forEach(fx => {
      const k = keyFor(state.simRound, fx.home, fx.away);
      if (MATCH_RESULTS[k]?.official) return;
      const r = simulateMatch(fx.home, fx.away, freshRng()); r.round = state.simRound; r.simulated = true;
      MATCH_RESULTS[k] = r;
    });
    refreshAll();
  });
  document.getElementById("btnSimSeason").addEventListener("click", () => {
    for (let r = 1; r <= TOTAL_ROUNDS; r++) getRoundFixtures(r).forEach(fx => {
      const k = keyFor(r, fx.home, fx.away);
      if (!MATCH_RESULTS[k]) { const res = simulateMatch(fx.home, fx.away, freshRng()); res.round = r; res.simulated = true; MATCH_RESULTS[k] = res; }
    });
    refreshAll();
  });
  document.getElementById("btnResetSim").addEventListener("click", () => {
    if (confirm("Limpar suas simulações? (jogos oficiais não são afetados)")) {
      Object.keys(MATCH_RESULTS).forEach(k => { if (!MATCH_RESULTS[k].official) delete MATCH_RESULTS[k]; });
      refreshAll();
    }
  });
  document.getElementById("simRoundPrev").addEventListener("click", () => { state.simRound = Math.max(1, state.simRound - 1); renderSimulador(); });
  document.getElementById("simRoundNext").addEventListener("click", () => { state.simRound = Math.min(TOTAL_ROUNDS, state.simRound + 1); renderSimulador(); });

  // Probabilidades
  document.getElementById("btnRecalc").addEventListener("click", runProbabilities);
  document.querySelectorAll(".sort-chip[data-sort]").forEach(chip => chip.addEventListener("click", () => {
    document.querySelectorAll(".sort-chip[data-sort]").forEach(c => c.classList.remove("active"));
    chip.classList.add("active"); state.probSort = chip.dataset.sort; renderProbList();
  }));

  // Estatísticas: seletores
  document.getElementById("radarTeamSelect2").addEventListener("change", e => renderRadarInto("radarChart2", e.target.value));
  document.getElementById("compareTeamA2").addEventListener("change", () => renderCompareInto("compareBody2", document.getElementById("compareTeamA2").value, document.getElementById("compareTeamB2").value));
  document.getElementById("compareTeamB2").addEventListener("change", () => renderCompareInto("compareBody2", document.getElementById("compareTeamA2").value, document.getElementById("compareTeamB2").value));

  // Página de time: comparador (time A fixo = o time da página)
  document.getElementById("teamPageCompareSelect").addEventListener("change", e => {
    state.teamCompareOpponent = e.target.value;
    renderCompareInto("teamPageCompareBody", state.selectedTeamId, e.target.value);
  });

  // favoriteClubSelect é recriado a cada render do card (ver
  // renderFavoriteClubCard) — o listener é anexado lá, não aqui.
  // whatif e movimentação de odds vivem só na página do Time agora —
  // sempre o time da própria página (ver renderTeamPage), sem seletor.
  document.getElementById("whatifMinus").addEventListener("click", () => { state.whatifN = Math.max(1, state.whatifN - 1); renderWhatIf(); });
  document.getElementById("whatifPlus").addEventListener("click", () => { state.whatifN = Math.min(19, state.whatifN + 1); renderWhatIf(); });

  document.getElementById("oddsRangeTabs").addEventListener("click", e => {
    const btn = e.target.closest(".range-tab"); if (!btn) return;
    document.querySelectorAll("#oddsRangeTabs .range-tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active"); state.oddsRange = btn.dataset.range; renderOddsChart(state.selectedTeamId);
  });

  // Busca de times
  const searchInput = document.getElementById("teamSearch");
  const searchResults = document.getElementById("searchResults");
  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) { searchResults.classList.remove("open"); return; }
    const matches = TEAMS.filter(t => t.name.toLowerCase().includes(q)).slice(0, 6);
    searchResults.innerHTML = matches.map(t => `<div class="sr-item" data-team="${t.id}">${crestEl(t, 22)}<span>${t.name}</span></div>`).join("") || `<div class="sr-item">Nenhum time encontrado</div>`;
    searchResults.classList.add("open");
    searchResults.querySelectorAll(".sr-item[data-team]").forEach(item => item.addEventListener("click", () => {
      searchInput.value = ""; searchResults.classList.remove("open");
      goToTeam(item.dataset.team);
    }));
  });
  document.addEventListener("click", e => { if (!e.target.closest(".top-search") && !e.target.closest(".search-results")) searchResults.classList.remove("open"); });
}

/* ================= Refresh geral após qualquer simulação ================= */
function refreshAll() {
  state.probResults = null;
  setActivePage(state.page);
}

/* ================= Boot ================= */
boot();
