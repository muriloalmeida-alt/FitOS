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

const state = {
  page: "dashboard",
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
};

/* ---------- Boot ---------- */
function setActiveTeams(teams) { TEAMS = teams; setTeamMap(teams); }

async function boot() {
  loadFavorites();
  initTheme();
  setActiveTeams(DEMO_TEAMS);
  const live = await tryLoadLiveData();

  if (live) {
    LIVE_MODE = true;
    setActiveTeams(live.teams);
    ALL_ROUNDS = live.allRounds;
    MATCH_RESULTS = live.results;
    TOTAL_ROUNDS = live.totalRounds;
    document.getElementById("dashSub").textContent = `Série A · Temporada ${live.season}`;
  } else {
    LIVE_MODE = false;
    initDemoSeason();
    document.getElementById("dashSub").textContent = "Série A · dados de exemplo";
  }

  const modePill = document.getElementById("modePill");
  modePill.textContent = LIVE_MODE ? "● Ao vivo" : "● Exemplo";
  modePill.className = "mode-pill " + (LIVE_MODE ? "live" : "demo");

  state.jogosRound = Math.max(1, firstUndecidedRound() - 1) || 1;
  state.simRound = firstUndecidedRound();
  state.whatifTeamId = currentStandings()[0]?.id || TEAMS[0].id;

  populateAllSelects();
  renderMyTeamsSidebar();
  setupEventListeners();
  setActivePage("dashboard");
}

function initDemoSeason() {
  ALL_ROUNDS = generateAllRounds(DEMO_TEAMS.map(t => t.id));
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
    return { home: fx.home, away: fx.away, round, fixtureId: fx.fixtureId, date: fx.date, pending: true };
  });
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
function firstUndecidedRound() {
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
function crestEl(team, size) {
  if (team.logo) {
    // Passa os dados do fallback via data-* (em vez de embutir HTML cru
    // dentro do atributo onerror) — assim aspas dentro do HTML de
    // crestFallback() não colidem com as aspas do próprio atributo, o
    // que antes quebrava o fallback e deixava o ícone de imagem
    // quebrada do navegador aparecer no lugar do brasão/iniciais.
    return `<img class="crest" src="${escAttr(team.logo)}" alt="${escAttr(team.short || "")}" width="${size}" height="${size}"
      style="width:${size}px;height:${size}px;background:#fff;border:1px solid var(--border);padding:2px;"
      data-short="${escAttr(team.short || team.name || "?")}" data-c1="${escAttr(team.c1 || "#0057B8")}" data-c2="${escAttr(team.c2 || "#062B5C")}" data-size="${size}"
      onerror="crestFallbackHandler(this)">`;
  }
  return crestFallback(team, size);
}
function crestFallbackHandler(img) {
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
  const q = encodeURIComponent(`${homeTeam.name} ${gh}x${ga} ${awayTeam.name} Brasileirão gols melhores momentos`);
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
function dashRowHTML(row, pos) {
  const team = TEAM_MAP[row.id];
  const zone = zoneOfPosition(pos);
  return `<tr data-zone="${zone}">
    <td><span class="pos">${pos}</span></td>
    <td>${crestEl(team, 22)}</td>
    <td class="team-cell">${team.name}</td>
    <td class="num">${row.pts}</td><td class="num">${row.j}</td><td class="num">${row.v}</td>
    <td class="num">${row.e}</td><td class="num">${row.d}</td>
    <td class="num only-desktop">${row.gp}</td><td class="num only-desktop">${row.gc}</td>
    <td class="num only-desktop">${row.sg > 0 ? "+" + row.sg : row.sg}</td>
    <td class="num mobile-only-col">${row.pts}</td>
  </tr>`;
}
function fullRowHTML(row, pos) {
  const team = TEAM_MAP[row.id];
  const isFav = state.favorites.includes(team.id);
  const zone = zoneOfPosition(pos);
  return `<tr data-zone="${zone}">
    <td><span class="pos">${pos}</span></td>
    <td>${crestEl(team, 24)}</td>
    <td><div class="team-cell">${team.name}<span class="fav-heart ${isFav ? "active" : ""}" data-team="${team.id}" title="Favoritar">${isFav ? "♥" : "♡"}</span></div></td>
    <td class="num">${row.pts}</td><td class="num">${row.j}</td><td class="num">${row.v}</td><td class="num">${row.e}</td><td class="num">${row.d}</td>
    <td class="num">${row.sg > 0 ? "+" + row.sg : row.sg}</td><td class="num">${row.gp}</td><td class="num">${aprov(row.pts, row.j)}%</td>
  </tr>`;
}
// Linha compacta pra tabela da barra lateral do Simulador (espaço estreito).
function simTableRowHTML(row, pos) {
  const team = TEAM_MAP[row.id];
  const zone = zoneOfPosition(pos);
  return `<tr data-zone="${zone}">
    <td><span class="pos">${pos}</span></td>
    <td>${crestEl(team, 20)}</td>
    <td class="team-cell">${team.short}</td>
    <td class="num">${row.pts}</td>
    <td class="num only-desktop">${row.sg > 0 ? "+" + row.sg : row.sg}</td>
  </tr>`;
}

/* ================= PÁGINA: DASHBOARD ================= */
function renderDashboard() {
  const standings = currentStandings();
  document.getElementById("roundPill").textContent = `Rodada ${Math.min(firstUndecidedRound(), TOTAL_ROUNDS)}/${TOTAL_ROUNDS}`;

  renderDashKpis(standings);
  document.getElementById("dashStandings").innerHTML = standings.slice(0, 6).map((r, i) => dashRowHTML(r, i + 1)).join("") || `<tr><td colspan="7" class="empty">Sem jogos decididos ainda.</td></tr>`;
  renderDashTitleChance();
  renderDashNextFixtures();
  renderFormaInto("formaRecenteBody", state.formaTeamId || standings[0]?.id);
  renderRadarInto("radarChart", state.radarTeamId || standings[0]?.id);
  renderCompareInto("compareBody", state.compareA || standings[0]?.id, state.compareB || standings[1]?.id);
  renderDashOdds();
  renderOddsChart();
  renderWhatIf();
  renderDashNewsMini();
}

function renderDashNewsMini() {
  const box = document.getElementById("dashNewsMini");
  if (!box) return;
  const items = [
    { tag: "Mercado", title: "Exemplo de notícia — conecte uma fonte real.", time: "há 2h" },
    { tag: "Análise", title: "Exemplo de análise — conteúdo de demonstração.", time: "há 4h" },
    { tag: "Lesão", title: "Exemplo de boletim — troque por fonte confiável.", time: "há 6h" },
  ];
  box.innerHTML = items.map(n => `<div class="news-mini"><div class="thumb"></div><div><h4>${n.title}</h4><div class="meta">${n.tag} · ${n.time}</div></div></div>`).join("");
}

function renderDashKpis(standings) {
  const matches = allDecidedMatches();
  const withStats = matches.filter(m => m.stats);
  const totalGols = matches.reduce((s, m) => s + m.gh + m.ga, 0);
  const mediaGols = matches.length ? (totalGols / matches.length).toFixed(2) : "0.00";
  const posseAvg = withStats.length ? Math.round(withStats.reduce((s, m) => s + m.stats.posse[0] + m.stats.posse[1], 0) / (withStats.length * 2)) : 0;
  const homeWins = matches.filter(m => m.gh > m.ga).length;
  const homeWinPct = matches.length ? Math.round((homeWins / matches.length) * 100) : 0;

  document.getElementById("kpiLeader").innerHTML = standings[0] ? `${TEAM_MAP[standings[0].id].short} <small>${standings[0].pts} pts</small>` : "—";
  document.getElementById("kpiGoalsAvg").textContent = mediaGols;
  document.getElementById("kpiPossAvg").textContent = posseAvg ? posseAvg + "%" : "—";
  document.getElementById("kpiGoalsTotal").textContent = totalGols;
  document.getElementById("kpiHomeWin").textContent = homeWinPct + "%";

  if (standings[0]) {
    const leaderTeam = TEAM_MAP[standings[0].id];
    document.getElementById("liderCrest").innerHTML = crestEl(leaderTeam, 52);
    document.getElementById("liderTeamName").textContent = leaderTeam.name;
    document.getElementById("liderPts").textContent = standings[0].pts;
  }
}

function renderDashTitleChance() {
  if (!state.probResults) { runProbabilitiesQuiet(); }
  const ordered = TEAMS.map(t => ({ team: t, p: state.probResults[t.id] })).filter(x => x.p).sort((a, b) => b.p.campeao - a.p.campeao).slice(0, 5);
  document.getElementById("dashTitleChance").innerHTML = ordered.map(({ team, p }) => `
    <div class="prob-row">
      <div class="top-line"><div class="team-cell">${crestEl(team, 20)}<span>${team.name}</span></div><b>${(p.campeao * 100).toFixed(1)}%</b></div>
      <div class="prob-track"><div class="prob-fill" style="width:${Math.max(p.campeao * 100, 1)}%; background:var(--brd-yellow);"></div></div>
    </div>`).join("");
}

function renderDashNextFixtures() {
  const out = [];
  for (let r = firstUndecidedRound(); r <= TOTAL_ROUNDS && out.length < 4; r++) {
    getRoundMatches(r).filter(m => m.pending).forEach(m => { if (out.length < 4) out.push(m); });
  }
  document.getElementById("dashNextFixtures").innerHTML = out.length ? out.map(fixtureRowHTML).join("") : `<div class="empty">Sem jogos futuros cadastrados.</div>`;
}

function fixtureRowHTML(m) {
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
    <div class="teams">${crestEl(H, 20)}<span>${H.short}</span><span class="vs">×</span><span>${A.short}</span>${crestEl(A, 20)}</div>
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
function oddsInnerHTML(m) {
  const H = TEAM_MAP[m.home], A = TEAM_MAP[m.away];
  const domId = `oddsinner-${m.round}-${m.home}-${m.away}`;
  const needsLazyLoad = LIVE_MODE && m.fixtureId && m.odds === undefined;
  if (needsLazyLoad) {
    loadFixtureOdds(m.fixtureId).then(odds => { m.odds = odds; const el = document.getElementById(domId); if (el) el.outerHTML = oddsInnerHTML(m); })
      .catch(() => { m.odds = null; const el = document.getElementById(domId); if (el) el.outerHTML = oddsInnerHTML(m); });
  }
  const pillsHTML = m.odds
    ? `<div class="odds-pills3">
        <div class="odds-pill3"><span>Casa</span><b>${m.odds.home?.toFixed(2) ?? "—"}</b></div>
        <div class="odds-pill3"><span>Empate</span><b>${m.odds.draw?.toFixed(2) ?? "—"}</b></div>
        <div class="odds-pill3"><span>Fora</span><b>${m.odds.away?.toFixed(2) ?? "—"}</b></div>
      </div>`
    : LIVE_MODE && m.fixtureId
      ? `<div class="empty" style="padding:10px 0;">${m.odds === null ? "Odds não disponíveis para este jogo/plano." : "Carregando odds..."}</div>`
      : `<div class="empty" style="padding:10px 0;">Ative a integração com a API-Sports para ver odds ao vivo.</div>`;
  const affiliateStrip = AFFILIATE_OPERATORS.map(op => `
    <a class="affiliate-chip ${op.url === "#" ? "disabled" : ""}" style="background:${op.color}" href="${op.url}" target="_blank" rel="sponsored noopener"
       ${op.url === "#" ? 'onclick="return false;" title="Configure em js/affiliates.js"' : ""}>${op.name}</a>`).join("");
  return `
    <div id="${domId}">
      <div class="odds-hero"><div class="match">${H.short} × ${A.short}</div><div class="meta">${fmtFixtureDate(m.date, m.round)}</div></div>
      ${pillsHTML}
      <div class="affiliate-strip">${affiliateStrip}</div>
      <div class="compliance-line">🔞 Publicidade. Proibido para menores de 18 anos. Jogue com responsabilidade — aposta não é investimento.
        <a href="${RESPONSIBLE_GAMBLING_URL}" target="_blank" rel="noopener">Autoexclusão (gov.br)</a></div>
    </div>`;
}
function renderDashOdds() {
  const m = nextFixtureWithId();
  document.getElementById("dashOddsBlock").innerHTML = m ? oddsInnerHTML(m) : `<div class="empty">Sem próximos jogos cadastrados.</div>`;
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
async function renderOddsChart() {
  const m = nextFixtureWithId();
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
function matchDetailsHTML(m) {
  const goals = m.goals || [];
  const goalsHTML = goals.length ? `
    <div class="goals-list">${goals.map(g => `<div class="goal-line"><b>${g.min}'</b> ⚽ ${TEAM_MAP[g.team].short} · ${g.player || ("Camisa " + g.camisa)}</div>`).join("")}</div>`
    : `<div class="goals-list"><div class="goal-line">Sem gols na partida.</div></div>`;
  const s = m.stats;
  return `${goalsHTML}
    <div style="margin-top:14px;">
      ${statBarRow("Posse de bola", s.posse[0], s.posse[1], "%")}
      ${statBarRow("Finalizações", s.finalizacoes[0], s.finalizacoes[1])}
      ${statBarRow("Escanteios", s.escanteios[0], s.escanteios[1])}
      ${statBarRow("Cartões amarelos", s.amarelos[0], s.amarelos[1])}
    </div>`;
}
function fullMatchCardHTML(m) {
  const H = TEAM_MAP[m.home], A = TEAM_MAP[m.away];
  if (m.pending) {
    return `
    <div class="match-card">
      <div class="match-teams">
        <div class="match-team">${crestEl(H, 40)}<span class="tname">${H.name}</span></div>
        <div class="match-score"><span class="dash">vs</span></div>
        <div class="match-team">${crestEl(A, 40)}<span class="tname">${A.name}</span></div>
      </div>
      <div class="match-meta"><span class="pending-tag">${fmtFixtureDate(m.date, m.round)}</span></div>
      <div style="margin-top:14px; padding-top:14px; border-top:1px solid var(--border);">${oddsInnerHTML(m)}</div>
    </div>`;
  }
  const domId = `match-${m.round}-${m.home}-${m.away}`;
  const needsLazyLoad = LIVE_MODE && m.fixtureId && !m.stats;
  const body = m.stats ? matchDetailsHTML(m) : needsLazyLoad ? `<div class="empty">Carregando estatísticas...</div>` : `<div class="empty">Estatísticas não disponíveis para este jogo.</div>`;
  if (needsLazyLoad) {
    loadFixtureDetails(m.fixtureId, m.home, m.away).then(det => { m.stats = det.stats; m.goals = det.goals; const el = document.getElementById(domId); if (el) el.outerHTML = fullMatchCardHTML(m); }).catch(() => {});
  }
  return `
    <div class="match-card" id="${domId}">
      <div class="match-teams">
        <div class="match-team">${crestEl(H, 40)}<span class="tname">${H.name}</span></div>
        <div class="match-score">${m.gh} <span class="dash">×</span> ${m.ga}</div>
        <div class="match-team">${crestEl(A, 40)}<span class="tname">${A.name}</span></div>
      </div>
      <div class="match-meta">Rodada ${m.round} ${m.simulated ? "· simulado" : "· encerrado"}</div>
      ${body}
      ${watchLink(H, A, m.gh, m.ga)}
    </div>`;
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
  const leaderRow = (id, value) => { const t = TEAM_MAP[id]; return `<tr><td><div class="team-cell">${crestEl(t, 22)}${t.name}</div></td><td class="num" style="font-weight:700;">${value}</td></tr>`; };
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
  document.getElementById("fullStandings").innerHTML = standings.map((r, i) => fullRowHTML(r, i + 1)).join("") || `<tr><td colspan="11" class="empty">Sem jogos decididos ainda.</td></tr>`;
  document.querySelectorAll("#fullStandings .fav-heart").forEach(h => h.addEventListener("click", onToggleFavoriteClick));
}

/* ================= PÁGINA: ESTATÍSTICAS ================= */
function renderEstatisticasPage() {
  renderEstatisticasConsolidadas("statTiles2", "leaderAtaque2", "leaderDefesa2", "leaderCartoes2");
  renderCompareInto("compareBody2", document.getElementById("compareTeamA2").value, document.getElementById("compareTeamB2").value);
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
  playersListCache = LIVE_MODE ? await loadPlayersLeaders() : DEMO_PLAYERS;
  return playersListCache;
}
function playerCardsValue(p) { return p.yellow + p.red * 2; }
// Linha compacta pro card de cada categoria — mesmo visual das
// listas "Melhor ataque/defesa" (crest + nome + valor em destaque).
function playerLeaderRowHTML(p, valueLabel) {
  const team = TEAM_MAP[p.teamId];
  return `<tr>
    <td><div class="team-cell">${team ? crestEl(team, 22) : ""}<b>${p.name}</b>${team ? `<span style="color:var(--text-2); font-weight:500;"> · ${team.short}</span>` : ""}</div></td>
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

/* ================= PÁGINA: ODDS ================= */
function renderOddsPage() {
  const fixtures = [];
  for (let r = firstUndecidedRound(); r <= TOTAL_ROUNDS && fixtures.length < 8; r++) {
    getRoundMatches(r).filter(m => m.pending).forEach(m => { if (fixtures.length < 8) fixtures.push(m); });
  }
  document.getElementById("oddsPageList").innerHTML = fixtures.length
    ? fixtures.map(m => `<div class="card" style="margin-bottom:14px;">${oddsInnerHTML(m)}</div>`).join("")
    : `<div class="card empty">Sem jogos futuros cadastrados.</div>`;
}

/* ================= PÁGINA: SIMULADOR ================= */
function renderSimulador() {
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
        <div class="match-team" style="flex-direction:row; gap:8px;">${crestEl(H, 30)}<span class="tname">${H.short}</span></div>
        <div class="sim-inputs">
          <input class="score-input inp-h" type="number" min="0" max="15" value="${existing ? existing.gh : ""}" placeholder="-" ${locked ? "disabled" : ""}>
          <span class="dash">×</span>
          <input class="score-input inp-a" type="number" min="0" max="15" value="${existing ? existing.ga : ""}" placeholder="-" ${locked ? "disabled" : ""}>
        </div>
        <div class="match-team" style="flex-direction:row-reverse; gap:8px;">${crestEl(A, 30)}<span class="tname">${A.short}</span></div>
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
      <div class="card-head"><div class="team-cell">${crestEl(team, 26)}<span style="font-weight:700;">${team.name}</span></div><span style="font-size:10.5px; color:var(--text-2);">pos. média ${p.posMedia.toFixed(1)}</span></div>
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
function loadFavorites() {
  try { state.favorites = JSON.parse(localStorage.getItem("brdata_favorites") || "[]"); } catch { state.favorites = []; }
}
function saveFavorites() {
  try { localStorage.setItem("brdata_favorites", JSON.stringify(state.favorites)); } catch {}
}
function toggleFavorite(teamId) {
  const i = state.favorites.indexOf(teamId);
  if (i >= 0) state.favorites.splice(i, 1); else state.favorites.push(teamId);
  saveFavorites();
  renderMyTeamsSidebar();
  if (state.page === "tabela") renderTabela();
  if (state.page === "favoritos") renderFavoritosPage();
}
function onToggleFavoriteClick(e) { toggleFavorite(e.currentTarget.dataset.team); }

function renderMyTeamsSidebar() {
  const box = document.getElementById("myTeamsList");
  if (!state.favorites.length) { box.innerHTML = `<div style="font-size:11.5px; color:#8FA3C7; padding:4px 10px 8px;">Nenhum time favoritado ainda.</div>`; return; }
  box.innerHTML = state.favorites.map(id => {
    const t = TEAM_MAP[id]; if (!t) return "";
    return `<div class="side-link" style="cursor:default;">${crestEl(t, 18)}<span style="margin-left:2px;">${t.name}</span><span class="heart" data-team="${id}" title="Remover">✕</span></div>`;
  }).join("");
  box.querySelectorAll(".heart").forEach(h => h.addEventListener("click", () => toggleFavorite(h.dataset.team)));
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
      <div class="fixture-teams">${crestEl(t, 26)}<span>${t.name}</span></div>
      <div style="font-size:12px; color:var(--text-1);">${row ? `${idx + 1}º · ${row.pts} pts` : "—"}</div>
    </div>`;
  }).join("");
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

/* ================= NOTÍCIAS (placeholder) ================= */
function renderNews() {
  const items = [
    { tag: "Mercado", tagClass: "tag-blue", title: "Exemplo de notícia de mercado — conecte uma fonte real (RSS/API) para substituir este texto.", time: "há 2h" },
    { tag: "Análise", tagClass: "tag-green", title: "Exemplo de análise tática — este é um item de demonstração, não uma notícia real.", time: "há 4h" },
    { tag: "Lesão", tagClass: "tag-red", title: "Exemplo de boletim médico — troque por conteúdo de uma fonte jornalística confiável.", time: "há 6h" },
  ];
  document.getElementById("newsList").innerHTML = items.map(n => `
    <div class="news-item"><div class="news-thumb"></div><div><span class="tag ${n.tagClass}">${n.tag}</span><h4>${n.title}</h4><div class="meta">${n.time}</div></div></div>`).join("");
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
  populateSelect(document.getElementById("formaTeamSelect"), leader);
  populateSelect(document.getElementById("radarTeamSelect"), leader);
  populateSelect(document.getElementById("radarTeamSelect2"), leader);
  populateSelect(document.getElementById("compareTeamA"), leader);
  populateSelect(document.getElementById("compareTeamB"), second);
  populateSelect(document.getElementById("compareTeamA2"), leader);
  populateSelect(document.getElementById("compareTeamB2"), second);
  populateSelect(document.getElementById("whatifTeamSelect"), state.whatifTeamId || leader);
  state.compareA = leader; state.compareB = second; state.formaTeamId = leader; state.radarTeamId = leader;
}

/* ================= NAVEGAÇÃO ================= */
const PAGES = ["dashboard", "jogos", "tabela", "estatisticas", "odds", "simulador", "probabilidades", "favoritos", "noticias", "mais"];
function setActivePage(name, opts = {}) {
  state.page = name;
  PAGES.forEach(p => document.getElementById(`page-${p}`)?.classList.toggle("active", p === name));
  document.querySelectorAll(".top-tab").forEach(t => t.classList.toggle("active", t.dataset.page === name));
  document.querySelectorAll(".side-link[data-page]").forEach(t => t.classList.toggle("active", t.dataset.page === name));
  document.querySelectorAll(".bn-item").forEach(t => t.classList.toggle("active", t.dataset.page === name || (name !== "dashboard" && name !== "jogos" && name !== "tabela" && name !== "odds" && t.dataset.page === "mais")));
  document.getElementById("sidebar").classList.remove("open");

  if (name === "dashboard") renderDashboard();
  if (name === "jogos") renderJogos();
  if (name === "tabela") renderTabela();
  if (name === "estatisticas") renderEstatisticasPage();
  if (name === "odds") renderOddsPage();
  if (name === "simulador") renderSimulador();
  if (name === "probabilidades") { if (!state.probResults) runProbabilities(); else renderProbList(); }
  if (name === "favoritos") renderFavoritosPage();
  if (name === "noticias") renderNews();

  if (opts.scrollTo) setTimeout(() => document.getElementById(opts.scrollTo)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
}

function setupEventListeners() {
  document.querySelectorAll("[data-page]").forEach(el => {
    el.addEventListener("click", () => setActivePage(el.dataset.page, { scrollTo: el.dataset.scroll }));
  });

  document.getElementById("btnHamburger").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));
  document.getElementById("themeSwitch").addEventListener("click", toggleTheme);
  document.getElementById("btnPremium").addEventListener("click", () => alert("Em breve! Conecte este botão ao seu checkout (Stripe, Mercado Pago etc.) quando o plano Premium estiver pronto."));
  document.getElementById("btnPremiumMobile")?.addEventListener("click", () => alert("Em breve! Conecte este botão ao seu checkout (Stripe, Mercado Pago etc.) quando o plano Premium estiver pronto."));
  document.getElementById("btnPremiumRail")?.addEventListener("click", () => alert("Em breve! Conecte este botão ao seu checkout (Stripe, Mercado Pago etc.) quando o plano Premium estiver pronto."));
  document.getElementById("themeSwitchMobile")?.addEventListener("click", () => { toggleTheme(); document.getElementById("themeSwitchMobile").classList.toggle("on", document.documentElement.getAttribute("data-theme") === "dark"); });

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
  document.querySelectorAll(".sort-chip[data-sub]").forEach(chip => chip.addEventListener("click", () => {
    document.querySelectorAll(".sort-chip[data-sub]").forEach(c => c.classList.remove("active"));
    chip.classList.add("active"); state.jogosSub = chip.dataset.sub;
    document.getElementById("sub-rodadas").style.display = state.jogosSub === "rodadas" ? "block" : "none";
    document.getElementById("sub-stats").style.display = state.jogosSub === "stats" ? "block" : "none";
  }));
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

  // Dashboard: seletores
  document.getElementById("formaTeamSelect").addEventListener("change", e => { state.formaTeamId = e.target.value; renderFormaInto("formaRecenteBody", state.formaTeamId); });
  document.getElementById("radarTeamSelect").addEventListener("change", e => renderRadarInto("radarChart", e.target.value));
  document.getElementById("radarTeamSelect2").addEventListener("change", e => renderRadarInto("radarChart2", e.target.value));
  document.getElementById("compareTeamA").addEventListener("change", e => { state.compareA = e.target.value; renderCompareInto("compareBody", state.compareA, state.compareB); });
  document.getElementById("compareTeamB").addEventListener("change", e => { state.compareB = e.target.value; renderCompareInto("compareBody", state.compareA, state.compareB); });
  document.getElementById("compareTeamA2").addEventListener("change", () => renderCompareInto("compareBody2", document.getElementById("compareTeamA2").value, document.getElementById("compareTeamB2").value));
  document.getElementById("compareTeamB2").addEventListener("change", () => renderCompareInto("compareBody2", document.getElementById("compareTeamA2").value, document.getElementById("compareTeamB2").value));

  document.getElementById("whatifTeamSelect").addEventListener("change", e => { state.whatifTeamId = e.target.value; renderWhatIf(); });
  document.getElementById("whatifMinus").addEventListener("click", () => { state.whatifN = Math.max(1, state.whatifN - 1); renderWhatIf(); });
  document.getElementById("whatifPlus").addEventListener("click", () => { state.whatifN = Math.min(19, state.whatifN + 1); renderWhatIf(); });

  document.getElementById("oddsRangeTabs").addEventListener("click", e => {
    const btn = e.target.closest(".range-tab"); if (!btn) return;
    document.querySelectorAll("#oddsRangeTabs .range-tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active"); state.oddsRange = btn.dataset.range; renderOddsChart();
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
      setActivePage("tabela");
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
