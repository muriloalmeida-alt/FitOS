/* ===================================================================
   CARREIRA.JS — "Modo Técnico" (carreira estilo Elifoot)
   -------------------------------------------------------------------
   Página própria (public/carreira.html), separada do app.js dos
   usuários finais — mesmo espírito de public/js/admin.js (ver
   comentário lá): script isolado, sem nada do motor de tabela/odds do
   site principal.

   ARQUITETURA (importante pra quem for mexer aqui):
   - O ELENCO/CALENDÁRIO/TABELA/NOTÍCIAS dessa carreira são montados e
     recalculados INTEIRAMENTE no cliente, dentro do objeto `CAREER`
     (ver comentário no topo de server/src/careerStore.js — o backend
     só guarda o blob, não entende nada de futebol).
   - Elenco PRINCIPAL: quando há dado ao vivo (mesma API-Sports/
     Sportmonks que o resto do BR Data usa — ver /api/teams/:id/players),
     os jogadores REAIS daquele time viram a base do elenco, com
     atributos de jogo (ataque/defesa/físico/geral) CALCULADOS a partir
     das estatísticas da temporada (gols, assistências, nota) — a API
     não expõe "força" de jogador nenhuma, isso é estimado aqui. Sem
     dado ao vivo (ou sem chave configurada no host), cai no mesmo
     elenco de exemplo (DEMO_PLAYERS) que o resto do site usa em modo
     Exemplo — ver js/data.js, carregado ANTES deste arquivo.
   - Elenco da BASE: a API-Sports/Sportmonks não cobre elenco sub-20 do
     Brasileirão de forma confiável — ver decisão do usuário (opção
     "Base gerada proceduralmente" na conversa que criou essa feature).
     Por isso a base é SEMPRE gerada (jogadores fictícios, jovens,
     atributos mais baixos), pros 20 clubes, ao vivo ou não.
   - Motor de simulação: "força agregada por escalação" (decisão do
     usuário) — a força do SEU time num jogo vem da média dos atributos
     dos titulares escalados (+ formação/táticas/condição física como
     multiplicadores), não de um evento a evento por jogador. Os outros
     19 times (controlados pela CPU) usam a MESMA fórmula de Poisson do
     motor principal (ver public/js/engine.js) com a força bruta do
     clube (TEAM_MAP-like), sem lineup nenhum — não duplicamos gestão
     de elenco pra quem o usuário não está comandando.
=================================================================== */

/* ---------- Constantes de tática/formação ---------- */
const FORMATIONS = {
  "4-4-2":   [["G","GOL"],["D","LAT D"],["D","ZAG"],["D","ZAG"],["D","LAT E"],["M","MEI D"],["M","VOL"],["M","VOL"],["M","MEI E"],["F","ATA"],["F","ATA"]],
  "4-3-3":   [["G","GOL"],["D","LAT D"],["D","ZAG"],["D","ZAG"],["D","LAT E"],["M","VOL"],["M","MEI"],["M","MEI"],["F","PONTA D"],["F","CENTROAV."],["F","PONTA E"]],
  "4-2-3-1": [["G","GOL"],["D","LAT D"],["D","ZAG"],["D","ZAG"],["D","LAT E"],["M","VOL"],["M","VOL"],["M","MEIA D"],["M","MEIA C"],["M","MEIA E"],["F","CENTROAV."]],
  "3-5-2":   [["G","GOL"],["D","ZAG"],["D","ZAG"],["D","ZAG"],["M","ALA D"],["M","VOL"],["M","MEI"],["M","VOL"],["M","ALA E"],["F","ATA"],["F","ATA"]],
  "4-5-1":   [["G","GOL"],["D","LAT D"],["D","ZAG"],["D","ZAG"],["D","LAT E"],["M","MEI D"],["M","VOL"],["M","MEI"],["M","VOL"],["M","MEI E"],["F","CENTROAV."]],
  "5-3-2":   [["G","GOL"],["D","ALA D"],["D","ZAG"],["D","ZAG"],["D","ZAG"],["D","ALA E"],["M","VOL"],["M","MEI"],["M","VOL"],["F","ATA"],["F","ATA"]],
};
// Modificadores puramente ilustrativos (não vieram de dado nenhum,
// são só "sabor tático" pra formação/instrução importar de verdade no
// resultado) — atk multiplica a força de ataque, def multiplica a
// "qualidade defensiva" (quanto MAIOR, melhor a defesa nessa escala —
// ver computeHumanStrength).
const FORMATION_MOD = {
  "4-4-2": { atk: 1.00, def: 1.00 },
  "4-3-3": { atk: 1.06, def: 0.96 },
  "4-2-3-1": { atk: 1.02, def: 1.02 },
  "3-5-2": { atk: 1.05, def: 0.95 },
  "4-5-1": { atk: 0.93, def: 1.07 },
  "5-3-2": { atk: 0.90, def: 1.10 },
};
const TACTIC_OPTIONS = {
  mentality: [["defensiva", "Defensiva"], ["equilibrada", "Equilibrada"], ["ofensiva", "Ofensiva"]],
  marking: [["zona", "Zona"], ["individual", "Individual"]],
  tempo: [["paciente", "Paciente"], ["normal", "Normal"], ["direto", "Direto (bola longa)"]],
};
const TACTIC_MOD = {
  mentality: { defensiva: { atk: 0.90, def: 1.10 }, equilibrada: { atk: 1, def: 1 }, ofensiva: { atk: 1.10, def: 0.90 } },
  marking: { zona: { atk: 1, def: 1 }, individual: { atk: 0.98, def: 1.05 } },
  tempo: { paciente: { atk: 0.96, def: 1.04 }, normal: { atk: 1, def: 1 }, direto: { atk: 1.05, def: 0.97 } },
};
const TRAINING_OPTIONS = [["equilibrado", "Equilibrado"], ["ataque", "Foco em ataque"], ["defesa", "Foco em defesa"], ["fisico", "Foco físico"]];
const TRAINING_MOD = {
  equilibrado: { atk: 1, def: 1 }, ataque: { atk: 1.03, def: 0.99 },
  defesa: { atk: 0.99, def: 1.03 }, fisico: { atk: 1, def: 1 },
};
// Posição pra ORDENAR/rotular o elenco — limitada ao que os
// fornecedores de dado esportivo REALMENTE informam (Goleiro/Defensor/
// Meio-campo/Atacante, ver mapPositionGroup logo abaixo; nem
// API-Sports nem Sportmonks vão além disso). Uma versão anterior deste
// arquivo tentava separar Volante de Meio-campo, e Centroavante de
// Atacante, inferindo isso a partir de atributos calculados por nós
// (físico) em vez de dado real — relatado pelo usuário como "as
// posições não refletem a posição real que o jogador joga". Removido:
// melhor mostrar as 4 posições que a gente sabe de verdade do que 6
// "de mentira".
const SUBPOS_ORDER = { GOL: 0, DEF: 1, MEI: 2, ATA: 3 };
const SUBPOS_LABEL = { GOL: "Goleiro", DEF: "Defensor", MEI: "Meio-campo", ATA: "Atacante" };
function subPositionOf(p) {
  return { G: "GOL", D: "DEF", M: "MEI", F: "ATA" }[p.group] || "DEF";
}
function squadSortKey(p) { return (SUBPOS_ORDER[subPositionOf(p)] ?? 9) * 1000 - p.overall; }

/* ---------- Estado ---------- */
let LIVE_MODE = false;
let LIVE_SEASON = new Date().getFullYear();
let LEAGUE_TEAMS = []; // 20 clubes ativos (real ou DEMO_TEAMS — ver loadLeague)
let CAREER = null;     // save inteiro da carreira atual (null = sem carreira ainda)
let PICKER_CTX = null; // contexto do modal de escolha de jogador ({type:"slot",index} ou {type:"bench",currentId})

/* ---------- Helpers genéricos ---------- */
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function avg(arr) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null; }
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function weightedPick(items, weights) {
  const total = weights.reduce((s, w) => s + w, 0) || 1;
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}
async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => null);
  if (!res.ok) { const e = new Error(data?.error || `Falha em ${url}`); e.status = res.status; e.code = data?.code; throw e; }
  return data;
}
let toastTimer = null;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = "none"; }, 3600);
}
function show(name) {
  ["screenLoading", "screenLoginRequired", "screenPicker", "screenGame"].forEach((id) => {
    document.getElementById(id).classList.toggle("hidden", id !== name);
  });
}
function applyStoredTheme() {
  try { document.documentElement.setAttribute("data-theme", localStorage.getItem("brdata_theme") || "light"); } catch {}
}

/* ---------- Times ativos (ao vivo com o mesmo fornecedor do BR Data, ou modo Exemplo) ---------- */
// Mesma técnica de public/js/liveData.js (calibrateStrengths), duplicada
// aqui de propósito — esta página não carrega liveData.js/app.js (são
// específicos do dashboard principal), só js/data.js (times/jogadores
// de exemplo + gerador de calendário, ver js/data.js).
function calibrateStrengths(standings) {
  const withGames = standings.filter((r) => r.j > 0);
  if (!withGames.length) return {};
  const leagueAvg = withGames.reduce((s, r) => s + r.gp / r.j, 0) / withGames.length || 1;
  const out = {};
  standings.forEach((r) => {
    const gfpg = r.j ? r.gp / r.j : leagueAvg;
    const gapg = r.j ? r.gc / r.j : leagueAvg;
    out[r.id] = { atk: clamp(gfpg / leagueAvg, 0.5, 2.3), def: clamp(gapg / leagueAvg, 0.4, 2.3) };
  });
  return out;
}
// Casa o nome do time (fornecedor ao vivo) com o catálogo de cores já
// curado em DEMO_TEAMS (js/data.js) — mesma técnica de realTeamColor()
// em public/js/liveData.js, duplicada aqui de propósito (esta página
// não carrega liveData.js/app.js, só js/data.js). Sem isso, os discos
// do campinho "jogo de botão" (ver renderPitch) sairiam todos com a
// mesma cor genérica em modo ao vivo, sem relação com o clube de
// verdade.
function normalizeNameForColor(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function realTeamColor(name) {
  const norm = normalizeNameForColor(name);
  const match = DEMO_TEAMS.find((t) => normalizeNameForColor(t.name) === norm || (t.aliases || []).some((a) => normalizeNameForColor(a) === norm));
  return match ? { c1: match.c1, c2: match.c2, c3: match.c3 } : null;
}
async function loadLeague() {
  try {
    const health = await fetchJSON("/api/health");
    if (!health.hasKey) throw new Error("sem chave configurada");
    if (health.season) LIVE_SEASON = Number(health.season) || LIVE_SEASON;
    const [teamsData, standingsData] = await Promise.all([
      fetchJSON(`/api/teams?season=${LIVE_SEASON}&competition=brasileirao`),
      fetchJSON(`/api/standings?season=${LIVE_SEASON}&competition=brasileirao`),
    ]);
    if (!teamsData.teams || !teamsData.teams.length) throw new Error("resposta vazia");
    const strengths = calibrateStrengths(standingsData.standings || []);
    LEAGUE_TEAMS = teamsData.teams.map((t) => {
      const realColor = realTeamColor(t.name);
      return {
        ...t, atk: strengths[t.id]?.atk ?? 1.3, def: strengths[t.id]?.def ?? 1.05,
        c1: realColor?.c1 || "#0057B8", c2: realColor?.c2 || "#062B5C", c3: realColor?.c3,
      };
    });
    LIVE_MODE = true;
  } catch {
    LEAGUE_TEAMS = DEMO_TEAMS; // global vindo de js/data.js
    LIVE_MODE = false;
  }
}
// Nunca deixa a tela quebrar por um id de clube que não existe mais em
// LEAGUE_TEAMS (ex.: carreira criada em modo ao vivo, revisitada depois
// sem a chave configurada — os 2 esquemas de id são diferentes, ver
// aviso no topo do arquivo) — devolve um placeholder plausível em vez
// de undefined.
function teamById(id) {
  return LEAGUE_TEAMS.find((t) => String(t.id) === String(id))
    || { id, name: `Time #${id}`, short: String(id).slice(0, 3).toUpperCase(), c1: "#8892A0", c2: "#333" };
}
function crestImg(t) {
  if (t && t.logo) return `<img src="${t.logo}" alt="">`;
  const c1 = t?.c1 || "#8892A0", c2 = t?.c2 || "#333";
  return `<div style="height:40px;width:40px;border-radius:50%;background:linear-gradient(135deg, ${c1}, ${c2});flex-shrink:0;"></div>`;
}
// Mesmo degradê de cores do clube usado no "jogo de botão" do dashboard
// principal (ver teamGradientStops em public/js/app.js) — duplicado
// aqui pelo mesmo motivo de sempre (esta página não carrega app.js).
function teamGradientStops(colors) {
  return [colors?.c1 || "#0057B8", colors?.c2 || "#062B5C", colors?.c3].filter(Boolean).join(", ");
}
function lastNameOf(name) {
  const parts = String(name || "").trim().split(/\s+/);
  return parts[parts.length - 1] || name || "?";
}

/* ---------- Elenco: jogadores reais (mesma fonte do BR Data) + base gerada ---------- */
async function fetchRealPlayers(teamId) {
  if (!LIVE_MODE) return DEMO_PLAYERS.filter((p) => String(p.teamId) === String(teamId));
  try {
    const data = await fetchJSON(`/api/teams/${teamId}/players?season=${LIVE_SEASON}&competition=brasileirao`);
    return data.players || [];
  } catch { return []; }
}
function mapPositionGroup(raw) {
  const s = String(raw || "").toLowerCase();
  if (!s) return null;
  if (s.includes("goal") || s.includes("goleiro")) return "G";
  if (s.includes("defen") || s.includes("zagueiro") || s.includes("lateral") || s.includes("back")) return "D";
  if (s.includes("mid") || s.includes("meia") || s.includes("volante")) return "M";
  if (s.includes("attack") || s.includes("forward") || s.includes("ataque") || s.includes("atacante")) return "F";
  return null;
}
// Atributos de jogo pra jogador REAL — a API não devolve "força" nenhuma
// (isso não existe em nenhum fornecedor de dado esportivo público), só
// estatística (gols/assistências/nota/posição). Estimativa: parte de
// uma base ligada à força geral do clube (times melhores tendem a ter
// elenco melhor), ajustada pela produção individual (gols+assistência
// por jogo) e pela nota média da temporada quando existe (Sportmonks
// hoje não preenche nota — ver aviso em providers/sportmonks.js — cai
// num valor neutro nesse caso). Jitter (rng) garante que 2 jogadores
// com a mesma estatística não fiquem clones um do outro.
function buildRealPlayer(raw, club, rng) {
  const group = mapPositionGroup(raw.position) || ["D", "M", "F"][Math.floor(rng() * 3)];
  const ratingBase = raw.rating != null ? clamp((raw.rating - 5) / 4, 0, 1) : 0.5;
  const gpg = raw.games ? (raw.goals || 0) / raw.games : 0;
  const apg = raw.games ? (raw.assists || 0) / raw.games : 0;
  const prod = clamp(gpg * 3 + apg * 1.6, 0, 1);
  const clubFactor = (group === "F" || group === "M") ? club.atk : (2 - club.def);
  const overall = Math.round(clamp(56 + ratingBase * 18 + prod * 10 + (clubFactor - 1) * 10 + (rng() * 10 - 5), 42, 92));
  const atk = clamp(Math.round(overall + (group === "F" ? 6 : group === "M" ? 2 : -10) + Math.round(rng() * 6 - 3)), 30, 96);
  const def = clamp(Math.round(overall + (group === "D" || group === "G" ? 6 : -10) + Math.round(rng() * 6 - 3)), 30, 96);
  const phys = clamp(Math.round(58 + rng() * 30), 40, 92);
  const age = 18 + Math.floor(rng() * 18); // idade fictícia -- o endpoint de elenco não devolve data de nascimento
  return {
    id: `real_${raw.id}`, name: raw.name || "Jogador", photo: raw.photo || null,
    group, age, overall, atk, def, phys,
    origin: "principal", real: true,
    status: "ok", outUntilRound: null, yellowCards: 0, condition: 100,
    goalsCareer: 0, assistsCareer: 0, apps: 0,
  };
}
// Composição fixa (não sorteada) pra GARANTIR pelo menos 2 goleiros na
// base — importante porque o elenco principal, quando vem de um
// fornecedor sem posição confiável (Sportmonks hoje sempre devolve
// null, ver providers/sportmonks.js), pode não ter nenhum goleiro
// reconhecido; sem isso a escalação ficaria impossível de completar.
const BASE_COMPOSITION = ["G", "G", "D", "D", "D", "D", "D", "M", "M", "M", "M", "M", "F", "F", "F", "F"];
function buildBasePlayer(club, idx, rng) {
  const group = BASE_COMPOSITION[idx % BASE_COMPOSITION.length];
  const age = 16 + Math.floor(rng() * 5);
  const potential = Math.round(clamp(42 + rng() * 48 + (club.atk - 1) * 10, 35, 92));
  const overall = Math.round(clamp(potential * (0.42 + rng() * 0.28), 26, 60));
  const atk = clamp(overall + (group === "F" ? 5 : group === "M" ? 2 : -8) + Math.round(rng() * 6 - 3), 18, 78);
  const def = clamp(overall + (group === "D" || group === "G" ? 5 : -8) + Math.round(rng() * 6 - 3), 18, 78);
  const phys = clamp(Math.round(52 + rng() * 32), 32, 88);
  const first = DEMO_FIRST_NAMES[Math.floor(rng() * DEMO_FIRST_NAMES.length)];
  const last = DEMO_LAST_NAMES[Math.floor(rng() * DEMO_LAST_NAMES.length)];
  return {
    id: `base_${club.id}_${idx}`, name: `${first} ${last}`, photo: null,
    group, age, overall, atk, def, phys, potential,
    origin: "base", real: false,
    status: "ok", outUntilRound: null, yellowCards: 0, condition: 100,
    goalsCareer: 0, assistsCareer: 0, apps: 0,
  };
}
// Composição usada só pra COMPLETAR o elenco principal quando o
// fornecedor devolve MENOS jogadores reais do que o mínimo jogável
// (ver MIN_PRINCIPAL em buildSquad — isso só acontece se a busca real
// falhar/vier incompleta, não é o caminho normal) — jogador adulto/
// profissional (diferente de buildBasePlayer, que é sempre jovem/
// baixo overall), só pra fechar o elenco. Cicla numa composição
// típica de time profissional (mais defensor/meio do que goleiro/
// atacante).
const FILLER_COMPOSITION = ["G", "D", "D", "D", "D", "D", "M", "M", "M", "M", "M", "M", "F", "F", "F", "F"];
function buildGeneratedProPlayer(club, idx, rng) {
  const group = FILLER_COMPOSITION[idx % FILLER_COMPOSITION.length];
  const age = 19 + Math.floor(rng() * 16); // 19-34, faixa normal de elenco profissional
  const clubFactor = (group === "F" || group === "M") ? club.atk : (2 - club.def);
  const overall = Math.round(clamp(52 + (clubFactor - 1) * 14 + (rng() * 16 - 8), 40, 82));
  const atk = clamp(overall + (group === "F" ? 6 : group === "M" ? 2 : -10) + Math.round(rng() * 6 - 3), 28, 90);
  const def = clamp(overall + (group === "D" || group === "G" ? 6 : -10) + Math.round(rng() * 6 - 3), 28, 90);
  const phys = clamp(Math.round(55 + rng() * 30), 38, 90);
  const first = DEMO_FIRST_NAMES[Math.floor(rng() * DEMO_FIRST_NAMES.length)];
  const last = DEMO_LAST_NAMES[Math.floor(rng() * DEMO_LAST_NAMES.length)];
  return {
    id: `gen_${club.id}_${idx}`, name: `${first} ${last}`, photo: null,
    group, age, overall, atk, def, phys,
    origin: "principal", real: false,
    status: "ok", outUntilRound: null, yellowCards: 0, condition: 100,
    goalsCareer: 0, assistsCareer: 0, apps: 0,
  };
}
// Elenco principal: usa TODOS os jogadores reais que o fornecedor
// devolver — sem cortar em N, e sem "completar" até bater um número
// redondo só por completar. BUG CORRIGIDO (pedido do usuário: "estamos
// colocando jogadores gerados sendo que no elenco tem jogadores
// reais"): a versão anterior enchia o elenco até 50 SEMPRE, mesmo
// quando o elenco real já estava completo (ex.: Modo Exemplo, onde
// DEMO_PLAYERS sempre tem exatamente 24 jogadores reais por time) —
// resultado: mais da metade do elenco "principal" saía com jogador
// inventado por engano, mesmo sem faltar nenhum real. Agora só entra
// jogador GERADO quando o real vier abaixo do mínimo jogável
// (MIN_PRINCIPAL = 11 titulares + 7 banco) — sinal de que a busca
// real veio truncada/incompleta de verdade (falha pontual da API),
// não o caminho normal. MAX_PRINCIPAL só existe pra não deixar o save
// gigante no caso raro de um fornecedor devolver um elenco enorme.
const MIN_PRINCIPAL = 18;
const MAX_PRINCIPAL = 60;
async function buildSquad(club) {
  const rng = seededRngFromKey(`squad:${club.id}:${LIVE_SEASON}`); // global de js/data.js
  const raw = await fetchRealPlayers(club.id);
  const realPlayers = raw.slice(0, MAX_PRINCIPAL).map((p) => buildRealPlayer(p, club, rng));
  const missing = Math.max(0, MIN_PRINCIPAL - realPlayers.length);
  const filler = Array.from({ length: missing }, (_, i) => buildGeneratedProPlayer(club, i, rng));
  const base = Array.from({ length: 16 }, (_, i) => buildBasePlayer(club, i, rng));
  return [...realPlayers, ...filler, ...base];
}

/* ---------- Escalação automática (usada ao criar a carreira) ---------- */
function autoLineup(squad, formation) {
  const slots = FORMATIONS[formation];
  const principalPool = squad.filter((p) => p.origin === "principal" && p.status === "ok").sort((a, b) => b.overall - a.overall);
  const fullPool = squad.filter((p) => p.status === "ok").sort((a, b) => b.overall - a.overall);
  const used = new Set();
  const starters = slots.map(([grp]) => {
    // prioriza o elenco principal; só desce pra base se NINGUÉM do
    // principal tiver esse grupo reconhecido (comum pro goleiro quando
    // o fornecedor de dado não informa posição — ver mapPositionGroup —
    // sem esse fallback, a escalação automática colocaria por padrão
    // um jogador de outra posição no gol).
    const pick = principalPool.find((p) => !used.has(p.id) && p.group === grp)
      || fullPool.find((p) => !used.has(p.id) && p.group === grp)
      || principalPool.find((p) => !used.has(p.id))
      || fullPool.find((p) => !used.has(p.id));
    if (pick) used.add(pick.id);
    return pick ? pick.id : null;
  });
  const bench = principalPool.filter((p) => !used.has(p.id)).slice(0, 7).map((p) => p.id);
  return { formation, starters, bench, tactics: { mentality: "equilibrada", marking: "zona", tempo: "normal" } };
}

/* ---------- Persistência ---------- */
async function persistCareer() {
  if (!CAREER) return;
  CAREER.updatedAt = Date.now();
  try {
    await fetchJSON("/api/career", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(CAREER) });
  } catch {
    toast("Não deu pra salvar o progresso agora — tente de novo em instantes.");
  }
}

/* ---------- Início de carreira ---------- */
function renderClubPicker() {
  const grid = document.getElementById("clubGrid");
  grid.innerHTML = LEAGUE_TEAMS.map((t) => `
    <div class="ct-club-card" data-id="${escapeHtml(String(t.id))}">
      ${crestImg(t)}
      <span class="name">${escapeHtml(t.name)}</span>
    </div>`).join("");
  grid.querySelectorAll(".ct-club-card").forEach((el) => el.addEventListener("click", () => startCareer(el.dataset.id)));
}
async function startCareer(clubId) {
  const club = LEAGUE_TEAMS.find((t) => String(t.id) === String(clubId));
  if (!club) return;
  document.getElementById("clubGrid").style.opacity = "0.5";
  document.getElementById("clubGrid").style.pointerEvents = "none";
  try {
    const squad = await buildSquad(club);
    const formation = "4-3-3";
    const lineup = autoLineup(squad, formation);
    const schedule = generateAllRounds(LEAGUE_TEAMS.map((t) => t.id)); // global de js/data.js
    const standings = {};
    LEAGUE_TEAMS.forEach((t) => { standings[t.id] = { id: t.id, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0, pts: 0 }; });
    CAREER = {
      version: 1,
      clubId: club.id, clubName: club.name, clubShort: club.short || club.name.slice(0, 3).toUpperCase(),
      clubLogo: club.logo || null, clubColors: { c1: club.c1, c2: club.c2, c3: club.c3 },
      liveMode: LIVE_MODE, createdAt: Date.now(), updatedAt: Date.now(),
      squad, lineup, trainingFocus: "equilibrado",
      schedule, currentRound: 1, standings, resultsByRound: {},
      news: [{ round: 0, type: "info", text: `Você assumiu o comando do ${club.name}! Boa sorte na temporada — monte sua escalação em "Escalação" antes da 1ª rodada.` }],
    };
    await persistCareer();
    showGameScreen();
  } finally {
    document.getElementById("clubGrid").style.opacity = "";
    document.getElementById("clubGrid").style.pointerEvents = "";
  }
}

/* ---------- Disponibilidade (lesão/suspensão) ---------- */
function refreshAvailability(uptoRound) {
  const r = uptoRound != null ? uptoRound : CAREER.currentRound;
  CAREER.squad.forEach((p) => {
    if (p.status !== "ok" && p.outUntilRound != null && r > p.outUntilRound) {
      p.status = "ok"; p.outUntilRound = null;
    }
  });
}
function autoFixLineup(round) {
  const usedIds = new Set([...CAREER.lineup.starters.filter(Boolean), ...CAREER.lineup.bench]);
  CAREER.lineup.starters = CAREER.lineup.starters.map((id, idx) => {
    const p = id ? CAREER.squad.find((x) => x.id === id) : null;
    if (p && p.status === "ok") return id;
    const grp = FORMATIONS[CAREER.lineup.formation][idx][0];
    const benchPlayers = CAREER.lineup.bench.map((bid) => CAREER.squad.find((x) => x.id === bid)).filter(Boolean);
    let repl = benchPlayers.find((x) => x.status === "ok" && x.group === grp)
      || benchPlayers.find((x) => x.status === "ok")
      || CAREER.squad.filter((x) => x.status === "ok" && !usedIds.has(x.id)).sort((a, b) => b.overall - a.overall)
        .find((x) => x.group === grp)
      || CAREER.squad.filter((x) => x.status === "ok" && !usedIds.has(x.id)).sort((a, b) => b.overall - a.overall)[0];
    if (repl) {
      usedIds.delete(id); usedIds.add(repl.id);
      CAREER.lineup.bench = CAREER.lineup.bench.filter((x) => x !== repl.id);
      if (p) CAREER.news.unshift({ round, type: "escalacao", text: `🔁 ${repl.name} entra na equipe titular no lugar de ${p.name} (indisponível).` });
      return repl.id;
    }
    return null;
  });
}

/* ---------- Força do time (escalação → ataque/defesa efetivos) ---------- */
function computeHumanStrength(club) {
  const principal = CAREER.squad.filter((p) => p.origin === "principal");
  const baselineAtk = avg(principal.map((p) => p.atk)) || 60;
  const baselineDef = avg(principal.map((p) => p.def)) || 60;
  const starters = CAREER.lineup.starters.map((id) => id && CAREER.squad.find((p) => p.id === id)).filter((p) => p && p.status === "ok");
  const usable = starters.length ? starters : principal.filter((p) => p.status === "ok").slice(0, 11);
  const startAtk = avg(usable.map((p) => p.atk)) || baselineAtk;
  const startDef = avg(usable.map((p) => p.def)) || baselineDef;
  const completeness = clamp(usable.length / 11, 0.6, 1);
  let atkMult = clamp(startAtk / baselineAtk, 0.7, 1.3) * completeness;
  let defMult = clamp(startDef / baselineDef, 0.7, 1.3) * completeness;
  const fMod = FORMATION_MOD[CAREER.lineup.formation] || { atk: 1, def: 1 };
  const mMod = TACTIC_MOD.mentality[CAREER.lineup.tactics.mentality] || { atk: 1, def: 1 };
  const tMod = TACTIC_MOD.tempo[CAREER.lineup.tactics.tempo] || { atk: 1, def: 1 };
  const kMod = TACTIC_MOD.marking[CAREER.lineup.tactics.marking] || { atk: 1, def: 1 };
  const trMod = TRAINING_MOD[CAREER.trainingFocus] || { atk: 1, def: 1 };
  atkMult *= fMod.atk * mMod.atk * tMod.atk * kMod.atk * trMod.atk;
  defMult *= fMod.def * mMod.def * tMod.def * kMod.def * trMod.def;
  const avgCond = avg(usable.map((p) => p.condition)) ?? 100;
  atkMult *= 0.85 + 0.15 * (avgCond / 100);
  defMult *= 0.90 + 0.10 * (avgCond / 100);
  return {
    atk: clamp(club.atk * atkMult, 0.35, 2.6),
    def: clamp(club.def / clamp(defMult, 0.55, 1.6), 0.3, 2.6),
    starters: usable,
  };
}

/* ---------- Eventos de jogo (gols/cartões/lesões) pros SEUS jogadores ---------- */
function simulatePlayerEvents(starters, goals, round) {
  const news = [];
  if (!starters || !starters.length) return news;
  const weights = starters.map((p) => ({ F: 4, M: 2, D: 0.6, G: 0.02 }[p.group] || 1));
  for (let i = 0; i < goals; i++) {
    const scorer = weightedPick(starters, weights);
    scorer.goalsCareer = (scorer.goalsCareer || 0) + 1;
    news.push({ round, type: "gol", text: `⚽ ${scorer.name} balançou as redes pelo ${CAREER.clubName}.` });
  }
  starters.forEach((p) => {
    p.apps = (p.apps || 0) + 1;
    const roll = Math.random();
    if (roll < 0.012) {
      p.status = "suspenso"; p.outUntilRound = round + 1; p.yellowCards = 0;
      news.push({ round, type: "cartao", text: `🟥 ${p.name} foi expulso e está suspenso na próxima rodada.` });
    } else if (roll < 0.11) {
      p.yellowCards = (p.yellowCards || 0) + 1;
      if (p.yellowCards >= 3) {
        p.status = "suspenso"; p.outUntilRound = round + 1; p.yellowCards = 0;
        news.push({ round, type: "cartao", text: `🟨 ${p.name} chegou ao 3º cartão e cumpre suspensão automática.` });
      }
    }
    if (p.status === "ok" && Math.random() < 0.025) {
      const dur = 1 + Math.floor(Math.random() * 4);
      p.status = "contundido"; p.outUntilRound = round + dur;
      news.push({ round, type: "lesao", text: `🚑 ${p.name} sofreu uma lesão — fora por ${dur} rodada${dur > 1 ? "s" : ""}.` });
    }
    p.condition = clamp((p.condition == null ? 100 : p.condition) - (15 + Math.random() * 15), 25, 100);
  });
  return news;
}
function applyConditionRecovery(starterIds) {
  const set = new Set(starterIds);
  const bonus = CAREER.trainingFocus === "fisico" ? 3 : 0;
  CAREER.squad.forEach((p) => {
    if (!set.has(p.id)) p.condition = clamp((p.condition == null ? 100 : p.condition) + (10 + Math.random() * 12) + bonus, 0, 100);
  });
}
function applyResultToStandings(r) {
  const H = CAREER.standings[r.home], A = CAREER.standings[r.away];
  if (!H || !A) return;
  H.j++; A.j++; H.gp += r.gh; H.gc += r.ga; A.gp += r.ga; A.gc += r.gh;
  if (r.gh > r.ga) { H.v++; H.pts += 3; A.d++; }
  else if (r.gh < r.ga) { A.v++; A.pts += 3; H.d++; }
  else { H.e++; A.e++; H.pts++; A.pts++; }
  H.sg = H.gp - H.gc; A.sg = A.gp - A.gc;
}

/* ---------- Simular a rodada corrente ---------- */
function simulateRound() {
  const round = CAREER.currentRound;
  if (round > 38) return null;
  const fixtures = CAREER.schedule[round] || [];
  let toastMsg = null;
  const roundNews = [];
  fixtures.forEach((fx) => {
    const home = teamById(fx.home), away = teamById(fx.away);
    const isHome = String(fx.home) === String(CAREER.clubId), isAway = String(fx.away) === String(CAREER.clubId);
    const hs = isHome ? computeHumanStrength(home) : { atk: home.atk, def: home.def, starters: [] };
    const as = isAway ? computeHumanStrength(away) : { atk: away.atk, def: away.def, starters: [] };
    const lambdaHome = clamp((hs.atk / as.def) * 1.12, 0.05, 6);
    const lambdaAway = clamp(as.atk / hs.def, 0.05, 6);
    const gh = poissonSample(lambdaHome, Math.random); // global de js/data.js
    const ga = poissonSample(lambdaAway, Math.random);
    const result = { home: fx.home, away: fx.away, gh, ga };
    applyResultToStandings(result);
    (CAREER.resultsByRound[round] = CAREER.resultsByRound[round] || []).push(result);
    if (isHome || isAway) {
      const myGoals = isHome ? gh : ga, oppGoals = isHome ? ga : gh;
      const oppTeam = isHome ? away : home;
      const myStarters = isHome ? hs.starters : as.starters;
      roundNews.push(...simulatePlayerEvents(myStarters, myGoals, round));
      const outcome = myGoals > oppGoals ? "Vitória" : myGoals < oppGoals ? "Derrota" : "Empate";
      const placar = isHome ? `${gh} x ${ga}` : `${gh} x ${ga}`;
      toastMsg = `${outcome}: ${CAREER.clubName} ${placar} ${oppTeam.name}`;
      roundNews.unshift({ round, type: "resultado", text: `${outcome} — ${isHome ? CAREER.clubName : oppTeam.name} ${gh} x ${ga} ${isHome ? oppTeam.name : CAREER.clubName}` });
      applyConditionRecovery(myStarters.map((p) => p.id));
    }
  });
  CAREER.news = [...roundNews, ...CAREER.news].slice(0, 60);
  const nextRound = round + 1;
  refreshAvailability(nextRound);
  autoFixLineup(nextRound);
  CAREER.currentRound = nextRound;
  return toastMsg || "Rodada sem jogo do seu time (folga).";
}

/* ---------- Renderização: Central ---------- */
function renderTopbar() {
  document.getElementById("roundPill").textContent = `Rodada ${Math.min(CAREER.currentRound, 38)}/38`;
  document.getElementById("clubName").textContent = CAREER.clubName;
  document.getElementById("clubCrest").src = CAREER.clubLogo || "img/logo.png";
}
function renderCentral() {
  refreshAvailability();
  const box = document.getElementById("nextMatchBox");
  const btn = document.getElementById("btnSimulate");
  const round = CAREER.currentRound;
  if (round > 38) {
    box.innerHTML = `<p class="ct-empty">Temporada encerrada! Confira sua posição final na Tabela, ou reinicie pra jogar outra carreira.</p>`;
    btn.disabled = true;
  } else {
    const fx = (CAREER.schedule[round] || []).find((m) => String(m.home) === String(CAREER.clubId) || String(m.away) === String(CAREER.clubId));
    if (fx) {
      const home = teamById(fx.home), away = teamById(fx.away);
      box.innerHTML = `
        <div class="side">${crestImg(home)}<span class="n">${escapeHtml(home.name)}</span></div>
        <span class="vs">×</span>
        <div class="side">${crestImg(away)}<span class="n">${escapeHtml(away.name)}</span></div>`;
    } else {
      box.innerHTML = `<p class="ct-empty">Sem jogo do seu time nessa rodada (folga).</p>`;
    }
    btn.disabled = false;
  }
  const filled = CAREER.lineup.starters.filter(Boolean).length;
  document.getElementById("lineupWarning").textContent = filled < 11
    ? `⚠️ Sua escalação tem ${filled}/11 titulares definidos — o time entra com força reduzida. Ajuste em "Escalação".`
    : "";
  const squad = CAREER.squad;
  const ok = squad.filter((p) => p.status === "ok").length;
  const hurt = squad.filter((p) => p.status === "contundido").length;
  const susp = squad.filter((p) => p.status === "suspenso").length;
  document.getElementById("squadKpis").innerHTML = [
    ["Elenco", squad.length], ["Disponíveis", ok], ["Contundidos", hurt], ["Suspensos", susp],
  ].map(([l, v]) => `<div class="ct-kpi"><div class="v">${v}</div><div class="l">${l}</div></div>`).join("");

  const lastCard = document.getElementById("lastResultCard");
  const last = CAREER.resultsByRound[round - 1];
  const fx = last && last.find((m) => String(m.home) === String(CAREER.clubId) || String(m.away) === String(CAREER.clubId));
  if (fx) {
    const home = teamById(fx.home), away = teamById(fx.away);
    lastCard.style.display = "";
    document.getElementById("lastResultBox").innerHTML = `<div class="ct-next-match">
      <div class="side">${crestImg(home)}<span class="n">${escapeHtml(home.name)}</span></div>
      <span class="vs" style="font-size:18px;">${fx.gh} × ${fx.ga}</span>
      <div class="side">${crestImg(away)}<span class="n">${escapeHtml(away.name)}</span></div>
    </div>`;
  } else {
    lastCard.style.display = "none";
  }
}

/* ---------- Renderização: Elenco ---------- */
function squadTableHead() {
  return `<tr><th>Nome</th><th>Pos</th><th>Idade</th><th>OVR</th><th>Condição</th><th>Status</th><th></th></tr>`;
}
function playerRow(p) {
  const statusPill = p.status === "ok" ? `<span class="ct-pill ok">Disponível</span>`
    : p.status === "contundido" ? `<span class="ct-pill hurt">Lesionado (até R${p.outUntilRound})</span>`
    : `<span class="ct-pill susp">Suspenso (R${p.outUntilRound})</span>`;
  return `<tr data-id="${p.id}" style="cursor:pointer;">
    <td>${escapeHtml(p.name)}${p.real ? "" : ' <span class="ct-pill base" style="margin-left:4px;">gerado</span>'}</td>
    <td>${subPositionOf(p)}</td><td>${p.age}</td><td><b>${p.overall}</b></td>
    <td><span class="ct-cond-track"><span class="ct-cond-fill" style="width:${Math.round(p.condition)}%"></span></span></td>
    <td>${statusPill}</td>
    <td style="text-align:right; color:var(--text-2);">▸</td>
  </tr>`;
}
function renderElenco() {
  refreshAvailability();
  // Ordenado por posição (Goleiros, Defensores, Meio-campo, Atacantes —
  // ver SUBPOS_ORDER) e, dentro da mesma posição, por overall — dentro
  // de cada grupo (principal/base), pedido do usuário.
  const principal = CAREER.squad.filter((p) => p.origin === "principal").sort((a, b) => squadSortKey(a) - squadSortKey(b));
  const base = CAREER.squad.filter((p) => p.origin === "base").sort((a, b) => squadSortKey(a) - squadSortKey(b));
  const mt = document.getElementById("squadMainTable");
  mt.querySelector("thead").innerHTML = squadTableHead();
  mt.querySelector("tbody").innerHTML = principal.map(playerRow).join("") || `<tr><td colspan="7" class="ct-empty">Sem jogadores.</td></tr>`;
  const bt = document.getElementById("squadBaseTable");
  bt.querySelector("thead").innerHTML = squadTableHead();
  bt.querySelector("tbody").innerHTML = base.map(playerRow).join("") || `<tr><td colspan="7" class="ct-empty">Sem jogadores.</td></tr>`;
  [mt, bt].forEach((table) => table.querySelectorAll("tbody tr[data-id]").forEach((tr) => tr.addEventListener("click", () => openDetail(tr.dataset.id))));
}
function openDetail(id) {
  const p = CAREER.squad.find((x) => x.id === id);
  if (!p) return;
  const inStarters = CAREER.lineup.starters.includes(id);
  const inBench = CAREER.lineup.bench.includes(id);
  const groupFull = SUBPOS_LABEL[subPositionOf(p)] || "—";
  document.getElementById("detailBody").innerHTML = `
    <h3>${escapeHtml(p.name)}</h3>
    <p class="ct-sub">${groupFull} · ${p.age} anos · ${p.origin === "principal" ? "Elenco principal" : "Categoria de base"}${p.real ? "" : " (gerado)"}</p>
    <div class="ct-kpis" style="margin-bottom:12px;">
      <div class="ct-kpi"><div class="v">${p.overall}</div><div class="l">Geral</div></div>
      <div class="ct-kpi"><div class="v">${p.atk}</div><div class="l">Ataque</div></div>
      <div class="ct-kpi"><div class="v">${p.def}</div><div class="l">Defesa</div></div>
      <div class="ct-kpi"><div class="v">${p.phys}</div><div class="l">Físico</div></div>
    </div>
    <p class="ct-sub">Condição: ${Math.round(p.condition)}% · Jogos: ${p.apps || 0} · Gols na carreira: ${p.goalsCareer || 0} · Cartões amarelos (ciclo atual): ${p.yellowCards || 0}</p>
    <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:10px;">
      ${inStarters ? `<button class="ct-btn small" data-act="removeStarter">Tirar do time titular</button>` : ""}
      ${!inStarters && inBench ? `<button class="ct-btn small" data-act="removeBench">Tirar do banco</button>` : ""}
      ${!inStarters && !inBench && p.status === "ok" ? `<button class="ct-btn small" data-act="addBench" ${CAREER.lineup.bench.length >= 7 ? "disabled" : ""}>Colocar no banco</button>` : ""}
      ${p.origin === "base" ? `<button class="ct-btn small primary" data-act="promote">Promover ao elenco principal</button>` : `<button class="ct-btn small" data-act="demote">Enviar pra base</button>`}
      <button class="ct-btn small danger" data-act="release">Dispensar</button>
    </div>`;
  document.getElementById("detailBody").querySelectorAll("[data-act]").forEach((btn) => {
    btn.addEventListener("click", () => handlePlayerAction(p.id, btn.dataset.act));
  });
  document.getElementById("detailOverlay").classList.add("open");
}
function handlePlayerAction(id, act) {
  const p = CAREER.squad.find((x) => x.id === id);
  if (!p) return;
  if (act === "removeStarter") {
    CAREER.lineup.starters = CAREER.lineup.starters.map((x) => (x === id ? null : x));
  } else if (act === "removeBench") {
    CAREER.lineup.bench = CAREER.lineup.bench.filter((x) => x !== id);
  } else if (act === "addBench") {
    if (CAREER.lineup.bench.length < 7) CAREER.lineup.bench.push(id);
  } else if (act === "promote") {
    p.origin = "principal";
  } else if (act === "demote") {
    p.origin = "base";
    CAREER.lineup.starters = CAREER.lineup.starters.map((x) => (x === id ? null : x));
    CAREER.lineup.bench = CAREER.lineup.bench.filter((x) => x !== id);
  } else if (act === "release") {
    const principalCount = CAREER.squad.filter((x) => x.origin === "principal").length;
    if (p.origin === "principal" && principalCount <= 14) { toast("O elenco principal não pode ficar com menos de 14 jogadores."); return; }
    CAREER.squad = CAREER.squad.filter((x) => x.id !== id);
    CAREER.lineup.starters = CAREER.lineup.starters.map((x) => (x === id ? null : x));
    CAREER.lineup.bench = CAREER.lineup.bench.filter((x) => x !== id);
  }
  document.getElementById("detailOverlay").classList.remove("open");
  persistCareer();
  renderElenco(); renderEscalacao(); renderCentral();
}

/* ---------- Renderização: Escalação ---------- */
function renderEscalacao() {
  refreshAvailability();
  document.getElementById("formationSelect").value = CAREER.lineup.formation;
  document.getElementById("tacticMentality").value = CAREER.lineup.tactics.mentality;
  document.getElementById("tacticMarking").value = CAREER.lineup.tactics.marking;
  document.getElementById("tacticTempo").value = CAREER.lineup.tactics.tempo;
  document.getElementById("trainingFocus").value = CAREER.trainingFocus;
  renderPitch();
  renderBench();
}
// Desenha a escalação no campinho "jogo de botão" — mesmas classes
// .button-pitch/.button-row/.button-disc/.btn-name já usadas na
// Escalação titular do último jogo do dashboard principal (ver
// formationPitchHTML em public/js/app.js e o comentário de
// .ct-piece* em carreira.html), só que aqui EDITÁVEL: cada disco é
// clicável (abre o mesmo modal de escolha de jogador de sempre) e
// mostra a posição da vaga (tag), o overall no lugar da camisa e um
// contorno vermelho quando o titular ali estiver indisponível.
function pitchPieceHTML(slot, gradient) {
  const id = CAREER.lineup.starters[slot.i];
  const p = id ? CAREER.squad.find((x) => x.id === id) : null;
  const problem = p && p.status !== "ok";
  const discBg = p ? `linear-gradient(160deg, ${gradient})` : "rgba(255,255,255,.18)";
  const discContent = p ? p.overall : "+";
  const nameText = p ? lastNameOf(p.name) : "vazio";
  return `<div class="button-piece ct-piece ${problem ? "ct-piece-problem" : ""} ${!p ? "ct-piece-empty" : ""}"
      data-index="${slot.i}" data-label="${escapeHtml(slot.label)}"
      title="${escapeHtml(slot.label)}${p ? " — " + escapeHtml(p.name) : ""}">
    <span class="ct-piece-tag">${escapeHtml(slot.label)}</span>
    <div class="button-disc" style="background:${discBg};">${discContent}</div>
    <span class="btn-name">${escapeHtml(nameText)}${problem ? " ⚠️" : ""}</span>
  </div>`;
}
function renderPitch() {
  const slots = FORMATIONS[CAREER.lineup.formation].map(([grp, label], i) => ({ grp, label, i }));
  const gradient = teamGradientStops(CAREER.clubColors);
  // Ataque em cima, goleiro embaixo — mesma orientação do campinho já
  // usado no resto do site (column-reverse em .button-pitch, ver
  // css/style.css).
  const rows = ["G", "D", "M", "F"].map((g) => slots.filter((s) => s.grp === g)).filter((r) => r.length);
  document.getElementById("pitchLines").innerHTML = `
    <div class="button-pitch">
      ${rows.map((row) => `<div class="button-row">${row.map((s) => pitchPieceHTML(s, gradient)).join("")}</div>`).join("")}
    </div>`;
  document.getElementById("pitchLines").querySelectorAll(".ct-piece").forEach((el) => {
    el.addEventListener("click", () => openPicker({ type: "slot", index: Number(el.dataset.index) }, `Escolher — ${el.dataset.label}`));
  });
}
function renderBench() {
  // Mesma ordenação por posição do Elenco (ver squadSortKey) — só pra
  // exibição, não muda a ordem guardada em CAREER.lineup.bench (não
  // faz diferença nenhuma pra troca/auto-substituição, ver
  // autoFixLineup, que já procura por grupo em vez de depender de
  // posição no array).
  const benchPlayers = CAREER.lineup.bench
    .map((id) => CAREER.squad.find((x) => x.id === id))
    .filter(Boolean)
    .sort((a, b) => squadSortKey(a) - squadSortKey(b));
  const html = benchPlayers.map((p) => `<div class="ct-bench-slot" data-id="${p.id}"><b>${escapeHtml(p.name)}</b><br>${subPositionOf(p)} · OVR ${p.overall}</div>`).join("");
  const canAdd = CAREER.lineup.bench.length < 7;
  document.getElementById("benchList").innerHTML = html + (canAdd ? `<div class="ct-bench-slot" id="benchAddSlot" style="color:var(--text-2);">+ adicionar</div>` : "");
  document.getElementById("benchList").querySelectorAll(".ct-bench-slot[data-id]").forEach((el) => {
    el.addEventListener("click", () => openPicker({ type: "bench", currentId: el.dataset.id }, "Trocar reserva"));
  });
  const addSlot = document.getElementById("benchAddSlot");
  if (addSlot) addSlot.addEventListener("click", () => openPicker({ type: "bench" }, "Adicionar reserva"));
}

/* ---------- Modal: escolher jogador ---------- */
function openPicker(ctx, title) {
  PICKER_CTX = ctx;
  document.getElementById("pickerTitle").textContent = title;
  const search = document.getElementById("pickerSearch");
  search.value = "";
  search.oninput = () => renderPickerList(search.value);
  renderPickerList("");
  document.getElementById("pickerOverlay").classList.add("open");
}
function renderPickerList(filter) {
  const usedIds = new Set([...CAREER.lineup.starters.filter(Boolean), ...CAREER.lineup.bench]);
  const currentId = PICKER_CTX.type === "slot" ? CAREER.lineup.starters[PICKER_CTX.index] : (PICKER_CTX.currentId || null);
  let pool = CAREER.squad.filter((p) => p.status === "ok" && (!usedIds.has(p.id) || p.id === currentId));
  const f = filter.trim().toLowerCase();
  if (f) pool = pool.filter((p) => p.name.toLowerCase().includes(f));
  pool.sort((a, b) => squadSortKey(a) - squadSortKey(b));
  const showClear = PICKER_CTX.type === "slot" || (PICKER_CTX.type === "bench" && PICKER_CTX.currentId);
  const clearRow = showClear ? `<div class="ct-pick-row" data-clear="1"><span class="nm">— deixar vazio —</span></div>` : "";
  const list = document.getElementById("pickerList");
  list.innerHTML = clearRow + (pool.length ? pool.map((p) => `
    <div class="ct-pick-row" data-id="${p.id}">
      <span class="nm">${escapeHtml(p.name)}${p.id === currentId ? " (atual)" : ""}</span>
      <span class="meta">${subPositionOf(p)} · OVR ${p.overall} · ${p.origin === "base" ? "base" : "principal"}</span>
    </div>`).join("") : `<p class="ct-empty">Nenhum jogador disponível.</p>`);
  list.querySelectorAll("[data-clear]").forEach((el) => el.addEventListener("click", () => pickerChoose(null)));
  list.querySelectorAll("[data-id]").forEach((el) => el.addEventListener("click", () => pickerChoose(el.dataset.id)));
}
function removePlayerFromLineup(playerId) {
  CAREER.lineup.starters = CAREER.lineup.starters.map((x) => (x === playerId ? null : x));
  CAREER.lineup.bench = CAREER.lineup.bench.filter((x) => x !== playerId);
}
function pickerChoose(playerId) {
  if (PICKER_CTX.type === "slot") {
    if (playerId) removePlayerFromLineup(playerId);
    CAREER.lineup.starters[PICKER_CTX.index] = playerId;
  } else if (PICKER_CTX.type === "bench") {
    if (playerId) removePlayerFromLineup(playerId);
    if (PICKER_CTX.currentId) {
      const idx = CAREER.lineup.bench.indexOf(PICKER_CTX.currentId);
      if (idx >= 0) {
        if (playerId) CAREER.lineup.bench[idx] = playerId; else CAREER.lineup.bench.splice(idx, 1);
      } else if (playerId && CAREER.lineup.bench.length < 7) {
        CAREER.lineup.bench.push(playerId);
      }
    } else if (playerId && CAREER.lineup.bench.length < 7) {
      CAREER.lineup.bench.push(playerId);
    }
  }
  document.getElementById("pickerOverlay").classList.remove("open");
  renderPitch(); renderBench();
  persistCareer();
}

/* ---------- Renderização: Tabela ---------- */
function renderTabela() {
  const rows = Object.values(CAREER.standings).sort((a, b) => (b.pts - a.pts) || (b.v - a.v) || (b.sg - a.sg) || (b.gp - a.gp));
  const total = rows.length;
  const thead = `<tr><th>#</th><th>Time</th><th>P</th><th>J</th><th>V</th><th>E</th><th>D</th><th>SG</th></tr>`;
  const tbody = rows.map((r, i) => {
    const t = teamById(r.id);
    const pos = i + 1;
    const zone = pos === 1 ? "campeao" : pos <= 6 ? "libertadores" : pos <= 12 ? "sula" : pos > total - 4 ? "reb" : "";
    const isMe = String(r.id) === String(CAREER.clubId);
    return `<tr class="${isMe ? "me" : ""}"><td>${zone ? `<span class="zone-dot zone-${zone}"></span>` : ""}${pos}</td>
      <td>${escapeHtml(t.name)}</td><td><b>${r.pts}</b></td><td>${r.j}</td><td>${r.v}</td><td>${r.e}</td><td>${r.d}</td><td>${r.sg > 0 ? "+" : ""}${r.sg}</td></tr>`;
  }).join("");
  const table = document.getElementById("standingsTable");
  table.querySelector("thead").innerHTML = thead;
  table.querySelector("tbody").innerHTML = tbody;
}

/* ---------- Renderização: Notícias ---------- */
function renderNoticias() {
  const items = CAREER.news.slice(0, 60);
  document.getElementById("newsList").innerHTML = items.length
    ? items.map((n) => `<div class="ct-news-item"><span class="ct-news-round">${n.round ? "R" + n.round : "—"}</span><span>${escapeHtml(n.text)}</span></div>`).join("")
    : `<p class="ct-empty">Nenhuma notícia ainda.</p>`;
}

/* ---------- Tela do jogo ---------- */
function renderAll() {
  renderTopbar(); renderCentral(); renderElenco(); renderEscalacao(); renderTabela(); renderNoticias();
}
function showGameScreen() {
  show("screenGame");
  renderAll();
}

/* ---------- Listeners estáticos (uma vez, no boot) ---------- */
function populateSelect(id, options) {
  document.getElementById(id).innerHTML = options.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
}
function wireStaticListeners() {
  populateSelect("formationSelect", Object.keys(FORMATIONS).map((k) => [k, k]));
  populateSelect("tacticMentality", TACTIC_OPTIONS.mentality);
  populateSelect("tacticMarking", TACTIC_OPTIONS.marking);
  populateSelect("tacticTempo", TACTIC_OPTIONS.tempo);
  populateSelect("trainingFocus", TRAINING_OPTIONS);

  document.querySelectorAll(".ct-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".ct-tab").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".ct-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("panel-" + btn.dataset.panel).classList.add("active");
    });
  });

  document.getElementById("formationSelect").addEventListener("change", (e) => {
    CAREER.lineup.formation = e.target.value;
    renderPitch();
  });
  document.getElementById("btnSaveLineup").addEventListener("click", () => {
    CAREER.lineup.tactics.mentality = document.getElementById("tacticMentality").value;
    CAREER.lineup.tactics.marking = document.getElementById("tacticMarking").value;
    CAREER.lineup.tactics.tempo = document.getElementById("tacticTempo").value;
    CAREER.trainingFocus = document.getElementById("trainingFocus").value;
    persistCareer();
    toast("Escalação e táticas salvas.");
    renderCentral();
  });

  document.getElementById("btnSimulate").addEventListener("click", async () => {
    const btn = document.getElementById("btnSimulate");
    btn.disabled = true;
    const summary = simulateRound();
    await persistCareer();
    renderAll();
    if (summary) toast(summary);
  });

  document.getElementById("btnRestart").addEventListener("click", async () => {
    if (!CAREER) return;
    if (!confirm(`Isso vai apagar sua carreira atual no ${CAREER.clubName} e começar do zero. Continuar?`)) return;
    await fetchJSON("/api/career", { method: "DELETE" }).catch(() => {});
    CAREER = null;
    renderClubPicker();
    show("screenPicker");
  });

  document.getElementById("pickerClose").addEventListener("click", () => document.getElementById("pickerOverlay").classList.remove("open"));
  document.getElementById("pickerOverlay").addEventListener("click", (e) => { if (e.target.id === "pickerOverlay") e.currentTarget.classList.remove("open"); });
  document.getElementById("detailClose").addEventListener("click", () => document.getElementById("detailOverlay").classList.remove("open"));
  document.getElementById("detailOverlay").addEventListener("click", (e) => { if (e.target.id === "detailOverlay") e.currentTarget.classList.remove("open"); });

  document.getElementById("ctLoginForm").addEventListener("submit", submitCtLogin);
}

/* ---------- Login (pedido do usuário: mostrar a tela de login de
   verdade em vez de um botão saindo da página) — só o login em si;
   cadastro com escolha de plano/pagamento continua só na página
   principal (ver link "Cadastre-se" no HTML). Mesmo endpoint/contrato
   de submitGateLogin em public/js/app.js. ---------- */
async function submitCtLogin(e) {
  e.preventDefault();
  const errEl = document.getElementById("ctLoginError");
  errEl.style.display = "none"; errEl.textContent = "";
  const email = document.getElementById("ctLoginEmail").value.trim();
  const password = document.getElementById("ctLoginPassword").value;
  if (!email || !password) { errEl.textContent = "Informe e-mail e senha."; errEl.style.display = "block"; return; }

  const btn = e.target.querySelector("button[type=submit]");
  const originalLabel = btn.textContent;
  btn.disabled = true; btn.textContent = "Entrando...";
  try {
    const data = await fetchJSON("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
    });
    if (data.user.planStatus !== "active") {
      errEl.textContent = "Sua conta tem um pagamento pendente — finalize na página inicial (brdata.online) pra liberar o acesso.";
      errEl.style.display = "block";
      btn.disabled = false; btn.textContent = originalLabel;
      return;
    }
    await enterAfterAuth();
  } catch (err) {
    errEl.textContent = err.message || "E-mail ou senha incorretos.";
    errEl.style.display = "block";
    btn.disabled = false; btn.textContent = originalLabel;
  }
}

/* ---------- Boot ---------- */
// Parte do boot que só roda DEPOIS de confirmar sessão válida —
// extraída à parte pra ser reaproveitada pelo login inline
// (submitCtLogin acima) sem precisar recarregar a página inteira.
async function enterAfterAuth() {
  show("screenLoading");
  document.getElementById("screenLoading").innerHTML = `<div class="ct-spinner"></div><p>Carregando o Modo Técnico...</p>`;
  await loadLeague();
  const saved = await fetchJSON("/api/career").catch(() => ({ career: null }));
  if (saved && saved.career) {
    CAREER = saved.career;
    showGameScreen();
  } else {
    renderClubPicker();
    show("screenPicker");
  }
}
async function boot() {
  applyStoredTheme();
  wireStaticListeners();
  try {
    const me = await fetchJSON("/api/auth/me").catch(() => ({ authenticated: false }));
    if (!me.authenticated) { show("screenLoginRequired"); return; }
    await enterAfterAuth();
  } catch (err) {
    console.error("[carreira] falha no boot:", err);
    show("screenLoading");
    document.getElementById("screenLoading").innerHTML = `<p>Não deu pra carregar o Modo Técnico agora. <a href="/carreira">Tentar de novo</a></p>`;
  }
}

document.addEventListener("DOMContentLoaded", boot);
