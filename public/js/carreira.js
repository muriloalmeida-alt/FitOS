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

// Tamanho máximo do banco de reservas (pedido do usuário) — usado em
// todo lugar que cria/valida/exibe o banco, ver renderBench/pickerChoose/
// openDetail/autoLineup abaixo, pra nunca ficar um número solto.
const MAX_BENCH = 11;

/* ---------- Constantes de tática/formação ---------- */
const FORMATIONS = {
  "4-4-2":     [["G","GOL"],["D","LAT D"],["D","ZAG"],["D","ZAG"],["D","LAT E"],["M","MEI D"],["M","VOL"],["M","VOL"],["M","MEI E"],["F","ATA"],["F","ATA"]],
  "4-3-3":     [["G","GOL"],["D","LAT D"],["D","ZAG"],["D","ZAG"],["D","LAT E"],["M","VOL"],["M","MEI"],["M","MEI"],["F","PONTA D"],["F","CENTROAV."],["F","PONTA E"]],
  "4-2-3-1":   [["G","GOL"],["D","LAT D"],["D","ZAG"],["D","ZAG"],["D","LAT E"],["M","VOL"],["M","VOL"],["M","MEIA D"],["M","MEIA C"],["M","MEIA E"],["F","CENTROAV."]],
  "3-5-2":     [["G","GOL"],["D","ZAG"],["D","ZAG"],["D","ZAG"],["M","ALA D"],["M","VOL"],["M","MEI"],["M","VOL"],["M","ALA E"],["F","ATA"],["F","ATA"]],
  "4-5-1":     [["G","GOL"],["D","LAT D"],["D","ZAG"],["D","ZAG"],["D","LAT E"],["M","MEI D"],["M","VOL"],["M","MEI"],["M","VOL"],["M","MEI E"],["F","CENTROAV."]],
  "5-3-2":     [["G","GOL"],["D","ALA D"],["D","ZAG"],["D","ZAG"],["D","ZAG"],["D","ALA E"],["M","VOL"],["M","MEI"],["M","VOL"],["F","ATA"],["F","ATA"]],
  // Pedido do usuário ("precisamos expandir as formações, existem
  // outras várias que não estão disponíveis") — mesmo padrão de sempre
  // (grupo real G/D/M/F + rótulo só ilustrativo do rótulo da vaga, ver
  // comentário de SUBPOS_ORDER acima sobre por que não existe posição
  // mais fina que isso). Cobre esquemas clássicos do futebol brasileiro
  // que ainda não tinham representante (linha de 5 só tinha o mais
  // defensivo 5-3-2; faltava toda a família 3-4-X; faltava um losango
  // de meio-campo e o "quadrado mágico", os dois bem característicos
  // do Brasileirão).
  "4-1-4-1":   [["G","GOL"],["D","LAT D"],["D","ZAG"],["D","ZAG"],["D","LAT E"],["M","VOL"],["M","MEI D"],["M","MEI"],["M","MEI"],["M","MEI E"],["F","CENTROAV."]],
  "4-4-1-1":   [["G","GOL"],["D","LAT D"],["D","ZAG"],["D","ZAG"],["D","LAT E"],["M","MEI D"],["M","VOL"],["M","VOL"],["M","MEI E"],["F","SEGUNDO ATA"],["F","CENTROAV."]],
  "3-4-3":     [["G","GOL"],["D","ZAG"],["D","ZAG"],["D","ZAG"],["M","ALA D"],["M","VOL"],["M","VOL"],["M","ALA E"],["F","PONTA D"],["F","CENTROAV."],["F","PONTA E"]],
  "4-1-3-2":   [["G","GOL"],["D","LAT D"],["D","ZAG"],["D","ZAG"],["D","LAT E"],["M","VOL"],["M","MEIA D"],["M","MEIA C"],["M","MEIA E"],["F","ATA"],["F","ATA"]],
  "3-4-2-1":   [["G","GOL"],["D","ZAG"],["D","ZAG"],["D","ZAG"],["M","ALA D"],["M","VOL"],["M","VOL"],["M","ALA E"],["F","MEIA D"],["F","MEIA E"],["F","CENTROAV."]],
  "4-3-1-2":   [["G","GOL"],["D","LAT D"],["D","ZAG"],["D","ZAG"],["D","LAT E"],["M","VOL"],["M","MEI D"],["M","MEI E"],["M","ENGANCHE"],["F","ATA"],["F","ATA"]],
  "4-2-2-2":   [["G","GOL"],["D","LAT D"],["D","ZAG"],["D","ZAG"],["D","LAT E"],["M","VOL"],["M","VOL"],["M","MEIA D"],["M","MEIA E"],["F","ATA"],["F","ATA"]],
  "5-4-1":     [["G","GOL"],["D","ALA D"],["D","ZAG"],["D","ZAG"],["D","ZAG"],["D","ALA E"],["M","MEI D"],["M","VOL"],["M","VOL"],["M","MEI E"],["F","CENTROAV."]],
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
  "4-1-4-1": { atk: 0.97, def: 1.05 },
  "4-4-1-1": { atk: 0.98, def: 1.03 },
  "3-4-3": { atk: 1.10, def: 0.88 },
  "4-1-3-2": { atk: 1.07, def: 0.95 },
  "3-4-2-1": { atk: 1.04, def: 0.94 },
  "4-3-1-2": { atk: 1.05, def: 0.96 },
  "4-2-2-2": { atk: 1.08, def: 0.92 },
  "5-4-1": { atk: 0.88, def: 1.12 },
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
let PENDING_ROUND_SUMMARY = null; // resumo da rodada entre o modal de detalhe do jogo e o de resultados (ver simulateRound)

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
function toast(msg, durationMs = 3600) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = "none"; }, durationMs);
}
function show(name) {
  ["screenLoading", "screenLoginRequired", "screenPicker", "screenGame"].forEach((id) => {
    document.getElementById(id).classList.toggle("hidden", id !== name);
  });
  // BUG CORRIGIDO: trocar de tela (ex.: escolher um clube mais pra
  // baixo na grade, que exige rolar a página) não voltava a rolagem
  // pro topo — quem entrava assim na tela do jogo ficava com o
  // cabeçalho novo escondido acima da dobra até rolar manualmente.
  window.scrollTo(0, 0);
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
function crestImg(t, size = 40) {
  if (t && t.logo) return `<img src="${t.logo}" alt="" style="height:${size}px;width:${size}px;object-fit:contain;flex-shrink:0;">`;
  const c1 = t?.c1 || "#8892A0", c2 = t?.c2 || "#333";
  return `<div style="height:${size}px;width:${size}px;border-radius:50%;background:linear-gradient(135deg, ${c1}, ${c2});flex-shrink:0;"></div>`;
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
// Pedido do usuário: nome do jogador nas listas/tabelas do Elenco
// sempre como "Inicial. Sobrenome" (ex.: "Kevin Viveiros" -> "K.
// Viveiros") — mais curto que o nome completo, garante que cabe numa
// linha só no celular (ver .ct-name-cell no <style> de carreira.html).
// Nome de 1 palavra só (raro) fica como está.
function abbreviateName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return name || "?";
  return `${parts[0][0].toUpperCase()}. ${parts[parts.length - 1]}`;
}
// FASE 2 (b) — mesmo formatador de dinheiro do site principal (fmtBRL
// em app.js, duplicado aqui pelo mesmo motivo de sempre — esta página
// não carrega app.js). Aceita negativo (caixa pode ficar no vermelho).
function fmtBRL(v) {
  return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
// Versão curta ("R$ 35 mi") pros KPIs de caixa/folha na Central — a
// caixa de KPI (.ct-kpi .v, ver carreira.html) é estreita demais pro
// valor cheio em reais sem espremer.
function fmtBRLShort(v) {
  const n = v || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return fmtBRL(n);
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
/* ---------- FASE 2 (b) — contrato, salário e valor de mercado ----------
   Pedido do usuário. Curva exponencial em cima do overall (mesma ideia
   de "overall" de qualquer FIFA/Football Manager: a diferença de
   salário/valor entre um jogador OVR 60 e OVR 90 é de ordens de
   grandeza, não linear) — ajustada por idade (pico 24-27, queda depois
   dos 30) e, pra jogador de base com potencial, um bônus de valor (vale
   mais pela promessa do que pelo overall atual). Números calibrados
   pra ficarem na faixa plausível de Brasileirão (milhares a dezenas de
   milhões), não uma modelagem financeira de verdade.
   contractUntil é uma TEMPORADA (ver LIVE_SEASON), não uma data. */
function computeContractFields(overall, age, potential, rng) {
  let ageMult = 1;
  if (age <= 20) ageMult = 0.8;
  else if (age <= 23) ageMult = 1.0;
  else if (age <= 27) ageMult = 1.25;
  else if (age <= 30) ageMult = 1.0;
  else if (age <= 33) ageMult = 0.6;
  else ageMult = 0.35;
  const potBoost = potential ? 1 + clamp(potential - overall, 0, 40) / 40 * 0.5 : 1;
  const wage = Math.round(Math.pow(1.145, overall - 50) * 2500 * ageMult / 100) * 100;
  const value = Math.round(Math.pow(1.16, overall - 50) * 120000 * ageMult * potBoost / 1000) * 1000;
  const contractUntil = LIVE_SEASON + 1 + Math.floor(rng() * 4); // 1 a 4 temporadas de contrato
  return { wage, value, contractUntil };
}
/* ---------- FASE 2 (b) — moral do elenco ----------
   Fase 2 do Modo Carreira, item escolhido pelo usuário. A própria Fase
   1 (item 1, renovação de contrato) já tinha citado que esse atributo
   não existia e usava overall/idade como substituto ("moral" real
   entra agora — ver proposeRenewal, que passa a usar isso de verdade
   em vez só do proxy). Escala 0-100, todo jogador nasce em 70 (neutro)
   — ver morale nos 3 builders (buildRealPlayer/buildBasePlayer/
   buildGeneratedProPlayer) e o backfill em migrateCareerDefaults pra
   save de antes dessa fase.
   O que mexe na moral (menor esforço — sem "notícia"/eventos de
   imprensa, só o que já é medível no jogo):
   - Resultado + minutos jogados, a cada rodada (ver
     applyMoraleAfterMatch, chamada de dentro de simulateRound só pro
     SEU clube — CPU não precisa, ver moraleFactor abaixo);
   - Salário justo (comparado contra o "salário de mercado" da própria
     fórmula de contrato — ver fairWageFor) + uma leve regressão rumo à
     média, na virada de temporada (ver applySeasonMoraleReset).
   O que a moral MUDA de verdade no jogo (não é só um número decorativo
   no card do jogador):
   - Pesa no sorteio de quem faz gol/dá assistência (ver moraleFactor,
     usado em simulatePlayerEvents) — jogador infeliz rende menos em
     campo;
   - Pesa na negociação de renovação de contrato (ver proposeRenewal):
     jogador com moral baixa pode recusar renovar de jeito nenhum
     (quer sair, não assinar de novo), e jogador com moral alta cobra
     salário mais alto e também rejeita contrato curto (mais confiante,
     mais exigente). */
function fairWageFor(p) {
  // Mesma fórmula de sempre (ver computeContractFields) só que sem
  // sortear duração de contrato nenhuma — quer só o salário "de
  // mercado" nominal pro overall/idade atual do jogador, pra comparar
  // contra o que ele realmente ganha.
  return computeContractFields(p.overall, p.age, p.potential || null, () => 0.5).wage;
}
// Fator multiplicador no sorteio de gol/assistência (ver
// simulatePlayerEvents) — moral 70 (o valor "de nascença") não muda
// nada (factor 1), pra não alterar o equilíbrio já calibrado do motor
// pra quem nunca teve a moral mexida (CPU, ver comentário no topo da
// seção). Clampado pra nunca zerar nem triplicar a chance de ninguém.
function moraleFactor(p) {
  const m = p.morale == null ? 70 : p.morale;
  return clamp(1 + (m - 70) / 100, 0.6, 1.3);
}
// Chamada de dentro de simulateRound, só quando SEU clube jogou —
// titular ganha por ter jogado + resultado; banco perde um pouco
// (insatisfeito por não jogar) + metade do efeito do resultado; quem
// nem entrou na "folha de jogo" (nem titular, nem banco) perde mais,
// sentindo que foi esquecido pelo treinador.
function applyMoraleAfterMatch(myGoals, oppGoals) {
  const resultDelta = myGoals > oppGoals ? 3 : myGoals === oppGoals ? 0 : -3;
  const starterIds = new Set(CAREER.lineup.starters.filter(Boolean));
  const benchIds = new Set(CAREER.lineup.bench);
  CAREER.squad.forEach((p) => {
    const base = p.morale == null ? 70 : p.morale;
    const delta = starterIds.has(p.id) ? resultDelta + 2
      : benchIds.has(p.id) ? Math.round(resultDelta / 2) - 1
      : -2;
    p.morale = clamp(base + delta, 0, 100);
  });
}
// Virada de temporada (chamada de dentro de renewHumanSquad): puxa a
// moral de todo mundo um pouco de volta pro neutro (sem isso, ao longo
// de várias temporadas ela tenderia a ficar grudada em 0 ou 100) e
// aplica o efeito de salário justo/injusto (só elenco PRINCIPAL — base
// não entra no teto salarial nem tem "salário de mercado" comparável
// de verdade, ver Fase 2b original).
function applySeasonMoraleReset(squad) {
  squad.forEach((p) => {
    const base = p.morale == null ? 70 : p.morale;
    let m = Math.round(base + (70 - base) * 0.3);
    if (p.origin === "principal") {
      const fair = fairWageFor(p);
      const ratio = fair ? p.wage / fair : 1;
      if (ratio < 0.85) m -= 6;
      else if (ratio > 1.15) m += 4;
    }
    p.morale = clamp(m, 0, 100);
  });
}
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
    status: "ok", outUntilRound: null, yellowCards: 0, condition: 100, morale: 70,
    goalsCareer: 0, assistsCareer: 0, apps: 0,
    ...computeContractFields(overall, age, null, rng),
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
    status: "ok", outUntilRound: null, yellowCards: 0, condition: 100, morale: 70,
    goalsCareer: 0, assistsCareer: 0, apps: 0,
    ...computeContractFields(overall, age, potential, rng),
  };
}
/* ---------- Fase 2 do Modo Carreira — olheiro / potencial visível na
   base ----------
   Pedido do usuário (último item entre 4 opções propostas): "ver uma
   faixa de potencial (ex.: 78-86) de jogador da base ANTES de
   promover, em vez de só descobrir o teto dele depois — hoje o
   potencial existe nos dados mas fica escondido do treinador". O
   número exato (p.potential, usado internamente desde sempre no bônus
   de valor de mercado — ver computeContractFields) nunca aparece —
   só uma FAIXA, com uma folga pra cima e pra baixo (mesmo espírito de
   "olheiro" real: ninguém crava o teto de um garoto de 16 anos com
   certeza absoluta). Determinístico por jogador (seededRngFromKey,
   mesmo padrão de renew-league/renew-human/contract-backfill) — a
   faixa não muda de um clique de render pro outro, é a mesma
   avaliação de olheiro cada vez que você abre o card. Quanto mais
   jovem, mais incerta a projeção (folga maior). */
function scoutedPotentialRange(p) {
  if (p.potential == null) return null;
  const rng = seededRngFromKey(`scout:${p.id}`);
  const ageUncertainty = p.age <= 17 ? 5 : p.age <= 19 ? 3 : 1;
  const fuzz = 2 + ageUncertainty + Math.floor(rng() * 3);
  const lo = clamp(p.potential - fuzz, p.overall, 99);
  const hi = clamp(p.potential + fuzz, lo, 99);
  return { lo, hi };
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
    status: "ok", outUntilRound: null, yellowCards: 0, condition: 100, morale: 70,
    goalsCareer: 0, assistsCareer: 0, apps: 0,
    ...computeContractFields(overall, age, null, rng),
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

/* ---------- FASE 2 (b) — orçamento do clube ----------
   Pedido do usuário: contrato/salário/valor "pra valer", limitando o
   que dá pra fazer. Folha salarial só conta o elenco PRINCIPAL (padrão
   real de clube de futebol: categoria de base tem contrato de
   formação, não entra no teto salarial do profissional) — ver
   wageBillOf, usado tanto pra mostrar o gasto atual quanto pra
   bloquear promoção que estouraria o teto (ver handlePlayerAction).
   Orçamento inicial nasce do próprio elenco (folga de 35% sobre a
   folha atual pro teto, caixa de ~6 meses de folha) em vez de um valor
   fixo pra todo mundo — clube com elenco real mais caro (por ter
   jogadores de overall mais alto) já começa com orçamento maior,
   proporcional, sem precisar de uma 2ª fonte de "tamanho do clube". */
function wageBillOf(squad) {
  // "loan" conta pro teto igual "principal" — você paga o salário
  // (reduzido) de quem pega emprestado, ver loanInPlayer.
  return squad.filter((p) => p.origin === "principal" || p.origin === "loan").reduce((s, p) => s + (p.wage || 0), 0);
}
function initialFinances(squad) {
  const wageCap = Math.round(wageBillOf(squad) * 1.35 / 1000) * 1000;
  const cash = Math.round(wageCap * 6 / 1000) * 1000;
  return { cash, wageCap };
}

/* ---------- FASE 3 (a) — diretoria (pedido de orçamento) ----------
   Pedido do usuário: treinador pode pedir mais dinheiro quando o
   orçamento aperta, e a diretoria avalia risco de rebaixamento ou
   disputa de título antes de responder — não é só "sim sempre".
   Zona de rebaixamento = últimos 4 do Brasileirão (20 times); disputa
   de título = G4. Fora dessas 2 situações, ainda existe uma chance
   pequena de aprovação (diretoria sendo generosa sem motivo forte),
   mas a maioria dos pedidos "no meio da tabela" é negada — do
   contrário o botão seria só um "dinheiro grátis" sem risco nenhum de
   recusa, o que não seria "avaliar risco" de verdade.
   BOARD_REQUEST_COOLDOWN evita pedir toda rodada — precisa esperar
   depois de uma resposta (aprovada ou negada). */
const BOARD_REQUEST_COOLDOWN = 4;
function evaluateBoardRequest() {
  const pos = myLeaguePosition();
  const total = Object.keys(CAREER.standings).length || 20;
  const relegationZone = pos > total - 4;
  const titleRace = pos > 0 && pos <= 4;
  let approved, boost, reason;
  if (relegationZone) {
    approved = true;
    boost = 0.4 + Math.random() * 0.3;
    reason = `A diretoria, preocupada com o risco de rebaixamento (${pos}º lugar), liberou recursos extras pro elenco.`;
  } else if (titleRace) {
    approved = true;
    boost = 0.3 + Math.random() * 0.3;
    reason = `Animada com a briga pelo título (${pos}º lugar), a diretoria decidiu investir mais no elenco.`;
  } else {
    approved = Math.random() < 0.15;
    boost = 0.12;
    reason = approved
      ? `Mesmo sem urgência (${pos}º lugar, meio de tabela), a diretoria aprovou um aporte pontual.`
      : `A diretoria negou o pedido — ${pos}º lugar não justifica risco de rebaixamento nem disputa de título no momento.`;
  }
  const raise = approved ? Math.round(CAREER.finances.wageCap * boost / 1000) * 1000 : 0;
  const cashBoost = approved ? raise * 3 : 0;
  return { approved, raise, cashBoost, reason, pos };
}
function askBoard() {
  const last = CAREER.lastBoardRequestRound;
  if (last != null && CAREER.currentRound - last < BOARD_REQUEST_COOLDOWN) {
    const wait = BOARD_REQUEST_COOLDOWN - (CAREER.currentRound - last);
    toast(`A diretoria já respondeu recentemente — espere mais ${wait} rodada${wait > 1 ? "s" : ""}.`);
    return;
  }
  const result = evaluateBoardRequest();
  CAREER.lastBoardRequestRound = CAREER.currentRound;
  if (result.approved) {
    CAREER.finances.wageCap += result.raise;
    CAREER.finances.cash += result.cashBoost;
    CAREER.boardDecision = `✅ ${result.reason} Teto salarial +${fmtBRLShort(result.raise)}, caixa +${fmtBRLShort(result.cashBoost)}.`;
    toast("A diretoria aprovou o pedido!");
  } else {
    CAREER.boardDecision = `❌ ${result.reason}`;
    toast("A diretoria negou o pedido.");
  }
  persistCareer();
  renderCentral();
}

/* ---------- FASE 1 (item 3 da especificação "BR Data Treinador") —
   metas da diretoria ----------
   Pedido do usuário: consequência real de desempenho — jogar bem ou
   mal dá no mesmo hoje. Fase 1 fica só com meta de POSIÇÃO na tabela
   (decisão do próprio documento: "na Fase 1 pode ser só a meta de
   posição na tabela", copas ficam pra Fase 3). Calculada a partir da
   força do elenco (overall médio do PRINCIPAL) contra a média da liga
   inteira (mesmo `atk/def` que já calibra a força de cada clube, ver
   loadLeague/calibrateStrengths — usar overall médio aqui é mais
   direto e já reflete o mesmo elenco que a Central mostra). 3 faixas
   (mesmo espírito de menor esforço do documento): elenco bem acima da
   média mira o G6 (Libertadores/Sul-Americana), elenco parecido mira
   a primeira metade, elenco bem abaixo mira só sobreviver ao Z4 — os
   2 extremos são literalmente os 2 exemplos que o próprio documento
   dá ("terminar entre os 6 primeiros" / "não cair"). */
function averageOverall(list) {
  if (!list.length) return 0;
  return list.reduce((s, p) => s + p.overall, 0) / list.length;
}
function computeBoardGoal() {
  const myAvg = averageOverall(CAREER.squad.filter((p) => p.origin === "principal"));
  const leagueAvg = averageOverall(Object.values(CAREER.leagueSquads || {}).flat());
  const diff = myAvg - leagueAvg;
  if (diff >= 4) return { type: "posicao_tabela", target: 6, label: "Terminar entre os 6 primeiros" };
  if (diff <= -4) return { type: "posicao_tabela", target: 16, label: "Não cair (terminar fora do Z4)" };
  return { type: "posicao_tabela", target: 10, label: "Terminar na primeira metade da tabela" };
}
function boardGoalMet(position, goal) {
  return !!goal && position > 0 && position <= goal.target;
}
// Depois de N temporadas seguidas sem bater a meta, a diretoria demite
// o treinador (decisão minha — não estava especificado no documento,
// que deixou em aberto "quantas temporadas sem bater meta até
// demissão"): 3 dá uma margem real antes de acabar a carreira nesse
// clube, sem deixar a meta sem consequência nenhuma.
const DISMISSAL_STREAK = 3;

/* ---------- FASE 2 (a) — Copa do Brasil ----------
   Pedido do usuário (Fase 2 do Modo Carreira, item que a própria
   especificação da Fase 1 já tinha deixado reservado pra "fase
   seguinte" — meta da diretoria com objetivo de copa): competição
   secundária em mata-mata, rodando em paralelo ao Brasileirão.

   Simplificações deliberadas (mesmo espírito de "menor esforço" da
   Fase 1): mata-mata de jogo ÚNICO (sem ida e volta — decide no
   agregado de 1 jogo só, com pênaltis se empatar), 16 times (não 20 —
   precisa ser potência de 2 pra fechar oitavas/quartas/semi/final sem
   sobra; os 4 elencos mais fracos da temporada ficam de fora, como se
   tivessem caído numa fase classificatória que esse jogo não simula).
   4 rodadas fixas do Brasileirão viram "dia de Copa" também (ver
   CUP_ROUNDS) — nelas, ALÉM do jogo do Brasileirão normal (o
   calendário do Brasileirão não muda em nada), se seu clube ainda
   estiver vivo na Copa, o confronto daquela fase também é resolvido
   no mesmo clique de "Simular rodada" (ver resolveCupPhase, chamado de
   dentro de simulateRound). */
const CUP_PHASES = ["r16", "qf", "sf", "final"];
const CUP_ROUNDS = { r16: 6, qf: 14, sf: 22, final: 30 };
const CUP_PHASE_LABEL = { r16: "Oitavas de final", qf: "Quartas de final", sf: "Semifinal", final: "Final" };
const CUP_PRIZE = { qf: 500000, sf: 1500000, final: 4000000, champion: 10000000, runnerUp: 3000000 };
function squadAvgOverallOf(clubId) {
  if (String(clubId) === String(CAREER.clubId)) return averageOverall(CAREER.squad.filter((p) => p.origin === "principal"));
  return averageOverall(CAREER.leagueSquads[String(clubId)] || []);
}
function shuffleWithRng(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// Sorteio da 1ª fase: os 16 elencos com maior overall médio entram —
// classificação "de fase anterior" que esse jogo não modela, só usa a
// força do elenco pra decidir quem entra direto (bem mais forte que
// aleatório puro, e ainda deixa o SEU clube fora em temporadas ruins,
// dando um motivo a mais pra reforçar o elenco). Sorteio embaralhado
// com RNG determinístico da temporada (mesmo padrão de renew-league/
// renew-human) — mesmo clube, mesmo ano, sempre cai no mesmo chaveamento.
function setupCup(fastForwardFromRound) {
  const strengths = LEAGUE_TEAMS.map((t) => ({ id: t.id, avg: squadAvgOverallOf(t.id) }));
  strengths.sort((a, b) => b.avg - a.avg);
  const qualifiers = strengths.slice(0, 16).map((s) => s.id);
  const humanIn = qualifiers.some((id) => String(id) === String(CAREER.clubId));
  const rng = seededRngFromKey(`cup-draw:${CAREER.clubId}:${CAREER.seasonYear}`);
  const shuffled = shuffleWithRng(qualifiers, rng);
  const r16 = [];
  for (let i = 0; i < shuffled.length; i += 2) r16.push({ home: shuffled[i], away: shuffled[i + 1], gh: null, ga: null, winner: null, penalties: false });
  CAREER.cup = {
    active: humanIn,
    phase: "r16",
    humanAlive: humanIn,
    humanEliminatedAtRound: null,
    humanEliminatedStage: null,
    champion: null,
    championIsHuman: false,
    ties: { r16, qf: [], sf: [], final: [] },
  };
  // Migração de save no meio de uma temporada em andamento (ver
  // migrateCareerDefaults): fases cujo round já passou não podem ser
  // "jogadas de verdade" retroativamente — resolve elas por trás
  // (silent:true, sem prêmio nem log) só pra fechar o chaveamento até a
  // fase que ainda está por vir, e a Copa volta ao normal dali em diante.
  if (fastForwardFromRound != null) {
    while (CAREER.cup.phase !== "done" && CUP_ROUNDS[CAREER.cup.phase] < fastForwardFromRound) {
      resolveCupPhase(CUP_ROUNDS[CAREER.cup.phase], { silent: true });
    }
  }
}
// Mesma fórmula de gol (ataque/defesa calibrados -> Poisson) já usada
// pra todo jogo do Brasileirão (ver simulateRound) — reaproveitada
// aqui pra não inventar um 2º motor de partida. Só o lado HUMANO gera
// evento individual (gol/cartão/lesão) — CPU x CPU na Copa não precisa
// de autor pro gol, só do placar pra decidir quem avança.
function simulateCupTie(homeId, awayId, round) {
  const home = teamById(homeId), away = teamById(awayId);
  const isHome = String(homeId) === String(CAREER.clubId), isAway = String(awayId) === String(CAREER.clubId);
  const hs = isHome ? computeHumanStrength(home) : { atk: home.atk, def: home.def, starters: pickCpuXI(leagueSquadFor(homeId)) };
  const as = isAway ? computeHumanStrength(away) : { atk: away.atk, def: away.def, starters: pickCpuXI(leagueSquadFor(awayId)) };
  const lambdaHome = clamp((hs.atk / as.def) * 1.12, 0.05, 6);
  const lambdaAway = clamp(as.atk / hs.def, 0.05, 6);
  const gh = poissonSample(lambdaHome, Math.random);
  const ga = poissonSample(lambdaAway, Math.random);
  if (isHome) applyConditionRecovery(hs.starters.map((p) => p.id));
  if (isAway) applyConditionRecovery(as.starters.map((p) => p.id));
  if (isHome) simulatePlayerEvents(hs.starters, gh, round);
  if (isAway) simulatePlayerEvents(as.starters, ga, round);
  let winner, penalties = false;
  if (gh > ga) winner = homeId;
  else if (ga > gh) winner = awayId;
  else {
    // Empate no jogo único -> pênaltis (sem prorrogação simulada, vai
    // direto pra decisão). Levemente enviesado pelo overall médio dos
    // 2 elencos, mas ainda bem sujeito ao acaso — pênalti é loteria
    // até no futebol de verdade.
    penalties = true;
    const pHome = clamp(0.5 + (squadAvgOverallOf(homeId) - squadAvgOverallOf(awayId)) / 100, 0.25, 0.75);
    winner = Math.random() < pHome ? homeId : awayId;
  }
  return { gh, ga, penalties, winner };
}
// Resolve TODOS os confrontos da fase atual da Copa (não só o seu —
// mesmo espírito de "estatísticas reais de todos os times" da Fase
// 2a) e já monta o chaveamento da fase seguinte com quem avançou.
// silent:true (só usado por setupCup pra fast-forward de migração) não
// gera prêmio, log nem marca a rodada real da eliminação — é só
// fechamento estrutural de uma fase que ficou pra trás antes da Copa
// existir no save.
function resolveCupPhase(round, { silent = false } = {}) {
  const cup = CAREER.cup;
  if (!cup || !cup.active || cup.phase === "done") return null;
  const phase = cup.phase;
  if (!silent && CUP_ROUNDS[phase] !== round) return null;
  const ties = cup.ties[phase];
  ties.forEach((tie) => {
    const r = silent
      ? { gh: 0, ga: 0, penalties: true, winner: (squadAvgOverallOf(tie.home) + Math.random() * 10) >= (squadAvgOverallOf(tie.away) + Math.random() * 10) ? tie.home : tie.away }
      : simulateCupTie(tie.home, tie.away, round);
    tie.gh = r.gh; tie.ga = r.ga; tie.winner = r.winner; tie.penalties = r.penalties;
    const humanInvolved = String(tie.home) === String(CAREER.clubId) || String(tie.away) === String(CAREER.clubId);
    if (!humanInvolved) return;
    const humanWon = String(r.winner) === String(CAREER.clubId);
    if (humanWon) {
      if (!silent) {
        const prize = phase === "final" ? CUP_PRIZE.champion : CUP_PRIZE[CUP_PHASES[CUP_PHASES.indexOf(phase) + 1]];
        if (prize) {
          CAREER.finances.cash += prize;
          pushTransferLog(`Copa do Brasil: classificação${phase === "final" ? " como campeão" : ""} rendeu ${fmtBRL(prize)} aos cofres do clube.`, round);
        }
      }
    } else {
      cup.humanAlive = false;
      cup.humanEliminatedAtRound = silent ? null : round;
      cup.humanEliminatedStage = phase;
      if (phase === "final" && !silent) {
        CAREER.finances.cash += CUP_PRIZE.runnerUp;
        pushTransferLog(`Copa do Brasil: vice-campeão rendeu ${fmtBRL(CUP_PRIZE.runnerUp)} aos cofres do clube.`, round);
      }
    }
  });
  const results = ties.map((t) => ({ ...t }));
  if (phase === "final") {
    cup.champion = ties[0].winner;
    cup.championIsHuman = String(cup.champion) === String(CAREER.clubId);
    cup.phase = "done";
  } else {
    const winners = ties.map((t) => t.winner);
    const nextPhase = CUP_PHASES[CUP_PHASES.indexOf(phase) + 1];
    const nextTies = [];
    for (let i = 0; i < winners.length; i += 2) nextTies.push({ home: winners[i], away: winners[i + 1], gh: null, ga: null, winner: null, penalties: false });
    cup.ties[nextPhase] = nextTies;
    cup.phase = nextPhase;
  }
  return { phase, results };
}

/* ---------- FASE 3 (b) — renda de ingressos ----------
   Pedido do usuário: todo jogo em CASA rende dinheiro pela venda de
   ingressos, e o estádio enche mais numa fase boa e menos numa ruim.
   Sem dado de capacidade de estádio vindo da API (nenhum provider hoje
   expõe isso pro front, ver adapter.js/providers/) — capacidade e
   preço médio do ingresso são estimados a partir da força do clube
   (mesmo princípio já usado pro orçamento inicial, ver initialFinances),
   com seed fixa por clube (seededRngFromKey) pra não mudar toda hora.
   "Fase boa/ruim" = média de pontos dos últimos 5 jogos SEUS (ver
   CAREER.recentForm, atualizado a cada rodada em simulateRound) — só
   pontos, não posição na tabela (um time no meio da tabela numa
   sequência de vitórias enche o estádio do mesmo jeito). */
function stadiumCapacityFor(club) {
  const rng = seededRngFromKey(`stadium:${club.id}`);
  const base = 15000 + rng() * 20000; // 15 a 35 mil de base
  const bonus = clamp((club.atk || 1.3) - 1, 0, 1) * 45000; // clube forte chega a +45 mil
  return Math.round((base + bonus) / 1000) * 1000;
}
function avgTicketPriceFor(club) {
  return Math.round(25 + clamp((club.atk || 1.3) - 1, 0, 1) * 65);
}
function currentAttendancePct() {
  const form = CAREER.recentForm || [];
  if (!form.length) return 0.6; // sem histórico ainda (início de carreira) — nem cheio nem vazio
  const avgPts = form.reduce((s, x) => s + x, 0) / form.length; // 0 (só derrotas) a 3 (só vitórias)
  return clamp(0.35 + (avgPts / 3) * 0.6, 0.25, 0.98);
}
// Atualiza a sequência de forma (últimos 5 jogos, só pontos ganhos)
// depois de cada rodada — usada tanto pra público do estádio quanto,
// no futuro, pra qualquer outra coisa que dependa de "fase boa/ruim".
const RECENT_FORM_MAX = 5;
function pushRecentForm(pts) {
  CAREER.recentForm = CAREER.recentForm || [];
  CAREER.recentForm.push(pts);
  if (CAREER.recentForm.length > RECENT_FORM_MAX) CAREER.recentForm.shift();
}
// Renda de ingressos do jogo em CASA — devolve null se o clube jogou
// fora ou teve folga (sem receita nesses casos).
function computeTicketRevenue(club) {
  const capacity = stadiumCapacityFor(club);
  const pct = currentAttendancePct();
  const price = avgTicketPriceFor(club);
  const attendance = Math.round(capacity * pct);
  const revenue = attendance * price;
  return { capacity, attendance, pct, price, revenue };
}

/* ---------- FASE 3 (c) — multitemporadas ----------
   Pedido do usuário: ao encerrar a temporada, seguir jogando ano após
   ano — novo orçamento, elenco envelhece, contrato vence, base
   renova. TODOS os 20 elencos envelhecem juntos (decisão do usuário) —
   não só o seu, ver renewLeagueSquad pros outros 19.
   CAREER.seasonYear é o "ano da carreira" (começa em LIVE_SEASON, a
   temporada real que os dados vieram) — contractUntil dos jogadores é
   comparado contra ele, não contra LIVE_SEASON (que é fixo, a
   temporada real da API, e não teria por que mudar só porque a
   carreira avançou um ano). */
const MAX_SEASON_HISTORY = 15;
// Elenco de um time CPU: envelhece, quem venceu contrato sai, repõe
// até o mínimo jogável com "contratações" novas (mesmo gerador
// profissional adulto de sempre — CPU não tem categoria de base
// própria, ver Fase 2a).
function renewLeagueSquad(club, squad) {
  // BUG CORRIGIDO (achado ao alargar a duração da lesão pra Fase 1 item
  // 4 — lesão grave passou a poder chegar a 14 rodadas): sem resetar
  // status/outUntilRound na virada de temporada, um jogador machucado
  // ou suspenso nas últimas rodadas do ano carregava esse afastamento
  // pra rodada 1 da temporada NOVA (currentRound volta a 1, mas
  // outUntilRound continuava um número alto de quando a lesão
  // aconteceu) — ficava fora de combate o ano inteiro sem chance
  // nenhuma de voltar, mesmo o campeonato tendo terminado fazia tempo.
  // Entressafra é tempo de sobra pra qualquer lesão/suspensão resolver.
  squad.forEach((p) => { p.age += 1; p.status = "ok"; p.outUntilRound = null; p.injurySeverity = null; p.yellowCards = 0; });
  const kept = squad.filter((p) => p.contractUntil >= CAREER.seasonYear);
  const rng = seededRngFromKey(`renew-league:${club.id}:${CAREER.seasonYear}`);
  const missing = Math.max(0, MIN_LEAGUE_SQUAD - kept.length);
  const fresh = Array.from({ length: missing }, (_, i) => buildGeneratedProPlayer(club, i, rng));
  return [...kept, ...fresh];
}
// Elenco do SEU clube: envelhece, quem venceu contrato sai de graça
// (limpa da escalação também), repõe a base até 16 com jovens novos
// (mesmo gerador de sempre, ver buildBasePlayer) e o principal até o
// mínimo jogável se caiu abaixo por causa das saídas.
function renewHumanSquad() {
  // BUG CORRIGIDO — mesmo problema/motivo do renewLeagueSquad acima.
  CAREER.squad.forEach((p) => { p.age += 1; p.status = "ok"; p.outUntilRound = null; p.injurySeverity = null; p.yellowCards = 0; });
  const leavingNames = [];
  CAREER.squad = CAREER.squad.filter((p) => {
    if (p.contractUntil < CAREER.seasonYear) { leavingNames.push(p.name); return false; }
    return true;
  });
  const remainingIds = new Set(CAREER.squad.map((p) => p.id));
  CAREER.lineup.starters = CAREER.lineup.starters.map((id) => (id && remainingIds.has(id) ? id : null));
  CAREER.lineup.bench = CAREER.lineup.bench.filter((id) => remainingIds.has(id));
  // FASE 2 (b) — regressão pro neutro + efeito de salário justo/injusto
  // (só quem sobreviveu à saída por fim de contrato acima — quem chega
  // novo já nasce em 70, ver builders).
  applySeasonMoraleReset(CAREER.squad);

  const club = teamById(CAREER.clubId);
  const rng = seededRngFromKey(`renew-human:${CAREER.clubId}:${CAREER.seasonYear}`);
  const baseCount = CAREER.squad.filter((p) => p.origin === "base").length;
  const newBase = Array.from({ length: Math.max(0, 16 - baseCount) }, (_, i) => buildBasePlayer(club, i, rng));
  const principalCount = CAREER.squad.filter((p) => p.origin === "principal").length;
  const newPrincipal = Array.from({ length: Math.max(0, MIN_PRINCIPAL - principalCount) }, (_, i) => buildGeneratedProPlayer(club, i, rng));
  CAREER.squad.push(...newBase, ...newPrincipal);
  return { leavingNames, newBaseCount: newBase.length, newPrincipalCount: newPrincipal.length };
}
// Só pode ser chamada com a temporada realmente encerrada (round > 38,
// ver renderCentral) — devolve o resumo pro modal de nova temporada
// (ver showSeasonModal).
function advanceSeason() {
  if (CAREER.currentRound <= 38) return null;
  const finishedYear = CAREER.seasonYear;
  const finishedPos = myLeaguePosition();
  const finishedPts = (CAREER.standings[CAREER.clubId] || {}).pts || 0;
  // FASE 1 (item 3) — checa a meta da temporada que ACABOU de terminar
  // (a que estava valendo o ano inteiro, ver CAREER.boardGoal) antes de
  // sortear a próxima; goalWasMet decide se a sequência de temporadas
  // sem bater meta reseta ou soma mais uma (ver DISMISSAL_STREAK).
  const finishedGoal = CAREER.boardGoal || computeBoardGoal();
  const goalWasMet = boardGoalMet(finishedPos, finishedGoal);
  CAREER.seasonHistory = CAREER.seasonHistory || [];
  CAREER.seasonHistory.unshift({ year: finishedYear, position: finishedPos, points: finishedPts, goalLabel: finishedGoal.label, goalWasMet });
  if (CAREER.seasonHistory.length > MAX_SEASON_HISTORY) CAREER.seasonHistory.length = MAX_SEASON_HISTORY;

  CAREER.negativeSeasonsStreak = goalWasMet ? 0 : (CAREER.negativeSeasonsStreak || 0) + 1;
  // FASE 1 (item 3) — demissão: a diretoria não segue com o treinador
  // depois de DISMISSAL_STREAK temporadas seguidas sem bater a meta.
  // Não mexe em MAIS NADA do save (elenco, calendário, teto) — o fim
  // de carreira nesse clube é definitivo (ver showDismissalModal, que
  // apaga o save inteiro quando o usuário confirma).
  if (CAREER.negativeSeasonsStreak >= DISMISSAL_STREAK) {
    return { dismissed: true, finishedYear, finishedPos, finishedGoal, goalWasMet, streak: CAREER.negativeSeasonsStreak };
  }

  CAREER.seasonYear += 1;
  // FASE 2 (c) — empréstimos (nos dois sentidos) sempre voltam pro dono
  // de origem na virada de temporada — ANTES da renovação normal, pra
  // quem voltou também envelhecer/ter o contrato checado como qualquer
  // outro jogador do elenco (ver resolveLoanReturns).
  resolveLoanReturns();
  const humanRenewal = renewHumanSquad();
  Object.keys(CAREER.leagueSquads).forEach((clubId) => {
    CAREER.leagueSquads[clubId] = renewLeagueSquad(teamById(clubId), CAREER.leagueSquads[clubId]);
  });

  // "Novo orçamento" (pedido do usuário) — teto recalculado pelo
  // elenco renovado; caixa NÃO reseta, transfere pro ano que vem
  // (também pedido do usuário: "com transferência para o próximo ano").
  CAREER.finances.wageCap = Math.round(wageBillOf(CAREER.squad) * 1.35 / 1000) * 1000;

  CAREER.schedule = generateAllRounds(LEAGUE_TEAMS.map((t) => t.id)); // global de js/data.js
  const standings = {};
  LEAGUE_TEAMS.forEach((t) => { standings[t.id] = { id: t.id, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0, pts: 0 }; });
  CAREER.standings = standings;
  CAREER.currentRound = 1;
  CAREER.resultsByRound = {};
  CAREER.recentForm = [];
  CAREER.teamStats = { assists: 0, yellow: 0, red: 0 }; // estatísticas da Estatísticas são "da temporada", zeram junto com a tabela
  pushTransferLog(`Início da Temporada ${CAREER.seasonYear}.`, 1);

  // FASE 1 (item 3) — meta da temporada nova, já em cima do elenco
  // RENOVADO (reflete quem saiu/chegou agora, não o elenco velho).
  CAREER.boardGoal = computeBoardGoal();
  // FASE 2 (a) — novo chaveamento da Copa do Brasil, mesmo motivo do
  // boardGoal acima (elenco renovado de todo mundo, não só o seu).
  setupCup();

  return { dismissed: false, finishedYear, finishedPos, finishedGoal, goalWasMet, newYear: CAREER.seasonYear, humanRenewal, newGoal: CAREER.boardGoal };
}

/* ---------- FASE 2 (a) — elenco individual pra TODOS os times ----------
   Pedido do usuário: "estatísticas reais de todos os times" (não só o
   seu). Antes disso, os outros 19 clubes eram só um número de força
   (atk/def calibrado — ver LEAGUE_TEAMS/calibrateStrengths), sem
   jogador nenhum de verdade por trás, então todo gol deles virava
   "Gol do <Time>" sem autor (ver comentário em simulateRound). Agora
   TODO clube tem elenco real (mesmo buildRealPlayer do seu time), e
   cada partida da rodada — não só a sua — credita gol/assistência/
   cartão a um jogador de verdade, alimentando o ranking de artilheiros
   da competição inteira (ver renderEstatisticas).

   Deliberadamente mais ENXUTO que o elenco do próprio clube (ver
   MAX_LEAGUE_SQUAD abaixo, sem categoria de base): CPU não promove,
   não negocia (ainda — fase seguinte), não tem banco gerenciável pelo
   usuário, só precisa de nomes plausíveis pra estatística e pra
   escalar 11 a cada rodada (ver pickCpuXI). Elenco cheio (principal +
   base, como o seu) pros 20 times deixaria o save ~20x maior à toa. */
const MAX_LEAGUE_SQUAD = 26;
const MIN_LEAGUE_SQUAD = 16;
async function buildLeagueSquad(club) {
  const rng = seededRngFromKey(`league-squad:${club.id}:${LIVE_SEASON}`);
  const raw = await fetchRealPlayers(club.id).catch(() => []);
  const realPlayers = raw.slice(0, MAX_LEAGUE_SQUAD).map((p) => buildRealPlayer(p, club, rng));
  const missing = Math.max(0, MIN_LEAGUE_SQUAD - realPlayers.length);
  const filler = Array.from({ length: missing }, (_, i) => buildGeneratedProPlayer(club, i, rng));
  return [...realPlayers, ...filler];
}
// Constrói o elenco dos outros 19 times de uma vez (em paralelo — cada
// busca já é cacheada 12h no servidor, ver TTL.teams em server.js, o
// mesmo endpoint que /api/teams/:id/players sempre usou, então o custo
// real de fornecedor só existe na 1ª carreira criada depois do cache
// vencer, não a cada carreira nova). Falha isolada por time (ver catch
// dentro de buildLeagueSquad) não derruba a criação da carreira.
async function buildLeagueSquads(humanClubId) {
  const others = LEAGUE_TEAMS.filter((t) => String(t.id) !== String(humanClubId));
  const entries = await Promise.all(others.map(async (club) => [String(club.id), await buildLeagueSquad(club)]));
  return Object.fromEntries(entries);
}
function leagueSquadFor(clubId) {
  return (CAREER.leagueSquads && CAREER.leagueSquads[String(clubId)]) || [];
}
// Escala uma XI plausível pro time CPU essa rodada — sem tática/
// formação (isso é só pro SEU time, ver computeHumanStrength), só uma
// mistura de posições razoável priorizando quem está "ok" (jogador CPU
// também sofre lesão/suspensão via simulatePlayerEvents, reaproveitado
// tal e qual do seu time).
const CPU_XI_MIX = { G: 1, D: 4, M: 4, F: 2 };
function pickCpuXI(squad) {
  if (!squad.length) return [];
  const okFirst = squad.filter((p) => p.status === "ok");
  const pool = okFirst.length >= 11 ? okFirst : squad; // sem gente "ok" suficiente, usa todo mundo mesmo
  const used = new Set();
  const xi = [];
  Object.entries(CPU_XI_MIX).forEach(([g, n]) => {
    pool.filter((p) => p.group === g && !used.has(p.id)).sort((a, b) => b.overall - a.overall)
      .slice(0, n).forEach((p) => { xi.push(p); used.add(p.id); });
  });
  if (xi.length < 11) {
    pool.filter((p) => !used.has(p.id)).sort((a, b) => b.overall - a.overall)
      .slice(0, 11 - xi.length).forEach((p) => { xi.push(p); used.add(p.id); });
  }
  return xi;
}

/* ---------- FASE 2 (c) — mercado de transferências ----------
   Pedido do usuário: os outros 19 times também negociam entre si (não
   só o seu clube compra/vende). Sem economia própria pros times CPU
   (eles não têm CAREER.finances, só o seu clube tem — ver Fase 2b): a
   troca entre 2 clubes CPU é só um jogador mudando de elenco (mesmos
   atributos, sem recalcular overall pro novo clube — manter simples de
   propósito), virando uma notícia no feed (ver pushTransferLog). Fica
   de olho no controle de tamanho do save: mover jogador entre elencos
   não muda o total de jogadores na liga, então não cresce o save.
   pushTransferLog mantém só as últimas TRANSFER_LOG_MAX notícias. */
const TRANSFER_LOG_MAX = 12;
function pushTransferLog(text, round) {
  CAREER.transferLog = CAREER.transferLog || [];
  CAREER.transferLog.unshift({ round, text });
  if (CAREER.transferLog.length > TRANSFER_LOG_MAX) CAREER.transferLog.length = TRANSFER_LOG_MAX;
}
// FASE 1 (item 2 da especificação "BR Data Treinador") — pedido do
// usuário: janela de transferências com prazo (2 por temporada, ex.:
// rodadas 1–3 e 20–22, valores sugeridos no próprio documento) — sem
// isso o Mercado ficava sempre aberto pra contratar, sem nenhuma
// tensão de "última chance antes de fechar". Puramente derivado da
// rodada atual (mesmo padrão do "(X / 38)" da Central) — não precisa
// de campo novo no save nem migração. Vender continua liberado fora
// da janela (decisão do documento: "geralmente sim, só não comprar");
// empréstimo não existe como mecânica nesse jogo, então a outra
// pergunta em aberto do documento não se aplica aqui.
const TRANSFER_WINDOWS = [[1, 3], [20, 22]];
function transferWindowStatus(round) {
  for (const [open, close] of TRANSFER_WINDOWS) {
    if (round >= open && round <= close) return { open: true, closesAtRound: close };
  }
  const next = TRANSFER_WINDOWS.find(([open]) => open > round);
  return { open: false, opensAtRound: next ? next[0] : null };
}
function pickRandomOtherClub(excludeId) {
  const pool = LEAGUE_TEAMS.filter((t) => String(t.id) !== String(excludeId));
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
// AJUSTE (pedido do usuário: "quando vende um jogador ele sempre deve
// ir para outro time. Se não tiver interessados ele tem que continuar
// no elenco") — antes, vender sempre "achava" comprador (19 times
// sempre existem, então pickRandomOtherClub nunca falhava de verdade)
// e o jogador desaparecia do jogo garantido. Agora só clubes com vaga
// no elenco (mesmo teto MAX_LEAGUE_SQUAD das negociações CPU x CPU)
// entram na lista de possíveis compradores, e mesmo com vaga sobra uma
// chance de ninguém topar na hora (mercado nem sempre tem interessado
// pra todo mundo) — ver sellPlayer, que agora cancela a venda sem
// mexer em nada quando isso devolve null.
function findInterestedBuyer(excludeId) {
  const eligible = LEAGUE_TEAMS.filter((t) =>
    String(t.id) !== String(excludeId) && leagueSquadFor(t.id).length < MAX_LEAGUE_SQUAD
  );
  if (!eligible.length) return null;
  if (Math.random() < 0.2) return null; // 20% de chance de ninguém topar agora, mesmo com vaga
  return eligible[Math.floor(Math.random() * eligible.length)];
}

/* ---------- Fase 2 do Modo Carreira — empréstimo de jogadores ----------
   Pedido do usuário (item escolhido entre 4 opções propostas — a
   própria janela de transferências, Fase 1 item 2, tinha deixado essa
   pergunta em aberto por não existir essa mecânica ainda). Ceder ou
   pegar um jogador emprestado, sem venda definitiva. Só dá pra
   negociar dentro da janela de contratações — mesma trava de comprar
   (ver transferWindowStatus).

   FASE 3 (item 3 dessa especificação) — evolução do que já existia:
   antes o empréstimo só durava até o fim da temporada, com taxa/
   salário sempre fixos. Agora, ao abrir o modal de configuração (ver
   openLoanOutModal/openLoanInModal), dá pra escolher DURAÇÃO (6 meses
   ou temporada inteira — ver LOAN_HALF_SEASON_ROUNDS), o PERCENTUAL do
   salário pago (só do lado de quem pega emprestado, ver
   finalizeLoanIn) e uma CLÁUSULA DE COMPRA opcional ou obrigatória
   (ver loanBuyOption/shouldExerciseBuyOption) que vira transferência
   definitiva quando o empréstimo termina.

   Jogador que VOCÊ empresta: sai do CAREER.squad, entra no elenco de
   um clube CPU com interesse (mesma checagem de vaga/interesse da
   venda, ver findInterestedBuyer) marcado com onLoanFromClubId — só
   essa marca já é suficiente pra saber que é seu quando o empréstimo
   terminar E pra impedir comprar/pegar de volta emprestado ele mesmo
   nesse meio tempo (ver allMarketPlayers, que filtra ele fora da lista
   de "outros"). Salário dele não conta mais pro seu teto enquanto
   estiver fora (CPU não tem folha salarial, então não precisa zerar
   nada).

   Jogador que VOCÊ pega emprestado: origin vira "loan" (nem principal
   nem base) — sem botão de vender/dispensar/promover/renovar contrato
   no detalhe (ver openDetail: você não é dono, só usuário temporário),
   só ação de escalação normal. Salário reduzido (percentual escolhido
   no modal, ver finalizeLoanIn) CONTA pro seu teto (ver wageBillOf) —
   você paga o clube emprestando o atleta, é o trato.

   Retorno: quem tem loanReturnRound definido (empréstimo de 6 meses)
   volta no meio da temporada, checado a cada rodada simulada (ver
   checkMidSeasonLoanReturns, chamado de dentro de simulateRound).
   Quem tem loanReturnRound null (temporada inteira) só resolve na
   virada de temporada (ver resolveLoanReturns, chamado de dentro de
   advanceSeason ANTES da renovação normal, pra quem voltou envelhecer/
   ter contrato checado como qualquer outro jogador do elenco no mesmo
   clique). Os dois casos reaproveitam settleLoanOut/settleLoanIn, que
   também resolvem a cláusula de compra quando existir. */
const LOAN_HALF_SEASON_ROUNDS = 19; // "6 meses" ≈ metade das 38 rodadas
// Decide se uma cláusula de compra é acionada quando o empréstimo
// termina. Obrigatória: sempre. Opcional do lado CPU (comprou um
// jogador seu emprestado): sorteio, igual toda decisão de time CPU
// nesse jogo (ver findInterestedBuyer). Opcional do lado humano (você
// pegou emprestado) é decidida à parte por quem chama (checa caixa e
// teto antes de comprar, ver settleLoanIn) — aqui devolve sempre false
// pra esse caso, só pra não duplicar a mesma checagem financeira.
function shouldExerciseBuyOption(option, { human }) {
  if (!option) return false;
  if (option.mandatory) return true;
  if (human) return false;
  return Math.random() < 0.55;
}
// Resolve o lado de um empréstimo QUE VOCÊ DEU (jogador está em
// CAREER.leagueSquads[clubId], marcado com onLoanFromClubId).
function settleLoanOut(clubId, p) {
  const club = teamById(clubId);
  const option = p.loanBuyOption;
  if (shouldExerciseBuyOption(option, { human: false })) {
    CAREER.finances.cash += option.value;
    delete p.onLoanFromClubId; delete p.loanReturnRound; delete p.loanBuyOption;
    pushTransferLog(`${club.name} acionou a cláusula de compra e ficou definitivamente com ${p.name} por ${fmtBRL(option.value)}.`, CAREER.currentRound);
    toast(`${abbreviateName(p.name)} foi comprado em definitivo pelo ${club.name}!`);
    return;
  }
  CAREER.leagueSquads[clubId] = (CAREER.leagueSquads[clubId] || []).filter((x) => x !== p);
  delete p.onLoanFromClubId; delete p.loanReturnRound; delete p.loanBuyOption;
  CAREER.squad.push(p);
  pushTransferLog(`${p.name} voltou do empréstimo no ${club.name}.`, CAREER.currentRound);
  toast(`${abbreviateName(p.name)} voltou do empréstimo!`);
}
// Resolve o lado de um empréstimo QUE VOCÊ PEGOU (jogador está no seu
// CAREER.squad, origin "loan").
function settleLoanIn(p) {
  const option = p.loanBuyOption;
  let buys = false;
  if (option) {
    if (option.mandatory) buys = true;
    else {
      // Opcional do seu lado: só compra se realmente couber no
      // orçamento com o salário CHEIO de volta (contrato definitivo
      // não sai mais pelo valor reduzido do empréstimo).
      const wageAfter = wageBillOf(CAREER.squad) - p.wage + p.loanOriginalWage;
      buys = CAREER.finances.cash >= option.value && wageAfter <= CAREER.finances.wageCap;
    }
  }
  if (buys) {
    CAREER.finances.cash -= option.value;
    p.wage = p.loanOriginalWage;
    p.origin = "principal";
    delete p.loanFromClubId; delete p.loanOriginalWage; delete p.loanReturnRound; delete p.loanBuyOption;
    pushTransferLog(`Você acionou a cláusula e comprou ${p.name} em definitivo por ${fmtBRL(option.value)}.`, CAREER.currentRound);
    toast(`${abbreviateName(p.name)} contratado em definitivo!`);
    return;
  }
  const fromId = String(p.loanFromClubId);
  const fromClub = teamById(fromId);
  CAREER.squad = CAREER.squad.filter((x) => x !== p);
  p.origin = "principal";
  if (p.loanOriginalWage != null) p.wage = p.loanOriginalWage;
  delete p.loanFromClubId; delete p.loanOriginalWage; delete p.loanReturnRound; delete p.loanBuyOption;
  (CAREER.leagueSquads[fromId] = CAREER.leagueSquads[fromId] || []).push(p);
  const remainingIds = new Set(CAREER.squad.map((x) => x.id));
  CAREER.lineup.starters = CAREER.lineup.starters.map((id) => (id && remainingIds.has(id) ? id : null));
  CAREER.lineup.bench = CAREER.lineup.bench.filter((id) => remainingIds.has(id));
  pushTransferLog(`${p.name} voltou pro ${fromClub.name} depois do empréstimo.`, CAREER.currentRound);
  toast(`Empréstimo de ${abbreviateName(p.name)} terminou — ele voltou pro ${fromClub.name}.`);
}
// Chamada a cada rodada simulada (ver simulateRound) — só resolve quem
// tem loanReturnRound definido (empréstimo de 6 meses) E já chegou lá;
// empréstimo de temporada inteira (loanReturnRound null) fica de fora,
// só resolve na virada de temporada (ver resolveLoanReturns).
function checkMidSeasonLoanReturns(round) {
  Object.keys(CAREER.leagueSquads).forEach((clubId) => {
    const due = (CAREER.leagueSquads[clubId] || []).filter((p) =>
      p.onLoanFromClubId && String(p.onLoanFromClubId) === String(CAREER.clubId) && p.loanReturnRound != null && p.loanReturnRound <= round
    );
    due.forEach((p) => settleLoanOut(clubId, p));
  });
  CAREER.squad.filter((p) => p.origin === "loan" && p.loanReturnRound != null && p.loanReturnRound <= round)
    .forEach((p) => settleLoanIn(p));
}
// Chamada de dentro de advanceSeason, antes da renovação normal (ver
// comentário lá) — a temporada está acabando, então TODO empréstimo
// ainda ativo (de qualquer duração) resolve agora, cláusula de compra
// incluída (ver settleLoanOut/settleLoanIn).
function resolveLoanReturns() {
  Object.keys(CAREER.leagueSquads).forEach((clubId) => {
    const returning = (CAREER.leagueSquads[clubId] || []).filter((p) => p.onLoanFromClubId && String(p.onLoanFromClubId) === String(CAREER.clubId));
    returning.forEach((p) => settleLoanOut(clubId, p));
  });
  CAREER.squad.filter((p) => p.origin === "loan").forEach((p) => settleLoanIn(p));
}
// ---- Modal de configuração (duração / % salário / cláusula) ----
let LOAN_CTX = null;
function resetLoanForm(suggestedValue) {
  document.getElementById("loanDurationSelect").value = "temporada";
  document.getElementById("loanWagePctSelect").value = "50";
  document.getElementById("loanBuyClauseSelect").value = "nenhuma";
  document.getElementById("loanBuyValueInput").value = suggestedValue || 0;
  document.getElementById("loanBuyValueField").classList.add("hidden");
}
function openLoanOutModal(id) {
  if (!transferWindowStatus(CAREER.currentRound).open) {
    toast("Janela de contratações encerrada — não dá pra negociar empréstimo agora.");
    return;
  }
  const p = CAREER.squad.find((x) => x.id === id);
  if (!p) return;
  if (p.origin !== "principal") { toast("Só dá pra emprestar jogador do elenco principal."); return; }
  const principalCount = CAREER.squad.filter((x) => x.origin === "principal").length;
  if (principalCount <= 14) { toast("O elenco principal não pode ficar com menos de 14 jogadores."); return; }
  LOAN_CTX = { direction: "out", playerId: id };
  document.getElementById("loanTitle").textContent = "Emprestar jogador";
  document.getElementById("loanSub").textContent = `${abbreviateName(p.name)} · valor de mercado ${fmtBRL(p.value)}`;
  document.getElementById("loanWagePctField").classList.add("hidden");
  resetLoanForm(p.value);
  document.getElementById("loanOverlay").classList.add("open");
}
function openLoanInModal(clubId, playerId) {
  if (!transferWindowStatus(CAREER.currentRound).open) {
    toast("Janela de contratações encerrada — não dá pra pegar jogador emprestado agora.");
    return;
  }
  const p = leagueSquadFor(clubId).find((x) => x.id === playerId);
  if (!p) return;
  LOAN_CTX = { direction: "in", playerId, clubId: String(clubId) };
  document.getElementById("loanTitle").textContent = "Pegar jogador emprestado";
  document.getElementById("loanSub").textContent = `${abbreviateName(p.name)} · ${teamById(clubId).name} · salário cheio ${fmtBRL(p.wage)}/mês`;
  document.getElementById("loanWagePctField").classList.remove("hidden");
  resetLoanForm(p.value);
  document.getElementById("loanOverlay").classList.add("open");
}
function closeLoanModal() {
  document.getElementById("loanOverlay").classList.remove("open");
  LOAN_CTX = null;
}
async function confirmLoanFromModal() {
  if (!LOAN_CTX) return;
  const durationSel = document.getElementById("loanDurationSelect").value;
  const buyClause = document.getElementById("loanBuyClauseSelect").value;
  const buyValue = Math.max(0, Math.round(Number(document.getElementById("loanBuyValueInput").value) || 0));
  const buyOption = buyClause === "nenhuma" ? null : { mandatory: buyClause === "obrigatoria", value: buyValue };
  const returnRound = durationSel === "meia" ? Math.min(CAREER.currentRound + LOAN_HALF_SEASON_ROUNDS, 38) : null;
  let ok;
  if (LOAN_CTX.direction === "out") {
    ok = await finalizeLoanOut(LOAN_CTX.playerId, { returnRound, buyOption });
  } else {
    const wagePct = Number(document.getElementById("loanWagePctSelect").value) || 50;
    ok = await finalizeLoanIn(LOAN_CTX.clubId, LOAN_CTX.playerId, { returnRound, buyOption, wagePct });
  }
  if (!ok) return; // mantém o modal aberto pra ajustar
  closeLoanModal();
  if (document.getElementById("detailOverlay").classList.contains("open")) document.getElementById("detailOverlay").classList.remove("open");
  persistCareer();
  renderMercado(); renderElenco(); renderCentral();
}
async function finalizeLoanOut(id, { returnRound, buyOption }) {
  const p = CAREER.squad.find((x) => x.id === id);
  if (!p) return false;
  const buyer = findInterestedBuyer(CAREER.clubId);
  if (!buyer) {
    toast(`Nenhum time demonstrou interesse em pegar ${abbreviateName(p.name)} emprestado agora.`);
    return false;
  }
  CAREER.squad = CAREER.squad.filter((x) => x.id !== id);
  CAREER.lineup.starters = CAREER.lineup.starters.map((x) => (x === id ? null : x));
  CAREER.lineup.bench = CAREER.lineup.bench.filter((x) => x !== id);
  p.onLoanFromClubId = CAREER.clubId;
  p.loanReturnRound = returnRound;
  p.loanBuyOption = buyOption;
  (CAREER.leagueSquads[String(buyer.id)] = CAREER.leagueSquads[String(buyer.id)] || []).push(p);
  // Taxa de empréstimo — bem menor que uma venda de verdade (10% do
  // valor de mercado; metade disso se for só por 6 meses).
  const fee = Math.round((p.value * 0.10 * (returnRound ? 0.5 : 1)) / 1000) * 1000;
  CAREER.finances.cash += fee;
  const durationLabel = returnRound ? "por 6 meses" : "até o fim da temporada";
  const clauseLabel = buyOption ? (buyOption.mandatory ? ` (compra obrigatória de ${fmtBRL(buyOption.value)} ao fim)` : ` (opção de compra de ${fmtBRL(buyOption.value)} ao fim)`) : "";
  pushTransferLog(`Você emprestou ${p.name} pro ${buyer.name} ${durationLabel} por ${fmtBRL(fee)}${clauseLabel}.`, CAREER.currentRound);
  toast(`${abbreviateName(p.name)} emprestado por ${fmtBRL(fee)}.`);
  return true;
}
async function finalizeLoanIn(clubId, playerId, { returnRound, buyOption, wagePct }) {
  const squad = leagueSquadFor(clubId);
  const idx = squad.findIndex((x) => x.id === playerId);
  if (idx < 0) return false;
  const p = squad[idx];
  const loanWage = Math.round((p.wage * (wagePct / 100)) / 100) * 100;
  if (wageBillOf(CAREER.squad) + loanWage > CAREER.finances.wageCap) {
    toast(`Pegar esse jogador emprestado estouraria o teto salarial (${fmtBRL(CAREER.finances.wageCap)}).`);
    return false;
  }
  if (CAREER.squad.length >= MAX_PRINCIPAL + 20) { toast("Elenco já está muito grande — dispense ou negocie alguém antes."); return false; }
  squad.splice(idx, 1);
  p.loanFromClubId = String(clubId);
  p.loanOriginalWage = p.wage;
  p.wage = loanWage;
  p.origin = "loan";
  p.loanReturnRound = returnRound;
  p.loanBuyOption = buyOption;
  CAREER.squad.push(p);
  const durationLabel = returnRound ? "por 6 meses" : "até o fim da temporada";
  const clauseLabel = buyOption ? (buyOption.mandatory ? `, com compra obrigatória de ${fmtBRL(buyOption.value)} ao fim` : `, com opção de compra de ${fmtBRL(buyOption.value)} ao fim`) : "";
  pushTransferLog(`Você pegou ${p.name} emprestado do ${teamById(clubId).name} ${durationLabel} (${wagePct}% do salário)${clauseLabel}.`, CAREER.currentRound);
  toast(`${abbreviateName(p.name)} chegou emprestado!`);
  return true;
}
// 0 a 2 transferências entre times CPU por rodada (chance decrescente
// — a maioria das rodadas não tem nenhuma, imitando janela de
// transferência esporádica em vez de mercado aberto toda hora).
function simulateAiTransfers(round) {
  let count = 0;
  if (Math.random() < 0.35) count = 1;
  if (Math.random() < 0.08) count = 2;
  for (let i = 0; i < count; i++) {
    const fromClub = pickRandomOtherClub(CAREER.clubId);
    if (!fromClub) continue;
    const fromSquad = leagueSquadFor(fromClub.id);
    if (fromSquad.length <= MIN_LEAGUE_SQUAD) continue; // não esvazia um elenco CPU
    const toClub = pickRandomOtherClub(fromClub.id);
    if (!toClub || String(toClub.id) === String(CAREER.clubId)) continue; // negociação CPU x CPU só, não mexe no SEU elenco sem sua ação
    const idx = Math.floor(Math.random() * fromSquad.length);
    const [player] = fromSquad.splice(idx, 1);
    (CAREER.leagueSquads[String(toClub.id)] = CAREER.leagueSquads[String(toClub.id)] || []).push(player);
    pushTransferLog(`${toClub.name} contratou ${player.name} (${SUBPOS_LABEL[subPositionOf(player)]}) do ${fromClub.name} por ${fmtBRL(player.value)}.`, round);
  }
}
// De vez em quando (e só se não tiver proposta pendente ainda) um time
// CPU oferece pra comprar um jogador SEU — usuário decide aceitar ou
// recusar (ver acceptOffer/declineOffer). Nunca deixa o elenco
// principal cair abaixo do mínimo jogável (mesma trava de "release").
function maybeGenerateOffer(round) {
  if (CAREER.pendingOffer) return; // só 1 proposta pendente por vez
  if (Math.random() >= 0.18) return;
  const principal = CAREER.squad.filter((p) => p.origin === "principal");
  if (principal.length <= 14) return;
  const player = principal[Math.floor(Math.random() * principal.length)];
  const club = pickRandomOtherClub(CAREER.clubId);
  if (!club) return;
  const fee = Math.round(player.value * (0.85 + Math.random() * 0.4) / 1000) * 1000;
  CAREER.pendingOffer = { playerId: player.id, playerName: player.name, clubId: String(club.id), clubName: club.name, fee, round };
}

/* ---------- Escalação automática (usada ao criar a carreira, e
   reaproveitada pelo botão "🔁 escalar automaticamente" da Escalação —
   ver autoFillLineup) ----------
   includeBase (default true, pra não mudar o comportamento de sempre
   na criação da carreira — ali o elenco principal pode genuinamente
   vir curto nalguma posição, e cair pra base é uma rede de segurança
   de verdade) — pedido do usuário: toggle discreto na Escalação pra
   NÃO considerar a base ao reescalar manualmente (o normal é o
   treinador querer só o elenco "de verdade" ali, ver
   autoLineupIncludeBase em carreira.html). */
function autoLineup(squad, formation, includeBase = true) {
  const slots = FORMATIONS[formation];
  const eligible = squad.filter((p) => p.status === "ok" && (includeBase || p.origin !== "base"));
  // "loan" conta junto com "principal" aqui — jogador emprestado é
  // força de verdade do seu elenco enquanto estiver com você (mesmo
  // critério de sempre, ver computeHumanStrength/wageBillOf). Na
  // criação da carreira isso não muda nada (squad novo nunca tem
  // "loan" ainda).
  const principalPool = eligible.filter((p) => p.origin === "principal" || p.origin === "loan").sort((a, b) => b.overall - a.overall);
  const fullPool = eligible.sort((a, b) => b.overall - a.overall);
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
  const bench = principalPool.filter((p) => !used.has(p.id)).slice(0, MAX_BENCH).map((p) => p.id);
  return { formation, starters, bench, tactics: { mentality: "equilibrada", marking: "zona", tempo: "normal" } };
}

/* ---------- Persistência ---------- */
async function persistCareer() {
  if (!CAREER) return false;
  CAREER.updatedAt = Date.now();
  try {
    await fetchJSON("/api/career", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(CAREER) });
    return true;
  } catch (err) {
    // BUG CORRIGIDO: qualquer falha (sessão expirada, save grande
    // demais, rede) caía nessa mesma mensagem genérica de "tente de
    // novo em instantes" — mas sessão expirada NUNCA se resolve
    // tentando de novo, só logando de novo (relato real do usuário:
    // erro ao simular rodada, sem conseguir salvar mais nada depois).
    // Loga o motivo real no console pra dar pra investigar sem precisar
    // acesso ao servidor, e distingue sessão expirada do resto.
    console.error("[carreira] falha ao salvar progresso:", err.status, err.message);
    if (err.status === 401) {
      toast("Sua sessão expirou — faça login de novo pra continuar salvando.");
      show("screenLoginRequired");
    } else if (err.status === 413) {
      toast("O save dessa carreira ficou grande demais — reinicie a carreira pra continuar salvando.");
    } else {
      // Código/motivo aparecem no toast de propósito (mesmo sendo mais
      // "técnico" do que o ideal pro usuário final): sem acesso aos
      // logs do servidor daqui, é a forma mais rápida de descobrir a
      // causa real de um erro que não é nem sessão expirada nem save
      // grande demais — quem estiver vendo isso pode repassar o texto.
      const detail = err.status ? `erro ${err.status}${err.message ? " — " + err.message : ""}` : (err.message || "sem conexão com o servidor");
      toast(`Não deu pra salvar o progresso agora (${detail}) — tente de novo em instantes.`);
    }
    return false;
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
    const [squad, leagueSquads] = await Promise.all([buildSquad(club), buildLeagueSquads(club.id)]);
    const formation = "4-3-3";
    const lineup = autoLineup(squad, formation);
    const schedule = generateAllRounds(LEAGUE_TEAMS.map((t) => t.id)); // global de js/data.js
    const standings = {};
    LEAGUE_TEAMS.forEach((t) => { standings[t.id] = { id: t.id, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0, pts: 0 }; });
    CAREER = {
      version: 1,
      // BUG CORRIGIDO ("erro 400 — Formato de save inválido." toda vez
      // que tentava salvar, só em produção com dados reais, nunca no
      // Modo Exemplo): careerStore.js exige typeof clubId === "string"
      // (server/src/careerStore.js, isValidCareerShape). Com dados
      // reais (API-Sports/Sportmonks), club.id vem NÚMERO puro da API —
      // no Modo Exemplo os ids já são string ("fla", "pal"...), por
      // isso nunca reproduzia testando aqui. String() garante o mesmo
      // formato nos dois casos (o resto do código já compara clubId com
      // String() dos dois lados em todo lugar, então não muda nada além
      // de deixar de quebrar o save).
      clubId: String(club.id), clubName: club.name, clubShort: club.short || club.name.slice(0, 3).toUpperCase(),
      clubLogo: club.logo || null, clubColors: { c1: club.c1, c2: club.c2, c3: club.c3 },
      liveMode: LIVE_MODE, createdAt: Date.now(), updatedAt: Date.now(),
      squad, lineup, trainingFocus: "equilibrado", leagueSquads,
      schedule, currentRound: 1, standings, resultsByRound: {},
      // Agregado da temporada pra aba Estatísticas (gols já vêm de
      // standings[clubId].gp, não precisa duplicar aqui).
      teamStats: { assists: 0, yellow: 0, red: 0 },
      // FASE 2 (b) — pedido do usuário: contrato/salário/valor com
      // orçamento real limitando ação (ver initialFinances/wageBillOf).
      finances: initialFinances(squad),
      // FASE 2 (c) — mercado de transferências (ver simulateAiTransfers/
      // maybeGenerateOffer/pushTransferLog).
      transferLog: [], pendingOffer: null,
      // FASE 3 (a) — diretoria (ver askBoard/evaluateBoardRequest).
      lastBoardRequestRound: null, boardDecision: "",
      // FASE 3 (b) — forma recente pro público do estádio (ver
      // pushRecentForm/currentAttendancePct).
      recentForm: [],
      // FASE 3 (c) — multitemporadas (ver advanceSeason). seasonYear
      // começa em LIVE_SEASON (a temporada real dos dados) e só sobe
      // quando VOCÊ avança de temporada — LIVE_SEASON em si é fixo.
      seasonYear: LIVE_SEASON, seasonHistory: [],
    };
    // FASE 1 (item 3) — meta da diretoria da 1ª temporada, calculada
    // já com o elenco recém-montado (ver computeBoardGoal).
    CAREER.boardGoal = computeBoardGoal();
    CAREER.negativeSeasonsStreak = 0;
    // FASE 2 (a) — chaveamento da Copa do Brasil da 1ª temporada.
    setupCup();
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
      // Pedido do usuário: retorno de lesão baixa a condição (o
      // jogador não está com ritmo de jogo, mesmo tendo passado a
      // lesão toda descansando — ver INJURY_RETURN_CONDITION). Só
      // lesão, não suspensão — suspenso treinava normal, só não podia
      // entrar em campo.
      if (p.status === "contundido") {
        const cap = INJURY_RETURN_CONDITION[p.injurySeverity] ?? 60;
        p.condition = Math.min(p.condition == null ? 100 : p.condition, cap);
      }
      p.status = "ok"; p.outUntilRound = null; p.injurySeverity = null;
    }
  });
}
// Devolve a lista de trocas forçadas (texto curto, já com nome
// abreviado) — mostrada no modal de resultados da rodada (ver
// showRoundResultsModal) em vez de um feed de notícias separado.
function autoFixLineup(round) {
  const changes = [];
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
      if (p) changes.push(`${abbreviateName(repl.name)} entra no time titular no lugar de ${abbreviateName(p.name)} (indisponível)`);
      return repl.id;
    }
    return null;
  });
  return changes;
}

/* ---------- Força do time (escalação → ataque/defesa efetivos) ---------- */
function computeHumanStrength(club) {
  // "loan" conta junto com "principal" aqui — jogador emprestado é
  // força de verdade do seu elenco enquanto estiver com você (mesmo
  // critério de wageBillOf).
  const principal = CAREER.squad.filter((p) => p.origin === "principal" || p.origin === "loan");
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

/* ---------- FASE 3 (item 4 da especificação "BR Data Treinador") —
   evolução de atributos por treino ----------
   Investigando a especificação, o "foco de treino" JÁ EXISTIA no jogo
   (CAREER.trainingFocus/TRAINING_OPTIONS/TRAINING_MOD acima, escolhido
   na aba Escalação) — só que só valia como bônus de CURTO prazo (multi-
   plicador de ataque/defesa durante a própria partida, ver
   computeHumanStrength). O que faltava de verdade era o efeito de
   LONGO prazo pedido aqui: atributo (Geral/Ataque/Defesa/Físico)
   subindo ou caindo aos poucos, rodada a rodada, com jovem evoluindo
   mais fácil e veterano regredindo — sem precisar de aba nova, o
   mesmo seletor de sempre passou a valer pros dois efeitos (ver aviso
   em carreira.html).

   Decisões nossas pros pontos deixados em aberto na especificação:
   - Efeito PROBABILÍSTICO (chance de ±1 no atributo por rodada), não
     fração de ponto acumulada — mais simples de mostrar (atributo
     sempre inteiro) e já dá o efeito "pequeno, só percebido depois de
     várias rodadas" pedido.
   - Declínio por idade começa aos 30 pra linha/aos 32 pro goleiro
     (goleiro segura o auge mais tarde, igual no futebol de verdade).
   - Cada um dos 4 atributos (overall/atk/def/phys) rola INDEPENDENTE
     — o foco escolhido dobra a chance de crescimento só do atributo
     compatível (ver TRAINING_FOCUS_ATTR), os outros 3 seguem no ritmo
     normal. Evita reescrever atk/def como derivados do overall (eles
     nascem com pesos por posição diferentes, ver buildRealPlayer) só
     pra fazer a evolução funcionar.

   Só evolui CAREER.squad (seu elenco) — time CPU não precisa, o
   elenco deles já se renova por sorteio inteiro na virada de temporada
   (ver renewLeagueSquad). Chamado 1x por rodada simulada, só quando
   seu clube jogou (ver simulateRound), passando quem foi titular
   NESSA rodada (banco/lesionado tem mais chance de estagnar/regredir
   que evoluir). */
const TRAINING_FOCUS_ATTR = { ataque: "atk", defesa: "def", fisico: "phys", equilibrado: "overall" };
function applyTrainingEvolution(playedThisRound) {
  const playedIds = new Set((playedThisRound || []).map((p) => p.id));
  const focusAttr = TRAINING_FOCUS_ATTR[CAREER.trainingFocus] || null;
  CAREER.squad.forEach((p) => {
    const played = playedIds.has(p.id);
    const declineAge = p.group === "G" ? 32 : 30;
    let growChance, declineChance;
    if (p.age <= 21) { growChance = played ? 0.14 : 0.05; declineChance = 0; }
    else if (p.age < declineAge) { growChance = played ? 0.06 : 0.01; declineChance = played ? 0 : 0.01; }
    else { growChance = played ? 0.02 : 0; declineChance = (played ? 0.05 : 0.08) + (p.age - declineAge) * 0.01; }
    const trend = p.attrTrend || { overall: 0, atk: 0, def: 0, phys: 0 };
    ["overall", "atk", "def", "phys"].forEach((attr) => {
      const attrGrowChance = growChance * (attr === focusAttr ? 2 : 1);
      const roll = Math.random();
      if (roll < attrGrowChance) { p[attr] = clamp(p[attr] + 1, 20, 99); trend[attr] += 1; }
      else if (roll > 1 - declineChance) { p[attr] = clamp(p[attr] - 1, 20, 99); trend[attr] -= 1; }
    });
    // Acumula até o jogador ser aberto no detalhe de novo (ver
    // openDetail, que lê isso pro indicador ↑/↓ e zera em seguida —
    // "desde a última checagem", pedido da especificação).
    p.attrTrend = trend;
  });
}

/* ---------- FASE 1 (item 4 da especificação "BR Data Treinador") —
   lesões reais ----------
   Pedido do usuário: card "Situação do elenco" mostrava "0
   CONTUNDIDOS" fixo. Investigando o motor de simulação (mais abaixo,
   simulatePlayerEvents), a geração de lesão em si JÁ EXISTIA — todo
   titular já tinha uma chance por partida de virar "contundido" por
   algumas rodadas, o KPI da Central já contava esse número de verdade
   (não fixo), o jogador lesionado já ficava de fora do "Escolher
   jogador" da Escalação (ver renderPickerList) e já aparecia com badge
   vermelho + prazo de volta na lista do Elenco (ver playerRow) — o "0"
   que o usuário via era só o estado normal de INÍCIO de temporada,
   antes de qualquer rodada simulada.
   O que faltava de verdade, comparando com a especificação:
   1) a chance não variava por físico/condição do jogador — um titular
      exausto corria o MESMO risco que um recém-descansado (documento:
      "ajustável por atributo físico — quanto menor Resistência/
      Condição, maior risco"), ver injuryChanceFor;
   2) toda lesão durava só 1 a 4 rodadas, sem variedade de gravidade —
      a especificação pede 3 níveis com distribuição 70/25/5 leve/
      média/grave (o jogo não tem "dias", só rodada — mesma adaptação
      já usada em contrato/janela de transferência, ver comentários
      lá), ver INJURY_SEVERITY/rollInjurySeverity. */
const INJURY_SEVERITY = [
  { type: "leve", label: "Leve", chance: 0.70, minRounds: 1, maxRounds: 3 },
  { type: "media", label: "Média", chance: 0.25, minRounds: 4, maxRounds: 7 },
  { type: "grave", label: "Grave", chance: 0.05, minRounds: 8, maxRounds: 14 },
];
function injurySeverityLabel(type) {
  return (INJURY_SEVERITY.find((t) => t.type === type) || INJURY_SEVERITY[0]).label;
}
// Pedido do usuário: retorno de lesão baixa a condição — quanto mais
// grave, mais longe da forma plena o jogador volta (ver
// refreshAvailability, que aplica isso na transição contundido -> ok).
const INJURY_RETURN_CONDITION = { leve: 75, media: 60, grave: 45 };
// Pedido do usuário: "condição pode ser uma nota de 01 a 05" em vez da
// barra de porcentagem de sempre — mantém p.condition (0-100) como o
// número de VERDADE usado na simulação (computeHumanStrength, chance
// de lesão, etc.), só a EXIBIÇÃO virou essa nota derivada.
function conditionRating(condition) {
  const c = condition == null ? 100 : condition;
  if (c >= 90) return 5;
  if (c >= 70) return 4;
  if (c >= 50) return 3;
  if (c >= 30) return 2;
  return 1;
}
const CONDITION_RATING_LABEL = { 5: "Ótima", 4: "Boa", 3: "Regular", 2: "Baixa", 1: "Péssima" };
function conditionDotsHTML(condition) {
  const rating = conditionRating(condition);
  const cls = rating >= 4 ? "good" : rating === 3 ? "mid" : "low";
  let dots = "";
  for (let i = 1; i <= 5; i++) dots += `<span class="ct-cond-dot${i <= rating ? ` ${cls}` : ""}"></span>`;
  return `<span class="ct-cond-dots" title="Condição: nota ${rating}/5 (${CONDITION_RATING_LABEL[rating]})">${dots}</span>`;
}
function rollInjurySeverity() {
  const roll = Math.random();
  let acc = 0;
  for (const tier of INJURY_SEVERITY) {
    acc += tier.chance;
    if (roll < acc) return tier;
  }
  return INJURY_SEVERITY[0];
}
// Base 2% (documento sugere a faixa "2-4%") + até mais 2% pra quem tem
// físico baixo ou já está com a condição debilitada (fadiga acumulada
// de partidas anteriores — ver ordem das operações em
// simulatePlayerEvents: essa checagem roda ANTES da fadiga DESSA
// partida ser aplicada, então reflete o desgaste que o jogador já
// carregava chegando no jogo, não o desse jogo em si).
function injuryChanceFor(p) {
  const physFactor = clamp((70 - (p.phys || 70)) / 100, 0, 0.3);
  const condFactor = clamp((70 - (p.condition == null ? 100 : p.condition)) / 100, 0, 0.3);
  return clamp(0.02 + physFactor * 0.02 + condFactor * 0.02, 0.02, 0.04);
}
/* ---------- Eventos de jogo (gols/assistências/cartões/lesões) pros
   SEUS jogadores — devolve uma lista estruturada (não texto pronto),
   usada pelo modal de detalhe do jogo (ver matchEventsSummaryHTML) e
   pela Central ("Resultado da última rodada"). Lesão continua afetando
   o jogador (status/outUntilRound) mas não entra na lista — pedido do
   usuário listou só gol/cartão/assistência.

   FASE 3 (itens 1 e 2 da especificação "BR Data Treinador") — tela
   "Ao Vivo": pra dar pra progredir a SUA partida em pedaços (ver
   LIVE_MATCH_CHUNK_MINUTES/resolveLiveChunk mais abaixo) e ainda
   assim manter CPU x CPU resolvendo tudo de uma vez só (como sempre),
   esta função foi separada em duas metades reaproveitáveis:
   attributeGoals (só artilheiro/assistência, chamável várias vezes
   com goals menor por chamada) e applyMatchWearChunk (cartão/lesão/
   condição/jogos, agora aceitando uma FRAÇÃO da partida — 1 = partida
   inteira, mantendo o comportamento de sempre pro caminho antigo
   abaixo). simulatePlayerEvents continua existindo com a MESMA
   assinatura/comportamento de antes (chunkShare implícito = 1) — CPU x
   CPU e o fallback de rodada sem jogo seu (resolveCpuFixture) não
   mudam em nada. */
function attributeGoals(starters, goals) {
  const events = [];
  if (!starters || !starters.length || !goals) return events;
  // FASE 2 (b) — moral pesa no sorteio (ver moraleFactor); factor 1
  // pra quem nunca teve moral mexida (CPU/moral neutra), não muda nada.
  const atkWeights = starters.map((p) => ({ F: 4, M: 2, D: 0.6, G: 0.02 }[p.group] || 1) * moraleFactor(p));
  for (let i = 0; i < goals; i++) {
    const scorer = weightedPick(starters, atkWeights);
    scorer.goalsCareer = (scorer.goalsCareer || 0) + 1;
    events.push({ type: "gol", player: scorer.name });
    // ~72% dos gols saem com assistência de um companheiro (nunca o
    // próprio artilheiro) — meio-campista pesa mais no sorteio, mas
    // qualquer titular pode ter dado o passe.
    if (starters.length > 1 && Math.random() < 0.72) {
      const assistPool = starters.filter((p) => p.id !== scorer.id);
      const assistWeights = assistPool.map((p) => ({ M: 3, F: 1.5, D: 0.8, G: 0.05 }[p.group] || 1) * moraleFactor(p));
      const assister = weightedPick(assistPool, assistWeights);
      assister.assistsCareer = (assister.assistsCareer || 0) + 1;
      events.push({ type: "assistencia", player: assister.name });
    }
  }
  return events;
}
// chunkShare = fração da partida coberta por essa chamada (1 = jogo
// inteiro, comportamento de sempre). Cartão/lesão escalam linearmente
// pela fração (números pequenos, erro de composição desprezível);
// "apps" só soma uma vez por partida mesmo com várias chamadas — usa
// appearedSet (compartilhado entre AMBOS os lados da partida) pra
// saber se é a primeira vez que esse jogador é visto nessa partida.
function applyMatchWearChunk(starters, round, chunkShare, appearedSet) {
  const events = [];
  const redCardIds = [];
  if (!starters || !starters.length) return { events, redCardIds };
  starters.forEach((p) => {
    if (appearedSet && !appearedSet.has(p.id)) {
      p.apps = (p.apps || 0) + 1;
      appearedSet.add(p.id);
    }
    const roll = Math.random();
    if (roll < 0.012 * chunkShare) {
      p.status = "suspenso"; p.outUntilRound = round + 1; p.yellowCards = 0;
      events.push({ type: "vermelho", player: p.name });
      redCardIds.push(p.id);
    } else if (roll < 0.11 * chunkShare) {
      p.yellowCards = (p.yellowCards || 0) + 1;
      events.push({ type: "amarelo", player: p.name });
      if (p.yellowCards >= 3) {
        p.status = "suspenso"; p.outUntilRound = round + 1; p.yellowCards = 0;
        redCardIds.push(p.id);
      }
    }
    if (p.status === "ok" && Math.random() < injuryChanceFor(p) * chunkShare) {
      const severity = rollInjurySeverity();
      const dur = severity.minRounds + Math.floor(Math.random() * (severity.maxRounds - severity.minRounds + 1));
      p.status = "contundido"; p.outUntilRound = round + dur; p.injurySeverity = severity.type;
    }
    p.condition = clamp((p.condition == null ? 100 : p.condition) - (15 + Math.random() * 15) * chunkShare, 25, 100);
  });
  return { events, redCardIds };
}
function simulatePlayerEvents(starters, goals, round) {
  if (!starters || !starters.length) return [];
  const appeared = new Set(); // local — replica o "apps += 1 uma vez" de sempre numa chamada só
  const wear = applyMatchWearChunk(starters, round, 1, appeared);
  return [...attributeGoals(starters, goals), ...wear.events];
}
// Soma os eventos do jogo do clube pros KPIs da aba Estatísticas —
// gols de "minha equipe" já vêm de standings[clubId].gp (fonte única),
// então só assistência/cartão precisam de contador próprio aqui.
function tallyTeamStats(events) {
  if (!events || !events.length) return;
  if (!CAREER.teamStats) CAREER.teamStats = { assists: 0, yellow: 0, red: 0 };
  events.forEach((e) => {
    if (e.type === "assistencia") CAREER.teamStats.assists++;
    else if (e.type === "amarelo") CAREER.teamStats.yellow++;
    else if (e.type === "vermelho") CAREER.teamStats.red++;
  });
}
function applyConditionRecovery(starterIds) {
  const set = new Set(starterIds);
  const bonus = CAREER.trainingFocus === "fisico" ? 3 : 0;
  CAREER.squad.forEach((p) => {
    if (!set.has(p.id)) p.condition = clamp((p.condition == null ? 100 : p.condition) + (10 + Math.random() * 12) + bonus, 0, 100);
  });
}
// Classificação ordenada (mesmo critério de desempate de sempre:
// pontos, vitórias, saldo, gols pró) — extraído da Estatísticas
// (renderEstatisticas) pra reaproveitar na diretoria (Fase 3a, ver
// evaluateBoardRequest) sem duplicar o critério de ordenação.
function sortedStandings() {
  return Object.values(CAREER.standings).slice()
    .sort((a, b) => (b.pts - a.pts) || (b.v - a.v) || (b.sg - a.sg) || (b.gp - a.gp));
}
function myLeaguePosition() {
  return sortedStandings().findIndex((r) => String(r.id) === String(CAREER.clubId)) + 1;
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

// Resolve UMA partida CPU x CPU do zero, do sorteio de gols até
// aplicar tudo no estado (extraído de simulateRound pra reaproveitar
// tanto no fallback sem jogo seu quanto na tela Ao Vivo, que resolve
// as ~9 outras partidas da rodada instantaneamente enquanto só a SUA
// progride em tempos — ver startLiveMatch).
function resolveCpuFixture(fx, round) {
  const home = teamById(fx.home), away = teamById(fx.away);
  const hs = { atk: home.atk, def: home.def, starters: pickCpuXI(leagueSquadFor(fx.home)) };
  const as = { atk: away.atk, def: away.def, starters: pickCpuXI(leagueSquadFor(fx.away)) };
  const lambdaHome = clamp((hs.atk / as.def) * 1.12, 0.05, 6);
  const lambdaAway = clamp(as.atk / hs.def, 0.05, 6);
  const gh = poissonSample(lambdaHome, Math.random); // global de js/data.js
  const ga = poissonSample(lambdaAway, Math.random);
  // FASE 2 (a) — pedido do usuário: "estatísticas reais de todos os
  // times". Antes só o SEU time tinha elenco individual — o
  // adversário virava "Gol do <Time>" sem autor (ver histórico desse
  // comentário no git). Agora TODO clube tem elenco (ver
  // buildLeagueSquads/pickCpuXI), então toda partida da rodada —
  // não só a sua — credita gol/assistência/cartão a um jogador de
  // verdade, alimentando o ranking de artilheiros da competição
  // inteira (ver renderEstatisticas) mesmo em jogos CPU x CPU.
  const homeEvents = simulatePlayerEvents(hs.starters, gh, round);
  const awayEvents = simulatePlayerEvents(as.starters, ga, round);
  applyConditionRecovery(hs.starters.map((p) => p.id));
  applyConditionRecovery(as.starters.map((p) => p.id));
  const events = [...homeEvents, ...awayEvents];
  const result = { home: fx.home, away: fx.away, gh, ga };
  if (events.length) result.events = events;
  applyResultToStandings(result);
  (CAREER.resultsByRound[round] = CAREER.resultsByRound[round] || []).push(result);
  return result;
}
// Cauda comum de fim de rodada — roda IGUAL depois de uma rodada sem
// jogo seu (resolveRoundInstant) ou depois da SUA partida terminar na
// tela Ao Vivo (finishLiveMatch). Monta o summary estruturado de
// sempre (ver showMatchDetailModal/showRoundResultsModal).
function finishRoundTail(round, allResults, humanMatch) {
  // BUG CORRIGIDO: resultsByRound guardava o placar (e os eventos) de
  // TODOS os 380 jogos da temporada pra sempre, mas só a rodada
  // imediatamente anterior é lida em algum lugar (renderCentral, "Último
  // jogo"). Isso fazia o save crescer sem parar e, num relato real de
  // "não dá pra salvar o progresso" ao simular rodada, passar do limite
  // de 400KB do careerStore (server/src/careerStore.js) depois de
  // algumas dezenas de rodadas — daí em diante TODO PUT /api/career
  // falhava (413). Mantém só a rodada atual e a anterior.
  Object.keys(CAREER.resultsByRound).forEach((k) => {
    if (Number(k) < round - 1) delete CAREER.resultsByRound[k];
  });
  const nextRound = round + 1;
  refreshAvailability(nextRound);
  const lineupChanges = autoFixLineup(nextRound);
  CAREER.currentRound = nextRound;
  // FASE 3 (item 3) — empréstimo de 6 meses (loanReturnRound definido)
  // pode terminar NO MEIO da temporada — checa isso toda rodada, antes
  // do resto do fluxo (folha salarial, mercado) rodar com o elenco já
  // atualizado. Empréstimo de temporada inteira só resolve em
  // advanceSeason (ver resolveLoanReturns).
  checkMidSeasonLoanReturns(nextRound);
  // FASE 2 (b) — paga a folha salarial do elenco PRINCIPAL a cada
  // rodada simulada (aproximação: ~4 rodadas por mês numa temporada de
  // 38 rodadas, então 1/4 da folha mensal por rodada) — o caixa vai
  // diminuindo de verdade ao longo da temporada mesmo antes de existir
  // mercado de transferências (fase seguinte) pra gastar nele.
  const wagePaid = Math.round(wageBillOf(CAREER.squad) / 4);
  CAREER.finances.cash -= wagePaid;
  // FASE 2 (c) — mercado de transferências: os outros 19 times também
  // negociam entre si (ver simulateAiTransfers) e, de vez em quando,
  // um deles propõe comprar um jogador SEU (ver maybeGenerateOffer,
  // resolvido em Mercado com aceitar/recusar).
  // FASE 1 (item 2) — só roda dentro da janela de transferências (ver
  // transferWindowStatus): fora da janela o mercado inteiro esfria,
  // não só a sua ação de comprar — senão os outros 19 times
  // continuariam negociando por baixo dos panos, minando a mesma
  // tensão de prazo que a janela existe pra criar.
  if (transferWindowStatus(round).open) {
    simulateAiTransfers(round);
    maybeGenerateOffer(round);
  }
  // FASE 2 (a) — Copa do Brasil: só resolve alguma coisa nas 4 rodadas
  // certas (ver CUP_ROUNDS) e só se seu clube ainda estiver na
  // competição (resolveCupPhase devolve null em qualquer outro caso —
  // ver comentário lá).
  const cup = resolveCupPhase(round);
  return { round, humanMatch, allResults, lineupChanges, wagePaid, newOffer: CAREER.pendingOffer, cup };
}
// Fallback pra uma rodada em que o SEU clube não jogue (não deveria
// acontecer no returno completo de pontos corridos, mas o calendário é
// gerado à parte — ver generateAllRounds — então mantém esse caminho
// como rede de segurança em vez de assumir que sempre existe fixture
// sua).
function resolveRoundInstant(round, fixtures) {
  const allResults = fixtures.map((fx) => resolveCpuFixture(fx, round));
  return finishRoundTail(round, allResults, null);
}
/* ---------- Simular a rodada corrente ----------
   Devolve um resumo ESTRUTURADO (não mais um texto de toast pronto) —
   pedido do usuário: ao simular, mostrar um modal com o detalhe do
   JOGO do clube (resultado/gols/assistências/cartões — ver
   showMatchDetailModal), depois um modal com os RESULTADOS da rodada
   inteira (ver showRoundResultsModal), só então a Tabela atualizada.

   FASE 3 (itens 1 e 2 da especificação "BR Data Treinador") — quando
   existe jogo seu na rodada, em vez de resolver na hora, entra na tela
   "Ao Vivo" (ver startLiveMatch) — quem chamou recebe o sentinela
   "live" e NÃO deve tratar como summary pronto (ver wireStaticListeners,
   botão "Simular rodada"): o próprio fluxo Ao Vivo persiste/renderiza/
   mostra os modais de sempre quando a partida termina (ver
   finishLiveMatch). As outras ~9 partidas da rodada continuam
   resolvendo instantaneamente (ninguém teria interesse em vê-las ao
   vivo) — ver resolveCpuFixture, chamado de dentro de startLiveMatch. */
function simulateRound() {
  const round = CAREER.currentRound;
  if (round > 38) return null;
  const fixtures = CAREER.schedule[round] || [];
  const humanFx = fixtures.find((fx) => String(fx.home) === String(CAREER.clubId) || String(fx.away) === String(CAREER.clubId));
  if (!humanFx) return resolveRoundInstant(round, fixtures);
  startLiveMatch(round, fixtures, humanFx);
  return "live";
}

/* ---------- FASE 3 (itens 1 e 2 da especificação "BR Data Treinador")
   — tela "Ao Vivo": substituição e troca de tática NO MEIO do jogo
   ----------
   A partida do seu clube progride em 6 "tempos" de 15 minutos (ver
   LIVE_MATCH_CHUNK_MINUTES) em vez de ser sorteada inteira de uma vez
   — cada tempo some um pedaço proporcional do gol/cartão/lesão
   esperado pro jogo inteiro (ver applyMatchWearChunk/attributeGoals) e
   recalcula a força do SEU time do zero (computeHumanStrength lê
   CAREER.lineup/tactics AO VIVO), então uma substituição ou troca de
   tática feita entre um tempo e outro já vale a partir do próximo —
   exatamente o "afeta o cálculo da simulação daquele momento em
   diante" pedido na especificação. Entre os tempos, o motor agenda
   sozinho (setTimeout) o próximo — os botões de substituir/ajustar
   tática PAUSAM essa progressão até o sub-modal fechar.

   Decisões nossas pros pontos deixados em aberto na especificação:
   - 6 janelas de pausa por partida (a cada 15 minutos simulados) —
     dá pra reagir sem virar microgerenciamento minuto a minuto.
   - Custo de familiaridade ao trocar ESQUEMA no meio do jogo: -8% de
     ataque/defesa do SEU time nos 2 tempos seguintes à troca (ver
     formationPenaltyChunksLeft) — trocar só mentalidade/marcação/ritmo
     não tem esse custo (o time não precisa se re-posicionar em campo
     pra isso).
   - Expulsão (cartão vermelho direto ou 2º amarelo) libera 1
     substituição extra automática, somada à cota de 5 sem contar nela
     (ver subsBonus) — fica disponível, não é obrigatório usá-la.
   - Cartão/lesão/condição são resolvidos POR TEMPO (ver
     applyMatchWearChunk) pra aparecerem no feed ao vivo e pra a
     expulsão liberar a substituição extra na hora; já
     jogos/apps/desgaste de condição somam o mesmo total de sempre no
     fim da partida (só distribuído ao longo dos tempos, não dobrado).
   - Simplificação assumida: quem sai por substituição/lesão/expulsão
     não concorre mais a cartão/lesão nos tempos seguintes (realista —
     não está mais em campo); o "desgaste de fim de partida" (jogos
     computados) considera só quem esteve em campo em ALGUM tempo (ver
     appeared). */
const LIVE_MATCH_CHUNK_MINUTES = [15, 30, 45, 60, 75, 90];
const MAX_SUBS_PER_MATCH = 5;
const LIVE_TACTICS_FAMILIARITY_PENALTY_CHUNKS = 2;
let LIVE_MATCH = null; // estado transitório do jogo ao vivo — nunca persistido (não é parte de CAREER)
function startLiveMatch(round, fixtures, humanFx) {
  const isHome = String(humanFx.home) === String(CAREER.clubId);
  const home = teamById(humanFx.home), away = teamById(humanFx.away);
  const cpuTeamId = isHome ? humanFx.away : humanFx.home;
  // XI do adversário CPU sorteado uma vez só e mantido fixo a partida
  // inteira (pickCpuXI é determinístico pro squad atual — recalcular a
  // cada tempo só re-selecionaria o mesmo time mesmo, mas fixar deixa
  // a intenção clara: só o SEU lado pode mudar de gente em campo).
  const cpuXI = pickCpuXI(leagueSquadFor(cpuTeamId));
  const otherResults = fixtures.filter((fx) => fx !== humanFx).map((fx) => resolveCpuFixture(fx, round));
  LIVE_MATCH = {
    round, humanFx, isHome, home, away, cpuXI, otherResults,
    chunkIndex: 0, gh: 0, ga: 0, events: [], appeared: new Set(),
    subsUsed: 0, subsBonus: 0, formationPenaltyChunksLeft: 0,
    lastHsStarters: [], lastAsStarters: [],
    timerId: null, paused: false, finished: false,
  };
  renderLiveMatch();
  document.getElementById("liveMatchOverlay").classList.add("open");
  scheduleNextChunk();
}
function scheduleNextChunk() {
  const lm = LIVE_MATCH;
  if (!lm || lm.finished || lm.paused) return;
  lm.timerId = setTimeout(resolveLiveChunk, 900);
}
function pauseLiveMatch() {
  if (!LIVE_MATCH) return;
  LIVE_MATCH.paused = true;
  clearTimeout(LIVE_MATCH.timerId);
}
function resumeLiveMatch() {
  if (!LIVE_MATCH || LIVE_MATCH.finished) return;
  LIVE_MATCH.paused = false;
  scheduleNextChunk();
}
function resolveLiveChunk() {
  const lm = LIVE_MATCH;
  if (!lm || lm.finished) return;
  const round = lm.round;
  const prevMinute = lm.chunkIndex === 0 ? 0 : LIVE_MATCH_CHUNK_MINUTES[lm.chunkIndex - 1];
  const minute = LIVE_MATCH_CHUNK_MINUTES[lm.chunkIndex];
  const chunkShare = (minute - prevMinute) / 90;
  // computeHumanStrength lê CAREER.lineup/tactics NA HORA — é por isso
  // que uma substituição/troca de tática feita na pausa já entra em
  // vigor no próximo tempo sem precisar de nenhum código extra aqui.
  const hs = lm.isHome ? computeHumanStrength(lm.home) : { atk: lm.home.atk, def: lm.home.def, starters: lm.cpuXI };
  const as = lm.isHome ? { atk: lm.away.atk, def: lm.away.def, starters: lm.cpuXI } : computeHumanStrength(lm.away);
  const humanSide = lm.isHome ? hs : as;
  if (lm.formationPenaltyChunksLeft > 0) {
    humanSide.atk *= 0.92; humanSide.def *= 0.92;
    lm.formationPenaltyChunksLeft--;
  }
  const lambdaHome = clamp((hs.atk / as.def) * 1.12, 0.05, 6) * chunkShare;
  const lambdaAway = clamp(as.atk / hs.def, 0.05, 6) * chunkShare;
  const ghChunk = poissonSample(lambdaHome, Math.random);
  const gaChunk = poissonSample(lambdaAway, Math.random);
  const wearHome = applyMatchWearChunk(hs.starters, round, chunkShare, lm.appeared);
  const wearAway = applyMatchWearChunk(as.starters, round, chunkShare, lm.appeared);
  const myRedIds = lm.isHome ? wearHome.redCardIds : wearAway.redCardIds;
  if (myRedIds.length) lm.subsBonus += myRedIds.length;
  lm.gh += ghChunk; lm.ga += gaChunk;
  const chunkEvents = [
    ...attributeGoals(hs.starters, ghChunk).map((e) => ({ ...e, mine: lm.isHome })),
    ...attributeGoals(as.starters, gaChunk).map((e) => ({ ...e, mine: !lm.isHome })),
    ...wearHome.events.map((e) => ({ ...e, mine: lm.isHome })),
    ...wearAway.events.map((e) => ({ ...e, mine: !lm.isHome })),
  ].map((e) => ({ ...e, minute }));
  lm.events.push(...chunkEvents);
  lm.lastHsStarters = hs.starters; lm.lastAsStarters = as.starters;
  lm.chunkIndex++;
  renderLiveMatch();
  if (lm.chunkIndex >= LIVE_MATCH_CHUNK_MINUTES.length) {
    // "⏩ Pular pro fim" (ver skipLiveMatch) não espera o delay de
    // sempre — quem não quer acompanhar minuto a minuto não devia ficar
    // preso a ele.
    if (lm.skipping) finishLiveMatch(); else setTimeout(finishLiveMatch, 500);
  } else if (!lm.skipping) {
    scheduleNextChunk();
  }
}
// Pedido nosso, não da especificação: sem isso, CADA rodada simulada
// custaria ~6s de espera real (6 tempos x 900ms) mesmo pra quem só
// quer avançar a temporada sem interagir — o mesmo problema que fazia
// sentido evitar antes de existir Ao Vivo nenhum. Resolve todo mundo
// que falta de uma vez, sem os delays entre tempos.
function skipLiveMatch() {
  const lm = LIVE_MATCH;
  if (!lm || lm.finished) return;
  clearTimeout(lm.timerId);
  lm.paused = false;
  lm.skipping = true;
  while (lm.chunkIndex < LIVE_MATCH_CHUNK_MINUTES.length && !lm.finished) resolveLiveChunk();
}
async function finishLiveMatch() {
  const lm = LIVE_MATCH;
  lm.finished = true;
  const result = { home: lm.humanFx.home, away: lm.humanFx.away, gh: lm.gh, ga: lm.ga };
  // "substituicao" só existe pro feed AO VIVO (ver liveEventLabel) —
  // igual lesão (ver comentário no topo de applyMatchWearChunk), o
  // modal de detalhe do jogo de sempre (matchEventsSummaryHTML) só
  // lista gol/cartão/assistência.
  const summaryEvents = lm.events.filter((e) => e.type !== "substituicao");
  if (summaryEvents.length) result.events = summaryEvents;
  applyResultToStandings(result);
  (CAREER.resultsByRound[lm.round] = CAREER.resultsByRound[lm.round] || []).push(result);
  // "Minha equipe" nas Estatísticas só soma o SEU lado, mesmo critério
  // de sempre (ver tallyTeamStats/resolveCpuFixture) — filtra pelos
  // eventos marcados "mine" durante os tempos (ver resolveLiveChunk).
  tallyTeamStats(lm.events.filter((e) => e.mine));
  // Quem nunca apareceu em nenhum tempo (reserva que ficou fora)
  // recupera condição no fim da partida, mesmo critério de sempre (ver
  // applyConditionRecovery) — só uma chamada (não uma por tempo) pra
  // não multiplicar a recuperação por 6.
  applyConditionRecovery(Array.from(lm.appeared));
  let ticketRevenue = null;
  if (lm.isHome) {
    ticketRevenue = computeTicketRevenue(lm.home);
    CAREER.finances.cash += ticketRevenue.revenue;
  }
  const humanMatch = { ...result, isHome: lm.isHome, ticketRevenue };
  const myGoals = lm.isHome ? lm.gh : lm.ga, oppGoals = lm.isHome ? lm.ga : lm.gh;
  pushRecentForm(myGoals > oppGoals ? 3 : myGoals === oppGoals ? 1 : 0);
  applyMoraleAfterMatch(myGoals, oppGoals);
  // FASE 3 (item 4) — evolução por treino considera quem terminou a
  // partida em campo do seu lado (após eventuais substituições).
  applyTrainingEvolution(lm.isHome ? lm.lastHsStarters : lm.lastAsStarters);
  const allResults = [...lm.otherResults, result];
  const summary = finishRoundTail(lm.round, allResults, humanMatch);
  document.getElementById("liveMatchOverlay").classList.remove("open");
  LIVE_MATCH = null;
  const saved = await persistCareer();
  const btn = document.getElementById("btnSimulate");
  if (!saved) { if (btn) btn.disabled = false; return; }
  renderAll();
  showMatchDetailModal(summary);
}
function liveEventLabel(e) {
  if (e.type === "gol") return `⚽ Gol${e.mine === false ? " do adversário" : ""} — ${escapeHtml(e.player)}`;
  if (e.type === "assistencia") return `🅰️ Assistência de ${escapeHtml(e.player)}`;
  if (e.type === "amarelo") return `🟨 Cartão amarelo — ${escapeHtml(e.player)}`;
  if (e.type === "vermelho") return `🟥 Expulsão — ${escapeHtml(e.player)}`;
  if (e.type === "substituicao") return `🔄 ${escapeHtml(e.entra)} entra no lugar de ${escapeHtml(e.saiu)}`;
  return "";
}
function renderLiveMatch() {
  const lm = LIVE_MATCH;
  if (!lm) return;
  document.getElementById("liveMatchScore").innerHTML = `
    <div class="side">${crestImg(lm.home)}<span class="n">${escapeHtml(lm.home.name)}</span></div>
    <span class="vs" style="font-size:22px;">${lm.gh} × ${lm.ga}</span>
    <div class="side">${crestImg(lm.away)}<span class="n">${escapeHtml(lm.away.name)}</span></div>`;
  const minute = lm.chunkIndex === 0 ? 0 : LIVE_MATCH_CHUNK_MINUTES[Math.min(lm.chunkIndex, LIVE_MATCH_CHUNK_MINUTES.length) - 1];
  document.getElementById("liveMatchMinute").textContent = lm.finished ? "Fim de jogo — carregando..." : `${minute}'`;
  document.getElementById("liveMatchFeed").innerHTML = lm.events.length
    ? [...lm.events].reverse().map((e) => `<div class="ct-transfer-feed-item"><b>${e.minute}'</b> ${liveEventLabel(e)}</div>`).join("")
    : `<p class="ct-empty">Bola rolando...</p>`;
  const subsTotal = MAX_SUBS_PER_MATCH + lm.subsBonus;
  const subBtn = document.getElementById("btnLiveSub");
  subBtn.textContent = `🔄 Substituir (${lm.subsUsed}/${subsTotal})`;
  subBtn.disabled = lm.finished || lm.subsUsed >= subsTotal;
  document.getElementById("btnLiveTactics").disabled = lm.finished;
  document.getElementById("btnLiveSkip").disabled = lm.finished;
}
// ---- Sub-modal: substituição ----
function openLiveSubModal() {
  const lm = LIVE_MATCH;
  if (!lm || lm.finished) return;
  if (lm.subsUsed >= MAX_SUBS_PER_MATCH + lm.subsBonus) { toast("Sem substituições disponíveis."); return; }
  pauseLiveMatch();
  const starters = CAREER.lineup.starters.map((id) => id && CAREER.squad.find((p) => p.id === id)).filter(Boolean);
  const bench = CAREER.lineup.bench.map((id) => CAREER.squad.find((p) => p.id === id)).filter((p) => p && p.status === "ok");
  document.getElementById("liveSubOutSelect").innerHTML = starters.length
    ? starters.map((p) => `<option value="${p.id}">${escapeHtml(abbreviateName(p.name))} (${subPositionOf(p)})</option>`).join("")
    : `<option value="">Sem titulares disponíveis</option>`;
  document.getElementById("liveSubInSelect").innerHTML = bench.length
    ? bench.map((p) => `<option value="${p.id}">${escapeHtml(abbreviateName(p.name))} (${subPositionOf(p)})</option>`).join("")
    : `<option value="">Sem jogadores disponíveis no banco</option>`;
  document.getElementById("liveSubOverlay").classList.add("open");
}
function closeLiveSubModal() {
  document.getElementById("liveSubOverlay").classList.remove("open");
  resumeLiveMatch();
}
function confirmLiveSub() {
  const lm = LIVE_MATCH;
  if (!lm) return;
  const outId = document.getElementById("liveSubOutSelect").value;
  const inId = document.getElementById("liveSubInSelect").value;
  if (!outId || !inId) { toast("Escolha quem sai e quem entra."); return; }
  const outIdx = CAREER.lineup.starters.indexOf(outId);
  if (outIdx < 0) { toast("Esse jogador não está em campo."); return; }
  const outPlayer = CAREER.squad.find((p) => p.id === outId);
  const inPlayer = CAREER.squad.find((p) => p.id === inId);
  if (!outPlayer || !inPlayer) return;
  CAREER.lineup.starters[outIdx] = inId;
  CAREER.lineup.bench = CAREER.lineup.bench.filter((id) => id !== inId);
  CAREER.lineup.bench.push(outId);
  lm.subsUsed++;
  const minute = lm.chunkIndex === 0 ? 0 : LIVE_MATCH_CHUNK_MINUTES[lm.chunkIndex - 1];
  lm.events.push({ type: "substituicao", saiu: outPlayer.name, entra: inPlayer.name, minute, mine: true });
  document.getElementById("liveSubOverlay").classList.remove("open");
  renderLiveMatch();
  resumeLiveMatch();
}
// ---- Sub-modal: ajustar tática ----
function openLiveTacticsModal() {
  if (!LIVE_MATCH || LIVE_MATCH.finished) return;
  pauseLiveMatch();
  document.getElementById("liveTacticsFormation").value = CAREER.lineup.formation;
  document.getElementById("liveTacticsMentality").value = CAREER.lineup.tactics.mentality;
  document.getElementById("liveTacticsMarking").value = CAREER.lineup.tactics.marking;
  document.getElementById("liveTacticsTempo").value = CAREER.lineup.tactics.tempo;
  document.getElementById("liveTacticsOverlay").classList.add("open");
}
function closeLiveTacticsModal() {
  document.getElementById("liveTacticsOverlay").classList.remove("open");
  resumeLiveMatch();
}
function confirmLiveTactics() {
  if (!LIVE_MATCH) return;
  const newFormation = document.getElementById("liveTacticsFormation").value;
  if (newFormation !== CAREER.lineup.formation) {
    CAREER.lineup.formation = newFormation;
    LIVE_MATCH.formationPenaltyChunksLeft = LIVE_TACTICS_FAMILIARITY_PENALTY_CHUNKS;
    toast("Esquema alterado — o time perde um pouco de efetividade até se ajustar.");
  }
  CAREER.lineup.tactics.mentality = document.getElementById("liveTacticsMentality").value;
  CAREER.lineup.tactics.marking = document.getElementById("liveTacticsMarking").value;
  CAREER.lineup.tactics.tempo = document.getElementById("liveTacticsTempo").value;
  document.getElementById("liveTacticsOverlay").classList.remove("open");
  resumeLiveMatch();
}

/* ---------- Renderização: Central ---------- */
function renderCentral() {
  refreshAvailability();
  // Pedido do usuário: número da rodada saiu do header (agora só logo
  // + "Modo Carreira" + menu, ver ct-topbar) e virou parte do título
  // deste card: "Próximo jogo (X / 38)".
  document.getElementById("roundPill").textContent = `(${Math.min(CAREER.currentRound, 38)} / 38)`;
  const box = document.getElementById("nextMatchBox");
  const btn = document.getElementById("btnSimulate");
  const round = CAREER.currentRound;
  if (round > 38) {
    // FASE 3 (c) — pedido do usuário: multitemporadas — em vez de só
    // "acabou, reinicie", dá pra seguir jogando ano após ano (ver
    // advanceSeason). "Simular rodada" some, entra o botão de avançar.
    box.innerHTML = `<p class="ct-empty">Temporada ${CAREER.seasonYear} encerrada! Confira sua posição final na Tabela, ou avance pra próxima temporada.</p>`;
    btn.classList.add("hidden");
    document.getElementById("btnAdvanceSeason").classList.remove("hidden");
  } else {
    btn.classList.remove("hidden");
    document.getElementById("btnAdvanceSeason").classList.add("hidden");
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
  // FASE 2 (b) — moral média do elenco PRINCIPAL (mesmo recorte de
  // computeBoardGoal), sempre visível na Central — sem isso a moral só
  // aparecia jogador por jogador, sem noção nenhuma do clima geral do
  // time.
  const principalForMorale = squad.filter((p) => p.origin === "principal");
  const avgMorale = principalForMorale.length
    ? Math.round(principalForMorale.reduce((s, p) => s + (p.morale == null ? 70 : p.morale), 0) / principalForMorale.length)
    : 70;
  document.getElementById("squadKpis").innerHTML = [
    ["Elenco", squad.length], ["Disponíveis", ok], ["Contundidos", hurt], ["Suspensos", susp],
  ].map(([l, v]) => kpiHTML(l, v)).join("") + kpiHTML("Moral do elenco", avgMorale, avgMorale >= 80 ? "gold" : avgMorale <= 30 ? "red" : null);
  // FASE 3 (c) — ano da carreira sempre visível (não só no modal de
  // transição), mesmo padrão do "(X / 38)" ao lado de "Próximo jogo".
  document.getElementById("seasonYearLabel").textContent = `(Temporada ${CAREER.seasonYear})`;
  // FASE 1 (item 3) — meta da diretoria sempre visível (ver comentário
  // no HTML). CAREER.boardGoal já existe garantido a essa altura
  // (startCareer/migrateCareerDefaults sempre calculam um).
  document.getElementById("boardGoalLabel").textContent = `🎯 Meta da diretoria: ${CAREER.boardGoal.label}`;

  // FASE 2 (b) — card "Financeiro": caixa e uso do teto salarial (só
  // elenco PRINCIPAL conta pro teto, ver wageBillOf).
  const wageBill = wageBillOf(squad);
  const { cash, wageCap } = CAREER.finances;
  document.getElementById("financeKpis").innerHTML =
    kpiHTML("Caixa", fmtBRLShort(cash), "gold") +
    kpiHTML("Folha salarial", fmtBRLShort(wageBill), wageBill >= wageCap ? "red" : null);
  const wagePct = wageCap ? clamp(Math.round((wageBill / wageCap) * 100), 0, 100) : 0;
  const wageFill = document.getElementById("wageCapFill");
  wageFill.style.width = `${wagePct}%`;
  wageFill.classList.toggle("warn", wagePct >= 80 && wagePct < 100);
  wageFill.classList.toggle("over", wagePct >= 100);
  document.getElementById("wageCapLabel").textContent =
    `Folha salarial: ${fmtBRL(wageBill)} de ${fmtBRL(wageCap)} (${wagePct}%)`;
  // FASE 3 (a) — botão de pedir orçamento fica desabilitado durante o
  // cooldown (ver askBoard/BOARD_REQUEST_COOLDOWN); última decisão da
  // diretoria fica visível até o próximo pedido.
  const lastBoardRound = CAREER.lastBoardRequestRound;
  const cooldownLeft = lastBoardRound != null ? BOARD_REQUEST_COOLDOWN - (CAREER.currentRound - lastBoardRound) : 0;
  const btnBoard = document.getElementById("btnAskBoard");
  btnBoard.disabled = cooldownLeft > 0;
  btnBoard.title = cooldownLeft > 0 ? `A diretoria responde de novo em ${cooldownLeft} rodada(s).` : "";
  document.getElementById("boardDecisionText").textContent = CAREER.boardDecision || "";

  const lastCard = document.getElementById("lastResultCard");
  const last = CAREER.resultsByRound[round - 1];
  const fx = last && last.find((m) => String(m.home) === String(CAREER.clubId) || String(m.away) === String(CAREER.clubId));
  if (fx) {
    const home = teamById(fx.home), away = teamById(fx.away);
    lastCard.style.display = "";
    // Pedido do usuário: além do placar, mostrar quem fez gol, quem
    // deu assistência e quem tomou cartão nesse jogo (ver fx.events,
    // gravado em simulateRound só pro jogo do próprio clube).
    document.getElementById("lastResultBox").innerHTML = `<div class="ct-next-match">
      <div class="side">${crestImg(home)}<span class="n">${escapeHtml(home.name)}</span></div>
      <span class="vs" style="font-size:18px;">${fx.gh} × ${fx.ga}</span>
      <div class="side">${crestImg(away)}<span class="n">${escapeHtml(away.name)}</span></div>
    </div>
    ${matchEventsSummaryHTML(fx.events)}`;
  } else {
    lastCard.style.display = "none";
  }
}
// Lista gols/assistências/cartões de um jogo (ver estrutura de
// "events" em simulateRound/simulatePlayerEvents) — usado na Central
// ("Resultado da última rodada") e no modal de detalhe do jogo (ver
// showMatchDetailModal). Nome sempre abreviado (mesmo padrão do
// Elenco). Sem eventos (folga, ou jogo sem detalhe registrado) não
// mostra nada.
const MATCH_EVENT_META = {
  gol: { icon: "⚽", label: "Gol" },
  assistencia: { icon: "🅰️", label: "Assistência" },
  amarelo: { icon: "🟨", label: "Cartão amarelo", cls: "yellow" },
  vermelho: { icon: "🟥", label: "Cartão vermelho", cls: "red" },
};
function matchEventsSummaryHTML(events) {
  if (!events || !events.length) return "";
  const rows = events.map((e) => {
    const meta = MATCH_EVENT_META[e.type] || { icon: "•", label: e.type };
    // Gol do adversário (ver simulateRound: time rival não tem elenco
    // individual, só teve "e.player" quando é ALGUÉM do seu time) —
    // credita ao time em vez de um nome de jogador que não existe.
    const nm = e.player ? escapeHtml(abbreviateName(e.player)) : `Gol do ${escapeHtml(e.team)}`;
    // AJUSTE (design system anexado pelo usuário: .bd-event-badge.
    // yellow/.red) — cartão ganha o fundo colorido do próprio cartão
    // (ver .ct-event-icon.yellow/.red em carreira.html).
    return `<div class="ct-event-row">
      <span class="ct-event-icon${meta.cls ? ` ${meta.cls}` : ""}">${meta.icon}</span>
      <span class="nm">${nm}</span>
      <span class="tp">${e.player ? meta.label : ""}</span>
    </div>`;
  }).join("");
  return `<div class="ct-event-list">${rows}</div>`;
}

/* ---------- Renderização: Elenco ---------- */
function squadTableHead() {
  return `<tr><th>Nome</th><th>Pos</th><th>Idade</th><th>OVR</th><th>Condição</th><th>Status</th><th></th></tr>`;
}
function playerRow(p) {
  // Pedido do usuário: no lugar do texto ("Disponível"/"Lesão X (até
  // RN)"/"Suspenso (RN)"), ícone + semáforo — o fundo colorido do
  // .ct-pill já era verde/vermelho/âmbar (ver CSS), só o CONTEÚDO virou
  // ícone em vez de texto; o detalhe todo (severidade, rodada de
  // volta) vira tooltip (title), não some, só sai da lista pra caber
  // num ícone só.
  const statusPill = p.status === "ok" ? `<span class="ct-pill ok" title="Disponível">🟢</span>`
    : p.status === "contundido" ? `<span class="ct-pill hurt" title="Lesão ${injurySeverityLabel(p.injurySeverity)} — de volta na rodada ${p.outUntilRound}">🩹</span>`
    : `<span class="ct-pill susp" title="Suspenso — de volta na rodada ${p.outUntilRound}">🟥</span>`;
  // Pedido do usuário: sem tag "gerado" pra jogador da BASE (a
  // categoria inteira já é gerada, ver comentário em openDetail) — só
  // aparece pro elenco PRINCIPAL gerado (exceção de verdade, quando a
  // busca real veio incompleta).
  // FASE 1 (item 1) — pedido do usuário: aviso visível com antecedência
  // no card do jogador (aqui, na lista do Elenco também, não só no
  // detalhe) — ver isContractExpiring em carreira.js.
  const contractTag = isContractExpiring(p) ? ' <span class="ct-pill contract" style="margin-left:4px;" title="Sai de graça se a temporada acabar sem renovar">Fim de contrato</span>' : "";
  // Empréstimo — mesma linguagem visual do "gerado" (pill neutro), só
  // pra deixar claro na lista que esse jogador não é seu de verdade.
  const loanTag = p.origin === "loan" ? ` <span class="ct-pill base" style="margin-left:4px;" title="${p.loanReturnRound ? `Volta pro clube de origem na rodada ${p.loanReturnRound}` : "Volta pro clube de origem no fim da temporada"}">emprestado</span>` : "";
  // FASE 2 (b) — só marca os EXTREMOS (feliz/infeliz) — moral neutra
  // (a maioria do elenco, na prática) não precisa de ícone nenhum, só
  // poluiria a lista à toa.
  const morale = p.morale == null ? 70 : p.morale;
  const moraleTag = morale >= 80 ? ` <span title="Moral ${morale} — feliz no clube">😊</span>`
    : morale <= 30 ? ` <span title="Moral ${morale} — infeliz no clube">😞</span>`
    : "";
  // Fase 2 (olheiro) — faixa de potencial junto do overall, só pra
  // quem tem potencial pra mostrar (base, e quem já foi promovido mas
  // ainda carrega o potencial de quando era da base).
  const potRange = scoutedPotentialRange(p);
  const potHint = potRange ? `<br><span class="ct-pot-hint" title="Faixa estimada por olheiro — o teto real é incerto até o jogador amadurecer">pot. ${potRange.lo}-${potRange.hi}</span>` : "";
  return `<tr data-id="${p.id}" style="cursor:pointer;">
    <td class="ct-name-cell">${escapeHtml(abbreviateName(p.name))}${(!p.real && p.origin !== "base") ? ' <span class="ct-pill base" style="margin-left:4px;">gerado</span>' : ""}${contractTag}${moraleTag}${loanTag}</td>
    <td>${subPositionOf(p)}</td><td>${p.age}</td><td><b>${p.overall}</b>${potHint}</td>
    <td>${conditionDotsHTML(p.condition)}</td>
    <td>${statusPill}</td>
    <td style="text-align:right; color:var(--text-2);">▸</td>
  </tr>`;
}
function renderElenco() {
  refreshAvailability();
  // Ordenado por posição (Goleiros, Defensores, Meio-campo, Atacantes —
  // ver SUBPOS_ORDER) e, dentro da mesma posição, por overall — dentro
  // de cada grupo (principal/base), pedido do usuário.
  // BUG CORRIGIDO: jogador emprestado (origin "loan") não entrava em
  // NENHUMA das 2 tabelas (nem principal, nem base) — ficava invisível
  // no Elenco mesmo estando disponível pra escalar.
  const principal = CAREER.squad.filter((p) => p.origin === "principal" || p.origin === "loan").sort((a, b) => squadSortKey(a) - squadSortKey(b));
  const base = CAREER.squad.filter((p) => p.origin === "base").sort((a, b) => squadSortKey(a) - squadSortKey(b));
  const mt = document.getElementById("squadMainTable");
  mt.querySelector("thead").innerHTML = squadTableHead();
  mt.querySelector("tbody").innerHTML = principal.map(playerRow).join("") || `<tr><td colspan="7" class="ct-empty">Sem jogadores.</td></tr>`;
  const bt = document.getElementById("squadBaseTable");
  bt.querySelector("thead").innerHTML = squadTableHead();
  bt.querySelector("tbody").innerHTML = base.map(playerRow).join("") || `<tr><td colspan="7" class="ct-empty">Sem jogadores.</td></tr>`;
  [mt, bt].forEach((table) => table.querySelectorAll("tbody tr[data-id]").forEach((tr) => tr.addEventListener("click", () => openDetail(tr.dataset.id))));
}
/* ---------- FASE 1 (item 1) — renovação de contrato ----------
   Especificação "BR Data Treinador — Fase 1". O jogo só marca ano de
   contrato (contractUntil), não mês/dia — "final de contrato" aqui
   vira "esse é o último ANO coberto pelo contrato" (contractUntil ===
   temporada atual), em vez da janela de "≤ 6 meses" do documento, que
   não tem como que mapear num modelo sem data. Resposta é sempre
   imediata (proposeRenewal), sem estado "renovando" pendente entre
   sessões — por isso nenhum campo novo precisou entrar no save nem na
   migração (contractUntil já existe desde a Fase 2b). "Moral" NÃO
   existia como atributo quando essa fase foi escrita (usava overall/
   idade como proxy) — a Fase 2 (item "moral do elenco") fechou essa
   lacuna de verdade, ver moraleFactor/suggestedRenewalWage/
   proposeRenewal, que agora usam p.morale direto. */
function isContractExpiring(p) {
  // Jogador emprestado (origin "loan") não é seu pra renovar contrato
  // nenhum — o contractUntil dele é do clube DONO, não seu.
  return p.origin !== "loan" && p.contractUntil === CAREER.seasonYear;
}
// Documento sugere "mínimo = salário atual × 1.05" como piso pra não
// levar recusa na certa — vira o valor sugerido no campo do sub-modal.
// FASE 2 (b) — moral alta cobra mais (mais confiante, mais exigente);
// moral baixa aceita o piso original do documento sem pedir mais nada
// em cima (só quer segurança, não dinheiro).
function suggestedRenewalWage(p) {
  const m = p.morale == null ? 70 : p.morale;
  const moraleBonus = clamp((m - 70) / 100, -0.05, 0.15);
  return Math.round((p.wage * (1.05 + moraleBonus)) / 100) * 100;
}
let RENEW_CTX = null;
function openRenewModal(id) {
  const p = CAREER.squad.find((x) => x.id === id);
  if (!p) return;
  RENEW_CTX = { playerId: id };
  const suggested = suggestedRenewalWage(p);
  document.getElementById("renewSub").textContent = `${abbreviateName(p.name)} · contrato até ${p.contractUntil}`;
  document.getElementById("renewCurrentInfo").textContent = `Salário atual: ${fmtBRL(p.wage)}/mês.`;
  document.getElementById("renewSuggestedWage").textContent = fmtBRL(suggested);
  document.getElementById("renewWageInput").value = suggested;
  document.getElementById("renewDurationSelect").value = "2";
  document.getElementById("renewOverlay").classList.add("open");
}
function closeRenewModal() {
  document.getElementById("renewOverlay").classList.remove("open");
  RENEW_CTX = null;
}
function proposeRenewal() {
  if (!RENEW_CTX) return;
  const p = CAREER.squad.find((x) => x.id === RENEW_CTX.playerId);
  if (!p) { closeRenewModal(); return; }
  const newWage = Math.max(0, Math.round(Number(document.getElementById("renewWageInput").value) || 0));
  const duration = Number(document.getElementById("renewDurationSelect").value) || 1;
  const minWage = suggestedRenewalWage(p);
  // Orçamento primeiro (o CLUBE não pode nem oferecer o que não cabe
  // no teto) — mesma trava de promote/buyPlayer. Base não conta pro
  // teto (wageBillOf só soma elenco principal, ver Fase 2b), então só
  // barra pra quem já está no principal.
  if (newWage > p.wage && p.origin === "principal") {
    const wageAfter = wageBillOf(CAREER.squad) - p.wage + newWage;
    if (wageAfter > CAREER.finances.wageCap) {
      toast(`Essa renovação estouraria o teto salarial (${fmtBRL(CAREER.finances.wageCap)}).`);
      return; // mantém o sub-modal aberto pra ajustar o valor
    }
  }
  // Recusa do JOGADOR (não do orçamento) — regras determinísticas de
  // propósito. FASE 2 (b): moral MUITO baixa é recusa na certa, valor
  // e duração nem importam mais (o jogador já quer é sair, não
  // assinar de novo) — antes disso, mínimo sugerido continua sendo
  // recusa na certa, e proposta de 1 ano só passa pra quem realmente
  // não tem moral de pedir mais tempo (jovem em ascensão, já craque,
  // OU moral alta o bastante pra ser exigente).
  const morale = p.morale == null ? 70 : p.morale;
  if (morale < 30) {
    closeRenewModal();
    toast(`${abbreviateName(p.name)} recusou a proposta — está infeliz no clube e não quer renovar agora.`, 5000);
    return;
  }
  if (newWage < minWage) {
    closeRenewModal();
    toast(`${abbreviateName(p.name)} recusou a proposta — quer pelo menos ${fmtBRL(minWage)}/mês.`, 5000);
    return;
  }
  if (duration === 1 && (p.age <= 23 || p.overall >= 85 || morale >= 85)) {
    closeRenewModal();
    toast(`${abbreviateName(p.name)} recusou a proposta — quer um contrato mais longo (pelo menos 2 anos).`, 5000);
    return;
  }
  p.wage = Math.max(p.wage, newWage);
  p.contractUntil = CAREER.seasonYear + duration;
  closeRenewModal();
  toast(`${abbreviateName(p.name)} renovou até ${p.contractUntil} por ${fmtBRL(p.wage)}/mês!`);
  persistCareer();
  renderElenco(); renderCentral();
  if (document.getElementById("detailOverlay").classList.contains("open")) openDetail(p.id);
}
function openDetail(id) {
  const p = CAREER.squad.find((x) => x.id === id);
  if (!p) return;
  const inStarters = CAREER.lineup.starters.includes(id);
  const inBench = CAREER.lineup.bench.includes(id);
  const subpos = subPositionOf(p);
  const groupFull = SUBPOS_LABEL[subpos] || "—";
  document.getElementById("detailIcon").textContent = subpos === "GOL" ? "🧤" : "⚽";
  document.getElementById("detailName").textContent = p.name;
  // Pedido do usuário: tirar a tag "gerado" dos jogadores da BASE —
  // toda a categoria de base já vem gerada (a API não cobre elenco
  // sub-20 do Brasileirão, ver comentário em buildBasePlayer), então a
  // tag não dizia nada de novo ali, só poluía. Continua aparecendo só
  // pro elenco PRINCIPAL gerado (jogador extra criado quando a busca
  // real veio incompleta — esse sim é uma exceção que vale marcar).
  const originLabel = p.origin === "principal" ? "Elenco principal" : p.origin === "loan" ? "Emprestado" : "Categoria de base";
  document.getElementById("detailSub").textContent = `${groupFull} · ${p.age} anos · ${originLabel}${(!p.real && p.origin !== "base") ? " (gerado)" : ""}`;
  // FASE 2 (b) — promover um jogador de base soma o salário dele na
  // folha do elenco PRINCIPAL (ver wageBillOf) — bloqueia se estourar
  // o teto salarial do clube (CAREER.finances.wageCap).
  const wageAfterPromote = wageBillOf(CAREER.squad) + (p.origin === "base" ? p.wage : 0);
  const promoteBlocked = p.origin === "base" && wageAfterPromote > CAREER.finances.wageCap;
  // FASE 2 (b) — moral vira mais uma KPI aqui (mesmo grid, quebra
  // linha sozinho — ver .ct-kpis auto-fit), com destaque dourado/
  // vermelho nos extremos (mesma linguagem visual de Caixa/Folha
  // salarial na Central).
  const morale = p.morale == null ? 70 : p.morale;
  const moraleVariant = morale >= 80 ? "gold" : morale <= 30 ? "red" : null;
  // Fase 2 (olheiro) — faixa de potencial em destaque ANTES da linha de
  // condição/salário, bem acima do botão "Promover ao elenco
  // principal" (pedido do usuário: ver isso ANTES de promover).
  const potRange = scoutedPotentialRange(p);
  // FASE 3 (item 4) — seta de tendência ao lado de cada atributo que
  // mudou DESDE A ÚLTIMA VEZ que esse detalhe foi aberto (ver
  // applyTrainingEvolution, que acumula em p.attrTrend a cada rodada) —
  // "checagem", no sentido da especificação, é abrir esse card; por
  // isso zera o acumulado logo depois de montar o HTML abaixo.
  const trend = p.attrTrend || {};
  const trendArrow = (attr) => trend[attr] > 0 ? ` <span style="color:var(--brd-green);" title="Evoluindo desde a última checagem">▲</span>`
    : trend[attr] < 0 ? ` <span style="color:var(--brd-red);" title="Regredindo desde a última checagem">▼</span>` : "";
  document.getElementById("detailBody").innerHTML = `
    <div class="ct-kpis" style="margin-bottom:12px;">
      <div class="ct-kpi"><div class="v gold">${p.overall}${trendArrow("overall")}</div><div class="l">Geral</div></div>
      <div class="ct-kpi"><div class="v">${p.atk}${trendArrow("atk")}</div><div class="l">Ataque</div></div>
      <div class="ct-kpi"><div class="v">${p.def}${trendArrow("def")}</div><div class="l">Defesa</div></div>
      <div class="ct-kpi"><div class="v">${p.phys}${trendArrow("phys")}</div><div class="l">Físico</div></div>
      <div class="ct-kpi"><div class="v${moraleVariant ? ` ${moraleVariant}` : ""}">${morale}</div><div class="l">Moral</div></div>
    </div>
    ${potRange ? `<p class="ct-sub" style="color:var(--gold); font-weight:700;">🔭 Avaliação do olheiro: potencial entre ${potRange.lo} e ${potRange.hi}.</p>` : ""}
    <p class="ct-sub">Condição: ${conditionRating(p.condition)}/5 (${CONDITION_RATING_LABEL[conditionRating(p.condition)]}) · Jogos: ${p.apps || 0} · Gols na carreira: ${p.goalsCareer || 0} · Cartões amarelos (ciclo atual): ${p.yellowCards || 0}</p>
    <p class="ct-sub">Salário: ${fmtBRL(p.wage)}/mês · Contrato até: ${p.contractUntil} · Valor de mercado: ${fmtBRL(p.value)}</p>
    <!-- FASE 1 (item 1 da especificação "BR Data Treinador") — pedido
         do usuário: aviso visível de final de contrato, com
         antecedência, direto no card do jogador (ver
         isContractExpiring/openRenewModal em carreira.js). Sem essa
         janela de aviso o vencimento pegava o treinador de surpresa —
         hoje o jogador só saía de graça na virada de temporada
         (renewHumanSquad, Fase 3c), sem chance nenhuma de segurar
         antes disso. -->
    ${isContractExpiring(p) ? `<p class="ct-sub" style="color:var(--gold); font-weight:700;">⚠️ Contrato até ${CAREER.seasonYear} — sai de graça se a temporada acabar sem renovar.</p>` : ""}
    <!-- FASE 1 (item 4) — mesmo padrão do aviso de contrato acima:
         destaque no detalhe pra quem tá fora de combate (ver
         INJURY_SEVERITY em carreira.js). -->
    ${p.status === "contundido" ? `<p class="ct-sub" style="color:var(--brd-red); font-weight:700;">🩹 Lesão ${injurySeverityLabel(p.injurySeverity)} — de volta na rodada ${p.outUntilRound}.</p>` : ""}
    ${p.status === "suspenso" ? `<p class="ct-sub" style="color:var(--brd-red); font-weight:700;">🟥 Suspenso — de volta na rodada ${p.outUntilRound}.</p>` : ""}
    <!-- AJUSTE (pedido do usuário: "a modal de detalhes do jogador segue
         com os botões diferentes" — mockup empilha os botões cheios,
         em coluna, cada um do tamanho normal (ver .btn/.btn-outline/
         .btn-blue/.btn-red-outline do documento) — não em linha com
         quebra e botão "small", que era o que ainda sobrava daqui de
         antes do ajuste de componentes. -->
    <div style="display:flex; flex-direction:column; gap:8px; margin-top:10px;">
      ${isContractExpiring(p) ? `<button class="ct-btn full primary" data-act="renew">✍️ Renovar contrato</button>` : ""}
      ${inStarters ? `<button class="ct-btn full" data-act="removeStarter">Tirar do time titular</button>` : ""}
      ${!inStarters && inBench ? `<button class="ct-btn full" data-act="removeBench">Tirar do banco</button>` : ""}
      ${!inStarters && !inBench && p.status === "ok" ? `<button class="ct-btn full" data-act="addBench" ${CAREER.lineup.bench.length >= MAX_BENCH ? "disabled" : ""}>Colocar no banco</button>` : ""}
      ${p.origin === "loan" ? "" : p.origin === "base"
        ? `<button class="ct-btn full primary" data-act="promote" ${promoteBlocked ? "disabled" : ""} ${promoteBlocked ? `title="Estouraria o teto salarial (${fmtBRL(CAREER.finances.wageCap)}) — libere espaço dispensando ou enviando alguém pra base antes."` : ""}>Promover ao elenco principal</button>`
        : `<button class="ct-btn full" data-act="demote">Enviar pra base</button>`}
      ${p.origin === "principal" ? `<button class="ct-btn full primary" data-act="sell">Vender por ${fmtBRL(p.value)}</button>
      <button class="ct-btn full" data-act="loanout">Emprestar</button>` : ""}
      <!-- Empréstimo: sem vender/dispensar/renovar — o jogador não é
           seu, só está temporariamente no elenco (ver comentário na
           seção "empréstimo de jogadores" mais acima em carreira.js). -->
      ${p.origin === "loan"
        ? `<p class="ct-sub" style="text-align:center;">📋 Emprestado do ${escapeHtml(teamById(p.loanFromClubId).name)} ${p.loanReturnRound ? `até a rodada ${p.loanReturnRound}` : "até o fim da temporada"}${p.loanBuyOption ? (p.loanBuyOption.mandatory ? ` · compra obrigatória de ${fmtBRL(p.loanBuyOption.value)} ao fim` : ` · opção de compra de ${fmtBRL(p.loanBuyOption.value)} ao fim`) : ""} — só dá pra escalar.</p>`
        : `<button class="ct-btn full danger" data-act="release">Dispensar</button>`}
    </div>
    ${promoteBlocked ? `<p class="ct-sub" style="color:var(--brd-red); margin-top:8px;">⚠️ Promover esse jogador levaria a folha salarial a ${fmtBRL(wageAfterPromote)}, acima do teto de ${fmtBRL(CAREER.finances.wageCap)}.</p>` : ""}`;
  document.getElementById("detailBody").querySelectorAll("[data-act]").forEach((btn) => {
    btn.addEventListener("click", () => handlePlayerAction(p.id, btn.dataset.act));
  });
  document.getElementById("detailOverlay").classList.add("open");
  // FASE 3 (item 4) — acabou de "checar" esse jogador (setas acima já
  // desenhadas com o valor de ANTES de zerar) — some até a próxima
  // mudança de atributo.
  if (p.attrTrend) p.attrTrend = { overall: 0, atk: 0, def: 0, phys: 0 };
}
async function handlePlayerAction(id, act) {
  const p = CAREER.squad.find((x) => x.id === id);
  if (!p) return;
  // FASE 1 (item 1) — abre o sub-modal de renovação POR CIMA do
  // detalhe (mesmo padrão do confirmModal, que também abre em cima de
  // qualquer outra modal já aberta) — não fecha nem mexe em nada aqui,
  // quem decide o que muda é proposeRenewal().
  if (act === "renew") { openRenewModal(id); return; }
  // FASE 3 (item 3) — mesmo padrão do "renew" acima: abre o sub-modal
  // de configuração do empréstimo POR CIMA do detalhe, sem mexer em
  // nada ainda — quem decide o que muda é confirmLoanFromModal().
  if (act === "loanout") { openLoanOutModal(id); return; }
  if (act === "removeStarter") {
    CAREER.lineup.starters = CAREER.lineup.starters.map((x) => (x === id ? null : x));
  } else if (act === "removeBench") {
    CAREER.lineup.bench = CAREER.lineup.bench.filter((x) => x !== id);
  } else if (act === "addBench") {
    if (CAREER.lineup.bench.length < MAX_BENCH) CAREER.lineup.bench.push(id);
  } else if (act === "promote") {
    // FASE 2 (b) — mesmo teto salarial checado em openDetail (que já
    // desabilita o botão) — reforçado aqui pro caso de handlePlayerAction
    // ser chamado de algum outro lugar no futuro sem passar por lá.
    if (wageBillOf(CAREER.squad) + p.wage > CAREER.finances.wageCap) {
      toast(`Promover esse jogador estouraria o teto salarial (${fmtBRL(CAREER.finances.wageCap)}).`);
      return;
    }
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
  } else if (act === "sell") {
    if (!(await sellPlayer(id))) return; // cancelado ou bloqueado — mantém o modal aberto
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
// Pedido do usuário (item 1, evolução da Escalação): botão "escalar
// automaticamente" — reaproveita autoLineup (já existia, mas só
// rodava uma vez na criação da carreira, ver buildSquad) pra
// preencher a escalação ATUAL de novo, do zero, com os melhores
// overalls disponíveis por posição. Só mexe em titulares/banco — o
// esquema, as instruções táticas e o foco de treino que o usuário já
// tinha escolhido continuam do jeito que estavam.
function autoFillLineup() {
  const includeBase = document.getElementById("autoLineupIncludeBase").checked;
  const result = autoLineup(CAREER.squad, CAREER.lineup.formation, includeBase);
  CAREER.lineup.starters = result.starters;
  CAREER.lineup.bench = result.bench;
  renderPitch(); renderBench();
  persistCareer();
  toast(`Escalação automática aplicada — melhores overalls por posição${includeBase ? " (incluindo base)" : ""}.`);
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
  // BUG CORRIGIDO (pedido do usuário: "na formação 3-5-2 o botão está
  // quebrando no meio de campo"): .button-row (ver css/style.css) usa
  // flex-wrap normal — uma linha com 5 jogadores (3-5-2, 4-2-3-1 e
  // 4-5-1 têm 5 no meio-campo) não cabe na largura de um celular comum
  // no tamanho padrão do disco, então o flex QUEBRA a linha em 2,
  // sobrepondo o 5º jogador em cima da linha do meio do campinho —
  // ver .ct-row-5 no <style> de carreira.html, que encolhe só as
  // linhas de 5 (linhas de até 4 continuam do tamanho normal).
  document.getElementById("pitchLines").innerHTML = `
    <div class="button-pitch">
      ${rows.map((row) => `<div class="button-row${row.length >= 5 ? " ct-row-5" : ""}">${row.map((s) => pitchPieceHTML(s, gradient)).join("")}</div>`).join("")}
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
  // posição no array). Pedido do usuário: tabela (Nome/Posição/
  // Overall) em vez de cards, e até 11 reservas (era 7) — ver
  // MAX_BENCH.
  const benchPlayers = CAREER.lineup.bench
    .map((id) => CAREER.squad.find((x) => x.id === id))
    .filter(Boolean)
    .sort((a, b) => squadSortKey(a) - squadSortKey(b));
  const rows = benchPlayers.map((p) => `<tr data-id="${p.id}" style="cursor:pointer;">
    <td class="ct-name-cell">${escapeHtml(abbreviateName(p.name))}</td><td>${subPositionOf(p)}</td><td><b>${p.overall}</b></td>
  </tr>`).join("");
  const canAdd = CAREER.lineup.bench.length < MAX_BENCH;
  const addRow = canAdd ? `<tr id="benchAddRow" style="cursor:pointer; color:var(--text-2);"><td colspan="3">+ adicionar reserva</td></tr>` : "";
  const emptyRow = (!benchPlayers.length && !canAdd) ? `<tr><td colspan="3" class="ct-empty">Banco vazio.</td></tr>` : "";
  document.getElementById("benchList").innerHTML = rows + addRow + emptyRow;
  document.getElementById("benchList").querySelectorAll("tr[data-id]").forEach((el) => {
    el.addEventListener("click", () => openPicker({ type: "bench", currentId: el.dataset.id }, "Trocar reserva"));
  });
  const addRowEl = document.getElementById("benchAddRow");
  if (addRowEl) addRowEl.addEventListener("click", () => openPicker({ type: "bench" }, "Adicionar reserva"));
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
// Pedido do usuário (item 3, evolução da Escalação): "ao clicar pra
// substituir um titular ou reserva deve ser possível escalar jogadores
// que já estão em alguma posição, efetuando com isso uma troca
// simples". Antes, renderPickerList (ver comportamento antigo abaixo)
// FILTRAVA de fora qualquer jogador já escalado noutro lugar — dava
// pra ver que ele "sumia" da lista, sem explicação, e não tinha como
// pegar alguém que já era titular pra virar titular de outra posição
// sem passar pelo banco no meio do caminho. Agora aparece na lista
// (com a tag do lugar onde já está) e escolher ele faz os dois lados
// trocarem de lugar de uma vez.
function locateInLineup(playerId) {
  if (!playerId) return null;
  const si = CAREER.lineup.starters.indexOf(playerId);
  if (si >= 0) return { kind: "starter", idx: si };
  const bi = CAREER.lineup.bench.indexOf(playerId);
  if (bi >= 0) return { kind: "bench", idx: bi };
  return null;
}
// playerId null só faz sentido pra "starter" (esvazia a vaga) — banco
// não guarda vaga vazia, tirar de lá encolhe a lista (ver splice).
function placeAt(loc, playerId) {
  if (!loc) return;
  if (loc.kind === "starter") CAREER.lineup.starters[loc.idx] = playerId;
  else if (playerId) CAREER.lineup.bench[loc.idx] = playerId;
  else CAREER.lineup.bench.splice(loc.idx, 1);
}
function renderPickerList(filter) {
  const currentId = PICKER_CTX.type === "slot" ? CAREER.lineup.starters[PICKER_CTX.index] : (PICKER_CTX.currentId || null);
  // Sem o filtro de "já escalado" de antes — só continua de fora quem
  // está fisicamente indisponível (lesionado/suspenso).
  let pool = CAREER.squad.filter((p) => p.status === "ok");
  const f = filter.trim().toLowerCase();
  if (f) pool = pool.filter((p) => p.name.toLowerCase().includes(f));
  pool.sort((a, b) => squadSortKey(a) - squadSortKey(b));
  const showClear = PICKER_CTX.type === "slot" || (PICKER_CTX.type === "bench" && PICKER_CTX.currentId);
  const clearRow = showClear ? `<div class="ct-pick-row" data-clear="1"><span class="nm">— deixar vazio —</span></div>` : "";
  const list = document.getElementById("pickerList");
  list.innerHTML = clearRow + (pool.length ? pool.map((p) => {
    const loc = p.id === currentId ? null : locateInLineup(p.id);
    // Tag do lugar onde já está — escolher alguém marcado "titular" ou
    // "banco" faz a troca (ver pickerChoose), não só remove ele de lá.
    const tag = p.id === currentId ? " (atual)" : loc && loc.kind === "starter" ? " (titular)" : loc && loc.kind === "bench" ? " (banco)" : "";
    return `<div class="ct-pick-row" data-id="${p.id}">
      <span class="nm" style="white-space:nowrap;">${escapeHtml(abbreviateName(p.name))}${tag}</span>
      <span class="meta">${subPositionOf(p)} · OVR <b>${p.overall}</b> · ${p.origin === "base" ? "base" : p.origin === "loan" ? "emprestado" : "principal"}</span>
    </div>`;
  }).join("") : `<p class="ct-empty">Nenhum jogador disponível.</p>`);
  list.querySelectorAll("[data-clear]").forEach((el) => el.addEventListener("click", () => pickerChoose(null)));
  list.querySelectorAll("[data-id]").forEach((el) => el.addEventListener("click", () => pickerChoose(el.dataset.id)));
}
function pickerChoose(playerId) {
  // "target" é a vaga que abriu o modal (o slot clicado no campinho,
  // ou a linha do banco clicada — null só no caso de "+ adicionar
  // reserva", que não tem vaga nenhuma pra abrir mão de alguém).
  const target = PICKER_CTX.type === "slot" ? { kind: "starter", idx: PICKER_CTX.index }
    : PICKER_CTX.currentId ? locateInLineup(PICKER_CTX.currentId) : null;
  const outgoingId = target ? (target.kind === "starter" ? CAREER.lineup.starters[target.idx] : CAREER.lineup.bench[target.idx]) : null;
  if (playerId) {
    const source = locateInLineup(playerId);
    // TROCA SIMPLES: o escolhido já ocupa outra vaga (titular ou
    // banco) — quem estava na vaga-alvo (outgoingId, pode ser null)
    // vai pro lugar que o escolhido está deixando.
    if (source && !(target && source.kind === target.kind && source.idx === target.idx)) {
      placeAt(source, outgoingId);
    }
  }
  if (target) {
    placeAt(target, playerId);
  } else if (playerId && CAREER.lineup.bench.length < MAX_BENCH) {
    // "+ adicionar reserva": sem vaga pra liberar, só entra se ainda
    // couber no banco (mesmo teto de sempre, ver MAX_BENCH).
    CAREER.lineup.bench.push(playerId);
  }
  document.getElementById("pickerOverlay").classList.remove("open");
  renderPitch(); renderBench();
  persistCareer();
}

/* ---------- Renderização: Tabela ---------- */
// tableId — pedido do usuário: o botão "Ver tabela atualizada" (fim do
// fluxo de simular rodada) abre a tabela num MODAL tela cheia por cima
// da tela atual, em vez de trocar de aba (ver openTabelaModal) — o
// parâmetro deixa essa mesma função alimentar tanto a tabela de sempre
// (aba Tabela, chamada sem argumento por renderAll) quanto a cópia
// dentro do modal, sem duplicar a lógica de montar as linhas.
function renderTabela(tableId = "standingsTable") {
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
  const table = document.getElementById(tableId);
  table.querySelector("thead").innerHTML = thead;
  table.querySelector("tbody").innerHTML = tbody;
}

/* ---------- FASE 2 (a) — Copa do Brasil: card de status/histórico
   (ver #cupStatusText/#cupHistory, dentro do painel Tabela) ----------
   Mesmos ids opcionais de renderTabela acima — alimenta a cópia do
   modal "Ver tabela atualizada" (ver openTabelaModal). */
function renderCopa(statusElId = "cupStatusText", histElId = "cupHistory") {
  const cup = CAREER.cup;
  const statusEl = document.getElementById(statusElId);
  const histEl = document.getElementById(histElId);
  if (!cup || !cup.active) {
    statusEl.textContent = "Seu elenco não se classificou pra Copa do Brasil essa temporada — só os 16 elencos mais fortes da competição disputam.";
    histEl.innerHTML = "";
    return;
  }
  const myTieInPhase = (phase) => (cup.ties[phase] || []).find((t) => String(t.home) === String(CAREER.clubId) || String(t.away) === String(CAREER.clubId));
  if (cup.championIsHuman) {
    statusEl.innerHTML = `🏆 <b style="color:var(--gold);">Campeão da Copa do Brasil ${CAREER.seasonYear}!</b>`;
  } else if (!cup.humanAlive) {
    statusEl.textContent = `Eliminado da Copa do Brasil nas ${CUP_PHASE_LABEL[cup.humanEliminatedStage] || cup.humanEliminatedStage}${cup.humanEliminatedAtRound ? ` (rodada ${cup.humanEliminatedAtRound})` : ""}.`;
  } else if (cup.phase === "done") {
    statusEl.textContent = `Copa do Brasil ${CAREER.seasonYear} encerrada. Campeão: ${teamById(cup.champion).name}.`;
  } else {
    const tie = myTieInPhase(cup.phase);
    const oppId = tie ? (String(tie.home) === String(CAREER.clubId) ? tie.away : tie.home) : null;
    statusEl.innerHTML = `Fase atual: <b>${CUP_PHASE_LABEL[cup.phase]}</b>. Próximo confronto: rodada ${CUP_ROUNDS[cup.phase]} contra <b>${oppId ? escapeHtml(teamById(oppId).name) : "?"}</b>.`;
  }
  const rows = CUP_PHASES.map((phase) => {
    const tie = myTieInPhase(phase);
    if (!tie || tie.gh == null) return "";
    const isHomeMe = String(tie.home) === String(CAREER.clubId);
    const opp = teamById(isHomeMe ? tie.away : tie.home);
    const myScore = isHomeMe ? tie.gh : tie.ga;
    const oppScore = isHomeMe ? tie.ga : tie.gh;
    const won = String(tie.winner) === String(CAREER.clubId);
    return `<div class="ct-round-result-row me">
      <div class="ct-rr-team">${crestImg(teamById(CAREER.clubId), 22)}<span>Você</span></div>
      <span class="ct-rr-score">${myScore} <small>x</small> ${oppScore}${tie.penalties ? " <small>(pên.)</small>" : ""}</span>
      <div class="ct-rr-team right">${crestImg(opp, 22)}<span>${escapeHtml(opp.name)}</span></div>
    </div>
    <p class="ct-sub" style="margin:2px 0 8px;">${CUP_PHASE_LABEL[phase]}: ${won ? "✅ Classificado" : "❌ Eliminado"}</p>`;
  }).join("");
  histEl.innerHTML = rows || `<p class="ct-empty">Nenhum confronto disputado ainda.</p>`;
}
// Pedido do usuário: "ao clicar em ver tabela atualizada, abrir tabela
// em modal tela cheia e não redirecionar para a página" — antes o
// botão fechava o modal de resultados E trocava pra aba Tabela (ver
// switchToPanel), tirando o usuário de onde estava. Agora abre um
// modal tela cheia POR CIMA da tela atual (mesmo tratamento de
// .ct-modal-fullscreen dos outros modais de conteúdo grande) — fechar
// (X ou clique fora) só volta pra onde já estava, sem navegar nada.
function openTabelaModal() {
  renderTabela("standingsTableModal");
  renderCopa("cupStatusTextModal", "cupHistoryModal");
  document.getElementById("tabelaModalOverlay").classList.add("open");
}
function closeTabelaModal() {
  document.getElementById("tabelaModalOverlay").classList.remove("open");
}

/* ---------- Renderização: Estatísticas ----------
   Pedido do usuário: substitui a aba Notícias — dados do campeonato
   (derivados da tabela da carreira, mesma fonte de sempre — ver
   CAREER.standings) e da própria equipe (gols, cartões, assistências —
   gols vem de standings[clubId].gp; assistência/cartão de
   CAREER.teamStats, ver tallyTeamStats). */
function kpiHTML(label, value, variant) {
  // variant: "gold" (destaque de marca) ou "red" (alerta — ex.: folha
  // salarial estourando o teto), ver .ct-kpi .v.gold/.red em
  // carreira.html (design system anexado pelo usuário: .bd-stat-value
  // tem as duas variantes, não só a dourada).
  return `<div class="ct-kpi"><div class="v${variant ? ` ${variant}` : ""}">${value}</div><div class="l">${label}</div></div>`;
}
function renderEstatisticas() {
  const rows = Object.values(CAREER.standings);
  const withGames = rows.filter((r) => r.j > 0);
  const totalGoals = rows.reduce((s, r) => s + r.gp, 0);
  const totalGames = withGames.reduce((s, r) => s + r.j, 0) / 2; // cada jogo soma 1 pra cada time -> divide por 2
  const avgGoals = totalGames ? totalGoals / totalGames : 0;
  const bestAtk = rows.slice().sort((a, b) => b.gp - a.gp)[0];
  const bestDef = withGames.slice().sort((a, b) => a.gc - b.gc)[0];
  document.getElementById("leagueStatsKpis").innerHTML = [
    ["Gols na competição", totalGoals],
    ["Média de gols/jogo", avgGoals.toFixed(2)],
    ["Melhor ataque", bestAtk ? `${teamById(bestAtk.id).short || teamById(bestAtk.id).name} (${bestAtk.gp})` : "—"],
    ["Melhor defesa", bestDef ? `${teamById(bestDef.id).short || teamById(bestDef.id).name} (${bestDef.gc})` : "—"],
  ].map(([l, v]) => kpiHTML(l, v)).join("");

  const sorted = sortedStandings();
  const myPos = myLeaguePosition();
  const myRow = CAREER.standings[CAREER.clubId] || { gp: 0 };
  const stats = CAREER.teamStats || { assists: 0, yellow: 0, red: 0 };
  document.getElementById("teamStatsKpis").innerHTML =
    kpiHTML("Posição atual", myPos ? `${myPos}º` : "—", "gold") +
    [
      ["Gols marcados", myRow.gp],
      ["Assistências", stats.assists],
      ["Cartões (A+V)", stats.yellow + stats.red],
    ].map(([l, v]) => kpiHTML(l, v)).join("");

  const topPlayers = CAREER.squad.slice()
    .filter((p) => (p.goalsCareer || 0) > 0 || (p.assistsCareer || 0) > 0)
    .sort((a, b) => (b.goalsCareer || 0) - (a.goalsCareer || 0) || (b.assistsCareer || 0) - (a.assistsCareer || 0))
    .slice(0, 10);
  const tbody = topPlayers.map((p) => `<tr>
    <td class="ct-name-cell">${escapeHtml(abbreviateName(p.name))}</td><td>${subPositionOf(p)}</td>
    <td><b>${p.goalsCareer || 0}</b></td><td>${p.assistsCareer || 0}</td>
  </tr>`).join("");
  document.getElementById("teamTopPlayersTable").querySelector("tbody").innerHTML =
    tbody || `<tr><td colspan="4" class="ct-empty">Ninguém marcou gol ou deu assistência ainda.</td></tr>`;

  // FASE 2 (a) — pedido do usuário: "estatísticas reais de todos os
  // times". Artilheiros/garçons da LIGA INTEIRA (seu elenco +
  // CAREER.leagueSquads dos outros 19 — ver buildLeagueSquads),
  // possível agora que todo clube tem elenco individual de verdade.
  const allLeaguePlayers = [
    ...CAREER.squad.map((p) => ({ p, teamId: CAREER.clubId })),
    ...Object.entries(CAREER.leagueSquads || {}).flatMap(([teamId, squad]) => squad.map((p) => ({ p, teamId }))),
  ];
  const topLeague = allLeaguePlayers
    .filter(({ p }) => (p.goalsCareer || 0) > 0 || (p.assistsCareer || 0) > 0)
    .sort((a, b) => (b.p.goalsCareer || 0) - (a.p.goalsCareer || 0) || (b.p.assistsCareer || 0) - (a.p.assistsCareer || 0))
    .slice(0, 15);
  const leagueTbody = topLeague.map(({ p, teamId }) => {
    const t = teamById(teamId);
    return `<tr>
      <td class="ct-name-cell">${escapeHtml(abbreviateName(p.name))}</td><td>${escapeHtml(t.short || t.name)}</td>
      <td><b>${p.goalsCareer || 0}</b></td><td>${p.assistsCareer || 0}</td>
    </tr>`;
  }).join("");
  document.getElementById("leagueTopScorersTable").querySelector("tbody").innerHTML =
    leagueTbody || `<tr><td colspan="4" class="ct-empty">Ninguém marcou gol ou deu assistência ainda.</td></tr>`;

  // Times da competição — ranking por gols/cartões usando os dados já
  // reais de CAREER.standings (isso já vinha da API antes da Fase 2,
  // só não tinha uma tabela dedicada mostrando os 20 times).
  const teamRows = sorted.map((r) => {
    const t = teamById(r.id);
    const aprov = r.j ? Math.round((r.pts / (r.j * 3)) * 100) : 0;
    return `<tr class="${String(r.id) === String(CAREER.clubId) ? "me" : ""}">
      <td class="ct-name-cell">${escapeHtml(t.short || t.name)}</td><td>${r.j}</td>
      <td>${r.gp}</td><td>${r.gc}</td><td>${r.sg}</td><td>${aprov}%</td>
    </tr>`;
  }).join("");
  document.getElementById("leagueTeamStatsTable").querySelector("tbody").innerHTML = teamRows;
}

/* ---------- FASE 2 (c) — Mercado de transferências ---------- */
// Pedido do usuário: Mercado mostra o SEU elenco (pra vender) junto
// com os outros 19 times (pra contratar) numa lista só — cada item já
// vem com o clube anexado e "mine" pra decidir Comprar/Vender na hora
// de desenhar a linha (ver renderMercado). Só o elenco PRINCIPAL entra
// (base não tem presença de mercado, mesmo critério do botão "Vender"
// no detalhe do jogador). Reconstruída a cada render — a lista muda a
// cada transferência AI ou ação sua, não vale a pena cachear.
function allMarketPlayers() {
  const mine = CAREER.squad.filter((p) => p.origin === "principal")
    .map((p) => ({ p, club: teamById(CAREER.clubId), mine: true }));
  // Empréstimo: um jogador que VOCÊ deu emprestado (onLoanFromClubId)
  // fica temporariamente no elenco de outro clube, mas não é oferta de
  // mercado de verdade — filtra fora pra não aparecer como se fosse
  // "à venda" um jogador que já é seu (ver resolveLoanReturns).
  const others = Object.entries(CAREER.leagueSquads || {}).flatMap(([clubId, squad]) =>
    squad.filter((p) => !p.onLoanFromClubId).map((p) => ({ p, club: teamById(clubId), mine: false }))
  );
  return [...mine, ...others];
}
function renderMercado() {
  const offer = CAREER.pendingOffer;
  const offerCard = document.getElementById("pendingOfferCard");
  offerCard.style.display = offer ? "" : "none";
  if (offer) {
    document.getElementById("pendingOfferText").textContent =
      `${offer.clubName} oferece ${fmtBRL(offer.fee)} pelo seu jogador ${offer.playerName}.`;
  }

  // FASE 1 (item 2) — banner só aparece com a janela FECHADA (ver
  // .ct-window-banner em carreira.html); "Comprar" fica desabilitado
  // nesse período, "Vender" continua liberado (ver transferWindowStatus).
  const mktWindow = transferWindowStatus(CAREER.currentRound);
  const windowBanner = document.getElementById("marketWindowBanner");
  windowBanner.classList.toggle("hidden", mktWindow.open);
  // AJUSTE (pedido do usuário: "pode tirar a mensagem 'dá pra vender
  // mas não contratar' e deixar apenas 'Janela de contratações
  // encerradas - Rodada 20'") — mensagem direta, sem a explicação
  // extra (já dá pra perceber que vender continua liberado só de ver
  // o botão "Vender" normal ao lado do "Comprar" desabilitado).
  if (!mktWindow.open) {
    windowBanner.innerHTML = mktWindow.opensAtRound
      ? `🔒 <b>Janela de contratações encerrada</b> — Rodada ${mktWindow.opensAtRound}`
      : `🔒 <b>Janela de contratações encerrada</b> — próxima temporada`;
  }

  const search = (document.getElementById("marketSearch").value || "").trim().toLowerCase();
  const posFilter = document.getElementById("marketPosFilter").value;
  let list = allMarketPlayers();
  if (posFilter) list = list.filter(({ p }) => p.group === posFilter);
  if (search) {
    list = list.filter(({ p, club }) =>
      p.name.toLowerCase().includes(search) || (club.name || "").toLowerCase().includes(search) || (club.short || "").toLowerCase().includes(search)
    );
  }
  list.sort((a, b) => b.p.value - a.p.value);
  // Sem busca, mostra só os 40 mais valiosos (evita renderizar ~500
  // linhas à toa) — buscando, mostra até 60 resultados batendo o termo.
  const capped = list.slice(0, search || posFilter ? 60 : 40);
  // Pedido do usuário: cada jogador em 2 linhas — nome/time/posição/
  // overall em cima, salário/valor/ação embaixo. Ação muda pra "Vender"
  // quando é jogador do SEU elenco (ver "mine" em allMarketPlayers).
  const rows = capped.map(({ p, club, mine }) => `<div class="ct-market-row">
    <div class="ct-market-row-top">
      <span class="nm">${escapeHtml(abbreviateName(p.name))}</span>
      <span class="tm">${escapeHtml(club.short || club.name)}</span>
      <span class="pos">${subPositionOf(p)}</span>
      <span class="ovr">${p.overall}</span>
    </div>
    <div class="ct-market-row-bottom">
      <div class="money">
        <div>Salário: ${fmtBRLShort(p.wage)}/mês</div>
        <div>Valor: ${fmtBRLShort(p.value)}</div>
      </div>
      <!-- Empréstimo: 2º botão pequeno embaixo do 1º (ver
           .ct-market-actions) — Emprestar/Pegar emprestado só some
           junto com Vender/Comprar, mesma trava de janela. -->
      <div class="ct-market-actions">
        ${mine
          ? `<button class="ct-btn small" data-sell="${p.id}">Vender</button>
             <button class="ct-btn small" data-loanout="${p.id}" ${mktWindow.open ? "" : `disabled title="Janela de contratações encerrada"`}>Emprestar</button>`
          : `<button class="ct-btn small${mktWindow.open ? " primary" : ""}" data-buy="${p.id}" data-club="${escapeHtml(String(club.id))}" ${mktWindow.open ? "" : `disabled title="Janela de contratações encerrada"`}>Comprar</button>
             <button class="ct-btn small" data-loanin="${p.id}" data-club="${escapeHtml(String(club.id))}" ${mktWindow.open ? "" : `disabled title="Janela de contratações encerrada"`}>Pegar emprestado</button>`}
      </div>
    </div>
  </div>`).join("");
  document.getElementById("marketList").innerHTML = rows || `<p class="ct-empty">Nenhum jogador encontrado.</p>`;
  document.getElementById("marketList").querySelectorAll("[data-buy]").forEach((btn) => {
    btn.addEventListener("click", () => buyPlayer(btn.dataset.club, btn.dataset.buy));
  });
  document.getElementById("marketList").querySelectorAll("[data-sell]").forEach((btn) => {
    btn.addEventListener("click", () => sellFromMarket(btn.dataset.sell));
  });
  document.getElementById("marketList").querySelectorAll("[data-loanout]").forEach((btn) => {
    btn.addEventListener("click", () => openLoanOutModal(btn.dataset.loanout));
  });
  document.getElementById("marketList").querySelectorAll("[data-loanin]").forEach((btn) => {
    btn.addEventListener("click", () => openLoanInModal(btn.dataset.club, btn.dataset.loanin));
  });

  const feed = CAREER.transferLog || [];
  document.getElementById("transferFeed").innerHTML = feed.length
    ? feed.map((e) => `<div class="ct-transfer-feed-item"><b>Rodada ${e.round}:</b> ${escapeHtml(e.text)}</div>`).join("")
    : `<p class="ct-empty">Nenhuma transferência ainda.</p>`;
}
// Contratar um jogador de outro time: paga o valor de mercado (à
// vista, sem parcelamento — mais simples) e soma o salário na sua
// folha, com o MESMO teto salarial da promoção (ver wageBillOf/
// CAREER.finances.wageCap em Fase 2b).
async function buyPlayer(clubId, playerId) {
  // FASE 1 (item 2) — trava de novo aqui (o botão já vem desabilitado
  // fora da janela, ver renderMercado) só por segurança contra estado
  // desatualizado na tela.
  if (!transferWindowStatus(CAREER.currentRound).open) {
    toast("Janela de contratações encerrada — não dá pra contratar agora.");
    return;
  }
  const squad = leagueSquadFor(clubId);
  const idx = squad.findIndex((x) => x.id === playerId);
  if (idx < 0) return;
  const p = squad[idx];
  if (CAREER.finances.cash < p.value) {
    toast(`Caixa insuficiente — você tem ${fmtBRL(CAREER.finances.cash)}, o jogador custa ${fmtBRL(p.value)}.`);
    return;
  }
  if (wageBillOf(CAREER.squad) + p.wage > CAREER.finances.wageCap) {
    toast(`Contratar esse jogador estouraria o teto salarial (${fmtBRL(CAREER.finances.wageCap)}).`);
    return;
  }
  if (CAREER.squad.length >= MAX_PRINCIPAL + 20) { toast("Elenco já está muito grande — dispense ou venda alguém antes."); return; }
  if (!(await confirmModal(`Contratar ${p.name} por ${fmtBRL(p.value)}?`, "Contratar"))) return;
  squad.splice(idx, 1);
  CAREER.finances.cash -= p.value;
  p.origin = "principal";
  CAREER.squad.push(p);
  pushTransferLog(`Você contratou ${p.name} do ${teamById(clubId).name} por ${fmtBRL(p.value)}.`, CAREER.currentRound);
  toast(`${abbreviateName(p.name)} contratado!`);
  persistCareer();
  renderMercado(); renderElenco(); renderCentral();
}
// Vende um jogador SEU pelo valor de mercado (mesma trava de mínimo do
// elenco principal do "release", só que aqui você RECEBE o dinheiro —
// ver "release" pra dispensa de graça). Usado tanto pelo botão
// "Vender" do detalhe do jogador (ver handlePlayerAction) quanto pela
// aba Mercado (ver sellFromMarket) — devolve false sem mexer em nada
// se cancelado ou bloqueado, pra quem chamou saber se deve continuar.
async function sellPlayer(id) {
  const p = CAREER.squad.find((x) => x.id === id);
  if (!p) return false;
  const principalCount = CAREER.squad.filter((x) => x.origin === "principal").length;
  if (principalCount <= 14) { toast("O elenco principal não pode ficar com menos de 14 jogadores."); return false; }
  if (!(await confirmModal(`Vender ${p.name} por ${fmtBRL(p.value)}?`, "Vender"))) return false;
  // AJUSTE (pedido do usuário) — sem comprador interessado, a venda
  // não acontece: nada muda de lugar, o jogador continua no elenco.
  const buyer = findInterestedBuyer(CAREER.clubId);
  if (!buyer) {
    toast(`Nenhum time demonstrou interesse em ${abbreviateName(p.name)} agora — ele continua no seu elenco.`);
    return false;
  }
  CAREER.finances.cash += p.value;
  CAREER.squad = CAREER.squad.filter((x) => x.id !== id);
  CAREER.lineup.starters = CAREER.lineup.starters.map((x) => (x === id ? null : x));
  CAREER.lineup.bench = CAREER.lineup.bench.filter((x) => x !== id);
  (CAREER.leagueSquads[String(buyer.id)] = CAREER.leagueSquads[String(buyer.id)] || []).push(p);
  pushTransferLog(`Você vendeu ${p.name} pro ${buyer.name} por ${fmtBRL(p.value)}.`, CAREER.currentRound);
  toast(`${abbreviateName(p.name)} vendido por ${fmtBRL(p.value)}.`);
  return true;
}
// Botão "Vender" direto na aba Mercado (fora do detalhe do jogador,
// que já fecha/persiste/re-renderiza sozinho no fluxo de
// handlePlayerAction) — precisa persistir e re-renderizar aqui.
async function sellFromMarket(id) {
  if (!(await sellPlayer(id))) return;
  persistCareer();
  renderMercado(); renderElenco(); renderCentral();
}
// FASE 2 (c) — aceitar/recusar proposta recebida por um jogador seu
// (gerada em maybeGenerateOffer, ver simulateRound).
function acceptOffer() {
  const offer = CAREER.pendingOffer;
  if (!offer) return;
  const p = CAREER.squad.find((x) => x.id === offer.playerId);
  if (!p) { CAREER.pendingOffer = null; renderMercado(); return; } // jogador já saiu do elenco por outro motivo
  CAREER.finances.cash += offer.fee;
  CAREER.squad = CAREER.squad.filter((x) => x.id !== p.id);
  CAREER.lineup.starters = CAREER.lineup.starters.map((x) => (x === p.id ? null : x));
  CAREER.lineup.bench = CAREER.lineup.bench.filter((x) => x !== p.id);
  (CAREER.leagueSquads[offer.clubId] = CAREER.leagueSquads[offer.clubId] || []).push(p);
  pushTransferLog(`Você vendeu ${p.name} pro ${offer.clubName} por ${fmtBRL(offer.fee)}.`, CAREER.currentRound);
  toast(`Proposta aceita — ${fmtBRL(offer.fee)} no caixa.`);
  CAREER.pendingOffer = null;
  persistCareer();
  renderMercado(); renderElenco(); renderEscalacao(); renderCentral();
}
function declineOffer() {
  if (!CAREER.pendingOffer) return;
  toast("Proposta recusada.");
  CAREER.pendingOffer = null;
  persistCareer();
  renderMercado();
}

/* ---------- Tela do jogo ---------- */
// BUG CORRIGIDO (relato do usuário: Elenco em branco, nenhum erro
// visível na tela — login funcionou, então não é o crash de boot()):
// antes, se QUALQUER uma dessas 6 render* desse erro, TODAS as
// seguintes na lista ficavam sem rodar (uma exceção no meio da cadeia
// síncrona para tudo) — a aba que quebrou (e todas depois dela) ficava
// com o HTML inicial vazio pra sempre (trocar de aba só troca
// visibilidade via CSS, ver switchToPanel, não re-renderiza nada).
// Cada render agora roda isolado: uma quebra não derruba as outras
// abas, e loga + avisa qual foi (sem isso, não dava pra saber o que
// tinha quebrado sem acesso ao console do navegador).
function renderAll() {
  [
    ["Central", renderCentral], ["Elenco", renderElenco], ["Escalação", renderEscalacao],
    ["Tabela", renderTabela], ["Copa do Brasil", renderCopa], ["Estatísticas", renderEstatisticas], ["Mercado", renderMercado],
  ].forEach(([name, fn]) => {
    try { fn(); } catch (err) {
      console.error(`[carreira] falha ao renderizar ${name}:`, err);
      toast(`Erro ao carregar ${name}: ${err.message}`, 15000); // mais tempo que o normal (3.6s) — dá pra ler/printar
    }
  });
}
function showGameScreen() {
  show("screenGame");
  renderAll();
}
function switchToPanel(name) {
  document.querySelectorAll(".ct-tab").forEach((b) => b.classList.toggle("active", b.dataset.panel === name));
  document.querySelectorAll(".ct-panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + name));
}

/* ---------- Modais do fluxo "Simular rodada" (pedido do usuário) ---------- */
// 1º modal: o jogo do PRÓPRIO clube (se jogou essa rodada — bye/folga
// pula direto pro modal de resultados, não tem jogo pra detalhar).
function showMatchDetailModal(summary) {
  if (!summary.humanMatch) { showRoundResultsModal(summary); return; }
  const { home, away, gh, ga, events, ticketRevenue } = summary.humanMatch;
  const homeTeam = teamById(home), awayTeam = teamById(away);
  document.getElementById("matchDetailRound").textContent = summary.round;
  document.getElementById("matchDetailScore").innerHTML = `
    <div class="side">${crestImg(homeTeam)}<span class="n">${escapeHtml(homeTeam.name)}</span></div>
    <span class="vs" style="font-size:18px;">${gh} × ${ga}</span>
    <div class="side">${crestImg(awayTeam)}<span class="n">${escapeHtml(awayTeam.name)}</span></div>`;
  document.getElementById("matchDetailEvents").innerHTML = matchEventsSummaryHTML(events)
    || `<p class="ct-empty">Nenhum gol, cartão ou assistência nesse jogo.</p>`;
  // FASE 3 (b) — pedido do usuário: renda de ingressos em jogo em casa
  // (público que compareceu vs. capacidade do estádio, refletindo a
  // fase recente do time — ver currentAttendancePct).
  document.getElementById("matchDetailTickets").textContent = ticketRevenue
    ? `🎟️ Público: ${ticketRevenue.attendance.toLocaleString("pt-BR")} / ${ticketRevenue.capacity.toLocaleString("pt-BR")} (${Math.round(ticketRevenue.pct * 100)}%) · Renda: ${fmtBRL(ticketRevenue.revenue)}`
    : "";
  PENDING_ROUND_SUMMARY = summary;
  document.getElementById("matchDetailOverlay").classList.add("open");
}
// 2º modal: placar dos 20 times nessa rodada + trocas forçadas de
// escalação (jogador que ficou indisponível — ver autoFixLineup),
// quando houve. "Continuar" leva pra Tabela já atualizada.
function showRoundResultsModal(summary) {
  document.getElementById("roundResultsRound").textContent = summary.round;
  document.getElementById("roundResultsList").innerHTML = summary.allResults.map((r) => {
    const home = teamById(r.home), away = teamById(r.away);
    const isMe = String(r.home) === String(CAREER.clubId) || String(r.away) === String(CAREER.clubId);
    return `<div class="ct-round-result-row ${isMe ? "me" : ""}">
      <div class="ct-rr-team">${crestImg(home, 22)}<span>${escapeHtml(home.short || home.name)}</span></div>
      <span class="ct-rr-score">${r.gh} <small>x</small> ${r.ga}</span>
      <div class="ct-rr-team right">${crestImg(away, 22)}<span>${escapeHtml(away.short || away.name)}</span></div>
    </div>`;
  }).join("");
  document.getElementById("roundResultsChanges").textContent = (summary.lineupChanges && summary.lineupChanges.length)
    ? `Mudanças no time pra próxima rodada: ${summary.lineupChanges.join("; ")}.`
    : "";
  // FASE 2 (b) — folha salarial paga nessa rodada (ver simulateRound)
  // e caixa restante, pra dar pra acompanhar o orçamento sem precisar
  // ir até a Central toda vez.
  document.getElementById("roundResultsFinance").textContent = summary.wagePaid
    ? `Salários pagos: ${fmtBRL(summary.wagePaid)} · Caixa: ${fmtBRL(CAREER.finances.cash)}`
    : "";
  // FASE 2 (c) — avisa aqui se surgiu proposta nova por um jogador seu
  // (resolvida na aba Mercado com aceitar/recusar).
  document.getElementById("roundResultsOffer").textContent = summary.newOffer
    ? `💰 Proposta recebida: ${summary.newOffer.clubName} oferece ${fmtBRL(summary.newOffer.fee)} pelo jogador ${abbreviateName(summary.newOffer.playerName)} — veja na aba Mercado.`
    : "";
  // FASE 2 (a) — Copa do Brasil: só existe summary.cup nas 4 rodadas
  // certas com seu clube ainda vivo (ver resolveCupPhase).
  document.getElementById("roundResultsCup").innerHTML = summary.cup ? cupRoundResultsHTML(summary.cup) : "";
  PENDING_ROUND_SUMMARY = null;
  document.getElementById("roundResultsOverlay").classList.add("open");
}
// Lista os confrontos da fase da Copa que acabou de rolar (mesmo
// componente visual .ct-round-result-row/.me da lista de resultados do
// Brasileirão) + uma linha de status (classificado/eliminado/campeão)
// pro SEU confronto especificamente.
function cupRoundResultsHTML(cupResult) {
  const { phase, results } = cupResult;
  const rows = results.map((tie) => {
    const home = teamById(tie.home), away = teamById(tie.away);
    const isMe = String(tie.home) === String(CAREER.clubId) || String(tie.away) === String(CAREER.clubId);
    return `<div class="ct-round-result-row ${isMe ? "me" : ""}">
      <div class="ct-rr-team">${crestImg(home, 22)}<span>${escapeHtml(home.short || home.name)}</span></div>
      <span class="ct-rr-score">${tie.gh} <small>x</small> ${tie.ga}${tie.penalties ? " <small>(pên.)</small>" : ""}</span>
      <div class="ct-rr-team right">${crestImg(away, 22)}<span>${escapeHtml(away.short || away.name)}</span></div>
    </div>`;
  }).join("");
  const cup = CAREER.cup;
  let statusLine = "";
  if (cup.championIsHuman && phase === "final") {
    statusLine = `<p class="ct-sub" style="color:var(--gold); font-weight:700; margin-top:8px;">🏆 Campeão da Copa do Brasil ${CAREER.seasonYear}!</p>`;
  } else if (!cup.humanAlive && cup.humanEliminatedStage === phase) {
    statusLine = `<p class="ct-sub" style="color:var(--brd-red); font-weight:700; margin-top:8px;">❌ Eliminado da Copa do Brasil nas ${CUP_PHASE_LABEL[phase]}.</p>`;
  } else if (cup.humanAlive) {
    statusLine = `<p class="ct-sub" style="color:var(--gold); font-weight:700; margin-top:8px;">✅ Classificado pra ${CUP_PHASE_LABEL[cup.phase]} da Copa do Brasil!</p>`;
  }
  return `<h3 class="ct-stats-table-title" style="margin-top:14px;">🏆 Copa do Brasil — ${CUP_PHASE_LABEL[phase]}</h3>${rows}${statusLine}`;
}
// FASE 3 (c) — modal de resumo ao avançar de temporada (ver
// advanceSeason). Sem botão X de propósito — só "Começar a temporada"
// mesmo, igual às outras 2 modais do fluxo de "Simular rodada".
function showSeasonModal(result) {
  const { finishedYear, finishedPos, finishedGoal, goalWasMet, newYear, humanRenewal, newGoal } = result;
  document.getElementById("seasonModalSub").textContent = `Temporada ${newYear}`;
  const leaving = humanRenewal.leavingNames;
  // FASE 1 (item 3) — mostra se bateu a meta da temporada que terminou
  // ANTES do resto do resumo (pedido do documento: "mostrar se bateu
  // ou não antes do texto de posição final"), e já anuncia a meta da
  // temporada nova que está começando.
  const parts = [
    `Meta da diretoria em ${finishedYear} (${finishedGoal.label}): ${goalWasMet ? "✅ batida!" : "❌ não batida."}`,
    `Temporada ${finishedYear} terminou em ${finishedPos}º lugar.`,
    `Novo teto salarial: ${fmtBRL(CAREER.finances.wageCap)} · Caixa: ${fmtBRL(CAREER.finances.cash)}.`,
    `${humanRenewal.newBaseCount} jovem(ns) novo(s) na base` + (humanRenewal.newPrincipalCount ? ` e ${humanRenewal.newPrincipalCount} contratação(ões) no principal` : "") + ".",
    `Meta da diretoria pra ${newYear}: ${newGoal.label}.`,
  ];
  document.getElementById("seasonSummaryText").textContent = parts.join(" ");
  document.getElementById("seasonDepartures").innerHTML = leaving.length
    ? `<p class="ct-sub"><b>Saíram por fim de contrato:</b> ${leaving.map((n) => escapeHtml(abbreviateName(n))).join(", ")}.</p>`
    : "";
  document.getElementById("seasonOverlay").classList.add("open");
}
// FASE 1 (item 3) — demissão: modal separado (sem "Começar a
// temporada" nenhuma pra mostrar — a carreira NESSE clube acabou aqui).
// "Escolher outro clube" apaga o save (mesmo endpoint do "Reiniciar",
// ver btnRestart) e volta pro picker — decisão de manter simples
// (o documento só pede "volta pra tela Escolha do clube", sem prever
// nenhum estado de "técnico livre no mercado" entre uma carreira e
// outra).
function showDismissalModal(result) {
  const { finishedYear, finishedPos, finishedGoal, streak } = result;
  document.getElementById("dismissalClub").textContent = CAREER.clubName;
  document.getElementById("dismissalText").textContent =
    `A diretoria do ${CAREER.clubName} decidiu pelo seu desligamento: são ${streak} temporadas seguidas sem bater a meta (a mais recente, ${finishedYear}: ${finishedGoal.label} — terminou em ${finishedPos}º lugar).`;
  document.getElementById("dismissalOverlay").classList.add("open");
}

// Pedido do usuário: "transforme todas as caixas de diálogo em
// modais — o navegador bloqueia caixas e não vai rolar deixar assim".
// window.confirm() é bloqueado silenciosamente em vários contextos de
// navegador in-app/PWA — sem aviso nenhum, o "if (!confirm(...))"
// simplesmente nunca avança. Substitui TODO confirm() do jogo por essa
// modal, que devolve uma Promise<boolean> (true = confirmou, false =
// cancelou ou fechou clicando fora) no lugar do valor síncrono que
// confirm() devolvia — por isso todo chamador precisa de "await" na
// frente agora (ver buyPlayer/sellPlayer/btnRestart/btnAdvanceSeason).
function confirmModal(text, okLabel = "Confirmar") {
  return new Promise((resolve) => {
    const overlay = document.getElementById("confirmOverlay");
    const okBtn = document.getElementById("confirmOkBtn");
    const cancelBtn = document.getElementById("confirmCancelBtn");
    document.getElementById("confirmText").textContent = text;
    okBtn.textContent = okLabel;
    overlay.classList.add("open");
    function cleanup(result) {
      overlay.classList.remove("open");
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      overlay.removeEventListener("click", onBackdrop);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    function onBackdrop(e) { if (e.target === overlay) cleanup(false); }
    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    overlay.addEventListener("click", onBackdrop);
  });
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
  // FASE 3 (item 2) — mesmas opções do sub-modal de tática ao vivo,
  // reaproveitadas das constantes de sempre (ver openLiveTacticsModal).
  populateSelect("liveTacticsFormation", Object.keys(FORMATIONS).map((k) => [k, k]));
  populateSelect("liveTacticsMentality", TACTIC_OPTIONS.mentality);
  populateSelect("liveTacticsMarking", TACTIC_OPTIONS.marking);
  populateSelect("liveTacticsTempo", TACTIC_OPTIONS.tempo);

  document.querySelectorAll(".ct-tab").forEach((btn) => {
    btn.addEventListener("click", () => switchToPanel(btn.dataset.panel));
  });
  // Pedido do usuário: textos explicativos (ex.: "Clique num jogador
  // pra ver detalhes..." abaixo de Elenco principal/Categoria de base)
  // saem fixos da tela — viram um "?" ao lado do título, clicável, que
  // revela/esconde a explicação (ver .ct-help-text[hidden] no CSS).
  document.querySelectorAll(".ct-help-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = document.getElementById(btn.dataset.help);
      if (target) target.hidden = !target.hidden;
    });
  });

  document.getElementById("formationSelect").addEventListener("change", (e) => {
    CAREER.lineup.formation = e.target.value;
    renderPitch();
  });
  document.getElementById("btnAutoLineup").addEventListener("click", autoFillLineup);
  document.getElementById("btnSaveLineup").addEventListener("click", () => {
    CAREER.lineup.tactics.mentality = document.getElementById("tacticMentality").value;
    CAREER.lineup.tactics.marking = document.getElementById("tacticMarking").value;
    CAREER.lineup.tactics.tempo = document.getElementById("tacticTempo").value;
    CAREER.trainingFocus = document.getElementById("trainingFocus").value;
    persistCareer();
    toast("Escalação e táticas salvas.");
    renderCentral();
  });

  // Fluxo de "Simular rodada" (pedido do usuário): modal com o jogo do
  // clube (resultado/gols/assistências/cartões) -> "Continuar" -> modal
  // com o resultado da rodada inteira (+ trocas forçadas de escalação,
  // se houve) -> "Continuar" -> aba Tabela já atualizada. Ver
  // showMatchDetailModal/showRoundResultsModal.
  document.getElementById("btnSimulate").addEventListener("click", async () => {
    const btn = document.getElementById("btnSimulate");
    btn.disabled = true;
    const summary = simulateRound();
    // FASE 3 (itens 1 e 2) — existindo jogo seu na rodada,
    // simulateRound() já abriu a tela Ao Vivo e devolve o sentinela
    // "live" — o resto do fluxo (persistir/renderizar/mostrar os
    // modais de sempre) roda sozinho quando a partida termina, ver
    // finishLiveMatch. Só reabilita o botão se o fluxo antigo (sem
    // jogo seu, ver resolveRoundInstant) rodou de verdade.
    if (summary === "live") return;
    const saved = await persistCareer();
    // Se não deu pra salvar (ex.: sessão expirada — ver persistCareer),
    // não mostra o modal do jogo por cima da tela de login: ela já foi
    // trocada lá dentro, e ao logar de novo o save do servidor (sem
    // essa rodada) é recarregado mesmo.
    if (!saved) { btn.disabled = false; return; }
    renderAll();
    if (summary) showMatchDetailModal(summary);
  });
  // FASE 3 (itens 1 e 2) — botões fixos da tela Ao Vivo (substituição/
  // tática) e os 2 sub-modais que eles abrem, mesmo padrão de
  // fechamento dos outros sub-modais (X e clique fora cancelam sem
  // aplicar nada — ver closeLiveSubModal/closeLiveTacticsModal, que só
  // retomam a progressão da partida).
  document.getElementById("btnLiveSkip").addEventListener("click", skipLiveMatch);
  // Pedido do usuário: toda modal precisa de X. Aqui não tem "fechar
  // de verdade" possível (sair no meio perderia a partida) — o X
  // resolve o resto na hora, mesmo efeito de "Pular pro fim".
  document.getElementById("liveMatchClose").addEventListener("click", skipLiveMatch);
  document.getElementById("btnLiveSub").addEventListener("click", openLiveSubModal);
  document.getElementById("liveSubClose").addEventListener("click", closeLiveSubModal);
  document.getElementById("liveSubOverlay").addEventListener("click", (e) => { if (e.target.id === "liveSubOverlay") closeLiveSubModal(); });
  document.getElementById("btnLiveSubConfirm").addEventListener("click", confirmLiveSub);
  document.getElementById("btnLiveTactics").addEventListener("click", openLiveTacticsModal);
  document.getElementById("liveTacticsClose").addEventListener("click", closeLiveTacticsModal);
  document.getElementById("liveTacticsOverlay").addEventListener("click", (e) => { if (e.target.id === "liveTacticsOverlay") closeLiveTacticsModal(); });
  document.getElementById("btnLiveTacticsConfirm").addEventListener("click", confirmLiveTactics);
  document.getElementById("btnMatchDetailContinue").addEventListener("click", () => {
    document.getElementById("matchDetailOverlay").classList.remove("open");
    if (PENDING_ROUND_SUMMARY) showRoundResultsModal(PENDING_ROUND_SUMMARY);
  });
  document.getElementById("btnRoundResultsContinue").addEventListener("click", () => {
    document.getElementById("roundResultsOverlay").classList.remove("open");
    openTabelaModal();
  });
  document.getElementById("tabelaModalClose").addEventListener("click", closeTabelaModal);
  document.getElementById("tabelaModalOverlay").addEventListener("click", (e) => { if (e.target.id === "tabelaModalOverlay") closeTabelaModal(); });

  document.getElementById("btnRestart").addEventListener("click", async () => {
    document.getElementById("topbarMenu").classList.remove("open");
    if (!CAREER) return;
    if (!(await confirmModal(`Isso vai apagar sua carreira atual no ${CAREER.clubName} e começar do zero. Continuar?`, "Apagar e reiniciar"))) return;
    await fetchJSON("/api/career", { method: "DELETE" }).catch(() => {});
    CAREER = null;
    renderClubPicker();
    show("screenPicker");
  });

  // Menu hambúrguer (pedido do usuário: header enxuto, ações que
  // ficavam soltas no header — Reiniciar — mais Sair (novo) dentro de
  // um menu). Fecha ao clicar em qualquer item, ao clicar fora, ou de
  // novo no próprio botão.
  document.getElementById("btnTopbarMenu").addEventListener("click", (e) => {
    e.stopPropagation();
    const menu = document.getElementById("topbarMenu");
    const willOpen = !menu.classList.contains("open");
    menu.classList.toggle("open", willOpen);
    document.getElementById("btnTopbarMenu").setAttribute("aria-expanded", String(willOpen));
  });
  document.addEventListener("click", (e) => {
    const menu = document.getElementById("topbarMenu");
    if (menu.classList.contains("open") && !menu.contains(e.target) && e.target.id !== "btnTopbarMenu") {
      menu.classList.remove("open");
      document.getElementById("btnTopbarMenu").setAttribute("aria-expanded", "false");
    }
  });
  document.getElementById("btnLogout").addEventListener("click", async () => {
    document.getElementById("topbarMenu").classList.remove("open");
    try { await fetchJSON("/api/auth/logout", { method: "POST" }); } catch { /* segue mesmo se falhar */ }
    location.href = "/";
  });

  // FASE 2 (c) — Mercado: busca/filtro re-renderizam a lista na hora
  // (sem debounce — a lista é local, filtrar de novo é instantâneo).
  document.getElementById("marketSearch").addEventListener("input", renderMercado);
  document.getElementById("marketPosFilter").addEventListener("change", renderMercado);
  document.getElementById("btnAcceptOffer").addEventListener("click", acceptOffer);
  document.getElementById("btnDeclineOffer").addEventListener("click", declineOffer);
  document.getElementById("btnAskBoard").addEventListener("click", askBoard);

  // FASE 3 (c) — multitemporadas: avança a temporada (ver
  // advanceSeason) e mostra o resumo antes de liberar a Rodada 1 nova.
  document.getElementById("btnAdvanceSeason").addEventListener("click", async () => {
    if (!(await confirmModal(`Avançar pra Temporada ${CAREER.seasonYear + 1}? O elenco envelhece, contratos vencidos saem e a base renova.`, "Avançar"))) return;
    const result = advanceSeason();
    if (!result) return;
    persistCareer();
    // FASE 1 (item 3) — demitido: modal diferente (sem "começar a
    // temporada", ver showDismissalModal), a carreira NESSE clube já
    // acabou aqui.
    if (result.dismissed) showDismissalModal(result);
    else showSeasonModal(result);
  });
  // Pedido do usuário: toda modal precisa de X. A temporada já virou
  // de verdade ANTES desse resumo aparecer (ver advanceSeason, chamado
  // antes de showSeasonModal) — o X só fecha e atualiza a tela, mesmo
  // efeito de "Começar a temporada".
  document.getElementById("btnSeasonContinue").addEventListener("click", () => {
    document.getElementById("seasonOverlay").classList.remove("open");
    renderAll();
  });
  document.getElementById("seasonModalClose").addEventListener("click", () => {
    document.getElementById("seasonOverlay").classList.remove("open");
    renderAll();
  });
  document.getElementById("btnDismissalContinue").addEventListener("click", async () => {
    document.getElementById("dismissalOverlay").classList.remove("open");
    await fetchJSON("/api/career", { method: "DELETE" }).catch(() => {});
    CAREER = null;
    renderClubPicker();
    show("screenPicker");
  });
  // O X aqui só fecha (SEM apagar o save) — a demissão em si só
  // acontece de verdade em "Escolher outro clube" (ver comentário na
  // modal, em carreira.html).
  document.getElementById("dismissalModalClose").addEventListener("click", () => {
    document.getElementById("dismissalOverlay").classList.remove("open");
  });

  document.getElementById("pickerClose").addEventListener("click", () => document.getElementById("pickerOverlay").classList.remove("open"));
  document.getElementById("pickerOverlay").addEventListener("click", (e) => { if (e.target.id === "pickerOverlay") e.currentTarget.classList.remove("open"); });
  document.getElementById("detailClose").addEventListener("click", () => document.getElementById("detailOverlay").classList.remove("open"));
  document.getElementById("detailOverlay").addEventListener("click", (e) => { if (e.target.id === "detailOverlay") e.currentTarget.classList.remove("open"); });
  // FASE 1 (item 1) — sub-modal de renovação, mesmo padrão de
  // fechamento dos outros (X e clique fora fecham sem propor nada).
  document.getElementById("renewClose").addEventListener("click", closeRenewModal);
  document.getElementById("renewOverlay").addEventListener("click", (e) => { if (e.target.id === "renewOverlay") closeRenewModal(); });
  document.getElementById("btnRenewPropose").addEventListener("click", proposeRenewal);
  // FASE 3 (item 3) — sub-modal de configuração de empréstimo, mesmo
  // padrão de fechamento dos outros (X e clique fora fecham sem
  // confirmar nada). Campo de valor da cláusula só aparece quando a
  // cláusula não é "nenhuma".
  document.getElementById("loanClose").addEventListener("click", closeLoanModal);
  document.getElementById("loanOverlay").addEventListener("click", (e) => { if (e.target.id === "loanOverlay") closeLoanModal(); });
  document.getElementById("btnLoanConfirm").addEventListener("click", confirmLoanFromModal);
  document.getElementById("loanBuyClauseSelect").addEventListener("change", (e) => {
    document.getElementById("loanBuyValueField").classList.toggle("hidden", e.target.value === "nenhuma");
  });
  // Pedido do usuário: X também nas modais de detalhe do jogo e de
  // resultados da rodada (só fecha, igual às outras 2 — quem quiser ver
  // o próximo passo do fluxo clica em "Continuar" mesmo).
  document.getElementById("matchDetailClose").addEventListener("click", () => document.getElementById("matchDetailOverlay").classList.remove("open"));
  document.getElementById("matchDetailOverlay").addEventListener("click", (e) => { if (e.target.id === "matchDetailOverlay") e.currentTarget.classList.remove("open"); });
  document.getElementById("roundResultsClose").addEventListener("click", () => document.getElementById("roundResultsOverlay").classList.remove("open"));
  document.getElementById("roundResultsOverlay").addEventListener("click", (e) => { if (e.target.id === "roundResultsOverlay") e.currentTarget.classList.remove("open"); });

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
// BUG CORRIGIDO ("não deu pra carregar o Modo Técnico" — relato do
// usuário logo depois do merge da Fase 3c): quem tem uma carreira
// ativa desde ANTES de alguma das fases 2/3 (bem provável numa
// carreira de teste que nunca foi reiniciada ao longo de várias
// sessões) carrega um save sem os campos novos dessas fases —
// CAREER.finances, por exemplo, nem existia antes da Fase 2b.
// renderCentral() faz `const { cash, wageCap } = CAREER.finances`
// direto (sem checar undefined antes) — com um save desses, essa
// linha lança exceção assim que a tela do jogo tenta renderizar,
// pega no catch genérico do boot() e mostra só "não deu pra carregar",
// sem dar nenhuma pista de qual campo faltava. Preenche todo campo que
// alguma fase adicionou desde o save mais simples de sempre (só
// clubId+squad+lineup+schedule+standings+currentRound), pra abrir sem
// quebrar não importa de qual fase seja o save.
function migrateCareerDefaults() {
  if (!CAREER.leagueSquads) CAREER.leagueSquads = {};
  // Jogador criado antes da Fase 2b não tem wage/value/contractUntil
  // nenhum (esses campos só existem desde que buildRealPlayer/
  // buildBasePlayer/buildGeneratedProPlayer passaram a chamar
  // computeContractFields) — sem isso, wageBillOf soma 0 pra ele
  // (`p.wage || 0`) e o orçamento migrado abaixo nasceria zerado.
  const backfillContract = (p) => {
    if (p.wage == null) {
      const rng = seededRngFromKey(`contract-backfill:${p.id}`);
      Object.assign(p, computeContractFields(p.overall, p.age, p.potential || null, rng));
    }
    // FASE 2 (b) — jogador criado antes da moral existir nasce no
    // mesmo neutro (70) de quem é criado hoje.
    if (p.morale == null) p.morale = 70;
  };
  CAREER.squad.forEach(backfillContract);
  Object.values(CAREER.leagueSquads).forEach((squad) => squad.forEach(backfillContract));
  if (!CAREER.finances) CAREER.finances = initialFinances(CAREER.squad);
  if (!CAREER.teamStats) CAREER.teamStats = { assists: 0, yellow: 0, red: 0 };
  if (!CAREER.transferLog) CAREER.transferLog = [];
  if (CAREER.pendingOffer === undefined) CAREER.pendingOffer = null;
  if (CAREER.lastBoardRequestRound === undefined) CAREER.lastBoardRequestRound = null;
  if (CAREER.boardDecision == null) CAREER.boardDecision = "";
  if (!CAREER.recentForm) CAREER.recentForm = [];
  if (!CAREER.seasonYear) CAREER.seasonYear = LIVE_SEASON;
  if (!CAREER.seasonHistory) CAREER.seasonHistory = [];
  // FASE 1 (item 3) — carreira criada antes dessa fase não tem meta
  // nenhuma: calcula uma pro elenco atual (mesma função de sempre) em
  // vez de deixar sem meta pro resto da temporada em andamento.
  if (!CAREER.boardGoal) CAREER.boardGoal = computeBoardGoal();
  if (CAREER.negativeSeasonsStreak == null) CAREER.negativeSeasonsStreak = 0;
  // FASE 2 (a) — carreira criada antes da Copa do Brasil existir: monta
  // um chaveamento novo e fecha por trás (fast-forward, sem prêmio nem
  // log) qualquer fase cujo round já passou nessa temporada em
  // andamento — ver comentário em setupCup.
  if (!CAREER.cup) setupCup(CAREER.currentRound);
}
async function enterAfterAuth() {
  show("screenLoading");
  document.getElementById("screenLoading").innerHTML = `<div class="ct-spinner"></div><p>Carregando o Modo Técnico...</p>`;
  await loadLeague();
  const saved = await fetchJSON("/api/career").catch(() => ({ career: null }));
  if (saved && saved.career) {
    CAREER = saved.career;
    migrateCareerDefaults();
    persistCareer(); // grava os campos novos pra não migrar de novo (e de novo) a cada load
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
    // BUG CORRIGIDO (relato do usuário: "não deu pra carregar" sem
    // detalhe nenhum, sem acesso ao console do celular pra saber o
    // motivo real): mostra a mensagem/stack do erro na própria tela,
    // igual já fizemos antes pro toast de "não deu pra salvar".
    document.getElementById("screenLoading").innerHTML =
      `<p>Não deu pra carregar o Modo Técnico agora.</p>
       <p class="ct-sub" style="max-width:340px; word-break:break-word;">${escapeHtml(err && (err.stack || err.message) || String(err))}</p>
       <p><a href="/carreira">Tentar de novo</a></p>`;
  }
}

document.addEventListener("DOMContentLoaded", boot);
