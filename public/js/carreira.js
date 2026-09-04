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
// AJUSTE (Bloco 2 M3 — brtreinadorbloco2tatica.html, "seja fiel às
// features e ao design") — as 3 categorias nomeadas (mentalidade/
// marcação/ritmo, 2-3 opções cada) viram 4 EIXOS REAIS em escala 1-5
// (Ritmo de jogo/Pressão/Linha defensiva/Estilo de passe), confirmado
// com o usuário antes de implementar ("Expandir pra 4 eixos reais" —
// não é só um reskin visual do <select> pra barra, a granularidade e os
// próprios eixos mudam de verdade). Nível 3 = centro/neutro (sem
// modificador nenhum); cada eixo pesa um pouco de atk contra um pouco
// de def por PASSO de distância do centro (nunca mais que ±10%
// isolado, na mesma ordem de grandeza do sistema antigo de 3
// categorias) — combinados multiplicativamente igual sempre (ver
// computeHumanStrength).
const TACTIC_AXES = [
  { id: "ritmo", label: "Ritmo de jogo", lowLabel: "Muito paciente", highLabel: "Muito direto" },
  { id: "pressao", label: "Pressão", lowLabel: "Baixa", highLabel: "Alta" },
  { id: "linhaDefensiva", label: "Linha defensiva", lowLabel: "Recuada", highLabel: "Adiantada" },
  { id: "estiloPasse", label: "Estilo de passe", lowLabel: "Curto", highLabel: "Bola longa" },
];
const TACTIC_AXIS_DELTA = {
  ritmo: { atk: 0.025, def: -0.02 },
  pressao: { atk: 0.02, def: -0.025 },
  linhaDefensiva: { atk: 0.015, def: -0.025 },
  estiloPasse: { atk: 0.02, def: -0.015 },
};
function tacticAxisMod(axisId, level) {
  const d = TACTIC_AXIS_DELTA[axisId];
  const steps = (level == null ? 3 : level) - 3; // -2..+2
  return { atk: 1 + d.atk * steps, def: 1 + d.def * steps };
}
// Combina os 4 eixos (+ a camada opcional de Instruções por setor, ver
// TACTIC_SECTOR_* mais abaixo) num único par {atk,def} multiplicativo —
// usado por computeHumanStrength (única chamadora, tática só afeta o
// SEU próprio jogo, nunca CPU x CPU).
function combinedTacticMod() {
  const t = CAREER.lineup.tactics || {};
  let atk = 1, def = 1;
  TACTIC_AXES.forEach((ax) => {
    const m = tacticAxisMod(ax.id, t[ax.id]);
    atk *= m.atk; def *= m.def;
  });
  const sectorMod = combinedSectorTacticMod();
  atk *= sectorMod.atk; def *= sectorMod.def;
  // Segurança: 19 dials ao todo (4 eixos gerais + 15 instruções por
  // setor) combinados multiplicativamente PODERIAM, no extremo teórico
  // de maximizar todos na mesma direção, compor um multiplicador bem
  // maior que qualquer categoria isolada já produzia antes — trava no
  // mesmo teto que o resto do motor já respeita pra atk/def efetivos
  // (computeHumanStrength usa 0.7-1.3 pros outros multiplicadores).
  return { atk: clamp(atk, 0.7, 1.35), def: clamp(def, 0.7, 1.35) };
}
// AJUSTE (Bloco 2 M3 — Instruções por setor, brtreinadorbloco2pendentes.html)
// — camada de ajuste fino ADICIONAL sobre os 4 eixos gerais (não os
// substitui — o doc do mockup fala "em vez de só 4 sliders gerais",
// mas manter os dois sistemas juntos, o setorial só refinando por cima,
// evita ter 2 fontes de verdade conflitantes pro mesmo conceito).
// Magnitude por passo é a METADE da dos eixos gerais de propósito —
// é uma camada de refinamento, não um sistema paralelo do mesmo peso.
// Nível 3 = neutro (mesma convenção dos eixos gerais).
const SECTOR_INSTRUCTIONS = {
  defesa: [
    { id: "linhaDefensivaSetor", label: "Linha defensiva", lowLabel: "Recuada", highLabel: "Adiantada", atk: 0.008, def: -0.01 },
    { id: "pressaoPosPerda", label: "Pressão pós-perda", lowLabel: "Baixa", highLabel: "Alta", atk: 0.006, def: -0.01 },
    { id: "compactacao", label: "Compactação", lowLabel: "Aberta", highLabel: "Compacta", atk: -0.004, def: 0.01 },
    { id: "saidaDeBola", label: "Saída de bola", lowLabel: "Direta", highLabel: "Construída", atk: 0.006, def: 0.004 },
    { id: "bolaParadaDefensiva", label: "Bola parada defensiva", lowLabel: "Zona", highLabel: "Individual", atk: 0, def: 0.008 },
  ],
  meio: [
    { id: "marcacaoIntensidade", label: "Intensidade de marcação", lowLabel: "Leve", highLabel: "Severa", atk: 0.004, def: 0.008 },
    { id: "amplitude", label: "Amplitude", lowLabel: "Estreito", highLabel: "Largo", atk: 0.008, def: -0.004 },
    { id: "transicao", label: "Transição defesa-ataque", lowLabel: "Lenta", highLabel: "Rápida", atk: 0.01, def: -0.006 },
    { id: "rotacaoDeBola", label: "Rotação de bola", lowLabel: "Direta", highLabel: "Construída", atk: 0.006, def: 0.004 },
    { id: "coberturaEspacos", label: "Cobertura de espaços", lowLabel: "Individual", highLabel: "Coletiva", atk: -0.004, def: 0.01 },
  ],
  ataque: [
    { id: "amplitudeOfensiva", label: "Amplitude ofensiva", lowLabel: "Concentrado", highLabel: "Aberto", atk: 0.008, def: -0.004 },
    { id: "movimentacao", label: "Movimentação sem bola", lowLabel: "Estática", highLabel: "Dinâmica", atk: 0.01, def: -0.002 },
    { id: "ultimosPasses", label: "Últimos passes", lowLabel: "Seguros", highLabel: "Arriscados", atk: 0.012, def: -0.008 },
    { id: "finalizacao", label: "Finalização", lowLabel: "Seletiva", highLabel: "Voluntariosa", atk: 0.01, def: -0.006 },
    { id: "bolaParadaOfensiva", label: "Bola parada ofensiva", lowLabel: "Direta", highLabel: "Trabalhada", atk: 0.008, def: 0 },
  ],
};
const SECTOR_IDS = Object.keys(SECTOR_INSTRUCTIONS); // ["defesa", "meio", "ataque"]
const SECTOR_LABEL = { defesa: "Defesa", meio: "Meio", ataque: "Ataque" };
function defaultSectorTactics() {
  const out = {};
  SECTOR_IDS.forEach((sector) => {
    out[sector] = {};
    SECTOR_INSTRUCTIONS[sector].forEach((instr) => { out[sector][instr.id] = 3; });
  });
  return out;
}
function combinedSectorTacticMod() {
  const st = CAREER.lineup && CAREER.lineup.sectorTactics;
  let atk = 1, def = 1;
  if (!st) return { atk, def };
  SECTOR_IDS.forEach((sector) => {
    const values = st[sector] || {};
    SECTOR_INSTRUCTIONS[sector].forEach((instr) => {
      const level = values[instr.id] == null ? 3 : values[instr.id];
      const steps = level - 3;
      atk *= 1 + instr.atk * steps;
      def *= 1 + instr.def * steps;
    });
  });
  return { atk, def };
}
// AJUSTE (pedido do usuário: "vamos evoluir o método de treinos",
// BRDataTreinadorBriefingTreinos_2.docx) — TRAINING_OPTIONS/TRAINING_MOD
// (o antigo seletor "Foco de treino" da Escalação, com um multiplicador
// de ataque/defesa fixo por partida) foram RETIRADOS por completo,
// substituídos pelo módulo de treinos novo (ver TRAINING_SCHEMES mais
// abaixo). O efeito de "time cansado rende menos" que o multiplicador
// tentava aproximar já é coberto por avgCond logo abaixo (condição
// física média do time titular) — agora com peso real, já que treinar
// de verdade custa condição (ver applyWeeklyTraining).
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
// AJUSTE (pedido do usuário: "acrescentar a Série B, C [ao Modo
// Carreira] com dados reais") — qual campeonato está carregado em
// LEAGUE_TEAMS agora ("brasileirao"/"serie_b"/"serie_c", mesmos ids de
// server/src/competitions.js) — usado por loadLeague/fetchRealPlayers
// pra saber qual endpoint/fallback de exemplo usar, e gravado em
// CAREER.competitionId na criação da carreira (ver startCareer) pra
// carregar o campeonato certo ao retomar uma carreira salva.
let CURRENT_COMPETITION_ID = "brasileirao";
// AJUSTE (pedido do usuário: "o mercado deve trazer jogadores das 3
// ligas para que transações possam ser feitas entre os 60 times das
// Séries A, B e C") — LIVE_MODE (acima) e LEAGUE_TEAMS só cobrem a
// competição da PRÓPRIA carreira (calendário/tabela/Ao Vivo continuam
// só entre os 20 times dela — isso não muda). Pro mercado de 60
// times, precisa saber o estado ao vivo/exemplo de CADA UMA das 3
// competições ao mesmo tempo (LIVE_MODE_BY_COMPETITION, ver
// fetchCompetitionTeams/loadOtherCompetitionsTeams) e ter os times
// das outras 2 numa lista à parte, cada um marcado com a própria
// competitionId pro selo na tela (ALL_TEAMS_FLAT, ver
// loadOtherCompetitionsTeams) — nenhuma delas troca o
// comportamento de LEAGUE_TEAMS/LIVE_MODE pra quem já existia.
const ALL_COMPETITIONS_ORDER = ["brasileirao", "serie_b", "serie_c"];
let LIVE_MODE_BY_COMPETITION = {};
let ALL_TEAMS_FLAT = [];
let CAREER = null;     // save inteiro da carreira atual (null = sem carreira ainda)
let PICKER_CTX = null; // contexto do modal de escolha de jogador ({type:"slot",index}, {type:"bench",currentId} ou {type:"training",day})
let PENDING_ROUND_SUMMARY = null; // resumo da rodada entre o modal de detalhe do jogo e o de resultados (ver simulateRound)
let TRAINING_SELECTED_DAY = 0; // dia da semana selecionado na tela de Treinos (0=segunda), só estado de UI — não é salvo
let ME = null; // resposta de /api/auth/me (ver boot) -- id/nome/friendCode/friends/dailyLogin/createdAt da CONTA logada, não da carreira

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

/* ---------- Redesign M3 (BRTreinadorSistemadeDesignM3v1.docx +
   brtreinadormockupsm3.zip) — cor dinâmica por clube ----------
   Documento, seção 2.2: "a cor primária é derivada da cor dominante
   do escudo... secundária e terciária seguem a relação de matiz do M3
   (harmônicas ao primary, não escolhidas manualmente por clube)...
   fallback: se a cor derivada não atingir contraste mínimo AA, o
   sistema recai automaticamente no Verde de Campo".

   IMPLEMENTAÇÃO (decisão nossa, documentada): em vez de extrair cor de
   verdade da IMAGEM do escudo (frágil — precisaria de canvas, e o CDN
   de escudo real, quando existe, pode bloquear leitura de pixel por
   CORS) e em vez da biblioteca oficial do Google (Material Color
   Utilities, algoritmo HCT/CAM16 — exigiria um passo de build que este
   projeto não tem, é tudo <script> direto sem bundler), a "semente" é
   o MESMO `c1` já curado por clube (realTeamColor()/DEMO_TEAMS, usado
   há sessões inteiras pro gradiente do escudo) — e a expansão pra
   paleta tonal usa HSL puro, uma aproximação pragmática do algoritmo
   tonal do M3, não o CAM16 literal. Secundária reaproveita o MESMO
   matiz do primary com saturação bem mais baixa (~1/3, seguindo a
   proporção típica do M3 entre primary/secondary); terciária gira o
   matiz +60° — a "relação harmônica" pedida no documento, sem copiar
   o algoritmo exato do Google. */
function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, s, l];
}
function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r1 = 0, g1 = 0, b1 = 0;
  if (h < 60) { r1 = c; g1 = x; } else if (h < 120) { r1 = x; g1 = c; }
  else if (h < 180) { g1 = c; b1 = x; } else if (h < 240) { g1 = x; b1 = c; }
  else if (h < 300) { r1 = x; b1 = c; } else { r1 = c; b1 = x; }
  return { r: Math.round((r1 + m) * 255), g: Math.round((g1 + m) * 255), b: Math.round((b1 + m) * 255) };
}
function rgbToHex(r, g, b) {
  const h = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
// Luminância relativa + razão de contraste (WCAG 2.x) — mesma fórmula
// usada em toda checagem de contraste desta sessão (ver avaliação do
// documento de design).
function relativeLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
}
function contrastRatio(hexA, hexB) {
  const l1 = relativeLuminance(hexA), l2 = relativeLuminance(hexB);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}
// Tema padrão "Verde de Campo" (documento, seção 2) — usado em toda
// tela sem clube "dono" (login, escolha de clube/campeonato, telas de
// sistema) e como fallback de acessibilidade quando a cor derivada de
// um clube não atinge contraste mínimo.
const M3_DEFAULT_PALETTE = {
  primary: "#6DDB94", onPrimary: "#00391A", primaryContainer: "#005226", onPrimaryContainer: "#89F8AF",
  secondary: "#E3C16C", onSecondary: "#3F2E00", secondaryContainer: "#5A4400", onSecondaryContainer: "#FFDF9D",
  tertiary: "#9ECAFF", onTertiary: "#00325B", tertiaryContainer: "#00497F", onTertiaryContainer: "#D2E4FF",
};
function deriveClubPalette(seedHex) {
  const rgb = hexToRgb(seedHex);
  if (!rgb) return null;
  let [h, s] = rgbToHsl(rgb.r, rgb.g, rgb.b);
  // Preto/branco/cinza puro (ex. Botafogo, Corinthians: matiz indefinido
  // em HSL, a fórmula sempre devolve h=0/vermelho por artefato matemático,
  // não por escolha) -- fixa um matiz grafite neutro deliberado em vez de
  // herdar esse vermelho arbitrário (mesmo espírito do Material You: até
  // um papel de parede em tons de cinza gera um acento cromático de
  // propósito, nunca vermelho por acaso).
  if (s < 0.04) h = 220;
  const sat = clamp(s, 0.35, 0.85); // clube muito cinza/preto (ex. Corinthians) tem piso de saturação pra não virar cinza puro
  const tone = (hh, ss, ll) => { const c = hslToRgb(hh, ss, ll); return rgbToHex(c.r, c.g, c.b); };
  const primary = tone(h, sat, 0.68);
  const onPrimary = tone(h, sat, 0.14);
  const primaryContainer = tone(h, sat, 0.24);
  const onPrimaryContainer = tone(h, sat, 0.9);
  const secSat = clamp(s * 0.32, 0.12, 0.4);
  const secondary = tone(h, secSat, 0.66);
  const onSecondary = tone(h, secSat, 0.18);
  const secondaryContainer = tone(h, secSat, 0.28);
  const onSecondaryContainer = tone(h, secSat, 0.9);
  const th = (h + 60) % 360;
  const terSat = clamp(s * 0.55, 0.2, 0.6);
  const tertiary = tone(th, terSat, 0.7);
  const onTertiary = tone(th, terSat, 0.16);
  const tertiaryContainer = tone(th, terSat, 0.26);
  const onTertiaryContainer = tone(th, terSat, 0.9);
  const palette = {
    primary, onPrimary, primaryContainer, onPrimaryContainer,
    secondary, onSecondary, secondaryContainer, onSecondaryContainer,
    tertiary, onTertiary, tertiaryContainer, onTertiaryContainer,
  };
  // Fallback de acessibilidade (documento, seções 2.2/6): primary e
  // primary-container são os pares mais usados em texto/botão — se
  // qualquer um não alcançar 4.5:1 (AA texto normal), o clube inteiro
  // cai pro tema padrão em vez de aplicar uma combinação ilegível.
  if (contrastRatio(primary, onPrimary) < 4.5 || contrastRatio(primaryContainer, onPrimaryContainer) < 4.5) return null;
  return palette;
}
const M3_PALETTE_VARS = {
  primary: "--m3-primary", onPrimary: "--m3-on-primary",
  primaryContainer: "--m3-primary-container", onPrimaryContainer: "--m3-on-primary-container",
  secondary: "--m3-secondary", onSecondary: "--m3-on-secondary",
  secondaryContainer: "--m3-secondary-container", onSecondaryContainer: "--m3-on-secondary-container",
  tertiary: "--m3-tertiary", onTertiary: "--m3-on-tertiary",
  tertiaryContainer: "--m3-tertiary-container", onTertiaryContainer: "--m3-on-tertiary-container",
};
function applyM3Palette(palette) {
  const root = document.documentElement.style;
  Object.keys(M3_PALETTE_VARS).forEach((key) => root.setProperty(M3_PALETTE_VARS[key], palette[key]));
}
// Chamado ao entrar numa carreira (showGameScreen) -- club é o time do
// jogador (teamById(CAREER.clubId)). Telas sem carreira ativa (login,
// escolha de clube/campeonato, telas de sistema) nunca chamam isso —
// ficam nos valores literais do tema padrão já escritos no <style>.
function applyClubPalette(club) {
  const derived = club && club.c1 ? deriveClubPalette(club.c1) : null;
  applyM3Palette(derived || M3_DEFAULT_PALETTE);
}
// Chamado ao sair de uma carreira ativa (Reiniciar, Escolher outro
// clube, logout) -- devolve as superfícies dinâmicas pro tema padrão
// antes da próxima tela (que pode não ter clube nenhum ainda).
function resetToDefaultM3Palette() { applyM3Palette(M3_DEFAULT_PALETTE); }

// Nova feature (pedido do usuário: "criar uma tela de loading que deve
// aparecer sempre que uma ação demorar mais que 3 segundos") —
// fetchJSON é o ÚNICO ponto do app que faz requisição de rede (todo o
// resto do arquivo já passa por aqui, nenhum fetch() cru em lugar
// nenhum), então armar/desarmar o timer só AQUI já cobre toda ação de
// verdade (salvar carreira, comprar/vender jogador, simular rodada,
// login etc.) sem precisar tocar em cada chamador. ACTION_LOADING_DEPTH
// conta chamadas em voo ao mesmo tempo — só esconde quando a ÚLTIMA
// também termina (evita esconder cedo demais com 2+ chamadas
// simultâneas).
let ACTION_LOADING_TIMER = null;
let ACTION_LOADING_DEPTH = 0;
const ACTION_LOADING_DELAY_MS = 3000;
function beginActionLoading() {
  ACTION_LOADING_DEPTH++;
  if (ACTION_LOADING_TIMER) return; // já tem um timer armado por outra chamada em voo
  ACTION_LOADING_TIMER = setTimeout(() => {
    document.getElementById("actionLoadingOverlay").classList.add("open");
  }, ACTION_LOADING_DELAY_MS);
}
function endActionLoading() {
  ACTION_LOADING_DEPTH = Math.max(0, ACTION_LOADING_DEPTH - 1);
  if (ACTION_LOADING_DEPTH > 0) return; // outra chamada ainda em voo
  if (ACTION_LOADING_TIMER) { clearTimeout(ACTION_LOADING_TIMER); ACTION_LOADING_TIMER = null; }
  document.getElementById("actionLoadingOverlay").classList.remove("open");
}
async function fetchJSON(url, opts) {
  beginActionLoading();
  try {
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => null);
    if (!res.ok) { const e = new Error(data?.error || `Falha em ${url}`); e.status = res.status; e.code = data?.code; throw e; }
    return data;
  } finally {
    endActionLoading();
  }
}
let toastTimer = null;
// AJUSTE (pedido do usuário: "as mensagens que aparecem em várias
// situações no rodapé estão ficando acima dos botões") — .ct-toast
// tinha um bottom:18px fixo, sem saber que chrome fixo existe embaixo
// dele no momento (a nav inferior, e às vezes também a barra de ação
// da Central/Escalação — ou, com uma modal aberta por cima de tudo, o
// rodapé fixo DELA, ver .ct-modal-footer) — o toast ficava por trás/
// colado nesses botões em vez de flutuar por cima, limpo. Calcula na
// hora de mostrar, em vez de um valor fixo: com modal aberta, sobe
// acima do rodapé DELA (é o que cobre a tela, escondendo nav/barra de
// ação por baixo); sem modal, sobe acima da nav (+ a barra de ação,
// só quando o painel atual tiver uma — Central/Escalação). Onde não
// existe chrome fixo nenhum (login, escolha de clube, diálogos curtos
// sem rodapé fixo) cai no mesmo 18px de sempre.
// AJUSTE: offsetParent NÃO serve pra checar visibilidade aqui — um
// elemento position:fixed (a nav e a barra de ação são) devolve
// offsetParent nulo mesmo quando está bem visível na tela (gambiarra
// conhecida do próprio DOM, nada a ver com display:none). O jeito
// confiável de saber se um elemento realmente está renderizado (nem
// ele nem nenhum ancestral com display:none) é conferir se o retângulo
// que ele ocupa tem tamanho de verdade.
function isRendered(el) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}
function toastBottomOffset() {
  const openModals = document.querySelectorAll(".ct-modal-overlay.open");
  if (openModals.length) {
    // A última no HTML é a que está por cima quando há mais de uma
    // aberta ao mesmo tempo (ex.: Confirmar escalação + Ajustar
    // escalação) — mesma convenção de empilhamento usada no resto do
    // app (ver AJUSTE do #adjustLineupOverlay).
    const footer = openModals[openModals.length - 1].querySelector(".ct-modal-footer");
    return isRendered(footer) ? footer.getBoundingClientRect().height + 14 : 18;
  }
  // Redesign M3 — rodapé de #screenGame virou .m3-bottom-nav (ver
  // carreira.html); .mt-bottom-nav não existe mais nesse elemento, só
  // continua no CSS por enquanto (nenhum outro elemento a usa hoje).
  const nav = document.querySelector(".m3-bottom-nav") || document.querySelector(".mt-bottom-nav");
  if (!isRendered(nav)) return 18;
  let offset = nav.getBoundingClientRect().height + 14;
  // AJUSTE (Bloco 2 M3) — Escalação virou FAB (mesmo padrão da
  // Central), mas Treinos ("Aplicar treino da semana") continua com a
  // barra de ação full-width — esta checagem continua necessária.
  const actionBar = [...document.querySelectorAll(".mt-action-bar")].find(isRendered);
  if (actionBar) offset += actionBar.getBoundingClientRect().height;
  return offset;
}
// AJUSTE (pedido do usuário: "a mensagem de reputação e moral do
// elenco ainda está acima dos botões") — calcular a posição só na
// hora de MOSTRAR o toast não bastava: essa mensagem específica
// (applyPressAnswer) dispara ENQUANTO a coletiva de imprensa ainda
// está aberta (sem rodapé fixo próprio, ver #pressOverlay), e só
// DEPOIS fecha a coletiva e abre Notícias (com rodapé fixo de
// verdade) — tudo síncrono, então o toast calculava a posição pra
// tela de ORIGEM (a coletiva, sem rodapé — caía no 18px padrão) que
// já nem existia mais quando a mensagem realmente aparecia na tela de
// destino. Reposiciona sozinho a cada 150ms enquanto estiver visível,
// acompanhando qualquer transição de tela no meio do caminho.
let toastRepositionTimer = null;
// AJUSTE (pedido do usuário: "gosto da opção 2 [cápsula reforçada]
// mas acho que ela deve ter largura fixa do tamanho do botão ir para
// o jogo. e todos os textos devem ser bem escritos") — ícone-quadrado
// por tipo (positivo/informativo/alerta), título separado de detalhe,
// números viram pílulas próprias (ver CSS de .ct-toast em
// carreira.html). Um ícone svg por linha de raciocínio (não emoji) —
// mesmo padrão do resto do app.
const TOAST_ICON = {
  pos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="7.6" r=".6" fill="currentColor" stroke="currentColor"/></svg>',
};
function toastStatHTML(stat) {
  const cls = stat.value > 0 ? "pos" : stat.value < 0 ? "neg" : "zero";
  const sign = stat.value > 0 ? "+" : "";
  return `<span class="ct-toast-stat ${cls}">${escapeHtml(stat.label)} ${sign}${stat.value}</span>`;
}
// `input` aceita uma string simples (vira só o título) ou um objeto
// {title, detail, stats} pra mensagens com mais de uma informação
// (ex.: reputação + moral do elenco de uma coletiva, ver
// applyPressAnswer). Uma string com " — " (o mesmo separador informal
// já usado em boa parte dos textos do jogo) quebra sozinha em título +
// detalhe, sem precisar reescrever cada chamada existente. `opts`
// aceita um número (dura esse tanto, mesmo default de sempre) ou
// {durationMs, type: "pos"|"info"|"warn"} — "info" (dourado) por
// padrão quando não especificado.
function toast(input, opts = {}) {
  const { durationMs = 3600, type = "info" } = typeof opts === "number" ? { durationMs: opts } : opts;
  const el = document.getElementById("toast");
  let title, detail, stats;
  if (typeof input === "string") {
    const dash = input.match(/^(.+?)\s+—\s+(.+)$/);
    if (dash) { title = dash[1]; detail = dash[2].charAt(0).toUpperCase() + dash[2].slice(1); }
    else title = input;
  } else {
    ({ title, detail, stats } = input);
  }
  el.className = `ct-toast ${type}`;
  el.innerHTML = `
    <div class="ct-toast-icon">${TOAST_ICON[type] || TOAST_ICON.info}</div>
    <div class="ct-toast-body">
      <div class="ct-toast-title">${escapeHtml(title)}</div>
      ${detail ? `<div class="ct-toast-detail">${escapeHtml(detail)}</div>` : ""}
      ${stats && stats.length ? `<div class="ct-toast-stats">${stats.map(toastStatHTML).join("")}</div>` : ""}
    </div>`;
  el.style.bottom = toastBottomOffset() + "px";
  el.style.display = "flex";
  clearTimeout(toastTimer);
  clearInterval(toastRepositionTimer);
  toastRepositionTimer = setInterval(() => { el.style.bottom = toastBottomOffset() + "px"; }, 150);
  toastTimer = setTimeout(() => {
    el.style.display = "none";
    clearInterval(toastRepositionTimer);
  }, durationMs);
}
function show(name) {
  ["screenLoading", "screenLoginRequired", "screenCompetitionPicker", "screenPicker", "screenGame"].forEach((id) => {
    document.getElementById(id).classList.toggle("hidden", id !== name);
  });
  // BUG CORRIGIDO: trocar de tela (ex.: escolher um clube mais pra
  // baixo na grade, que exige rolar a página) não voltava a rolagem
  // pro topo — quem entrava assim na tela do jogo ficava com o
  // cabeçalho novo escondido acima da dobra até rolar manualmente.
  window.scrollTo(0, 0);
  // Redesign M3 — nenhuma destas 4 telas tem clube "dono" (login,
  // escolha de competição/clube, loading), então a cor dinâmica de
  // clube nunca deveria vazar pra elas (ex.: usuário saiu de uma
  // carreira do Flamengo e a tela de login ficaria vermelha até a
  // próxima carreira aplicar sua própria cor). showGameScreen() chama
  // applyClubPalette() de volta logo em seguida quando o destino É
  // "screenGame" com carreira de verdade.
  if (name !== "screenGame") resetToDefaultM3Palette();
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
  let match = DEMO_TEAMS.find((t) => normalizeNameForColor(t.name) === norm || (t.aliases || []).some((a) => normalizeNameForColor(a) === norm));
  // AJUSTE (pedido do usuário: "alguns clubes estão com as cores de
  // fundo sem relação com o degradê proposto") — o match exato acima só
  // cobre variação de nome já REPORTADA e somada a `aliases` (ver
  // comentário em data.js); qualquer outra variação que o fornecedor de
  // dado real mande (prefixo/sufixo tipo "EC ", "SE ", "Sport Club ")
  // caía direto pro azul genérico do fallback (`crestImg`), sem
  // relação nenhuma com o clube de verdade. Antes de desistir, tenta um
  // 2º match por "contém" nos dois sentidos — seguro aqui porque
  // DEMO_TEAMS só cobre os 20 clubes fixos desta competição (não corre
  // risco de casar com um clube errado de fora da lista).
  if (!match) {
    match = DEMO_TEAMS.find((t) => {
      const candidates = [t.name, ...(t.aliases || [])].map(normalizeNameForColor).filter((c) => c.length > 3);
      return candidates.some((c) => norm.includes(c) || c.includes(norm));
    });
  }
  // BUG CORRIGIDO (pedido do usuário: "Coritiba com fundo diferente da
  // logo") — Coritiba não está em DEMO_TEAMS (Série A) porque essa
  // lista foi curada numa temporada em que ele estava na Série B; o
  // fornecedor de dado real, porém, reflete a temporada ATUAL (2026),
  // com o time já de volta à Série A — subiu/desceu de divisão sem
  // ninguém atualizar essa lista. Em vez de duplicar a cor curada nas
  // 2 listas (ou torcer pra lembrar de mover o clube certo toda vez que
  // acesso/queda mudar o elenco da Série A), busca por último também
  // em DEMO_TEAMS_SERIE_B — mesma técnica de match exato + "contém".
  if (!match) {
    match = DEMO_TEAMS_SERIE_B.find((t) => normalizeNameForColor(t.name) === norm || (t.aliases || []).some((a) => normalizeNameForColor(a) === norm));
  }
  if (!match) {
    match = DEMO_TEAMS_SERIE_B.find((t) => {
      const candidates = [t.name, ...(t.aliases || [])].map(normalizeNameForColor).filter((c) => c.length > 3);
      return candidates.some((c) => norm.includes(c) || c.includes(norm));
    });
  }
  // AJUSTE (pedido do usuário: "acrescentar a Série B, C [ao Modo
  // Carreira] com dados reais") — mesma técnica de novo, agora também
  // em DEMO_TEAMS_SERIE_C, pro caso de um time real da Série C não
  // estar coberto em nenhuma das 2 listas acima.
  if (!match) {
    match = DEMO_TEAMS_SERIE_C.find((t) => normalizeNameForColor(t.name) === norm || (t.aliases || []).some((a) => normalizeNameForColor(a) === norm));
  }
  if (!match) {
    match = DEMO_TEAMS_SERIE_C.find((t) => {
      const candidates = [t.name, ...(t.aliases || [])].map(normalizeNameForColor).filter((c) => c.length > 3);
      return candidates.some((c) => norm.includes(c) || c.includes(norm));
    });
  }
  return match ? { c1: match.c1, c2: match.c2, c3: match.c3 } : null;
}
// AJUSTE (pedido do usuário: "acrescentar a Série B, C [ao Modo
// Carreira] com dados reais") — competitionId agora é parâmetro (era
// sempre "brasileirao" fixo); rotas /api/career/teams e
// /api/career/standings (server.js) em vez de /api/teams/
// /api/standings — mesma resposta, só sem a trava de plano do site
// principal (decisão do usuário: as 2 travas ficam independentes).
// Fallback de exemplo agora escolhe o catálogo certo por competição
// (DEMO_DATA_BY_COMPETITION, de js/data.js) em vez de sempre DEMO_TEAMS.
//
// BUG CORRIGIDO (pedido do usuário: "Cadastrei as variáveis de
// ambiente mas agora o nome dos times aparece 'Time #ope'") —
// CAREER.schedule (calendário de confrontos, ver startCareer) grava
// os ids de LEAGUE_TEAMS NO MOMENTO em que a carreira é criada, pra
// sempre. Se essa carreira nasceu em Modo Exemplo (ids fixos tipo
// "ope") e DEPOIS o usuário liga o fornecedor real pra essa
// competição (ENABLED_COMPETITIONS/SPORTMONKS_LEAGUE_ID_*), o próximo
// carregamento troca LEAGUE_TEAMS pros ids do fornecedor — diferentes
// dos ids fictícios já gravados no calendário/elenco — e teamById()
// (mais abaixo) passa a cair no placeholder "Time #<id>" pra QUALQUER
// referência a um time que já não existe mais na lista carregada.
// `opts.forceDemo` (ver enterAfterAuth) evita isso: uma carreira já
// existente sempre recarrega com a MESMA fonte de dado (Modo Exemplo
// ou dado real) com que foi criada — só uma carreira NOVA, criada
// depois de o dado real ser ligado, passa a usá-lo. Nenhum dado é
// migrado/renomeado; a carreira antiga simplesmente continua 100% no
// Modo Exemplo que sempre foi dela.
// Busca a lista de times de UMA competição (id/nome/força/cores), sem
// tocar em nenhum global — extraída de loadLeague (ver AJUSTE dela
// acima) pra ser reaproveitada por loadOtherCompetitionsTeams (mercado
// de 60 times) sem duplicar o mesmo fetch/try-catch duas vezes.
// `health` é passado de fora (já resolvido 1x por chamador, evita
// bater /api/health de novo pra cada uma das 3 competições).
// opts.forceDemo pula o fetch e cai direto no catálogo de exemplo —
// mesma trava do bug "Time #xxx" documentado em loadLeague, também
// necessária aqui (ver loadOtherCompetitionsTeams).
async function fetchCompetitionTeams(competitionId, health, opts = {}) {
  if (opts.forceDemo || !health.hasKey) {
    return { teams: (DEMO_DATA_BY_COMPETITION[competitionId] || { teams: DEMO_TEAMS }).teams, liveMode: false };
  }
  try {
    const season = health.season ? Number(health.season) || LIVE_SEASON : LIVE_SEASON;
    const [teamsData, standingsData] = await Promise.all([
      fetchJSON(`/api/career/teams?season=${season}&competition=${competitionId}`),
      fetchJSON(`/api/career/standings?season=${season}&competition=${competitionId}`),
    ]);
    if (!teamsData.teams || !teamsData.teams.length) throw new Error("resposta vazia");
    const strengths = calibrateStrengths(standingsData.standings || []);
    const teams = teamsData.teams.map((t) => {
      const realColor = realTeamColor(t.name);
      return {
        ...t, atk: strengths[t.id]?.atk ?? 1.3, def: strengths[t.id]?.def ?? 1.05,
        c1: realColor?.c1 || "#0057B8", c2: realColor?.c2 || "#062B5C", c3: realColor?.c3,
      };
    });
    return { teams, liveMode: true };
  } catch {
    // globais vindos de js/data.js — DEMO_DATA_BY_COMPETITION não tem
    // entrada pra "serie_d" (fora de escopo por enquanto, ver
    // renderCompetitionPicker) nem pra competições de mata-mata; cai
    // em DEMO_TEAMS (Série A) só como rede de segurança bem remota.
    return { teams: (DEMO_DATA_BY_COMPETITION[competitionId] || { teams: DEMO_TEAMS }).teams, liveMode: false };
  }
}
async function loadLeague(competitionId = "brasileirao", opts = {}) {
  CURRENT_COMPETITION_ID = competitionId;
  const health = opts.forceDemo ? { hasKey: false } : await fetchJSON("/api/health").catch(() => ({ hasKey: false }));
  if (health.season) LIVE_SEASON = Number(health.season) || LIVE_SEASON;
  const { teams, liveMode } = await fetchCompetitionTeams(competitionId, health, opts);
  LEAGUE_TEAMS = teams;
  LIVE_MODE = liveMode;
  LIVE_MODE_BY_COMPETITION[competitionId] = liveMode;
}
// AJUSTE (pedido do usuário: "o mercado deve trazer jogadores das 3
// ligas para que transações possam ser feitas entre os 60 times das
// Séries A, B e C") — busca os times das OUTRAS 2 competições (a da
// própria carreira já está em LEAGUE_TEAMS, carregada por loadLeague
// de sempre) e monta ALL_TEAMS_FLAT com as 3 juntas, cada time já
// marcado com a própria competitionId (pro selo de divisão no
// Mercado, ver renderMercado). Chamada em 2 momentos: (1) criação de
// carreira nova (startCareer), sem forceDemoMap — tenta dado real
// pras 2 outras competições, cada uma cai pro exemplo sozinha se
// faltar (mesmo try/catch de sempre); (2) retomada de uma carreira
// "multi" já existente (enterAfterAuth), com forceDemoMap montado a
// partir de CAREER.liveModeByCompetition — mesma trava do bug "Time
// #xxx" (ver loadLeague), agora também pras outras 2 competições:
// uma carreira que gravou uma delas como Modo Exemplo nunca tenta
// dado real por conta própria pra ela depois.
async function loadOtherCompetitionsTeams(homeCompetitionId, forceDemoMap = {}) {
  const others = ALL_COMPETITIONS_ORDER.filter((c) => c !== homeCompetitionId);
  const health = await fetchJSON("/api/health").catch(() => ({ hasKey: false }));
  const liveModeByCompetition = { [homeCompetitionId]: LIVE_MODE };
  const otherTeams = await Promise.all(others.map(async (compId) => {
    const { teams, liveMode } = await fetchCompetitionTeams(compId, health, { forceDemo: forceDemoMap[compId] });
    liveModeByCompetition[compId] = liveMode;
    LIVE_MODE_BY_COMPETITION[compId] = liveMode;
    return teams.map((t) => ({ ...t, competitionId: compId }));
  }));
  ALL_TEAMS_FLAT = [
    ...LEAGUE_TEAMS.map((t) => ({ ...t, competitionId: homeCompetitionId })),
    ...otherTeams.flat(),
  ];
  return liveModeByCompetition;
}
// Nunca deixa a tela quebrar por um id de clube que não existe mais em
// LEAGUE_TEAMS (ex.: carreira criada em modo ao vivo, revisitada depois
// sem a chave configurada — os 2 esquemas de id são diferentes, ver
// aviso no topo do arquivo) — devolve um placeholder plausível em vez
// de undefined.
// AJUSTE (pedido do usuário: "o mercado deve trazer jogadores das 3
// ligas") — carreira "multi" (ver startCareer/CAREER.marketScope) tem
// jogador de clube de OUTRA divisão, que não existe em LEAGUE_TEAMS
// (só a divisão da própria carreira) — cai pra ALL_TEAMS_FLAT (as 3
// juntas, ver loadOtherCompetitionsTeams) antes do placeholder "Time
// #<id>". Time achado em LEAGUE_TEAMS é sempre marcado com
// CURRENT_COMPETITION_ID (não carrega esse campo por padrão) pra
// renderMercado saber a divisão de qualquer time, próprio ou de fora.
function teamById(id) {
  const own = LEAGUE_TEAMS.find((t) => String(t.id) === String(id));
  if (own) return { ...own, competitionId: CURRENT_COMPETITION_ID };
  const other = ALL_TEAMS_FLAT.find((t) => String(t.id) === String(id));
  if (other) return other;
  return { id, name: `Time #${id}`, short: String(id).slice(0, 3).toUpperCase(), c1: "#8892A0", c2: "#333" };
}
// AJUSTE (pedido do usuário: "refaça 100% do front pra refletir o
// material enviado / idêntico às 30 telas") — moldura hexagonal (ver
// .ct-crest em carreira.html, mesmo clip-path de .crest-hex no
// shared.css do designer) no lugar da bolinha antiga; o brasão real
// (<img>) fica por cima, sem ser recortado — recortar o LOGO em si
// arriscava cortar brasões de formato estranho, a moldura por trás
// resolve sem esse risco. Usado em toda tela que já chamava
// crestImg() — Central, Tabela, Ao Vivo, Resultados, Escolha do
// Clube etc. — muda a aparência do escudo de uma vez só, no lugar
// certo, conforme cada uma dessas telas for reconstruída.
// AJUSTE (pedido do usuário: "o diamante abaixo da logo está tirando o
// peso que os times representam... me apresenta uma proposta que
// valorize mais a marca dos clubes") — sem escudo real (Modo Exemplo,
// ou qualquer time que a API não tenha imagem), o hexágono ficava só
// com a cor do clube, sem NENHUMA marca — lia como um diamante
// decorativo genérico, não como "o escudo de tal time". Mockup de
// comparação publicado (confronto-escudo-opcoes.html, Opção B
// escolhida) — a sigla do clube (t.short, já existe no cadastro) vira
// um monograma dentro do próprio hexágono como fallback. Hierarquia
// agora é: escudo real (t.logo) > sigla (monograma) > nunca mais o
// hexágono liso de cor só.
function crestImg(t, size = 40) {
  const c1 = t?.c1 || "#8892A0", c2 = t?.c2 || "#333";
  const hasLogo = !!(t && t.logo);
  const inner = hasLogo
    ? `<img src="${t.logo}" alt="" style="height:${Math.round(size * 0.62)}px;width:${Math.round(size * 0.62)}px;object-fit:contain;">`
    : t?.short
      ? `<span class="ct-crest-mono" style="font-size:${Math.round(size * 0.34)}px;">${escapeHtml(t.short)}</span>`
      : "";
  // AJUSTE (pedido do usuário: "ajustar a forma de exibir as logos dos
  // clubes para que todas tenham um contraste adequado e acessível") —
  // fundo transparente (ver histórico deste comentário) deixava escudos
  // de cor escura/vermelha (Athletico-PR, Flamengo, Internacional etc.)
  // quase invisíveis por cima do navy escuro do app inteiro. Escudo real
  // agora sempre fica sobre uma "chapinha" neutra clara (mesmo tom
  // "gelo" já usado no toast de rodapé por este MESMO motivo — precisa
  // destacar em cima de QUALQUER cor de fundo) — convenção padrão de
  // apps de futebol (Sofascore/FotMob/ESPN etc.): o escudo oficial é
  // desenhado pra ser lido sobre um fundo claro neutro, então isso
  // funciona pra QUALQUER clube, sem precisar analisar pixel de imagem
  // nenhuma (frágil/CORS, já descartado antes nesta sessão pra cor
  // dinâmica). Sem logo, continua o degradê da cor do clube — a
  // moldura colorida só faz sentido como fundo do MONOGRAMA.
  const bg = hasLogo ? "var(--mt-ivory-50)" : `linear-gradient(160deg, ${c1}, ${c2})`;
  return `<span class="ct-crest${hasLogo ? " has-logo" : ""}" style="height:${size}px;width:${size}px;background:${bg};">${inner}</span>`;
}
// teamGradientStops() removida (redesign, Tela 6) — só era usada pelo
// disco antigo do campinho (.button-disc, cor do TIME); o campinho novo
// usa a mesma faixa de cor por OVR do Elenco/Detalhe (ovrTierClass),
// não mais a cor do escudo.
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
// AJUSTE (pedido do usuário: "acrescentar a Série B, C [ao Modo
// Carreira] com dados reais") — competição certa (CURRENT_COMPETITION_ID,
// ver loadLeague) tanto no fallback de exemplo quanto na rota real
// (/api/career/teams/:id/players, sem trava de plano).
//
// AJUSTE (pedido do usuário: "o mercado deve trazer jogadores das 3
// ligas") — competitionId agora é parâmetro (era sempre
// CURRENT_COMPETITION_ID, a competição da PRÓPRIA carreira) — times de
// OUTRA divisão (ver buildLeagueSquad/loadOtherCompetitionsTeams)
// passam a sua própria competitionId aqui. LIVE_MODE_BY_COMPETITION
// (em vez do global LIVE_MODE, que só reflete a competição da
// carreira) garante que times de uma divisão em Modo Exemplo não
// tentem a API real só porque a divisão da carreira está ao vivo (e
// vice-versa) — cada competição resolve sua própria fonte de dado,
// independente das outras 2.
async function fetchRealPlayers(teamId, competitionId = CURRENT_COMPETITION_ID) {
  if (!LIVE_MODE_BY_COMPETITION[competitionId]) {
    const demo = DEMO_DATA_BY_COMPETITION[competitionId] || { players: DEMO_PLAYERS };
    return demo.players.filter((p) => String(p.teamId) === String(teamId));
  }
  try {
    const data = await fetchJSON(`/api/career/teams/${teamId}/players?season=${LIVE_SEASON}&competition=${competitionId}`);
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
// AJUSTE (pedido do usuário: "a idade é fundamental pra moral do
// atleta — atletas mais velhos, mais novos e com overall mais baixo
// não reclamam tanto") — quanto esse jogador "reclama" de verdade:
// jogador em idade de pico (24-30) e overall alto é o mais exigente
// (maior expectativa de protagonismo); fora da faixa de pico
// (jovem em formação ou veterano em fim de carreira) ou com overall
// mais baixo (jogador de time, sabe que não é titular garantido) —
// reclama bem menos do mesmo evento. Usado tanto pra amortecer perda
// de moral por banco/fora da lista (applyMoraleAfterMatch) quanto pra
// decidir recusa de empréstimo (isLoanOutRefused, ver seção de
// empréstimos) — mesmo fator, os dois efeitos pedidos juntos na
// mesma frase pelo usuário.
const PRIME_AGE_MIN = 24, PRIME_AGE_MAX = 30;
function playerComplaintFactor(p) {
  const age = p.age == null ? PRIME_AGE_MIN : p.age;
  const ageGap = age < PRIME_AGE_MIN ? (PRIME_AGE_MIN - age) : age > PRIME_AGE_MAX ? (age - PRIME_AGE_MAX) : 0;
  const ageFactor = clamp(1 - ageGap * 0.06, 0.25, 1);
  const overallFactor = clamp((p.overall - 55) / 30, 0.25, 1);
  return clamp(ageFactor * overallFactor, 0.15, 1);
}
// Chamada de dentro de simulateRound, só quando SEU clube jogou —
// titular ganha por ter jogado + resultado; banco perde um pouco
// (insatisfeito por não jogar) + metade do efeito do resultado; quem
// nem entrou na "folha de jogo" (nem titular, nem banco) perde mais,
// sentindo que foi esquecido pelo treinador.
// FASE 4 (item 1) — além do delta em si, agora também acumula
// benchStreak (rodadas seguidas fora do time titular, zera assim que
// volta a titular) e grava um motivo_atual/tendência legíveis (ver
// "Modelo de dados" do documento: moral.tendencia/motivo_atual) —
// mostrados na seção "Relacionamento" do detalhe do jogador.
function applyMoraleAfterMatch(myGoals, oppGoals) {
  const resultDelta = myGoals > oppGoals ? 3 : myGoals === oppGoals ? 0 : -3;
  const starterIds = new Set(CAREER.lineup.starters.filter(Boolean));
  const benchIds = new Set(CAREER.lineup.bench);
  CAREER.squad.forEach((p) => {
    const base = p.morale == null ? 70 : p.morale;
    let delta, reason;
    if (starterIds.has(p.id)) {
      delta = resultDelta + 2;
      p.benchStreak = 0;
      reason = resultDelta > 0 ? "Comemorando a vitória jogando entre os titulares"
        : resultDelta < 0 ? "Abalado com a derrota jogando entre os titulares"
        : "Neutro após o empate jogando entre os titulares";
    } else {
      p.benchStreak = (p.benchStreak || 0) + 1;
      // AJUSTE (pedido do usuário) — só a parte NEGATIVA de banco/fora
      // da lista é amortecida pelo quanto esse jogador reclama; o
      // resultado da partida em si (resultDelta, quando aparece
      // metade dele pro banco) não muda com idade/overall — isso é só
      // "reclamar de não jogar", não reação ao placar.
      const complaint = playerComplaintFactor(p);
      if (benchIds.has(p.id)) {
        const benchPenalty = Math.round(-1 * complaint);
        delta = Math.round(resultDelta / 2) + benchPenalty;
        reason = p.benchStreak >= TALK_BENCH_STREAK_THRESHOLD
          ? `Insatisfeito no banco há ${p.benchStreak} jogos seguidos`
          : "Quer mais oportunidades como titular";
      } else {
        delta = Math.round(-2 * complaint);
        reason = p.benchStreak >= TALK_BENCH_STREAK_THRESHOLD
          ? `Contrariado por ficar fora da lista de jogo há ${p.benchStreak} rodadas`
          : "Fora da lista de jogo nessa rodada";
      }
    }
    const newMorale = clamp(base + delta, 0, 100);
    p.moraleTrend = newMorale > base ? "subindo" : newMorale < base ? "caindo" : "estavel";
    p.morale = newMorale;
    p.moraleReason = reason;
    // Consequência de moral prolongada baixa pedida no documento (além
    // de já pesar no desempenho via moraleFactor, e de já poder travar
    // renovação em proposeRenewal): fica marcado como "pede
    // transferência" — só um alerta visível (Elenco + detalhe), sem
    // forçar listagem automática no mercado, que exigiria uma reescrita
    // maior do fluxo de vendas só pra essa flag.
    p.wantsTransfer = p.benchStreak >= WANTS_TRANSFER_BENCH_STREAK && p.morale <= WANTS_TRANSFER_MORALE_MAX;
  });
}
// FASE 4 (item 1) — "conversa individual" pedida no documento: decisão
// simples entre respostas pré-escritas com efeito imediato na moral,
// sem sistema de diálogo dinâmico ("não precisa ser um sistema de
// diálogo complexo, só uma decisão binária/ternária com efeito" — texto
// do próprio documento). Fica disponível só "quando aplicável": jogador
// insatisfeito (fora do time titular há TALK_BENCH_STREAK_THRESHOLD+
// rodadas seguidas) ou já com moral muito baixa — e no máximo 1
// conversa por rodada por jogador (lastTalkRound), pra não virar botão
// de spam sem custo nenhum.
const TALK_BENCH_STREAK_THRESHOLD = 3;
const WANTS_TRANSFER_BENCH_STREAK = 5;
const WANTS_TRANSFER_MORALE_MAX = 20;
function canTalkTo(p) {
  const morale = p.morale == null ? 70 : p.morale;
  const eligible = (p.benchStreak || 0) >= TALK_BENCH_STREAK_THRESHOLD || morale <= 30;
  return eligible && p.lastTalkRound !== CAREER.currentRound;
}
function moraleTrendArrowHTML(p) {
  return p.moraleTrend === "subindo" ? ' <span style="color:var(--brd-green);" title="Moral subindo">▲</span>'
    : p.moraleTrend === "caindo" ? ' <span style="color:var(--brd-red);" title="Moral caindo">▼</span>' : "";
}
let TALK_CTX = null;
function openTalkModal(id) {
  const p = CAREER.squad.find((x) => x.id === id);
  if (!p || !canTalkTo(p)) return;
  TALK_CTX = { playerId: id };
  document.getElementById("talkSub").textContent = abbreviateName(p.name);
  document.getElementById("talkContext").textContent = p.moraleReason || "Precisa de uma conversa.";
  document.getElementById("talkOverlay").classList.add("open");
}
function closeTalkModal() {
  document.getElementById("talkOverlay").classList.remove("open");
  TALK_CTX = null;
}
// Efeito depende do contexto atual (documento pede "sobem ou descem
// moral dependendo do contexto"): "cobrar postura" ajuda quem só está
// desanimado, mas piora ainda mais quem já está muito infeliz — as
// outras duas opções são sempre positivas, sem rastrear "promessa
// cumprida ou não" depois (fora do escopo simples que o próprio
// documento pede).
function applyTalkOption(option) {
  if (!TALK_CTX) return;
  const p = CAREER.squad.find((x) => x.id === TALK_CTX.playerId);
  if (!p) { closeTalkModal(); return; }
  const morale = p.morale == null ? 70 : p.morale;
  let delta, resultText;
  if (option === "apoiar") {
    delta = 12;
    resultText = `${abbreviateName(p.name)} se sentiu ouvido e ficou mais tranquilo.`;
  } else if (option === "prometer") {
    delta = 10;
    p.benchStreak = 0; // esperançoso com a promessa — reinicia a contagem de insatisfação
    resultText = `${abbreviateName(p.name)} ficou esperançoso com a promessa de mais chances.`;
  } else {
    delta = morale <= 30 ? -8 : 6;
    resultText = delta > 0
      ? `${abbreviateName(p.name)} levou a cobrança na esportiva e prometeu se superar.`
      : `${abbreviateName(p.name)} não gostou nada do tom — ficou ainda mais incomodado.`;
  }
  const newMorale = clamp(morale + delta, 0, 100);
  p.moraleTrend = newMorale > morale ? "subindo" : newMorale < morale ? "caindo" : "estavel";
  p.morale = newMorale;
  p.moraleReason = "Conversou recentemente com o técnico";
  p.wantsTransfer = p.benchStreak >= WANTS_TRANSFER_BENCH_STREAK && p.morale <= WANTS_TRANSFER_MORALE_MAX;
  p.lastTalkRound = CAREER.currentRound;
  closeTalkModal();
  toast(resultText, { durationMs: 4500, type: delta > 0 ? "pos" : "warn" });
  persistCareer();
  if (document.getElementById("detailOverlay").classList.contains("open")) openDetail(p.id);
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
/* ---------- Evolução de atributos mais realista (pedido do usuário:
   "os atributos precisam ser mais reais... com os treinos chega um
   momento que todos os atletas estão em 99... evolução menos
   agressiva e os jogadores também podem perder atributos
   naturalmente") ----------
   DIAGNÓSTICO: p.potential já existia (só pra jogador da BASE, ver
   buildBasePlayer) mas nunca era lido como teto de crescimento em
   lugar NENHUM do motor de evolução — só alimentava o bônus de valor
   de mercado (computeContractFields) e a faixa exibida ao olheiro
   (scoutedPotentialRange). O treino (applyWeeklyTraining) dava ganho
   DETERMINÍSTICO (sem chance, sem teto por jogador) a cada rodada
   aplicada — qualquer jogador, de qualquer idade, convergia pra 99 em
   poucas rodadas, sem relação nenhuma com talento/idade real.

   Corrigido: potential passa a valer de verdade como teto — de
   overall E de phys (mesma escala 0-99, reaproveitado sem inventar um
   2º campo) — em QUALQUER ganho de atributo (treino OU maturação
   natural, ver applyNaturalAgingEvolution). E, decisão nova, todo
   jogador ganha um potencial coerente, não só a base: adulto real/
   gerado (buildRealPlayer/buildGeneratedProPlayer) recebe um teto
   derivado da IDADE — jovem tem espaço real pra crescer via treino;
   veterano (30+) já nasce no próprio teto, sem espaço nenhum (só
   declínio a partir daí, ver applyNaturalAgingEvolution). Saves
   antigos (sem esse campo pra jogador adulto) recebem um valor
   retroativo determinístico na migração (ver backfillPlayerPotential/
   migrateCareerDefaults). */
function derivePotentialForAdult(overall, age, rng) {
  let room;
  if (age <= 20) room = 8 + rng() * 10;       // 8-18: base jovem ainda tem margem real
  else if (age <= 23) room = 4 + rng() * 8;   // 4-12
  else if (age <= 26) room = 1 + rng() * 5;   // 1-6
  else if (age <= 29) room = rng() * 3;       // 0-3
  else room = 0;                               // 30+: sem mais espaço de crescimento por treino
  return Math.round(clamp(overall + room, overall, 99));
}
// Ganho de um atributo no treino (ver applyWeeklyTraining) respeitando
// o teto do jogador, com retorno DECRESCENTE perto dele: baseGain
// (fórmula do documento, ver TRAINING_INTENSITY_MULT) continua sendo o
// máximo POSSÍVEL numa rodada, mas cada "unidade" de ganho só converte
// de verdade com uma chance proporcional ao espaço restante até o teto
// — longe dele (espaço >= 15), quase sempre o ganho cheio, igual antes;
// perto dele, cada unidade vira cada vez mais rara (nunca zero de
// propósito — sempre >= 5% de chance —, mas na prática convergindo
// bem mais devagar); no teto, sempre zero. Nunca passa do teto.
function attributeTrainingGain(currentValue, ceiling, baseGain) {
  const room = ceiling - currentValue;
  if (room <= 0) return 0;
  let gained = 0;
  for (let i = 0; i < baseGain; i++) {
    const chance = clamp(room / 15, 0.05, 1);
    if (Math.random() < chance) gained++;
  }
  return Math.min(gained, room);
}
// Backfill pra saves de ANTES desta mudança — jogador adulto nunca
// tinha esse campo. Seed determinística por jogador (mesmo padrão de
// seededRngFromKey já usado em renew-league/renew-human/contract-
// backfill) — não muda de valor a cada load do mesmo save.
function backfillPlayerPotential(p) {
  if (p.potential != null) return;
  p.potential = derivePotentialForAdult(p.overall, p.age, seededRngFromKey(`potential-backfill:${p.id}`));
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
  // AJUSTE (pedido do usuário: "a idade de todos os atletas está
  // incorreta... buscar a idade na API, pois ela é fundamental pra
  // moral do atleta") — raw.age agora vem de verdade do fornecedor
  // (ver mapPlayerEntry em adapter.js / mapPlayerFromSquad em
  // sportmonks.js) — o sorteio 18-35 continua só como rede de
  // segurança pra quando o fornecedor não tiver esse dado (ex.: Modo
  // Exemplo sem chave configurada, ou resposta incompleta da API).
  const age = Number.isFinite(raw.age) && raw.age > 0 ? Math.round(raw.age) : 18 + Math.floor(rng() * 18);
  // Nova feature (pedido do usuário: "atributos precisam ser mais
  // reais... evolução menos agressiva") — teto de crescimento por
  // idade, ver derivePotentialForAdult (bloco de comentário grande
  // acima de buildRealPlayer).
  const potential = derivePotentialForAdult(overall, age, rng);
  return {
    id: `real_${raw.id}`, name: raw.name || "Jogador", photo: raw.photo || null,
    group, age, overall, atk, def, phys, potential,
    origin: "principal", real: true,
    status: "ok", outUntilRound: null, yellowCards: 0, condition: 100, morale: 70,
    // FASE 4 (item 1) — relacionamento jogador-técnico, ver bloco de
    // comentário logo acima de applyMoraleAfterMatch.
    benchStreak: 0, moraleReason: "Neutro no clube", moraleTrend: "estavel",
    wantsTransfer: false, lastTalkRound: null,
    goalsCareer: 0, assistsCareer: 0, apps: 0,
    ...computeContractFields(overall, age, potential, rng),
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
    benchStreak: 0, moraleReason: "Neutro no clube", moraleTrend: "estavel",
    wantsTransfer: false, lastTalkRound: null,
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
  // Nova feature (pedido do usuário: "atributos precisam ser mais
  // reais... evolução menos agressiva") — QUALQUER jogador adulto
  // ganhou p.potential (ver derivePotentialForAdult), não só quem
  // "ainda carrega potencial" (promovido da base) como antes — sem
  // este corte, um veterano de 34 anos (potential === overall, sem
  // espaço nenhum) passaria a mostrar uma faixa de olheiro cheia de
  // incerteza (a fórmula de fuzz abaixo não sabe que o teto real já
  // foi alcançado) — não faz sentido "escoutar" quem já está formado.
  // Continua aparecendo pra jovem promissor de verdade (base OU
  // adulto recém-assinado com espaço real de crescimento).
  if (p.potential <= p.overall && !p.scoutRevealed) return null;
  // Retenção/Engajamento — recompensa "scout_token" do login diário
  // (ver applyDailyLoginReward) marca p.scoutRevealed em vez de tocar
  // em p.potential: o potencial REAL continua intacto (ele já é usado
  // como teto de crescimento em outro lugar do motor) — só a
  // INCERTEZA da faixa exibida aqui desaparece, faixa vira um único
  // número exato.
  if (p.scoutRevealed) return { lo: p.potential, hi: p.potential };
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
  // Nova feature (pedido do usuário: "atributos precisam ser mais
  // reais... evolução menos agressiva") — mesmo teto por idade de
  // buildRealPlayer, ver derivePotentialForAdult.
  const potential = derivePotentialForAdult(overall, age, rng);
  return {
    id: `gen_${club.id}_${idx}`, name: `${first} ${last}`, photo: null,
    group, age, overall, atk, def, phys, potential,
    origin: "principal", real: false,
    status: "ok", outUntilRound: null, yellowCards: 0, condition: 100, morale: 70,
    benchStreak: 0, moraleReason: "Neutro no clube", moraleTrend: "estavel",
    wantsTransfer: false, lastTalkRound: null,
    goalsCareer: 0, assistsCareer: 0, apps: 0,
    ...computeContractFields(overall, age, potential, rng),
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
// Nova feature — Comissão Técnica: custo mensal escala com a folha do
// elenco principal (clube maior = comissão maior) — mesma lógica de
// "proporcional ao tamanho do clube" que wageCap já usa. Arredondado
// pro milhar mais próximo, mesmo padrão visual de wageCap/cash acima.
const TECHNICAL_STAFF_WAGE_PCT = 0.05;
function technicalStaffMonthlyCost() {
  return Math.round(wageBillOf(CAREER.squad) * TECHNICAL_STAFF_WAGE_PCT / 1000) * 1000;
}

/* ---------- FASE 4 (item 5 da especificação "BR Data Treinador") —
   patrocínio e material esportivo ----------
   Dois contratos comerciais (patrocinador master e material
   esportivo), cada um com duração fixa (2-3 temporadas) e valor por
   temporada, renovável ao vencer com propostas concorrentes (ver
   generateSponsorProposals/advanceSponsorshipSeason). Efeito é
   PURAMENTE financeiro (a própria especificação já decide isso —
   "não precisa de sistema visual de camisa estampada") — soma no caixa
   em parcelas ao longo da temporada (ver finishRoundTail), mesmo
   ritmo de "dinheiro chega aos poucos" do ingresso/salário.

   Valor da proposta escala com desempenho recente (ver
   sponsorshipTier): posição da última temporada terminada
   (CAREER.seasonHistory[0], já existe) + título — Brasileirão
   (posição 1) ou Copa do Brasil (CAREER.cup.championIsHuman,
   verificado ANTES de setupCup() resetar a Copa pra temporada nova,
   ver advanceSeason) — decisão nossa pro "escala com desempenho"
   pedido, sem precisar de um histórico de títulos à parte. */
const SPONSOR_MASTER_NAMES = ["Banco Vértice", "Seguradora Ipê", "TotalBet Apostas", "ConectaTelecom", "Ouro Fino Bebidas", "Vitalis Saúde"];
const SPONSOR_MATERIAL_NAMES = ["Aro Sports", "Fortex", "Zênite Esportes", "Rael Wear", "Lance Esportivo", "Bravo Sport"];
const SPONSOR_BASE_VALUE = { master: 5000000, material: 2000000 };
function sponsorshipTier() {
  const lastSeason = (CAREER.seasonHistory || [])[0];
  let score = 40; // base neutra (sem histórico ainda, ex.: 1ª temporada)
  if (lastSeason) {
    if (lastSeason.position <= 4) score += 35;
    else if (lastSeason.position <= 8) score += 20;
    else if (lastSeason.position <= 12) score += 5;
    else if (lastSeason.position >= 17) score -= 15;
    if (lastSeason.position === 1) score += 25; // campeão do Brasileirão
  }
  if (CAREER.cup && CAREER.cup.championIsHuman) score += 20; // campeão da Copa do Brasil
  return clamp(score, 10, 100);
}
function generateSponsorProposals(kind) {
  const base = SPONSOR_BASE_VALUE[kind];
  const tier = sponsorshipTier();
  const mult = 0.6 + (tier / 100) * 1.2;
  const names = kind === "master" ? SPONSOR_MASTER_NAMES : SPONSOR_MATERIAL_NAMES;
  const pool = [...names].sort(() => Math.random() - 0.5).slice(0, 3);
  return pool.map((empresa) => {
    const duracao = 2 + Math.floor(Math.random() * 2); // 2 ou 3 temporadas
    const variance = 0.85 + Math.random() * 0.3;
    const valorTemporada = Math.round((base * mult * variance) / 50000) * 50000;
    return { empresa, valorTemporada, duracao };
  });
}
// Chamado só na criação da carreira — assina de cara a 1ª proposta
// gerada de cada tipo (tier neutro, sem histórico ainda) pra não
// começar sem nenhum contrato (o jogador só vê o fluxo de "escolher
// proposta" quando um contrato de verdade VENCE, ver
// advanceSponsorshipSeason).
function initSponsorship() {
  const sign = (kind) => {
    const p = generateSponsorProposals(kind)[0];
    return { empresa: p.empresa, valorTemporada: p.valorTemporada, temporadasRestantes: p.duracao };
  };
  CAREER.sponsorship = { master: sign("master"), material: sign("material") };
  CAREER.sponsorProposals = { master: null, material: null };
}
// Chamado de dentro de advanceSeason, ANTES de setupCup() resetar a
// Copa (ver sponsorshipTier acima) — decrementa quem tem contrato
// ativo; quando chega a 0, o contrato vence e vira propostas novas pra
// escolher (ver openSponsorProposalsModal).
function advanceSponsorshipSeason() {
  ["master", "material"].forEach((kind) => {
    const deal = CAREER.sponsorship[kind];
    if (deal) {
      deal.temporadasRestantes -= 1;
      if (deal.temporadasRestantes <= 0) {
        CAREER.sponsorship[kind] = null;
        CAREER.sponsorProposals[kind] = generateSponsorProposals(kind);
      }
    } else if (!CAREER.sponsorProposals[kind]) {
      CAREER.sponsorProposals[kind] = generateSponsorProposals(kind);
    }
  });
}
function sponsorshipSeasonTotal() {
  return ["master", "material"].reduce((sum, kind) => sum + (CAREER.sponsorship[kind] ? CAREER.sponsorship[kind].valorTemporada : 0), 0);
}
const SPONSOR_KIND_LABEL = { master: "Patrocinador Master", material: "Material Esportivo" };
// Card dentro do Financeiro (ver renderCentral) — 2 linhas (master e
// material), cada uma com o contrato atual ou um botão "Ver propostas"
// quando o contrato venceu (ver advanceSponsorshipSeason).
function renderSponsorship() {
  // AJUSTE (redesign, Tela 3) — .mt-sponsor-row no lugar de
  // .ct-sponsor-row (ver 03-central-restyled.html do designer): nome
  // + detalhe em 2 linhas à esquerda, "N temp." em destaque à
  // direita (ou "Ver propostas" quando não tem contrato ainda).
  const rows = ["master", "material"].map((kind) => {
    const deal = CAREER.sponsorship[kind];
    const detail = deal
      ? `${escapeHtml(deal.empresa)} · ${fmtBRL(deal.valorTemporada)}/temporada`
      : "Sem contrato — escolha uma proposta";
    const right = deal
      ? `<span class="mt-sponsor-tag">${deal.temporadasRestantes} temp.</span>`
      : `<button class="mt-sponsor-btn" data-sponsor-choose="${kind}">Ver propostas</button>`;
    return `<div class="mt-sponsor-row">
      <div><div class="mt-sponsor-name">${SPONSOR_KIND_LABEL[kind]}</div><div class="mt-sponsor-detail">${detail}</div></div>
      ${right}
    </div>`;
  }).join("");
  const box = document.getElementById("sponsorshipBox");
  box.innerHTML = rows;
  box.querySelectorAll("[data-sponsor-choose]").forEach((btn) => {
    btn.addEventListener("click", () => openSponsorProposalsModal(btn.dataset.sponsorChoose));
  });
}
function openSponsorProposalsModal(kind) {
  // Rede de segurança: se por algum motivo não tinha propostas geradas
  // ainda (não deveria acontecer, ver advanceSponsorshipSeason/
  // migrateCareerDefaults), gera na hora em vez de travar o botão.
  const proposals = CAREER.sponsorProposals[kind] || generateSponsorProposals(kind);
  CAREER.sponsorProposals[kind] = proposals;
  document.getElementById("sponsorProposalsTitle").textContent = `Propostas — ${SPONSOR_KIND_LABEL[kind]}`;
  // AJUSTE (refatoração completa, Tela 12b) — linha simples (nome +
  // valor/duração à esquerda, botão dourado à direita), no lugar do
  // .ct-market-row de 2 linhas (que ainda serve o Mercado, Tela 10, com
  // badge/chip que essa lista mais simples não precisa).
  document.getElementById("sponsorProposalsList").innerHTML = proposals.map((p, i) => `
    <div class="mt-sponsor-proposal-row">
      <div>
        <div class="mt-sponsor-proposal-name">${escapeHtml(p.empresa)}</div>
        <div class="mt-sponsor-proposal-detail">${fmtBRL(p.valorTemporada)}/temporada · ${p.duracao} temporada${p.duracao === 1 ? "" : "s"}</div>
      </div>
      <button class="mt-btn-sign" data-sponsor-sign="${i}">Assinar</button>
    </div>`).join("");
  document.getElementById("sponsorProposalsList").querySelectorAll("[data-sponsor-sign]").forEach((btn) => {
    btn.addEventListener("click", () => signSponsorProposal(kind, Number(btn.dataset.sponsorSign)));
  });
  document.getElementById("sponsorProposalsOverlay").classList.add("open");
}
function closeSponsorProposalsModal() {
  document.getElementById("sponsorProposalsOverlay").classList.remove("open");
}
function signSponsorProposal(kind, idx) {
  const proposal = (CAREER.sponsorProposals[kind] || [])[idx];
  if (!proposal) return;
  CAREER.sponsorship[kind] = { empresa: proposal.empresa, valorTemporada: proposal.valorTemporada, temporadasRestantes: proposal.duracao };
  CAREER.sponsorProposals[kind] = null;
  document.getElementById("sponsorProposalsOverlay").classList.remove("open");
  persistCareer();
  renderCentral();
  toast(`Contrato assinado com ${proposal.empresa}!`, { type: "pos" });
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
    toast("A diretoria aprovou o pedido!", { type: "pos" });
  } else {
    CAREER.boardDecision = `❌ ${result.reason}`;
    toast("A diretoria negou o pedido.", { type: "warn" });
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
// AJUSTE (pedido do usuário: "o mercado deve trazer jogadores das 3
// ligas") — numa carreira "multi", CAREER.leagueSquads tem elenco de
// OUTRAS 2 divisões também (ver buildLeagueSquads em startCareer) —
// mas a força "da liga" pra calibrar a meta da diretoria é sempre a
// da PRÓPRIA divisão (times mais fracos de outra série não podem
// puxar a régua pra baixo/cima à toa). Filtrado por CAREER.standings
// (só as chaves dos 20 times da própria divisão, sempre) pelo mesmo
// motivo já aplicado em renderEstatisticas (artilheiros da liga).
function computeBoardGoal() {
  const myAvg = averageOverall(CAREER.squad.filter((p) => p.origin === "principal"));
  const leagueSquadsOwnDivision = Object.entries(CAREER.leagueSquads || {})
    .filter(([teamId]) => Object.prototype.hasOwnProperty.call(CAREER.standings, teamId))
    .flatMap(([, squad]) => squad);
  const leagueAvg = averageOverall(leagueSquadsOwnDivision);
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

/* ---------- FASE 4 (item 4) — reputação do técnico → propostas de
   outros clubes ----------
   Especificação "BR Data Treinador — Fase 4", último item da fase
   (o próprio documento diz que depende de metas da diretoria + moral/
   coletiva como insumo). Fórmula respondida pelo usuário: "50% Meta
   20% Títulos 10% Entrevistas" — os 10% de Entrevistas ficaram
   reservados aqui (sem contribuir nada) até a Coletiva de Imprensa
   (Fase 4 item 2) existir de verdade; agora que existe (ver
   PRESS_LIBRARY/applyPressAnswer mais abaixo, REPUTATION_INTERVIEW_*),
   o peso está ativo. Escala 0-100, todo técnico nasce em 50 (neutro) —
   mesmo espírito da moral (Fase 2b) nascendo em 70.

   Diferente de moral (por jogador, dentro de CAREER.squad), reputação
   e histórico de clubes são do TÉCNICO, não do clube atual — por isso
   precisam sobreviver a uma troca de clube, mesmo com CAREER virando
   um objeto novo do zero (ver startCareer). Hoje demissão e "proposta
   aceita" são os 2 únicos jeitos de trocar de clube fora do
   "Reiniciar" explícito (esse sim apaga tudo de propósito, sem
   carregar reputação nenhuma pra frente) — ver TECHNICIAN_CARRY/
   endCurrentClubStint logo abaixo, consumidos por startCareer(). */
const REPUTATION_META_WEIGHT = 0.5;
const REPUTATION_TITLE_WEIGHT = 0.2;
const REPUTATION_META_POINTS = { met: 14, missed: -10 };
const REPUTATION_TITLE_POINTS = 30; // por título (Brasileirão e Copa do Brasil contam separado)
const REPUTATION_DISMISSAL_PENALTY = 25;
// FASE 4 (item 2) — peso de "Entrevistas" da fórmula (10%): a
// biblioteca de coletivas (PRESS_LIBRARY, mais abaixo) já vem com um
// "Efeito Reputação" calibrado por resposta na escala -3 a +3 (ver
// aba "Legenda" do arquivo fornecido pelo usuário) — 10 pontos por
// unidade × peso 0.1 = 1 ponto de reputação por unidade do arquivo,
// então uma resposta extrema (+3/-3) mexe uns 3 pontos, do mesmo porte
// de 1 meta batida/não batida (ver REPUTATION_META_POINTS acima).
const REPUTATION_INTERVIEW_POINTS = 10;
const REPUTATION_INTERVIEW_WEIGHT = 0.1;
function countTitlesThisSeason(award) {
  let n = 0;
  if (award.brasileirao.campeao != null && String(award.brasileirao.campeao) === String(CAREER.clubId)) n++;
  if (award.copaDoBrasil.disputou && String(award.copaDoBrasil.campeao) === String(CAREER.clubId)) n++;
  return n;
}
function applySeasonReputationDelta(goalWasMet, award) {
  const metaDelta = (goalWasMet ? REPUTATION_META_POINTS.met : REPUTATION_META_POINTS.missed) * REPUTATION_META_WEIGHT;
  const titleDelta = countTitlesThisSeason(award) * REPUTATION_TITLE_POINTS * REPUTATION_TITLE_WEIGHT;
  const base = CAREER.reputation == null ? 50 : CAREER.reputation;
  CAREER.reputation = clamp(Math.round(base + metaDelta + titleDelta), 0, 100);
}
function reputationLabel(rep) {
  return rep >= 85 ? "Lendário" : rep >= 70 ? "Renomado" : rep >= 50 ? "Estabelecido" : rep >= 30 ? "Em dúvida" : "Contestado";
}
// Fecha a passagem pelo clube atual (demissão ou proposta aceita) —
// registra no "currículo" (histórico_clubes do documento: clube,
// temporadas, títulos, posição média) e guarda o que precisa
// sobreviver à troca em TECHNICIAN_CARRY, consumido por startCareer()
// ao montar a carreira nova no próximo clube.
let TECHNICIAN_CARRY = null;
function endCurrentClubStint(reason) {
  const seasons = (CAREER.seasonHistory || []).length;
  const avgPosition = seasons
    ? Math.round(CAREER.seasonHistory.reduce((s, y) => s + y.position, 0) / seasons)
    : myLeaguePosition();
  const titles = (CAREER.seasonAwards || []).reduce((n, a) => n + countTitlesThisSeason(a), 0);
  const clubHistory = (CAREER.clubHistory || []).slice();
  clubHistory.unshift({ clubId: CAREER.clubId, clubName: CAREER.clubName, seasons, titles, avgPosition, reason });
  let reputation = CAREER.reputation == null ? 50 : CAREER.reputation;
  if (reason === "dismissed") reputation = clamp(reputation - REPUTATION_DISMISSAL_PENALTY, 0, 100);
  TECHNICIAN_CARRY = { reputation, clubHistory };
}
// Clubes "maiores" (força de elenco bem acima do seu, ver
// squadAvgOverallOf) fazem proposta quando a reputação bate um
// patamar proporcional à diferença de força — checa 1x por temporada,
// na virada (mesma cadência do patrocínio, ver advanceSponsorshipSeason
// logo abaixo), e só quando não há proposta pendente ainda (evita
// empilhar convite sobre convite sem resposta).
const CLUB_PROPOSAL_MIN_OVR_GAP = 3;
function maybeGenerateClubProposals() {
  CAREER.clubProposals = CAREER.clubProposals || [];
  if (CAREER.clubProposals.length) return;
  const myOverall = averageOverall(CAREER.squad.filter((p) => p.origin === "principal"));
  const reputation = CAREER.reputation == null ? 50 : CAREER.reputation;
  const rng = seededRngFromKey(`club-proposal:${CAREER.clubId}:${CAREER.seasonYear}`);
  const candidates = LEAGUE_TEAMS.filter((t) => String(t.id) !== String(CAREER.clubId)).map((t) => {
    const theirOverall = squadAvgOverallOf(t.id);
    const gap = theirOverall - myOverall;
    const reputationRequired = clamp(Math.round(55 + gap * 3), 40, 95);
    return { t, gap, reputationRequired };
  }).filter((c) => c.gap >= CLUB_PROPOSAL_MIN_OVR_GAP && reputation >= c.reputationRequired);
  if (!candidates.length) return;
  candidates.sort((a, b) => b.gap - a.gap);
  const chosen = candidates[0];
  const budgetOffered = Math.round(wageBillOf(CAREER.leagueSquads[String(chosen.t.id)] || []) * 1.35 * (0.9 + rng() * 0.3) / 1000) * 1000;
  CAREER.clubProposals.push({
    clubId: String(chosen.t.id), clubName: chosen.t.name,
    reputationRequired: chosen.reputationRequired, budgetOffered, seasonYear: CAREER.seasonYear,
  });
}
// Notificação da proposta (ver btnSeasonContinue/seasonModalClose, que
// abrem essa modal automaticamente depois do resumo de virada de
// temporada quando existe proposta pendente) — reaberta a qualquer
// momento pelo card "Proposta de outro clube" na Central (ver
// renderCentral) caso o técnico feche no X sem decidir na hora.
function openClubProposalModal() {
  const p = (CAREER.clubProposals || [])[0];
  if (!p) return;
  document.getElementById("clubProposalText").textContent =
    `O ${p.clubName} quer você no comando! Orçamento oferecido pra folha salarial: ${fmtBRL(p.budgetOffered)}. Sua reputação (${CAREER.reputation}) chamou atenção da diretoria de lá.`;
  document.getElementById("clubProposalOverlay").classList.add("open");
}
function closeClubProposalModal() {
  document.getElementById("clubProposalOverlay").classList.remove("open");
}
// Aceitar troca clube — encerra a passagem atual (ver
// endCurrentClubStint) e reabre a tela "Escolha do clube" (documento
// pede reaproveitar essa tela, "com contexto do que o técnico fez no
// clube anterior") filtrada só pro clube ofertante, já que aqui não é
// escolha livre — só falta o próprio usuário clicar no card pra
// confirmar (mesmo startCareer de sempre resolve o resto).
function acceptClubProposal() {
  const p = (CAREER.clubProposals || [])[0];
  if (!p) { closeClubProposalModal(); return; }
  const prevClubName = CAREER.clubName, prevClubId = CAREER.clubId;
  endCurrentClubStint("accepted_proposal");
  closeClubProposalModal();
  const prev = TECHNICIAN_CARRY.clubHistory[0];
  const context = String(prevClubId) === String(p.clubId)
    ? "" // não deveria acontecer (proposta nunca é do próprio clube), mas evita banner sem sentido
    : `Você deixa o ${prevClubName} depois de ${prev.seasons} temporada(s) (${prev.titles} título(s), posição média ${prev.avgPosition}º) e chega ao ${p.clubName}.`;
  renderClubPicker([p.clubId], context);
  show("screenPicker");
}
function declineClubProposal() {
  CAREER.clubProposals = (CAREER.clubProposals || []).slice(1);
  closeClubProposalModal();
  persistCareer();
  renderCentral();
}
// FASE 4 (item 4) — tela de perfil do técnico (documento: "histórico de
// carreira — títulos, clubes, temporadas — dá senso de progressão de
// longo prazo tipo currículo"), aberta pelo menu "≡".
// AJUSTE (refatoração completa, Tela 11b — ver imagem "depois" do
// docx, 11b-perfil-tecnico) — kpiHTML() (Tela 3) no lugar do .ct-kpi
// genérico (Reputação/Status lado a lado, "Clube(s) no currículo"
// como bloco largo — grid-column:1/-1 no mesmo .mt-stat-grid, mesmo
// espírito do .mt-fin-block do card Financeiro); .mt-card no lugar de
// .ct-card pra cada passagem anterior.
function renderCoachProfile() {
  const rep = CAREER.reputation == null ? 50 : CAREER.reputation;
  const history = CAREER.clubHistory || [];
  const historyHTML = history.length
    ? history.map((h) => `
      <div class="mt-card">
        <div class="mt-card-title">${escapeHtml(h.clubName)}</div>
        <p class="ct-sub">${h.seasons} temporada(s) · ${h.titles} título(s) · posição média ${h.avgPosition}º${h.reason === "dismissed" ? " · saiu por demissão" : h.reason === "accepted_proposal" ? " · saiu por proposta de outro clube" : ""}</p>
      </div>`).join("")
    : `<p class="ct-empty">Nenhuma passagem anterior ainda — esse é seu primeiro clube.</p>`;
  document.getElementById("coachProfileBody").innerHTML = `
    <div class="mt-stat-grid" style="margin-bottom:14px;">
      ${kpiHTML("Reputação", rep, "gold")}
      <div class="mt-stat-block"><div class="num" style="font-size:17px;">${escapeHtml(reputationLabel(rep))}</div><div class="lbl">Status</div></div>
      <div class="mt-stat-block" style="grid-column:1 / -1;"><div class="num">${history.length}</div><div class="lbl">Clube(s) no currículo</div></div>
    </div>
    <p class="ct-sub" style="margin-bottom:14px;">Clube atual: <b>${escapeHtml(CAREER.clubName)}</b> — ${(CAREER.seasonHistory || []).length} temporada(s) aqui até agora.</p>
    ${historyHTML}`;
}
function openCoachProfileScreen() {
  renderCoachProfile();
  document.getElementById("coachProfileOverlay").classList.add("open");
}
function closeCoachProfileScreen() {
  document.getElementById("coachProfileOverlay").classList.remove("open");
}

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
    // Retenção/Engajamento — "Campeão da Copa" (conquista permanente,
    // nunca reseta). Contador cumulativo, não boolean direto, pro
    // mesmo motivo do "Ídolo"/"Joia da Base": um save de migração
    // "silent" não deveria contar título nenhum retroativo que a
    // simulação normal (com prêmio/notícia de verdade) nunca gerou.
    if (!silent && cup.championIsHuman) {
      CAREER.titlesWonCopa = (CAREER.titlesWonCopa || 0) + 1;
      evaluateAlwaysCheckableAchievements();
    }
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
// Nova feature (mockup brtreinadorbloco1pendentes.html, tela "Histórico
// de confrontos") — histórico de partidas do SEU clube (não da liga
// inteira: só os ~38 jogos por temporada em que CAREER.clubId jogou),
// guardado pra sempre dar retrospecto V-E-D contra um adversário
// específico. Cap generoso (~5 temporadas) — cada entrada é minúscula
// (5 campos), mas sem teto cresceria sem parar numa carreira muito
// longa, mesmo espírito de MAX_SEASON_HISTORY/NEWS_FEED_MAX.
const MAX_MATCH_LOG = 200;
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
  // FASE 4 (item 6) — goalsSeason/assistsSeason também zeram aqui (são
  // "da temporada", ver attributeGoals/computeSeasonAwards).
  squad.forEach((p) => { p.age += 1; p.status = "ok"; p.outUntilRound = null; p.injurySeverity = null; p.yellowCards = 0; p.goalsSeason = 0; p.assistsSeason = 0; });
  const kept = squad.filter((p) => p.contractUntil >= CAREER.seasonYear);
  const rng = seededRngFromKey(`renew-league:${club.id}:${CAREER.seasonYear}`);
  // AJUSTE (pedido do usuário: "o mercado deve trazer jogadores das 3
  // ligas") — piso certo por time (ver minSquadSizeFor) — repor sempre
  // até MIN_LEAGUE_SQUAD (16) reencheria de mais um time de outra
  // divisão (piso menor de propósito, 12 — ver
  // MIN_LEAGUE_SQUAD_OTHER_DIVISION), voltando a inflar o save a cada
  // virada de temporada mesmo sem nenhuma negociação de verdade.
  const missing = Math.max(0, minSquadSizeFor(club.id) - kept.length);
  const fresh = Array.from({ length: missing }, (_, i) => buildGeneratedProPlayer(club, i, rng));
  return [...kept, ...fresh];
}
// Elenco do SEU clube: envelhece, quem venceu contrato sai de graça
// (limpa da escalação também), repõe a base até 16 com jovens novos
// (mesmo gerador de sempre, ver buildBasePlayer) e o principal até o
// mínimo jogável se caiu abaixo por causa das saídas.
function renewHumanSquad() {
  // BUG CORRIGIDO — mesmo problema/motivo do renewLeagueSquad acima.
  // FASE 4 (item 6) — goalsSeason/assistsSeason também zeram aqui.
  CAREER.squad.forEach((p) => { p.age += 1; p.status = "ok"; p.outUntilRound = null; p.injurySeverity = null; p.yellowCards = 0; p.goalsSeason = 0; p.assistsSeason = 0; });
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
/* ---------- FASE 4 (item 6 da especificação "BR Data Treinador") —
   premiações de final de temporada ----------
   Calculada dentro de advanceSeason, ANTES de qualquer reset (tabela,
   goalsSeason/assistsSeason, Copa) — usa os dados da temporada que
   ACABOU de terminar. Brasileirão sempre tem os 5 prêmios (campeão/
   vice/artilheiro/assistências/melhor jogador, com os 20 clubes
   participando de verdade). Copa do Brasil só tem campeão/vice —
   decisão nossa: a Copa só roda de verdade quando o SEU clube se
   classifica (ver setupCup/resolveCupPhase, cup.active), e mesmo
   quando roda, só o lado HUMANO tem gol/assistência atribuídos a
   jogador de verdade (ver simulateCupTie) — não dá pra apurar
   artilheiro/melhor jogador da Copa sem estatística real dos outros
   15 clubes, então fica só com os 2 prêmios que a própria estrutura
   do chaveamento já garante de verdade.
   Desempate (pedido do usuário): quem jogou MENOS partidas vence. */
function computeSeasonAwards() {
  const sortedStandings = Object.values(CAREER.standings).sort((a, b) => (b.pts - a.pts) || (b.v - a.v) || (b.sg - a.sg) || (b.gp - a.gp));
  const campeao = sortedStandings[0] ? sortedStandings[0].id : null;
  const vice = sortedStandings[1] ? sortedStandings[1].id : null;

  const allPlayers = [];
  CAREER.squad.filter((p) => p.origin === "principal" || p.origin === "loan").forEach((p) => allPlayers.push({ p, clubId: CAREER.clubId }));
  Object.entries(CAREER.leagueSquads || {}).forEach(([clubId, squad]) => {
    squad.forEach((p) => allPlayers.push({ p, clubId }));
  });
  const awardEntry = (e, valor) => ({ jogadorId: e.p.id, nome: e.p.name, clubeId: e.clubId, clubeName: teamById(e.clubId).name, valor });
  const pickBestBy = (statKey) => {
    const withStat = allPlayers.filter((e) => (e.p[statKey] || 0) > 0);
    if (!withStat.length) return null;
    withStat.sort((a, b) => (b.p[statKey] - a.p[statKey]) || ((a.p.apps || 0) - (b.p.apps || 0)));
    return awardEntry(withStat[0], withStat[0].p[statKey]);
  };
  const artilheiro = pickBestBy("goalsSeason");
  const assistencias = pickBestBy("assistsSeason");
  const melhorRanked = allPlayers.slice().sort((a, b) => (b.p.overall - a.p.overall) || ((a.p.apps || 0) - (b.p.apps || 0)));
  const melhorJogador = melhorRanked.length ? awardEntry(melhorRanked[0], melhorRanked[0].p.overall) : null;

  const cup = CAREER.cup;
  const cupDone = !!(cup && cup.active && cup.phase === "done" && cup.ties.final[0]);
  const copaDoBrasil = cupDone
    ? { disputou: true, campeao: cup.champion, vice: String(cup.ties.final[0].home) === String(cup.champion) ? cup.ties.final[0].away : cup.ties.final[0].home }
    : { disputou: false, campeao: null, vice: null };

  return { seasonYear: CAREER.seasonYear, brasileirao: { campeao, vice, artilheiro, assistencias, melhorJogador }, copaDoBrasil };
}
// Tela própria (pedido do usuário) com o histórico de premiações de
// TODAS as temporadas já fechadas (ver CAREER.seasonAwards, mais novo
// primeiro) — aberta pelo menu "≡" (ver btnOpenAwards).
// AJUSTE (pedido do usuário: "premiações merece mais capricho no
// design") — trocou linhas de texto simples por um "hall da fama" de
// verdade: escudo dos clubes (ver crestImg, já usado em Central/
// Mercado — nada de novo pra carregar), pódio Campeão/Vice lado a
// lado com medalhas, prêmios individuais em blocos tipo KPI, borda
// dourada no card inteiro da temporada em que o SEU clube foi campeão
// (Brasileirão OU Copa), e um resumo geral do currículo (títulos
// somados em toda a carreira) no topo da tela.
function awardPodiumHTML(medal, label, clubId, mine) {
  const t = clubId != null ? teamById(clubId) : null;
  return `<div class="slot${mine ? " mine" : ""}">
    <span class="medal">${medal}</span>${t ? crestImg(t, 26) : ""}
    <div><span class="lbl">${label}</span><span class="nm">${t ? escapeHtml(t.name) : "—"}</span></div>
  </div>`;
}
function awardStatTileHTML(icon, label, entry, unit) {
  const mine = entry && String(entry.clubeId) === String(CAREER.clubId);
  return `<div class="ct-award-stat${mine ? " mine" : ""}">
    <span class="icon">${icon}</span><span class="lbl">${label}</span>
    <span class="nm">${entry ? escapeHtml(abbreviateName(entry.nome)) : "—"}</span>
    ${entry ? `<span class="sub">${escapeHtml(entry.clubeName)} · ${entry.valor} ${unit}</span>` : ""}
  </div>`;
}
function renderAwardsScreen() {
  const list = CAREER.seasonAwards || [];
  const hero = document.getElementById("awardsHero");
  const box = document.getElementById("awardsList");
  if (!list.length) {
    hero.innerHTML = "";
    box.innerHTML = `<p class="ct-empty">Nenhuma temporada encerrada ainda — as premiações aparecem aqui ao fim de cada temporada (ver "Avançar para a próxima temporada" na Central).</p>`;
    return;
  }
  const myTitles = list.reduce((acc, a) => {
    if (String(a.brasileirao.campeao) === String(CAREER.clubId)) acc.brasileirao++;
    if (a.copaDoBrasil.disputou && String(a.copaDoBrasil.campeao) === String(CAREER.clubId)) acc.copa++;
    return acc;
  }, { brasileirao: 0, copa: 0 });
  const totalTitles = myTitles.brasileirao + myTitles.copa;
  hero.innerHTML = totalTitles
    ? `<div class="big">🏆 ${totalTitles}</div><div class="lbl">${[myTitles.brasileirao ? `${myTitles.brasileirao}× Brasileirão` : "", myTitles.copa ? `${myTitles.copa}× Copa do Brasil` : ""].filter(Boolean).join(" · ")}</div>`
    : `<div class="big">—</div><div class="lbl">Nenhum título ainda no currículo — a próxima temporada pode ser a primeira</div>`;

  box.innerHTML = list.map((a) => {
    const b = a.brasileirao;
    const cup = a.copaDoBrasil;
    const mineChampion = String(b.campeao) === String(CAREER.clubId) || (cup.disputou && String(cup.campeao) === String(CAREER.clubId));
    const podium = `<div class="ct-award-podium">
      ${awardPodiumHTML("🥇", "Campeão", b.campeao, String(b.campeao) === String(CAREER.clubId))}
      ${awardPodiumHTML("🥈", "Vice", b.vice, String(b.vice) === String(CAREER.clubId))}
    </div>`;
    const stats = `<div class="ct-award-stats">
      ${awardStatTileHTML("⚽", "Artilheiro", b.artilheiro, "gols")}
      ${awardStatTileHTML("🅰️", "Assistências", b.assistencias, "assist.")}
      ${awardStatTileHTML("⭐", "Melhor do torneio", b.melhorJogador, "OVR")}
    </div>`;
    const cupHTML = cup.disputou
      ? `<div class="ct-award-cup">
          <div class="title">Copa do Brasil</div>
          <div class="ct-award-podium">
            ${awardPodiumHTML("🥇", "Campeão", cup.campeao, String(cup.campeao) === String(CAREER.clubId))}
            ${awardPodiumHTML("🥈", "Vice", cup.vice, String(cup.vice) === String(CAREER.clubId))}
          </div>
        </div>`
      : `<div class="ct-award-cup"><p class="ct-sub" style="margin:0;">Copa do Brasil: não disputada essa temporada.</p></div>`;
    return `<div class="ct-award-season${mineChampion ? " champion" : ""}">
      <div class="yr"><h2>Temporada ${a.seasonYear}</h2>${mineChampion ? `<span class="ribbon">Você foi campeão</span>` : ""}</div>
      ${podium}
      ${stats}
      ${cupHTML}
    </div>`;
  }).join("");
}
function applySeasonAwardMoraleBoost(award) {
  const b = award.brasileirao;
  [b.artilheiro, b.assistencias, b.melhorJogador].forEach((entry) => {
    if (!entry || String(entry.clubeId) !== String(CAREER.clubId)) return;
    const p = CAREER.squad.find((x) => x.id === entry.jogadorId);
    if (p) p.morale = clamp((p.morale == null ? 70 : p.morale) + 15, 0, 100);
  });
}
function openAwardsScreen() {
  renderAwardsScreen();
  document.getElementById("awardsOverlay").classList.add("open");
}
function closeAwardsScreen() {
  document.getElementById("awardsOverlay").classList.remove("open");
}
// Só pode ser chamada com a temporada realmente encerrada (round > 38,
// ver renderCentral) — devolve o resumo pro modal de nova temporada
// (ver showSeasonModal).
async function advanceSeason() {
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
  // FASE 4 (item 6) — premiações da temporada que ACABOU de terminar
  // (ver computeSeasonAwards) — guarda mesmo numa temporada de
  // demissão (ver DISMISSAL_STREAK logo abaixo), o que aconteceu NA
  // temporada vale pro hall da fama independente do que acontece com
  // o técnico depois.
  CAREER.seasonAwards = CAREER.seasonAwards || [];
  CAREER.seasonAwards.unshift(computeSeasonAwards());
  if (CAREER.seasonAwards.length > MAX_SEASON_HISTORY) CAREER.seasonAwards.length = MAX_SEASON_HISTORY;
  // FASE 4 (item 4) — reputação reflete o que ACONTECEU nessa temporada
  // mesmo quando ela termina em demissão (a penalidade de demissão em
  // si só entra depois, quando o usuário confirma "Escolher outro
  // clube" — ver endCurrentClubStint).
  applySeasonReputationDelta(goalWasMet, CAREER.seasonAwards[0]);

  // Retenção/Engajamento — igual premiações/reputação acima, o que
  // ACONTECEU nesta temporada vale independente do que vem depois
  // (mesmo numa temporada de demissão): objetivo de "termine entre os
  // 4 primeiros" e as 2 conquistas que só fazem sentido conferir no
  // FIM de uma temporada (gols/faltas acumulados o ano inteiro, ver
  // evaluateSeasonEndAchievements).
  ensureObjectivesFresh();
  const top4Obj = CAREER.objectives.season.find((o) => o.objectiveId === "obj_top4");
  if (top4Obj && top4Obj.status === "in_progress" && finishedPos <= 4) {
    top4Obj.currentProgress = top4Obj.target;
    top4Obj.status = "completed";
    toast({ title: "Objetivo concluído!", detail: top4Obj.title }, { type: "pos" });
  }
  if (finishedPos === 1) CAREER.titlesWonNacional = (CAREER.titlesWonNacional || 0) + 1;
  evaluateSeasonEndAchievements(CAREER.seasonTeamGoals || 0, CAREER.seasonTeamFouls || 0);
  evaluateAlwaysCheckableAchievements();

  CAREER.negativeSeasonsStreak = goalWasMet ? 0 : (CAREER.negativeSeasonsStreak || 0) + 1;
  // FASE 1 (item 3) — demissão: a diretoria não segue com o treinador
  // depois de DISMISSAL_STREAK temporadas seguidas sem bater a meta.
  // Não mexe em MAIS NADA do save (elenco, calendário, teto) — o fim
  // de carreira nesse clube é definitivo (ver showDismissalModal, que
  // apaga o save inteiro quando o usuário confirma).
  if (CAREER.negativeSeasonsStreak >= DISMISSAL_STREAK) {
    return { dismissed: true, finishedYear, finishedPos, finishedGoal, goalWasMet, streak: CAREER.negativeSeasonsStreak };
  }

  // FASE 4 (item 5) — patrocínio: precisa rodar ANTES de setupCup()
  // resetar CAREER.cup mais abaixo (sponsorshipTier lê
  // cup.championIsHuman da temporada que ACABOU de terminar).
  advanceSponsorshipSeason();
  CAREER.seasonYear += 1;
  // FASE 2 (c) — empréstimos (nos dois sentidos) sempre voltam pro dono
  // de origem na virada de temporada — ANTES da renovação normal, pra
  // quem voltou também envelhecer/ter o contrato checado como qualquer
  // outro jogador do elenco (ver resolveLoanReturns).
  resolveLoanReturns();
  const humanRenewal = renewHumanSquad();
  // FASE 4 (item 6) — efeito em cascata já possível hoje: moral já
  // existe desde a Fase 2 (b), mesmo sem o sistema completo de
  // "relacionamento jogador-técnico" da Fase 4 item 1 ainda existir —
  // prêmio individual pro SEU jogador sobe a moral dele. Depois do
  // reset de moral de renewHumanSquad acima (senão o boost seria
  // parcialmente engolido pela regressão ao neutro da própria virada
  // de temporada). Patrocínio já escala sozinho com título/posição
  // (ver sponsorshipTier), sem precisar de nada extra aqui.
  applySeasonAwardMoraleBoost(CAREER.seasonAwards[0]);
  Object.keys(CAREER.leagueSquads).forEach((clubId) => {
    CAREER.leagueSquads[clubId] = renewLeagueSquad(teamById(clubId), CAREER.leagueSquads[clubId]);
  });

  // Nova feature (pedido do usuário: "reinicie o tema do
  // rebaixamento") — acesso/rebaixamento entre A/B/C + repositório da
  // Série D, ANTES do calendário/tabela da temporada nova serem
  // gerados mais abaixo (ver applyPromotionRelegation) — se o SEU
  // clube subiu ou caiu de divisão, LEAGUE_TEAMS já reflete a divisão
  // nova a partir daqui (sem efeito nenhum em carreira sem o sistema
  // ativado, ver migrateCareerDefaults).
  const promotionRelegation = await applyPromotionRelegation();

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
  // FASE 4 (item 3) — jejum de vitória zera junto com a tabela (é "da
  // temporada", mesmo critério de CAREER.teamStats logo abaixo).
  CAREER.teamWinlessStreak = {};
  CAREER.teamStats = { assists: 0, yellow: 0, red: 0 }; // estatísticas da Estatísticas são "da temporada", zeram junto com a tabela
  // Retenção/Engajamento — contadores "desta temporada" (ver
  // evaluateSeasonEndAchievements acima) e objetivos de temporada,
  // mesmo espírito de reset dos outros campos "por temporada" logo
  // acima.
  CAREER.seasonTeamGoals = 0;
  CAREER.seasonTeamFouls = 0;
  CAREER.objectives.season = freshObjectiveList("season");
  pushTransferLog(`Início da Temporada ${CAREER.seasonYear}.`, 1);

  // FASE 1 (item 3) — meta da temporada nova, já em cima do elenco
  // RENOVADO (reflete quem saiu/chegou agora, não o elenco velho).
  CAREER.boardGoal = computeBoardGoal();
  // FASE 2 (a) — novo chaveamento da Copa do Brasil, mesmo motivo do
  // boardGoal acima (elenco renovado de todo mundo, não só o seu).
  setupCup();
  // FASE 4 (item 4) — checa proposta de outro clube pra temporada que
  // está começando agora (reputação já atualizada acima, elenco já
  // renovado nos dois lados) — ver showSeasonModal/btnSeasonContinue,
  // que abre a notificação depois do resumo da virada de temporada.
  maybeGenerateClubProposals();

  return { dismissed: false, finishedYear, finishedPos, finishedGoal, goalWasMet, newYear: CAREER.seasonYear, humanRenewal, newGoal: CAREER.boardGoal, promotionRelegation };
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
// AJUSTE (pedido do usuário: "o mercado deve trazer jogadores das 3
// ligas para que transações possam ser feitas entre os 60 times das
// Séries A, B e C") — BUG CORRIGIDO antes mesmo de publicar (achado
// testando com o server real: carreira "multi" recém-criada já nascia
// com ~640KB de save, estourando o limite de 400KB do servidor —
// server/src/careerStore.js — e ficando incapaz de salvar qualquer
// progresso a partir da 1ª rodada). Time de OUTRA divisão nunca entra
// em campo nesta carreira (o calendário só joga dentro da própria
// divisão, ver CAREER.schedule) — só existe no mercado pra comprar/
// vender/emprestar, então não precisa do mesmo elenco completo de um
// adversário de verdade (MAX/MIN_LEAGUE_SQUAD acima). Elenco mais
// enxuto SÓ pros 40 times de fora (os 19 da própria divisão continuam
// com o elenco cheio de sempre, usados de verdade em pickCpuXI a cada
// rodada) — ainda de sobra pra variedade de mercado (40 times × até 16
// jogadores = 640 opções), cortando boa parte do peso extra no save.
const MAX_LEAGUE_SQUAD_OTHER_DIVISION = 16;
const MIN_LEAGUE_SQUAD_OTHER_DIVISION = 12;
async function buildLeagueSquad(club) {
  const rng = seededRngFromKey(`league-squad:${club.id}:${LIVE_SEASON}`);
  // AJUSTE (pedido do usuário: "o mercado deve trazer jogadores das 3
  // ligas") — club.competitionId só existe pra times de OUTRA divisão
  // (ver loadOtherCompetitionsTeams); time da própria divisão não tem
  // esse campo, fetchRealPlayers já assume CURRENT_COMPETITION_ID nesse
  // caso (mesmo comportamento de sempre).
  const otherDivision = !!club.competitionId && club.competitionId !== CURRENT_COMPETITION_ID;
  const maxSquad = otherDivision ? MAX_LEAGUE_SQUAD_OTHER_DIVISION : MAX_LEAGUE_SQUAD;
  const minSquad = otherDivision ? MIN_LEAGUE_SQUAD_OTHER_DIVISION : MIN_LEAGUE_SQUAD;
  const raw = await fetchRealPlayers(club.id, club.competitionId).catch(() => []);
  const realPlayers = raw.slice(0, maxSquad).map((p) => buildRealPlayer(p, club, rng));
  const missing = Math.max(0, minSquad - realPlayers.length);
  const filler = Array.from({ length: missing }, (_, i) => buildGeneratedProPlayer(club, i, rng));
  return [...realPlayers, ...filler];
}
// Constrói o elenco dos outros times de uma vez (em paralelo — cada
// busca já é cacheada 12h no servidor, ver TTL.teams em server.js, o
// mesmo endpoint que /api/teams/:id/players sempre usou, então o custo
// real de fornecedor só existe na 1ª carreira criada depois do cache
// vencer, não a cada carreira nova). Falha isolada por time (ver catch
// dentro de buildLeagueSquad) não derruba a criação da carreira.
//
// AJUSTE (pedido do usuário: "o mercado deve trazer jogadores das 3
// ligas para que transações possam ser feitas entre os 60 times das
// Séries A, B e C") — `teams` agora é parâmetro (era sempre
// LEAGUE_TEAMS, só os 19 outros da própria divisão) — startCareer
// passa ALL_TEAMS_FLAT (as 3 competições juntas, ver
// loadOtherCompetitionsTeams), então o elenco é montado pros 59
// outros times das 3 séries de uma vez, não só os 19 da divisão da
// carreira.
async function buildLeagueSquads(humanClubId, teams = LEAGUE_TEAMS) {
  const others = teams.filter((t) => String(t.id) !== String(humanClubId));
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

/* ---------- Acesso e rebaixamento entre Séries A/B/C + repositório
   Série D (pedido do usuário: "reinicie o tema do rebaixamento")
   ----------
   Decisões confirmadas com o usuário antes de implementar:
   (a) a tabela das 2 divisões que o técnico NÃO joga é um campeonato
       de pontos corridos DE VERDADE, simulado em segundo plano rodada
       a rodada (não um proxy de força) — ver resolveOtherDivisionsRound;
   (b) vale independente da fonte de dado (exemplo/congelado/ao vivo).
       LEAGUE_TEAMS/ALL_TEAMS_FLAT são recarregados do catálogo (ou da
       API) a cada boot (ver loadLeague/loadOtherCompetitionsTeams em
       enterAfterAuth) — pra sobreviver a isso, CAREER.divisionTeams
       (não esses 2 globais) é a fonte de verdade de "quem está em qual
       divisão agora" pra toda carreira com este sistema ativado; ver
       o fim de enterAfterAuth, que sobrescreve os 2 globais com
       CAREER.divisionTeams sempre que ele existir.
   (c) Série D é só um REPOSITÓRIO de 20 times (DEMO_TEAMS_SERIE_D, ver
       data.js) — nunca simulados (mesmo motivo já documentado pra
       Série D no site principal) — só entram/saem da Série C na
       virada de temporada, sorteados (não há tabela real de verdade
       pra ordenar quem "merece" subir de lá).
   (d) só carreira NOVA nasce com este sistema (CAREER.serieDPool) —
       sem migração pra quem já tinha carreira salva antes desta
       mudança (ver migrateCareerDefaults, que nunca cria esse campo
       pra save antigo — todo o resto desta seção fica inofensivo/
       desligado quando ele não existe).

   Exceção deliberada: o clube do PRÓPRIO técnico nunca é enviado pra
   Série D, mesmo terminando a Série C na zona de rebaixamento (D não é
   jogável) — nesse caso, quem desce no lugar dele é o time melhor
   colocado que ficaria de fora da zona (a "vítima" muda, o tamanho da
   zona de 4 times não muda). */
const RELEGATION_N = 4; // mesmo tamanho da zona de rebaixamento já usada na Tabela (ver .mt-zone-dot)
function freshDivisionRound(teams) {
  const ids = teams.map((t) => String(t.id));
  const standings = {};
  ids.forEach((id) => { standings[id] = { id, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0, pts: 0 }; });
  return { schedule: generateAllRounds(ids), standings };
}
// Chamado só na criação de carreira NOVA (ver startCareer) — monta o
// snapshot inicial de CAREER.divisionTeams (3 divisões x 20 times,
// cada time já com competitionId certo) a partir do que loadLeague/
// loadOtherCompetitionsTeams acabaram de carregar, e o calendário +
// tabela zerados das 2 divisões que não são a sua.
function initDivisionSystem() {
  CAREER.divisionTeams = {};
  ALL_COMPETITIONS_ORDER.forEach((compId) => {
    const source = compId === CURRENT_COMPETITION_ID ? LEAGUE_TEAMS : ALL_TEAMS_FLAT.filter((t) => t.competitionId === compId);
    CAREER.divisionTeams[compId] = source.map((t) => ({ ...t, competitionId: compId }));
  });
  CAREER.serieDPool = DEMO_TEAMS_SERIE_D.map((t) => ({ ...t, competitionId: "serie_d" })); // global de js/data.js
  CAREER.otherDivisions = {};
  ALL_COMPETITIONS_ORDER.filter((id) => id !== CURRENT_COMPETITION_ID).forEach((compId) => {
    CAREER.otherDivisions[compId] = freshDivisionRound(CAREER.divisionTeams[compId]);
  });
}
// Tabela de uma divisão qualquer (a sua ou uma das outras 2) — usada
// pela Tabela (ver renderTabelaPanel) e pela virada de temporada (ver
// applyPromotionRelegation).
function divisionStandingsFor(compId) {
  if (compId === CURRENT_COMPETITION_ID) return CAREER.standings;
  return (CAREER.otherDivisions && CAREER.otherDivisions[compId] && CAREER.otherDivisions[compId].standings) || {};
}
function sortedDivisionRows(compId) {
  return Object.values(divisionStandingsFor(compId)).sort((a, b) => (b.pts - a.pts) || (b.v - a.v) || (b.sg - a.sg) || (b.gp - a.gp));
}
// Resolve, sem tela nem torcida, a rodada corrente das 2 divisões que
// o técnico NÃO joga — mesmo cálculo de gols por Poisson do CPU x CPU
// da própria divisão (ver resolveCpuFixture), só sem eventos de
// jogador (artilheiro/cartão de time de fora não entra em nenhuma
// estatística navegável, ver renderEstatisticas — filtrado por
// CAREER.standings de propósito desde a mudança "mercado de 60
// times"). Chamado de dentro de finishRoundTail, toda rodada.
function resolveOtherDivisionsRound(round) {
  if (!CAREER.otherDivisions) return; // carreira sem o sistema ativado (ver migrateCareerDefaults) — nada a fazer
  Object.entries(CAREER.otherDivisions).forEach(([compId, division]) => {
    const fixtures = division.schedule[round] || [];
    const teamsById = new Map((CAREER.divisionTeams[compId] || []).map((t) => [String(t.id), t]));
    fixtures.forEach((fx) => {
      const home = teamsById.get(String(fx.home)), away = teamsById.get(String(fx.away));
      if (!home || !away) return;
      const lambdaHome = clamp((home.atk / away.def) * 1.12, 0.05, 6);
      const lambdaAway = clamp(away.atk / home.def, 0.05, 6);
      const gh = poissonSample(lambdaHome, Math.random); // global de js/data.js
      const ga = poissonSample(lambdaAway, Math.random);
      applyResultToStandings({ home: fx.home, away: fx.away, gh, ga }, division.standings);
    });
  });
}
// Bottom n (zona de rebaixamento) de uma tabela já ordenada — quando
// `protectedId` está NA zona, troca ele pelo melhor colocado que
// ficaria de fora dela (ver exceção da Série D no comentário grande
// acima), mantendo o tamanho da zona em n.
function relegationZoneIds(sortedRows, n, protectedId) {
  const ids = sortedRows.map((r) => String(r.id));
  let zone = ids.slice(ids.length - n);
  if (protectedId != null && zone.includes(String(protectedId))) {
    zone = zone.filter((id) => id !== String(protectedId));
    zone.push(ids[ids.length - n - 1]);
  }
  return zone;
}
function accessZoneIds(sortedRows, n) {
  return sortedRows.slice(0, n).map((r) => String(r.id));
}
// Cascata de acesso/rebaixamento entre A/B/C + repositório da Série D
// na virada de temporada (ver advanceSeason, chamado ANTES de
// LEAGUE_TEAMS/CAREER.schedule/CAREER.standings serem recalculados pra
// temporada nova — já precisa estar tudo resolvido nesse ponto). É
// `async` só por causa do elenco novo dos times promovidos da Série D
// (ver buildLeagueSquad — nunca tiveram elenco montado antes).
async function applyPromotionRelegation() {
  if (!CAREER.serieDPool) return null; // carreira sem o sistema ativado — nada a fazer
  const rowsA = sortedDivisionRows("brasileirao");
  const rowsB = sortedDivisionRows("serie_b");
  const rowsC = sortedDivisionRows("serie_c");
  const relegatedA = relegationZoneIds(rowsA, RELEGATION_N);
  const promotedB = accessZoneIds(rowsB, RELEGATION_N);
  const relegatedB = relegationZoneIds(rowsB, RELEGATION_N);
  const promotedC = accessZoneIds(rowsC, RELEGATION_N);
  const relegatedC = relegationZoneIds(rowsC, RELEGATION_N, CURRENT_COMPETITION_ID === "serie_c" ? CAREER.clubId : null);

  const dPool = CAREER.serieDPool.slice();
  const promotedDIdx = [];
  while (promotedDIdx.length < Math.min(RELEGATION_N, dPool.length)) {
    const idx = Math.floor(Math.random() * dPool.length);
    if (!promotedDIdx.includes(idx)) promotedDIdx.push(idx);
  }
  const promotedD = promotedDIdx.map((i) => dPool[i]); // objetos completos — nunca estiveram em divisionTeams antes

  const byId = new Map();
  ALL_COMPETITIONS_ORDER.forEach((compId) => (CAREER.divisionTeams[compId] || []).forEach((t) => byId.set(String(t.id), t)));
  const teamsFor = (ids) => ids.map((id) => byId.get(String(id))).filter(Boolean);
  const idsOf = (rows) => rows.map((r) => String(r.id));

  const newA = [...teamsFor(idsOf(rowsA).filter((id) => !relegatedA.includes(id))), ...teamsFor(promotedB)];
  const newB = [
    ...teamsFor(idsOf(rowsB).filter((id) => !promotedB.includes(id) && !relegatedB.includes(id))),
    ...teamsFor(relegatedA), ...teamsFor(promotedC),
  ];
  const newC = [
    ...teamsFor(idsOf(rowsC).filter((id) => !promotedC.includes(id) && !relegatedC.includes(id))),
    ...teamsFor(relegatedB), ...promotedD,
  ];
  const newDPool = [...dPool.filter((_, i) => !promotedDIdx.includes(i)), ...teamsFor(relegatedC)];

  const humanNewCompId = newA.some((t) => String(t.id) === String(CAREER.clubId)) ? "brasileirao"
    : newB.some((t) => String(t.id) === String(CAREER.clubId)) ? "serie_b" : "serie_c";
  const divisionChanged = humanNewCompId !== CURRENT_COMPETITION_ID;

  // Time relegado pra Série D não é mais playável — elenco dele some
  // do save (ver marketTeamsPool, que já o exclui do universo de
  // negociação); time promovido de lá ganha elenco novo (mesmo
  // fallback de sempre pra catálogo fictício, ver buildLeagueSquad —
  // sem fonte de dado real nenhuma configurada pra "serie_d"). Mantém
  // o total de elencos em CAREER.leagueSquads sempre em 59 (60 times
  // ativos - o seu), do mesmo jeito que já era antes desta mudança.
  teamsFor(relegatedC).forEach((t) => { delete CAREER.leagueSquads[String(t.id)]; });
  await Promise.all(promotedD.map(async (t) => { CAREER.leagueSquads[String(t.id)] = await buildLeagueSquad(t); }));

  CAREER.divisionTeams = {
    brasileirao: newA.map((t) => ({ ...t, competitionId: "brasileirao" })),
    serie_b: newB.map((t) => ({ ...t, competitionId: "serie_b" })),
    serie_c: newC.map((t) => ({ ...t, competitionId: "serie_c" })),
  };
  CAREER.serieDPool = newDPool.map((t) => ({ ...t, competitionId: "serie_d" }));

  if (divisionChanged) {
    CURRENT_COMPETITION_ID = humanNewCompId;
    CAREER.competitionId = humanNewCompId;
  }
  LEAGUE_TEAMS = CAREER.divisionTeams[CURRENT_COMPETITION_ID];
  ALL_TEAMS_FLAT = ALL_COMPETITIONS_ORDER.flatMap((id) => CAREER.divisionTeams[id]);
  CAREER.otherDivisions = {};
  ALL_COMPETITIONS_ORDER.filter((id) => id !== CURRENT_COMPETITION_ID).forEach((compId) => {
    CAREER.otherDivisions[compId] = freshDivisionRound(CAREER.divisionTeams[compId]);
  });

  return {
    relegatedA: teamsFor(relegatedA), promotedB: teamsFor(promotedB),
    relegatedB: teamsFor(relegatedB), promotedC: teamsFor(promotedC),
    relegatedC: teamsFor(relegatedC), promotedD,
    divisionChanged, newCompetitionId: humanNewCompId,
  };
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
// AJUSTE (pedido do usuário: "o mercado deve trazer jogadores das 3
// ligas para que transações possam ser feitas entre os 60 times das
// Séries A, B e C" + confirmado que a IA entre times CPU também deve
// negociar entre as 3 divisões) — carreira "multi" usa os 60 times
// das 3 competições (ALL_TEAMS_FLAT) como universo de negociação, não
// só os 20 da própria divisão; carreira "single" (de antes desta
// mudança, ver migrateCareerDefaults) continua exatamente como
// sempre foi, só entre os times de LEAGUE_TEAMS.
// AJUSTE (pedido do usuário: "reinicie o tema do rebaixamento") — um
// time que caiu pro repositório da Série D (CAREER.serieDPool, ver
// applyPromotionRelegation) fica com competitionId "serie_d" em
// ALL_TEAMS_FLAT — nunca é playável/negociável enquanto estiver lá
// (só volta a existir pro mercado se for sorteado de volta pra Série C
// numa virada de temporada futura).
function marketTeamsPool() {
  const pool = CAREER.marketScope === "multi" ? ALL_TEAMS_FLAT : LEAGUE_TEAMS;
  return pool.filter((t) => t.competitionId !== "serie_d");
}
function pickRandomOtherClub(excludeId) {
  const pool = marketTeamsPool().filter((t) => String(t.id) !== String(excludeId));
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
// AJUSTE (pedido do usuário: "o mercado deve trazer jogadores das 3
// ligas") — time de OUTRA divisão tem um teto de elenco menor
// (MAX_LEAGUE_SQUAD_OTHER_DIVISION, ver buildLeagueSquad) — usar o
// teto do time da PRÓPRIA divisão (maior) como limite pra QUALQUER
// time deixaria um time de fora crescer sem limite de verdade (nunca
// bateria "cheio"), corroendo aos poucos a economia de tamanho de
// save que o teto menor foi feito pra garantir. Mesmo teste de
// CAREER.standings já usado em renderEstatisticas/computeBoardGoal
// pra saber se um id é da própria divisão.
function isOwnDivisionTeam(teamId) {
  return Object.prototype.hasOwnProperty.call(CAREER.standings, teamId);
}
function maxSquadSizeFor(teamId) {
  return isOwnDivisionTeam(teamId) ? MAX_LEAGUE_SQUAD : MAX_LEAGUE_SQUAD_OTHER_DIVISION;
}
function minSquadSizeFor(teamId) {
  return isOwnDivisionTeam(teamId) ? MIN_LEAGUE_SQUAD : MIN_LEAGUE_SQUAD_OTHER_DIVISION;
}
function findInterestedBuyer(excludeId) {
  const eligible = marketTeamsPool().filter((t) =>
    String(t.id) !== String(excludeId) && leagueSquadFor(t.id).length < maxSquadSizeFor(t.id)
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
// AJUSTE (pedido do usuário: "os empréstimos não estão realistas —
// jogadores de destaque devem ter empréstimos recusados") — antes,
// QUALQUER jogador (seu ou de outro clube) podia ser emprestado sem
// nenhuma trava de qualidade, só de interesse/vaga (ver
// findInterestedBuyer). Agora um jogador só topa ir emprestado (ou o
// clube dono só topa ceder o dele) quando NÃO é bom/relevante o
// bastante pra recusar — reaproveita playerComplaintFactor (mesmo
// ajuste, pedido na mesma frase: "atletas mais velhos, mais novos e
// com overall mais baixo não reclamam tanto") multiplicado pelo
// overall bruto: um "efetivo" alto (craque em idade de pico) recusa;
// veterano, garoto ou reserva de overall mais baixo — mesmo com
// overall parecido — aceita numa boa. Vale nos dois sentidos: SEU
// jogador recusando sair emprestado (finalizeLoanOut) e o clube
// adversário recusando ceder o dele pra você (finalizeLoanIn).
const LOAN_REFUSAL_EFFECTIVE_THRESHOLD = 55;
function isLoanOutRefused(p) {
  return p.overall * playerComplaintFactor(p) >= LOAN_REFUSAL_EFFECTIVE_THRESHOLD;
}
// Botão de empréstimo (Mercado, "Emprestar"/"Pegar emprestado") — a
// recusa por destaque é determinística (ao contrário do "sem
// comprador interessado", que é sorteio), então dá pra avisar ANTES do
// clique em vez de deixar o usuário abrir o sub-modal inteiro só pra
// ser recusado no fim — mesmo espírito de já desabilitar fora da
// janela de contratações.
function loanOutBtnAttrs(p, mktWindow) {
  if (!mktWindow.open) return `disabled title="Janela de contratações encerrada"`;
  if (isLoanOutRefused(p)) return `disabled title="Jogador de destaque demais — não aceita ser emprestado"`;
  return "";
}
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
  toast(`${abbreviateName(p.name)} voltou do empréstimo!`, { type: "pos" });
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
    toast(`${abbreviateName(p.name)} contratado em definitivo!`, { type: "pos" });
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
    toast("Janela de contratações encerrada — não dá pra negociar empréstimo agora.", { type: "warn" });
    return;
  }
  const p = CAREER.squad.find((x) => x.id === id);
  if (!p) return;
  if (p.origin !== "principal") { toast("Só dá pra emprestar jogador do elenco principal.", { type: "warn" }); return; }
  const principalCount = CAREER.squad.filter((x) => x.origin === "principal").length;
  if (principalCount <= 14) { toast("O elenco principal não pode ficar com menos de 14 jogadores.", { type: "warn" }); return; }
  // AJUSTE (pedido do usuário: "toda confirmação de empréstimo e venda
  // deve ter o clube para onde o jogador vai") — resolve o interessado
  // AQUI, ao abrir o modal, em vez de só no confirmar (finalizeLoanOut
  // recebia esse mesmo sorteio só depois de tudo configurado). Sem
  // interessado, nem abre o modal de configuração — mesmo espírito da
  // venda, evita o técnico configurar duração/cláusula à toa pra um
  // empréstimo que não vai ter pra quem ir.
  const buyer = findInterestedBuyer(CAREER.clubId);
  if (!buyer) {
    toast(`Nenhum time demonstrou interesse em pegar ${abbreviateName(p.name)} emprestado agora.`);
    return;
  }
  LOAN_CTX = { direction: "out", playerId: id, buyer };
  document.getElementById("loanTitle").textContent = "Emprestar jogador";
  document.getElementById("loanSub").textContent = `${abbreviateName(p.name)} · para o ${buyer.name} · valor de mercado ${fmtBRL(p.value)}`;
  document.getElementById("loanWagePctField").classList.add("hidden");
  resetLoanForm(p.value);
  document.getElementById("loanOverlay").classList.add("open");
}
function openLoanInModal(clubId, playerId) {
  if (!transferWindowStatus(CAREER.currentRound).open) {
    toast("Janela de contratações encerrada — não dá pra pegar jogador emprestado agora.", { type: "warn" });
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
    ok = await finalizeLoanOut(LOAN_CTX.playerId, { returnRound, buyOption, buyer: LOAN_CTX.buyer });
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
async function finalizeLoanOut(id, { returnRound, buyOption, buyer: passedBuyer } = {}) {
  const p = CAREER.squad.find((x) => x.id === id);
  if (!p) return false;
  if (isLoanOutRefused(p)) {
    toast(`${abbreviateName(p.name)} recusou o empréstimo — quer continuar brigando por espaço no elenco principal.`, { durationMs: 5000, type: "warn" });
    return false;
  }
  // AJUSTE (pedido do usuário, item 7) — o comprador já foi resolvido e
  // mostrado ao técnico em openLoanOutModal (pra não trocar quem
  // aparece na confirmação por outro clube no fim); só re-sorteia aqui
  // se chamado direto sem passar por lá (ex: chamada avulsa/teste).
  const buyer = passedBuyer || findInterestedBuyer(CAREER.clubId);
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
  toast(`${abbreviateName(p.name)} emprestado por ${fmtBRL(fee)}.`, { type: "pos" });
  ensureObjectivesFresh(); bumpObjective("daily", "obj_market_1_move", 1);
  return true;
}
async function finalizeLoanIn(clubId, playerId, { returnRound, buyOption, wagePct }) {
  const squad = leagueSquadFor(clubId);
  const idx = squad.findIndex((x) => x.id === playerId);
  if (idx < 0) return false;
  const p = squad[idx];
  if (isLoanOutRefused(p)) {
    toast(`${teamById(clubId).name} recusou emprestar ${abbreviateName(p.name)} — é peça importante demais pro clube.`, { durationMs: 5000, type: "warn" });
    return false;
  }
  const loanWage = Math.round((p.wage * (wagePct / 100)) / 100) * 100;
  if (wageBillOf(CAREER.squad) + loanWage > CAREER.finances.wageCap) {
    toast(`Pegar esse jogador emprestado estouraria o teto salarial (${fmtBRL(CAREER.finances.wageCap)}).`, { type: "warn" });
    return false;
  }
  if (CAREER.squad.length >= MAX_PRINCIPAL + 20) { toast("Elenco já está muito grande — dispense ou negocie alguém antes.", { type: "warn" }); return false; }
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
  toast(`${abbreviateName(p.name)} chegou emprestado!`, { type: "pos" });
  ensureObjectivesFresh(); bumpObjective("daily", "obj_market_1_move", 1);
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
    // AJUSTE (pedido do usuário: "o mercado deve trazer jogadores das
    // 3 ligas") — teto/piso certo por time (ver maxSquadSizeFor/
    // minSquadSizeFor) — um time de outra divisão tem elenco menor de
    // propósito (MAX/MIN_LEAGUE_SQUAD_OTHER_DIVISION), então usar o
    // piso/teto do time da própria divisão pra ele deixaria o elenco
    // dele encolher demais ou crescer sem limite de verdade.
    if (fromSquad.length <= minSquadSizeFor(fromClub.id)) continue; // não esvazia um elenco CPU
    const toClub = pickRandomOtherClub(fromClub.id);
    if (!toClub || String(toClub.id) === String(CAREER.clubId)) continue; // negociação CPU x CPU só, não mexe no SEU elenco sem sua ação
    if (leagueSquadFor(toClub.id).length >= maxSquadSizeFor(toClub.id)) continue; // elenco de destino já cheio
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
  // Escolhe o melhor disponível pro grupo pedido; prioriza o elenco
  // principal, só desce pra base se NINGUÉM do principal tiver esse
  // grupo reconhecido (comum pro goleiro quando o fornecedor de dado
  // não informa posição — ver mapPositionGroup — sem esse fallback, a
  // escalação automática colocaria por padrão um jogador de outra
  // posição no gol); nos 2 últimos degraus, quando nem a base tem
  // ninguém daquele grupo sobrando, aceita qualquer jogador só pra não
  // deixar a vaga vazia à toa. Compartilhado entre titulares e banco.
  function pickForGroup(grp) {
    const pick = principalPool.find((p) => !used.has(p.id) && p.group === grp)
      || fullPool.find((p) => !used.has(p.id) && p.group === grp)
      || principalPool.find((p) => !used.has(p.id))
      || fullPool.find((p) => !used.has(p.id));
    if (pick) used.add(pick.id);
    return pick ? pick.id : null;
  }
  const starters = slots.map(([grp]) => pickForGroup(grp));
  // AJUSTE (pedido do usuário: "a escalação automática deve sempre
  // conter 1 goleiro, 4 defensores, 3 meias e 3 atacantes [no banco].
  // Se não tiver atletas liberados para essas posições deve-se chamar
  // atletas da base") — banco de reservas segue essa forma fixa (os
  // mesmos 11 do MAX_BENCH), independente da formação titular
  // escolhida; antes eram só "os próximos melhores do elenco
  // principal" sem nenhuma garantia de posição (um banco podia sair
  // sem reserva de goleiro nenhum). pickForGroup já cai pra base
  // sozinho no 2º degrau quando o principal não tem mais ninguém
  // daquele grupo.
  const BENCH_SHAPE = [["G", 1], ["D", 4], ["M", 3], ["F", 3]];
  const bench = BENCH_SHAPE.flatMap(([grp, count]) => Array.from({ length: count }, () => pickForGroup(grp))).filter(Boolean);
  // AJUSTE (Bloco 2 M3) — tactics nasce com os 4 eixos reais, todos
  // neutros (nível 3/5, centro da barra segmentada — ver TACTIC_AXES).
  return { formation, starters, bench, tactics: { ritmo: 3, pressao: 3, linhaDefensiva: 3, estiloPasse: 3 }, sectorTactics: defaultSectorTactics() };
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
      toast("Sua sessão expirou — faça login de novo pra continuar salvando.", { type: "warn" });
      show("screenLoginRequired");
    } else if (err.status === 413) {
      toast("O save dessa carreira ficou grande demais — reinicie a carreira pra continuar salvando.", { type: "warn" });
    } else {
      // Código/motivo aparecem no toast de propósito (mesmo sendo mais
      // "técnico" do que o ideal pro usuário final): sem acesso aos
      // logs do servidor daqui, é a forma mais rápida de descobrir a
      // causa real de um erro que não é nem sessão expirada nem save
      // grande demais — quem estiver vendo isso pode repassar o texto.
      const detail = err.status ? `erro ${err.status}${err.message ? " — " + err.message : ""}` : (err.message || "sem conexão com o servidor");
      toast({ title: "Não deu pra salvar o progresso agora", detail: `${detail} — tente de novo em instantes.` }, { type: "warn" });
    }
    return false;
  }
}

/* ---------- Início de carreira ---------- */
// FASE 4 (item 4) — reaproveita essa mesma tela no fluxo de "aceitar
// proposta de outro clube" (documento pede isso: reaparecer com
// contexto do que o técnico fez no clube anterior, em vez de virar uma
// tela nova). filterIds restringe o grid só ao(s) clube(s) ofertante(s)
// (nesse fluxo não é escolha livre — ver acceptClubProposal); em
// qualquer outro fluxo (1ª escolha, reinício, demissão) segue mostrando
// os 20 normalmente, sem banner nenhum.
// AJUSTE (pedido do usuário: "acrescentar a Série B, C [ao Modo
// Carreira] com dados reais") — 1º passo de uma carreira NOVA (ver
// enterAfterAuth): mostra as divisões disponíveis pro Modo Carreira.
// Lista fixa aqui (não vem do /api/competitions do site principal —
// aquele endpoint já anota "locked" por PLANO, e a decisão do usuário
// foi deixar as 2 travas independentes: dentro do Modo Carreira,
// qualquer plano pode escolher qualquer uma destas 3). Série D fica de
// fora de propósito (formato de grupos + mata-mata, não bate com o
// motor de pontos corridos deste app — ver aviso em
// server/src/competitions.js) até ganhar um motor próprio.
const CAREER_COMPETITIONS = [
  { id: "brasileirao", flag: "🇧🇷", name: "Brasileirão Série A", sub: "20 clubes — a elite do futebol brasileiro" },
  { id: "serie_b", flag: "🇧🇷", name: "Brasileirão Série B", sub: "20 clubes — acesso e disputa direta pela Série A" },
  { id: "serie_c", flag: "🇧🇷", name: "Brasileirão Série C", sub: "20 clubes — a base da pirâmide do futebol nacional" },
];
// Rótulo curto de cada divisão (selo no Mercado — ver renderMercado)
// — mesmas 3 competições de CAREER_COMPETITIONS acima, sem o prefixo
// "Brasileirão" (não cabe numa pílula pequena ao lado do time).
const COMPETITION_SHORT = { brasileirao: "Série A", serie_b: "Série B", serie_c: "Série C" };
function renderCompetitionPicker() {
  document.getElementById("competitionList").innerHTML = CAREER_COMPETITIONS.map((c) => `
    <button class="mt-competition-card" data-competition="${escapeHtml(c.id)}">
      <span class="mt-competition-flag">${c.flag}</span>
      <span class="mt-competition-body">
        <div class="mt-competition-title">${escapeHtml(c.name)}</div>
        <div class="mt-competition-sub">${escapeHtml(c.sub)}</div>
      </span>
      <svg class="mt-competition-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
    </button>`).join("");
  document.querySelectorAll(".mt-competition-card").forEach((btn) => {
    btn.addEventListener("click", () => chooseCompetition(btn.dataset.competition));
  });
}
// Escolhida a divisão, carrega o campeonato certo (real, se disponível
// — ver loadLeague/DEMO_DATA_BY_COMPETITION) e só então mostra a
// Escolha do Clube, agora restrita aos times DESSA divisão.
async function chooseCompetition(competitionId) {
  show("screenLoading");
  document.getElementById("screenLoading").innerHTML = `<div class="ct-spinner"></div><p>Carregando o Modo Técnico...</p>`;
  await loadLeague(competitionId);
  renderClubPicker();
  show("screenPicker");
}
// Redesign (mockup brtreinadorbloco1inicio.html, tela 1 — Onboarding) —
// fluxo de 2 passos: clicar numa linha só seleciona (marca com check +
// fundo na cor do clube), só o FAB "Confirmar clube" chama startCareer()
// de fato. PICKER_SELECTED_CLUB é resetado a cada renderClubPicker() —
// nunca sobrevive de uma visita pra outra da tela.
let PICKER_SELECTED_CLUB = null;
function renderClubPicker(filterIds, bannerText) {
  const banner = document.getElementById("pickerContextBanner");
  if (bannerText) { banner.textContent = bannerText; banner.hidden = false; }
  else { banner.textContent = ""; banner.hidden = true; }
  // AJUSTE (pedido do usuário: "clubes em ordem alfabética") — LEAGUE_TEAMS
  // vem na ordem do fornecedor de dados (não alfabética); .slice() antes
  // de ordenar pra não embaralhar o array original (usado por sorteio,
  // tabela etc. em outros lugares do jogo).
  const teams = (filterIds ? LEAGUE_TEAMS.filter((t) => filterIds.some((id) => String(id) === String(t.id))) : LEAGUE_TEAMS.slice())
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const grid = document.getElementById("clubGrid");
  PICKER_SELECTED_CLUB = null;
  // BUG CORRIGIDO: startCareer() desabilita o FAB (evita duplo clique
  // enquanto a carreira carrega) mas nunca o reabilitava — reabrir a
  // Escolha do Clube (ex.: "Reiniciar") herdava o botão travado pra
  // sempre depois da 1ª carreira criada. Reseta aqui, toda vez que a
  // tela é (re)montada.
  const confirmBtn = document.getElementById("btnConfirmClub");
  confirmBtn.classList.add("hidden");
  confirmBtn.disabled = false;
  grid.style.opacity = "";
  grid.style.pointerEvents = "";
  // Meta line "Série A · Curitiba, PR" — uf só existe no catálogo demo
  // (DEMO_TEAMS); dado real (ver mapTeam() em sportmonks.js/frozen.js)
  // só tem venue.city, sem UF — degrada pra só cidade nesse caso, sem
  // quebrar nem inventar estado.
  const compLabel = COMPETITION_SHORT[CURRENT_COMPETITION_ID] || "Brasileirão";
  grid.innerHTML = teams.map((t) => {
    const city = t.venue?.city ? `${t.venue.city}${t.uf ? ", " + t.uf : ""}` : "";
    return `<div class="m3-club-row" data-id="${escapeHtml(String(t.id))}">
      ${crestImg(t, 36)}
      <div class="m3-club-body">
        <div class="m3-club-name">${escapeHtml(t.name)}</div>
        <div class="m3-club-meta">${escapeHtml(compLabel)}${city ? " · " + escapeHtml(city) : ""}</div>
      </div>
      <svg class="m3-club-check hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
    </div>`;
  }).join("");
  grid.querySelectorAll(".m3-club-row").forEach((el) => el.addEventListener("click", () => selectClubRow(el.dataset.id)));
}
function selectClubRow(clubId) {
  PICKER_SELECTED_CLUB = clubId;
  document.querySelectorAll("#clubGrid .m3-club-row").forEach((row) => {
    const isSel = row.dataset.id === String(clubId);
    row.classList.toggle("selected", isSel);
    row.querySelector(".m3-club-check").classList.toggle("hidden", !isSel);
  });
  document.getElementById("btnConfirmClub").classList.remove("hidden");
}
async function startCareer(clubId) {
  const club = LEAGUE_TEAMS.find((t) => String(t.id) === String(clubId));
  if (!club) return;
  document.getElementById("clubGrid").style.opacity = "0.5";
  document.getElementById("clubGrid").style.pointerEvents = "none";
  document.getElementById("btnConfirmClub").disabled = true;
  try {
    // AJUSTE (pedido do usuário: "o mercado deve trazer jogadores das
    // 3 ligas para que transações possam ser feitas entre os 60 times
    // das Séries A, B e C") — carrega os times das OUTRAS 2
    // competições (a da própria carreira já está em LEAGUE_TEAMS) e
    // monta o elenco dos 59 outros times das 3 séries juntas, não só
    // os 19 da divisão escolhida — ver loadOtherCompetitionsTeams/
    // buildLeagueSquads. liveModeByCompetition grava a fonte de dado
    // (real ou exemplo) de CADA UMA das 3, pro mesmo tipo de trava do
    // bug "Time #xxx" (ver loadLeague) valer aqui também, competição
    // por competição, quando essa carreira for retomada depois.
    const [liveModeByCompetition, squad] = await Promise.all([
      loadOtherCompetitionsTeams(CURRENT_COMPETITION_ID),
      buildSquad(club),
    ]);
    // buildLeagueSquads depende de ALL_TEAMS_FLAT (populada por
    // loadOtherCompetitionsTeams acima) — não dá pra paralelizar com
    // ela, só com buildSquad (que não depende de nada disso).
    const leagueSquads = await buildLeagueSquads(club.id, ALL_TEAMS_FLAT);
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
      // AJUSTE (pedido do usuário: "acrescentar a Série B, C [ao Modo
      // Carreira] com dados reais") — grava em qual campeonato essa
      // carreira nasceu (ver renderCompetitionPicker/CURRENT_COMPETITION_ID)
      // pra reabrir no campeonato certo da próxima vez (ver
      // enterAfterAuth, que lê isso ANTES de chamar loadLeague de novo).
      competitionId: CURRENT_COMPETITION_ID,
      liveMode: LIVE_MODE, createdAt: Date.now(), updatedAt: Date.now(),
      // AJUSTE (pedido do usuário: "o mercado deve trazer jogadores
      // das 3 ligas") — marca essa carreira como "mercado de 60
      // times" (toda carreira nova passa a nascer assim; carreira já
      // existente antes desta mudança fica sem esse campo — ver
      // migrateCareerDefaults — e continua com o mercado só da
      // própria divisão, por decisão do usuário, sem migração
      // automática). liveModeByCompetition grava a fonte de dado das
      // OUTRAS 2 competições (a própria já está em `liveMode` acima),
      // lido de novo em enterAfterAuth pra decidir forceDemo por
      // competição ao retomar essa carreira.
      marketScope: "multi", liveModeByCompetition,
      squad, lineup, leagueSquads,
      // AJUSTE (pedido do usuário: "vamos evoluir o método de
      // treinos") — nasce no esquema padrão "Equilíbrio Semanal" (ver
      // TRAINING_SCHEMES/defaultTrainingPlan) — nunca aplicado ainda
      // (trainingAppliedForRound null), então a 1ª "Ir para o jogo"
      // já aplica a semana padrão sozinha (ver goToMatch).
      trainingSchemeId: "equilibrio", trainingPlan: defaultTrainingPlan("equilibrio"), trainingAppliedForRound: null,
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
      // Nova feature — Histórico de confrontos (H2H, ver finishLiveMatch).
      matchLog: [],
      // Nova feature — Meus esquemas (Bloco 2, brtreinadorbloco2pendentes.html):
      // formação+titulares+banco+táticas salvos juntos (ver
      // saveTacticalScheme/applyTacticalScheme). activeSchemeId aponta
      // pro esquema em uso agora — null = "Personalizado" (mesmo
      // conceito já usado em CAREER.trainingSchemeId no módulo de
      // Treinos), fica null sozinho quando o técnico mexe em algo
      // manualmente depois de carregar um esquema (ver markLineupDirty).
      tacticalSchemes: [], activeSchemeId: null,
      // Nova feature — Marcação individual (Bloco 2): designação vale
      // só pro PRÓXIMO jogo (ver applyManMarking/finishRoundTail, que
      // limpa depois de cada rodada — nunca fica "esquecida" de uma
      // rodada pra outra).
      manMarking: null,
      // Nova feature — Comissão Técnica (pedido do usuário: "ajudar nos
      // treinos, escalação, táticas e outras opções pra garantir que
      // sempre o melhor time estará em campo"): assistente que SUGERE,
      // o técnico decide (ver suggestLineup/suggestTraining/
      // suggestTactics/suggestMarket) — nunca decide sozinho. Custa
      // salário mensal quando contratada (technicalStaffMonthlyCost),
      // igual à folha do elenco.
      technicalStaff: { hired: false },
      // Nova feature (Bloco 3, pedido do usuário — mockups
      // brtreinadorbloco3mercado.html/brtreinadorbloco3pendentes.html)
      // — negociação de compra (ver openOfferModal/
      // resolvePendingOffersOutRound) e parcelas de contratações já
      // fechadas (ver finalizeIncomingPurchase/processPendingInstallments).
      pendingOffersOut: [],
      pendingInstallments: [],
      // FASE 4 (item 3) — jejum de vitória por time, pra manchete
      // "encerra jejum de X jogos" (ver updateWinlessStreaks).
      teamWinlessStreak: {},
      // FASE 4 (item 6) — hall da fama de premiações por temporada (ver
      // computeSeasonAwards).
      seasonAwards: [],
      // FASE 4 (item 4) — reputação e currículo são do TÉCNICO, não do
      // clube: se essa carreira nasceu de uma demissão ou de uma
      // proposta aceita (ver endCurrentClubStint), TECHNICIAN_CARRY
      // carrega reputação e histórico pra frente — "Reiniciar" e a 1ª
      // escolha de clube nascem no neutro (reputação 50, sem currículo).
      reputation: TECHNICIAN_CARRY ? TECHNICIAN_CARRY.reputation : 50,
      clubHistory: TECHNICIAN_CARRY ? TECHNICIAN_CARRY.clubHistory : [],
      clubProposals: [],
      // AJUSTE — feed navegável de notícias (ver renderNewsScreen),
      // nasce vazio (nova carreira, nenhuma rodada simulada ainda).
      newsFeed: [],
      // FASE 4 (item 2) — histórico de coletivas respondidas (ver
      // applyPressAnswer) — "tecnico.historico_coletivas" do documento.
      pressLog: [],
      metaRiskWarnedSeason: null,
      // Retenção/Engajamento (BRDataRetencaoEspecificacao) — objetivos
      // e conquistas nascem do zero numa carreira nova (ver
      // freshObjectivesState/freshAchievementsState); contadores
      // lifetime/temporada começam em 0.
      objectives: freshObjectivesState(), achievements: freshAchievementsState(),
      baseRevealedCount: 0, titlesWonNacional: 0, titlesWonCopa: 0,
      seasonTeamGoals: 0, seasonTeamFouls: 0,
    };
    TECHNICIAN_CARRY = null;
    // Nova feature (pedido do usuário: "reinicie o tema do
    // rebaixamento") — só carreira NOVA nasce com o sistema de acesso/
    // rebaixamento ativado (ver initDivisionSystem/migrateCareerDefaults).
    initDivisionSystem();
    // FASE 1 (item 3) — meta da diretoria da 1ª temporada, calculada
    // já com o elenco recém-montado (ver computeBoardGoal).
    CAREER.boardGoal = computeBoardGoal();
    CAREER.negativeSeasonsStreak = 0;
    // FASE 2 (a) — chaveamento da Copa do Brasil da 1ª temporada.
    setupCup();
    // FASE 4 (item 5) — contrato inicial de patrocínio/material
    // esportivo (ver initSponsorship).
    initSponsorship();
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
  const tacticMod = combinedTacticMod();
  atkMult *= fMod.atk * tacticMod.atk;
  defMult *= fMod.def * tacticMod.def;
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
   evolução NATURAL de atributos (idade) ----------
   Efeito PROBABILÍSTICO (chance de ±1 no atributo por rodada) de
   evolução por IDADE, independente de qualquer treino — jovem evolui
   mais fácil, veterano regride aos poucos. Decisões nossas pros pontos
   deixados em aberto na especificação original:
   - Efeito probabilístico (não fração de ponto acumulada) — mais
     simples de mostrar (atributo sempre inteiro) e já dá o efeito
     "pequeno, só percebido depois de várias rodadas" pedido.
   - Declínio por idade começa aos 30 pra linha/aos 32 pro goleiro
     (goleiro segura o auge mais tarde, igual no futebol de verdade).
   - Cada um dos 4 atributos (overall/atk/def/phys) rola INDEPENDENTE.

   AJUSTE (pedido do usuário: "vamos evoluir o método de treinos",
   BRDataTreinadorBriefingTreinos_2.docx) — esta função ORIGINALMENTE
   também dobrava a chance de crescimento do atributo ligado ao
   CAREER.trainingFocus escolhido (um seletor só, sem custo de
   fadiga). Esse seletor foi RETIRADO por completo — o módulo de
   treinos novo (ver applyWeeklyTraining/TRAINING_SCHEMES mais abaixo)
   já dá ganho de atributo determinístico (não mais probabilístico)
   como efeito DIRETO de treinar a semana, com fórmula própria e custo
   de fadiga real. As duas camadas continuam coexistindo de propósito:
   esta aqui é o "amadurecimento natural" do atleta (roda toda rodada,
   nunca dobra por causa de treino); a nova é o ganho de treino em si.

   Só evolui CAREER.squad (seu elenco) — time CPU não precisa, o
   elenco deles já se renova por sorteio inteiro na virada de temporada
   (ver renewLeagueSquad). Chamado 1x por rodada simulada, só quando
   seu clube jogou (ver simulateRound), passando quem foi titular
   NESSA rodada (banco/lesionado tem mais chance de estagnar/regredir
   que evoluir). */
function applyNaturalAgingEvolution(playedThisRound) {
  const playedIds = new Set((playedThisRound || []).map((p) => p.id));
  CAREER.squad.forEach((p) => {
    const played = playedIds.has(p.id);
    const declineAge = p.group === "G" ? 32 : 30;
    let growChance, declineChance;
    if (p.age <= 21) { growChance = played ? 0.14 : 0.05; declineChance = 0; }
    else if (p.age < declineAge) { growChance = played ? 0.06 : 0.01; declineChance = played ? 0 : 0.01; }
    else { growChance = played ? 0.02 : 0; declineChance = (played ? 0.05 : 0.08) + (p.age - declineAge) * 0.01; }
    const trend = p.attrTrend || { overall: 0, atk: 0, def: 0, phys: 0 };
    // Nova feature (pedido do usuário: "atributos precisam ser mais
    // reais... evolução menos agressiva") — a maturação natural
    // também respeita o teto (p.potential, ver derivePotentialForAdult/
    // buildBasePlayer) — sem isso, um jovem promissor acabaria
    // passando do próprio potencial só de jogar muitas temporadas,
    // mesmo sem treino nenhum envolvido. Declínio nunca é limitado por
    // teto (é sobre o PISO, 20, que já valia).
    const ceiling = p.potential != null ? p.potential : 99;
    ["overall", "atk", "def", "phys"].forEach((attr) => {
      const roll = Math.random();
      if (roll < growChance) { if (p[attr] < ceiling) { p[attr] = clamp(p[attr] + 1, 20, ceiling); trend[attr] += 1; } }
      else if (roll > 1 - declineChance) { p[attr] = clamp(p[attr] - 1, 20, 99); trend[attr] -= 1; }
    });
    // Acumula até o jogador ser aberto no detalhe de novo (ver
    // openDetail, que lê isso pro indicador ↑/↓ e zera em seguida —
    // "desde a última checagem", pedido da especificação). O ganho
    // determinístico de applyWeeklyTraining soma NO MESMO campo, pra
    // não duplicar a seta de tendência com 2 fontes diferentes.
    p.attrTrend = trend;
  });
}

/* ---------- Módulo de Treinos (pedido do usuário: "vamos evoluir o
   método de treinos", BRDataTreinadorBriefingTreinos_2.docx +
   protótipo treinos.html) ----------
   Substitui por completo o antigo seletor "Foco de treino" (retirado
   da Escalação — ver TRAINING_MOD/applyTrainingEvolution acima, e o
   HTML de #trainingFocus). O documento assume dias REAIS da semana
   (segunda a domingo, jogo fixo no sábado) — este jogo não tem "dia",
   só RODADA (não existe passagem de tempo dia a dia em lugar nenhum
   do motor). Tradução adotada: 1 RODADA = 1 SEMANA VIRTUAL de 7
   posições (index 0 = segunda), com o jogo sempre fixo na posição 5
   (sábado) — mesma simplificação que o próprio protótipo já assume,
   e que o documento (seção 2.6) reconhece como aceitável ("em
   produção, calculado a partir do calendário real" — mas este motor
   não tem data real por rodada pra calcular a partir de nada, então a
   simplificação do protótipo é definitiva aqui, não temporária).

   O treinador monta a semana inteira com antecedência (ou aplica um
   esquema pronto); ao avançar pro próximo jogo ("Ir para o jogo", ver
   goToMatch), a semana INTEIRA é resolvida de uma vez só
   (applyWeeklyTraining) — sequencialmente dia a dia, mas sem pausa
   real entre eles (não dá pra "simular dia por dia" porque esse
   conceito não existe no motor). trainingAppliedForRound evita
   aplicar a mesma semana 2x (idempotente por rodada) e permite que o
   treinador clique "Aplicar" na própria tela de Treinos pra ver o
   efeito ANTES de ir pro jogo (mesmo fluxo do protótipo) — se ele não
   clicar, goToMatch aplica sozinho como rede de segurança (mesmo
   espírito de commitLineupTactics ali do lado).

   Mapeamento de atributo (decisão nossa — o documento fala em
   "atributoTecnico"/"atributoFisico" genéricos, mas este jogo já usa
   overall/atk/def/phys, sem um atributo "técnico" à parte): treino
   FÍSICO evolui phys (mapeamento direto); treino TÉCNICO evolui
   overall (mesmo destino que o extinto foco "equilibrado" já usava) —
   não escreve em atk/def diretamente (ficam como nasceram + o que a
   evolução natural por idade já mexe, ver applyNaturalAgingEvolution
   acima) — mantém os 2 focos simétricos (1 atributo cada), fiel ao
   modelo de 2 dimensões do documento ("não há treino tático nesta
   1ª versão").

   Moral: o documento pede um enum de 3 estados (feliz/neutro/
   cansado), mas este jogo já tem moral NUMÉRICA 0-100 com motivo/
   tendência (ver applyMoraleAfterMatch, renovação de contrato) — as
   3 regras do documento (2.5) viram empurrões nessa escala numérica
   já existente, reaproveitando moraleReason, em vez de um estado
   paralelo que duplicaria/conflitaria com o sistema de moral já
   maduro do jogo. */
const TRAINING_DAY_NAMES = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const TRAINING_GAME_DAY = 5;      // sábado — fixo (ver aviso acima)
const TRAINING_PRE_GAME_DAY = 4;  // sexta — folga protegida pré-jogo
const TRAINING_POST_GAME_DAY = 6; // domingo — folga protegida pós-jogo
function isProtectedTrainingDay(i) { return i === TRAINING_PRE_GAME_DAY || i === TRAINING_POST_GAME_DAY; }
// Fórmulas exatas do documento (seção 2.2).
const TRAINING_INTENSITY_MULT = { leve: 0.5, moderada: 1, intensa: 1.8 };
const TRAINING_INTENSITY_LABEL = { leve: "Leve", moderada: "Moderada", intensa: "Intensa" };
const TRAINING_GROUP_LABEL = { principal: "Elenco", misto: "Misto c/ Sub-20", individual: "Individual" };
// 5 esquemas prontos (seção 3 do documento, portados 1:1 — sexta e
// domingo nunca precisam ser escritos como "descanso" explicitamente
// aqui: são sempre protegidos por posição, ver isProtectedTrainingDay,
// então o dia 5 (jogo) também nem entra no array de foco/intensidade/
// grupo por esquema — só os dias 0-3 variam de verdade entre eles).
const TRAINING_SCHEMES = [
  {
    id: "equilibrio", name: "Equilíbrio Semanal",
    desc: "Alterna técnico e físico moderado, com folgas protegidas de sexta e domingo.",
    days: [
      { foco: "tecnico", intensidade: "moderada", grupo: "principal" },
      { foco: "fisico", intensidade: "moderada", grupo: "principal" },
      { foco: "tecnico", intensidade: "moderada", grupo: "misto" },
      { foco: "fisico", intensidade: "leve", grupo: "principal" },
    ],
  },
  {
    id: "pre_jogo", name: "Ativação Pré-Jogo",
    desc: "Cargas leves na semana toda. Uso quando o calendário está apertado (jogos a cada 3-4 dias).",
    days: [
      { foco: "tecnico", intensidade: "leve", grupo: "principal" },
      { foco: "tecnico", intensidade: "leve", grupo: "principal" },
      { foco: "fisico", intensidade: "leve", grupo: "principal" },
      { foco: "tecnico", intensidade: "leve", grupo: "principal" },
    ],
  },
  {
    id: "pretemporada", name: "Pré-Temporada Física",
    desc: "Cargas físicas intensas para elevar a base de condicionamento. Uso fora de sequência apertada de jogos.",
    days: [
      { foco: "fisico", intensidade: "intensa", grupo: "principal" },
      { foco: "fisico", intensidade: "intensa", grupo: "principal" },
      { foco: "tecnico", intensidade: "moderada", grupo: "principal" },
      { foco: "fisico", intensidade: "intensa", grupo: "principal" },
    ],
  },
  {
    id: "recuperacao", name: "Recuperação",
    desc: "Reduz carga total. Uso após jogos física ou taticamente desgastantes, ou elenco com muitos atletas fadigados.",
    days: [
      { foco: "descanso" },
      { foco: "tecnico", intensidade: "leve", grupo: "principal" },
      { foco: "descanso" },
      { foco: "tecnico", intensidade: "leve", grupo: "principal" },
    ],
  },
  {
    id: "base_sub20", name: "Integração Sub-20",
    desc: "Foco técnico com o time misto para acelerar evolução da base e elevar moral dos jovens.",
    days: [
      { foco: "tecnico", intensidade: "moderada", grupo: "misto" },
      { foco: "tecnico", intensidade: "moderada", grupo: "misto" },
      { foco: "fisico", intensidade: "leve", grupo: "misto" },
      { foco: "tecnico", intensidade: "moderada", grupo: "misto" },
    ],
  },
];
// Monta o plano de 7 dias inteiro a partir de um esquema (os 4 dias
// dele + jogo/2 folgas protegidas fixas, sempre nas mesmas posições).
function defaultTrainingPlan(schemeId) {
  const scheme = TRAINING_SCHEMES.find((s) => s.id === schemeId) || TRAINING_SCHEMES[0];
  const plan = new Array(7);
  let di = 0;
  for (let i = 0; i < 7; i++) {
    if (i === TRAINING_GAME_DAY) plan[i] = { foco: "jogo" };
    else if (isProtectedTrainingDay(i)) plan[i] = { foco: "descanso" };
    else plan[i] = { ...scheme.days[di++] };
  }
  return plan;
}
// Quem é afetado por um dia de treino — "individual" só o jogador
// escolhido (ver PICKER_CTX.type==="training" em renderPickerList/
// pickerChoose); "misto" o elenco inteiro (principal + base, junto —
// é o ponto do esquema "Integração Sub-20"); "principal" só quem
// realmente veste a camisa 10 (loan conta junto, mesmo critério de
// sempre — ver computeHumanStrength/wageBillOf).
function trainingTargets(entry) {
  if (entry.grupo === "individual") {
    const p = entry.individualPlayerId && CAREER.squad.find((x) => x.id === entry.individualPlayerId);
    return p ? [p] : [];
  }
  if (entry.grupo === "misto") return CAREER.squad.slice();
  return CAREER.squad.filter((p) => p.origin === "principal" || p.origin === "loan");
}
// Resolve a semana INTEIRA de uma vez (ver aviso grande no topo desta
// seção sobre por que não dá pra simular dia a dia). Idempotente por
// rodada — chamar de novo na mesma rodada não faz nada (trainingAppliedForRound
// já bate com CAREER.currentRound). Devolve um Map<playerId, ganho> só
// pra feedback visual imediato na tela de Treinos (ver renderTreinos).
function applyWeeklyTraining() {
  if (CAREER.trainingAppliedForRound === CAREER.currentRound) return null;
  const gains = new Map();
  CAREER.trainingPlan.forEach((entry, i) => {
    if (i === TRAINING_GAME_DAY || !entry || !entry.foco) return;
    if (entry.foco === "descanso") {
      // Descanso não tem "grupo" (o protótipo também desabilita esse
      // campo pra descanso) — recupera o elenco inteiro por igual.
      CAREER.squad.forEach((p) => { p.condition = clamp((p.condition == null ? 100 : p.condition) + 12, 0, 100); });
      return;
    }
    const mult = TRAINING_INTENSITY_MULT[entry.intensidade] || 1;
    const baseGain = Math.round(2 * mult);   // fórmula exata do documento (2.2) — teto POSSÍVEL, não garantido, ver attributeTrainingGain
    const fatigueCost = Math.round(6 * mult);
    const attr = entry.foco === "tecnico" ? "overall" : "phys"; // ver aviso de mapeamento no topo
    trainingTargets(entry).forEach((p) => {
      p.condition = clamp((p.condition == null ? 100 : p.condition) - fatigueCost, 0, 100);
      // Nova feature (pedido do usuário: "atributos precisam ser mais
      // reais... evolução menos agressiva") — ganho respeita o teto
      // de cada jogador (p.potential), com retorno decrescente perto
      // dele (ver attributeTrainingGain) — fadiga sempre é cobrada
      // (o esforço aconteceu), mas o ganho de verdade pode vir menor
      // que baseGain, ou zero, se o jogador já estiver perto/no teto.
      const ceiling = p.potential != null ? p.potential : 99;
      const gain = attributeTrainingGain(p[attr], ceiling, baseGain);
      if (gain > 0) {
        p[attr] = clamp(p[attr] + gain, 20, ceiling);
        const trend = p.attrTrend || { overall: 0, atk: 0, def: 0, phys: 0 };
        trend[attr] += gain;
        p.attrTrend = trend;
        gains.set(p.id, (gains.get(p.id) || 0) + gain);
      }
      // Regra do documento (2.5): Sub-20 treinando no grupo Misto com
      // o elenco principal ganha moral "feliz" — na escala numérica
      // já existente, isso é um empurrão positivo + motivo explícito
      // (ver moraleReason, já usado em toda parte do jogo que mexe em
      // moral).
      if (p.origin === "base" && entry.grupo === "misto") {
        p.morale = clamp((p.morale == null ? 70 : p.morale) + 5, 0, 100);
        p.moraleReason = "Feliz treinando com o elenco principal";
      }
    });
  });
  // Regras do documento (2.5) ligadas ao ESTADO FINAL de condição
  // (depois da semana inteira resolvida) — "cansado" abaixo de 40,
  // volta a "neutro" só quando a condição já recuperou pra 55+ E o
  // motivo registrado ainda for o do cansaço do treino (evita
  // sobrescrever um moraleReason de outro sistema, ex.: banco/conversa
  // recente, sem relação com fadiga de treino).
  CAREER.squad.forEach((p) => {
    const cond = p.condition == null ? 100 : p.condition;
    if (cond < 40 && p.moraleReason !== "Cansado pelo desgaste dos treinos") {
      p.morale = clamp((p.morale == null ? 70 : p.morale) - 4, 0, 100);
      p.moraleReason = "Cansado pelo desgaste dos treinos";
    } else if (cond >= 55 && p.moraleReason === "Cansado pelo desgaste dos treinos") {
      p.morale = clamp((p.morale == null ? 70 : p.morale) + 4, 0, 100);
      p.moraleReason = "Neutro no clube";
    }
  });
  CAREER.trainingAppliedForRound = CAREER.currentRound;
  // Retenção/Engajamento — "Treine 1 jogador" (objetivo diário) conta
  // a SEMANA aplicada como 1 evento (não 1 por jogador afetado, senão
  // uma semana de "misto" já bateria a meta sozinha de propósito).
  if (gains.size) { ensureObjectivesFresh(); bumpObjective("daily", "obj_train_1_player", 1); }
  return gains;
}

/* ---------- Renderização: Treinos ----------
   UI da tela nova (ver panel-treinos em carreira.html) — reaproveita
   mtConditionBarHTML/playerRow/groupedListHTML/ovrTierClass (Tela 4,
   Elenco) pro cartão do elenco, e o modal genérico de escolher jogador
   (PICKER_CTX, ver openPicker/renderPickerList/pickerChoose) pro
   treino "Individual", sem duplicar nenhum desses componentes. */
const TRAINING_SEG_OPTIONS = {
  foco: [["tecnico", "Técnico"], ["fisico", "Físico"], ["descanso", "Descanso"]],
  intensidade: [["leve", "Leve"], ["moderada", "Moderada"], ["intensa", "Intensa"]],
  grupo: [["principal", "Elenco"], ["misto", "Misto"], ["individual", "Individual"]],
};
function segGroupHTML(seg, current, disabled) {
  const opts = TRAINING_SEG_OPTIONS[seg];
  return `<div class="mt-seg-group${disabled ? " disabled" : ""}">${opts.map(([v, l]) =>
    `<button type="button" class="mt-seg-btn${current === v ? " active" : ""}" data-seg="${seg}" data-value="${v}">${l}</button>`
  ).join("")}</div>`;
}
// Prévia de 7 pontos coloridos do esquema (seção 5.3 do briefing) —
// monta o plano por completo (defaultTrainingPlan) só pra ler a cor de
// cada dia, sem tocar em CAREER.trainingPlan de verdade.
function trainingSchemeCardHTML(scheme) {
  const plan = defaultTrainingPlan(scheme.id);
  const dots = plan.map((entry, i) => {
    const cls = entry.foco === "jogo" ? "jogo" : entry.foco === "tecnico" ? "tecnico" : entry.foco === "fisico" ? "fisico" : "";
    const prot = isProtectedTrainingDay(i) ? " protected" : "";
    return `<span class="dot ${cls}${prot}"></span>`;
  }).join("");
  const active = CAREER.trainingSchemeId === scheme.id;
  return `<div class="mt-scheme-card${active ? " active" : ""}" data-scheme="${scheme.id}">
    <div class="name">${scheme.name}</div>
    <div class="desc">${scheme.desc}</div>
    <div class="mt-scheme-preview">${dots}</div>
  </div>`;
}
// Painel do dia selecionado: segmented controls de Foco/Intensidade/
// Grupo (Intensidade e Grupo desabilitados visualmente em Descanso,
// seção 5.3 do briefing), aviso quando uma folga protegida é
// sobrescrita (seção 2.6 — "nunca deve acontecer silenciosamente") e o
// gatilho do picker de jogador só quando Grupo = Individual.
function renderTrainingDayPanel() {
  const day = TRAINING_SELECTED_DAY;
  const entry = CAREER.trainingPlan[day];
  const panel = document.getElementById("trainingDayPanel");
  if (day === TRAINING_GAME_DAY) {
    panel.innerHTML = `<p class="mt-card-sub" style="margin:0;">Dia de jogo — sem treino configurável aqui.</p>`;
    return;
  }
  const isRest = !entry.foco || entry.foco === "descanso";
  const violated = isProtectedTrainingDay(day) && !isRest;
  let html = "";
  if (violated) {
    const when = day === TRAINING_PRE_GAME_DAY ? "véspera do" : "dia seguinte ao";
    html += `<div class="mt-training-warning"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg><span>Você está sobrescrevendo uma folga protegida (${when} jogo) — risco maior de fadiga e lesão.</span></div>`;
  }
  html += `<span class="mt-field-label">Foco</span>${segGroupHTML("foco", entry.foco || "descanso", false)}`;
  html += `<span class="mt-field-label">Intensidade</span>${segGroupHTML("intensidade", entry.intensidade || "moderada", isRest)}`;
  html += `<span class="mt-field-label">Grupo</span>${segGroupHTML("grupo", entry.grupo || "principal", isRest)}`;
  if (!isRest && entry.grupo === "individual") {
    const p = entry.individualPlayerId && CAREER.squad.find((x) => x.id === entry.individualPlayerId);
    html += `<button type="button" class="mt-individual-picker-btn" id="btnPickTrainingPlayer">${p ? escapeHtml(abbreviateName(p.name)) : `<span class="placeholder">Escolher jogador...</span>`}<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>`;
  }
  panel.innerHTML = html;
  panel.querySelectorAll(".mt-seg-btn").forEach((btn) => btn.addEventListener("click", () => {
    const seg = btn.dataset.seg, value = btn.dataset.value;
    if (seg === "foco") {
      // Trocar de foco reinicia intensidade/grupo pro default (exceto
      // saindo de descanso->descanso, que não existe aqui) — vindo de
      // um foco já ativo, preserva a intensidade/grupo escolhidos.
      CAREER.trainingPlan[day] = value === "descanso" ? { foco: "descanso" }
        : { foco: value, intensidade: (!isRest && entry.intensidade) || "moderada", grupo: (!isRest && entry.grupo) || "principal" };
    } else {
      CAREER.trainingPlan[day][seg] = value;
    }
    // Editar manualmente desvincula do esquema de origem (seção 3 do
    // briefing: "o plano passa a ser rotulado Personalizado... pra não
    // passar a falsa impressão de que o plano ainda segue o preset").
    CAREER.trainingSchemeId = null;
    persistCareer();
    renderTreinos();
  }));
  const pickBtn = document.getElementById("btnPickTrainingPlayer");
  if (pickBtn) pickBtn.addEventListener("click", () => openPicker({ type: "training", day }, "Treino individual — escolher jogador"));
}
// Extraída (era só o corpo do clique no card, ver abaixo) pra também
// ser chamada pela Comissão Técnica (ver suggestTraining) sem duplicar
// a lógica de aplicar um esquema.
function applyTrainingScheme(id) {
  CAREER.trainingSchemeId = id;
  CAREER.trainingPlan = defaultTrainingPlan(id);
  persistCareer();
}
function renderTreinos() {
  const strip = document.getElementById("trainingSchemeStrip");
  strip.innerHTML = TRAINING_SCHEMES.map(trainingSchemeCardHTML).join("");
  strip.querySelectorAll("[data-scheme]").forEach((card) => card.addEventListener("click", () => {
    applyTrainingScheme(card.dataset.scheme);
    renderTreinos();
  }));

  const activeScheme = TRAINING_SCHEMES.find((s) => s.id === CAREER.trainingSchemeId);
  document.getElementById("trainingWeekLabel").innerHTML = activeScheme
    ? `Semana — <span style="color:var(--mt-gold-300);">${activeScheme.name}</span>`
    : `Semana — <span class="mt-week-label-custom">Personalizado</span>`;

  const weekStrip = document.getElementById("trainingWeekStrip");
  weekStrip.innerHTML = CAREER.trainingPlan.map((entry, i) => {
    const focoCls = entry.foco || "descanso";
    const isRest = focoCls === "descanso";
    const violated = isProtectedTrainingDay(i) && !isRest && focoCls !== "jogo";
    return `<div class="mt-day-cell foco-${focoCls}${i === TRAINING_SELECTED_DAY ? " selected" : ""}${violated ? " dviolated" : ""}" data-day="${i}">
      <span class="dname">${TRAINING_DAY_NAMES[i].slice(0, 3).toUpperCase()}</span>
      <span class="dind"></span>
      ${isProtectedTrainingDay(i) ? `<span class="dshield">${violated ? "⚠️" : "🛡️"}</span>` : ""}
    </div>`;
  }).join("");
  weekStrip.querySelectorAll("[data-day]").forEach((cell) => cell.addEventListener("click", () => {
    TRAINING_SELECTED_DAY = Number(cell.dataset.day);
    renderTreinos();
  }));

  renderTrainingDayPanel();

  // Elenco inteiro (principal+base+emprestado), mesma ordenação de
  // sempre (squadSortKey) — reaproveita playerRow/groupedListHTML da
  // Tela 4 (Elenco) sem duplicar marcação nenhuma; clicar num jogador
  // abre o mesmo detalhe de sempre (openDetail).
  const roster = CAREER.squad.slice().sort((a, b) => squadSortKey(a) - squadSortKey(b));
  const rosterList = document.getElementById("trainingRosterList");
  rosterList.innerHTML = groupedListHTML(roster, playerRow, "Sem jogadores.");
  rosterList.querySelectorAll("[data-id]").forEach((row) => row.addEventListener("click", () => openDetail(row.dataset.id)));

  const already = CAREER.trainingAppliedForRound === CAREER.currentRound;
  document.getElementById("btnApplyTraining").disabled = already;
  document.getElementById("btnApplyTrainingLabel").textContent = already ? "Treino já aplicado nesta rodada" : "Aplicar treino da semana";
}

/* ---------- Retenção/Engajamento (BRDataRetencaoEspecificacao) —
   Objetivos em camadas (item 3 do documento) ----------
   Diferente do Módulo de Treinos (1 rodada = 1 semana virtual), aqui
   "diário"/"semanal" são o RELÓGIO DE VERDADE do dispositivo (o
   próprio objetivo do sistema é fazer o técnico voltar a abrir o app
   todo dia) — "temporada" continua ligado ao ciclo de rodadas de
   sempre (reseta em advanceSeason). Catálogo fixo, direto da tabela do
   documento (seção 3) — não é um pool grande sorteado, são exatamente
   os objetivos que o documento especifica pra cada categoria. */
function localDateStr(d) { d = d || new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
// Segunda-feira da semana de `d`, no fuso local — mesma data usada
// como "início da semana" pro reset semanal (weekday: dom=0...sáb=6).
function localWeekStartStr(d) {
  d = d || new Date();
  const diffToMonday = (d.getDay() + 6) % 7; // dom(0)->6, seg(1)->0, ter(2)->1...
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diffToMonday);
  return localDateStr(monday);
}
const OBJECTIVE_TEMPLATES = {
  daily: [
    { objectiveId: "obj_win_1_match", title: "Vença uma partida", icon: "🏆", progressType: "counter", target: 1, reward: { type: "coins", amount: 300 } },
    { objectiveId: "obj_train_1_player", title: "Treine 1 jogador", icon: "🏋️", progressType: "counter", target: 1, reward: { type: "coins", amount: 150 } },
    { objectiveId: "obj_market_1_move", title: "Faça 1 movimentação no mercado", icon: "💼", progressType: "counter", target: 1, reward: { type: "coins", amount: 150 } },
  ],
  weekly: [
    { objectiveId: "obj_win_3_streak", title: "Vença 3 jogos seguidos", icon: "🔥", progressType: "counter", target: 3, reward: { type: "coins_boost", amount: 800 } },
    { objectiveId: "obj_invicto_round", title: "Termine uma rodada invicto", icon: "🛡️", progressType: "boolean", target: 1, reward: { type: "coins_boost", amount: 600 } },
  ],
  season: [
    { objectiveId: "obj_top4", title: "Termine entre os 4 primeiros", icon: "📈", progressType: "threshold", target: 1, reward: { type: "premium", amount: 2500 } },
    { objectiveId: "obj_reveal_base", title: "Revele 1 jogador da base", icon: "💎", progressType: "counter", target: 1, reward: { type: "premium", amount: 1500 } },
  ],
};
function freshObjectiveList(category) {
  return OBJECTIVE_TEMPLATES[category].map((t) => ({ ...t, currentProgress: 0, status: "in_progress" }));
}
function freshObjectivesState() {
  return {
    daily: freshObjectiveList("daily"), weekly: freshObjectiveList("weekly"), season: freshObjectiveList("season"),
    dailyResetDate: localDateStr(), weeklyResetWeekStart: localWeekStartStr(),
  };
}
// Checa os 2 relógios de parede (dia/semana) e regenera quem estiver
// vencido — chamado sempre que a aba Objetivos abre e também de
// renderAll (pra completar sozinho mesmo sem o usuário abrir a aba, o
// selo de "objetivo concluído" já aparece pronto quando ele entrar).
function ensureObjectivesFresh() {
  if (!CAREER.objectives) CAREER.objectives = freshObjectivesState();
  const today = localDateStr(), weekStart = localWeekStartStr();
  if (CAREER.objectives.dailyResetDate !== today) {
    CAREER.objectives.daily = freshObjectiveList("daily");
    CAREER.objectives.dailyResetDate = today;
  }
  if (CAREER.objectives.weeklyResetWeekStart !== weekStart) {
    CAREER.objectives.weekly = freshObjectiveList("weekly");
    CAREER.objectives.weeklyResetWeekStart = weekStart;
  }
}
// Conta vitórias seguidas no FIM de CAREER.recentForm (3=vitória, ver
// pushRecentForm) — usado pro objetivo "vença 3 seguidos" reagir tanto
// a evoluir quanto a "quebrar" a sequência (um empate/derrota no meio
// zera sozinho, sem precisar de um contador à parte pra decrementar).
function trailingWinStreak() {
  const form = CAREER.recentForm || [];
  let n = 0;
  for (let i = form.length - 1; i >= 0 && form[i] === 3; i--) n++;
  return n;
}
// Incrementa um objetivo (categoria+id) até o teto, marcando
// "completed" (pronto pra coletar) ao bater a meta — chamado nos
// pontos de evento reais (ver finishLiveMatch/applyWeeklyTraining/
// buyPlayer/sellPlayer/handlePlayerAction "promote" mais abaixo).
// Silencioso se o objetivo já não existir (categoria expirou) ou já
// tiver sido completado/coletado.
function bumpObjective(category, objectiveId, amount) {
  const list = CAREER.objectives && CAREER.objectives[category];
  const obj = list && list.find((o) => o.objectiveId === objectiveId);
  if (!obj || obj.status !== "in_progress") return;
  obj.currentProgress = Math.min(obj.target, obj.currentProgress + (amount || 1));
  if (obj.currentProgress >= obj.target) {
    obj.status = "completed";
    toast({ title: "Objetivo concluído!", detail: obj.title }, { type: "pos" });
  }
}
// Traduz o reward genérico do documento pra mecânica real do jogo —
// mesma decisão já tomada pro login diário (ver applyDailyLoginReward
// mais abaixo): "coins" garante moedas na hora; "_boost" (semanal)
// soma um pequeno reforço de moral no elenco JUNTO das moedas;
// "premium" (temporada) empilha moedas + moral + recuperação de
// condição — sem inventar item cosmético nenhum que o jogo não tem.
function applyObjectiveReward(reward) {
  CAREER.finances.cash += reward.amount;
  let detail = `+${fmtBRL(reward.amount)}`;
  if (reward.type === "coins_boost" || reward.type === "premium") {
    CAREER.squad.forEach((p) => { p.morale = clamp((p.morale == null ? 70 : p.morale) + 6, 0, 100); });
    detail += " · moral do elenco em alta";
  }
  if (reward.type === "premium") {
    CAREER.squad.forEach((p) => { p.condition = clamp((p.condition == null ? 100 : p.condition) + 15, 0, 100); });
    detail += " · condição física recuperada";
  }
  return detail;
}
function claimObjective(category, objectiveId) {
  const list = CAREER.objectives[category];
  const obj = list.find((o) => o.objectiveId === objectiveId);
  if (!obj || obj.status !== "completed") return;
  const detail = applyObjectiveReward(obj.reward);
  obj.status = "claimed";
  persistCareer();
  renderObjetivos();
  renderCentral(); // caixa/moral mudaram, refletir na Central também
  toast({ title: "Recompensa coletada", detail }, { type: "pos" });
}

/* ---------- Retenção/Engajamento — Conquistas permanentes (item 4 do
   documento) ----------
   Diferente dos objetivos, NUNCA resetam — ficam pra sempre na
   carreira (ver seção 4 do documento: "vitrine de progresso"). 2 das 6
   sugeridas na tabela do documento não existem neste jogo (mata-mata
   estadual, "temporada" solta sem contexto) — adaptadas pra critérios
   que o motor já resolve de verdade: "Campeão Paranaense" virou
   "Campeão da Copa do Brasil" (a Copa já é uma mecânica completa, ver
   resolveCupPhase) + um "Campeão Brasileiro" extra (o título mais
   central do próprio jogo, ausente da tabela original mas óbvio de
   incluir já que existe). tier (bronze/prata/ouro) só varia o visual
   do badge, mesmo espírito do documento. */
const ACHIEVEMENT_CATALOG = [
  { achievementId: "ach_idolo", title: "Ídolo", description: "Complete 10 temporadas no mesmo clube.", category: "carreira", tier: "gold", target: 10, icon: "👑" },
  { achievementId: "ach_campeao_nacional", title: "Campeão Brasileiro", description: "Vença o Brasileirão.", category: "titulos", tier: "gold", target: 1, icon: "🏆" },
  { achievementId: "ach_campeao_copa", title: "Campeão da Copa", description: "Vença a Copa do Brasil.", category: "titulos", tier: "silver", target: 1, icon: "🏆" },
  { achievementId: "ach_artilheiro_area", title: "Artilheiro de Área", description: "100 gols do time em uma temporada.", category: "ofensivo", tier: "gold", target: 100, icon: "⚽" },
  { achievementId: "ach_fairplay", title: "Fair Play", description: "Termine uma temporada com menos de 30 faltas cometidas.", category: "disciplina", tier: "bronze", target: 1, icon: "🤝" },
  { achievementId: "ach_joia_base", title: "Joia da Base", description: "Revele 5 jogadores da categoria de base.", category: "formacao", tier: "silver", target: 5, icon: "💎" },
  { achievementId: "ach_veterano", title: "Veterano", description: "1 ano completo de conta ativa.", category: "fidelidade", tier: "bronze", target: 1, icon: "📅" },
];
const ACHIEVEMENT_CATEGORY_LABEL = { carreira: "Carreira", titulos: "Títulos", ofensivo: "Ofensivo", disciplina: "Disciplina", formacao: "Formação", fidelidade: "Fidelidade" };
function freshAchievementsState() {
  return ACHIEVEMENT_CATALOG.map((a) => ({ achievementId: a.achievementId, currentProgress: 0, unlockedAt: null }));
}
function achievementProgressFor(id) {
  const entry = (CAREER.achievements || []).find((a) => a.achievementId === id);
  return entry || { achievementId: id, currentProgress: 0, unlockedAt: null };
}
function setAchievementProgress(id, progress) {
  if (!CAREER.achievements) CAREER.achievements = freshAchievementsState();
  const entry = CAREER.achievements.find((a) => a.achievementId === id);
  if (!entry) return;
  const tpl = ACHIEVEMENT_CATALOG.find((a) => a.achievementId === id);
  entry.currentProgress = Math.min(tpl.target, progress);
  if (!entry.unlockedAt && entry.currentProgress >= tpl.target) {
    entry.unlockedAt = Date.now();
    toast({ title: "Conquista desbloqueada!", detail: `${tpl.icon} ${tpl.title}` }, { type: "pos" });
  }
}
// Achievements CONTÍNUOS (sempre seguros de reavaliar a qualquer
// momento, sem depender de "fim de temporada" — ver os 2 marcados
// SÓ NO FIM abaixo, que são a exceção). Chamado depois de eventos
// relevantes (promoção da base, virada de temporada) e sempre que a
// tela de Conquistas abre, pra nunca ficar desatualizado.
function evaluateAlwaysCheckableAchievements() {
  if (!CAREER.achievements) CAREER.achievements = freshAchievementsState();
  // Reaproveita CAREER.seasonHistory (já existente, ver advanceSeason)
  // em vez de um contador novo — ele já é zerado sozinho a cada clube
  // novo (ver startCareer) e MAX_SEASON_HISTORY (15) é folgado o
  // bastante acima da meta desta conquista (10).
  setAchievementProgress("ach_idolo", (CAREER.seasonHistory || []).length);
  setAchievementProgress("ach_joia_base", CAREER.baseRevealedCount || 0);
  setAchievementProgress("ach_campeao_nacional", CAREER.titlesWonNacional > 0 ? 1 : 0);
  setAchievementProgress("ach_campeao_copa", CAREER.titlesWonCopa > 0 ? 1 : 0);
  if (ME && ME.createdAt) {
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    setAchievementProgress("ach_veterano", (Date.now() - ME.createdAt) >= oneYearMs ? 1 : 0);
  }
}
// Achievements que só fazem sentido conferir no FIM de uma temporada
// (o total de gols/faltas sobe ao longo do ano — checar no meio
// desclassificaria cedo demais quem ainda vai passar de 30 faltas, ou
// daria falso positivo de "não bateu" em quem ainda vai chegar a 100
// gols). Chamado de dentro de advanceSeason, com os totais da
// temporada que ACABOU de terminar, antes de zerá-los pra próxima.
function evaluateSeasonEndAchievements(finishedTeamGoals, finishedTeamFouls) {
  if (!CAREER.achievements) CAREER.achievements = freshAchievementsState();
  setAchievementProgress("ach_artilheiro_area", Math.max(achievementProgressFor("ach_artilheiro_area").currentProgress, finishedTeamGoals));
  if (finishedTeamFouls < 30) setAchievementProgress("ach_fairplay", 1);
}

/* ---------- Retenção/Engajamento — Renderização (Objetivos/
   Conquistas) ---------- */
let OBJECTIVES_ACTIVE_TAB = "daily"; // só estado de UI, não é salvo
const OBJECTIVE_TAB_LABEL = { daily: "Diário", weekly: "Semanal", season: "Temporada" };
function timeUntilNextMidnight() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const ms = next - now;
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function objectiveResetLabel(category) {
  if (category === "daily") return `HOJE · RESETA EM ${timeUntilNextMidnight()}`;
  if (category === "weekly") return "ESTA SEMANA · RESETA NA SEGUNDA";
  return "TEMPORADA ATUAL";
}
function objectiveCardHTML(o) {
  const done = o.status !== "in_progress";
  const pct = Math.round((o.currentProgress / o.target) * 100);
  const subLabel = o.status === "claimed" ? "Coletado" : o.status === "completed" ? "Concluído" : (o.progressType === "boolean" || o.progressType === "threshold") ? "Em andamento" : `${o.currentProgress} / ${o.target}`;
  return `<div class="mt-obj-card${done ? " completed" : ""}${o.status === "claimed" ? " claimed" : ""}">
    <div class="mt-obj-top-row">
      <div class="mt-obj-icon">${o.icon}</div>
      <div class="mt-obj-text-block"><div class="mt-obj-title">${escapeHtml(o.title)}</div><div class="mt-obj-sub">${subLabel}</div></div>
      <div class="mt-obj-reward">+${fmtBRL(o.reward.amount)}</div>
    </div>
    ${o.status === "in_progress" ? `<div class="mt-progress-track"><div class="mt-progress-fill" style="width:${pct}%"></div></div>` : ""}
    ${o.status === "completed" ? `<button type="button" class="mt-claim-tag" data-claim-objective="${o.objectiveId}">COLETAR</button>` : ""}
  </div>`;
}
function renderObjetivos() {
  ensureObjectivesFresh();
  document.querySelectorAll("#objectivesTabs .mt-obj-tab").forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === OBJECTIVES_ACTIVE_TAB));
  const list = CAREER.objectives[OBJECTIVES_ACTIVE_TAB];
  document.getElementById("objectivesResetLabel").textContent = objectiveResetLabel(OBJECTIVES_ACTIVE_TAB);
  const allClaimed = list.every((o) => o.status === "claimed");
  const box = document.getElementById("objectivesList");
  box.innerHTML = allClaimed
    ? `<p class="ct-empty">Todos os objetivos ${OBJECTIVE_TAB_LABEL[OBJECTIVES_ACTIVE_TAB].toLowerCase()}s concluídos! Volte depois do próximo reset.</p>`
    : list.map(objectiveCardHTML).join("");
  box.querySelectorAll("[data-claim-objective]").forEach((btn) => btn.addEventListener("click", () => claimObjective(OBJECTIVES_ACTIVE_TAB, btn.dataset.claimObjective)));
}

let ACHIEVEMENTS_ACTIVE_FILTER = "todas";
const TIER_LABEL = { gold: "OURO", silver: "PRATA", bronze: "BRONZE" };
function achievementBadgeHTML(tpl) {
  const entry = achievementProgressFor(tpl.achievementId);
  const unlocked = !!entry.unlockedAt;
  return `<div class="mt-badge ${unlocked ? tpl.tier : "locked"}" data-achievement="${tpl.achievementId}">
    <div class="mt-badge-icon">${tpl.icon}</div>
    ${unlocked ? `<div class="mt-tier-label">${TIER_LABEL[tpl.tier]}</div>` : ""}
    <div class="mt-badge-name">${escapeHtml(tpl.title)}</div>
  </div>`;
}
function renderConquistas() {
  if (!CAREER.achievements) CAREER.achievements = freshAchievementsState();
  evaluateAlwaysCheckableAchievements();
  const unlockedCount = CAREER.achievements.filter((a) => a.unlockedAt).length;
  document.getElementById("achievementsSubtitle").textContent = `${unlockedCount} DE ${ACHIEVEMENT_CATALOG.length} DESBLOQUEADAS`;
  document.querySelectorAll("#achievementsFilters .mt-chip").forEach((chip) => chip.classList.toggle("active", chip.dataset.filter === ACHIEVEMENTS_ACTIVE_FILTER));
  const list = ACHIEVEMENT_CATALOG.filter((t) => ACHIEVEMENTS_ACTIVE_FILTER === "todas" || t.category === ACHIEVEMENTS_ACTIVE_FILTER);
  const grid = document.getElementById("achievementsGrid");
  grid.innerHTML = list.length ? list.map(achievementBadgeHTML).join("") : `<p class="ct-empty">Nenhuma conquista nessa categoria.</p>`;
  grid.querySelectorAll("[data-achievement]").forEach((el) => el.addEventListener("click", () => openAchievementDetail(el.dataset.achievement)));
  const nextLocked = ACHIEVEMENT_CATALOG.find((t) => !achievementProgressFor(t.achievementId).unlockedAt);
  document.getElementById("achievementsNext").textContent = nextLocked
    ? `★ PRÓXIMA: ${nextLocked.title}${nextLocked.target > 1 ? ` — faltam ${nextLocked.target - achievementProgressFor(nextLocked.achievementId).currentProgress}` : ""}`
    : "★ Todas as conquistas desbloqueadas!";
}
function openAchievementDetail(id) {
  const tpl = ACHIEVEMENT_CATALOG.find((a) => a.achievementId === id);
  const entry = achievementProgressFor(id);
  const unlocked = !!entry.unlockedAt;
  document.getElementById("achievementDetailIcon").textContent = tpl.icon;
  document.getElementById("achievementDetailTitle").textContent = tpl.title;
  document.getElementById("achievementDetailDesc").textContent = tpl.description;
  document.getElementById("achievementDetailProgress").textContent = unlocked
    ? `Desbloqueada em ${new Date(entry.unlockedAt).toLocaleDateString("pt-BR")}`
    : `Progresso: ${entry.currentProgress} / ${tpl.target}`;
  const shareBtn = document.getElementById("btnShareAchievement");
  shareBtn.hidden = !unlocked;
  shareBtn.onclick = () => {
    const text = `Desbloqueei a conquista "${tpl.title}" no BR Data Treinador! 🏆`;
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else if (navigator.clipboard) { navigator.clipboard.writeText(text).catch(() => {}); toast("Texto copiado — cole onde quiser compartilhar.", { type: "pos" }); }
  };
  document.getElementById("achievementDetailOverlay").classList.add("open");
}

/* ---------- Retenção/Engajamento — Ranking assíncrono (item 5 do
   documento) ----------
   Placar calculado AQUI, no cliente (mesmo espírito de confiança do
   resto do save — ver aviso em server/src/leaderboard.js), com a
   fórmula sugerida no documento: pontos de campeonato (peso maior) +
   conquistas desbloqueadas + saldo de gols (peso menor). Publicado
   toda vez que a tela abre (ver renderRanking) — não tem cron/job
   nenhum rodando "a cada 6h" de verdade, é sob demanda, o que já
   cumpre a meta do documento ("não precisa ser em tempo real"). */
let RANKING_ACTIVE_SCOPE = "friends"; // só estado de UI, não é salvo -- mesmo default do mockup (aba "Amigos" ativa)
function computeLeaderboardScore() {
  const row = CAREER.standings[CAREER.clubId] || { pts: 0, sg: 0 };
  const achievementsUnlocked = (CAREER.achievements || []).filter((a) => a.unlockedAt).length;
  return { score: row.pts * 10 + achievementsUnlocked * 50 + row.sg * 2, breakdown: { pts: row.pts, achievements: achievementsUnlocked, sg: row.sg } };
}
function hoursAgoLabel(ts) {
  const h = Math.floor((Date.now() - ts) / 3600000);
  if (h < 1) return "agora mesmo";
  return `atualizado há ${h}h`;
}
function rankingRowHTML(entry, rank, isMe) {
  return `<div class="mt-rank-row${isMe ? " me" : ""}">
    <div class="mt-rank-num${rank <= 3 ? " top3" : ""}">${rank}º</div>
    <div class="mt-rank-info"><div class="mt-rank-name">${escapeHtml(entry.managerName)}${isMe ? ` <span class="mt-rank-you">VOCÊ</span>` : ""}</div><div class="mt-rank-club">${escapeHtml(entry.clubName || "")}</div></div>
    <div class="mt-rank-score">${entry.score.toLocaleString("pt-BR")}</div>
  </div>`;
}
async function refreshRankingList() {
  document.querySelectorAll("#rankingScopeToggle .mt-scope-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.scope === RANKING_ACTIVE_SCOPE));
  const box = document.getElementById("rankingList");
  const data = await fetchJSON(`/api/leaderboard?scope=${RANKING_ACTIVE_SCOPE}`).catch(() => null);
  if (!data) { box.innerHTML = `<p class="ct-empty">Não deu pra carregar o ranking agora.</p>`; return; }
  const entries = data.entries.slice();
  let myIndex = entries.findIndex((e) => e.userId === ME.id);
  if (myIndex < 0 && data.own) { entries.push(data.own); myIndex = entries.length - 1; }
  const myCard = document.getElementById("rankingMyCard");
  if (myIndex >= 0) {
    myCard.hidden = false;
    myCard.innerHTML = rankingRowHTML(entries[myIndex], myIndex + 1, true);
  } else {
    myCard.hidden = true;
  }
  box.innerHTML = entries.length
    ? entries.map((e, i) => rankingRowHTML(e, i + 1, e.userId === ME.id)).join("")
    : `<p class="ct-empty">${RANKING_ACTIVE_SCOPE === "friends" ? "Adicione amigos pra comparar o ranking com eles." : "Ninguém publicou placar ainda."}</p>`;
  const updatedAt = entries[myIndex >= 0 ? myIndex : 0]?.updatedAt;
  document.getElementById("rankingUpdatedLabel").textContent = updatedAt ? hoursAgoLabel(updatedAt) : "";
}
async function renderRanking() {
  const { score, breakdown } = computeLeaderboardScore();
  await fetchJSON("/api/leaderboard/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clubName: CAREER.clubName, score, breakdown }) }).catch(() => {});
  document.getElementById("rankingFriendCode").textContent = ME.friendCode || "";
  await refreshRankingList();
}
async function submitAddFriend() {
  const input = document.getElementById("addFriendInput");
  const code = input.value.trim();
  if (!code) return;
  try {
    const data = await fetchJSON("/api/friends/add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    ME.friends = data.friends;
    input.value = "";
    toast("Amigo adicionado!", { type: "pos" });
    if (RANKING_ACTIVE_SCOPE === "friends") await refreshRankingList();
  } catch (err) {
    toast(err.message || "Não deu pra adicionar esse código.", { type: "warn" });
  }
}

/* ---------- Retenção/Engajamento — Login diário com streak (item 2 do
   documento) ----------
   Streak fica na CONTA (ver ME/users.js), não na carreira — sobrevive
   a "Reiniciar"/"Escolher outro clube". A recompensa em si (ver
   applyDailyLoginReward) é aplicada na carreira ATIVA no momento do
   claim, já que "moedas do clube"/moral/olheiro só fazem sentido
   dentro de uma carreira em andamento. */
const DAILY_LOGIN_CYCLE = [
  { day: 1, reward: { type: "coins", amount: 500 } },
  { day: 2, reward: { type: "coins", amount: 800 } },
  { day: 3, reward: { type: "boost", amount: 0 } },
  { day: 4, reward: { type: "coins", amount: 1200 } },
  { day: 5, reward: { type: "scout_token", amount: 0 } },
  { day: 6, reward: { type: "coins", amount: 1800 } },
  { day: 7, reward: { type: "premium_pack", amount: 3000 } },
];
const DAILY_LOGIN_REWARD_ICON = { coins: "🪙", boost: "💪", scout_token: "🔎", premium_pack: "🎁" };
const DAILY_LOGIN_REWARD_LABEL = { coins: "moedas do clube", boost: "moral do elenco", scout_token: "olheiro", premium_pack: "pacote de elite" };
// Traduz o reward genérico devolvido pelo servidor (ver DAILY_LOGIN_CYCLE
// em users.js -- os 2 catálogos precisam ficar em sincronia manual, o
// servidor só entende o formato genérico, quem decide o efeito de
// verdade no jogo é sempre o cliente) pra mecânica real, mesmo
// raciocínio já usado em applyObjectiveReward: "coins" cai direto no
// caixa; "boost" (dia 3) dá um respiro de moral pro elenco todo;
// "scout_token" (dia 5) revela o potencial exato de um jogador da base
// sorteado (reaproveita scoutedPotentialRange, sem inventar item
// novo); "premium_pack" (dia 7) empilha moedas + moral + recuperação
// de condição, igual o reward "premium" dos objetivos de temporada.
function applyDailyLoginReward(reward) {
  if (reward.type === "coins") {
    CAREER.finances.cash += reward.amount;
    return { icon: DAILY_LOGIN_REWARD_ICON.coins, detail: `+${fmtBRL(reward.amount)}` };
  }
  if (reward.type === "boost") {
    CAREER.squad.forEach((p) => { p.morale = clamp((p.morale == null ? 70 : p.morale) + 8, 0, 100); });
    return { icon: DAILY_LOGIN_REWARD_ICON.boost, detail: "Moral do elenco em alta" };
  }
  if (reward.type === "scout_token") {
    // Só quem ainda tem potencial NÃO revelado (senão o prêmio seria
    // desperdiçado revelando de novo alguém já revelado).
    const base = CAREER.squad.filter((p) => p.origin === "base" && p.potential != null && !p.scoutRevealed);
    if (base.length) {
      const p = base[Math.floor(Math.random() * base.length)];
      p.scoutRevealed = true;
      return { icon: DAILY_LOGIN_REWARD_ICON.scout_token, detail: `Potencial de ${abbreviateName(p.name)} revelado` };
    }
    CAREER.finances.cash += 500; // sem ninguém da base pra revelar, cai pra um pequeno bônus em dinheiro
    return { icon: DAILY_LOGIN_REWARD_ICON.scout_token, detail: "+R$ 500 (sem jogador da base pra revelar)" };
  }
  // premium_pack
  CAREER.finances.cash += reward.amount;
  CAREER.squad.forEach((p) => {
    p.morale = clamp((p.morale == null ? 70 : p.morale) + 8, 0, 100);
    p.condition = clamp((p.condition == null ? 100 : p.condition) + 15, 0, 100);
  });
  return { icon: DAILY_LOGIN_REWARD_ICON.premium_pack, detail: `+${fmtBRL(reward.amount)} · moral e condição recuperadas` };
}
function dailyLoginDayCellHTML(dayInfo, currentDay) {
  const done = dayInfo.day < currentDay || (dayInfo.day === 7 && currentDay === 7 && dayInfo._justClaimed);
  const isToday = dayInfo.day === currentDay;
  return `<div class="mt-day-cell-login${done ? " done" : ""}${isToday ? " today" : ""}">
    <span class="dicon">${done ? "✓" : DAILY_LOGIN_REWARD_ICON[dayInfo.reward.type]}</span>
    <span class="dnum">${dayInfo.day}</span>
  </div>`;
}
function renderDailyLoginModal(currentStreakDay) {
  const cycleHTML = DAILY_LOGIN_CYCLE.map((d) => dailyLoginDayCellHTML(d, currentStreakDay)).join("");
  document.getElementById("dailyLoginTrack").innerHTML = cycleHTML;
  document.getElementById("dailyLoginSubtitle").textContent = `SEQUÊNCIA — DIA ${currentStreakDay} DE 7`;
  const todayReward = DAILY_LOGIN_CYCLE.find((d) => d.day === currentStreakDay).reward;
  document.getElementById("dailyLoginRewardIcon").textContent = DAILY_LOGIN_REWARD_ICON[todayReward.type];
  document.getElementById("dailyLoginRewardValue").textContent = todayReward.type === "coins" || todayReward.type === "premium_pack" ? `+${fmtBRL(todayReward.amount)}` : "";
  document.getElementById("dailyLoginRewardLabel").textContent = DAILY_LOGIN_REWARD_LABEL[todayReward.type].toUpperCase();
  document.getElementById("dailyLoginOverlay").classList.add("open");
}
// Chamado 1x no boot (ver enterAfterAuth) — só mostra a modal se ainda
// não coletou hoje (localDate, ver claimDailyLogin em users.js: o
// servidor decide streak continua/quebra a partir dessa mesma data).
async function checkDailyLoginOnBoot() {
  const today = localDateStr();
  if (ME.dailyLogin && ME.dailyLogin.lastClaimDate === today) return;
  renderDailyLoginModal((ME.dailyLogin && ((ME.dailyLogin.currentStreakDay % 7) + 1)) || 1);
}
async function claimDailyLoginNow() {
  const btn = document.getElementById("btnClaimDailyLogin");
  btn.disabled = true;
  try {
    const result = await fetchJSON("/api/daily-login/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ localDate: localDateStr() }) });
    ME.dailyLogin = { currentStreakDay: result.currentStreakDay, lastClaimDate: localDateStr() };
    const { icon, detail } = applyDailyLoginReward(result.reward);
    await persistCareer();
    renderAll();
    document.getElementById("dailyLoginOverlay").classList.remove("open");
    toast({ title: `${icon} Recompensa diária coletada`, detail }, { type: "pos" });
  } catch (err) {
    toast(err.message || "Não deu pra coletar agora.", { type: "warn" });
  } finally {
    btn.disabled = false;
  }
}

/* ---------- Loja (BR_Data_Treinador_Monetizacao.xlsx +
   BR_Data_Treinador_Loja_Mockup.html) ----------
   AVISO IMPORTANTE (decidido com o usuário antes de implementar): esta
   entrega é só o CATÁLOGO e a TELA, fiéis à planilha/mockup — nenhum
   pagamento de verdade acontece ainda. O mockup mostra "Google Play"
   como forma de pagamento, mas o app hoje é um PWA/site, não um
   aplicativo nativo publicado numa loja — não existe billing de app
   store nenhum pra reaproveitar aqui. O rail de pagamento real (quando
   existir) deve ser o MESMO Mercado Pago já usado nas assinaturas (ver
   server/src/mercadoPago.js) — o botão "Confirmar compra" abaixo só
   mostra um aviso "em breve", sem debitar nem creditar nada de
   verdade. CAREER.finances.cash (Cifrões, moeda fictícia do clube) NÃO
   compra nada aqui — só Créditos BR (dinheiro real) compraria, quando
   o pagamento existir.

   Créditos BR (ME.creditsBR) é o PRIMEIRO valor do jogo que representa
   dinheiro de verdade gasto — por isso mora na CONTA (server/src/
   users.js), não no save da carreira, e só o SERVIDOR pode alterá-lo
   (nenhum endpoint faz isso ainda, ver comentário grande em
   createUser). Todo o resto do Modo Técnico confia no cliente (ver
   aviso em careerStore.js) — aqui, de propósito, não. */
const CREDIT_PACKAGES = [
  { id: "bronze", name: "Pacote Bronze", tier: "bronze", priceBRL: 4.90, baseCoins: 490, bonusPct: 0, totalCoins: 490 },
  { id: "prata", name: "Pacote Prata", tier: "prata", priceBRL: 14.90, baseCoins: 1600, bonusPct: 5, totalCoins: 1680 },
  { id: "ouro", name: "Pacote Ouro", tier: "ouro", priceBRL: 34.90, baseCoins: 4000, bonusPct: 12, totalCoins: 4480, featured: true },
  { id: "platina", name: "Pacote Platina", tier: "platina", priceBRL: 69.90, baseCoins: 8500, bonusPct: 20, totalCoins: 10200 },
  { id: "diamante", name: "Pacote Diamante", tier: "diamante", priceBRL: 149.90, baseCoins: 19500, bonusPct: 30, totalCoins: 25350 },
];
// Preço em Créditos BR — os 5 primeiros vêm direto do mockup da Loja
// (só ele mostra o preço em créditos; a planilha só lista preço em
// R$, que é o insumo do MODELO DE NEGÓCIO, não da UI). "Uniforme
// Alternativo" está na planilha mas não no mockup — preço nosso,
// seguindo a mesma proporção aproximada dos outros 5 (R$ × ~30,
// arredondado à dezena).
const BOOST_ITEMS = [
  { id: "recuperacao_instantanea", name: "Recuperação Instantânea", desc: "Zera o tempo de recuperação de condição física de 1 jogador", duration: "IMEDIATO", priceCredits: 90, category: "conveniencia", icon: "⚡" },
  { id: "reset_moral", name: "Reset de Moral", desc: "Leva a moral do elenco para “Feliz” instantaneamente", duration: "IMEDIATO", priceCredits: 120, category: "conveniencia", icon: "☺" },
  { id: "treino_extra", name: "Treino Extra", desc: "1 sessão extra fora do ciclo semanal, sem consumir folga protegida", duration: "DURA 1 SEMANA", priceCredits: 150, category: "conveniencia", icon: "＋" },
  { id: "injecao_moral", name: "Injeção de Moral", desc: "+Moral em todo o elenco, cortesia do patrocinador", duration: "DURA 3 PARTIDAS", priceCredits: 210, category: "patrocinio", icon: "↑" },
  { id: "desconto_contratacao", name: "Desconto de Contratação", desc: "-15% no custo da próxima contratação", duration: "1 JANELA DE TRANSFERÊNCIA", priceCredits: 300, category: "patrocinio", icon: "%" },
  { id: "uniforme_alternativo", name: "Uniforme Alternativo", desc: "Novo uniforme visual, sem efeito de jogo", duration: "PERMANENTE (VISUAL)", priceCredits: 180, category: "cosmetico", icon: "👕" },
];
const BOOST_CATEGORY_LABEL = { conveniencia: "CONVENIÊNCIA", patrocinio: "PATROCÍNIOS", cosmetico: "COSMÉTICOS" };
const TIER_ABBR = { bronze: "B", prata: "P", ouro: "O", platina: "Pt", diamante: "D" };
// Preço com centavos — fmtBRL (usada no resto do jogo pra salário/
// valor de mercado, sempre em reais inteiros) arredonda pra 0 casas
// decimais, o que faria R$ 4,90 virar "R$ 5" — errado pra vitrine de
// preço de verdade.
function fmtBRLPrice(v) {
  return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
let LOJA_ACTIVE_TAB = "creditos"; // só estado de UI, não é salvo
function packageCardHTML(pkg) {
  const bonusPill = pkg.bonusPct ? `<span class="mt-pkg-bonus">+${pkg.bonusPct}%</span>` : "";
  return `<div class="mt-pkg-card${pkg.featured ? " featured" : ""}">
    ${pkg.featured ? `<div class="mt-pkg-best">MELHOR VALOR</div>` : ""}
    <div class="mt-pkg-icon tier-${pkg.tier}"><span class="n">${TIER_ABBR[pkg.tier]}</span><span class="u">${pkg.tier.toUpperCase()}</span></div>
    <div class="mt-pkg-mid">
      <div class="mt-pkg-name">${escapeHtml(pkg.name)}${bonusPill}</div>
      <div class="mt-pkg-coins"><b>${pkg.totalCoins.toLocaleString("pt-BR")}</b> Créditos BR</div>
    </div>
    <button type="button" class="mt-pkg-buy" data-buy-package="${pkg.id}">${fmtBRLPrice(pkg.priceBRL)}</button>
  </div>`;
}
function boostCardHTML(item) {
  return `<div class="mt-boost-card">
    <div class="mt-boost-icon ${item.category}">${item.icon}</div>
    <div class="mt-boost-mid">
      <div class="mt-boost-name">${escapeHtml(item.name)}</div>
      <div class="mt-boost-desc">${escapeHtml(item.desc)}</div>
      <span class="mt-boost-duration">${item.duration}</span>
    </div>
    <button type="button" class="mt-boost-buy" data-buy-boost="${item.id}"><span class="mini-coin"></span>${item.priceCredits}</button>
  </div>`;
}
function renderLoja() {
  document.getElementById("walletCash").textContent = fmtBRL(CAREER.finances.cash);
  document.getElementById("walletCredits").textContent = (ME.creditsBR || 0).toLocaleString("pt-BR");
  document.querySelectorAll("#lojaTabs .mt-obj-tab").forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === LOJA_ACTIVE_TAB));
  const note = document.getElementById("lojaSectionNote");
  const list = document.getElementById("lojaItemsList");
  if (LOJA_ACTIVE_TAB === "creditos") {
    note.textContent = "Créditos BR compram conveniência e cosméticos. Nenhum pacote aumenta atributos permanentes de jogador.";
    list.innerHTML = CREDIT_PACKAGES.map(packageCardHTML).join("");
    list.querySelectorAll("[data-buy-package]").forEach((btn) => btn.addEventListener("click", () => openPurchaseConfirm("package", btn.dataset.buyPackage)));
  } else {
    note.textContent = "Itens temporários. Aceleram algo que você também alcança jogando — nunca substituem.";
    const groups = ["conveniencia", "patrocinio", "cosmetico"];
    list.innerHTML = groups.map((cat) => {
      const items = BOOST_ITEMS.filter((i) => i.category === cat);
      if (!items.length) return "";
      return `<div class="mt-divider-label">${BOOST_CATEGORY_LABEL[cat]}</div>${items.map(boostCardHTML).join("")}`;
    }).join("");
    list.querySelectorAll("[data-buy-boost]").forEach((btn) => btn.addEventListener("click", () => openPurchaseConfirm("boost", btn.dataset.buyBoost)));
  }
}
function openPurchaseConfirm(kind, id) {
  const item = kind === "package" ? CREDIT_PACKAGES.find((p) => p.id === id) : BOOST_ITEMS.find((b) => b.id === id);
  if (!item) return;
  const isPackage = kind === "package";
  document.getElementById("purchaseConfirmTitle").textContent = item.name;
  document.getElementById("purchaseConfirmIcon").className = `mt-pkg-icon tier-${isPackage ? item.tier : "ouro"}`;
  document.getElementById("purchaseConfirmIcon").innerHTML = isPackage ? `<span class="n">${TIER_ABBR[item.tier]}</span><span class="u">${item.tier.toUpperCase()}</span>` : `<span class="n" style="font-size:20px;">${item.icon}</span>`;
  document.getElementById("purchaseConfirmName").textContent = isPackage ? `${item.totalCoins.toLocaleString("pt-BR")} Créditos BR` : item.name;
  document.getElementById("purchaseConfirmDetail").innerHTML = isPackage
    ? `${item.baseCoins.toLocaleString("pt-BR")} base${item.bonusPct ? ` <b>+${item.bonusPct}% bônus</b>` : ""}`
    : escapeHtml(item.desc);
  document.getElementById("purchaseConfirmPrice").textContent = isPackage ? fmtBRLPrice(item.priceBRL) : `${item.priceCredits} Créditos BR`;
  const btn = document.getElementById("btnConfirmPurchase");
  btn.textContent = `🔒 Confirmar por ${isPackage ? fmtBRLPrice(item.priceBRL) : `${item.priceCredits} Créditos BR`}`;
  document.getElementById("purchaseConfirmOverlay").classList.add("open");
}
// Sem pagamento real ainda (ver aviso grande no topo desta seção) —
// só avisa e fecha, sem debitar/creditar nada. Quando o Mercado Pago
// entrar aqui, este é o handler que vira a criação da preferência de
// pagamento (mesmo padrão de createPreference já usado nas
// assinaturas, ver server/server.js).
function confirmPurchaseNow() {
  document.getElementById("purchaseConfirmOverlay").classList.remove("open");
  toast({ title: "Loja em prévia", detail: "Pagamentos chegam em breve — nada foi cobrado." }, { type: "info" });
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
// conditionDotsHTML() removida (redesign, Tela 4) — só era usada por
// playerRow() no Elenco, que agora usa mtConditionBarHTML() (ver mais
// abaixo); CSS morto (.ct-cond-dots/.ct-cond-dot) também removido do
// <style>.
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
// AJUSTE (Bloco 2 M3 — Marcação individual, brtreinadorbloco2pendentes.html)
// — `suppress` opcional ({playerId, factor}) reduz o peso de SORTEIO
// (nunca zera de vez — marcação reduz, não anula) de um jogador
// ESPECÍFICO do time que está atacando aqui, tanto pra ser artilheiro
// quanto pra dar assistência. Só usado pro lado RIVAL na partida do
// próprio técnico (ver resolveLiveChunk/activeManMarkingSuppression) —
// CPU x CPU (resolveCpuFixture) e Copa do Brasil nunca passam isso.
function attributeGoals(starters, goals, suppress) {
  const events = [];
  if (!starters || !starters.length || !goals) return events;
  const weightFor = (p) => (suppress && p.id === suppress.playerId ? suppress.factor : 1);
  // FASE 2 (b) — moral pesa no sorteio (ver moraleFactor); factor 1
  // pra quem nunca teve moral mexida (CPU/moral neutra), não muda nada.
  const atkWeights = starters.map((p) => ({ F: 4, M: 2, D: 0.6, G: 0.02 }[p.group] || 1) * moraleFactor(p) * weightFor(p));
  for (let i = 0; i < goals; i++) {
    const scorer = weightedPick(starters, atkWeights);
    scorer.goalsCareer = (scorer.goalsCareer || 0) + 1;
    // FASE 4 (item 6) — contador SÓ da temporada atual, zerado na
    // virada de ano (ver renewHumanSquad/renewLeagueSquad), pra dar pra
    // apurar o artilheiro DESSA temporada — goalsCareer nunca zera (é
    // "na carreira", ver Elenco/detalhe do jogador), não serve pra
    // isso. Nota: chamada pela Copa do Brasil (ver simulateCupTie) só
    // pro lado HUMANO também soma aqui, misturando um pouco de gol de
    // Copa no total "da temporada" do SEU jogador (mesma mistura que
    // goalsCareer já tinha) — sem impacto pros outros 19 clubes, cuja
    // Copa nunca chama isso pro lado deles (ver comentário em
    // simulateCupTie).
    scorer.goalsSeason = (scorer.goalsSeason || 0) + 1;
    // AJUSTE (Play-by-Play v1, pedido do usuário — documento "BR Data
    // Play-by-Play", seção 2) — gol e assistência viram UM evento
    // atômico só (assistPlayer, não mais um 2º evento "assistencia"
    // separado) — bate com a estrutura de evento do documento e deixa
    // o banco de comentários tecer os dois na mesma frase ("Fulano
    // lança, Ciclano não perdoa"), em vez de 2 linhas soltas no feed.
    // AJUSTE (Play-by-Play v2, catálogo PENALTY_AWARDED) — ~8% dos
    // gols já decididos viram "de pênalti" na narrativa — NÃO soma
    // gol nenhum a mais (o placar já estava fechado pelo lambda), só
    // reaproveita um gol que já ia acontecer e muda como ele é
    // contado: sem assistência (pênalti não tem passe pra ninguém) e
    // com o comentário próprio (COMMENTARY_BANK.gol_penalti).
    const isPenalty = Math.random() < 0.08;
    let assistName = null;
    // ~72% dos gols saem com assistência de um companheiro (nunca o
    // próprio artilheiro) — meio-campista pesa mais no sorteio, mas
    // qualquer titular pode ter dado o passe.
    if (!isPenalty && starters.length > 1 && Math.random() < 0.72) {
      const assistPool = starters.filter((p) => p.id !== scorer.id);
      const assistWeights = assistPool.map((p) => ({ M: 3, F: 1.5, D: 0.8, G: 0.05 }[p.group] || 1) * moraleFactor(p) * weightFor(p));
      const assister = weightedPick(assistPool, assistWeights);
      assister.assistsCareer = (assister.assistsCareer || 0) + 1;
      assister.assistsSeason = (assister.assistsSeason || 0) + 1;
      assistName = assister.name;
    }
    if (isPenalty) events.push({ type: "penalty_awarded", player: scorer.name });
    events.push({ type: "gol", player: scorer.name, assistPlayer: assistName, penalty: isPenalty });
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
      // AJUSTE (Play-by-Play v2, pedido do usuário — documento "BR Data
      // Play-by-Play", catálogo INJURY) — a lesão já existia (a
      // mecânica em si é de antes desta sessão), só era silenciosa: não
      // virava evento nenhum no feed ao vivo. Agora narrada como
      // qualquer outro evento (ver COMMENTARY_BANK.lesao).
      events.push({ type: "lesao", player: p.name });
    }
    p.condition = clamp((p.condition == null ? 100 : p.condition) - (15 + Math.random() * 15) * chunkShare, 25, 100);
  });
  return { events, redCardIds };
}
// AJUSTE (Play-by-Play v1, pedido do usuário — documento "BR Data
// Play-by-Play", seções 3 e 9) — chance perdida e defesa do goleiro,
// só existiam gol/cartão/substituição no feed ao vivo até aqui,
// deixando a partida "seca" fora dos gols. Camada 100% decorativa: a
// frequência é derivada da força de ataque/defesa relativa de cada
// janela (mesmo espírito do lambda de gol), mas NUNCA toca em
// lambdaHome/lambdaAway nem no placar (ver resolveLiveChunk) — exigência
// explícita do documento ("isso é 100% camada de apresentação e não
// deve afetar o resultado da partida"). Chamada só pro jogo AO VIVO do
// seu clube (CPU x CPU continua sem essa camada — ninguém vê o feed
// dessas partidas mesmo).
function attributeChances(starters, atkStrength, defStrength, chunkShare) {
  const events = [];
  if (!starters || !starters.length) return events;
  const lambda = clamp((atkStrength / defStrength) * 7, 1, 14) * chunkShare;
  const count = poissonSample(lambda, Math.random);
  const weights = starters.map((p) => ({ F: 4, M: 2, D: 0.7, G: 0.05 }[p.group] || 1));
  for (let i = 0; i < count; i++) {
    const player = weightedPick(starters, weights);
    // ~38% das chances vira defesa do goleiro adversário (chute no
    // alvo, mas sem gol) — o resto é chance perdida (fora/travessão),
    // mesma proporção aproximada do catálogo do documento (seção 3:
    // CHANCE_MISSED 8-15/jogo, SHOT_ON_TARGET_SAVED 4-8/jogo).
    events.push({ type: Math.random() < 0.38 ? "defesa" : "chance_perdida", player: player.name });
  }
  return events;
}
// AJUSTE (Play-by-Play v2, pedido do usuário — documento seção 3/8,
// catálogo PENALTY_MISSED) — pênalti perdido é decorativo puro (não
// vira gol, então não precisa tocar em NADA do placar): gera o par
// PENALTY_AWARDED + PENALTY_MISSED junto, bem mais raro que uma chance
// comum (catálogo: 0-1/jogo, bem menor que os 8-15 de CHANCE_MISSED).
// Pênalti CONVERTIDO (que vira gol de verdade) é tratado dentro de
// attributeGoals — reaproveita um gol que o lambda JÁ decidiu, só
// muda a narrativa, nunca soma um gol a mais (ver comentário lá).
function attributePenaltyMisses(starters, atkStrength, defStrength, chunkShare) {
  const events = [];
  if (!starters || !starters.length) return events;
  if (Math.random() >= 0.04 * chunkShare) return events;
  const weights = starters.map((p) => ({ F: 4, M: 2, D: 0.7 }[p.group] || 1.2));
  const player = weightedPick(starters, weights);
  events.push({ type: "penalty_awarded", player: player.name });
  events.push({ type: "penalty_missed", player: player.name });
  return events;
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
    // AJUSTE (Play-by-Play v1) — assistência não é mais um evento
    // separado ("assistencia"), virou o campo assistPlayer do próprio
    // evento "gol" (ver attributeGoals) — conta daqui agora.
    if (e.type === "gol" && e.assistPlayer) CAREER.teamStats.assists++;
    else if (e.type === "amarelo") CAREER.teamStats.yellow++;
    else if (e.type === "vermelho") CAREER.teamStats.red++;
  });
}
// AJUSTE (pedido do usuário: "vamos evoluir o método de treinos") — o
// bônus de +3 daqui (antes ligado ao extinto CAREER.trainingFocus ===
// "fisico") saiu; o efeito que ele tentava dar (recuperação extra por
// treino físico) agora é coberto de verdade pelo módulo de treinos
// novo (ver applyWeeklyTraining) — esta função continua só cobrindo a
// recuperação de base de quem NÃO jogou a partida (desgaste de jogo,
// não de treino — as 2 coisas continuam somando, não se substituem).
function applyConditionRecovery(starterIds) {
  const set = new Set(starterIds);
  CAREER.squad.forEach((p) => {
    if (!set.has(p.id)) p.condition = clamp((p.condition == null ? 100 : p.condition) + (10 + Math.random() * 12), 0, 100);
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
// AJUSTE (pedido do usuário: "reinicie o tema do rebaixamento") —
// `standings` agora é parâmetro opcional (era sempre CAREER.standings)
// pra dar pra atualizar a tabela das OUTRAS 2 divisões também (ver
// resolveOtherDivisionsRound) sem duplicar essa lógica.
function applyResultToStandings(r, standings = CAREER.standings) {
  const H = standings[r.home], A = standings[r.away];
  if (!H || !A) return;
  H.j++; A.j++; H.gp += r.gh; H.gc += r.ga; A.gp += r.ga; A.gc += r.gh;
  if (r.gh > r.ga) { H.v++; H.pts += 3; A.d++; }
  else if (r.gh < r.ga) { A.v++; A.pts += 3; H.d++; }
  else { H.e++; A.e++; H.pts++; A.pts++; }
  H.sg = H.gp - H.gc; A.sg = A.gp - A.gc;
}
function cloneStandings(standings) {
  const copy = {};
  Object.keys(standings).forEach((id) => { copy[id] = { ...standings[id] }; });
  return copy;
}

/* ---------- FASE 4 (item 3 da especificação "BR Data Treinador") —
   notícias da rodada (formato RSS) ----------
   "Gerador de manchetes" com templates fixos preenchidos por dado que
   já existe (placar + tabela antes/depois) — NÃO é texto gerado por IA
   em tempo real, exatamente como a especificação pede ("mais barato,
   mais previsível, mais fácil de revisar"). Chamado de dentro de
   finishRoundTail, depois que a Copa/tabela dessa rodada já estão
   atualizadas, mas usando o standingsBefore capturado no INÍCIO de
   simulateRound (antes de qualquer resultado dessa rodada mexer na
   tabela — ver applyResultToStandings) pra comparar posição antes/
   depois.

   Adaptação nossa pro gatilho "mandante segura o empate, dado que
   esteve em desvantagem em algum momento": esse jogo NÃO progride
   minuto a minuto pra times CPU x CPU (só a SUA partida tem tempos de
   verdade, ver LIVE_MATCH_CHUNK_MINUTES) — não existe uma "linha do
   tempo" de verdade pra saber se o mandante esteve atrás em algum
   momento. Troca por um proxy com dado que JÁ existe: empate em que o
   visitante tem overall médio bem maior (mandante seguraria um
   resultado "melhor que o esperado" contra favorito) — mesmo espírito
   da manchete, sem inventar timeline que a simulação não tem. */
const NEWS_ICON = { lider: "📈", zebra: "⚡", goleada: "🥅", jejum_quebrado: "🔥", lanterna_reage: "🆙", empate_defendido: "🛡️", generico: "📰" };
const NEWS_PRIORITY = { lider: 1, zebra: 2, lanterna_reage: 3, goleada: 4, empate_defendido: 5, jejum_quebrado: 6, generico: 9 };
const WINLESS_STREAK_THRESHOLD = 5; // rodadas sem vencer pra "jejum" valer manchete
const NEWS_FEED_MAX = 60; // manchetes guardadas no feed navegável (ver finishRoundTail/renderNewsScreen)
const NEWS_TAG_LABEL = { lider: "Liderança", zebra: "Zebra", goleada: "Goleada", jejum_quebrado: "Fim de jejum", lanterna_reage: "Reação", empate_defendido: "Defesa do resultado", generico: "Rodada" };
const ZEBRA_OVR_GAP = 6; // diferença mínima de overall médio pra contar como zebra/empate-defendido
function rankByPoints(standings) {
  const rows = Object.values(standings).sort((a, b) => (b.pts - a.pts) || (b.v - a.v) || (b.sg - a.sg) || (b.gp - a.gp));
  const pos = {};
  rows.forEach((r, i) => { pos[r.id] = i + 1; });
  return pos;
}
// Atualiza o jejum de vitória de TODOS os times que jogaram essa
// rodada (zera pra quem venceu, soma 1 pra quem empatou/perdeu) — lido
// ANTES de mexer (ver generateRoundNews, streaksBefore) pra saber
// havia quanto tempo o time que venceu agora estava sem vencer.
function updateWinlessStreaks(allResults) {
  CAREER.teamWinlessStreak = CAREER.teamWinlessStreak || {};
  allResults.forEach((r) => {
    const homeId = String(r.home), awayId = String(r.away);
    if (r.gh > r.ga) { CAREER.teamWinlessStreak[homeId] = 0; CAREER.teamWinlessStreak[awayId] = (CAREER.teamWinlessStreak[awayId] || 0) + 1; }
    else if (r.ga > r.gh) { CAREER.teamWinlessStreak[awayId] = 0; CAREER.teamWinlessStreak[homeId] = (CAREER.teamWinlessStreak[homeId] || 0) + 1; }
    else { CAREER.teamWinlessStreak[homeId] = (CAREER.teamWinlessStreak[homeId] || 0) + 1; CAREER.teamWinlessStreak[awayId] = (CAREER.teamWinlessStreak[awayId] || 0) + 1; }
  });
}
function generateRoundNews(round, allResults, standingsBefore) {
  const headlines = [];
  const isMine = (...ids) => ids.some((id) => String(id) === String(CAREER.clubId));
  if (standingsBefore) {
    const posBefore = rankByPoints(standingsBefore);
    const posAfter = rankByPoints(CAREER.standings);
    const total = Object.keys(posAfter).length;
    // Líder novo — pedido do usuário: comparação é por TIME (não por
    // partida), então checa os 20 de uma vez só; sem manchete na
    // rodada 1 (todo mundo empatado em 0, "virar líder" não diz nada).
    if (round > 1) {
      Object.keys(posAfter).forEach((id) => {
        if (posAfter[id] === 1 && posBefore[id] !== 1) {
          headlines.push({ type: "lider", mine: isMine(id), texto: `${teamById(id).name} é o novo líder` });
        }
      });
    }
    const streaksBefore = { ...(CAREER.teamWinlessStreak || {}) };
    allResults.forEach((r) => {
      const home = teamById(r.home), away = teamById(r.away);
      const mine = isMine(r.home, r.away);
      if (r.gh === r.ga) {
        // Empate — ver adaptação no comentário do bloco acima.
        const homeOvr = squadAvgOverallOf(r.home), awayOvr = squadAvgOverallOf(r.away);
        if (homeOvr != null && awayOvr != null && awayOvr >= homeOvr + ZEBRA_OVR_GAP) {
          headlines.push({ type: "empate_defendido", mine, texto: `${home.name} segura o empate em casa` });
        }
        return;
      }
      const winnerId = r.gh > r.ga ? r.home : r.away;
      const loserId = r.gh > r.ga ? r.away : r.home;
      const winner = teamById(winnerId), loser = teamById(loserId);
      const margin = Math.abs(r.gh - r.ga);
      if (margin >= 3) {
        headlines.push({ type: "goleada", mine, texto: `${winner.name} aplica goleada sobre ${loser.name} (${Math.max(r.gh, r.ga)} x ${Math.min(r.gh, r.ga)})` });
      }
      const winnerOvr = squadAvgOverallOf(winnerId), loserOvr = squadAvgOverallOf(loserId);
      if (winnerOvr != null && loserOvr != null && winnerOvr <= loserOvr - ZEBRA_OVR_GAP) {
        headlines.push({ type: "zebra", mine, texto: `Zebra: ${winner.name} surpreende e vence ${loser.name}` });
      }
      if (posBefore[String(winnerId)] === total) {
        const zoneClause = posAfter[String(winnerId)] <= total - 4 ? " e sai da zona de rebaixamento" : "";
        headlines.push({ type: "lanterna_reage", mine, texto: `Reação: lanterna ${winner.name} vence${zoneClause}` });
      }
      const streak = streaksBefore[String(winnerId)] || 0;
      if (streak >= WINLESS_STREAK_THRESHOLD) {
        headlines.push({ type: "jejum_quebrado", mine, texto: `${winner.name} encerra jejum de ${streak} jogos sem vitória` });
      }
    });
  }
  updateWinlessStreaks(allResults);
  if (!headlines.length) {
    headlines.push({ type: "generico", mine: false, texto: `Rodada ${round} não teve grandes surpresas na tabela.` });
  }
  // Prioridade pedida: manchete do SEU clube sempre primeiro,
  // independente do tipo — depois disso, líder > zebra > lanterna
  // reage > goleada > empate defendido > jejum quebrado > genérico.
  headlines.sort((a, b) => ((b.mine ? 1 : 0) - (a.mine ? 1 : 0)) || (NEWS_PRIORITY[a.type] - NEWS_PRIORITY[b.type]));
  return headlines.slice(0, 6);
}
// AJUSTE (pedido do usuário: "esperava uma tela exclusiva pra
// notícias nos padrões de um portal de esportes") — tela própria
// acessível pelo menu "≡", separada do flash rápido acima (que
// continua existindo dentro do modal de resultados): aqui é o arquivo
// navegável (ver CAREER.newsFeed), com manchete principal em destaque
// e o resto em feed, mais nova primeiro.
function newsItemHTML(n) {
  const cat = NEWS_ICON[n.type] ? n.type : "generico";
  return `<div class="mt-news-brief${n.mine ? " mine" : ""}">
    <div class="mt-news-sq ${cat}">${NEWS_ICON[n.type] || "📰"}</div>
    <div>
      <div class="h">${escapeHtml(n.texto)}</div>
      <div class="m">${NEWS_TAG_LABEL[n.type] || "Rodada"} · Rodada ${n.round} · Temporada ${n.seasonYear}</div>
    </div>
  </div>`;
}
function renderNewsScreen(currentRoundOnly) {
  document.getElementById("newsTagline").textContent = `Edição do técnico do ${CAREER.clubName}`;
  const fullFeed = CAREER.newsFeed || [];
  // AJUSTE (pedido do usuário: "a modal de notícias do Brasileirão deve
  // trazer apenas as 3 notícias da rodada. Pra ver o histórico deve-se
  // acessar o menu notícias") — no fluxo pós-jogo (currentRoundOnly,
  // mesma flag de chainToRoundResults — ver openNewsScreen) mostra só
  // as manchetes da rodada que acabou de rolar (as primeiras do feed,
  // que entra sempre com a rodada mais nova primeiro — ver
  // simulateRound), até 3; aberta pelo menu "≡" (currentRoundOnly
  // ausente) continua trazendo o retrospecto inteiro de sempre.
  const feed = currentRoundOnly && fullFeed.length
    ? fullFeed.filter((n) => n.round === fullFeed[0].round).slice(0, 3)
    : fullFeed;
  const featuredBox = document.getElementById("newsFeatured");
  const listBox = document.getElementById("newsList");
  if (!feed.length) {
    featuredBox.innerHTML = "";
    listBox.innerHTML = `<p class="ct-empty">Nenhuma notícia ainda — simule uma rodada pra o jornal ganhar a primeira manchete.</p>`;
  } else {
    const [top, ...rest] = feed;
    featuredBox.innerHTML = `
      <div class="mt-news-kicker">${top.mine ? "Manchete — seu clube" : "Manchete da rodada"}</div>
      <div class="mt-news-headline">${escapeHtml(top.texto)}</div>
      <div class="mt-news-feature-meta">${NEWS_ICON[top.type] || "📰"} ${NEWS_TAG_LABEL[top.type] || "Rodada"} · Rodada ${top.round} · Temporada ${top.seasonYear}</div>
      <div class="mt-news-rule"></div>`;
    listBox.innerHTML = rest.map(newsItemHTML).join("");
  }
  // AJUSTE (pedido do usuário: "tem uma informação de salários pagos
  // e renda que aparece no resultado da rodada que deveria aparecer
  // na tela de notícias do time") — movida de #roundResultsFinance
  // (Resultados da rodada, removida de lá) pro cartão-resumo daqui;
  // só existe no fluxo pós-jogo (currentRoundOnly), quando
  // PENDING_ROUND_SUMMARY ainda guarda o resumo financeiro da rodada
  // que acabou de rolar (ver showMatchDetailModal/showRoundResultsModal
  // — só é limpo depois que essa tela já rodou).
  const financeEl = document.getElementById("newsFinanceRow");
  const finance = currentRoundOnly && PENDING_ROUND_SUMMARY;
  financeEl.innerHTML = (finance && finance.wagePaid)
    ? `<div class="mt-news-summary-row"><div class="t">Salários pagos: ${fmtBRL(finance.wagePaid)}${finance.sponsorIncome ? ` · Patrocínio: +${fmtBRL(finance.sponsorIncome)}` : ""}${finance.installmentsPaid ? ` · Parcelas de contratação: -${fmtBRL(finance.installmentsPaid)}` : ""} · Caixa: ${fmtBRL(CAREER.finances.cash)}</div></div>`
    : "";
  renderTeamStatusNews();
}
// AJUSTE (pedido do usuário: "notícias do seu time — quem se lesionou
// ou está suspenso") — lida direto de CAREER.squad (mesmo critério de
// status usado no Elenco/detalhe do jogador, ver playerRow/openDetail)
// — sem precisar de mais nenhum dado novo no save. Linha de texto
// simples dentro do cartão-resumo (.mt-news-summary, ver newsOverlay
// em carreira.html) — sem ícone/quadrado de categoria, que fica só
// pras notícias da rodada (.mt-news-brief).
function teamStatusNewsRowHTML(p, kind) {
  const headline = kind === "lesao" ? `${abbreviateName(p.name)} está fora, lesionado (${injurySeverityLabel(p.injurySeverity)})` : `${abbreviateName(p.name)} está suspenso`;
  return `<div class="mt-news-summary-row"><div class="t">${escapeHtml(headline)} — volta na rodada ${p.outUntilRound}</div></div>`;
}
function renderTeamStatusNews() {
  const injured = CAREER.squad.filter((p) => p.status === "contundido");
  const suspended = CAREER.squad.filter((p) => p.status === "suspenso");
  const box = document.getElementById("newsTeamStatus");
  if (!injured.length && !suspended.length) {
    box.innerHTML = `<div class="mt-news-summary-row"><div class="t">Elenco 100% disponível — ninguém contundido ou suspenso.</div></div>`;
    return;
  }
  box.innerHTML = injured.map((p) => teamStatusNewsRowHTML(p, "lesao")).join("")
    + suspended.map((p) => teamStatusNewsRowHTML(p, "suspensao")).join("");
}
// AJUSTE (pedido do usuário: "as notícias devem ser mostradas em tela
// cheia antes dos resultados dos jogos") — essa tela agora tem 2
// modos: aberta pelo menu "≡" (chainToRoundResults ausente/false — só
// tela de consulta, X fecha e pronto) ou aberta de dentro do fluxo
// pós-jogo (chainToRoundResults=true, ver btnMatchDetailContinue/
// closePressConferenceModal) — nesse 2º caso mostra "Continuar", que
// segue pro modal de Resultados da rodada (mesmo padrão de
// matchDetailOverlay: o X só fecha ESSA tela, não avança sozinho).
let NEWS_CHAIN_TO_ROUND_RESULTS = false;
function openNewsScreen(chainToRoundResults) {
  renderNewsScreen(chainToRoundResults);
  NEWS_CHAIN_TO_ROUND_RESULTS = !!chainToRoundResults;
  // AJUSTE (pedido do usuário: "botões de ação principal... travados
  // no rodapé") — "Continuar" mora no rodapé fixo da modal
  // (.ct-modal-footer, ver #newsFooter em carreira.html), separado do
  // corpo rolável; esconde o RODAPÉ inteiro (não só o botão) quando a
  // tela é aberta como simples consulta (sem chainToRoundResults) —
  // senão sobraria uma faixa vazia com borda em cima, sem botão nenhum
  // dentro.
  document.getElementById("newsFooter").classList.toggle("hidden", !chainToRoundResults);
  document.getElementById("newsOverlay").classList.add("open");
}
function closeNewsScreen() {
  document.getElementById("newsOverlay").classList.remove("open");
  NEWS_CHAIN_TO_ROUND_RESULTS = false;
}
function continueFromNewsScreen() {
  document.getElementById("newsOverlay").classList.remove("open");
  const chain = NEWS_CHAIN_TO_ROUND_RESULTS;
  NEWS_CHAIN_TO_ROUND_RESULTS = false;
  if (chain && PENDING_ROUND_SUMMARY) showRoundResultsModal(PENDING_ROUND_SUMMARY);
}

/* ---------- FASE 4 (item 2) — coletiva de imprensa pós-jogo ----------
   Biblioteca de perguntas/respostas fornecida pelo usuário ("BR Data —
   Biblioteca de Coletivas.xlsx", aba "Coletivas", 21 situações) —
   transcrita literalmente abaixo (id, gatilho, pergunta e as respostas
   A/B/C com o Efeito Reputação/Moral exatos do arquivo). Pergunta e
   respostas são sempre as mesmas por gatilho (texto pré-escrito, sem
   geração dinâmica nenhuma — exatamente como o documento original da
   Fase 4 pedia: "sem precisar de geração de texto dinâmica").

   Efeito Reputação alimenta CAREER.reputation (ver
   REPUTATION_INTERVIEW_POINTS/WEIGHT acima — fecha o peso de 10%
   "Entrevistas" que ficava reservado). Efeito Moral (ver
   MORAL_INTERVIEW_SCALE abaixo) mexe na moral de TODO o elenco
   principal de uma vez (o arquivo não distingue jogador nenhum — é
   "moral geral do elenco", igual o documento original da Fase 4 já
   dizia: "em menor grau... elogiar publicamente o time sobe moral
   geral"). */
const PRESS_LIBRARY = [
  { id: "01", gatilho: "Pós-vitória (jogo comum)", pergunta: "Como avalia a vitória de hoje?", respostas: [
    { letra: "A", texto: "Fizemos o trabalho que planejamos, e o time merece o crédito.", reputacao: 1, moral: 1 },
    { letra: "B", texto: "Vitória importante, mas o foco já é o próximo jogo.", reputacao: 0, moral: 0 },
    { letra: "C", texto: "Vencemos, mas ainda temos muito o que corrigir.", reputacao: -1, moral: -1 },
  ] },
  { id: "02", gatilho: "Pós-derrota (jogo comum)", pergunta: "O que faltou pra evitar a derrota hoje?", respostas: [
    { letra: "A", texto: "Erramos em detalhes, mas a postura do time foi correta.", reputacao: 0, moral: 1 },
    { letra: "B", texto: "Faltou eficiência nas finalizações, vamos trabalhar isso.", reputacao: 0, moral: 0 },
    { letra: "C", texto: "Fomos superados, e isso preocupa pra próxima rodada.", reputacao: -1, moral: -2 },
  ] },
  { id: "03", gatilho: "Pós-empate segurando resultado fora", pergunta: "Um ponto fora de casa, como avalia?", respostas: [
    { letra: "A", texto: "Achamos que o ponto foi justo pelo que o time apresentou.", reputacao: 1, moral: 1 },
    { letra: "B", texto: "Queríamos os três pontos, mas empatar fora não é ruim.", reputacao: 0, moral: 0 },
    { letra: "C", texto: "Empate parece pouco pra qualidade que temos no elenco.", reputacao: -1, moral: -1 },
  ] },
  { id: "04", gatilho: "Clássico vencido", pergunta: "Vencer o clássico muda alguma coisa na temporada?", respostas: [
    { letra: "A", texto: "Todo clássico tem peso extra, e o time respondeu à altura.", reputacao: 2, moral: 2 },
    { letra: "B", texto: "Foram 3 pontos importantes, como qualquer outro jogo.", reputacao: 0, moral: 1 },
    { letra: "C", texto: "Já viramos a página, o próximo jogo é o que importa agora.", reputacao: 0, moral: 0 },
  ] },
  { id: "05", gatilho: "Clássico perdido", pergunta: "Como lidar com a pressão da torcida após perder o clássico?", respostas: [
    { letra: "A", texto: "Entendo a cobrança, e vamos trabalhar pra reverter isso.", reputacao: 0, moral: 0 },
    { letra: "B", texto: "Foi um jogo só, não vou dramatizar o resultado.", reputacao: -1, moral: 0 },
    { letra: "C", texto: "A arbitragem prejudicou o time em lances decisivos.", reputacao: -2, moral: 1 },
  ] },
  { id: "06", gatilho: "Título conquistado", pergunta: "O que representa esse título pra sua carreira?", respostas: [
    { letra: "A", texto: "É o resultado de um trabalho coletivo, divido esse mérito com o elenco.", reputacao: 3, moral: 3 },
    { letra: "B", texto: "É uma conquista importante, mas já penso na próxima temporada.", reputacao: 2, moral: 1 },
    { letra: "C", texto: "Mereço esse título depois de tudo que construí aqui.", reputacao: 1, moral: -1 },
  ] },
  { id: "07", gatilho: "Vice-campeonato", pergunta: "Ficar em segundo lugar é uma frustração?", respostas: [
    { letra: "A", texto: "Chegar à final já mostra a evolução do time neste ano.", reputacao: 1, moral: 2 },
    { letra: "B", texto: "É frustrante, mas vamos aprender com isso.", reputacao: 0, moral: 0 },
    { letra: "C", texto: "Perder a taça assim dói, e o elenco sabe disso.", reputacao: -1, moral: -1 },
  ] },
  { id: "08", gatilho: "Zona de rebaixamento", pergunta: "O time está na zona de rebaixamento, qual é o plano?", respostas: [
    { letra: "A", texto: "Confio no elenco, e vamos reagir rodada a rodada.", reputacao: 0, moral: 1 },
    { letra: "B", texto: "Precisamos de reforços urgentes pra sair dessa situação.", reputacao: 0, moral: 0 },
    { letra: "C", texto: "A situação é grave, e cobranças internas vão acontecer.", reputacao: -1, moral: -2 },
  ] },
  { id: "09", gatilho: "Lanterna vence e reage", pergunta: "Essa vitória muda o cenário do time na tabela?", respostas: [
    { letra: "A", texto: "É o primeiro passo de uma reação que o elenco acredita ser possível.", reputacao: 1, moral: 2 },
    { letra: "B", texto: "Um resultado positivo, mas a tabela ainda preocupa.", reputacao: 0, moral: 0 },
    { letra: "C", texto: "Vencer não resolve tudo, ainda há muito trabalho pela frente.", reputacao: -1, moral: -1 },
  ] },
  { id: "10", gatilho: "Zebra sofrida (perdeu pra time azarão)", pergunta: "Como explica a derrota pra um adversário mais fraco no papel?", respostas: [
    { letra: "A", texto: "Futebol não se joga no papel, e o adversário mereceu.", reputacao: 0, moral: 0 },
    { letra: "B", texto: "Foi um dia ruim, vamos analisar o que houve.", reputacao: 0, moral: -1 },
    { letra: "C", texto: "Time entrou desmotivado, e isso é inaceitável.", reputacao: -1, moral: -2 },
  ] },
  { id: "11", gatilho: "Zebra aplicada (venceu favorito)", pergunta: "Essa vitória sobre um adversário mais forte surpreende?", respostas: [
    { letra: "A", texto: "O time acreditou do início ao fim, e mereceu o resultado.", reputacao: 2, moral: 2 },
    { letra: "B", texto: "Jogamos dentro do nosso plano, e deu certo.", reputacao: 1, moral: 1 },
    { letra: "C", texto: "Foi sorte em alguns lances, mas vamos aproveitar o resultado.", reputacao: 0, moral: 0 },
  ] },
  { id: "12", gatilho: "Goleada aplicada", pergunta: "Uma goleada dessas fortalece o time pra sequência?", respostas: [
    { letra: "A", texto: "É um resultado que mostra o potencial do elenco quando tudo funciona.", reputacao: 2, moral: 2 },
    { letra: "B", texto: "Bom resultado, mas cada jogo é uma história diferente.", reputacao: 1, moral: 0 },
    { letra: "C", texto: "Aproveitamos os erros do adversário, nada mais que isso.", reputacao: 0, moral: 0 },
  ] },
  { id: "13", gatilho: "Goleada sofrida", pergunta: "Como o vestiário reage a uma derrota tão elástica?", respostas: [
    { letra: "A", texto: "Vamos conversar internamente e corrigir o que for necessário.", reputacao: 0, moral: 0 },
    { letra: "B", texto: "Foi um resultado muito acima do que o jogo mostrou.", reputacao: -1, moral: -1 },
    { letra: "C", texto: "Resultado inaceitável pra um time com esse elenco.", reputacao: -2, moral: -2 },
  ] },
  { id: "14", gatilho: "Fim de jejum sem vitória", pergunta: "Depois de tantos jogos sem vencer, o que mudou hoje?", respostas: [
    { letra: "A", texto: "O time trabalhou a semana toda pra reverter essa fase.", reputacao: 1, moral: 2 },
    { letra: "B", texto: "Uma vitória importante pra aliviar a pressão recente.", reputacao: 0, moral: 1 },
    { letra: "C", texto: "Já estava demorando, mas o resultado é o que importa.", reputacao: 0, moral: 0 },
  ] },
  { id: "15", gatilho: "Contratação polêmica anunciada", pergunta: "A torcida reagiu dividida à contratação, como você vê isso?", respostas: [
    { letra: "A", texto: "Confio no trabalho de análise que nos trouxe até esse nome.", reputacao: 1, moral: 0 },
    { letra: "B", texto: "Toda contratação gera opinião dividida, o campo vai responder.", reputacao: 0, moral: 0 },
    { letra: "C", texto: "Não decido escalação com base em opinião de torcida.", reputacao: -1, moral: 0 },
  ] },
  { id: "16", gatilho: "Venda de jogador querido pela torcida", pergunta: "Como justifica a saída de um ídolo recente do elenco?", respostas: [
    { letra: "A", texto: "Foi uma decisão difícil, mas necessária pro planejamento do clube.", reputacao: 0, moral: -1 },
    { letra: "B", texto: "Entendemos o carinho da torcida, mas o negócio fazia sentido.", reputacao: 0, moral: -1 },
    { letra: "C", texto: "Decisões de mercado não cabem a mim, é decisão da diretoria.", reputacao: -1, moral: -1 },
  ] },
  { id: "17", gatilho: "Jovem da base estreando bem", pergunta: "O que esperar desse jovem que se destacou hoje?", respostas: [
    { letra: "A", texto: "É fruto de um trabalho de formação que o clube vem fazendo.", reputacao: 2, moral: 2 },
    { letra: "B", texto: "Tem potencial, mas o caminho ainda é longo.", reputacao: 1, moral: 1 },
    { letra: "C", texto: "Vamos com cautela pra não queimar etapas dele.", reputacao: 0, moral: 0 },
  ] },
  { id: "18", gatilho: "Lesão de jogador-chave", pergunta: "Qual o impacto da lesão do titular pro restante da temporada?", respostas: [
    { letra: "A", texto: "É uma perda sensível, mas o elenco está preparado pra repor.", reputacao: 0, moral: 0 },
    { letra: "B", texto: "Vamos aguardar o diagnóstico antes de qualquer conclusão.", reputacao: 0, moral: 0 },
    { letra: "C", texto: "É um golpe duro, e isso vai pesar nos próximos jogos.", reputacao: -1, moral: -2 },
  ] },
  { id: "19", gatilho: "Renovação de contrato recusada por jogador", pergunta: "Como lida com a recusa de renovação de um titular?", respostas: [
    { letra: "A", texto: "Respeito a decisão, e o foco continua sendo o time.", reputacao: 0, moral: 0 },
    { letra: "B", texto: "Vamos seguir conversando até o fim do vínculo atual.", reputacao: 0, moral: 0 },
    { letra: "C", texto: "É frustrante perder um jogador importante dessa forma.", reputacao: -1, moral: -1 },
  ] },
  { id: "20", gatilho: "Meta da diretoria em risco", pergunta: "A diretoria estabeleceu uma meta pra temporada, ela está em risco?", respostas: [
    { letra: "A", texto: "Ainda temos rodadas suficientes pra buscar o que foi combinado.", reputacao: 0, moral: 1 },
    { letra: "B", texto: "A meta é desafiadora, mas seguimos trabalhando pra alcançá-la.", reputacao: 0, moral: 0 },
    { letra: "C", texto: "A cobrança existe, e sei que meu cargo depende do resultado.", reputacao: -1, moral: -1 },
  ] },
  { id: "21", gatilho: "Virada dramática nos acréscimos", pergunta: "Um gol nos acréscimos, como descreve esse momento?", respostas: [
    { letra: "A", texto: "É a recompensa pela insistência do time até o apito final.", reputacao: 2, moral: 3 },
    { letra: "B", texto: "Foi emocionante, mas vamos manter os pés no chão.", reputacao: 1, moral: 1 },
    { letra: "C", texto: "Tivemos sorte no lance, mas o resultado ficou com a gente.", reputacao: 0, moral: 0 },
  ] },
];
function pressLibraryEntry(id) {
  return PRESS_LIBRARY.find((e) => e.id === id) || null;
}
// Prioridade quando MAIS de uma situação bate no mesmo gatilho (ex.:
// zebra aplicada + fim de jejum na mesma vitória) — só UMA coletiva
// por vez, escolhe a de maior "peso" segundo o próprio documento
// (título/vice > clássico > lanterna/lesão/virada > resultados
// especiais > resultados comuns). Ordem é decisão nossa (não estava no
// documento nem no arquivo) — critério: quanto mais raro/dramático o
// gatilho, maior a prioridade.
const PRESS_PRIORITY = { "06": 1, "07": 2, "04": 3, "05": 4, "09": 5, "18": 6, "21": 7, "11": 8, "12": 9, "17": 10, "08": 11, "10": 12, "13": 13, "14": 14, "20": 15, "03": 16, "01": 17, "02": 18 };
// "Não acontece toda partida" (documento: "evita virar repetitivo/
// cansativo") — mesmo os gatilhos "especiais" (zebra, goleada, jejum,
// zona de rebaixamento...) podem se repetir bastante ao longo de uma
// temporada de 38 rodadas (um time mal na zona de rebaixamento, por
// exemplo, bateria esse gatilho toda rodada) — só título/vice/clássico
// são raros e importantes o bastante pra sempre virar coletiva.
// Tudo mais passa por uma chance de disparar (mais alta pro que é
// genuinamente raro, mais baixa pro que pode se repetir toda rodada).
const PRESS_ALWAYS_IDS = new Set(["06", "07", "04", "05"]);
const PRESS_CHANCE_BY_ID = {
  "18": 0.6, "21": 0.6, "11": 0.6, "12": 0.6, "17": 0.6, "10": 0.6, "13": 0.6, "14": 0.6,
  "08": 0.3, "20": 0.3, "03": 0.3, "01": 0.3, "02": 0.3,
};
// Proxy de "clássico": times tradicionalmente grandes do futebol
// brasileiro entre si — não existe conceito de rivalidade/clube-rival
// no modelo de dados hoje (só nome/escudo/força calibrada), então usa
// nome do clube pra aproximar (mesma ideia de squadAvgOverallOf/
// isMine: dado que já existe, sem inventar campo novo no save).
const BIG_CLUB_NAME_FRAGMENTS = ["flamengo", "palmeiras", "corinthians", "são paulo", "sao paulo", "grêmio", "gremio", "internacional", "cruzeiro", "atlético-mg", "atletico-mg", "atlético mineiro", "atletico mineiro", "vasco", "botafogo", "fluminense", "santos"];
function isBigClub(clubId) {
  const name = (teamById(clubId).name || "").toLowerCase();
  return BIG_CLUB_NAME_FRAGMENTS.some((f) => name.includes(f));
}
const PRESS_META_RISK_GAP = 4; // posições abaixo da meta pra contar como "em risco" (ver gatilho 20)
// Decide qual (se algum) gatilho dispara depois do SEU jogo — chamada
// de dentro de finishLiveMatch, com o contexto daquela partida
// específica (ver ctx abaixo). Reaproveita helpers que já existem pra
// notícias da rodada (squadAvgOverallOf/rankByPoints/ZEBRA_OVR_GAP/
// WINLESS_STREAK_THRESHOLD) — mesmo espírito de gatilho, dado que já é
// calculado, sem inventar fonte nova.
function determineMatchPressTrigger(ctx) {
  const { myGoals, oppGoals, isHome, myClubId, oppClubId, winlessBefore, injuredBeforeIds, events, roundPlayed } = ctx;
  const won = myGoals > oppGoals, lost = myGoals < oppGoals, drew = myGoals === oppGoals;
  const margin = Math.abs(myGoals - oppGoals);
  const myOvr = squadAvgOverallOf(myClubId), oppOvr = squadAvgOverallOf(oppClubId);
  const posAfter = rankByPoints(CAREER.standings);
  const total = Object.keys(posAfter).length;
  const myPosAfter = posAfter[String(myClubId)];
  const candidates = [];
  // Título/vice só na última rodada da temporada (proxy: posição final
  // na tabela — clinch matemático antecipado exigiria simular as
  // rodadas restantes, fora de escopo).
  if (roundPlayed >= 38) {
    if (myPosAfter === 1) candidates.push("06");
    else if (myPosAfter === 2) candidates.push("07");
  }
  if (isBigClub(oppClubId)) { if (won) candidates.push("04"); else if (lost) candidates.push("05"); }
  // Lesão de jogador-chave: alguém ficou contundido NESSA partida (não
  // estava contundido antes, ver injuredBeforeIds) e é "chave" (entre
  // os titulares de maior overall do elenco principal).
  const chaveIds = new Set(CAREER.squad.filter((p) => p.origin === "principal").sort((a, b) => b.overall - a.overall).slice(0, 5).map((p) => p.id));
  const newlyInjured = CAREER.squad.some((p) => p.status === "contundido" && chaveIds.has(p.id) && !injuredBeforeIds.has(p.id));
  if (newlyInjured) candidates.push("18");
  // Virada dramática: gol MEU nos acréscimos (minuto 90, ver
  // LIVE_MATCH_CHUNK_MINUTES) que não terminou em derrota.
  const lateMineGoal = (events || []).some((e) => e.type === "gol" && e.mine === true && e.minute === 90);
  if (lateMineGoal && !lost) candidates.push("21");
  if (won && myOvr != null && oppOvr != null && myOvr <= oppOvr - ZEBRA_OVR_GAP) candidates.push("11");
  if (won && margin >= 3) candidates.push("12");
  // Jovem da base estreando bem: marcou ou deu assistência NESSE jogo,
  // é da base e é literalmente o primeiro jogo dele (apps já
  // incrementado pra 1 pelo wear chunk desse mesmo jogo).
  // AJUSTE (Play-by-Play v1) — assistência agora é o campo
  // assistPlayer do evento "gol" (ver attributeGoals), não mais um
  // evento "assistencia" separado — checa os dois nomes no mesmo evento.
  const debutStar = (events || []).some((e) => e.type === "gol" && e.mine === true
    && CAREER.squad.some((p) => (p.name === e.player || p.name === e.assistPlayer) && p.origin === "base" && p.apps === 1));
  if (debutStar) candidates.push("17");
  if (myPosAfter != null && myPosAfter > total - 4) candidates.push("08");
  if (lost && myOvr != null && oppOvr != null && myOvr >= oppOvr + ZEBRA_OVR_GAP) candidates.push("10");
  if (lost && margin >= 3) candidates.push("13");
  if (won && winlessBefore >= WINLESS_STREAK_THRESHOLD) candidates.push("14");
  // Meta em risco: só dispara 1x por temporada (senão repetiria toda
  // rodada enquanto o time seguir mal na tabela) — marca
  // metaRiskWarnedSeason só quando REALMENTE dispara (não quando só
  // virou candidata e perdeu a prioridade ou o sorteio de chance pra
  // outro gatilho), senão a temporada ficaria "queimada" sem o
  // jornalista ter perguntado nada sobre isso ainda.
  const goal = CAREER.boardGoal;
  const metaEmRisco = goal && myPosAfter != null && myPosAfter > goal.target + PRESS_META_RISK_GAP && CAREER.metaRiskWarnedSeason !== CAREER.seasonYear;
  if (metaEmRisco) candidates.push("20");
  if (drew && !isHome) candidates.push("03");
  if (won) candidates.push("01");
  if (lost) candidates.push("02");
  if (!candidates.length) return null;
  candidates.sort((a, b) => PRESS_PRIORITY[a] - PRESS_PRIORITY[b]);
  const chosen = candidates[0];
  if (!PRESS_ALWAYS_IDS.has(chosen) && Math.random() > (PRESS_CHANCE_BY_ID[chosen] || 0.3)) return null;
  if (chosen === "20") CAREER.metaRiskWarnedSeason = CAREER.seasonYear;
  return pressLibraryEntry(chosen);
}
const PRESS_LOG_MAX = 40;
const MORAL_INTERVIEW_SCALE = 3; // Efeito Moral do arquivo (-3..+3) vira -9..+9 de moral geral do elenco
let PENDING_PRESS = null; // { entry, roundPlayed } aguardando resposta, ver openPressConferenceModal
let PRESS_CHAIN_TO_ROUND_RESULTS = false; // true só quando disparada de dentro do fluxo pós-jogo (ver finishLiveMatch)
function firePressConference(id, roundPlayed, chainToRoundResults) {
  const entry = pressLibraryEntry(id);
  if (!entry) return;
  PENDING_PRESS = { entry, roundPlayed: roundPlayed != null ? roundPlayed : CAREER.currentRound };
  PRESS_CHAIN_TO_ROUND_RESULTS = !!chainToRoundResults;
}
function openPressConferenceModal() {
  if (!PENDING_PRESS) return;
  const { entry } = PENDING_PRESS;
  document.getElementById("pressQuestion").textContent = entry.pergunta;
  // AJUSTE (refatoração completa, Tela 14b) — .mt-sheet-option (Tela 5)
  // no lugar do .ct-btn genérico; primeira resposta (recomendada)
  // ganha .primary (verde-ação), igual ao padrão de Conversa individual.
  document.getElementById("pressOptions").innerHTML = entry.respostas.map((r, i) =>
    `<button class="mt-sheet-option${i === 0 ? " primary" : ""}" data-press="${r.letra}">${escapeHtml(r.texto)}</button>`).join("");
  document.getElementById("pressOverlay").classList.add("open");
}
// Pedido geral do app (toda modal fecha no X) — fechar sem responder
// conta como "sem comentário": nenhum efeito de reputação/moral, mas
// ainda segue o fluxo normal (round results, se era o caso).
function closePressConferenceModal() {
  document.getElementById("pressOverlay").classList.remove("open");
  const chain = PRESS_CHAIN_TO_ROUND_RESULTS;
  PENDING_PRESS = null;
  PRESS_CHAIN_TO_ROUND_RESULTS = false;
  // AJUSTE (pedido do usuário: "notícias em tela cheia antes dos
  // resultados") — quando a coletiva fazia parte do fluxo pós-jogo, o
  // próximo passo agora é a tela de Notícias (que por sua vez segue
  // pros Resultados da rodada, ver openNewsScreen/continueFromNewsScreen),
  // não mais direto pros Resultados.
  if (chain && PENDING_ROUND_SUMMARY) openNewsScreen(true);
}
function applyPressAnswer(letra) {
  if (!PENDING_PRESS) { closePressConferenceModal(); return; }
  const { entry, roundPlayed } = PENDING_PRESS;
  const resposta = entry.respostas.find((r) => r.letra === letra);
  if (!resposta) { closePressConferenceModal(); return; }
  const repDelta = Math.round(resposta.reputacao * REPUTATION_INTERVIEW_POINTS * REPUTATION_INTERVIEW_WEIGHT);
  CAREER.reputation = clamp((CAREER.reputation == null ? 50 : CAREER.reputation) + repDelta, 0, 100);
  const moralDelta = resposta.moral * MORAL_INTERVIEW_SCALE;
  if (moralDelta) {
    CAREER.squad.filter((p) => p.origin === "principal").forEach((p) => {
      p.morale = clamp((p.morale == null ? 70 : p.morale) + moralDelta, 0, 100);
    });
  }
  CAREER.pressLog = CAREER.pressLog || [];
  CAREER.pressLog.unshift({ round: roundPlayed, gatilho: entry.gatilho, pergunta: entry.pergunta, letra, texto: resposta.texto, reputacao: repDelta, moral: moralDelta });
  if (CAREER.pressLog.length > PRESS_LOG_MAX) CAREER.pressLog.length = PRESS_LOG_MAX;
  // AJUSTE (pedido do usuário: "gosto da opção 2... todos os textos
  // devem ser bem escritos") — reputação e moral eram espremidas numa
  // frase só ("Reputação +1 · Moral do elenco +3"); agora cada uma
  // vira sua própria pílula colorida (ver toastStatHTML/.ct-toast-stat).
  toast({ title: "Coletiva respondida", stats: [{ label: "Reputação", value: repDelta }, { label: "Moral do elenco", value: moralDelta }] },
    { durationMs: 4000, type: repDelta < 0 || moralDelta < 0 ? "warn" : "pos" });
  persistCareer();
  closePressConferenceModal();
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
function finishRoundTail(round, allResults, humanMatch, standingsBefore) {
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
  // Nova feature — Marcação individual: a designação só vale pro
  // confronto que acabou de rolar (é sobre um jogador ESPECÍFICO do
  // adversário DESSA rodada) — sempre limpa depois do jogo, força o
  // técnico a decidir de novo antes da próxima partida em vez de deixar
  // um efeito antigo grudado sem ninguém perceber.
  CAREER.manMarking = null;
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
  // Nova feature — Comissão Técnica: mesmo ritmo de pagamento do
  // elenco (1/4 do custo mensal por rodada), só quando contratada.
  if (CAREER.technicalStaff && CAREER.technicalStaff.hired) {
    CAREER.finances.cash -= Math.round(technicalStaffMonthlyCost() / 4);
  }
  // FASE 4 (item 5) — patrocínio paga em parcelas ao longo da
  // temporada (1/38 do valor anual por rodada), mesmo ritmo de
  // "dinheiro chega aos poucos" que já existe pra ingresso (por
  // partida em casa) e salário (por rodada) — em vez de um valor único
  // na virada de temporada, que seria um pulo brusco de caixa.
  const sponsorIncome = Math.round(sponsorshipSeasonTotal() / 38);
  CAREER.finances.cash += sponsorIncome;
  // Nova feature (Bloco 3) — parcelas de contratações já FECHADAS
  // (ver finalizeIncomingPurchase) continuam descontando o caixa a
  // cada rodada MESMO fora da janela de contratações (é dívida já
  // assumida, não uma negociação nova) — ver processPendingInstallments.
  const installmentsPaid = processPendingInstallments();
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
  // Nova feature (Bloco 3) — resolve as propostas de compra pendentes
  // (ver resolvePendingOffersOutRound) MESMO fora da janela: a
  // proposta já foi enviada legitimamente dentro dela, só a resposta
  // do clube que pode cair um pouco depois do fechamento.
  resolvePendingOffersOutRound(round);
  // Nova feature (pedido do usuário: "reinicie o tema do
  // rebaixamento") — a tabela das 2 divisões que o técnico não joga
  // avança 1 rodada em segundo plano, junto com a sua (ver
  // resolveOtherDivisionsRound — sem efeito nenhum em carreira sem o
  // sistema ativado).
  resolveOtherDivisionsRound(round);
  // FASE 2 (a) — Copa do Brasil: só resolve alguma coisa nas 4 rodadas
  // certas (ver CUP_ROUNDS) e só se seu clube ainda estiver na
  // competição (resolveCupPhase devolve null em qualquer outro caso —
  // ver comentário lá).
  const cup = resolveCupPhase(round);
  // FASE 4 (item 3) — notícias da rodada (ver generateRoundNews) — só
  // faz sentido calcular DEPOIS de tudo (tabela e Copa já atualizadas
  // pra essa rodada), mas usando o standingsBefore capturado no início
  // de simulateRound (ANTES de qualquer resultado dessa rodada mexer
  // na tabela) pra saber quem virou líder etc.
  const news = generateRoundNews(round, allResults, standingsBefore);
  // AJUSTE (pedido do usuário: "esperava uma tela exclusiva pra
  // notícias nos padrões de um portal de esportes") — até aqui as
  // manchetes só existiam durante o modal de resultados da rodada, sem
  // ficar guardadas em lugar nenhum. Agora também entram num feed
  // navegável (ver renderNewsScreen), com round/temporada anexados pra
  // dar contexto — mais NOVAS primeiro, capado em NEWS_FEED_MAX pra
  // não pesar o save (mesmo espírito de MAX_SEASON_HISTORY). AJUSTE
  // (pedido do usuário, revisão das modais de pós-jogo) — o flash
  // rápido dentro do modal de resultados da rodada foi removido (a
  // cobertura completa já mora na tela de Notícias, que abre antes
  // dele no mesmo fluxo); `news` não sai mais no objeto devolvido
  // abaixo, só alimenta CAREER.newsFeed aqui.
  const roundEntries = news.map((n) => ({ ...n, round, seasonYear: CAREER.seasonYear }));
  CAREER.newsFeed = roundEntries.concat(CAREER.newsFeed || []);
  if (CAREER.newsFeed.length > NEWS_FEED_MAX) CAREER.newsFeed.length = NEWS_FEED_MAX;
  return { round, humanMatch, allResults, lineupChanges, wagePaid, sponsorIncome, installmentsPaid, newOffer: CAREER.pendingOffer, cup };
}
// Fallback pra uma rodada em que o SEU clube não jogue (não deveria
// acontecer no returno completo de pontos corridos, mas o calendário é
// gerado à parte — ver generateAllRounds — então mantém esse caminho
// como rede de segurança em vez de assumir que sempre existe fixture
// sua).
function resolveRoundInstant(round, fixtures, standingsBefore) {
  const allResults = fixtures.map((fx) => resolveCpuFixture(fx, round));
  return finishRoundTail(round, allResults, null, standingsBefore);
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
  // FASE 4 (item 3) — cópia da tabela ANTES de qualquer resultado dessa
  // rodada aplicar (ver applyResultToStandings, chamado fixture a
  // fixture) — sem isso não dá pra saber quem "virou líder" nessa
  // rodada especificamente (ver generateRoundNews).
  const standingsBefore = cloneStandings(CAREER.standings);
  const humanFx = fixtures.find((fx) => String(fx.home) === String(CAREER.clubId) || String(fx.away) === String(CAREER.clubId));
  if (!humanFx) return resolveRoundInstant(round, fixtures, standingsBefore);
  startLiveMatch(round, fixtures, humanFx, standingsBefore);
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
/* ---------- Play-by-Play v1 (pedido do usuário — documento "BR Data
   Play-by-Play") — banco de comentários ----------
   Seção 4 do documento: em vez de UMA frase fixa por tipo de evento
   (era assim até aqui, ver liveEventLabel), várias variações sorteadas
   — evita a repetição perceptível. Gol ganha 2 bancos (com/sem
   assistência, já que a frase muda de estrutura pros dois casos, ver
   attributeGoals/assistPlayer). {minute} foi deixado de fora dos
   textos de propósito — o feed já mostra o minuto numa coluna própria
   (.mt-live-tl-min), repetir dentro da frase seria redundante. */
const COMMENTARY_BANK = {
  gol_assistido: [
    "{assistPlayer} lança, {player} não perdoa. GOOOL do {team}!",
    "Bola alçada na área, {player} testa e balança as redes! Assistência de {assistPlayer}.",
    "{assistPlayer} rasga a defesa com o passe, {player} só empurra pra dentro. GOL do {team}!",
    "Jogada bonita: {assistPlayer} arma, {player} bate cruzado. Sem chances pro goleiro!",
    "{player} aproveita o passe de {assistPlayer} e manda pro fundo da rede!",
    "Contra-ataque fulminante! {assistPlayer} lança, {player} não perdoa. GOOOL do {team}!",
    "{assistPlayer} cruza na medida, {player} cabeceia sem chances de defesa!",
  ],
  gol_solo: [
    "{player} recebe em velocidade e bate cruzado. Sem chances pro goleiro!",
    "{player} arrisca de fora da área e acerta um golaço!",
    "{player} aproveita o rebote e empurra pra dentro. GOL do {team}!",
    "Que categoria! {player} deixa o marcador no chão e finaliza com categoria.",
    "{player} cabeceia sozinho na área e não desperdiça!",
    "{player} bate forte, sem chances de defesa. GOOOL do {team}!",
  ],
  chance_perdida: [
    "{player} sobe mais que a marcação, mas a cabeçada vai por cima do travessão.",
    "Cruzamento na área, {player} testa, só afastou o perigo.",
    "{player} arrisca de longe, a bola passa perto da trave.",
    "Quase! {player} teve a chance e mandou pra fora.",
    "{player} ficou cara a cara com o goleiro, mas chutou em cima da defesa.",
    "{player} desperdiça uma chance clara — a torcida lamenta.",
  ],
  defesa: [
    "{player} finaliza forte, mas o goleiro faz uma bela defesa!",
    "Grande defesa! {player} arriscou e o goleiro não deixou.",
    "{player} bateu colocado, só na segurança das mãos do goleiro.",
    "{player} testou o goleiro de novo, defesa segura.",
  ],
  amarelo: [
    "Cartão amarelo pra {player} — falta dura no meio-campo.",
    "{player} recebe amarelo por reclamação.",
    "Cartão amarelo mostrado a {player}.",
  ],
  vermelho: [
    "Expulso! {player} é o primeiro a sair de campo antes da hora.",
    "Cartão vermelho direto pra {player} — o time fica com um a menos!",
  ],
  substituicao: [
    "Mudança no {team}: {entra} entra no lugar de {saiu}.",
    "{team} mexe na equipe — {entra} substitui {saiu}.",
  ],
  // AJUSTE (Play-by-Play v2, pedido do usuário — catálogo INJURY/
  // PENALTY_AWARDED/PENALTY_MISSED/VAR_CHECK) — os 4 tipos que
  // faltavam do documento pra fechar o catálogo inteiro (só
  // POSSESSION_SHIFT ficou de fora do feed, por natureza — vira a
  // barra de posse ao vivo, ver updateLiveStats/renderLiveMatch).
  gol_penalti: [
    "{player} cobra com categoria e não desperdiça. GOL DE PÊNALTI do {team}!",
    "Sem chances pro goleiro — {player} converte a cobrança de pênalti!",
    "{player} bate no canto, o goleiro nem se estica. Pênalti confirmado!",
  ],
  penalty_awarded: [
    "PÊNALTI! O árbitro assinala a marca da cal após a jogada na área.",
    "Pênalti pro {team}! Falta clara dentro da área.",
    "O juiz não hesita: pênalti assinalado depois do lance na grande área.",
  ],
  penalty_missed: [
    "{player} bate mal e desperdiça o pênalti!",
    "{player} cobra e o goleiro defende — pênalti perdido!",
    "{player} manda a cobrança pra fora — chance desperdiçada da marca da cal.",
  ],
  var_check: [
    "O árbitro vai rever o lance no monitor... decisão mantida.",
    "Checagem do VAR — a arbitragem confirma o que foi decidido em campo.",
    "Depois de revisar as imagens, o VAR confirma: nada muda.",
  ],
  lesao: [
    "{player} sente a coxa e não consegue continuar — vai precisar de atendimento.",
    "Lance mais forte e {player} não aguenta — o departamento médico já se prepara.",
    "{player} pede pra sair, sentindo dores — parece lesão.",
    "Contusão! {player} deixa o campo visivelmente incomodado.",
  ],
};
// Sorteia uma variação do banco `bankKey`, substitui as {variáveis} e
// evita repetir a MESMA variação 2x seguidas do mesmo tipo — `tracker`
// guarda o último índice sorteado por bankKey (é o próprio LIVE_MATCH
// durante a partida ao vivo, ou um objeto descartável no "Rever
// lances" pós-jogo, ver liveEventLabel). Nomes de jogador/entrada/saída
// entram em negrito; minuto e nome de time ficam em texto normal.
const COMMENTARY_BOLD_KEYS = new Set(["player", "assistPlayer", "entra", "saiu"]);
function pickCommentary(bankKey, vars, tracker) {
  const bank = COMMENTARY_BANK[bankKey];
  if (!bank || !bank.length) return "";
  tracker.lastCommentaryIdx = tracker.lastCommentaryIdx || {};
  let idx = Math.floor(Math.random() * bank.length);
  if (bank.length > 1 && idx === tracker.lastCommentaryIdx[bankKey]) idx = (idx + 1) % bank.length;
  tracker.lastCommentaryIdx[bankKey] = idx;
  let text = bank[idx];
  Object.keys(vars).forEach((k) => {
    if (vars[k] == null) return;
    const safe = escapeHtml(String(vars[k]));
    text = text.split(`{${k}}`).join(COMMENTARY_BOLD_KEYS.has(k) ? `<b>${safe}</b>` : safe);
  });
  return text;
}
const LIVE_MATCH_CHUNK_MINUTES = [15, 30, 45, 60, 75, 90];
const MAX_SUBS_PER_MATCH = 5;
const LIVE_TACTICS_FAMILIARITY_PENALTY_CHUNKS = 2;
let LIVE_MATCH = null; // estado transitório do jogo ao vivo — nunca persistido (não é parte de CAREER)
function startLiveMatch(round, fixtures, humanFx, standingsBefore) {
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
    round, humanFx, isHome, home, away, cpuXI, otherResults, standingsBefore,
    chunkIndex: 0, gh: 0, ga: 0, events: [], appeared: new Set(),
    subsUsed: 0, subsBonus: 0, formationPenaltyChunksLeft: 0,
    lastHsStarters: [], lastAsStarters: [],
    timerId: null, paused: false, finished: false,
    // AJUSTE (Play-by-Play v1) — velocidade de reprodução (1x/2x, ver
    // .mt-live-speed em carreira.html/scheduleNextChunk) e
    // estatísticas agregadas decorativas (posse/finalizações/faltas,
    // ver updateLiveStats/resolveLiveChunk — documento seção 5/9,
    // "stats" da Match Timeline). Fila de destaques de gol em tela
    // cheia (ver queueGoalHighlights) fica vazia até o 1º gol.
    speed: 1,
    stats: { possWeightHome: 0, shots: { home: 0, away: 0 }, shotsOnTarget: { home: 0, away: 0 }, fouls: { home: 0, away: 0 } },
    goalHighlightQueue: [], goalHighlightOnDone: null, goalHighlightTimer: null,
    // FASE 4 (item 2) — coletiva de imprensa: quem já estava contundido
    // ANTES dessa partida, pra distinguir de quem se machucou NELA (ver
    // gatilho "18" em determineMatchPressTrigger, chamada de dentro de
    // finishLiveMatch).
    injuredBeforeIds: new Set(CAREER.squad.filter((p) => p.status === "contundido").map((p) => p.id)),
  };
  renderLiveMatch();
  document.getElementById("liveMatchOverlay").classList.add("open");
  scheduleNextChunk();
}
function scheduleNextChunk() {
  const lm = LIVE_MATCH;
  if (!lm || lm.finished || lm.paused) return;
  // AJUSTE (Play-by-Play v1) — "1x/2x" controla a velocidade de
  // REVELAÇÃO dos tempos (ver .mt-live-speed), não o motor por trás —
  // o cálculo de cada tempo continua sendo o mesmo de sempre, só o
  // atraso real entre um tempo e o próximo muda.
  const delay = lm.speed === 2 ? 450 : 900;
  lm.timerId = setTimeout(resolveLiveChunk, delay);
}
function pauseLiveMatch() {
  if (!LIVE_MATCH) return;
  LIVE_MATCH.paused = true;
  clearTimeout(LIVE_MATCH.timerId);
}
function resumeLiveMatch() {
  if (!LIVE_MATCH || LIVE_MATCH.finished) return;
  // AJUSTE — se ainda está no intervalo (ver resolveLiveChunk), fechar
  // substituição/tática NÃO deve destravar o 2º tempo sozinho — só o
  // botão "Prosseguir" faz isso (ver continueFromHalftime). Sem essa
  // trava, abrir e fechar o sub-modal de substituição durante o
  // intervalo já reiniciava o jogo por baixo, sem o técnico ter clicado
  // em nada.
  if (LIVE_MATCH.halftime) return;
  LIVE_MATCH.paused = false;
  scheduleNextChunk();
}
// AJUSTE (pedido do usuário: "o jogo deve pausar no intervalo (45) e
// aguardar que o técnico clique em prosseguir") — único jeito de sair
// do intervalo; substituir/ajustar tática continuam livres enquanto
// pausado, exatamente como no meio de qualquer outra pausa.
function continueFromHalftime() {
  if (!LIVE_MATCH) return;
  LIVE_MATCH.halftime = false;
  LIVE_MATCH.paused = false;
  scheduleNextChunk();
  renderLiveMatch();
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
  // AJUSTE (Play-by-Play v1) — chance perdida/defesa (camada
  // decorativa, ver attributeChances) + estatísticas agregadas
  // (ver updateLiveStats) NÃO tocam lambdaHome/lambdaAway nem
  // ghChunk/gaChunk — só enriquecem o feed e o resumo de fim de jogo.
  const chancesHome = attributeChances(hs.starters, hs.atk, as.def, chunkShare);
  const chancesAway = attributeChances(as.starters, as.atk, hs.def, chunkShare);
  // AJUSTE (Play-by-Play v2, catálogo PENALTY_MISSED) — par
  // PENALTY_AWARDED+PENALTY_MISSED, 100% decorativo (ver
  // attributePenaltyMisses — nunca vira gol, então nunca precisa
  // tocar no placar).
  const penMissHome = attributePenaltyMisses(hs.starters, hs.atk, as.def, chunkShare);
  const penMissAway = attributePenaltyMisses(as.starters, as.atk, hs.def, chunkShare);
  updateLiveStats(lm, hs, as, chunkShare, chancesHome, chancesAway, ghChunk, gaChunk);
  // Nova feature — Marcação individual: suprime (nunca anula) o
  // jogador do RIVAL escolhido pro técnico marcar, só na partida contra
  // ESSE adversário específico (ver activeManMarkingSuppression).
  const opponentId = lm.isHome ? lm.away.id : lm.home.id;
  const markSuppress = activeManMarkingSuppression(opponentId);
  const goalsHome = attributeGoals(hs.starters, ghChunk, lm.isHome ? null : markSuppress).map((e) => ({ ...e, mine: lm.isHome }));
  const goalsAway = attributeGoals(as.starters, gaChunk, lm.isHome ? markSuppress : null).map((e) => ({ ...e, mine: !lm.isHome }));
  // AJUSTE (Play-by-Play v2, catálogo VAR_CHECK) — depois de um gol,
  // ~12% de chance do lance ser checado no VAR — SEMPRE confirma a
  // decisão em campo (nunca anula um gol já contado no placar, decisão
  // nossa pra não precisar desfazer um gol já creditado — ver
  // comentário no topo de attributeGoals sobre pênalti pelo mesmo
  // motivo).
  const varEvents = [];
  [...goalsHome, ...goalsAway].forEach((e) => {
    if (Math.random() < 0.12) varEvents.push({ type: "var_check", mine: e.mine });
  });
  const chunkEvents = [
    ...goalsHome, ...goalsAway,
    ...varEvents,
    ...chancesHome.map((e) => ({ ...e, mine: lm.isHome })),
    ...chancesAway.map((e) => ({ ...e, mine: !lm.isHome })),
    ...penMissHome.map((e) => ({ ...e, mine: lm.isHome })),
    ...penMissAway.map((e) => ({ ...e, mine: !lm.isHome })),
    ...wearHome.events.map((e) => ({ ...e, mine: lm.isHome })),
    ...wearAway.events.map((e) => ({ ...e, mine: !lm.isHome })),
  ].map((e) => ({ ...e, minute }));
  lm.events.push(...chunkEvents);
  lm.lastHsStarters = hs.starters; lm.lastAsStarters = as.starters;
  lm.chunkIndex++;
  renderLiveMatch();
  const advanceAfterChunk = () => {
    if (lm.chunkIndex >= LIVE_MATCH_CHUNK_MINUTES.length) {
      // "⏩ Pular pro fim" (ver skipLiveMatch) não espera o delay de
      // sempre — quem não quer acompanhar minuto a minuto não devia ficar
      // preso a ele.
      if (lm.skipping) finishLiveMatch(); else setTimeout(finishLiveMatch, 500);
    } else if (minute === 45 && !lm.skipping) {
      // AJUSTE (pedido do usuário: "o jogo deve pausar no intervalo e
      // aguardar que o técnico clique em prosseguir") — pausa automática
      // igual uma pausa manual (ver pauseLiveMatch), só que sem
      // depender do usuário ter aberto substituição/tática — os dois
      // continuam disponíveis normalmente durante o intervalo (é
      // exatamente quando um técnico de verdade mexeria no time), quem
      // libera o 2º tempo é o botão "Prosseguir" (ver
      // continueFromHalftime/renderLiveMatch).
      lm.paused = true;
      lm.halftime = true;
      renderLiveMatch();
    } else if (!lm.skipping) {
      scheduleNextChunk();
    }
  };
  // AJUSTE (Play-by-Play v1, documento seção 6 e Tela hifi-02) — gol
  // pausa a narrativa por um destaque em tela cheia antes de seguir
  // pro próximo tempo (nunca durante "Pular pro fim" — ninguém quer
  // ver o overlay de gol travando um avanço que o próprio técnico
  // pediu pra pular).
  const goalsThisChunk = chunkEvents.filter((e) => e.type === "gol");
  if (goalsThisChunk.length && !lm.skipping) queueGoalHighlights(goalsThisChunk, advanceAfterChunk);
  else advanceAfterChunk();
}
// AJUSTE (Play-by-Play v1, documento seção 5/9 — "stats" da Match
// Timeline) — posse/finalizações/faltas não existiam em NENHUM lugar
// do motor (só gol via Poisson); aproximação derivada da força
// relativa de cada janela, decorativa (não influencia o resultado).
// Posse acumula uma MÉDIA PONDERADA pela fração de jogo de cada tempo
// (chunkShare soma 1 no fim da partida); finalizações/faltas somam.
function updateLiveStats(lm, hs, as, chunkShare, chancesHome, chancesAway, ghChunk, gaChunk) {
  const s = lm.stats;
  const homeRatio = hs.atk / (hs.atk + as.atk || 1);
  s.possWeightHome += homeRatio * chunkShare;
  // AJUSTE (Play-by-Play v2, catálogo POSSESSION_SHIFT — "alimenta um
  // indicador de domínio de jogo... sem precisar virar um evento
  // narrado no feed") — soma da fração já processada, pra normalizar
  // a posse EM TEMPO REAL (ver renderLiveMatch/.mt-live-poss) antes do
  // fim da partida, quando chunkShare ainda não somou 1.
  s.chunkShareSum = (s.chunkShareSum || 0) + chunkShare;
  s.shots.home += chancesHome.length + ghChunk;
  s.shots.away += chancesAway.length + gaChunk;
  s.shotsOnTarget.home += chancesHome.filter((e) => e.type === "defesa").length + ghChunk;
  s.shotsOnTarget.away += chancesAway.filter((e) => e.type === "defesa").length + gaChunk;
  s.fouls.home += poissonSample(11 * chunkShare, Math.random);
  s.fouls.away += poissonSample(11 * chunkShare, Math.random);
}
// ---- Destaque de gol em tela cheia (Tela hifi-02) ----
// Fila (raro, mas possível 2 gols no mesmo tempo de 15min) — mostra um
// de cada vez, avança sozinho depois de ~2.6s ou no toque, só chama
// `onDone` (segue o jogo) depois que a fila esvazia.
function queueGoalHighlights(goals, onDone) {
  const lm = LIVE_MATCH;
  lm.goalHighlightQueue = goals.slice();
  lm.goalHighlightOnDone = onDone;
  showNextGoalHighlight();
}
function showNextGoalHighlight() {
  const lm = LIVE_MATCH;
  if (!lm) return;
  if (!lm.goalHighlightQueue.length) {
    const onDone = lm.goalHighlightOnDone;
    lm.goalHighlightOnDone = null;
    if (onDone) onDone();
    return;
  }
  const e = lm.goalHighlightQueue.shift();
  renderGoalHighlight(e);
  document.getElementById("goalHighlightOverlay").classList.add("open");
  clearTimeout(lm.goalHighlightTimer);
  lm.goalHighlightTimer = setTimeout(dismissGoalHighlight, 2600);
}
function dismissGoalHighlight() {
  const lm = LIVE_MATCH;
  if (lm) clearTimeout(lm.goalHighlightTimer);
  document.getElementById("goalHighlightOverlay").classList.remove("open");
  if (!lm) return;
  showNextGoalHighlight();
}
// Nota de fidelidade ao documento: a Tela hifi-02 pede escudo em
// CÍRCULO — trocado pelo MESMO hexágono do resto do app (crestImg),
// só maior e com brilho/borda dourada — usar um formato diferente só
// nesta tela quebraria a identidade reforçada em toda a aplicação
// (ver ajuste "diamante"/monograma dos escudos, sessão anterior).
function renderGoalHighlight(e) {
  const lm = LIVE_MATCH;
  const scoringTeam = e.mine ? (lm.isHome ? lm.home : lm.away) : (lm.isHome ? lm.away : lm.home);
  document.getElementById("goalHighlightCrest").innerHTML = crestImg(scoringTeam, 88);
  document.getElementById("goalHighlightScorer").textContent = abbreviateName(e.player);
  const assistEl = document.getElementById("goalHighlightAssist");
  if (e.assistPlayer) { assistEl.textContent = `Assistência: ${abbreviateName(e.assistPlayer)}`; assistEl.classList.remove("hidden"); }
  else assistEl.classList.add("hidden");
  // Simplificação assumida: se o mesmo tempo teve 2 gols, os 2
  // destaques mostram o placar FINAL do tempo (não o placar
  // intermediário logo após cada gol individual) — evita precisar
  // rastrear o placar gol a gol dentro do mesmo chunk, caso raríssimo.
  document.getElementById("goalHighlightScore").innerHTML = `
    <div class="side">${crestImg(lm.home, 28)}<span class="n">${escapeHtml(lm.home.name)}</span></div>
    <span class="vs">${lm.gh} × ${lm.ga}</span>
    <div class="side">${crestImg(lm.away, 28)}<span class="n">${escapeHtml(lm.away.name)}</span></div>`;
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
  // AJUSTE (Play-by-Play v1) — se um destaque de gol estiver na tela
  // no instante em que o técnico clica "Pular pro fim" (ou no X),
  // descarta a fila e o "onDone" pendente na hora — o while abaixo já
  // resolve o resto da partida de uma vez, sem precisar esperar o
  // destaque ser dispensado primeiro.
  clearTimeout(lm.goalHighlightTimer);
  lm.goalHighlightQueue = [];
  lm.goalHighlightOnDone = null;
  document.getElementById("goalHighlightOverlay").classList.remove("open");
  while (lm.chunkIndex < LIVE_MATCH_CHUNK_MINUTES.length && !lm.finished) resolveLiveChunk();
}
async function finishLiveMatch() {
  const lm = LIVE_MATCH;
  lm.finished = true;
  const result = { home: lm.humanFx.home, away: lm.humanFx.away, gh: lm.gh, ga: lm.ga };
  // "substituicao"/"chance_perdida"/"defesa" só existem pro feed AO
  // VIVO (ver liveEventLabel) — igual lesão (ver comentário no topo de
  // applyMatchWearChunk), o modal de detalhe do jogo de sempre
  // (matchEventsSummaryHTML) só lista gol/cartão (Tela hifi-03 do
  // documento: "Artilheiros e cartões", não chance perdida/defesa).
  const summaryEvents = lm.events.filter((e) => e.type === "gol" || e.type === "amarelo" || e.type === "vermelho");
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
  // AJUSTE (Play-by-Play v1) — stats agregadas (ver updateLiveStats,
  // consumidas pela Tela hifi-03/matchStatsBarsHTML) e a lista COMPLETA
  // de eventos, sem filtro (ver openMatchReplay/"Rever lances" — a
  // única tela que precisa ver chance perdida/defesa/substituição
  // também, não só gol/cartão).
  const stats = {
    possession: { home: Math.round(clamp(lm.stats.possWeightHome, 0, 1) * 100) },
    shots: lm.stats.shots, shotsOnTarget: lm.stats.shotsOnTarget, fouls: lm.stats.fouls,
  };
  stats.possession.away = 100 - stats.possession.home;
  const humanMatch = { ...result, isHome: lm.isHome, ticketRevenue, stats, allEvents: lm.events };
  // Nova feature — Histórico de confrontos (H2H, ver renderH2H()):
  // registra o resultado do SEU jogo pra sempre poder puxar o
  // retrospecto contra um adversário específico depois. unshift (mais
  // recente primeiro) — mesma convenção de CAREER.seasonHistory.
  CAREER.matchLog = CAREER.matchLog || [];
  CAREER.matchLog.unshift({
    seasonYear: CAREER.seasonYear, round: lm.round,
    opponentId: lm.isHome ? lm.humanFx.away : lm.humanFx.home,
    home: lm.isHome, gh: lm.gh, ga: lm.ga,
  });
  if (CAREER.matchLog.length > MAX_MATCH_LOG) CAREER.matchLog.length = MAX_MATCH_LOG;
  const myGoals = lm.isHome ? lm.gh : lm.ga, oppGoals = lm.isHome ? lm.ga : lm.gh;
  pushRecentForm(myGoals > oppGoals ? 3 : myGoals === oppGoals ? 1 : 0);
  applyMoraleAfterMatch(myGoals, oppGoals);
  // Retenção/Engajamento — objetivos ligados ao resultado da SUA
  // partida (ver ensureObjectivesFresh/bumpObjective) + contadores de
  // temporada usados só no fim dela (ver evaluateSeasonEndAchievements
  // em advanceSeason) — gols/faltas do SEU lado apenas, mesmo recorte
  // de "Minha equipe" já usado em tallyTeamStats acima.
  ensureObjectivesFresh();
  if (myGoals > oppGoals) bumpObjective("daily", "obj_win_1_match", 1);
  if (myGoals >= oppGoals) bumpObjective("weekly", "obj_invicto_round", 1);
  const weeklyStreakObj = (CAREER.objectives.weekly || []).find((o) => o.objectiveId === "obj_win_3_streak");
  if (weeklyStreakObj && weeklyStreakObj.status === "in_progress") {
    weeklyStreakObj.currentProgress = Math.min(weeklyStreakObj.target, trailingWinStreak());
    if (weeklyStreakObj.currentProgress >= weeklyStreakObj.target) {
      weeklyStreakObj.status = "completed";
      toast({ title: "Objetivo concluído!", detail: weeklyStreakObj.title }, { type: "pos" });
    }
  }
  CAREER.seasonTeamGoals = (CAREER.seasonTeamGoals || 0) + myGoals;
  CAREER.seasonTeamFouls = (CAREER.seasonTeamFouls || 0) + (lm.isHome ? lm.stats.fouls.home : lm.stats.fouls.away);
  // FASE 3 (item 4) — evolução natural por idade considera quem
  // terminou a partida em campo do seu lado (após eventuais
  // substituições).
  applyNaturalAgingEvolution(lm.isHome ? lm.lastHsStarters : lm.lastAsStarters);
  // FASE 4 (item 2) — jejum ANTES de finishRoundTail rodar (ver
  // updateWinlessStreaks, chamada de dentro de generateRoundNews logo
  // abaixo, que ZERA o jejum de quem venceu) — sem capturar aqui, não
  // dava mais pra saber "estava há quantos jogos sem vencer" depois.
  const winlessBefore = (CAREER.teamWinlessStreak || {})[String(CAREER.clubId)] || 0;
  const allResults = [...lm.otherResults, result];
  const summary = finishRoundTail(lm.round, allResults, humanMatch, lm.standingsBefore);
  // FASE 4 (item 2) — coletiva de imprensa pós-jogo (documento original
  // da Fase 4): decide se alguma situação da PRESS_LIBRARY bateu com
  // essa partida específica — se bateu, "Continuar" do modal "Seu
  // jogo" abre a coletiva ANTES de seguir pros Resultados da rodada
  // (ver btnMatchDetailContinue/closePressConferenceModal).
  const oppClubId = lm.isHome ? lm.humanFx.away : lm.humanFx.home;
  const trigger = determineMatchPressTrigger({
    myGoals, oppGoals, isHome: lm.isHome, myClubId: CAREER.clubId, oppClubId,
    winlessBefore, injuredBeforeIds: lm.injuredBeforeIds, events: lm.events, roundPlayed: lm.round,
  });
  if (trigger) firePressConference(trigger.id, lm.round, true);
  document.getElementById("liveMatchOverlay").classList.remove("open");
  LIVE_MATCH = null;
  const saved = await persistCareer();
  const btn = document.getElementById("btnSimulate");
  if (!saved) { if (btn) btn.disabled = false; return; }
  renderAll();
  showMatchDetailModal(summary);
}
// AJUSTE (Play-by-Play v1, pedido do usuário) — descrição agora sorteia
// uma variação do banco de comentários (ver COMMENTARY_BANK/
// pickCommentary logo acima) em vez de UMA frase fixa por tipo. Aceita
// um `ctx` opcional ({oppTeamName, tracker}) pra funcionar também fora
// da partida ao vivo (ver openMatchReplay, "Rever lances" — sem
// LIVE_MATCH nenhum nesse ponto); default deriva do LIVE_MATCH global,
// comportamento de sempre durante a partida.
function liveEventLabel(e, ctx) {
  if (!ctx) {
    const lm = LIVE_MATCH;
    const oppTeam = lm ? (lm.isHome ? lm.away : lm.home) : null;
    ctx = { oppTeamName: oppTeam ? oppTeam.name : "adversário", tracker: lm || {} };
  }
  const teamLabel = e.mine === false ? ctx.oppTeamName : "seu time";
  if (e.type === "gol") {
    // AJUSTE (Play-by-Play v2) — pênalti convertido ganha banco
    // próprio (sem assistência, ver attributeGoals) — prevalece sobre
    // com/sem assistência.
    const bankKey = e.penalty ? "gol_penalti" : e.assistPlayer ? "gol_assistido" : "gol_solo";
    return pickCommentary(bankKey, { player: e.player, assistPlayer: e.assistPlayer, team: teamLabel }, ctx.tracker);
  }
  if (e.type === "chance_perdida") return pickCommentary("chance_perdida", { player: e.player }, ctx.tracker);
  if (e.type === "defesa") return pickCommentary("defesa", { player: e.player }, ctx.tracker);
  if (e.type === "amarelo") return pickCommentary("amarelo", { player: e.player }, ctx.tracker);
  if (e.type === "vermelho") return pickCommentary("vermelho", { player: e.player }, ctx.tracker);
  if (e.type === "substituicao") return pickCommentary("substituicao", { entra: e.entra, saiu: e.saiu, team: teamLabel }, ctx.tracker);
  // AJUSTE (Play-by-Play v2, catálogo INJURY/PENALTY_AWARDED/
  // PENALTY_MISSED/VAR_CHECK).
  if (e.type === "lesao") return pickCommentary("lesao", { player: e.player }, ctx.tracker);
  if (e.type === "penalty_awarded") return pickCommentary("penalty_awarded", { team: teamLabel }, ctx.tracker);
  if (e.type === "penalty_missed") return pickCommentary("penalty_missed", { player: e.player }, ctx.tracker);
  if (e.type === "var_check") return pickCommentary("var_check", {}, ctx.tracker);
  return "";
}
// Marcador (cor + ícone SVG) da linha do tempo por tipo de evento — ver
// .mt-live-tl-dot em carreira.html (Tela 13b). "chance_perdida"/
// "defesa" são novos (Play-by-Play v1) — tom neutro/discreto de
// propósito, já que não pausam a narrativa (ver catálogo, seção 3 do
// documento: "Pausa narrativa? Não" pros dois). "lesao"/
// "penalty_awarded"/"penalty_missed"/"var_check" são v2.
function liveEventDot(type) {
  const DOTS = {
    gol: { cls: "gol", svg: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="9"/></svg>` },
    amarelo: { cls: "amarelo", svg: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="3" width="12" height="18" rx="1.5"/></svg>` },
    vermelho: { cls: "vermelho", svg: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="3" width="12" height="18" rx="1.5"/></svg>` },
    substituicao: { cls: "sub", svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>` },
    chance_perdida: { cls: "chance", svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/></svg>` },
    defesa: { cls: "defesa", svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><line x1="7" y1="7" x2="17" y2="17"/></svg>` },
    lesao: { cls: "lesao", svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>` },
    penalty_awarded: { cls: "penalty", svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/></svg>` },
    penalty_missed: { cls: "penalty", svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="7" y1="7" x2="17" y2="17"/><line x1="17" y1="7" x2="7" y2="17"/></svg>` },
    var_check: { cls: "var", svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="1.5"/><line x1="8" y1="20" x2="16" y2="20"/><line x1="12" y1="16" x2="12" y2="20"/></svg>` },
  };
  return DOTS[type] || DOTS.substituicao;
}
function renderLiveMatch() {
  const lm = LIVE_MATCH;
  if (!lm) return;
  document.getElementById("liveMatchScore").innerHTML = `
    <div class="side">${crestImg(lm.home)}<span class="n">${escapeHtml(lm.home.name)}</span></div>
    <span class="vs">${lm.gh} × ${lm.ga}</span>
    <div class="side">${crestImg(lm.away)}<span class="n">${escapeHtml(lm.away.name)}</span></div>`;
  // AJUSTE (Play-by-Play v2, catálogo POSSESSION_SHIFT — "indicador de
  // domínio de jogo") — barra de posse AO VIVO (não só no resumo de
  // fim de jogo, ver matchStatsBarsHTML), atualizada a cada tempo
  // resolvido; 50/50 antes do 1º tempo (chunkShareSum ainda zero).
  // Dourado sempre é o SEU time (mesma convenção da tela "Seu jogo").
  const possHomeRatio = lm.stats.chunkShareSum > 0 ? lm.stats.possWeightHome / lm.stats.chunkShareSum : 0.5;
  const possHome = Math.round(possHomeRatio * 100);
  const possMine = lm.isHome ? possHome : 100 - possHome;
  const possOpp = 100 - possMine;
  document.getElementById("livePossBar").innerHTML = `<span class="mine" style="width:${possMine}%;"></span><span class="opp" style="width:${possOpp}%;"></span>`;
  document.getElementById("livePossMineLabel").textContent = `${possMine}%`;
  document.getElementById("livePossOppLabel").textContent = `${possOpp}%`;
  const minute = lm.chunkIndex === 0 ? 0 : LIVE_MATCH_CHUNK_MINUTES[Math.min(lm.chunkIndex, LIVE_MATCH_CHUNK_MINUTES.length) - 1];
  document.getElementById("liveMatchMinute").textContent = lm.finished ? "Fim de jogo — carregando..." : lm.halftime ? "Intervalo" : `${minute}'`;
  document.getElementById("liveMatchFeed").innerHTML = lm.events.length
    ? [...lm.events].reverse().map((e) => {
        const dot = liveEventDot(e.type);
        return `<div class="mt-live-tl-event">
          <div class="mt-live-tl-dot ${dot.cls}">${dot.svg}</div>
          <div class="mt-live-tl-min">${e.minute}'</div>
          <div class="mt-live-tl-desc">${liveEventLabel(e)}</div>
        </div>`;
      }).join("")
    : `<p class="ct-empty">Bola rolando...</p>`;
  const subsTotal = MAX_SUBS_PER_MATCH + lm.subsBonus;
  const subBtn = document.getElementById("btnLiveSub");
  document.getElementById("btnLiveSubLabel").textContent = `Substituir (${lm.subsUsed}/${subsTotal})`;
  subBtn.disabled = lm.finished || lm.subsUsed >= subsTotal;
  document.getElementById("btnLiveTactics").disabled = lm.finished;
  document.getElementById("btnLiveSkip").disabled = lm.finished;
  // AJUSTE (pedido do usuário: "o jogo deve pausar no intervalo (45) e
  // aguardar que o técnico clique em prosseguir") — banner só aparece
  // nessa pausa específica (não numa pausa manual pra substituição/
  // tática, que já tem sua própria modal aberta por cima); Substituir/
  // Ajustar tática continuam funcionando normalmente durante o
  // intervalo, ver resumeLiveMatch (não libera o 2º tempo sozinho
  // enquanto lm.halftime for true).
  document.getElementById("liveHalftimeBanner").classList.toggle("hidden", !lm.halftime);
}
// ---- Sub-modal: substituição ----
function openLiveSubModal() {
  const lm = LIVE_MATCH;
  if (!lm || lm.finished) return;
  if (lm.subsUsed >= MAX_SUBS_PER_MATCH + lm.subsBonus) { toast("Sem substituições disponíveis.", { type: "warn" }); return; }
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
  if (outIdx < 0) { toast("Esse jogador não está em campo.", { type: "warn" }); return; }
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
  renderTacticAxisRows("liveTacticAxisRows", CAREER.lineup.tactics);
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
  Object.assign(CAREER.lineup.tactics, readTacticAxisRows("liveTacticAxisRows"));
  document.getElementById("liveTacticsOverlay").classList.remove("open");
  resumeLiveMatch();
}

/* ---------- Redesign M3 — topbar com identidade do clube ----------
   Substitui a marca genérica ("MODO CARREIRA") por escudo + nome do
   clube + posição na tabela (ver m3-proposal.html Screen 1) — chrome
   global de #screenGame, chamada em toda renderAll() pra ficar sempre
   em dia (posição muda a cada rodada). */
function renderTopbarIdentity() {
  const club = teamById(CAREER.clubId);
  // Pedido do usuário (mesmo raciocínio do fundo redondo por trás do
  // escudo, ver crestImg()) — o quadrado colorido só faz sentido como
  // moldura da sigla (sem escudo real); com logo de verdade, o quadrado
  // só competiria com a marca oficial.
  const topbarCrest = document.getElementById("topbarClubCrest");
  topbarCrest.classList.toggle("has-logo", !!club?.logo);
  topbarCrest.innerHTML = club?.logo
    ? `<img src="${club.logo}" alt="">`
    : escapeHtml(club?.short || "?");
  document.getElementById("topbarClubName").textContent = club?.name || "";
  document.getElementById("topbarClubSub").textContent = `Temporada ${CAREER.seasonYear} · ${COMPETITION_SHORT[CAREER.competitionId] || "Brasileirão"}`;
  const rows = Object.values(CAREER.standings).sort((a, b) => (b.pts - a.pts) || (b.v - a.v) || (b.sg - a.sg) || (b.gp - a.gp));
  const pos = rows.findIndex((r) => String(r.id) === String(CAREER.clubId)) + 1;
  document.getElementById("topbarPositionChip").textContent = pos > 0 ? `${pos}º lugar` : "";
}

/* ---------- Renderização: Central ---------- */
// AJUSTE (pedido do usuário: "Comissão Técnica na página inicial deve
// substituir o card de elenco em destaque") — o carrossel "Elenco em
// destaque" (playerInitials/renderDestaquePlayers, mockup
// brtreinadorbloco1inicio.html tela 2) saiu do Início; a Comissão
// Técnica (ver renderCommissionSummaryCard mais abaixo) assume o mesmo
// lugar no card, logo abaixo do próximo jogo.
// Nova feature (mockup brtreinadorbloco1pendentes.html — Histórico de
// confrontos) — retrospecto V-E-D contra um adversário específico,
// puxado de CAREER.matchLog (só os jogos do PRÓPRIO clube, ver
// finishLiveMatch — nunca inventa histórico de antes desta carreira).
function renderH2H(opponentId) {
  const opponent = teamById(opponentId);
  const myClub = teamById(CAREER.clubId);
  const meetings = (CAREER.matchLog || []).filter((m) => String(m.opponentId) === String(opponentId));
  let v = 0, e = 0, d = 0;
  meetings.forEach((m) => {
    const myGoals = m.home ? m.gh : m.ga, oppGoals = m.home ? m.ga : m.gh;
    if (myGoals > oppGoals) v++; else if (myGoals === oppGoals) e++; else d++;
  });
  document.getElementById("h2hMyCrest").innerHTML = crestImg(myClub, 38);
  document.getElementById("h2hMyName").textContent = myClub?.name || CAREER.clubName || "";
  document.getElementById("h2hOppCrest").innerHTML = crestImg(opponent, 38);
  document.getElementById("h2hOppName").textContent = opponent?.name || "Adversário";
  document.getElementById("h2hRecord").textContent = meetings.length ? `${v}–${e}–${d}` : "—";
  document.getElementById("h2hSub").textContent = meetings.length
    ? `V–E–D em ${meetings.length} jogo(s) nesta carreira`
    : "Vocês ainda não se enfrentaram nesta carreira.";
  document.getElementById("h2hFormRow").innerHTML = meetings.slice(0, 5).map((m) => {
    const myGoals = m.home ? m.gh : m.ga, oppGoals = m.home ? m.ga : m.gh;
    const cls = myGoals > oppGoals ? "v" : myGoals === oppGoals ? "e" : "d";
    const label = myGoals > oppGoals ? "V" : myGoals === oppGoals ? "E" : "D";
    return `<div class="m3-form-dot ${cls}">${label}</div>`;
  }).join("");
  document.getElementById("h2hMatchList").innerHTML = meetings.slice(0, 10).map((m) => {
    const leftName = m.home ? (myClub?.name || CAREER.clubName) : (opponent?.name || "Adversário");
    const rightName = m.home ? (opponent?.name || "Adversário") : (myClub?.name || CAREER.clubName);
    return `<div class="m3-match-row">
      <div class="m3-match-date">Temp. ${m.seasonYear} · R${m.round}</div>
      <div class="m3-match-score">${escapeHtml(leftName)} ${m.gh} x ${m.ga} ${escapeHtml(rightName)}</div>
    </div>`;
  }).join("") || `<p class="ct-empty">Ainda não jogaram entre si nesta carreira.</p>`;
}
function openH2H(opponentId) {
  if (!opponentId) return;
  renderH2H(opponentId);
  document.getElementById("h2hOverlay").classList.add("open");
}
function closeH2H() {
  document.getElementById("h2hOverlay").classList.remove("open");
}
function renderCentral() {
  refreshAvailability();
  // FASE 4 (item 4) — card só aparece quando há proposta pendente (ver
  // maybeGenerateClubProposals/openClubProposalModal) — reabre a
  // notificação caso o técnico tenha fechado no X sem decidir.
  const proposal = (CAREER.clubProposals || [])[0];
  document.getElementById("clubProposalCard").style.display = proposal ? "" : "none";
  if (proposal) {
    document.getElementById("clubProposalSummary").textContent =
      `${proposal.clubName} — orçamento oferecido: ${fmtBRL(proposal.budgetOffered)}.`;
  }
  // Pedido do usuário: número da rodada saiu do header (agora só logo
  // + "Modo Carreira" + menu, ver ct-topbar) e virou parte do título
  // deste card: "Próximo jogo (X / 38)".
  // AJUSTE (redesign, Tela 3) — sem parênteses: virou um chip próprio
  // ao lado do título (ver .ct-round-inline em carreira.html), não
  // mais texto parentético dentro do <h2>.
  document.getElementById("roundPill").textContent = `${Math.min(CAREER.currentRound, 38)} / 38`;
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
    delete box.dataset.opponentId;
  } else {
    btn.classList.remove("hidden");
    document.getElementById("btnAdvanceSeason").classList.add("hidden");
    const fx = (CAREER.schedule[round] || []).find((m) => String(m.home) === String(CAREER.clubId) || String(m.away) === String(CAREER.clubId));
    if (fx) {
      const home = teamById(fx.home), away = teamById(fx.away);
      // AJUSTE (Opção B do mockup confronto-escudo-opcoes.html) —
      // escudo maior (72px) com halo atrás na cor do clube (c1), só
      // neste card (ver .mt-nextmatch em carreira.html).
      box.innerHTML = `
        <div class="side">
          <span class="mt-nextmatch-spot"><span class="mt-nextmatch-glow" style="background:radial-gradient(circle, ${home?.c1 || "#8892A0"} 0%, transparent 70%);"></span>${crestImg(home, 72)}</span>
          <span class="n">${escapeHtml(home.name)}</span>
        </div>
        <span class="vs">×</span>
        <div class="side">
          <span class="mt-nextmatch-spot"><span class="mt-nextmatch-glow" style="background:radial-gradient(circle, ${away?.c1 || "#8892A0"} 0%, transparent 70%);"></span>${crestImg(away, 72)}</span>
          <span class="n">${escapeHtml(away.name)}</span>
        </div>`;
      // Nova feature — Histórico de confrontos (H2H): card do próximo
      // jogo vira clicável (ver wireStaticListeners/openH2H), abre o
      // retrospecto contra o adversário desta rodada.
      box.dataset.opponentId = String(fx.home) === String(CAREER.clubId) ? fx.away : fx.home;
    } else {
      box.innerHTML = `<p class="ct-empty">Sem jogo do seu time nessa rodada (folga).</p>`;
      delete box.dataset.opponentId;
    }
    btn.disabled = false;
  }
  const filled = CAREER.lineup.starters.filter(Boolean).length;
  document.getElementById("lineupWarning").textContent = filled < 11
    ? `⚠️ Sua escalação tem ${filled}/11 titulares definidos — o time entra com força reduzida. Ajuste em "Escalação".`
    : "";
  // AJUSTE (pedido do usuário: "remover o card de situação do elenco")
  // — card "Situação do elenco" (elenco/disponíveis/contundidos/
  // suspensos/moral média) removido da Central; "Temporada X" que
  // morava no rótulo desse card já aparece na identidade do topbar
  // (ver renderTopbarIdentity), então não perde informação nenhuma.
  // `squad` continua usado logo abaixo (folha salarial/teto).
  const squad = CAREER.squad;

  // FASE 2 (b) — card "Financeiro": caixa e uso do teto salarial (só
  // elenco PRINCIPAL conta pro teto, ver wageBillOf).
  const wageBill = wageBillOf(squad);
  const { cash, wageCap } = CAREER.finances;
  document.getElementById("financeKpis").innerHTML =
    kpiHTML("Caixa", fmtBRLShort(cash), "gold", "fin") +
    kpiHTML("Folha salarial", fmtBRLShort(wageBill), wageBill >= wageCap ? "red" : null, "fin");
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
  // FASE 4 (item 5) — patrocínio/material esportivo (ver
  // renderSponsorship).
  renderSponsorship();
  // Nova feature — resumo da Comissão Técnica (ver
  // renderCommissionSummaryCard/COMMISSION_AREAS) direto no Início —
  // substitui o antigo carrossel "Elenco em destaque" nesse lugar do
  // card (pedido do usuário).
  renderCommissionSummaryCard();

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
// Ícone/cor por tipo ficaram em liveEventDot() (Tela 13b/14) — aqui só
// o texto que aparece à direita do nome do jogador.
const MATCH_EVENT_META = {
  gol: { label: "Gol" },
  amarelo: { label: "Cartão amarelo" },
  vermelho: { label: "Cartão vermelho" },
};
function matchEventsSummaryHTML(events) {
  if (!events || !events.length) return "";
  const rows = events.map((e) => {
    const meta = MATCH_EVENT_META[e.type] || { label: e.type };
    // AJUSTE (Play-by-Play v2) — gol de pênalti ganha a marcação "(de
    // pênalti)" ao lado de "Gol", só um toque de fidelidade — nada
    // muda no placar/lógica, só na descrição.
    const typeLabel = e.type === "gol" && e.penalty ? `${meta.label} (de pênalti)` : meta.label;
    // Gol do adversário (ver simulateRound: time rival não tem elenco
    // individual, só teve "e.player" quando é ALGUÉM do seu time) —
    // credita ao time em vez de um nome de jogador que não existe.
    const nm = e.player ? escapeHtml(abbreviateName(e.player)) : `Gol do ${escapeHtml(e.team)}`;
    // AJUSTE (refatoração completa, Tela 14) — ícone/cor por tipo
    // reaproveitando liveEventDot() (mesma função da linha do tempo Ao
    // Vivo, Tela 13b), no lugar do emoji + fundo chapado de antes.
    const dot = liveEventDot(e.type);
    // AJUSTE (Play-by-Play v1) — assistência não é mais um evento
    // separado, virou o campo assistPlayer do próprio "gol" (ver
    // attributeGoals) — some como uma linha discreta abaixo do nome
    // do artilheiro, em vez de uma linha própria na lista.
    const assistLine = e.type === "gol" && e.assistPlayer
      ? `<span class="ct-event-assist">Assistência: ${escapeHtml(abbreviateName(e.assistPlayer))}</span>` : "";
    return `<div class="ct-event-row">
      <span class="ct-event-icon ${dot.cls}">${dot.svg}</span>
      <span class="ct-event-namewrap"><span class="nm">${nm}</span>${assistLine}</span>
      <span class="tp">${e.player ? typeLabel : ""}</span>
    </div>`;
  }).join("");
  return `<div class="ct-event-list">${rows}</div>`;
}

/* ---------- Renderização: Elenco ----------
   AJUSTE (refatoração completa, Tela 4 — ver 04-elenco-restyled.html do
   designer) — lista agrupada por posição com divisor (.mt-pos-divider)
   no lugar da tabela genérica .ct-table de antes. */
const SUBPOS_GROUP_LABEL = { GOL: "GOLEIROS", DEF: "DEFENSORES", MEI: "MEIAS", ATA: "ATACANTES" };
const SUBPOS_DIVCLASS = { GOL: "gol", DEF: "def", MEI: "mei", ATA: "ata" };
function posDividerHTML(subpos) {
  return `<div class="mt-pos-divider ${SUBPOS_DIVCLASS[subpos]}"><span class="bar"></span><span class="lbl">${SUBPOS_GROUP_LABEL[subpos]}</span></div>`;
}
// Faixa de cor do badge de OVR — mesmos limiares do mockup (elite 80+,
// good 70-79, mid <70).
function ovrTierClass(overall) {
  return overall >= 80 ? "t-elite" : overall >= 70 ? "t-good" : "t-mid";
}
// Barra de condição em segmentos (mesma nota 1-5 de sempre, ver
// conditionRating/CONDITION_RATING_LABEL) — .mt-condition-bar no lugar
// de .ct-cond-dots (removida, ver comentário acima).
function mtConditionBarHTML(condition) {
  const rating = conditionRating(condition);
  const cls = rating >= 4 ? "full" : rating === 3 ? "mid" : "low";
  let segs = "";
  for (let i = 1; i <= 5; i++) segs += `<span class="seg${i <= rating ? " on" : ""}"></span>`;
  return `<div class="mt-condition-bar ${cls}" title="Condição: nota ${rating}/5 (${CONDITION_RATING_LABEL[rating]})">${segs}</div>`;
}
function playerRow(p) {
  const tags = [];
  // Pedido do usuário: sem tag "gerado" pra jogador da BASE (a
  // categoria inteira já é gerada, ver comentário em openDetail) — só
  // aparece pro elenco PRINCIPAL gerado (exceção de verdade, quando a
  // busca real veio incompleta).
  if (!p.real && p.origin !== "base") tags.push(`<span class="mt-ptag neutral">gerado</span>`);
  // FASE 1 (item 1) — pedido do usuário: aviso visível com antecedência
  // no card do jogador (aqui, na lista do Elenco também, não só no
  // detalhe) — ver isContractExpiring em carreira.js.
  if (isContractExpiring(p)) tags.push(`<span class="mt-ptag gold" title="Sai de graça se a temporada acabar sem renovar">Fim de contrato</span>`);
  // FASE 4 (item 1) — alerta visível de "pede transferência" (ver
  // applyMoraleAfterMatch) — ícone igual ao do mockup.
  if (p.wantsTransfer) tags.push(`<span class="mt-ptag crimson" title="Moral muito baixa há várias rodadas seguidas fora do time titular"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="6 11 12 5 18 11"/></svg>Pede transferência</span>`);
  // Pedido do usuário: no lugar do texto ("Disponível"/"Lesão X (até
  // RN)"/"Suspenso (RN)"), só marca a EXCEÇÃO (disponível é o caso
  // comum, não precisa de tag) — o detalhe todo (severidade, rodada de
  // volta) vira tooltip, mesma ideia de sempre.
  if (p.status === "contundido") tags.push(`<span class="mt-ptag crimson" title="Lesão ${injurySeverityLabel(p.injurySeverity)} — de volta na rodada ${p.outUntilRound}">🩹 Lesionado</span>`);
  else if (p.status === "suspenso") tags.push(`<span class="mt-ptag crimson" title="Suspenso — de volta na rodada ${p.outUntilRound}">🟥 Suspenso</span>`);
  // Empréstimo — mesma linguagem visual do "gerado" (pill neutro), só
  // pra deixar claro na lista que esse jogador não é seu de verdade.
  if (p.origin === "loan") tags.push(`<span class="mt-ptag neutral" title="${p.loanReturnRound ? `Volta pro clube de origem na rodada ${p.loanReturnRound}` : "Volta pro clube de origem no fim da temporada"}">emprestado</span>`);
  // FASE 2 (b) — só marca os EXTREMOS (feliz/infeliz) — moral neutra
  // (a maioria do elenco, na prática) não precisa de ícone nenhum, só
  // poluiria a lista à toa. Emoji direto no nome (não é uma "tag" de
  // exceção formal, só um humor rápido de bater o olho).
  const morale = p.morale == null ? 70 : p.morale;
  const moraleEmoji = morale >= 80 ? ` <span title="Moral ${morale} — feliz no clube">😊</span>`
    : morale <= 30 ? ` <span title="Moral ${morale} — infeliz no clube">😞</span>`
    : "";
  // Fase 2 (olheiro) — faixa de potencial junto do overall, só pra quem
  // ainda carrega potencial (promovido recente da base).
  const potRange = scoutedPotentialRange(p);
  const ovrLabel = potRange ? `<span title="Faixa estimada por olheiro — o teto real é incerto até o jogador amadurecer">${p.overall}</span>` : p.overall;
  return `<div class="m3-list-item" data-id="${p.id}">
    <div class="m3-li-rating ${ovrTierClass(p.overall)}">${ovrLabel}</div>
    <div class="m3-li-body">
      <div class="m3-li-name">${escapeHtml(abbreviateName(p.name))}${moraleEmoji}</div>
      ${mtConditionBarHTML(p.condition)}
      ${tags.length ? `<div class="m3-li-meta">${tags.join("")}</div>` : ""}
    </div>
    <div class="m3-li-side"><b>${p.age}</b><br>anos</div>
  </div>`;
}
// Linha da categoria de base (potencial + confiança do olheiro) — igual
// ao mockup: nome+idade, faixa de potencial com barra, overall ATUAL
// (pequeno, o jogador ainda não chegou lá) e confiança em 3 pontos.
function baseRow(p) {
  const potRange = scoutedPotentialRange(p);
  // Confiança derivada da MESMA incerteza por idade já usada em
  // scoutedPotentialRange (ageUncertainty) — quanto mais novo, mais
  // larga a margem de erro, menos confiança visível; não é um dado
  // novo inventado pra tela, só uma leitura visual do que já existe.
  const confDots = p.age <= 17 ? 1 : p.age <= 19 ? 2 : 3;
  const confidenceHTML = `<div class="mt-confidence" title="Confiança do olheiro na faixa de potencial">${[1, 2, 3].map((i) => `<span class="dot${i <= confDots ? " on" : ""}"></span>`).join("")}</div>`;
  // Barra mostra o quanto do teto de potencial já foi alcançado (overall
  // atual / topo da faixa estimada) — progresso real de desenvolvimento,
  // não um número decorativo.
  const potPct = potRange ? clamp(Math.round((p.overall / potRange.hi) * 100), 5, 100) : 0;
  return `<div class="m3-list-item" data-id="${p.id}">
    <div class="m3-li-rating ${ovrTierClass(p.overall)}">${p.overall}</div>
    <div class="m3-li-body">
      <div class="m3-li-name">${escapeHtml(abbreviateName(p.name))} <span class="yr">· ${p.age} anos</span></div>
      ${potRange ? `<div class="mt-base-sub">Potencial ${potRange.lo}–${potRange.hi}</div><div class="mt-pot-bar-track"><div class="mt-pot-bar-fill" style="width:${potPct}%"></div></div>` : ""}
    </div>
    ${confidenceHTML}
  </div>`;
}
// Agrupa uma lista já ordenada por squadSortKey em blocos por posição,
// intercalando o divisor (.mt-pos-divider) só quando o grupo muda —
// mesma técnica visual do mockup (GOLEIROS/DEFENSORES/MEIAS/ATACANTES).
function groupedListHTML(players, rowFn, emptyMsg) {
  if (!players.length) return `<p class="ct-empty">${emptyMsg}</p>`;
  let html = "";
  let lastSubpos = null;
  players.forEach((p) => {
    const subpos = subPositionOf(p);
    if (subpos !== lastSubpos) { html += posDividerHTML(subpos); lastSubpos = subpos; }
    html += rowFn(p);
  });
  return html;
}
// Redesign (mockup brtreinadorbloco1inicio.html, tela 4 — Elenco) —
// filter chips por cima dos 2 cards já existentes. Estado do filtro
// ativo fica só na sessão (não persiste no save — é preferência de
// navegação, não dado de carreira), reseta pro padrão "todos" a cada
// reload como o resto da UI.
let ELENCO_FILTER = "todos";
const ELENCO_FILTERS = [
  { id: "todos", label: "Todos" },
  { id: "titulares", label: "Titulares" },
  { id: "lesionados", label: "Lesionados" },
  { id: "base", label: "Base" },
];
function renderElenco() {
  refreshAvailability();
  // AJUSTE (feedback do usuário: "a meta da diretoria pode sair da
  // Central e ir para a página de Elenco") — movida daqui de
  // renderCentral(); CAREER.boardGoal já existe garantido a essa altura
  // (startCareer/migrateCareerDefaults sempre calculam um). renderElenco()
  // e renderCentral() sempre rodam juntas em toda mudança de estado (ver
  // os call sites de ambas), então a meta continua tão atualizada quanto
  // estava antes.
  document.getElementById("boardGoalLabel").textContent = `🎯 Meta da diretoria: ${CAREER.boardGoal.label}`;
  // Ordenado por posição (Goleiros, Defensores, Meio-campo, Atacantes —
  // ver SUBPOS_ORDER) e, dentro da mesma posição, por overall — dentro
  // de cada grupo (principal/base), pedido do usuário.
  // BUG CORRIGIDO: jogador emprestado (origin "loan") não entrava em
  // NENHUMA das 2 tabelas (nem principal, nem base) — ficava invisível
  // no Elenco mesmo estando disponível pra escalar.
  const principal = CAREER.squad.filter((p) => p.origin === "principal" || p.origin === "loan").sort((a, b) => squadSortKey(a) - squadSortKey(b));
  const base = CAREER.squad.filter((p) => p.origin === "base").sort((a, b) => squadSortKey(a) - squadSortKey(b));

  const lesionadosCount = principal.filter((p) => p.status !== "ok").length;
  document.getElementById("elencoFilterRow").innerHTML = ELENCO_FILTERS.map((f) => {
    const count = f.id === "todos" ? principal.length + base.length : f.id === "lesionados" ? lesionadosCount : null;
    const label = count === null ? f.label : `${f.label} · ${count}`;
    return `<button class="m3-filter-chip${ELENCO_FILTER === f.id ? " on" : ""}" data-filter="${f.id}">${escapeHtml(label)}</button>`;
  }).join("");
  document.querySelectorAll("#elencoFilterRow .m3-filter-chip").forEach((btn) => {
    btn.addEventListener("click", () => { ELENCO_FILTER = btn.dataset.filter; renderElenco(); });
  });

  // Não junta as 2 listas numa só — playerRow()/baseRow() mostram
  // colunas diferentes (potencial/confiança do olheiro só existe na
  // base). O filtro só decide QUAIS cards aparecem e, dentro do
  // principal, quais jogadores.
  let mainData = principal, showMain = true, showBase = true;
  if (ELENCO_FILTER === "titulares") { mainData = principal.filter((p) => CAREER.lineup.starters.includes(p.id)); showBase = false; }
  else if (ELENCO_FILTER === "lesionados") { mainData = principal.filter((p) => p.status !== "ok"); showBase = false; }
  else if (ELENCO_FILTER === "base") { showMain = false; }
  document.getElementById("squadMainCard").classList.toggle("hidden", !showMain);
  document.getElementById("squadBaseCard").classList.toggle("hidden", !showBase);

  const mainList = document.getElementById("squadMainList");
  mainList.innerHTML = groupedListHTML(mainData, playerRow, ELENCO_FILTER === "titulares" ? "Nenhum titular escalado ainda." : ELENCO_FILTER === "lesionados" ? "Ninguém no departamento médico." : "Sem jogadores.");
  const baseList = document.getElementById("squadBaseList");
  baseList.innerHTML = groupedListHTML(base, baseRow, "Sem jogadores.");
  [mainList, baseList].forEach((list) => list.querySelectorAll("[data-id]").forEach((row) => row.addEventListener("click", () => openDetail(row.dataset.id))));
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
      toast(`Essa renovação estouraria o teto salarial (${fmtBRL(CAREER.finances.wageCap)}).`, { type: "warn" });
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
    toast(`${abbreviateName(p.name)} recusou a proposta — está infeliz no clube e não quer renovar agora.`, { durationMs: 5000, type: "warn" });
    firePressConference("19", CAREER.currentRound, false);
    openPressConferenceModal();
    return;
  }
  if (newWage < minWage) {
    closeRenewModal();
    toast(`${abbreviateName(p.name)} recusou a proposta — quer pelo menos ${fmtBRL(minWage)}/mês.`, { durationMs: 5000, type: "warn" });
    firePressConference("19", CAREER.currentRound, false);
    openPressConferenceModal();
    return;
  }
  if (duration === 1 && (p.age <= 23 || p.overall >= 85 || morale >= 85)) {
    closeRenewModal();
    toast(`${abbreviateName(p.name)} recusou a proposta — quer um contrato mais longo (pelo menos 2 anos).`, { durationMs: 5000, type: "warn" });
    firePressConference("19", CAREER.currentRound, false);
    openPressConferenceModal();
    return;
  }
  p.wage = Math.max(p.wage, newWage);
  p.contractUntil = CAREER.seasonYear + duration;
  closeRenewModal();
  toast(`${abbreviateName(p.name)} renovou até ${p.contractUntil} por ${fmtBRL(p.wage)}/mês!`, { type: "pos" });
  persistCareer();
  renderElenco(); renderCentral();
  if (document.getElementById("detailOverlay").classList.contains("open")) openDetail(p.id);
}
// Redesign (mockup brtreinadorbloco1inicio.html, tela 6 — Perfil do
// jogador) — atributo em barra (label + trilho preenchido + número),
// reaproveitado só no detalhe do jogador por enquanto. Escala 0-99
// (mesmo teto de sempre pros atributos do motor; moral já é 0-100,
// mesma leitura visual serve pras duas sem precisar normalizar).
function attrBarHTML(label, value, variant, trendHTML) {
  const pct = clamp(Math.round(value), 0, 100);
  const fillClass = variant === "red" ? " crimson" : variant === "gold" ? " gold" : "";
  return `<div class="m3-attr-row">
    <div class="m3-attr-label">${escapeHtml(label)}</div>
    <div class="m3-attr-bar"><div class="m3-attr-fill${fillClass}" style="width:${pct}%;"></div></div>
    <div class="m3-attr-num">${value}${trendHTML || ""}</div>
  </div>`;
}
function openDetail(id) {
  const p = CAREER.squad.find((x) => x.id === id);
  if (!p) return;
  const inStarters = CAREER.lineup.starters.includes(id);
  const inBench = CAREER.lineup.bench.includes(id);
  const subpos = subPositionOf(p);
  const groupFull = SUBPOS_LABEL[subpos] || "—";
  // AJUSTE (refatoração completa, Tela 5 — ver 05-detalhe-do-jogador-
  // restyled.html do designer) — cabeçalho do modal (ícone/h3/sub)
  // continua com o MESMO chrome compartilhado por dezenas de outros
  // modais (.ct-modal-header), só que agora genérico ("Perfil do
  // jogador") — a identidade de verdade (nome, posição, idade, OVR)
  // vira o "hero" dentro do corpo, igual ao mockup, não mais duplicada
  // no cabeçalho.
  document.getElementById("detailIcon").textContent = subpos === "GOL" ? "🧤" : "⚽";
  document.getElementById("detailName").textContent = "Perfil do jogador";
  document.getElementById("detailSub").textContent = "";
  // Pedido do usuário: tirar a tag "gerado" dos jogadores da BASE —
  // toda a categoria de base já vem gerada (a API não cobre elenco
  // sub-20 do Brasileirão, ver comentário em buildBasePlayer), então a
  // tag não dizia nada de novo ali, só poluía. Continua aparecendo só
  // pro elenco PRINCIPAL gerado (jogador extra criado quando a busca
  // real veio incompleta — esse sim é uma exceção que vale marcar).
  const originLabel = p.origin === "principal" ? "Elenco principal" : p.origin === "loan" ? "Emprestado" : "Categoria de base";
  const heroSub = `${groupFull} · ${p.age} anos · ${originLabel}${(!p.real && p.origin !== "base") ? " (gerado)" : ""}`;
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
    <div class="mt-player-hero">
      <div class="mt-ovr-badge sz-lg ${ovrTierClass(p.overall)}">${p.overall}</div>
      <div class="mt-player-hero-info">
        <b>${escapeHtml(p.name.toUpperCase())}</b>
        <span>${heroSub}</span>
      </div>
    </div>
    <div class="m3-attr-bars">
      ${attrBarHTML("Geral", p.overall, "gold", trendArrow("overall"))}
      ${attrBarHTML("Ataque", p.atk, null, trendArrow("atk"))}
      ${attrBarHTML("Defesa", p.def, null, trendArrow("def"))}
      ${attrBarHTML("Físico", p.phys, null, trendArrow("phys"))}
      ${attrBarHTML("Moral", morale, moraleVariant, "")}
    </div>
    ${potRange ? `<p class="mt-badge-gold" style="display:flex;">🔭 Avaliação do olheiro: potencial entre ${potRange.lo} e ${potRange.hi}.</p>` : ""}
    ${mtConditionBarHTML(p.condition)}
    <p class="mt-info-line">Condição: ${conditionRating(p.condition)}/5 (${CONDITION_RATING_LABEL[conditionRating(p.condition)]}) · Jogos: ${p.apps || 0} · Gols na carreira: ${p.goalsCareer || 0} · Cartões amarelos (ciclo atual): ${p.yellowCards || 0}</p>
    <!-- FASE 4 (item 1) — seção "Relacionamento" pedida no documento:
         motivo atual + tendência da moral (ver applyMoraleAfterMatch);
         "pede transferência" vira o mt-badge-alert de destaque abaixo,
         não fica escondido no meio do texto. -->
    <p class="mt-info-line">Relacionamento: ${escapeHtml(p.moraleReason || "Neutro no clube")}${moraleTrendArrowHTML(p)}</p>
    ${p.wantsTransfer ? `<p class="mt-badge-alert" style="display:flex;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="width:14px;height:14px;"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="6 11 12 5 18 11"/></svg>Insatisfeito — pede transferência</p>` : ""}
    <p class="mt-info-line">Salário: ${fmtBRL(p.wage)}/mês · Contrato até: ${p.contractUntil} · Valor de mercado: ${fmtBRL(p.value)}</p>
    <!-- FASE 1 (item 1 da especificação "BR Data Treinador") — pedido
         do usuário: aviso visível de final de contrato, com
         antecedência, direto no card do jogador (ver
         isContractExpiring/openRenewModal em carreira.js). Sem essa
         janela de aviso o vencimento pegava o treinador de surpresa —
         hoje o jogador só saía de graça na virada de temporada
         (renewHumanSquad, Fase 3c), sem chance nenhuma de segurar
         antes disso. -->
    ${isContractExpiring(p) ? `<p class="mt-badge-gold" style="display:flex;">⚠️ Contrato até ${CAREER.seasonYear} — sai de graça se a temporada acabar sem renovar.</p>` : ""}
    <!-- FASE 1 (item 4) — mesmo padrão do aviso de contrato acima:
         destaque no detalhe pra quem tá fora de combate (ver
         INJURY_SEVERITY em carreira.js). -->
    ${p.status === "contundido" ? `<p class="mt-badge-alert" style="display:flex;">🩹 Lesão ${injurySeverityLabel(p.injurySeverity)} — de volta na rodada ${p.outUntilRound}.</p>` : ""}
    ${p.status === "suspenso" ? `<p class="mt-badge-alert" style="display:flex;">🟥 Suspenso — de volta na rodada ${p.outUntilRound}.</p>` : ""}
    <!-- AJUSTE (refatoração completa, Tela 5) — botões empilhados em
         coluna cheia, com a hierarquia de cor do mockup:
         .mt-btn-primary-gold pras ações que avançam contrato/dinheiro
         (renovar/promover/vender), .mt-btn-ghost pra gestão de rotina
         do elenco, .mt-btn-danger-outline só pra dispensar (a única
         ação irreversível de verdade aqui). -->
    <div class="mt-action-list">
      ${canTalkTo(p) ? `<button class="mt-btn-ghost" data-act="talk">💬 Conversar</button>` : ""}
      <!-- Nova feature (mockup brtreinadorbloco1pendentes.html — Comparar
           jogadores): entry point pedido explicitamente aqui no Perfil.
           Sem trava de posição/status — a trava real é no picker (só
           mostra quem joga na MESMA posição), então até um jogador
           lesionado/suspenso pode abrir a comparação normalmente. -->
      <button class="mt-btn-ghost" data-act="compare">⚖️ Comparar jogador</button>
      ${isContractExpiring(p) ? `<button class="mt-btn-primary-gold" data-act="renew">✍️ Renovar contrato</button>` : ""}
      ${inStarters ? `<button class="mt-btn-ghost" data-act="removeStarter">Tirar do time titular</button>` : ""}
      ${!inStarters && inBench ? `<button class="mt-btn-ghost" data-act="removeBench">Tirar do banco</button>` : ""}
      ${!inStarters && !inBench && p.status === "ok" ? `<button class="mt-btn-ghost" data-act="addBench" ${CAREER.lineup.bench.length >= MAX_BENCH ? "disabled" : ""}>Colocar no banco</button>` : ""}
      ${p.origin === "loan" ? "" : p.origin === "base"
        ? `<button class="mt-btn-primary-gold" data-act="promote" ${promoteBlocked ? "disabled" : ""} ${promoteBlocked ? `title="Estouraria o teto salarial (${fmtBRL(CAREER.finances.wageCap)}) — libere espaço dispensando ou enviando alguém pra base antes."` : ""}>Promover ao elenco principal</button>`
        : `<button class="mt-btn-ghost" data-act="demote">Enviar pra base</button>`}
      ${p.origin === "principal" ? `<button class="mt-btn-primary-gold" data-act="sell">Vender por ${fmtBRL(p.value)}</button>
      <button class="mt-btn-ghost" data-act="loanout" ${isLoanOutRefused(p) ? `disabled title="Jogador de destaque demais — não aceita ser emprestado"` : ""}>Emprestar</button>` : ""}
      <!-- Empréstimo: sem vender/dispensar/renovar — o jogador não é
           seu, só está temporariamente no elenco (ver comentário na
           seção "empréstimo de jogadores" mais acima em carreira.js). -->
      ${p.origin === "loan"
        ? `<p class="mt-info-line" style="text-align:center; border-bottom:none;">📋 Emprestado do ${escapeHtml(teamById(p.loanFromClubId).name)} ${p.loanReturnRound ? `até a rodada ${p.loanReturnRound}` : "até o fim da temporada"}${p.loanBuyOption ? (p.loanBuyOption.mandatory ? ` · compra obrigatória de ${fmtBRL(p.loanBuyOption.value)} ao fim` : ` · opção de compra de ${fmtBRL(p.loanBuyOption.value)} ao fim`) : ""} — só dá pra escalar.</p>`
        : `<button class="mt-btn-danger-outline" data-act="release">Dispensar</button>`}
    </div>
    ${promoteBlocked ? `<p class="mt-info-line" style="color:var(--mt-crimson-400); border-bottom:none;">⚠️ Promover esse jogador levaria a folha salarial a ${fmtBRL(wageAfterPromote)}, acima do teto de ${fmtBRL(CAREER.finances.wageCap)}.</p>` : ""}`;
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
  // FASE 4 (item 1) — "conversa individual", mesmo padrão de sub-modal
  // aberto POR CIMA do detalhe (ver openTalkModal/applyTalkOption).
  if (act === "talk") { openTalkModal(id); return; }
  // FASE 3 (item 3) — mesmo padrão do "renew" acima: abre o sub-modal
  // de configuração do empréstimo POR CIMA do detalhe, sem mexer em
  // nada ainda — quem decide o que muda é confirmLoanFromModal().
  if (act === "loanout") { openLoanOutModal(id); return; }
  // Nova feature — Comparar jogadores (ver openComparePicker).
  if (act === "compare") { openComparePicker(id); return; }
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
      toast(`Promover esse jogador estouraria o teto salarial (${fmtBRL(CAREER.finances.wageCap)}).`, { type: "warn" });
      return;
    }
    p.origin = "principal";
    // Retenção/Engajamento — "revelar" um jogador da base (objetivo de
    // temporada + conquista permanente "Joia da Base", que NUNCA
    // reseta — 2 contadores separados de propósito, ver
    // freshAchievementsState/OBJECTIVE_TEMPLATES.season).
    ensureObjectivesFresh();
    bumpObjective("season", "obj_reveal_base", 1);
    CAREER.baseRevealedCount = (CAREER.baseRevealedCount || 0) + 1;
    evaluateAlwaysCheckableAchievements();
  } else if (act === "demote") {
    p.origin = "base";
    CAREER.lineup.starters = CAREER.lineup.starters.map((x) => (x === id ? null : x));
    CAREER.lineup.bench = CAREER.lineup.bench.filter((x) => x !== id);
  } else if (act === "release") {
    const principalCount = CAREER.squad.filter((x) => x.origin === "principal").length;
    if (p.origin === "principal" && principalCount <= 14) { toast("O elenco principal não pode ficar com menos de 14 jogadores.", { type: "warn" }); return; }
    CAREER.squad = CAREER.squad.filter((x) => x.id !== id);
    CAREER.lineup.starters = CAREER.lineup.starters.map((x) => (x === id ? null : x));
    CAREER.lineup.bench = CAREER.lineup.bench.filter((x) => x !== id);
  } else if (act === "sell") {
    if (!(await sellPlayer(id))) return; // cancelado ou bloqueado — mantém o modal aberto
  }
  // Meus esquemas — qualquer uma dessas ações pode mexer na escalação
  // (titular/banco), então desvincula do esquema salvo igual as outras
  // mutações de lineup (ver markLineupDirty).
  markLineupDirty();
  document.getElementById("detailOverlay").classList.remove("open");
  persistCareer();
  renderElenco(); renderEscalacao(); renderCentral();
}

/* ---------- Comparar jogadores (brtreinadorbloco1pendentes.html) ----------
   Entry point: botão "⚖️ Comparar jogador" no Perfil (ver openDetail).
   Um jogador só faz sentido comparado a outro da MESMA posição — o
   filtro do picker (renderComparePickList) já garante isso, então
   renderCompareResult nunca precisa checar de novo. */
let COMPARE_BASE_ID = null;
function openComparePicker(baseId) {
  COMPARE_BASE_ID = baseId;
  const base = CAREER.squad.find((x) => x.id === baseId);
  if (!base) return;
  document.getElementById("compareSub").textContent = `Escolha um ${SUBPOS_LABEL[subPositionOf(base)] || "jogador"} pra comparar com ${abbreviateName(base.name)}`;
  document.getElementById("comparePickStep").classList.remove("hidden");
  document.getElementById("compareResultStep").classList.add("hidden");
  document.getElementById("btnCompareChangePlayer").classList.add("hidden");
  renderComparePickList();
  document.getElementById("compareOverlay").classList.add("open");
}
function renderComparePickList() {
  const base = CAREER.squad.find((x) => x.id === COMPARE_BASE_ID);
  if (!base) return;
  const subpos = subPositionOf(base);
  // Sem trava de status (lesionado/suspenso não fica de fora) — a
  // comparação é sobre ATRIBUTOS, não sobre quem pode jogar agora
  // (diferente do picker de escalação, que É sobre isso).
  const pool = CAREER.squad
    .filter((p) => p.id !== base.id && subPositionOf(p) === subpos)
    .sort((a, b) => b.overall - a.overall);
  const list = document.getElementById("comparePickList");
  list.innerHTML = pool.length ? pool.map((p) => {
    const srcClass = p.origin === "base" ? "base" : p.origin === "loan" ? "loan" : "principal";
    const srcLabel = p.origin === "base" ? "base" : p.origin === "loan" ? "emprestado" : "principal";
    return `<div class="mt-sel-row" data-id="${p.id}">
      <span class="mt-pos-chip ${SUBPOS_DIVCLASS[subpos]}">${subpos}</span>
      <div class="mt-sel-name">${escapeHtml(abbreviateName(p.name))}</div>
      <div class="mt-sel-meta"><span class="mt-sel-ovr${p.overall >= 80 ? " gold" : ""}">${p.overall}</span><span class="mt-sel-src ${srcClass}">${srcLabel}</span></div>
    </div>`;
  }).join("") : `<p class="ct-empty">Nenhum outro ${SUBPOS_LABEL[subpos] || "jogador"} no elenco pra comparar.</p>`;
  list.querySelectorAll("[data-id]").forEach((el) => el.addEventListener("click", () => renderCompareResult(el.dataset.id)));
}
// Linha de comparação genérica — destaca (.win) só o lado que estiver
// numericamente melhor; higherIsBetter=false inverte pra métricas de
// CUSTO (salário/valor), onde o lado mais barato é a vantagem.
function compareRowHTML(label, valA, valB, higherIsBetter, fmt) {
  const f = fmt || ((v) => v);
  const aWins = higherIsBetter ? valA > valB : valA < valB;
  const bWins = higherIsBetter ? valB > valA : valB < valA;
  return `<div class="m3-compare-row">
    <div class="m3-compare-val${aWins ? " win" : ""}">${f(valA)}</div>
    <div class="m3-compare-label">${escapeHtml(label)}</div>
    <div class="m3-compare-val${bWins ? " win" : ""}">${f(valB)}</div>
  </div>`;
}
function renderCompareResult(otherId) {
  const a = CAREER.squad.find((x) => x.id === COMPARE_BASE_ID);
  const b = CAREER.squad.find((x) => x.id === otherId);
  if (!a || !b) return;
  document.getElementById("compareSub").textContent = "";
  document.getElementById("comparePickStep").classList.add("hidden");
  document.getElementById("compareResultStep").classList.remove("hidden");
  document.getElementById("btnCompareChangePlayer").classList.remove("hidden");
  document.getElementById("compareHeaderRow").innerHTML = `
    <div class="m3-compare-player"><div class="mt-ovr-badge sz-lg ${ovrTierClass(a.overall)}">${a.overall}</div><b>${escapeHtml(abbreviateName(a.name))}</b></div>
    <div class="m3-compare-vs">VS</div>
    <div class="m3-compare-player"><div class="mt-ovr-badge sz-lg ${ovrTierClass(b.overall)}">${b.overall}</div><b>${escapeHtml(abbreviateName(b.name))}</b></div>`;
  document.getElementById("compareRows").innerHTML = [
    compareRowHTML("Geral", a.overall, b.overall, true),
    compareRowHTML("Ataque", a.atk, b.atk, true),
    compareRowHTML("Defesa", a.def, b.def, true),
    compareRowHTML("Físico", a.phys, b.phys, true),
    compareRowHTML("Idade", a.age, b.age, false),
    compareRowHTML("Salário", a.wage, b.wage, false, fmtBRL),
    compareRowHTML("Valor de mercado", a.value, b.value, false, fmtBRL),
  ].join("");
  // Custo-benefício: quanto custa (salário mensal) cada ponto de
  // overall — quem paga MENOS por ponto entrega mais retorno pro
  // dinheiro investido (nada inventado, só uma razão entre 2 campos
  // reais que o jogador já tem). Empate raro (mesma razão exata) não
  // declara vencedor, só descreve os 2 números.
  const costA = a.wage / a.overall, costB = b.wage / b.overall;
  const verdictEl = document.getElementById("compareVerdict");
  if (Math.abs(costA - costB) < 1) {
    verdictEl.textContent = `⚖️ Custo-benefício empatado: os dois custam cerca de ${fmtBRL(Math.round(costA))}/mês por ponto de overall.`;
  } else {
    const winner = costA < costB ? a : b;
    const winnerCost = Math.min(costA, costB), loserCost = Math.max(costA, costB);
    verdictEl.textContent = `⚖️ Melhor custo-benefício: ${abbreviateName(winner.name)} — ${fmtBRL(Math.round(winnerCost))}/mês por ponto de overall (contra ${fmtBRL(Math.round(loserCost))}/mês do outro).`;
  }
}
function closeCompareScreen() {
  document.getElementById("compareOverlay").classList.remove("open");
}

/* ---------- Renderização: Escalação ---------- */
// AJUSTE (Bloco 2 M3, brtreinadorbloco2tatica.html) — "Instruções de
// jogo" viram barra de 5 segmentos clicáveis (era <select> com 2-3
// opções nomeadas). Mesmo padrão de "comita só ao Salvar" que o resto
// da Escalação já usava pros <select> de tática (ver commitLineupTactics
// abaixo) — clicar num segmento só muda o preenchimento VISUAL
// (data-level na linha), CAREER só é escrito de fato quando
// commitLineupTactics() roda (Salvar ou Ir pro jogo). Reaproveitada
// pelas 2 telas que mostram os 4 eixos (Escalação normal e o sub-modal
// de ajuste tático ao vivo — ver openLiveTacticsModal/confirmLiveTactics),
// só muda o container/prefixo do id.
function tacticAxisRowHTML(axis, level) {
  const segs = [1, 2, 3, 4, 5].map((n) => `<span class="m3-seg${n <= level ? " on" : ""}" data-level="${n}"></span>`).join("");
  return `<div class="m3-instr-row" data-axis="${axis.id}" data-level="${level}">
    <div class="m3-instr-label">${escapeHtml(axis.label)}</div>
    <div class="m3-segbar">${segs}</div>
  </div>`;
}
function wireTacticAxisRows(containerId) {
  document.querySelectorAll(`#${containerId} .m3-instr-row`).forEach((row) => {
    row.querySelectorAll(".m3-seg").forEach((seg) => {
      seg.addEventListener("click", () => {
        const level = Number(seg.dataset.level);
        row.dataset.level = level;
        row.querySelectorAll(".m3-seg").forEach((s) => s.classList.toggle("on", Number(s.dataset.level) <= level));
        markLineupDirty();
      });
    });
  });
}
function renderTacticAxisRows(containerId, tactics) {
  document.getElementById(containerId).innerHTML = TACTIC_AXES.map((ax) => tacticAxisRowHTML(ax, tactics[ax.id] || 3)).join("");
  wireTacticAxisRows(containerId);
}
function readTacticAxisRows(containerId) {
  const result = {};
  document.querySelectorAll(`#${containerId} .m3-instr-row`).forEach((row) => { result[row.dataset.axis] = Number(row.dataset.level); });
  return result;
}
// AJUSTE (Bloco 2 M3, brtreinadorbloco2tatica.html) — esquema tático
// vira chip row horizontal rolável (era <select>) — clica e aplica na
// hora (mesmo comportamento imediato que o <select> já tinha, só muda
// o componente visual).
function renderFormationChips() {
  document.getElementById("formationChipRow").innerHTML = Object.keys(FORMATIONS).map((f) =>
    `<button class="m3-filter-chip${f === CAREER.lineup.formation ? " on" : ""}" data-formation="${escapeHtml(f)}">${escapeHtml(f)}</button>`
  ).join("");
  document.querySelectorAll("#formationChipRow .m3-filter-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      CAREER.lineup.formation = btn.dataset.formation;
      markLineupDirty();
      renderFormationChips();
      renderPitch();
    });
  });
}
function renderEscalacao() {
  refreshAvailability();
  renderFormationChips();
  renderTacticAxisRows("tacticAxisRows", CAREER.lineup.tactics);
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
  markLineupDirty();
  renderPitch(); renderBench();
  persistCareer();
  toast(`Escalação automática aplicada — melhores overalls por posição${includeBase ? " (incluindo base)" : ""}.`, { type: "pos" });
}
// AJUSTE (pedido do usuário: "Ajustar Escalação deve abrir uma modal
// ... com o botão Ir para o jogo") — extraída de dentro do clique de
// "Salvar escalação e táticas" (única cópia antes) pra também ser
// chamada por "Ir para o jogo" (ver goToMatch) — sem isso, mudar as
// táticas na modal (ou até na própria aba) e ir direto pro jogo sem
// clicar em "Salvar" perderia a escolha em silêncio, já que esses
// selects só valiam de verdade quando lidos aqui. Esquema/titulares/
// banco não precisam disso — já são aplicados na hora (ver
// formationSelect/autoFillLineup/openPicker). Foco de treino saiu
// daqui — retirado por completo (ver módulo de treinos novo,
// applyWeeklyTraining).
function commitLineupTactics() {
  Object.assign(CAREER.lineup.tactics, readTacticAxisRows("tacticAxisRows"));
}

/* ---------- Meus esquemas (Bloco 2, brtreinadorbloco2pendentes.html) ----------
   Biblioteca de esquemas táticos completos (formação+titulares+banco+
   táticas juntos, decisão confirmada com o usuário) — o técnico monta
   um plano de jogo (ex.: "Retranca fora") uma vez e reaplica inteiro
   depois, sem reconfigurar tudo de novo toda partida. */
const MAX_TACTICAL_SCHEMES = 8;
// Qualquer edição manual (formação/titulares/banco/tática) DEPOIS de
// carregar um esquema desvincula da origem — mesmo espírito de
// CAREER.trainingSchemeId=null ("Personalizado") já usado no módulo de
// Treinos. Chamada nos pontos de mutação de verdade (não em
// commitLineupTactics/renderEscalacao, que rodam sempre, editado ou
// não — só onde o usuário genuinamente MUDOU algo).
function markLineupDirty() {
  if (CAREER.activeSchemeId != null) CAREER.activeSchemeId = null;
}
function saveTacticalScheme(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return { ok: false, reason: "Dê um nome pro esquema." };
  if (CAREER.tacticalSchemes.length >= MAX_TACTICAL_SCHEMES) {
    return { ok: false, reason: `Limite de ${MAX_TACTICAL_SCHEMES} esquemas salvos — apague um antes de criar outro.` };
  }
  const scheme = {
    id: `scheme_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: trimmed.slice(0, 30),
    formation: CAREER.lineup.formation,
    starters: [...CAREER.lineup.starters],
    bench: [...CAREER.lineup.bench],
    tactics: { ...CAREER.lineup.tactics },
    createdRound: Math.min(CAREER.currentRound, 38),
  };
  CAREER.tacticalSchemes.push(scheme);
  CAREER.activeSchemeId = scheme.id;
  return { ok: true, scheme };
}
function applyTacticalScheme(id) {
  const scheme = CAREER.tacticalSchemes.find((s) => s.id === id);
  if (!scheme) return false;
  CAREER.lineup.formation = scheme.formation;
  CAREER.lineup.starters = [...scheme.starters];
  CAREER.lineup.bench = [...scheme.bench];
  CAREER.lineup.tactics = { ...scheme.tactics };
  CAREER.activeSchemeId = scheme.id;
  return true;
}
function deleteTacticalScheme(id) {
  CAREER.tacticalSchemes = CAREER.tacticalSchemes.filter((s) => s.id !== id);
  if (CAREER.activeSchemeId === id) CAREER.activeSchemeId = null;
}
// Meta honesta (não inventa "usado nos últimos 8 jogos" como o mockup —
// não temos esse dado de verdade) — descreve o que o esquema REALMENTE
// guarda: quantos titulares tinha quando foi salvo + em que rodada.
function schemeSummary(s) {
  const filled = s.starters.filter(Boolean).length;
  return `Salvo na rodada ${s.createdRound} · ${filled}/11 titulares`;
}
function schemeRowHTML(s) {
  const isActive = s.id === CAREER.activeSchemeId;
  return `<div class="m3-scheme-row${isActive ? " active" : ""}" data-id="${s.id}">
    <div class="m3-scheme-icon">${escapeHtml(s.formation)}</div>
    <div class="m3-scheme-body">
      <div class="m3-scheme-name">${escapeHtml(s.name)}</div>
      <div class="m3-scheme-meta">${escapeHtml(schemeSummary(s))}</div>
    </div>
    ${isActive ? `<span class="m3-scheme-badge">ATIVO</span>` : ""}
    <button class="m3-scheme-delete" data-delete="${s.id}" aria-label="Apagar esquema" title="Apagar esquema"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
  </div>`;
}
function renderSchemesScreen() {
  const list = CAREER.tacticalSchemes;
  document.getElementById("schemesCountLabel").textContent = `Salvos · ${list.length}`;
  document.getElementById("schemesList").innerHTML = list.length
    ? list.map(schemeRowHTML).join("")
    : `<p class="ct-empty">Nenhum esquema salvo ainda — monte a escalação/tática que quiser na aba Tática e toque em "Novo esquema".</p>`;
  document.querySelectorAll("#schemesList .m3-scheme-row").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (e.target.closest("[data-delete]")) return;
      applyTacticalScheme(row.dataset.id);
      renderSchemesScreen();
      renderEscalacao();
      persistCareer();
      toast(`Esquema "${CAREER.tacticalSchemes.find((s) => s.id === row.dataset.id)?.name}" aplicado.`, { type: "pos" });
    });
  });
  document.querySelectorAll("#schemesList [data-delete]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const scheme = CAREER.tacticalSchemes.find((s) => s.id === btn.dataset.delete);
      if (!scheme) return;
      if (!(await confirmModal(`Apagar o esquema "${scheme.name}"?`, "Apagar"))) return;
      deleteTacticalScheme(scheme.id);
      renderSchemesScreen();
      persistCareer();
    });
  });
}
function openSchemesScreen() {
  renderSchemesScreen();
  document.getElementById("schemesOverlay").classList.add("open");
}
function closeSchemesScreen() {
  document.getElementById("schemesOverlay").classList.remove("open");
}
function openNewSchemeSheet() {
  document.getElementById("newSchemeNameInput").value = "";
  document.getElementById("newSchemeSheet").classList.add("open");
  document.getElementById("newSchemeNameInput").focus();
}
function closeNewSchemeSheet() {
  document.getElementById("newSchemeSheet").classList.remove("open");
}
function confirmNewScheme() {
  const name = document.getElementById("newSchemeNameInput").value;
  const result = saveTacticalScheme(name);
  if (!result.ok) { toast(result.reason, { type: "warn" }); return; }
  closeNewSchemeSheet();
  persistCareer();
  renderSchemesScreen();
  toast(`Esquema "${result.scheme.name}" salvo e aplicado.`, { type: "pos" });
}

/* ---------- Marcação individual (Bloco 2, brtreinadorbloco2pendentes.html) ----------
   Escalar um jogador seu pra marcar um jogador ESPECÍFICO do adversário
   do próximo jogo — efeito real (confirmado com o usuário): reduz o
   peso de sorteio do jogador marcado no ataque rival (attributeGoals),
   nunca zera de vez. Só vale pro confronto que está por vir — limpa
   sozinha depois do jogo (ver finishRoundTail), pra nunca ficar um
   efeito antigo grudado sem ninguém perceber. */
const MAN_MARKING_SUPPRESS_FACTOR = 0.4; // 60% de redução no peso de sorteio, nunca 100%
let MARKING_SELECTED_MINE = null;
let MARKING_SELECTED_RIVAL = null;
// Mesmo confronto usado pelo card "Próximo jogo" da Central/H2H — só
// existe enquanto há um jogo de verdade marcado (round <= 38 e não é
// rodada de folga).
function nextOpponentId() {
  const round = CAREER.currentRound;
  if (round > 38) return null;
  const fx = (CAREER.schedule[round] || []).find((m) => String(m.home) === String(CAREER.clubId) || String(m.away) === String(CAREER.clubId));
  if (!fx) return null;
  return String(fx.home) === String(CAREER.clubId) ? fx.away : fx.home;
}
// Chamada só de dentro da simulação (ver resolveLiveChunk) — devolve
// null (sem supressão nenhuma) se não há designação ativa OU se ela é
// pra outro adversário (nunca vaza pra um confronto diferente).
function activeManMarkingSuppression(opponentId) {
  const mm = CAREER.manMarking;
  if (!mm || String(mm.opponentId) !== String(opponentId)) return null;
  return { playerId: mm.rivalPlayerId, factor: MAN_MARKING_SUPPRESS_FACTOR };
}
function markingSelRowHTML(id, name, meta, selected) {
  return `<div class="mt-sel-row${selected ? " selected" : ""}" data-id="${id}">
    <div class="mt-sel-name">${escapeHtml(abbreviateName(name))}<span class="status">${meta ? ` — ${escapeHtml(meta)}` : ""}</span></div>
  </div>`;
}
function renderManMarkingScreen() {
  const opponentId = nextOpponentId();
  const empty = document.getElementById("markingEmpty");
  const content = document.getElementById("markingContent");
  const btnApply = document.getElementById("btnApplyMarking");
  if (!opponentId) {
    empty.classList.remove("hidden");
    content.classList.add("hidden");
    document.getElementById("markingOppLabel").textContent = "";
    btnApply.disabled = true;
    return;
  }
  empty.classList.add("hidden");
  content.classList.remove("hidden");
  const opp = teamById(opponentId);
  document.getElementById("markingOppLabel").textContent = `Próximo jogo: ${opp.name}`;

  const mm = CAREER.manMarking;
  const activeCard = document.getElementById("markingActiveCard");
  if (mm && String(mm.opponentId) === String(opponentId)) {
    const mine = CAREER.squad.find((p) => p.id === mm.myPlayerId);
    const rival = leagueSquadFor(opponentId).find((p) => p.id === mm.rivalPlayerId);
    activeCard.style.display = "";
    document.getElementById("markingActiveRow").innerHTML =
      `<p class="mt-info-line" style="border-bottom:none;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="width:14px;height:14px;vertical-align:-2px;"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg> <b>${escapeHtml(mine?.name || "?")}</b> marca individualmente o <b>${escapeHtml(rival?.name || "?")}</b> do adversário.</p>`;
  } else {
    activeCard.style.display = "none";
  }

  // Titulares disponíveis (quem vai realmente jogar) — não faz sentido
  // narrativo escalar um reserva pra "marcar" alguém que não vai entrar
  // em campo.
  // Goleiro fora da lista — não faz sentido de futebol nenhum escalar
  // o goleiro pra "marcar individualmente" um jogador de linha do
  // rival (mesmo filtro já aplicado do lado rival, ver rivalPool).
  const myPool = CAREER.lineup.starters.map((id) => id && CAREER.squad.find((p) => p.id === id)).filter((p) => p && p.status === "ok" && p.group !== "G");
  document.getElementById("markingMyPlayers").innerHTML = myPool.length
    ? myPool.map((p) => markingSelRowHTML(p.id, p.name, SUBPOS_LABEL[subPositionOf(p)], p.id === MARKING_SELECTED_MINE)).join("")
    : `<p class="ct-empty">Defina a escalação titular na aba Tática antes de marcar alguém.</p>`;

  // Top 5 jogadores de linha do rival (goleiro não faz sentido marcar).
  const rivalPool = leagueSquadFor(opponentId).filter((p) => p.group !== "G").sort((a, b) => b.overall - a.overall).slice(0, 5);
  document.getElementById("markingRivalPlayers").innerHTML = rivalPool.length
    ? rivalPool.map((p) => markingSelRowHTML(p.id, p.name, `${SUBPOS_LABEL[subPositionOf(p)]} · overall ${p.overall}`, p.id === MARKING_SELECTED_RIVAL)).join("")
    : `<p class="ct-empty">Elenco do adversário ainda não disponível.</p>`;

  document.querySelectorAll("#markingMyPlayers [data-id]").forEach((el) => {
    el.addEventListener("click", () => { MARKING_SELECTED_MINE = el.dataset.id; renderManMarkingScreen(); });
  });
  document.querySelectorAll("#markingRivalPlayers [data-id]").forEach((el) => {
    el.addEventListener("click", () => { MARKING_SELECTED_RIVAL = el.dataset.id; renderManMarkingScreen(); });
  });
  btnApply.disabled = !(MARKING_SELECTED_MINE && MARKING_SELECTED_RIVAL);
}
function openManMarkingScreen() {
  const opponentId = nextOpponentId();
  const mm = CAREER.manMarking;
  MARKING_SELECTED_MINE = (mm && String(mm.opponentId) === String(opponentId)) ? mm.myPlayerId : null;
  MARKING_SELECTED_RIVAL = (mm && String(mm.opponentId) === String(opponentId)) ? mm.rivalPlayerId : null;
  renderManMarkingScreen();
  document.getElementById("markingOverlay").classList.add("open");
}
function closeManMarkingScreen() {
  document.getElementById("markingOverlay").classList.remove("open");
}
function applyManMarking() {
  const opponentId = nextOpponentId();
  if (!opponentId || !MARKING_SELECTED_MINE || !MARKING_SELECTED_RIVAL) return;
  CAREER.manMarking = { opponentId, myPlayerId: MARKING_SELECTED_MINE, rivalPlayerId: MARKING_SELECTED_RIVAL };
  persistCareer();
  renderManMarkingScreen();
  toast("Marcação individual definida pro próximo jogo.", { type: "pos" });
}
function removeManMarking() {
  CAREER.manMarking = null;
  MARKING_SELECTED_MINE = null;
  MARKING_SELECTED_RIVAL = null;
  persistCareer();
  renderManMarkingScreen();
}

/* ---------- Instruções por setor (Bloco 2, brtreinadorbloco2pendentes.html) ----------
   Camada de ajuste fino ADICIONAL sobre os 4 eixos gerais da Tática
   (ver SECTOR_INSTRUCTIONS/combinedSectorTacticMod, já somados dentro
   de combinedTacticMod desde a implementação dos eixos gerais). Aplica
   na hora (sem "Salvar" — mesmo espírito de Meus esquemas/Marcação
   individual), persistido a cada segmento clicado. */
let SECTOR_TAB = "defesa";
function renderSectorScreen(tab) {
  if (tab) SECTOR_TAB = tab;
  document.querySelectorAll("#sectorTabs .m3-sector-tab").forEach((el) => el.classList.toggle("on", el.dataset.sector === SECTOR_TAB));
  const list = SECTOR_INSTRUCTIONS[SECTOR_TAB];
  const values = CAREER.lineup.sectorTactics[SECTOR_TAB];
  document.getElementById("sectorInstrRows").innerHTML = list.map((instr) => tacticAxisRowHTML(instr, values[instr.id] || 3)).join("");
  document.querySelectorAll("#sectorInstrRows .m3-instr-row").forEach((row) => {
    row.querySelectorAll(".m3-seg").forEach((seg) => {
      seg.addEventListener("click", () => {
        const level = Number(seg.dataset.level);
        row.dataset.level = level;
        row.querySelectorAll(".m3-seg").forEach((s) => s.classList.toggle("on", Number(s.dataset.level) <= level));
        CAREER.lineup.sectorTactics[SECTOR_TAB][row.dataset.axis] = level;
        persistCareer();
      });
    });
  });
}
function openSectorScreen() {
  renderSectorScreen("defesa");
  document.getElementById("sectorOverlay").classList.add("open");
}
function closeSectorScreen() {
  document.getElementById("sectorOverlay").classList.remove("open");
}

/* ---------- Comissão Técnica (pedido do usuário: "ajudar nos treinos,
   escalação, táticas e outras opções pra garantir que sempre o melhor
   time estará em campo") ----------
   Assistente que SUGERE, o técnico decide (confirmado antes de
   implementar) — nunca aplica nada sozinho. Cobre as 4 áreas pedidas:
   Escalação, Treinos, Tática e Mercado. Cada sugestão é derivada de
   dado REAL do próprio save (condição do elenco, força do adversário,
   overall dos titulares, jogadores de verdade no mercado) — nunca um
   texto de enchimento. Custa salário mensal (ver technicalStaffMonthlyCost). */
function hireTechnicalStaff() {
  CAREER.technicalStaff.hired = true;
  persistCareer();
}
function fireTechnicalStaff() {
  CAREER.technicalStaff.hired = false;
  persistCareer();
}
// Escalação — reaproveita autoLineup (mesmo motor do botão "Escalar
// automaticamente") só pra COMPARAR contra a escalação atual, sem
// aplicar nada até o técnico confirmar. Respeita o mesmo toggle
// "incluir base" que a aba Tática já usa (lido do DOM se a tela
// estiver aberta; sem base por padrão, mesmo default do botão).
function suggestLineup() {
  const includeBase = document.getElementById("autoLineupIncludeBase")?.checked || false;
  const result = autoLineup(CAREER.squad, CAREER.lineup.formation, includeBase);
  const changedCount = result.starters.filter((id, i) => id !== CAREER.lineup.starters[i]).length;
  if (!changedCount) {
    return { text: "Sua escalação atual já é a melhor disponível pra esse esquema — nenhuma troca a sugerir.", canApply: false };
  }
  return {
    text: `${changedCount} posição${changedCount > 1 ? "ões" : ""} tem um titular disponível melhor pro esquema ${CAREER.lineup.formation}.`,
    canApply: true,
    apply: () => {
      CAREER.lineup.starters = result.starters;
      CAREER.lineup.bench = result.bench;
      markLineupDirty();
      persistCareer();
      renderPitch(); renderBench();
    },
  };
}
// Treinos — regra simples e honesta a partir de 2 dados reais (rodada
// atual, condição média do elenco principal): rodada 1 (toda
// temporada nova) recomenda construir base física; elenco desgastado
// recomenda recuperar; fora isso, o esquema equilibrado de sempre.
function suggestTraining() {
  const round = CAREER.currentRound;
  const principal = CAREER.squad.filter((p) => p.origin === "principal" || p.origin === "loan");
  const avgCond = avg(principal.map((p) => p.condition == null ? 100 : p.condition)) ?? 100;
  let schemeId;
  if (round === 1) schemeId = "pretemporada";
  else if (avgCond < 70) schemeId = "recuperacao";
  else schemeId = "equilibrio";
  const scheme = TRAINING_SCHEMES.find((s) => s.id === schemeId);
  if (CAREER.trainingSchemeId === schemeId) {
    return { text: `Já está no esquema recomendado (${scheme.name}) — condição média do elenco: ${Math.round(avgCond)}%.`, canApply: false };
  }
  return {
    text: `Esquema recomendado: ${scheme.name} — condição média do elenco: ${Math.round(avgCond)}%.`,
    canApply: true,
    apply: () => { applyTrainingScheme(schemeId); },
  };
}
// Tática — compara a força bruta do seu clube (atk/def do catálogo,
// mesma fórmula que o motor usa pra decidir o placar) contra o próximo
// adversário: favorito de verdade sugere postura mais ofensiva, azarão
// sugere mais cautela, parelho sugere manter o padrão neutro. Só mexe
// em ritmo/pressão/linha defensiva (estilo de passe fica de fora — não
// mapeia claramente pra "mais ofensivo/cauteloso").
function suggestTactics() {
  const opponentId = nextOpponentId();
  if (!opponentId) return { text: "Sem próximo jogo definido agora — volte quando houver um confronto marcado.", canApply: false };
  const myClub = teamById(CAREER.clubId);
  const opp = teamById(opponentId);
  const lambdaMine = myClub.atk / opp.def;
  const lambdaOpp = opp.atk / myClub.def;
  const ratio = lambdaMine / lambdaOpp;
  let targetLevel, label;
  if (ratio > 1.15) { targetLevel = 4; label = `postura mais OFENSIVA — seu time é favorito contra o ${opp.name}`; }
  else if (ratio < 0.87) { targetLevel = 2; label = `postura mais CAUTELOSA — o ${opp.name} é favorito nesse confronto`; }
  else { targetLevel = 3; label = `manter o padrão equilibrado — times parelhos contra o ${opp.name}`; }
  const axesToSet = ["ritmo", "pressao", "linhaDefensiva"];
  const t = CAREER.lineup.tactics;
  const alreadyThere = axesToSet.every((id) => (t[id] || 3) === targetLevel);
  if (alreadyThere) return { text: `Recomendação: ${label}. Sua tática já está ajustada assim.`, canApply: false };
  return {
    text: `Recomendação pro próximo jogo: ${label}.`,
    canApply: true,
    apply: () => {
      axesToSet.forEach((id) => { CAREER.lineup.tactics[id] = targetLevel; });
      markLineupDirty();
      persistCareer();
    },
  };
}
// Mercado — acha o titular mais fraco (menor overall) e procura, no
// mesmo catálogo que a aba Mercado usa (allMarketPlayers), o reforço
// MAIS BARATO da mesma posição que seja melhor E caiba no caixa atual.
// Sem sugestão nenhuma fora da janela de contratações (mesma trava que
// buyPlayer já respeita) ou sem reforço claro disponível.
function suggestMarket() {
  if (!transferWindowStatus(CAREER.currentRound).open) {
    return { text: "Janela de contratações fechada agora — sem sugestão de reforço.", canApply: false };
  }
  const starters = CAREER.lineup.starters.map((id) => id && CAREER.squad.find((p) => p.id === id)).filter(Boolean);
  if (!starters.length) return { text: "Defina a escalação titular na aba Tática antes.", canApply: false };
  const weakest = starters.slice().sort((a, b) => a.overall - b.overall)[0];
  const subpos = subPositionOf(weakest);
  const candidates = allMarketPlayers()
    .filter(({ p, mine }) => !mine && subPositionOf(p) === subpos && p.overall > weakest.overall && p.value <= CAREER.finances.cash)
    .sort((a, b) => a.p.value - b.p.value);
  if (!candidates.length) {
    return { text: `Nenhum reforço claramente melhor e dentro do caixa pra ${SUBPOS_LABEL[subpos]} agora (titular mais fraco na posição: ${weakest.name}, overall ${weakest.overall}).`, canApply: false };
  }
  const best = candidates[0];
  return {
    text: `${best.p.name} (${best.club.name}, overall ${best.p.overall}) por ${fmtBRL(best.p.value)} reforçaria ${SUBPOS_LABEL[subpos]} — seu titular mais fraco lá é ${weakest.name} (${weakest.overall}).`,
    canApply: true,
    // AJUSTE (pedido do usuário: "no Mercado deu certo mas precisa
    // funcionar também na Comissão Técnica") — Mercado não compra mais
    // na hora em lugar NENHUM do jogo (ver Bloco 3, openOfferModal/
    // confirmOfferFromModal): "aceitar" esta sugestão abre a MESMA
    // tela de proposta real, já com o jogador/clube certos, em vez de
    // fechar negócio direto (o antigo atalho instantâneo, buyPlayer,
    // foi removido — sem outro chamador depois desta mudança).
    apply: async () => { openOfferModal(best.club.id, best.p.id); },
  };
}
const COMMISSION_AREAS = [
  { id: "lineup", label: "Escalação", icon: "⚽", fn: suggestLineup },
  { id: "training", label: "Treinos", icon: "🏋️", fn: suggestTraining },
  { id: "tactics", label: "Tática", icon: "🧭", fn: suggestTactics },
  { id: "market", label: "Mercado", icon: "💰", fn: suggestMarket },
];
// Nova feature (pedido do usuário: "criar um card no início com o
// título comissão técnica e com os botões com as sugestões dadas por
// eles de maneira resumida") — versão condensada de
// commissionAreaCardHTML/renderCommissionScreen direto no Início:
// reaproveita os MESMOS COMMISSION_AREAS/textos/ação "Aplicar" da tela
// cheia (nenhuma sugestão nova, só um atalho pra não precisar abrir o
// Menu), num botão por área em vez de um cartão por área (a tela cheia
// continua existindo do jeito de sempre, pra quem preferir o contexto
// completo). Só aparece com a comissão contratada — chamada de dentro
// de renderCentral().
// AJUSTE (pedido do usuário: "coloca apenas os ícones nos botões... ao
// clicar entende-se que o técnico aceitou a sugestão. Cinco botões em
// uma linha" — confirmado que são os 4 de sempre, "cinco" foi engano
// na contagem) — botão vira só o ícone (texto completo da sugestão
// some do card, mas continua acessível via title/aria-label, pra não
// perder a informação de vez); clicar já É aceitar a sugestão, sem
// passo a mais. Um pontinho dourado (.has-suggestion) sinaliza "tem
// sugestão nova pra aceitar" sem precisar de texto nenhum — botão sem
// sugestão real (canApply:false) fica desabilitado, igual antes.
function renderCommissionSummaryCard() {
  const card = document.getElementById("commissionSummaryCard");
  const hired = CAREER.technicalStaff && CAREER.technicalStaff.hired;
  card.style.display = hired ? "" : "none";
  if (!hired) return;
  document.getElementById("commissionSummaryList").innerHTML = COMMISSION_AREAS.map((area) => {
    const s = area.fn();
    const title = `${area.label}: ${s.text}`;
    return `<button class="m3-commission-icon-btn ${s.canApply ? "has-suggestion" : ""}" data-apply="${area.id}"
        ${s.canApply ? "" : "disabled"} title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">${area.icon}</button>`;
  }).join("");
  document.getElementById("commissionSummaryList").querySelectorAll("[data-apply]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const area = COMMISSION_AREAS.find((a) => a.id === btn.dataset.apply);
      const s = area.fn();
      if (!s.canApply || !s.apply) return;
      // AJUSTE (pedido do usuário: "ao clicar na caixa de mensagem deve
      // informar qual foi a sugestão aceita") — s.text é lido ANTES de
      // aplicar (depois de aceita, a sugestão pode nem existir mais
      // pra essa área) e vai no corpo da mensagem, não só o nome da
      // área — o técnico sabe exatamente o que acabou de aceitar.
      const acceptedText = s.text;
      await s.apply();
      renderAll(); // já re-renderiza este card também (ver renderCentral)
      // AJUSTE (pedido do usuário: "no Mercado deu certo mas precisa
      // funcionar também na Comissão Técnica") — Mercado não aplica
      // nada na hora: s.apply() só ABRE a proposta real (ver
      // suggestMarket/openOfferModal), que já mostra o próprio toast
      // quando o técnico confirma o valor em confirmOfferFromModal.
      // Um toast de "aceita" aqui, antes de qualquer valor ser
      // confirmado, seria enganoso — só as outras 3 áreas realmente
      // aplicam de imediato e merecem esse aviso.
      if (area.id !== "market") {
        toast({ title: `Sugestão de ${area.label} aceita`, detail: acceptedText }, { type: "pos" });
      }
    });
  });
}
function commissionAreaCardHTML(area) {
  const s = area.fn();
  return `<div class="mt-card">
    <div class="mt-card-head"><div class="mt-card-title">${area.icon} ${escapeHtml(area.label)}</div></div>
    <p class="mt-info-line" style="border-bottom:none;">${escapeHtml(s.text)}</p>
    ${s.canApply ? `<button class="mt-btn-primary-gold" data-apply="${area.id}" style="width:100%; margin-top:8px;">Aplicar sugestão</button>` : ""}
  </div>`;
}
function renderCommissionScreen() {
  const hired = CAREER.technicalStaff.hired;
  document.getElementById("commissionHiredState").classList.toggle("hidden", !hired);
  document.getElementById("commissionNotHiredState").classList.toggle("hidden", hired);
  if (!hired) {
    document.getElementById("commissionCostEstimate").textContent = `${fmtBRL(technicalStaffMonthlyCost())}/mês`;
    return;
  }
  document.getElementById("commissionCostLabel").textContent = `Custo mensal: ${fmtBRL(technicalStaffMonthlyCost())} (pago junto da folha salarial, ${fmtBRL(Math.round(technicalStaffMonthlyCost() / 4))}/rodada)`;
  document.getElementById("commissionCards").innerHTML = COMMISSION_AREAS.map(commissionAreaCardHTML).join("");
  document.querySelectorAll("#commissionCards [data-apply]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const area = COMMISSION_AREAS.find((a) => a.id === btn.dataset.apply);
      const s = area.fn();
      if (s.apply) await s.apply();
      renderCommissionScreen();
      renderAll();
      // AJUSTE (pedido do usuário: "no Mercado deu certo mas precisa
      // funcionar também na Comissão Técnica") — mesmo motivo do card
      // resumido do Início (ver renderCommissionSummaryCard): Mercado
      // só ABRE a proposta real (openOfferModal), que mostra seu
      // próprio toast quando confirmada — nada foi "aplicado" ainda.
      if (area.id !== "market") toast(`Sugestão de ${area.label} aplicada.`, { type: "pos" });
    });
  });
}
function openCommissionScreen() {
  renderCommissionScreen();
  document.getElementById("commissionOverlay").classList.add("open");
}
function closeCommissionScreen() {
  document.getElementById("commissionOverlay").classList.remove("open");
}
async function confirmHireCommission() {
  const cost = technicalStaffMonthlyCost();
  if (!(await confirmModal(`Contratar a comissão técnica por ${fmtBRL(cost)}/mês?`, "Contratar"))) return;
  hireTechnicalStaff();
  renderCommissionScreen();
  // Nova feature — card resumido no Início (ver renderCommissionSummaryCard):
  // sem isso, o card só apareceria na próxima vez que ALGUMA OUTRA
  // ação já re-renderizasse a Central de verdade (switchToPanel não
  // re-renderiza sozinho, ver comentário lá) — contratar aqui e voltar
  // direto pro Início antes ficaria com o card escondido por engano.
  renderCommissionSummaryCard();
  toast("Comissão técnica contratada — as sugestões já estão disponíveis.", { type: "pos" });
}
async function confirmFireCommission() {
  if (!(await confirmModal("Demitir a comissão técnica? As sugestões deixam de aparecer.", "Demitir"))) return;
  fireTechnicalStaff();
  renderCommissionScreen();
  renderCommissionSummaryCard(); // mesmo motivo do hire acima
  toast("Comissão técnica demitida.", { type: "warn" });
}
// AJUSTE (refatoração completa, Tela 6 — ver 06-escalacao-restyled.html
// do designer) — campinho próprio (.mt-pitch*, NÃO reaproveita
// .button-pitch/.button-row/.button-disc de css/style.css, que são
// compartilhadas com o dashboard principal). Cada posição é clicável
// (abre o mesmo modal de escolha de jogador de sempre), mostra o
// rótulo da vaga, o OVR na mesma linguagem de cor do Elenco/Detalhe
// (ovrTierClass) e um flag de alerta quando o titular ali estiver
// indisponível — no lugar do "⚠️" solto no nome de antes.
function pitchPieceHTML(slot) {
  const id = CAREER.lineup.starters[slot.i];
  const p = id ? CAREER.squad.find((x) => x.id === id) : null;
  const problem = p && p.status !== "ok";
  const badgeCls = p ? ovrTierClass(p.overall) : "empty";
  const badgeContent = p ? p.overall : "+";
  const nameText = p ? lastNameOf(p.name) : "vazio";
  return `<div class="mt-pos-slot" data-index="${slot.i}" data-label="${escapeHtml(slot.label)}"
      title="${escapeHtml(slot.label)}${p ? " — " + escapeHtml(p.name) : ""}">
    <span class="role">${escapeHtml(slot.label)}</span>
    <div class="mt-pitch-badge ${problem ? "problem" : ""} ${badgeCls}">${badgeContent}${problem ? `<span class="mt-injury-flag"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 1 21h22L12 2zm0 6 6.5 11h-13L12 8z"/></svg></span>` : ""}</div>
    <span class="name">${escapeHtml(nameText)}</span>
  </div>`;
}
function renderPitch() {
  const slots = FORMATIONS[CAREER.lineup.formation].map(([grp, label], i) => ({ grp, label, i }));
  // Ataque em cima, goleiro embaixo — mesma orientação de sempre.
  const rows = ["F", "M", "D", "G"].map((g) => slots.filter((s) => s.grp === g)).filter((r) => r.length);
  document.getElementById("pitchLines").innerHTML = `
    <div class="mt-pitch">
      <div class="mt-pitch-line-top"></div>
      ${rows.map((row) => `<div class="mt-pitch-row${row[0].grp === "G" ? " gk" : ""}${row.length >= 5 ? " row-5" : ""}">${row.map((s) => pitchPieceHTML(s)).join("")}</div>`).join("")}
      <div class="mt-pitch-line-bottom"></div>
    </div>`;
  document.getElementById("pitchLines").querySelectorAll(".mt-pos-slot").forEach((el) => {
    el.addEventListener("click", () => openPicker({ type: "slot", index: Number(el.dataset.index) }, `Escolher — ${el.dataset.label}`));
  });
}
// AJUSTE (refatoração completa, Tela 6 — ver 06-escalacao-restyled.html
// do designer) — lista (.mt-bench-row) no lugar da tabela genérica
// .ct-table de antes, badge de OVR na mesma faixa de cor de sempre e
// chip de posição colorido (mesmo mapeamento gol/def/mei/ata do
// divisor de posição do Elenco, ver SUBPOS_DIVCLASS).
function renderBench() {
  // Mesma ordenação por posição do Elenco (ver squadSortKey) — só pra
  // exibição, não muda a ordem guardada em CAREER.lineup.bench (não
  // faz diferença nenhuma pra troca/auto-substituição, ver
  // autoFixLineup, que já procura por grupo em vez de depender de
  // posição no array). Até 11 reservas (era 7) — ver MAX_BENCH.
  const benchPlayers = CAREER.lineup.bench
    .map((id) => CAREER.squad.find((x) => x.id === id))
    .filter(Boolean)
    .sort((a, b) => squadSortKey(a) - squadSortKey(b));
  const rows = benchPlayers.map((p) => {
    const subpos = subPositionOf(p);
    return `<div class="mt-bench-row" data-id="${p.id}">
      <div class="mt-bench-ovr ${ovrTierClass(p.overall)}">${p.overall}</div>
      <div class="mt-bench-name">${escapeHtml(abbreviateName(p.name))}</div>
      <span class="mt-pos-chip ${SUBPOS_DIVCLASS[subpos]}">${subpos}</span>
    </div>`;
  }).join("");
  const canAdd = CAREER.lineup.bench.length < MAX_BENCH;
  const addRow = canAdd ? `<div class="mt-bench-row" id="benchAddRow" style="color:var(--mt-ink-faint); justify-content:center;">+ adicionar reserva</div>` : "";
  const emptyRow = (!benchPlayers.length && !canAdd) ? `<p class="ct-empty">Banco vazio.</p>` : "";
  document.getElementById("benchList").innerHTML = rows + addRow + emptyRow;
  document.getElementById("benchList").querySelectorAll(".mt-bench-row[data-id]").forEach((el) => {
    el.addEventListener("click", () => openPicker({ type: "bench", currentId: el.dataset.id }, "Trocar reserva"));
  });
  const addRowEl = document.getElementById("benchAddRow");
  if (addRowEl) addRowEl.addEventListener("click", () => openPicker({ type: "bench" }, "Adicionar reserva"));
}

/* ---------- AJUSTE (pedido do usuário: "ao clicar em simular rodada
   deve abrir em tela cheia a modal para que o treinador confirme a
   escalação do time e clique em ir para o jogo") ----------
   Passo novo ANTES de qualquer simulação rodar: mostra o adversário,
   avisa se a escalação está incompleta (mesmo aviso de sempre, ver
   renderCentral/lineupWarning) e lista os 11 titulares (posição, nome,
   overall — com destaque vermelho pra quem está indisponível ou pra
   vaga vazia). Reaproveita FORMATIONS (mesma fonte da Escalação, ver
   renderPitch) só que como lista simples em vez de campinho — mais
   rápido de ler numa tela de confirmação, sem precisar do campinho
   inteiro interativo de novo aqui. */
function preMatchStarterRowHTML(slot) {
  const id = CAREER.lineup.starters[slot.i];
  const p = id ? CAREER.squad.find((x) => x.id === id) : null;
  const problem = !p || p.status !== "ok";
  return `<div class="ct-prematch-row">
    <span class="pos">${escapeHtml(slot.label)}</span>
    <span class="nm${problem ? " problem" : ""}">${p ? escapeHtml(abbreviateName(p.name)) : "— vaga vazia —"}${problem && p ? " ⚠️" : ""}</span>
    <span class="ovr">${p ? p.overall : ""}</span>
  </div>`;
}
function renderPreMatchConfirm() {
  const round = CAREER.currentRound;
  document.getElementById("preMatchRound").textContent = round;
  const box = document.getElementById("preMatchOpponent");
  const fx = (CAREER.schedule[round] || []).find((m) => String(m.home) === String(CAREER.clubId) || String(m.away) === String(CAREER.clubId));
  if (fx) {
    const home = teamById(fx.home), away = teamById(fx.away);
    box.innerHTML = `
      <div class="side">${crestImg(home)}<span class="n">${escapeHtml(home.name)}</span></div>
      <span class="vs">×</span>
      <div class="side">${crestImg(away)}<span class="n">${escapeHtml(away.name)}</span></div>`;
  } else {
    box.innerHTML = `<p class="ct-empty">Sem jogo do seu time nessa rodada (folga) — pode simular direto.</p>`;
  }
  const filled = CAREER.lineup.starters.filter(Boolean).length;
  // AJUSTE (refatoração completa, Tela 12f) — #preMatchWarning virou
  // .mt-badge-alert (pílula), que precisa ficar .hidden quando vazio
  // (senão mostra uma pílula sem texto, ver o mesmo tratamento em
  // #marketWindowBanner, Tela 10).
  const warningEl = document.getElementById("preMatchWarning");
  warningEl.classList.toggle("hidden", filled >= 11);
  warningEl.textContent = filled < 11
    ? `⚠️ Escalação incompleta: ${filled}/11 titulares definidos — o time entra com força reduzida.`
    : "";
  document.getElementById("preMatchMeta").textContent = `Esquema ${CAREER.lineup.formation} · Banco: ${CAREER.lineup.bench.length} jogador(es)`;
  const slots = FORMATIONS[CAREER.lineup.formation].map(([grp, label], i) => ({ grp, label, i }));
  document.getElementById("preMatchLineup").innerHTML = slots.map(preMatchStarterRowHTML).join("");
}
function openPreMatchConfirm() {
  renderPreMatchConfirm();
  document.getElementById("preMatchOverlay").classList.add("open");
}
function closePreMatchConfirm() {
  document.getElementById("preMatchOverlay").classList.remove("open");
}
// AJUSTE (pedido do usuário: "o botão Ajustar Escalação deve abrir
// uma modal para que o cliente confirme a escalação com todas as
// opções que tem na tela e com o botão Ir para o jogo") — em vez de
// duplicar a seção #panel-escalacao inteira (campinho, banco, táticas
// — muitos ids e listeners) numa 2ª marcação só pra essa modal, move
// o MESMO nó do DOM pra dentro do corpo de #adjustLineupOverlay
// (#panel-escalacao guarda a posição original em
// #escalacaoPanelAnchor, ver carreira.html) — zero duplicação, os
// mesmos ids/render/wiring de sempre continuam funcionando idênticos.
// #preMatchOverlay fica aberta POR BAIXO (mesmo padrão de sub-modal
// usado no resto do app — ver renewOverlay/detailOverlay), não
// precisa reabrir a confirmação do zero ao fechar esta.
let ADJUST_LINEUP_WAS_ACTIVE = false;
function openAdjustLineupModal() {
  const panel = document.getElementById("panel-escalacao");
  ADJUST_LINEUP_WAS_ACTIVE = panel.classList.contains("active");
  panel.classList.add("active"); // .ct-panel só fica visível com essa classe (ver CSS)
  // O FAB "Salvar escalação e táticas" (era barra de ação full-width,
  // ver histórico deste comentário) não faz sentido aqui dentro — esta
  // modal já tem seu próprio rodapé fixo com "Ir para o jogo" (ver
  // .ct-modal-footer abaixo).
  panel.querySelector(".m3-fab").classList.add("hidden");
  document.getElementById("adjustLineupBody").appendChild(panel);
  renderEscalacao();
  document.getElementById("adjustLineupOverlay").classList.add("open");
}
function closeAdjustLineupModal() {
  const overlay = document.getElementById("adjustLineupOverlay");
  if (!overlay.classList.contains("open")) return; // já fechada, nada a devolver
  const panel = document.getElementById("panel-escalacao");
  const anchor = document.getElementById("escalacaoPanelAnchor");
  anchor.parentNode.insertBefore(panel, anchor);
  panel.classList.toggle("active", ADJUST_LINEUP_WAS_ACTIVE);
  panel.querySelector(".m3-fab").classList.remove("hidden");
  overlay.classList.remove("open");
  // A confirmação de escalação continua aberta por baixo — atualiza
  // com qualquer mudança feita aqui (formação/titulares/banco/táticas).
  if (document.getElementById("preMatchOverlay").classList.contains("open")) renderPreMatchConfirm();
}
// Fluxo de "Simular rodada" (pedido do usuário): confirmar escalação
// em tela cheia (ver openPreMatchConfirm) -> "Ir para o jogo" -> modal
// com o jogo do clube (resultado/gols/assistências/cartões) ->
// "Continuar" -> modal com o resultado da rodada inteira (+ trocas
// forçadas de escalação, se houve) -> "Continuar" -> aba Tabela já
// atualizada. Ver showMatchDetailModal/showRoundResultsModal. AJUSTE
// (pedido do usuário: "Ajustar Escalação deve abrir uma modal ... com
// o botão Ir para o jogo") — extraída do clique único de "Ir para o
// jogo" em #preMatchOverlay (única cópia antes) pra também ser usada
// pelo "Ir para o jogo" de #adjustLineupOverlay (ver wireStaticListeners)
// — fecha as duas modais (a que estiver aberta) e dispara a simulação
// de sempre. commitLineupTactics() garante que táticas mudadas sem
// clicar em "Salvar escalação e táticas" não se percam.
async function goToMatch() {
  closePreMatchConfirm();
  closeAdjustLineupModal();
  commitLineupTactics();
  // AJUSTE (pedido do usuário: "vamos evoluir o método de treinos") —
  // rede de segurança: se o treinador nunca abriu a tela de Treinos
  // (ou abriu mas não clicou "Aplicar") pra essa rodada, a semana
  // configurada é aplicada aqui sozinha — idempotente (applyWeeklyTraining
  // não faz nada se já tiver sido aplicada), mesmo espírito de
  // commitLineupTactics logo acima (tática mudada sem salvar não pode
  // se perder em silêncio).
  applyWeeklyTraining();
  const btn = document.getElementById("btnSimulate");
  btn.disabled = true;
  const summary = simulateRound();
  // FASE 3 (itens 1 e 2) — existindo jogo seu na rodada, simulateRound()
  // já abriu a tela Ao Vivo e devolve o sentinela "live" — o resto do
  // fluxo (persistir/renderizar/mostrar os modais de sempre) roda
  // sozinho quando a partida termina, ver finishLiveMatch. Só reabilita
  // o botão se o fluxo antigo (sem jogo seu, ver resolveRoundInstant)
  // rodou de verdade.
  if (summary === "live") return;
  const saved = await persistCareer();
  // Se não deu pra salvar (ex.: sessão expirada — ver persistCareer),
  // não mostra o modal do jogo por cima da tela de login: ela já foi
  // trocada lá dentro, e ao logar de novo o save do servidor (sem essa
  // rodada) é recarregado mesmo.
  if (!saved) { btn.disabled = false; return; }
  renderAll();
  if (summary) showMatchDetailModal(summary);
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
  const currentId = PICKER_CTX.type === "slot" ? CAREER.lineup.starters[PICKER_CTX.index]
    : PICKER_CTX.type === "training" ? (CAREER.trainingPlan[PICKER_CTX.day].individualPlayerId || null)
    : (PICKER_CTX.currentId || null);
  // Treino individual (ver trainingTargets/seção 2.3 do briefing) é a
  // ÚNICA exceção ao filtro de "só quem pode jogar" do resto do picker
  // — o treinador pode de propósito escolher um jogador lesionado ou
  // suspenso pra focar a recuperação/reintegração dele.
  let pool = PICKER_CTX.type === "training" ? CAREER.squad.slice() : CAREER.squad.filter((p) => p.status === "ok");
  const f = filter.trim().toLowerCase();
  if (f) pool = pool.filter((p) => p.name.toLowerCase().includes(f));
  pool.sort((a, b) => squadSortKey(a) - squadSortKey(b));
  const showClear = PICKER_CTX.type === "slot" || (PICKER_CTX.type === "bench" && PICKER_CTX.currentId) || (PICKER_CTX.type === "training" && currentId);
  // AJUSTE (refatoração completa, Tela 7 — ver 07-trocar-jogador-
  // restyled.html do designer) — .mt-sel-row no lugar de .ct-pick-row:
  // chip de posição colorido (mesmo mapeamento do banco, Tela 6), OVR
  // em destaque dourado pra quem já é "elite" (>=80, mesmo limiar de
  // ovrTierClass) e tag de origem (principal/base/emprestado) como
  // pílula, não mais texto solto.
  const clearRow = showClear ? `<div class="mt-empty-option" data-clear="1">— deixar vazio —</div>` : "";
  const list = document.getElementById("pickerList");
  list.innerHTML = clearRow + (pool.length ? pool.map((p) => {
    const loc = PICKER_CTX.type === "training" || p.id === currentId ? null : locateInLineup(p.id);
    // Tag do lugar onde já está — escolher alguém marcado "titular" ou
    // "banco" faz a troca (ver pickerChoose), não só remove ele de lá.
    // No treino individual, a tag vira o status físico (lesão/suspensão)
    // já que esse jogador foi incluído de propósito, não escondido.
    const tag = p.id === currentId ? " (atual)" : loc && loc.kind === "starter" ? " (titular)" : loc && loc.kind === "bench" ? " (banco)"
      : PICKER_CTX.type === "training" && p.status === "contundido" ? " (lesionado)" : PICKER_CTX.type === "training" && p.status === "suspenso" ? " (suspenso)" : "";
    const subpos = subPositionOf(p);
    const srcClass = p.origin === "base" ? "base" : p.origin === "loan" ? "loan" : "principal";
    const srcLabel = p.origin === "base" ? "base" : p.origin === "loan" ? "emprestado" : "principal";
    return `<div class="mt-sel-row" data-id="${p.id}">
      <span class="mt-pos-chip ${SUBPOS_DIVCLASS[subpos]}">${subpos}</span>
      <div class="mt-sel-name">${escapeHtml(abbreviateName(p.name))}<span class="status">${tag}</span></div>
      <div class="mt-sel-meta"><span class="mt-sel-ovr${p.overall >= 80 ? " gold" : ""}">${p.overall}</span><span class="mt-sel-src ${srcClass}">${srcLabel}</span></div>
    </div>`;
  }).join("") : `<p class="ct-empty">Nenhum jogador disponível.</p>`);
  list.querySelectorAll("[data-clear]").forEach((el) => el.addEventListener("click", () => pickerChoose(null)));
  list.querySelectorAll("[data-id]").forEach((el) => el.addEventListener("click", () => pickerChoose(el.dataset.id)));
}
function pickerChoose(playerId) {
  // Treino individual não mexe em escalação nenhuma — só grava quem é
  // o alvo daquele dia do plano semanal (ver trainingTargets).
  if (PICKER_CTX.type === "training") {
    CAREER.trainingPlan[PICKER_CTX.day].individualPlayerId = playerId || null;
    document.getElementById("pickerOverlay").classList.remove("open");
    persistCareer();
    renderTreinos();
    return;
  }
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
  markLineupDirty();
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
// AJUSTE (refatoração completa, Tela 8 — ver 08-tabela-restyled.html do
// designer) — lista flex (.mt-tr) no lugar de <table>; bolinha de zona
// (.mt-zone-dot) em TODA linha agora, não só campeão/libertadores/
// rebaixamento — as faixas "sula"/sem zona também ganham cor (pre/
// safe), preenchendo visualmente o meio da tabela como no mockup, sem
// mudar os LIMIARES de zona (mesma lógica de sempre, só a cor mudou).
// AJUSTE (pedido do usuário: "reinicie o tema do rebaixamento") —
// `standings`/`compId` agora são parâmetros opcionais (era sempre
// CAREER.standings/CURRENT_COMPETITION_ID) pra dar pra ver a tabela das
// OUTRAS 2 divisões também (ver renderTabelaPanel) sem duplicar essa
// função. Zona de topo/rebaixamento vira "acesso"/"rebaixamento" (sem
// G6/G12 Libertadores, que só existe na Série A) quando compId não é
// a Série A.
function renderTabela(containerId = "standingsTable", standings = CAREER.standings, compId = CURRENT_COMPETITION_ID) {
  const rows = Object.values(standings).sort((a, b) => (b.pts - a.pts) || (b.v - a.v) || (b.sg - a.sg) || (b.gp - a.gp));
  const total = rows.length;
  const isSerieA = compId === "brasileirao";
  const body = rows.map((r, i) => {
    const t = teamById(r.id);
    const pos = i + 1;
    const zone = isSerieA
      ? (pos === 1 ? "campeao" : pos <= 6 ? "libertadores" : pos <= 12 ? "sula" : pos > total - RELEGATION_N ? "reb" : "")
      : (pos === 1 ? "campeao" : pos <= RELEGATION_N ? "acesso" : pos > total - RELEGATION_N ? "reb" : "");
    const dotClass = zone === "campeao" || zone === "libertadores" || zone === "acesso" ? "libertadores" : zone === "sula" ? "pre" : zone === "reb" ? "rebaixamento" : "safe";
    const isMe = String(r.id) === String(CAREER.clubId);
    return `<div class="mt-tr${isMe ? " highlight" : ""}">
      <div class="mt-pos-num"><span class="mt-zone-dot ${dotClass}"></span>${pos}</div>
      <div class="mt-team-cell">${crestImg(t, 20)}<div class="name">${escapeHtml(t.name)}</div></div>
      <div class="mt-stat-col">${r.pts}</div><div class="mt-stat-col">${r.j}</div><div class="mt-stat-col">${r.v}</div><div class="mt-stat-col">${r.e}</div><div class="mt-stat-col">${r.d}</div><div class="mt-stat-col">${r.sg > 0 ? "+" : ""}${r.sg}</div>
    </div>`;
  }).join("");
  document.getElementById(containerId).innerHTML = body;
  if (containerId === "standingsTable") {
    const legendTop = document.getElementById("tabelaLegendTop");
    const legendMidWrap = document.getElementById("tabelaLegendMidWrap");
    if (legendTop) legendTop.textContent = isSerieA ? "Libertadores" : "Acesso";
    if (legendMidWrap) legendMidWrap.hidden = !isSerieA;
  }
}
// Estado só de UI (não é salvo) — qual divisão a aba Tabela está
// mostrando agora (null = a sua própria).
let TABELA_VIEW_DIVISION = null;
// Painel "Tabela" — mostra o seletor de divisão (ver
// #tabelaDivisionSwitch em carreira.html) só em carreira com o sistema
// de acesso/rebaixamento ativado (CAREER.otherDivisions, ver
// initDivisionSystem); sem ele, comportamento idêntico a antes desta
// mudança (só a própria divisão, sem seletor nenhum).
function renderTabelaPanel() {
  wireTabelaDivisionSwitch();
  const compId = (CAREER.otherDivisions && TABELA_VIEW_DIVISION) || CURRENT_COMPETITION_ID;
  renderTabela("standingsTable", divisionStandingsFor(compId), compId);
}
function wireTabelaDivisionSwitch() {
  const wrap = document.getElementById("tabelaDivisionSwitch");
  if (!wrap) return;
  if (!CAREER.otherDivisions) { wrap.hidden = true; return; }
  wrap.hidden = false;
  const current = TABELA_VIEW_DIVISION || CURRENT_COMPETITION_ID;
  wrap.querySelectorAll("[data-division]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.division === current);
    btn.onclick = () => { TABELA_VIEW_DIVISION = btn.dataset.division; renderTabelaPanel(); };
  });
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
function kpiHTML(label, value, variant, block) {
  // variant: "gold" (destaque de marca) ou "red" (alerta — ex.: folha
  // salarial estourando o teto). AJUSTE (redesign, Tela 3) —
  // .mt-stat-block no lugar de .ct-kpi (ver 03-central-restyled.html
  // do designer); usado por toda tela que monta KPI numérico
  // (Central, Estatísticas), reestilizando as duas de uma vez.
  // "block" (opcional): "fin" usa o bloco largo .mt-fin-block, próprio
  // do card "Financeiro" (só 2 valores, lado a lado, mais largos que o
  // grid 2×2 de "Situação do elenco") — default continua .mt-stat-block.
  // Redesign M3 — "m3" usa .m3-stat-card (ver Início/renderCentral),
  // reaproveitando a MESMA função em vez de duplicar o layout de KPI
  // uma 3ª vez; "gold" vira .m3-stat-card.gold, "red" (alerta, já usado
  // pra moral baixa/folha salarial estourada) vira .m3-stat-card.alert.
  if (block === "m3") {
    const mod = variant === "gold" ? " gold" : variant === "red" ? " alert" : "";
    return `<div class="m3-stat-card${mod}"><div class="m3-stat-num">${value}</div><div class="m3-stat-name">${label}</div></div>`;
  }
  const cls = block === "fin" ? "mt-fin-block" : "mt-stat-block";
  return `<div class="${cls}"><div class="num${variant ? ` ${variant}` : ""}">${value}</div><div class="lbl">${label}</div></div>`;
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

  // AJUSTE (refatoração completa, Tela 9 — ver 09-estatisticas-restyled.html
  // do designer) — .mt-mini-row no lugar de <tr> nas 3 mini-tabelas
  // (cabeçalho fixo já vem do HTML, ver panel-estatisticas).
  const topPlayers = CAREER.squad.slice()
    .filter((p) => (p.goalsCareer || 0) > 0 || (p.assistsCareer || 0) > 0)
    .sort((a, b) => (b.goalsCareer || 0) - (a.goalsCareer || 0) || (b.assistsCareer || 0) - (a.assistsCareer || 0))
    .slice(0, 10);
  const teamTopRows = topPlayers.map((p) => `<div class="mt-mini-row">
    <div class="mt-mini-col name">${escapeHtml(abbreviateName(p.name))}</div><div class="mt-mini-col">${subPositionOf(p)}</div>
    <div class="mt-mini-col">${p.goalsCareer || 0}</div><div class="mt-mini-col">${p.assistsCareer || 0}</div>
  </div>`).join("");
  document.getElementById("teamTopPlayersTable").innerHTML =
    teamTopRows || `<p class="ct-empty">Ninguém marcou gol ou deu assistência ainda.</p>`;

  // FASE 2 (a) — pedido do usuário: "estatísticas reais de todos os
  // times". Artilheiros/garçons da LIGA INTEIRA (seu elenco +
  // CAREER.leagueSquads dos outros 19 — ver buildLeagueSquads),
  // possível agora que todo clube tem elenco individual de verdade.
  //
  // AJUSTE (pedido do usuário: "o mercado deve trazer jogadores das 3
  // ligas") — numa carreira "multi", CAREER.leagueSquads passa a ter
  // elenco de OUTRAS 2 divisões também (ver buildLeagueSquads em
  // startCareer) — mas "a liga" aqui é sempre a competição/tabela da
  // PRÓPRIA carreira, não as 3 juntas. Filtrado por CAREER.standings
  // (só tem as chaves dos 20 times da própria divisão, sempre — ver
  // startCareer/generateAllRounds) pra nunca misturar artilheiro de
  // outra série nesse ranking, mesmo com o mercado agora cobrindo as
  // 3.
  const allLeaguePlayers = [
    ...CAREER.squad.map((p) => ({ p, teamId: CAREER.clubId })),
    ...Object.entries(CAREER.leagueSquads || {})
      .filter(([teamId]) => Object.prototype.hasOwnProperty.call(CAREER.standings, teamId))
      .flatMap(([teamId, squad]) => squad.map((p) => ({ p, teamId }))),
  ];
  const topLeague = allLeaguePlayers
    .filter(({ p }) => (p.goalsCareer || 0) > 0 || (p.assistsCareer || 0) > 0)
    .sort((a, b) => (b.p.goalsCareer || 0) - (a.p.goalsCareer || 0) || (b.p.assistsCareer || 0) - (a.p.assistsCareer || 0))
    .slice(0, 15);
  const leagueTopRows = topLeague.map(({ p, teamId }) => {
    const t = teamById(teamId);
    return `<div class="mt-mini-row">
      <div class="mt-mini-col name">${escapeHtml(abbreviateName(p.name))}</div><div class="mt-mini-col">${escapeHtml(t.short || t.name)}</div>
      <div class="mt-mini-col">${p.goalsCareer || 0}</div><div class="mt-mini-col">${p.assistsCareer || 0}</div>
    </div>`;
  }).join("");
  document.getElementById("leagueTopScorersTable").innerHTML =
    leagueTopRows || `<p class="ct-empty">Ninguém marcou gol ou deu assistência ainda.</p>`;

  // Times da competição — ranking por gols/cartões usando os dados já
  // reais de CAREER.standings (isso já vinha da API antes da Fase 2,
  // só não tinha uma tabela dedicada mostrando os 20 times).
  const teamRows = sorted.map((r) => {
    const t = teamById(r.id);
    const aprov = r.j ? Math.round((r.pts / (r.j * 3)) * 100) : 0;
    return `<div class="mt-mini-row${String(r.id) === String(CAREER.clubId) ? " highlight" : ""}">
      <div class="mt-mini-col name">${escapeHtml(t.short || t.name)}</div><div class="mt-mini-col">${r.j}</div>
      <div class="mt-mini-col">${r.gp}</div><div class="mt-mini-col">${r.gc}</div><div class="mt-mini-col">${r.sg}</div><div class="mt-mini-col">${aprov}%</div>
    </div>`;
  }).join("");
  document.getElementById("leagueTeamStatsTable").innerHTML = teamRows;
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
// AJUSTE (pedido do usuário: "trocar os botões com texto Comprar,
// Vender, Pegar Emprestado por três botões com um ícone que mostre
// entrada, saída e empréstimo") — ícone substitui o texto nos botões
// de ação de cada linha do Mercado; "entrada" (comprar) e "saída"
// (vender) reaproveitam o mesmo desenho de porta+seta já usado no
// botão "Sair" do app (mt-icon-btn), só espelhado pra "entrada";
// "empréstimo" reaproveita o ícone de troca já usado em "Substituir"
// (Ao Vivo, Tela 13b) e no marcador de substituição da linha do tempo.
const MARKET_ICON = {
  entrada: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`,
  saida: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  emprestimo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
  // Nova feature (Bloco 3) — indica proposta em andamento pra esse
  // jogador (ver openOfferModal/pendingOfferOutFor), no lugar do ícone
  // de "entrada" enquanto a negociação não fecha.
  pendente: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/></svg>`,
};

/* ---------- Bloco 3 (1/4) — Mercado: negociação de compra (pedido do
   usuário, mockups brtreinadorbloco3mercado.html/
   brtreinadorbloco3pendentes.html) ----------
   Antes, "Comprar" pagava o valor de mercado à vista e fechava na hora
   (ver buyPlayer — inicialmente mantida intacta só pra sugestão de
   Mercado da Comissão Técnica continuar instantânea, mas depois
   removida: pedido do usuário, "no Mercado deu certo mas precisa
   funcionar também na Comissão Técnica" — aceitar a sugestão agora
   abre a MESMA proposta real, ver suggestMarket/openOfferModal, sem
   atalho de compra instantânea em lugar nenhum do jogo). O botão
   "Comprar" do Mercado abre uma PROPOSTA (CAREER.pendingOffersOut):
   valor editável (pode ser menor que o de mercado) + parcelamento da
   taxa, e o clube vendedor demora OFFER_WAIT_ROUNDS rodadas pra
   responder (ver resolvePendingOffersOutRound, chamada em
   finishRoundTail a cada rodada simulada — roda mesmo fora da janela
   de contratações, já que a proposta foi enviada legitimamente dentro
   dela). Chance de aceite cresce com o quanto a proposta chega perto
   do valor de mercado; abaixo de 60% dele o clube nem considera.
   Contraproposta (o clube pede mais) fica esperando o técnico decidir
   (aceitar o valor pedido ou retirar), sem prazo — não conta como
   "esperando resposta" de novo. */
const OFFER_WAIT_ROUNDS = 2; // rodadas até o clube vendedor responder
let OFFER_CTX = null; // { clubId, playerId } enquanto o sheet de nova proposta está aberto
function pendingOfferOutFor(playerId) {
  return (CAREER.pendingOffersOut || []).find((o) => String(o.playerId) === String(playerId));
}
function openOfferModal(clubId, playerId) {
  if (!transferWindowStatus(CAREER.currentRound).open) {
    toast("Janela de contratações encerrada — não dá pra propor agora.", { type: "warn" });
    return;
  }
  if (pendingOfferOutFor(playerId)) { openMyOffersScreen(); return; } // já tem negociação rolando por esse jogador
  const p = leagueSquadFor(clubId).find((x) => x.id === playerId);
  if (!p) return;
  OFFER_CTX = { clubId: String(clubId), playerId };
  document.getElementById("offerSub").textContent = `${abbreviateName(p.name)} · ${teamById(clubId).name} · valor de mercado ${fmtBRL(p.value)}`;
  document.getElementById("offerValueInput").value = p.value;
  document.getElementById("offerInstallmentsSelect").value = "1";
  document.getElementById("offerOverlay").classList.add("open");
}
function closeOfferModal() {
  document.getElementById("offerOverlay").classList.remove("open");
  OFFER_CTX = null;
}
function confirmOfferFromModal() {
  if (!OFFER_CTX) return;
  const p = leagueSquadFor(OFFER_CTX.clubId).find((x) => x.id === OFFER_CTX.playerId);
  if (!p) { closeOfferModal(); toast("Esse jogador não está mais disponível.", { type: "warn" }); return; }
  const value = Math.max(1000, Math.round(Number(document.getElementById("offerValueInput").value) || 0));
  const installments = Number(document.getElementById("offerInstallmentsSelect").value) || 1;
  if (wageBillOf(CAREER.squad) + p.wage > CAREER.finances.wageCap) {
    toast(`Contratar esse jogador estouraria o teto salarial (${fmtBRL(CAREER.finances.wageCap)}).`, { type: "warn" });
    return;
  }
  if (CAREER.squad.length >= MAX_PRINCIPAL + 20) { toast("Elenco já está muito grande — dispense ou venda alguém antes.", { type: "warn" }); return; }
  const clubName = teamById(OFFER_CTX.clubId).name;
  CAREER.pendingOffersOut = CAREER.pendingOffersOut || [];
  CAREER.pendingOffersOut.push({
    id: `offerout_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    playerId: p.id, playerName: p.name, clubId: OFFER_CTX.clubId, clubName,
    marketValue: p.value, offerValue: value, installments,
    roundsLeft: OFFER_WAIT_ROUNDS, status: "pending", counterValue: null,
    submittedRound: CAREER.currentRound,
  });
  closeOfferModal();
  persistCareer();
  renderMercado();
  toast(`Proposta de ${fmtBRL(value)} por ${abbreviateName(p.name)} enviada ao ${clubName} — aguardando resposta.`, { type: "info" });
}
// Aumenta o valor de uma proposta pendente OU aceita o valor que o
// clube pediu numa contraproposta (mesmo campo, offerValue) — os dois
// casos reiniciam a espera normal (ver roundsLeft), exceto aceitar
// contraproposta, que fecha na hora (ver acceptCounterOffer).
function increaseOffer(offerId, newValue) {
  const o = (CAREER.pendingOffersOut || []).find((x) => x.id === offerId);
  if (!o) return;
  const value = Math.max(o.offerValue, Math.round(Number(newValue) || 0));
  o.offerValue = value;
  o.status = "pending";
  o.counterValue = null;
  o.roundsLeft = OFFER_WAIT_ROUNDS;
  persistCareer();
  renderMyOffersScreen();
  toast(`Proposta por ${abbreviateName(o.playerName)} atualizada pra ${fmtBRL(value)}.`, { type: "pos" });
}
function withdrawOffer(offerId) {
  const o = (CAREER.pendingOffersOut || []).find((x) => x.id === offerId);
  if (!o) return;
  CAREER.pendingOffersOut = (CAREER.pendingOffersOut || []).filter((x) => x.id !== offerId);
  pushTransferLog(`Você retirou sua proposta por ${o.playerName} (${o.clubName}).`, CAREER.currentRound);
  persistCareer();
  renderMyOffersScreen();
  renderMercado();
  toast(`Proposta por ${abbreviateName(o.playerName)} retirada.`, { type: "info" });
}
// Aceitar a contraproposta do clube (ele pediu counterValue) fecha o
// negócio NA HORA — o técnico já concordou em pagar o que foi pedido,
// não faz sentido esperar de novo (ver resolvePendingOffersOutRound,
// que só gera contraproposta, nunca a resolve sozinha).
function acceptCounterOffer(offerId) {
  const o = (CAREER.pendingOffersOut || []).find((x) => x.id === offerId);
  if (!o || o.counterValue == null) return;
  o.offerValue = o.counterValue;
  o.counterValue = null;
  finalizeIncomingPurchase(o);
  CAREER.pendingOffersOut = (CAREER.pendingOffersOut || []).filter((x) => x.id !== offerId);
  persistCareer();
  renderMyOffersScreen();
  renderMercado(); renderElenco(); renderCentral();
}
// Fecha a compra de verdade (proposta aceita ou contraproposta
// aceita) — reaproveita a MESMA validação de teto/tamanho de elenco de
// buyPlayer (pode ter mudado desde que a proposta foi enviada, dias
// atrás) e o mesmo parcelamento de patrocínio/empréstimo de sempre
// (paga a 1ª parcela na hora, o resto entra em CAREER.pendingInstallments,
// processado a cada rodada em processPendingInstallments).
function finalizeIncomingPurchase(o) {
  const squad = leagueSquadFor(o.clubId);
  const idx = squad.findIndex((x) => String(x.id) === String(o.playerId));
  if (idx < 0) {
    toast(`${abbreviateName(o.playerName)} não está mais disponível — negociação cancelada.`, { type: "warn" });
    return;
  }
  const p = squad[idx];
  if (wageBillOf(CAREER.squad) + p.wage > CAREER.finances.wageCap) {
    toast(`${o.clubName} aceitou, mas contratar ${abbreviateName(p.name)} agora estouraria seu teto salarial — negociação cancelada.`, { type: "warn" });
    return;
  }
  if (CAREER.squad.length >= MAX_PRINCIPAL + 20) {
    toast(`${o.clubName} aceitou, mas seu elenco está grande demais agora — negociação cancelada.`, { type: "warn" });
    return;
  }
  const perInstallment = Math.round(o.offerValue / o.installments / 1000) * 1000;
  const firstPayment = o.installments === 1 ? o.offerValue : perInstallment;
  if (CAREER.finances.cash < firstPayment) {
    toast(`${o.clubName} aceitou, mas seu caixa não cobre nem a 1ª parcela agora — negociação cancelada.`, { type: "warn" });
    return;
  }
  squad.splice(idx, 1);
  CAREER.finances.cash -= firstPayment;
  if (o.installments > 1) {
    CAREER.pendingInstallments = CAREER.pendingInstallments || [];
    CAREER.pendingInstallments.push({ roundsLeft: o.installments - 1, perRoundAmount: perInstallment, label: `Parcela de ${p.name}` });
  }
  p.origin = "principal";
  CAREER.squad.push(p);
  pushTransferLog(`Você contratou ${p.name} do ${o.clubName} por ${fmtBRL(o.offerValue)}${o.installments > 1 ? ` (${o.installments}x)` : ""}.`, CAREER.currentRound);
  toast(`${abbreviateName(p.name)} contratado! O ${o.clubName} aceitou sua proposta.`, { type: "pos" });
  ensureObjectivesFresh(); bumpObjective("daily", "obj_market_1_move", 1);
  if (p.overall >= 82) { firePressConference("15", CAREER.currentRound, false); openPressConferenceModal(); }
}
/* ---------- Bloco 3 (2/4) — concorrência real por um alvo (pedido do
   usuário, mockup brtreinadorbloco3pendentes.html, "Comparar
   propostas") ----------
   Enquanto sua proposta espera resposta, um clube CPU pode também se
   interessar pelo MESMO jogador (ver maybeSpawnRivalOffer, chamada a
   cada rodada por resolvePendingOffersOutRound antes de decrementar o
   prazo) — vira o.rivalOffer, visível em "Minhas propostas" (botão
   "Comparar propostas", ver myOffersRowHTML/openOfferCompareScreen).
   Só nasce UMA vez por proposta (nunca escala depois de aparecer —
   decisão nossa: dá tensão real sem virar leilão infinito) e nunca
   enquanto a proposta está "countered" (o clube já está negociando
   direto com você nesse estado, sem espaço pra um 3º interessado). */
const RIVAL_OFFER_CHANCE_PER_ROUND = 0.35;
function maybeSpawnRivalOffer(o) {
  if (o.rivalOffer || o.status !== "pending") return;
  if (Math.random() >= RIVAL_OFFER_CHANCE_PER_ROUND) return;
  const pool = marketTeamsPool().filter((t) => String(t.id) !== String(o.clubId) && String(t.id) !== String(CAREER.clubId));
  if (!pool.length) return;
  const rivalClub = pool[Math.floor(Math.random() * pool.length)];
  const factor = 0.75 + Math.random() * 0.4; // proposta rival entre 75% e 115% do valor de mercado
  const rivalValue = Math.max(1000, Math.round((o.marketValue * factor) / 1000) * 1000);
  const rivalInstallments = Math.random() < 0.7 ? 1 : 2; // clube CPU quase sempre paga à vista
  o.rivalOffer = { clubId: String(rivalClub.id), clubName: rivalClub.name, offerValue: rivalValue, installments: rivalInstallments };
  toast({ title: "Concorrência pelo alvo", detail: `${rivalClub.name} também quer ${abbreviateName(o.playerName)} — compare as propostas.` }, { type: "warn" });
}
// "Peso" de uma proposta pra quem vende: parcelar desconta um pouco
// (recebe mais devagar) — mesmo raciocínio usado em qualquer venda a
// prazo, sem inventar juros nenhum, só uma penalidade leve por parcela
// extra. Usado pra decidir quem "ganha" quando há concorrência.
function offerEffectiveValue(offerValue, installments) {
  return offerValue * (1 - 0.03 * (installments - 1));
}
// Roda 1x por rodada simulada (ver finishRoundTail) — decrementa o
// prazo de cada proposta pendente e resolve quem chegou a zero. Com
// concorrente (ver rivalOffer acima), o clube compara as 2 propostas
// (offerEffectiveValue) — a de maior peso tem 80% de chance de vencer,
// a menor só 25% (chance de zebra, sem ser garantido nem impossível).
// Sem concorrente, vale a regra de sempre: quanto mais perto do valor
// de mercado, maior a chance de aceite; abaixo de 60% dele o clube nem
// considera (recusa direto); no meio-termo, contraproposta em vez de
// recusar de vez (vira um item parado esperando o técnico decidir, ver
// acceptCounterOffer/withdrawOffer, sem consumir mais rodadas).
function resolvePendingOffersOutRound(round) {
  const list = CAREER.pendingOffersOut || [];
  const stillPending = [];
  list.forEach((o) => {
    if (o.status === "countered") { stillPending.push(o); return; } // esperando o técnico decidir, sem prazo
    maybeSpawnRivalOffer(o);
    o.roundsLeft -= 1;
    if (o.roundsLeft > 0) { stillPending.push(o); return; }
    if (o.rivalOffer) {
      const mine = offerEffectiveValue(o.offerValue, o.installments);
      const rival = offerEffectiveValue(o.rivalOffer.offerValue, o.rivalOffer.installments);
      const winChance = mine >= rival ? 0.8 : 0.25;
      if (Math.random() < winChance) { finalizeIncomingPurchase(o); return; }
      toast(`${o.clubName} vendeu ${abbreviateName(o.playerName)} pro ${o.rivalOffer.clubName} — a proposta concorrente venceu.`, { type: "warn" });
      pushTransferLog(`${o.rivalOffer.clubName} venceu a disputa por ${o.playerName} (sua proposta era de ${fmtBRL(o.offerValue)}).`, round);
      return;
    }
    const ratio = o.offerValue / o.marketValue;
    const rng = Math.random();
    if (ratio >= 0.95 && rng < 0.85) { finalizeIncomingPurchase(o); return; }
    if (ratio >= 0.8 && rng < 0.45) { finalizeIncomingPurchase(o); return; }
    if (ratio >= 0.6 && rng < 0.5) {
      o.counterValue = Math.min(o.marketValue, Math.round((o.offerValue + o.marketValue) / 2 / 1000) * 1000);
      o.status = "countered";
      stillPending.push(o);
      toast({ title: "Contraproposta recebida", detail: `${o.clubName} quer ${fmtBRL(o.counterValue)} por ${abbreviateName(o.playerName)} — veja em Minhas propostas.` }, { type: "warn" });
      return;
    }
    toast(`${o.clubName} recusou sua proposta de ${fmtBRL(o.offerValue)} por ${abbreviateName(o.playerName)}.`, { type: "warn" });
    pushTransferLog(`${o.clubName} recusou sua proposta de ${fmtBRL(o.offerValue)} por ${o.playerName}.`, round);
  });
  CAREER.pendingOffersOut = stillPending;
}
// Parcelas de contratações já fechadas (ver finalizeIncomingPurchase) —
// descontam o caixa a cada rodada até quitar, MESMO fora da janela de
// transferências (é uma dívida já assumida, não uma negociação nova),
// mesmo espírito de "dinheiro sai/entra aos poucos" do patrocínio.
function processPendingInstallments() {
  const list = CAREER.pendingInstallments || [];
  let totalDue = 0;
  const stillPending = [];
  list.forEach((inst) => {
    totalDue += inst.perRoundAmount;
    inst.roundsLeft -= 1;
    if (inst.roundsLeft > 0) stillPending.push(inst);
  });
  CAREER.finances.cash -= totalDue;
  CAREER.pendingInstallments = stillPending;
  return totalDue;
}
function myOffersRowHTML(o) {
  if (o.status === "countered") {
    return `<div class="mt-sponsor-proposal-row">
      <div>
        <div class="mt-sponsor-proposal-name">${escapeHtml(abbreviateName(o.playerName))} <span class="mt-badge-gold">Contraproposta</span></div>
        <div class="mt-sponsor-proposal-detail">${escapeHtml(o.clubName)} pede ${fmtBRL(o.counterValue)} (sua oferta: ${fmtBRL(o.offerValue)})</div>
      </div>
      <div style="display:flex; gap:6px; flex-shrink:0;">
        <button class="mt-btn-ghost" data-withdraw="${o.id}" style="padding:9px 12px;">Retirar</button>
        <button class="mt-btn-sign" data-acceptcounter="${o.id}">Aceitar</button>
      </div>
    </div>`;
  }
  // Nova feature (Bloco 3, 2/4) — proposta com concorrente real (ver
  // maybeSpawnRivalOffer) ganha um selo + o botão leva pra tela de
  // comparação (openOfferCompareScreen) em vez de aumentar direto —
  // lá o técnico vê os 2 lados antes de decidir se cobre ou não.
  const rivalBadge = o.rivalOffer ? ` <span class="mt-badge-alert">Concorrência</span>` : "";
  const increaseBtn = o.rivalOffer
    ? `<button class="mt-btn-sign" data-compare="${o.id}">Comparar</button>`
    : `<button class="mt-btn-sign" data-increase="${o.id}" data-value="${Math.round(o.marketValue)}">Aumentar</button>`;
  return `<div class="mt-sponsor-proposal-row">
    <div>
      <div class="mt-sponsor-proposal-name">${escapeHtml(abbreviateName(o.playerName))}${rivalBadge}</div>
      <div class="mt-sponsor-proposal-detail">${escapeHtml(o.clubName)} · sua oferta ${fmtBRL(o.offerValue)} de ${fmtBRL(o.marketValue)} · aguardando resposta (${o.roundsLeft} rodada${o.roundsLeft === 1 ? "" : "s"})</div>
    </div>
    <div style="display:flex; gap:6px; flex-shrink:0;">
      <button class="mt-btn-ghost" data-withdraw="${o.id}" style="padding:9px 12px;">Retirar</button>
      ${increaseBtn}
    </div>
  </div>`;
}
function renderMyOffersScreen() {
  const list = CAREER.pendingOffersOut || [];
  document.getElementById("myOffersCountLabel").textContent = list.length
    ? `${list.length} em andamento`
    : "Nenhuma em andamento";
  document.getElementById("myOffersEmpty").classList.toggle("hidden", list.length > 0);
  document.getElementById("myOffersList").innerHTML = list.map(myOffersRowHTML).join("");
  document.getElementById("myOffersList").querySelectorAll("[data-withdraw]").forEach((btn) => {
    btn.addEventListener("click", () => withdrawOffer(btn.dataset.withdraw));
  });
  document.getElementById("myOffersList").querySelectorAll("[data-increase]").forEach((btn) => {
    btn.addEventListener("click", () => increaseOffer(btn.dataset.increase, btn.dataset.value));
  });
  document.getElementById("myOffersList").querySelectorAll("[data-acceptcounter]").forEach((btn) => {
    btn.addEventListener("click", () => acceptCounterOffer(btn.dataset.acceptcounter));
  });
  document.getElementById("myOffersList").querySelectorAll("[data-compare]").forEach((btn) => {
    btn.addEventListener("click", () => openOfferCompareScreen(btn.dataset.compare));
  });
  const badge = document.getElementById("myOffersBadge");
  badge.classList.toggle("hidden", list.length === 0);
  if (list.length) badge.textContent = String(list.length);
}
function openMyOffersScreen() {
  renderMyOffersScreen();
  document.getElementById("myOffersOverlay").classList.add("open");
}
function closeMyOffersScreen() {
  document.getElementById("myOffersOverlay").classList.remove("open");
}

/* ---------- Bloco 3 (2/4) — tela "Comparar propostas" (mockup
   brtreinadorbloco3pendentes.html) ---------- */
let OFFER_COMPARE_ID = null; // id da proposta (CAREER.pendingOffersOut) sendo comparada
// Texto de análise: heurística com dado real (mesma comparação que
// decide quem ganha em resolvePendingOffersOutRound, ver
// offerEffectiveValue) — nunca texto de enchimento.
function offerCompareAnalysisText(o) {
  const mine = offerEffectiveValue(o.offerValue, o.installments);
  const rival = offerEffectiveValue(o.rivalOffer.offerValue, o.rivalOffer.installments);
  const cheaperMine = o.offerValue < o.rivalOffer.offerValue;
  const fasterMine = o.installments <= o.rivalOffer.installments;
  if (mine >= rival) {
    return cheaperMine
      ? `Sua proposta é mais barata e ainda assim competitiva no pagamento — você está na frente, mas nada garantido até o clube decidir.`
      : `Sua proposta paga mais rápido que a do ${o.rivalOffer.clubName} — isso pesa a seu favor, mesmo sem ser a mais alta.`;
  }
  return fasterMine
    ? `O ${o.rivalOffer.clubName} está oferecendo mais — considere aumentar sua proposta antes que o clube decida.`
    : `O ${o.rivalOffer.clubName} paga mais rápido (menos parcelas) e isso pesa a favor dele, mesmo com valor parecido — considere aumentar ou pagar mais à vista.`;
}
function renderOfferCompareScreen() {
  const o = (CAREER.pendingOffersOut || []).find((x) => x.id === OFFER_COMPARE_ID);
  if (!o || !o.rivalOffer) { closeOfferCompareScreen(); return; }
  document.getElementById("offerCompareSub").textContent = `${abbreviateName(o.playerName)} · ${o.clubName}`;
  const mineWins = offerEffectiveValue(o.offerValue, o.installments) >= offerEffectiveValue(o.rivalOffer.offerValue, o.rivalOffer.installments);
  document.getElementById("offerCompareCard").innerHTML = `
    <div class="mt-offercmp-row">
      <div class="mt-offercmp-col ${mineWins ? "lead" : ""}">
        <div class="mt-offercmp-club">Sua proposta</div>
        <div class="mt-offercmp-line"><span>Valor</span><span>${fmtBRL(o.offerValue)}</span></div>
        <div class="mt-offercmp-line"><span>Parcelas</span><span>${o.installments}x</span></div>
      </div>
      <div class="mt-offercmp-col ${mineWins ? "" : "lead"}">
        <div class="mt-offercmp-club">${escapeHtml(o.rivalOffer.clubName)}</div>
        <div class="mt-offercmp-line"><span>Valor</span><span>${fmtBRL(o.rivalOffer.offerValue)}</span></div>
        <div class="mt-offercmp-line"><span>Parcelas</span><span>${o.rivalOffer.installments}x</span></div>
      </div>
    </div>`;
  document.getElementById("offerCompareAnalysis").textContent = offerCompareAnalysisText(o);
}
function openOfferCompareScreen(offerId) {
  OFFER_COMPARE_ID = offerId;
  renderOfferCompareScreen();
  document.getElementById("offerCompareOverlay").classList.add("open");
}
function closeOfferCompareScreen() {
  document.getElementById("offerCompareOverlay").classList.remove("open");
  OFFER_COMPARE_ID = null;
}
// FAB "Aumentar oferta" do mockup — aumenta pro valor do concorrente
// (o mínimo pra virar a disputa a seu favor de novo, ver
// offerEffectiveValue) e volta pra "Minhas propostas".
function increaseOfferFromCompare() {
  const o = (CAREER.pendingOffersOut || []).find((x) => x.id === OFFER_COMPARE_ID);
  if (!o || !o.rivalOffer) return;
  const target = Math.max(o.offerValue, o.rivalOffer.offerValue);
  increaseOffer(o.id, target);
  closeOfferCompareScreen();
  renderMyOffersScreen();
}

function renderMercado() {
  const offer = CAREER.pendingOffer;
  const offerCard = document.getElementById("pendingOfferCard");
  offerCard.style.display = offer ? "" : "none";
  if (offer) {
    document.getElementById("pendingOfferText").textContent =
      `${offer.clubName} oferece ${fmtBRL(offer.fee)} pelo seu jogador ${offer.playerName}.`;
  }

  // Nova feature (Bloco 3) — contador de propostas em andamento no
  // botão "Minhas propostas", atualizado sempre que o Mercado
  // re-renderiza (não só quando a tela de propostas está aberta —
  // ver renderMyOffersScreen, que faz o mesmo pro contador de lá).
  const myOffersCount = (CAREER.pendingOffersOut || []).length;
  const myOffersBadge = document.getElementById("myOffersBadge");
  myOffersBadge.classList.toggle("hidden", myOffersCount === 0);
  if (myOffersCount) myOffersBadge.textContent = String(myOffersCount);

  // FASE 1 (item 2) — banner só aparece com a janela FECHADA (ver
  // .mt-badge-gold em carreira.html, Tela 10); "Comprar" fica desabilitado
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

  // AJUSTE (pedido do usuário: "o mercado deve trazer jogadores das 3
  // ligas para que transações possam ser feitas entre os 60 times das
  // Séries A, B e C") — filtro de divisão só aparece (e só filtra
  // algo de verdade) numa carreira "multi"; "single" nunca tem
  // jogador de outra divisão no Mercado, então o filtro fica
  // escondido e o texto de ajuda continua o de sempre.
  const isMulti = CAREER.marketScope === "multi";
  document.getElementById("marketCompFilter").classList.toggle("hidden", !isMulti);
  document.getElementById("helpMercado").textContent = isMulti
    ? "Seu elenco (pra vender) e os outros 59 times das 3 divisões — Série A, B e C (pra contratar). Contratar soma o salário na sua folha (mesmo teto do Financeiro)."
    : "Seu elenco (pra vender) e os outros 19 times da competição (pra contratar). Contratar soma o salário na sua folha (mesmo teto do Financeiro).";

  const search = (document.getElementById("marketSearch").value || "").trim().toLowerCase();
  const posFilter = document.getElementById("marketPosFilter").value;
  const compFilter = isMulti ? document.getElementById("marketCompFilter").value : "";
  let list = allMarketPlayers();
  if (posFilter) list = list.filter(({ p }) => p.group === posFilter);
  if (compFilter) list = list.filter(({ club }) => (club.competitionId || CURRENT_COMPETITION_ID) === compFilter);
  if (search) {
    list = list.filter(({ p, club }) =>
      p.name.toLowerCase().includes(search) || (club.name || "").toLowerCase().includes(search) || (club.short || "").toLowerCase().includes(search)
    );
  }
  list.sort((a, b) => b.p.value - a.p.value);
  // Sem busca/filtro, mostra só os 40 mais valiosos (evita renderizar
  // uma lista enorme à toa, ainda mais agora com até 3x mais times
  // numa carreira "multi") — buscando ou filtrando, mostra até 60
  // resultados batendo o critério.
  const capped = list.slice(0, search || posFilter || compFilter ? 60 : 40);
  // AJUSTE (refatoração completa, Tela 10 — ver
  // 10-mercado-de-transferencias-restyled.html do designer) — badge de
  // OVR (mesma faixa de cor do Elenco/Detalhe) + chip de posição
  // colorido (mesmo mapeamento do banco, Tela 6) em cima; salário/valor
  // + botões embaixo, alinhados com o badge (padding-left). Ação muda
  // pra "Vender" quando é jogador do SEU elenco (ver "mine" em
  // allMarketPlayers).
  // AJUSTE (pedido do usuário, "Opção B" do mockup de comparação —
  // ver mercado-row-opcoes.html) — ações saem da própria linha embaixo
  // (peso visual grande, fundo dourado com brilho no botão comprar) e
  // sobem pra um canto discreto ao lado do nome (.mt-market-actions-corner,
  // ícone sem contorno nem preenchimento, só a cor diferencia a ação);
  // salário/valor ganham a linha de baixo inteira, sozinhos.
  const rows = capped.map(({ p, club, mine }) => {
    const subpos = subPositionOf(p);
    // AJUSTE (pedido do usuário: "o mercado deve trazer jogadores das
    // 3 ligas") — selo de divisão só numa carreira "multi" (numa
    // "single" todo mundo é sempre da mesma competição, o selo não
    // diria nada de novo) — mesmo estilo de pílula do chip de posição
    // ao lado, cor neutra (não é uma das cores semânticas do jogo).
    const compTag = isMulti
      ? `<span class="mt-pos-chip" style="background:rgba(143,163,191,.14); color:var(--mt-ink-muted); border:1px solid rgba(143,163,191,.3);">${escapeHtml(COMPETITION_SHORT[club.competitionId] || club.competitionId || "")}</span>`
      : "";
    return `<div class="mt-market-row">
    <div class="mt-market-top">
      <div class="mt-ovr-badge ${ovrTierClass(p.overall)}">${p.overall}</div>
      <div class="mt-market-info">
        <div class="mt-market-name">${escapeHtml(abbreviateName(p.name))}</div>
        <div class="mt-market-tags"><span class="mt-market-club">${escapeHtml(club.short || club.name)}</span><span class="mt-pos-chip ${SUBPOS_DIVCLASS[subpos]}">${subpos}</span>${compTag}</div>
      </div>
      <div class="mt-market-actions-corner">
        ${mine
          ? `<button class="mt-btn-sell" data-sell="${p.id}" aria-label="Vender" title="Vender">${MARKET_ICON.saida}</button>
             <button class="mt-btn-loan" data-loanout="${p.id}" aria-label="Emprestar" ${loanOutBtnAttrs(p, mktWindow) || `title="Emprestar"`}>${MARKET_ICON.emprestimo}</button>`
          : pendingOfferOutFor(p.id)
            ? `<button class="mt-btn-loan" data-viewoffer="${p.id}" aria-label="Proposta enviada" title="Proposta enviada — ver em Minhas propostas">${MARKET_ICON.pendente}</button>`
            : `<button class="mt-btn-buy" data-buy="${p.id}" data-club="${escapeHtml(String(club.id))}" aria-label="Propor" ${mktWindow.open ? `title="Fazer proposta"` : `disabled title="Janela de contratações encerrada"`}>${MARKET_ICON.entrada}</button>
               <button class="mt-btn-loan" data-loanin="${p.id}" data-club="${escapeHtml(String(club.id))}" aria-label="Pegar emprestado" ${loanOutBtnAttrs(p, mktWindow) || `title="Pegar emprestado"`}>${MARKET_ICON.emprestimo}</button>`}
      </div>
    </div>
    <div class="mt-market-detail">Salário: <b>${fmtBRLShort(p.wage)}/mês</b> · Valor: <b>${fmtBRLShort(p.value)}</b></div>
  </div>`;
  }).join("");
  document.getElementById("marketList").innerHTML = rows || `<p class="ct-empty">Nenhum jogador encontrado.</p>`;
  // Nova feature (Bloco 3) — "Comprar" virou "Fazer proposta"
  // (ver openOfferModal); botão de quem já tem negociação em
  // andamento pra esse jogador leva direto pra "Minhas propostas".
  document.getElementById("marketList").querySelectorAll("[data-buy]").forEach((btn) => {
    btn.addEventListener("click", () => openOfferModal(btn.dataset.club, btn.dataset.buy));
  });
  document.getElementById("marketList").querySelectorAll("[data-viewoffer]").forEach((btn) => {
    btn.addEventListener("click", () => openMyOffersScreen());
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
// AJUSTE (pedido do usuário: "no Mercado deu certo mas precisa
// funcionar também na Comissão Técnica") — buyPlayer() (compra à
// vista, sem negociação nem parcelamento) ficou sem nenhum chamador
// depois desta mudança: era usada só pelo atalho "Aplicar" da
// sugestão de Mercado da Comissão Técnica (ver suggestMarket, que
// agora abre a mesma proposta real de sempre, ver openOfferModal) —
// removida (histórico completo no git, se precisar consultar de novo).
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
  if (principalCount <= 14) { toast("O elenco principal não pode ficar com menos de 14 jogadores.", { type: "warn" }); return false; }
  // AJUSTE (pedido do usuário: "toda confirmação de empréstimo e venda
  // deve ter o clube para onde o jogador vai") — resolve o comprador
  // ANTES de perguntar, não depois: assim o técnico já vê pra quem tá
  // vendendo no próprio texto de confirmação, em vez de descobrir só
  // depois de já ter confirmado. Sem interessado, nem chega a abrir o
  // diálogo — já era o comportamento de sempre (ver comentário de
  // findInterestedBuyer), só que agora sem a etapa de confirmação
  // inútil no meio.
  const buyer = findInterestedBuyer(CAREER.clubId);
  if (!buyer) {
    // AJUSTE (pedido do usuário: "todos os textos devem ser bem
    // escritos") — "interesse em {nome}" ficava ambíguo fora de
    // contexto; "interesse em comprar {nome}" deixa claro o que
    // ninguém quis fazer, igual já era pro texto equivalente do
    // empréstimo ("interesse em pegar {nome} emprestado").
    toast(`Nenhum time demonstrou interesse em comprar ${abbreviateName(p.name)} agora — ele continua no seu elenco.`, { type: "info" });
    return false;
  }
  if (!(await confirmModal(`Vender ${p.name} pro ${buyer.name} por ${fmtBRL(p.value)}?`, "Vender"))) return false;
  CAREER.finances.cash += p.value;
  CAREER.squad = CAREER.squad.filter((x) => x.id !== id);
  CAREER.lineup.starters = CAREER.lineup.starters.map((x) => (x === id ? null : x));
  CAREER.lineup.bench = CAREER.lineup.bench.filter((x) => x !== id);
  (CAREER.leagueSquads[String(buyer.id)] = CAREER.leagueSquads[String(buyer.id)] || []).push(p);
  pushTransferLog(`Você vendeu ${p.name} pro ${buyer.name} por ${fmtBRL(p.value)}.`, CAREER.currentRound);
  toast(`${abbreviateName(p.name)} vendido por ${fmtBRL(p.value)}.`, { type: "pos" });
  ensureObjectivesFresh(); bumpObjective("daily", "obj_market_1_move", 1);
  // FASE 4 (item 2) — "venda de jogador querido pela torcida"
  // (PRESS_LIBRARY id 16): mesmo proxy de overall alto (craque/titular
  // de peso) usado na contratação polêmica acima — quem rende bastante
  // em campo é quem a torcida sente falta de verdade.
  if (p.overall >= 80) { firePressConference("16", CAREER.currentRound, false); openPressConferenceModal(); }
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
  toast(`Proposta aceita — ${fmtBRL(offer.fee)} no caixa.`, { type: "pos" });
  ensureObjectivesFresh(); bumpObjective("daily", "obj_market_1_move", 1);
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
// AJUSTE (pedido do usuário, item 6) — mesma decisão de aceitar/
// recusar de sempre (ver acceptOffer/declineOffer), só que disparada
// de dentro desse modal de destaque em vez de só pela aba Mercado.
// Fechar no X (closePlayerOfferModal) NÃO decide nada — a proposta
// continua pendente, com o cartão de sempre esperando na aba Mercado —
// mas o fluxo pós-jogo segue adiante do mesmo jeito (ver
// btnRoundResultsContinue), exceção documentada acima na modal.
function openPlayerOfferModal() {
  const offer = CAREER.pendingOffer;
  if (!offer) return;
  document.getElementById("playerOfferText").textContent =
    `${offer.clubName} oferece ${fmtBRL(offer.fee)} pelo seu jogador ${offer.playerName}.`;
  document.getElementById("playerOfferOverlay").classList.add("open");
}
function closePlayerOfferModal() {
  document.getElementById("playerOfferOverlay").classList.remove("open");
  openTabelaModal();
}
function acceptOfferFromModal() {
  acceptOffer();
  closePlayerOfferModal();
}
function declineOfferFromModal() {
  declineOffer();
  closePlayerOfferModal();
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
    ["Identidade do clube", renderTopbarIdentity],
    ["Central", renderCentral], ["Elenco", renderElenco], ["Escalação", renderEscalacao],
    ["Tabela", renderTabelaPanel], ["Copa do Brasil", renderCopa], ["Treinos", renderTreinos],
    ["Estatísticas", renderEstatisticas], ["Mercado", renderMercado],
    ["Objetivos", renderObjetivos], ["Conquistas", renderConquistas],
  ].forEach(([name, fn]) => {
    try { fn(); } catch (err) {
      console.error(`[carreira] falha ao renderizar ${name}:`, err);
      toast(`Erro ao carregar ${name}: ${err.message}`, { durationMs: 15000, type: "warn" }); // mais tempo que o normal (3.6s) — dá pra ler/printar
    }
  });
}
function showGameScreen() {
  show("screenGame");
  // Redesign M3 — aplica a cor dinâmica do clube da carreira ANTES de
  // renderAll() (que já monta HTML lendo os tokens --m3-* via CSS).
  applyClubPalette(teamById(CAREER.clubId));
  renderAll();
  // Retenção/Engajamento — login diário só faz sentido com uma
  // carreira em andamento pra aplicar a recompensa (ver
  // applyDailyLoginReward); picker de competição/clube (sem carreira
  // ainda) fica de fora de propósito.
  checkDailyLoginOnBoot();
}
function switchToPanel(name) {
  // Redesign M3 — nav virou .m3-nav-item (pílula, 5 itens), ver
  // .m3-bottom-nav em carreira.html.
  document.querySelectorAll(".m3-nav-item").forEach((b) => b.classList.toggle("active", b.dataset.panel === name));
  document.querySelectorAll(".ct-panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + name));
  // Retenção/Engajamento — objetivos/conquistas são atualizados por
  // vários pontos de evento espalhados pelo código (comprar/vender/
  // emprestar jogador, treinar, promover da base...), cada um chamando
  // só o render das TELAS que já mexiam antes desta mudança existir
  // (Mercado/Elenco/Central etc.) — reforçar aqui garante que a tela
  // sempre mostra o estado atual ao entrar, sem precisar caçar e
  // acrescentar renderObjetivos()/renderConquistas() em cada um desses
  // pontos (fácil esquecer um).
  if (name === "objetivos") renderObjetivos();
  if (name === "conquistas") renderConquistas();
  // Loja — mesmo raciocínio: lê CAREER.finances.cash/ME.creditsBR ao
  // vivo, que podem ter mudado em qualquer outra tela desde a última
  // vez que a Loja foi aberta.
  if (name === "loja") renderLoja();
}

/* ---------- Modais do fluxo "Simular rodada" (pedido do usuário) ---------- */
// 1º modal: o jogo do PRÓPRIO clube (se jogou essa rodada — bye/folga
// pula direto pro modal de resultados, não tem jogo pra detalhar).
function showMatchDetailModal(summary) {
  if (!summary.humanMatch) { showRoundResultsModal(summary); return; }
  const { home, away, gh, ga, events, ticketRevenue, stats, isHome } = summary.humanMatch;
  const homeTeam = teamById(home), awayTeam = teamById(away);
  document.getElementById("matchDetailRound").textContent = summary.round;
  document.getElementById("matchDetailScore").innerHTML = `
    <div class="side">${crestImg(homeTeam)}<span class="n">${escapeHtml(homeTeam.name)}</span></div>
    <span class="vs">${gh} × ${ga}</span>
    <div class="side">${crestImg(awayTeam)}<span class="n">${escapeHtml(awayTeam.name)}</span></div>`;
  document.getElementById("matchDetailEvents").innerHTML = matchEventsSummaryHTML(events)
    || `<p class="ct-empty">Nenhum gol, cartão ou assistência nesse jogo.</p>`;
  // AJUSTE (Play-by-Play v1, Tela hifi-03) — barras de posse/
  // finalizações/no alvo/faltas, dourado = SEU time. `stats` só existe
  // em partidas resolvidas DEPOIS deste ajuste (ver finishLiveMatch) —
  // esconde o cartão inteiro pra saves antigos/rodadas sem esse dado.
  const statsCard = document.getElementById("matchDetailStatsCard");
  statsCard.classList.toggle("hidden", !stats);
  if (stats) document.getElementById("matchDetailStats").innerHTML = matchStatsBarsHTML(stats, isHome);
  // FASE 3 (b) — pedido do usuário: renda de ingressos em jogo em casa
  // (público que compareceu vs. capacidade do estádio, refletindo a
  // fase recente do time — ver currentAttendancePct).
  document.getElementById("matchDetailTickets").textContent = ticketRevenue
    ? `🎟️ Público: ${ticketRevenue.attendance.toLocaleString("pt-BR")} / ${ticketRevenue.capacity.toLocaleString("pt-BR")} (${Math.round(ticketRevenue.pct * 100)}%) · Renda: ${fmtBRL(ticketRevenue.revenue)}`
    : "";
  PENDING_ROUND_SUMMARY = summary;
  document.getElementById("matchDetailOverlay").classList.add("open");
}
// AJUSTE (Play-by-Play v1, Tela hifi-03 — "4 métricas com barras
// espelhadas douradas vs. cinza") — dourado é sempre o SEU time
// (mine), não "mandante", já que essa tela é sempre sob a perspectiva
// do técnico. `stats` vem de lm.stats (ver updateLiveStats/
// finishLiveMatch) — possession já normalizado em % pra home/away.
function matchStatsBarsHTML(stats, isHome) {
  const side = (obj) => (isHome ? obj.home : obj.away);
  const oppSide = (obj) => (isHome ? obj.away : obj.home);
  const rows = [
    { label: "Posse de bola", mine: side(stats.possession), opp: oppSide(stats.possession), suffix: "%" },
    { label: "Finalizações", mine: side(stats.shots), opp: oppSide(stats.shots) },
    { label: "Finalizações no alvo", mine: side(stats.shotsOnTarget), opp: oppSide(stats.shotsOnTarget) },
    { label: "Faltas", mine: side(stats.fouls), opp: oppSide(stats.fouls) },
  ];
  return rows.map((r) => {
    const total = r.mine + r.opp || 1;
    const minePct = Math.round((r.mine / total) * 100);
    return `<div class="mt-stat-bar-row">
      <span class="mt-stat-bar-val mine">${r.mine}${r.suffix || ""}</span>
      <div class="mt-stat-bar-track">
        <div class="mt-stat-bar-label">${escapeHtml(r.label)}</div>
        <div class="mt-stat-bar-fill"><span class="mine" style="width:${minePct}%;"></span><span class="opp" style="width:${100 - minePct}%;"></span></div>
      </div>
      <span class="mt-stat-bar-val opp">${r.opp}${r.suffix || ""}</span>
    </div>`;
  }).join("");
}
// AJUSTE (pedido do usuário, revisão das modais de pós-jogo) — usada
// tanto pelo X do cabeçalho quanto pelo "Fechar" no rodapé (ver
// #matchDetailClose/#btnMatchDetailCloseFooter) — só fecha, sem seguir
// o fluxo pós-jogo (quem quiser ver Notícias/Resultados clica em
// "Continuar" mesmo).
function closeMatchDetailModal() {
  document.getElementById("matchDetailOverlay").classList.remove("open");
}
// AJUSTE (Play-by-Play v1, Tela hifi-03 — botão "Rever lances") —
// reabre o feed COMPLETO da partida (gol/cartão/chance perdida/
// defesa/substituição, cronológico), lido de
// PENDING_ROUND_SUMMARY.humanMatch.allEvents (ver finishLiveMatch) —
// LIVE_MATCH já é null nesse ponto, por isso liveEventLabel recebe um
// `ctx` próprio aqui em vez de depender do estado global da partida.
function openMatchReplay() {
  const hm = PENDING_ROUND_SUMMARY && PENDING_ROUND_SUMMARY.humanMatch;
  if (!hm || !hm.allEvents || !hm.allEvents.length) { toast("Sem lances registrados nesse jogo.", { type: "info" }); return; }
  const home = teamById(hm.home), away = teamById(hm.away);
  const oppTeam = hm.isHome ? away : home;
  const ctx = { oppTeamName: oppTeam.name, tracker: {} };
  document.getElementById("matchReplayFeed").innerHTML = hm.allEvents.map((e) => {
    const label = liveEventLabel(e, ctx);
    if (!label) return "";
    const dot = liveEventDot(e.type);
    return `<div class="mt-live-tl-event">
      <div class="mt-live-tl-dot ${dot.cls}">${dot.svg}</div>
      <div class="mt-live-tl-min">${e.minute}'</div>
      <div class="mt-live-tl-desc">${label}</div>
    </div>`;
  }).join("");
  document.getElementById("matchReplayOverlay").classList.add("open");
}
function closeMatchReplay() {
  document.getElementById("matchReplayOverlay").classList.remove("open");
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
  // AJUSTE (pedido do usuário: "tem uma informação de salários pagos
  // e renda que aparece no resultado da rodada que deveria aparecer
  // na tela de notícias do time") — resumo financeiro da rodada
  // (folha salarial + patrocínio + caixa, ver renderNewsScreen) saiu
  // daqui; a tela de Notícias, que abre ANTES desta no mesmo fluxo
  // pós-jogo, já mostra a mesma informação.
  // FASE 2 (c) — avisa aqui se surgiu proposta nova por um jogador seu
  // (resolvida na aba Mercado com aceitar/recusar).
  // AJUSTE (pedido do usuário, item 6) — antes mandava "veja na aba
  // Mercado"; agora essa mesma proposta pede decisão logo em seguida
  // (ver btnRoundResultsContinue/openPlayerOfferModal), então o aviso
  // aqui só avisa que ela existe, sem precisar apontar pra outra aba.
  // AJUSTE (refatoração completa, Tela 16) — #roundResultsOffer virou
  // .mt-badge-gold (pílula), que precisa ficar .hidden quando vazio
  // (mesmo tratamento de #marketWindowBanner/#preMatchWarning).
  const offerEl = document.getElementById("roundResultsOffer");
  offerEl.classList.toggle("hidden", !summary.newOffer);
  offerEl.textContent = summary.newOffer
    ? `💰 Proposta recebida: ${summary.newOffer.clubName} oferece ${fmtBRL(summary.newOffer.fee)} pelo jogador ${abbreviateName(summary.newOffer.playerName)}.`
    : "";
  // FASE 2 (a) — Copa do Brasil: só existe summary.cup nas 4 rodadas
  // certas com seu clube ainda vivo (ver resolveCupPhase).
  document.getElementById("roundResultsCup").innerHTML = summary.cup ? cupRoundResultsHTML(summary.cup) : "";
  PENDING_ROUND_SUMMARY = null;
  document.getElementById("roundResultsOverlay").classList.add("open");
}
// AJUSTE (pedido do usuário, revisão das modais de pós-jogo) — usada
// tanto pelo X do cabeçalho quanto pelo "Fechar" no rodapé (ver
// #roundResultsClose/#btnRoundResultsCloseFooter) — só fecha, sem
// seguir o fluxo (quem quiser ver a proposta em destaque/Tabela clica
// em "Continuar" mesmo).
function closeRoundResultsModal() {
  document.getElementById("roundResultsOverlay").classList.remove("open");
}

// Nova feature — Resumo da rodada (brtreinadorbloco1pendentes.html):
// aberta a qualquer momento pelo Menu (#btnOpenRodada), diferente de
// #roundResultsOverlay acima (que só abre sozinha no fluxo pós-jogo).
// Só 2 estados de verdade — nunca um "ao vivo" fake que o motor não
// produz (a rodada inteira resolve de uma vez, ver resolveRoundInstant/
// finishLiveMatch, nunca em paralelo):
//  - "atual": CAREER.currentRound, ainda não jogada — todo confronto
//    aparece "— x —" (não existe entrada em resultsByRound pra uma
//    rodada que ainda não rolou).
//  - "anterior": CAREER.currentRound - 1, com placar real — só existe
//    essa opção enquanto o dado ainda não foi podado (resultsByRound
//    só guarda a rodada atual e a anterior, ver comentário grande em
//    finishRoundTail) — o que cobre exatamente "a rodada que acabou de
//    rolar", sempre disponível assim que currentRound avança.
let RODADA_VIEW = "atual";
function renderRodada(view) {
  if (view) RODADA_VIEW = view;
  const hasAnterior = CAREER.currentRound > 1;
  if (RODADA_VIEW === "anterior" && !hasAnterior) RODADA_VIEW = "atual";
  const round = RODADA_VIEW === "anterior" ? CAREER.currentRound - 1 : CAREER.currentRound;
  document.getElementById("rodadaRoundLabel").textContent = `Rodada ${Math.min(round, 38)}`;
  document.getElementById("rodadaTabAtual").classList.toggle("on", RODADA_VIEW === "atual");
  const tabAnterior = document.getElementById("rodadaTabAnterior");
  tabAnterior.classList.toggle("hidden", !hasAnterior);
  tabAnterior.classList.toggle("on", RODADA_VIEW === "anterior");

  const fixtures = (CAREER.schedule && CAREER.schedule[round]) || [];
  const results = (CAREER.resultsByRound && CAREER.resultsByRound[round]) || [];
  document.getElementById("rodadaEmpty").classList.toggle("hidden", fixtures.length > 0);
  document.getElementById("rodadaList").innerHTML = fixtures.map((fx) => {
    const home = teamById(fx.home), away = teamById(fx.away);
    const isMe = String(fx.home) === String(CAREER.clubId) || String(fx.away) === String(CAREER.clubId);
    const played = results.find((r) => String(r.home) === String(fx.home) && String(r.away) === String(fx.away));
    const scoreHTML = played ? `${played.gh} <small>x</small> ${played.ga}` : `— <small>x</small> —`;
    return `<div class="ct-round-result-row ${isMe ? "me" : ""}">
      <div class="ct-rr-team">${crestImg(home, 22)}<span>${escapeHtml(home.short || home.name)}</span></div>
      <span class="ct-rr-score">${scoreHTML}</span>
      <div class="ct-rr-team right">${crestImg(away, 22)}<span>${escapeHtml(away.short || away.name)}</span></div>
    </div>`;
  }).join("");
}
function openRodadaScreen() {
  RODADA_VIEW = "atual";
  renderRodada();
  document.getElementById("rodadaOverlay").classList.add("open");
}
function closeRodadaScreen() {
  document.getElementById("rodadaOverlay").classList.remove("open");
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
    statusLine = `<p class="ct-sub" style="color:var(--mt-gold-400); font-weight:700; margin-top:8px;">🏆 Campeão da Copa do Brasil ${CAREER.seasonYear}!</p>`;
  } else if (!cup.humanAlive && cup.humanEliminatedStage === phase) {
    statusLine = `<p class="ct-sub" style="color:var(--mt-crimson-400); font-weight:700; margin-top:8px;">❌ Eliminado da Copa do Brasil nas ${CUP_PHASE_LABEL[phase]}.</p>`;
  } else if (cup.humanAlive) {
    statusLine = `<p class="ct-sub" style="color:var(--mt-gold-400); font-weight:700; margin-top:8px;">✅ Classificado pra ${CUP_PHASE_LABEL[cup.phase]} da Copa do Brasil!</p>`;
  }
  // AJUSTE (refatoração completa, Tela 16) — .mt-card montado aqui
  // dentro (não estático no #roundResultsCup do HTML) porque essa
  // seção só existe em 4 rodadas da temporada — um .mt-card vazio nas
  // outras rodadas mostraria uma caixa chanfrada sem conteúdo.
  return `<div class="mt-card"><div class="mt-card-title" style="margin-bottom:10px;">🏆 Copa do Brasil — ${CUP_PHASE_LABEL[phase]}</div>${rows}${statusLine}</div>`;
}
// FASE 3 (c) — modal de resumo ao avançar de temporada (ver
// advanceSeason). Sem botão X de propósito — só "Começar a temporada"
// mesmo, igual às outras 2 modais do fluxo de "Simular rodada".
// Nova feature (pedido do usuário: "reinicie o tema do rebaixamento")
// — resumo de acesso/rebaixamento pro modal de virada de temporada
// (ver showSeasonModal). O time do PRÓPRIO técnico nunca aparece em
// relegatedC (ver a exceção documentada em applyPromotionRelegation),
// então essas 4 checagens cobrem os únicos jeitos dele mudar de
// divisão.
function humanDivisionMove(pr) {
  const mine = (list) => list.some((t) => String(t.id) === String(CAREER.clubId));
  if (mine(pr.relegatedA)) return { text: "Rebaixado(a): Série A → Série B.", positive: false };
  if (mine(pr.promotedB)) return { text: "Acesso! Série B → Série A.", positive: true };
  if (mine(pr.relegatedB)) return { text: "Rebaixado(a): Série B → Série C.", positive: false };
  if (mine(pr.promotedC)) return { text: "Acesso! Série C → Série B.", positive: true };
  return null;
}
function divisionMoveSummaryHTML(pr) {
  if (!pr) return ""; // carreira sem o sistema ativado, ou temporada terminou em demissão (ver advanceSeason)
  const names = (list) => (list.length ? list.map((t) => escapeHtml(t.name)).join(", ") : "—");
  const mine = humanDivisionMove(pr);
  let html = `<div class="mt-divider-label">ACESSO E REBAIXAMENTO</div>`;
  if (mine) {
    html += `<p class="ct-sub" style="color:${mine.positive ? "var(--mt-pitch-400)" : "var(--mt-crimson-400)"};margin:0 0 6px;"><b>${mine.text}</b></p>`;
  }
  html += `<p class="ct-sub" style="margin:0;">Série A → B: ${names(pr.relegatedA)}</p>`;
  html += `<p class="ct-sub" style="margin:0;">Série B → A: ${names(pr.promotedB)}</p>`;
  html += `<p class="ct-sub" style="margin:0;">Série B → C: ${names(pr.relegatedB)}</p>`;
  html += `<p class="ct-sub" style="margin:0;">Série C → B: ${names(pr.promotedC)}</p>`;
  html += `<p class="ct-sub" style="margin:0;">Série C → D: ${names(pr.relegatedC)}</p>`;
  html += `<p class="ct-sub" style="margin:0;">Série D → C: ${names(pr.promotedD)}</p>`;
  return html;
}
function showSeasonModal(result) {
  const { finishedYear, finishedPos, finishedGoal, goalWasMet, newYear, humanRenewal, newGoal, promotionRelegation } = result;
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
  document.getElementById("seasonDivisionMove").innerHTML = divisionMoveSummaryHTML(promotionRelegation);
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
  // AJUSTE (Bloco 2 M3) — formationSelect (Escalação) e tacticMentality/
  // Marking/Tempo (<select>) saíram: formação vira chip row
  // (ver renderFormationChips), instruções de jogo viram os 4 eixos em
  // barra segmentada (ver renderTacticAxisRows), populados no
  // render/abertura de cada tela, não aqui no boot.
  populateSelect("liveTacticsFormation", Object.keys(FORMATIONS).map((k) => [k, k]));

  // AJUSTE (pedido do usuário: "o hambúrguer não ficaria melhor no
  // rodapé junto com os demais?") — seletor agora exige [data-panel]
  // de propósito: o botão "Menu" também é um .mt-nav-item (mesmo
  // visual), mas não representa uma aba — sem essa restrição, esse
  // clique cairia aqui TAMBÉM (além do listener dedicado dele, ver
  // mais abaixo) e chamaria switchToPanel(undefined), escondendo o
  // painel atual sem mostrar nada no lugar.
  document.querySelectorAll(".m3-nav-item[data-panel]").forEach((btn) => {
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

  document.getElementById("btnAutoLineup").addEventListener("click", autoFillLineup);
  document.getElementById("btnSaveLineup").addEventListener("click", () => {
    commitLineupTactics();
    persistCareer();
    toast("Escalação e táticas salvas.", { type: "pos" });
    renderCentral();
  });

  // Botão "Aplicar treino da semana" (ver applyWeeklyTraining) — a
  // idempotência por rodada (trainingAppliedForRound) já protege
  // contra dobrar o efeito; o disabled aqui (ver renderTreinos) é só
  // pra deixar isso visível, não a única trava.
  document.getElementById("btnApplyTraining").addEventListener("click", () => {
    const gains = applyWeeklyTraining();
    persistCareer();
    renderTreinos();
    if (!gains) return;
    toast(gains.size
      ? { title: "Treino da semana aplicado", detail: `${gains.size} jogador${gains.size > 1 ? "es" : ""} evoluíram atributos.` }
      : { title: "Treino da semana aplicado", detail: "Semana de descanso — sem ganho de atributo, condição recuperada." },
      { type: "pos" });
  });

  // Fluxo de "Simular rodada" (pedido do usuário): confirmar escalação
  // em tela cheia (ver openPreMatchConfirm) -> "Ir para o jogo" -> modal
  // com o jogo do clube (resultado/gols/assistências/cartões) ->
  // "Continuar" -> modal com o resultado da rodada inteira (+ trocas
  // forçadas de escalação, se houve) -> "Continuar" -> aba Tabela já
  // atualizada. Ver showMatchDetailModal/showRoundResultsModal.
  document.getElementById("btnSimulate").addEventListener("click", () => {
    openPreMatchConfirm();
  });
  // AJUSTE — X só fecha a confirmação sem simular nada (mesmo padrão
  // de sempre: nenhum passo avança sozinho sem o usuário clicar no
  // botão de continuar/ir).
  document.getElementById("preMatchClose").addEventListener("click", closePreMatchConfirm);
  document.getElementById("preMatchOverlay").addEventListener("click", (e) => { if (e.target.id === "preMatchOverlay") closePreMatchConfirm(); });
  // AJUSTE (pedido do usuário: "o botão Ajustar Escalação deve abrir
  // uma modal ... com o botão Ir para o jogo") — antes fechava esta
  // modal e navegava pra aba Escalação (perdendo o fluxo de "Simular
  // rodada" de vez, exigia clicar em "Simular rodada" de novo pra
  // voltar); agora abre #adjustLineupOverlay por cima, sem fechar esta
  // (ver openAdjustLineupModal).
  document.getElementById("btnPreMatchAdjust").addEventListener("click", openAdjustLineupModal);
  document.getElementById("btnPreMatchGo").addEventListener("click", goToMatch);
  document.getElementById("adjustLineupClose").addEventListener("click", closeAdjustLineupModal);
  document.getElementById("adjustLineupOverlay").addEventListener("click", (e) => { if (e.target.id === "adjustLineupOverlay") closeAdjustLineupModal(); });
  document.getElementById("btnAdjustLineupGo").addEventListener("click", goToMatch);
  // FASE 3 (itens 1 e 2) — botões fixos da tela Ao Vivo (substituição/
  // tática) e os 2 sub-modais que eles abrem, mesmo padrão de
  // fechamento dos outros sub-modais (X e clique fora cancelam sem
  // aplicar nada — ver closeLiveSubModal/closeLiveTacticsModal, que só
  // retomam a progressão da partida).
  document.getElementById("btnLiveSkip").addEventListener("click", skipLiveMatch);
  // AJUSTE (Play-by-Play v1) — segmented control 1×/2× (ver
  // scheduleNextChunk, que lê LIVE_MATCH.speed a cada tempo agendado —
  // clicar não precisa reagendar nada na hora, só vale do PRÓXIMO tempo
  // em diante).
  document.getElementById("liveSpeedToggle").addEventListener("click", (e) => {
    const btn = e.target.closest(".mt-live-speed-btn");
    if (!btn || !LIVE_MATCH) return;
    LIVE_MATCH.speed = Number(btn.dataset.speed);
    document.querySelectorAll("#liveSpeedToggle .mt-live-speed-btn").forEach((b) => b.classList.toggle("active", b === btn));
  });
  // Destaque de gol em tela cheia (Tela hifi-02) — dispensa por toque
  // em qualquer área (ver queueGoalHighlights/showNextGoalHighlight).
  document.getElementById("goalHighlightOverlay").addEventListener("click", dismissGoalHighlight);
  // AJUSTE (pedido do usuário: "o jogo deve pausar no intervalo e
  // aguardar que o técnico clique em prosseguir") — único jeito de sair
  // do intervalo (ver continueFromHalftime/resolveLiveChunk).
  document.getElementById("btnLiveContinueSecondHalf").addEventListener("click", continueFromHalftime);
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
    // FASE 4 (item 2) — coletiva de imprensa entra ENTRE o modal "Seu
    // jogo" e a tela de Notícias (ver determineMatchPressTrigger/
    // firePressConference, chamados de dentro de finishLiveMatch) — só
    // quando alguma situação bateu nessa partida específica.
    if (PENDING_PRESS) { openPressConferenceModal(); return; }
    // AJUSTE (pedido do usuário: "notícias em tela cheia antes dos
    // resultados dos jogos") — sem coletiva, a tela de Notícias já
    // entra direto aqui (ver openNewsScreen/continueFromNewsScreen).
    if (PENDING_ROUND_SUMMARY) openNewsScreen(true);
  });
  // FASE 4 (item 2) — sub-modal de coletiva de imprensa: X fecha sem
  // aplicar efeito nenhum (conta como "sem comentário"), mas ainda
  // segue o fluxo normal pros Resultados da rodada quando aplicável
  // (ver closePressConferenceModal). Opções de resposta são recriadas
  // a cada abertura (texto vem da PRESS_LIBRARY), por isso o listener
  // é delegado no container em vez de um por botão.
  document.getElementById("pressClose").addEventListener("click", closePressConferenceModal);
  document.getElementById("pressOverlay").addEventListener("click", (e) => { if (e.target.id === "pressOverlay") closePressConferenceModal(); });
  document.getElementById("pressOptions").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-press]");
    if (btn) applyPressAnswer(btn.dataset.press);
  });
  document.getElementById("btnRoundResultsContinue").addEventListener("click", () => {
    document.getElementById("roundResultsOverlay").classList.remove("open");
    // AJUSTE (pedido do usuário, item 6) — proposta por jogador seu
    // pendente ganha destaque ANTES da Tabela em vez de só aparecer
    // discreta na aba Mercado (ver openPlayerOfferModal/
    // closePlayerOfferModal, que segue o fluxo pra Tabela sozinho).
    if (CAREER.pendingOffer) openPlayerOfferModal();
    else openTabelaModal();
  });
  document.getElementById("tabelaModalClose").addEventListener("click", closeTabelaModal);
  // AJUSTE (pedido do usuário, revisão das modais de pós-jogo:
  // "aplicar o mesmo layout das demais modais e incluir abaixo apenas
  // o botão fechar") — "Fechar" no rodapé fixo, mesma função do X.
  document.getElementById("btnTabelaModalCloseFooter").addEventListener("click", closeTabelaModal);
  document.getElementById("tabelaModalOverlay").addEventListener("click", (e) => { if (e.target.id === "tabelaModalOverlay") closeTabelaModal(); });
  // FASE 4 (item 6, ajuste) — modal de destaque pra proposta recebida
  // por jogador seu, aberta de dentro do fluxo pós-jogo (ver
  // btnRoundResultsContinue acima).
  document.getElementById("playerOfferClose").addEventListener("click", closePlayerOfferModal);
  document.getElementById("playerOfferOverlay").addEventListener("click", (e) => { if (e.target.id === "playerOfferOverlay") closePlayerOfferModal(); });
  document.getElementById("btnPlayerOfferAccept").addEventListener("click", acceptOfferFromModal);
  document.getElementById("btnPlayerOfferDecline").addEventListener("click", declineOfferFromModal);
  // FASE 4 (item 5) — modal de propostas de patrocínio.
  document.getElementById("sponsorProposalsClose").addEventListener("click", closeSponsorProposalsModal);
  document.getElementById("sponsorProposalsOverlay").addEventListener("click", (e) => { if (e.target.id === "sponsorProposalsOverlay") closeSponsorProposalsModal(); });

  // AJUSTE (pedido do usuário: "esperava uma tela exclusiva pra
  // notícias nos padrões de um portal de esportes") — tela de
  // notícias, aberta pelo menu "≡".
  document.getElementById("btnOpenNews").addEventListener("click", () => {
    document.getElementById("topbarMenu").classList.remove("open");
    openNewsScreen();
  });
  document.getElementById("newsClose").addEventListener("click", closeNewsScreen);
  // AJUSTE (pedido do usuário, revisão das modais de pós-jogo) —
  // "Fechar" no rodapé (ver #newsFooter em carreira.html, só existe
  // junto do "Continuar" no fluxo pós-jogo), mesma função do X.
  document.getElementById("btnNewsCloseFooter").addEventListener("click", closeNewsScreen);
  document.getElementById("newsOverlay").addEventListener("click", (e) => { if (e.target.id === "newsOverlay") closeNewsScreen(); });
  // AJUSTE — "Continuar" só existe quando a tela faz parte do fluxo
  // pós-jogo (ver openNewsScreen/continueFromNewsScreen); o atalho de
  // classificação reaproveita o modal de tabela já existente, aberto
  // POR CIMA (mesmo padrão de sub-modal usado em todo o resto do app).
  document.getElementById("btnNewsContinue").addEventListener("click", continueFromNewsScreen);
  document.getElementById("btnNewsOpenTabela").addEventListener("click", openTabelaModal);

  // FASE 4 (item 6) — tela de premiações, aberta pelo menu "≡".
  document.getElementById("btnOpenAwards").addEventListener("click", () => {
    document.getElementById("topbarMenu").classList.remove("open");
    openAwardsScreen();
  });
  document.getElementById("awardsClose").addEventListener("click", closeAwardsScreen);
  document.getElementById("awardsOverlay").addEventListener("click", (e) => { if (e.target.id === "awardsOverlay") closeAwardsScreen(); });
  // FASE 4 (item 4) — perfil do técnico, aberto pelo menu "≡".
  document.getElementById("btnOpenCoachProfile").addEventListener("click", () => {
    document.getElementById("topbarMenu").classList.remove("open");
    openCoachProfileScreen();
  });
  document.getElementById("coachProfileClose").addEventListener("click", closeCoachProfileScreen);
  // Nova feature — Histórico de confrontos (H2H): card do próximo jogo
  // (ver renderCentral()) abre o retrospecto do adversário certo dessa
  // rodada; sem jogo marcado (folga/fim de temporada) o clique não faz
  // nada (dataset.opponentId nunca foi setado).
  document.getElementById("nextMatchBox").addEventListener("click", () => openH2H(document.getElementById("nextMatchBox").dataset.opponentId));
  document.getElementById("h2hClose").addEventListener("click", closeH2H);
  // Nova feature — Comparar jogadores (ver openComparePicker/handlePlayerAction).
  document.getElementById("compareClose").addEventListener("click", closeCompareScreen);
  document.getElementById("compareOverlay").addEventListener("click", (e) => { if (e.target.id === "compareOverlay") closeCompareScreen(); });
  // "Trocar jogador" (só visível no passo de resultado) volta pro
  // passo 1 sem fechar o modal nem perder o jogador de origem.
  document.getElementById("btnCompareChangePlayer").addEventListener("click", () => openComparePicker(COMPARE_BASE_ID));
  document.getElementById("coachProfileOverlay").addEventListener("click", (e) => { if (e.target.id === "coachProfileOverlay") closeCoachProfileScreen(); });
  // FASE 4 (item 4) — notificação de proposta de outro clube: X e
  // clique fora só fecham (sem aceitar nem recusar), reabrível pelo
  // card na Central (ver btnViewClubProposal/renderCentral).
  document.getElementById("clubProposalClose").addEventListener("click", closeClubProposalModal);
  document.getElementById("clubProposalOverlay").addEventListener("click", (e) => { if (e.target.id === "clubProposalOverlay") closeClubProposalModal(); });
  document.getElementById("btnClubProposalAccept").addEventListener("click", acceptClubProposal);
  document.getElementById("btnClubProposalDecline").addEventListener("click", declineClubProposal);
  document.getElementById("btnViewClubProposal").addEventListener("click", openClubProposalModal);
  document.getElementById("btnRestart").addEventListener("click", async () => {
    document.getElementById("topbarMenu").classList.remove("open");
    if (!CAREER) return;
    if (!(await confirmModal(`Isso vai apagar sua carreira atual no ${CAREER.clubName} e começar do zero. Continuar?`, "Apagar e reiniciar"))) return;
    await fetchJSON("/api/career", { method: "DELETE" }).catch(() => {});
    CAREER = null;
    // AJUSTE (pedido do usuário: "acrescentar a Série B, C [ao Modo
    // Carreira] com dados reais") — reiniciar é uma carreira nova de
    // verdade, então volta pro seletor de divisão também (antes ia
    // direto pra Escolha do Clube, sempre na mesma divisão de antes).
    renderCompetitionPicker();
    show("screenCompetitionPicker");
  });

  // AJUSTE (pedido do usuário: "o menu Mais está muito extenso ...
  // criação de submenus") — o popover agora tem uma raiz
  // (#topbarMenuRoot, só categorias + os 4 itens soltos) e N submenus
  // (".mt-topbar-submenu", um por categoria, começam escondidos —
  // ver CSS/HTML). showTopbarMenuRoot() volta pra raiz escondendo
  // qualquer submenu aberto; os botões ".group" fazem o caminho
  // inverso (escondem a raiz, mostram só o submenu clicado). Nenhum
  // botão-folha (Tabela, Notícias etc.) mudou de id/listener — só a
  // marcação ao redor deles.
  function showTopbarMenuRoot() {
    document.getElementById("topbarMenuRoot").classList.remove("hidden");
    document.querySelectorAll("#topbarMenu .mt-topbar-submenu").forEach((el) => el.classList.add("hidden"));
  }
  document.querySelectorAll("#topbarMenu .mt-topbar-menu-item.group").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("topbarMenuRoot").classList.add("hidden");
      document.querySelectorAll("#topbarMenu .mt-topbar-submenu").forEach((el) => {
        el.classList.toggle("hidden", el.dataset.submenuPanel !== btn.dataset.submenu);
      });
    });
  });
  document.querySelectorAll("#topbarMenu .mt-topbar-submenu-back").forEach((btn) => {
    btn.addEventListener("click", showTopbarMenuRoot);
  });
  // Menu (pedido do usuário: "o hambúrguer não ficaria melhor no
  // rodapé junto com os demais?") — antes um ícone solto no topbar
  // (#btnTopbarMenu), agora o botão "Menu" do rodapé (#btnBottomMenu,
  // ver .mt-bottom-nav) — mesmo popover #topbarMenu de sempre, só
  // reancorado (ver CSS) pra abrir a partir de baixo. Fecha ao clicar
  // em qualquer item, ao clicar fora, ou de novo no próprio botão.
  // Reabrir sempre volta pra raiz (showTopbarMenuRoot acima) — senão o
  // popover reabriria preso no último submenu visitado.
  document.getElementById("btnBottomMenu").addEventListener("click", (e) => {
    e.stopPropagation();
    const menu = document.getElementById("topbarMenu");
    const willOpen = !menu.classList.contains("open");
    if (willOpen) showTopbarMenuRoot();
    menu.classList.toggle("open", willOpen);
    document.getElementById("btnBottomMenu").setAttribute("aria-expanded", String(willOpen));
  });
  document.addEventListener("click", (e) => {
    const menu = document.getElementById("topbarMenu");
    if (menu.classList.contains("open") && !menu.contains(e.target) && e.target.id !== "btnBottomMenu") {
      menu.classList.remove("open");
      document.getElementById("btnBottomMenu").setAttribute("aria-expanded", "false");
    }
  });
  // AJUSTE (redesign M3 — documento "seguir o sugerido" pro nav de 5
  // itens: Início/Elenco/Tática/Mercado/Clube) — Mercado VOLTA pro
  // rodapé fixo (tinha saído antes, ver histórico); Tabela e Treinos
  // saem do rodapé (que agora só tem 5 destinos + Menu) e entram aqui,
  // mesmo padrão de sempre (switchToPanel já lida com qualquer nome,
  // mesmo sem um .m3-nav-item correspondente — só não marca nada como
  // "ativo" no rodapé, o que é o esperado aqui).
  document.getElementById("btnOpenTabela").addEventListener("click", () => {
    document.getElementById("topbarMenu").classList.remove("open");
    switchToPanel("tabela");
  });
  // Nova feature — Resumo da rodada, aberta pelo menu "≡".
  document.getElementById("btnOpenRodada").addEventListener("click", () => {
    document.getElementById("topbarMenu").classList.remove("open");
    openRodadaScreen();
  });
  document.getElementById("rodadaClose").addEventListener("click", closeRodadaScreen);
  document.getElementById("btnRodadaCloseFooter").addEventListener("click", closeRodadaScreen);
  document.getElementById("rodadaOverlay").addEventListener("click", (e) => { if (e.target.id === "rodadaOverlay") closeRodadaScreen(); });
  document.getElementById("rodadaTabAtual").addEventListener("click", () => renderRodada("atual"));
  document.getElementById("rodadaTabAnterior").addEventListener("click", () => renderRodada("anterior"));
  // Nova feature — Meus esquemas, aberta pelo menu "≡".
  document.getElementById("btnOpenSchemes").addEventListener("click", () => {
    document.getElementById("topbarMenu").classList.remove("open");
    openSchemesScreen();
  });
  document.getElementById("schemesClose").addEventListener("click", closeSchemesScreen);
  document.getElementById("schemesOverlay").addEventListener("click", (e) => { if (e.target.id === "schemesOverlay") closeSchemesScreen(); });
  document.getElementById("btnNewScheme").addEventListener("click", openNewSchemeSheet);
  document.getElementById("newSchemeClose").addEventListener("click", closeNewSchemeSheet);
  document.getElementById("newSchemeSheet").addEventListener("click", (e) => { if (e.target.id === "newSchemeSheet") closeNewSchemeSheet(); });
  document.getElementById("btnConfirmNewScheme").addEventListener("click", confirmNewScheme);
  document.getElementById("newSchemeNameInput").addEventListener("keydown", (e) => { if (e.key === "Enter") confirmNewScheme(); });
  // Nova feature — Marcação individual, aberta pelo menu "≡".
  document.getElementById("btnOpenMarking").addEventListener("click", () => {
    document.getElementById("topbarMenu").classList.remove("open");
    openManMarkingScreen();
  });
  document.getElementById("markingClose").addEventListener("click", closeManMarkingScreen);
  document.getElementById("markingOverlay").addEventListener("click", (e) => { if (e.target.id === "markingOverlay") closeManMarkingScreen(); });
  document.getElementById("btnApplyMarking").addEventListener("click", applyManMarking);
  document.getElementById("btnRemoveMarking").addEventListener("click", removeManMarking);
  // Nova feature — Instruções por setor, aberta pelo menu "≡".
  document.getElementById("btnOpenSector").addEventListener("click", () => {
    document.getElementById("topbarMenu").classList.remove("open");
    openSectorScreen();
  });
  document.getElementById("sectorClose").addEventListener("click", closeSectorScreen);
  document.getElementById("sectorOverlay").addEventListener("click", (e) => { if (e.target.id === "sectorOverlay") closeSectorScreen(); });
  document.querySelectorAll("#sectorTabs .m3-sector-tab").forEach((btn) => {
    btn.addEventListener("click", () => renderSectorScreen(btn.dataset.sector));
  });
  // Nova feature — Comissão Técnica, aberta pelo menu "≡".
  document.getElementById("btnOpenCommission").addEventListener("click", () => {
    document.getElementById("topbarMenu").classList.remove("open");
    openCommissionScreen();
  });
  document.getElementById("commissionClose").addEventListener("click", closeCommissionScreen);
  document.getElementById("commissionOverlay").addEventListener("click", (e) => { if (e.target.id === "commissionOverlay") closeCommissionScreen(); });
  document.getElementById("btnHireCommission").addEventListener("click", confirmHireCommission);
  document.getElementById("btnFireCommission").addEventListener("click", confirmFireCommission);
  document.getElementById("btnOpenTreinos").addEventListener("click", () => {
    document.getElementById("topbarMenu").classList.remove("open");
    switchToPanel("treinos");
  });
  document.getElementById("btnOpenEstatisticas").addEventListener("click", () => {
    document.getElementById("topbarMenu").classList.remove("open");
    switchToPanel("estatisticas");
  });
  // Retenção/Engajamento — mesmo padrão de Mercado/Estatísticas acima.
  // Objetivos/Conquistas já são recalculados a cada renderAll (ver
  // renderObjetivos/renderConquistas), então abrir o painel já mostra
  // tudo em dia; Ranking é diferente (async, publica o placar sempre
  // que abre, ver renderRanking) — chamado manualmente aqui em vez de
  // entrar em renderAll, pra não publicar score a cada re-render bobo.
  document.getElementById("btnOpenObjetivos").addEventListener("click", () => {
    document.getElementById("topbarMenu").classList.remove("open");
    switchToPanel("objetivos");
  });
  document.getElementById("btnOpenConquistas").addEventListener("click", () => {
    document.getElementById("topbarMenu").classList.remove("open");
    switchToPanel("conquistas");
  });
  document.getElementById("btnOpenRanking").addEventListener("click", () => {
    document.getElementById("topbarMenu").classList.remove("open");
    switchToPanel("ranking");
    renderRanking();
  });
  document.querySelectorAll("#objectivesTabs .mt-obj-tab").forEach((btn) => {
    btn.addEventListener("click", () => { OBJECTIVES_ACTIVE_TAB = btn.dataset.tab; renderObjetivos(); });
  });
  document.querySelectorAll("#achievementsFilters .mt-chip").forEach((chip) => {
    chip.addEventListener("click", () => { ACHIEVEMENTS_ACTIVE_FILTER = chip.dataset.filter; renderConquistas(); });
  });
  document.getElementById("achievementDetailClose").addEventListener("click", () => document.getElementById("achievementDetailOverlay").classList.remove("open"));
  document.querySelectorAll("#rankingScopeToggle .mt-scope-btn").forEach((btn) => {
    btn.addEventListener("click", () => { RANKING_ACTIVE_SCOPE = btn.dataset.scope; refreshRankingList(); });
  });
  document.getElementById("btnAddFriend").addEventListener("click", submitAddFriend);
  document.getElementById("btnClaimDailyLogin").addEventListener("click", claimDailyLoginNow);
  // Loja — mesmo padrão de Objetivos/Conquistas acima (switchToPanel já
  // chama renderLoja() ao entrar, ver switchToPanel).
  document.getElementById("btnOpenLoja").addEventListener("click", () => {
    document.getElementById("topbarMenu").classList.remove("open");
    switchToPanel("loja");
  });
  document.querySelectorAll("#lojaTabs .mt-obj-tab").forEach((btn) => {
    btn.addEventListener("click", () => { LOJA_ACTIVE_TAB = btn.dataset.tab; renderLoja(); });
  });
  document.getElementById("purchaseConfirmClose").addEventListener("click", () => document.getElementById("purchaseConfirmOverlay").classList.remove("open"));
  document.getElementById("btnCancelPurchase").addEventListener("click", () => document.getElementById("purchaseConfirmOverlay").classList.remove("open"));
  document.getElementById("btnConfirmPurchase").addEventListener("click", confirmPurchaseNow);
  document.getElementById("btnLogout").addEventListener("click", async () => {
    document.getElementById("topbarMenu").classList.remove("open");
    try { await fetchJSON("/api/auth/logout", { method: "POST" }); } catch { /* segue mesmo se falhar */ }
    location.href = "/";
  });
  // AJUSTE (refatoração completa, tela "Escolha do Clube") — mesmo
  // logout de sempre, só que a partir do ícone da topbar dessa tela
  // (que não tem menu de "≡" nenhum — carreira ainda não existe antes
  // de escolher o clube, então não tem Notícias/Premiações/Perfil do
  // Técnico pra mostrar ali; o ícone vira ação direta de sair).
  document.getElementById("btnPickerLogout").addEventListener("click", async () => {
    try { await fetchJSON("/api/auth/logout", { method: "POST" }); } catch { /* segue mesmo se falhar */ }
    location.href = "/";
  });
  // Fluxo de 2 passos (ver renderClubPicker/selectClubRow) — só inicia
  // a carreira quando o técnico já escolheu E confirmou.
  document.getElementById("btnConfirmClub").addEventListener("click", () => {
    if (PICKER_SELECTED_CLUB) startCareer(PICKER_SELECTED_CLUB);
  });
  // Mesmo botão/ação da Escolha do Clube, agora também na Escolha de
  // Campeonato (novo 1º passo, ver renderCompetitionPicker) — mesmo
  // motivo: nenhuma carreira existe ainda, não tem menu de verdade.
  document.getElementById("btnCompetitionPickerLogout").addEventListener("click", async () => {
    try { await fetchJSON("/api/auth/logout", { method: "POST" }); } catch { /* segue mesmo se falhar */ }
    location.href = "/";
  });

  // FASE 2 (c) — Mercado: busca/filtro re-renderizam a lista na hora
  // (sem debounce — a lista é local, filtrar de novo é instantâneo).
  document.getElementById("marketSearch").addEventListener("input", renderMercado);
  document.getElementById("marketPosFilter").addEventListener("change", renderMercado);
  document.getElementById("marketCompFilter").addEventListener("change", renderMercado);
  document.getElementById("btnAcceptOffer").addEventListener("click", acceptOffer);
  document.getElementById("btnDeclineOffer").addEventListener("click", declineOffer);
  document.getElementById("btnAskBoard").addEventListener("click", askBoard);

  // FASE 3 (c) — multitemporadas: avança a temporada (ver
  // advanceSeason) e mostra o resumo antes de liberar a Rodada 1 nova.
  document.getElementById("btnAdvanceSeason").addEventListener("click", async () => {
    if (!(await confirmModal(`Avançar pra Temporada ${CAREER.seasonYear + 1}? O elenco envelhece, contratos vencidos saem e a base renova.`, "Avançar"))) return;
    const result = await advanceSeason();
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
  // FASE 4 (item 4) — proposta de outro clube (se houver) só aparece
  // DEPOIS do resumo de virada de temporada, nunca em cima dele (ver
  // maybeGenerateClubProposals, chamado de dentro de advanceSeason).
  document.getElementById("btnSeasonContinue").addEventListener("click", () => {
    document.getElementById("seasonOverlay").classList.remove("open");
    renderAll();
    if ((CAREER.clubProposals || []).length) openClubProposalModal();
  });
  document.getElementById("seasonModalClose").addEventListener("click", () => {
    document.getElementById("seasonOverlay").classList.remove("open");
    renderAll();
    if ((CAREER.clubProposals || []).length) openClubProposalModal();
  });
  document.getElementById("btnDismissalContinue").addEventListener("click", async () => {
    document.getElementById("dismissalOverlay").classList.remove("open");
    // FASE 4 (item 4) — reputação/currículo sobrevivem à demissão (com
    // a penalidade de ser demitido, ver endCurrentClubStint) — precisa
    // rodar ANTES de apagar o save e zerar CAREER, que é de onde lê
    // clubId/clubName/seasonHistory/seasonAwards.
    endCurrentClubStint("dismissed");
    await fetchJSON("/api/career", { method: "DELETE" }).catch(() => {});
    CAREER = null;
    // AJUSTE (pedido do usuário, mesmo motivo do "Reiniciar" acima) —
    // demissão também é carreira nova, volta pro seletor de divisão.
    renderCompetitionPicker();
    show("screenCompetitionPicker");
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
  // FASE 4 (item 1) — sub-modal de conversa individual, mesmo padrão de
  // fechamento dos outros (X e clique fora fecham sem aplicar nada).
  document.getElementById("talkClose").addEventListener("click", closeTalkModal);
  document.getElementById("talkOverlay").addEventListener("click", (e) => { if (e.target.id === "talkOverlay") closeTalkModal(); });
  document.getElementById("talkOverlay").querySelectorAll("[data-talk]").forEach((btn) => {
    btn.addEventListener("click", () => applyTalkOption(btn.dataset.talk));
  });
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
  // Nova feature (Bloco 3) — sheet de "Fazer proposta" e tela "Minhas
  // propostas", mesmo padrão de fechamento das outras (X e clique fora
  // fecham sem enviar/mudar nada).
  document.getElementById("offerClose").addEventListener("click", closeOfferModal);
  document.getElementById("offerOverlay").addEventListener("click", (e) => { if (e.target.id === "offerOverlay") closeOfferModal(); });
  document.getElementById("btnOfferConfirm").addEventListener("click", confirmOfferFromModal);
  document.getElementById("btnOpenMyOffers").addEventListener("click", openMyOffersScreen);
  document.getElementById("myOffersClose").addEventListener("click", closeMyOffersScreen);
  document.getElementById("btnMyOffersCloseFooter").addEventListener("click", closeMyOffersScreen);
  document.getElementById("myOffersOverlay").addEventListener("click", (e) => { if (e.target.id === "myOffersOverlay") closeMyOffersScreen(); });
  // Nova feature (Bloco 3, 2/4) — "Comparar propostas", aberta a
  // partir de "Minhas propostas" quando há concorrente real.
  document.getElementById("offerCompareClose").addEventListener("click", closeOfferCompareScreen);
  document.getElementById("offerCompareOverlay").addEventListener("click", (e) => { if (e.target.id === "offerCompareOverlay") closeOfferCompareScreen(); });
  document.getElementById("btnOfferCompareIncrease").addEventListener("click", increaseOfferFromCompare);
  // Pedido do usuário: X também nas modais de detalhe do jogo e de
  // resultados da rodada (só fecha, igual às outras 2 — quem quiser ver
  // o próximo passo do fluxo clica em "Continuar" mesmo). AJUSTE
  // (pedido do usuário, revisão das modais de pós-jogo) — "Fechar" no
  // rodapé (ver #btnMatchDetailCloseFooter/#btnRoundResultsCloseFooter
  // em carreira.html) faz exatamente o mesmo que o X do cabeçalho, só
  // mais fácil de alcançar — mesma função pros dois.
  document.getElementById("matchDetailClose").addEventListener("click", closeMatchDetailModal);
  document.getElementById("btnMatchDetailCloseFooter").addEventListener("click", closeMatchDetailModal);
  document.getElementById("matchDetailOverlay").addEventListener("click", (e) => { if (e.target.id === "matchDetailOverlay") e.currentTarget.classList.remove("open"); });
  // Play-by-Play v1 — "Rever lances" (Tela hifi-03) abre POR CIMA do
  // "Seu jogo" (que continua aberto por baixo), mesmo padrão de
  // sub-modal já usado no resto do app.
  document.getElementById("btnMatchDetailReplay").addEventListener("click", openMatchReplay);
  document.getElementById("matchReplayClose").addEventListener("click", closeMatchReplay);
  document.getElementById("matchReplayOverlay").addEventListener("click", (e) => { if (e.target.id === "matchReplayOverlay") closeMatchReplay(); });
  document.getElementById("roundResultsClose").addEventListener("click", closeRoundResultsModal);
  document.getElementById("btnRoundResultsCloseFooter").addEventListener("click", closeRoundResultsModal);
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
  // AJUSTE (pedido do usuário: "acrescentar a Série B, C [ao Modo
  // Carreira] com dados reais") — carreira criada ANTES do seletor de
  // campeonato existir foi sempre Série A (não tinha outra opção),
  // então "brasileirao" é o default certo aqui, não uma suposição.
  if (!CAREER.competitionId) CAREER.competitionId = "brasileirao";
  if (!CAREER.leagueSquads) CAREER.leagueSquads = {};
  // Nova feature (pedido do usuário: "atributos precisam ser mais
  // reais... evolução menos agressiva") — save de ANTES desta mudança
  // não tinha p.potential pra jogador adulto (só base sempre teve) —
  // ver bloco de comentário grande acima de buildRealPlayer/
  // backfillPlayerPotential. Sem isso, o treino desse jogador cairia
  // no fallback de 99 (sem teto de verdade) até ele ser negociado/
  // renovado — melhor corrigir todo mundo já na migração.
  CAREER.squad.forEach(backfillPlayerPotential);
  Object.values(CAREER.leagueSquads).forEach((squad) => squad.forEach(backfillPlayerPotential));
  // Nova feature — Histórico de confrontos (H2H): carreira criada ANTES
  // desta mudança nunca gravou matchLog — sem migração retroativa (não
  // dá pra reconstruir partidas já jogadas), só passa a acumular daqui
  // pra frente.
  if (!CAREER.matchLog) CAREER.matchLog = [];
  // Nova feature (pedido do usuário: "reinicie o tema do
  // rebaixamento") — decisão do usuário: "só nas carreiras novas, sem
  // migração" — carreira criada ANTES desta mudança NUNCA ganha
  // CAREER.serieDPool/divisionTeams/otherDivisions aqui (ver
  // initDivisionSystem, só chamado por startCareer), então continua
  // pra sempre sem acesso/rebaixamento — todo o resto do sistema
  // (resolveOtherDivisionsRound/applyPromotionRelegation) já checa a
  // ausência desses campos e não faz nada nesse caso.
  // Nova feature — Meus esquemas: carreira criada ANTES desta mudança
  // nunca teve biblioteca de esquemas — sem migração retroativa (não
  // dá pra reconstruir esquemas nunca salvos), só passa a existir vazia
  // daqui pra frente, igual carreira nova.
  if (!CAREER.tacticalSchemes) CAREER.tacticalSchemes = [];
  if (CAREER.activeSchemeId === undefined) CAREER.activeSchemeId = null;
  if (CAREER.manMarking === undefined) CAREER.manMarking = null;
  // Nova feature — Comissão Técnica: carreira criada ANTES desta
  // mudança nunca teve isso — nasce não-contratada (sem custo nenhum
  // até o técnico decidir contratar), igual carreira nova.
  if (!CAREER.technicalStaff) CAREER.technicalStaff = { hired: false };
  // Nova feature (Bloco 3) — negociação de compra: carreira criada
  // ANTES desta mudança nunca teve proposta pendente nem parcela de
  // contratação nenhuma — nasce vazia, igual carreira nova.
  if (!CAREER.pendingOffersOut) CAREER.pendingOffersOut = [];
  if (!CAREER.pendingInstallments) CAREER.pendingInstallments = [];
  // AJUSTE (Bloco 2 M3, brtreinadorbloco2tatica.html) — tactics tinha 3
  // campos NOMEADOS (mentality/marking/tempo); vira 4 eixos NUMÉRICOS
  // 1-5 (ver TACTIC_AXES). Migra o que dá pra aproximar (tradução nossa
  // documentada, não uma equivalência perfeita — cada campo antigo
  // aponta pro eixo novo mais parecido: tempo→ritmo, mentalidade→
  // pressão E linha defensiva, já que "ofensiva" historicamente também
  // empurrava a linha pra frente); Estilo de passe não tem equivalente
  // antigo nenhum, nasce sempre neutro.
  if (CAREER.lineup && CAREER.lineup.tactics && CAREER.lineup.tactics.mentality !== undefined) {
    const old = CAREER.lineup.tactics;
    const MENT_TO_LEVEL = { defensiva: 2, equilibrada: 3, ofensiva: 4 };
    const TEMPO_TO_LEVEL = { paciente: 2, normal: 3, direto: 4 };
    CAREER.lineup.tactics = {
      ritmo: TEMPO_TO_LEVEL[old.tempo] ?? 3,
      pressao: MENT_TO_LEVEL[old.mentality] ?? 3,
      linhaDefensiva: MENT_TO_LEVEL[old.mentality] ?? 3,
      estiloPasse: 3,
    };
  }
  // Garantia geral — carreira sem tactics nenhum, ou faltando algum dos
  // 4 eixos por qualquer motivo, nasce neutra (nível 3) nesse eixo.
  if (CAREER.lineup && !CAREER.lineup.tactics) CAREER.lineup.tactics = {};
  if (CAREER.lineup) TACTIC_AXES.forEach((ax) => { if (CAREER.lineup.tactics[ax.id] == null) CAREER.lineup.tactics[ax.id] = 3; });
  // Nova feature — Instruções por setor: carreira criada ANTES desta
  // mudança nunca teve isso — nasce toda neutra (nível 3 em cada uma
  // das 15), igual carreira nova. Garante também cada instrução
  // individual (não só o objeto de cada setor) pro caso de um catálogo
  // futuro ganhar mais instruções sem quebrar save antigo.
  if (CAREER.lineup) {
    if (!CAREER.lineup.sectorTactics) CAREER.lineup.sectorTactics = defaultSectorTactics();
    SECTOR_IDS.forEach((sector) => {
      if (!CAREER.lineup.sectorTactics[sector]) CAREER.lineup.sectorTactics[sector] = {};
      SECTOR_INSTRUCTIONS[sector].forEach((instr) => {
        if (CAREER.lineup.sectorTactics[sector][instr.id] == null) CAREER.lineup.sectorTactics[sector][instr.id] = 3;
      });
    });
  }
  // AJUSTE (pedido do usuário: "o mercado deve trazer jogadores das 3
  // ligas") — carreira criada ANTES desta mudança nunca teve elenco
  // das outras 2 competições montado — marca explicitamente como
  // "single" (mercado só da própria divisão, do jeito que sempre foi)
  // pra enterAfterAuth/pickRandomOtherClub/etc. saberem que não é pra
  // tentar tratar como "multi" — decisão do usuário: sem migração
  // automática pra carreira já existente, só carreira nova nasce
  // "multi" (ver startCareer).
  if (!CAREER.marketScope) CAREER.marketScope = "single";
  // AJUSTE (pedido do usuário: "vamos evoluir o método de treinos") —
  // carreira criada ANTES desta mudança nunca teve plano de treino
  // (só o extinto CAREER.trainingFocus, um seletor só) — nasce migrada
  // pro esquema padrão "Equilíbrio Semanal", igual uma carreira nova.
  // trainingFocus em si fica órfão no save antigo (não é mais lido em
  // lugar nenhum) — inofensivo, sem precisar apagar explicitamente.
  if (!CAREER.trainingPlan) {
    CAREER.trainingSchemeId = "equilibrio";
    CAREER.trainingPlan = defaultTrainingPlan("equilibrio");
    CAREER.trainingAppliedForRound = null;
  }
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
    // FASE 4 (item 1) — jogador criado antes do relacionamento
    // jogador-técnico existir nasce nos mesmos valores neutros de quem
    // é criado hoje (sem histórico retroativo de banco pra reconstruir).
    if (p.benchStreak == null) p.benchStreak = 0;
    if (p.moraleReason == null) p.moraleReason = "Neutro no clube";
    if (p.moraleTrend == null) p.moraleTrend = "estavel";
    if (p.wantsTransfer == null) p.wantsTransfer = false;
    if (p.lastTalkRound === undefined) p.lastTalkRound = null;
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
  // FASE 4 (item 5) — carreira criada antes do patrocínio existir:
  // assina um contrato inicial de cada tipo, mesma função de sempre
  // (ver initSponsorship) — sem isso o save ficaria pra sempre sem
  // nenhum contrato (advanceSponsorshipSeason só MEXE em contrato que
  // já existe, não cria um do zero fora da virada de temporada).
  if (!CAREER.sponsorship) initSponsorship();
  // FASE 4 (item 3) — carreira criada antes das notícias da rodada:
  // sem histórico de jejum nenhum ainda, começa zerado (não tem como
  // reconstruir retroativamente quantas rodadas cada time já ficou sem
  // vencer).
  if (!CAREER.teamWinlessStreak) CAREER.teamWinlessStreak = {};
  // FASE 4 (item 6) — carreira criada antes das premiações existirem:
  // sem histórico nenhum ainda (não tem como reconstruir temporadas
  // passadas retroativamente).
  if (!CAREER.seasonAwards) CAREER.seasonAwards = [];
  // FASE 4 (item 4) — carreira criada antes da reputação existir nasce
  // no mesmo neutro (50) de quem começa hoje, sem currículo nenhum
  // (não tem como reconstruir passagens por clubes anteriores — essa
  // sempre foi a única carreira, então "sem histórico anterior" é
  // literalmente verdade aqui).
  if (CAREER.reputation == null) CAREER.reputation = 50;
  if (!CAREER.clubHistory) CAREER.clubHistory = [];
  if (!CAREER.clubProposals) CAREER.clubProposals = [];
  // AJUSTE — carreira criada antes do feed de notícias existir nasce
  // vazio (não tem como reconstruir manchetes de rodadas já passadas).
  if (!CAREER.newsFeed) CAREER.newsFeed = [];
  // FASE 4 (item 2) — carreira criada antes da coletiva de imprensa
  // existir nasce sem histórico nenhum (não tem como reconstruir
  // coletivas de jogos já passados retroativamente).
  if (!CAREER.pressLog) CAREER.pressLog = [];
  if (CAREER.metaRiskWarnedSeason === undefined) CAREER.metaRiskWarnedSeason = null;
  // Retenção/Engajamento — carreira criada antes deste bloco existir
  // nasce com objetivos/conquistas do zero (ensureObjectivesFresh já
  // cuida de gerar os 3 grupos na hora certa); contadores lifetime/
  // temporada começam em 0, sem reconstrução retroativa (mesmo padrão
  // de sempre nesta função pra dado que não dá pra recuperar do
  // histórico já resumido).
  ensureObjectivesFresh();
  if (!CAREER.achievements) CAREER.achievements = freshAchievementsState();
  if (CAREER.baseRevealedCount == null) CAREER.baseRevealedCount = 0;
  if (CAREER.titlesWonNacional == null) CAREER.titlesWonNacional = 0;
  if (CAREER.titlesWonCopa == null) CAREER.titlesWonCopa = 0;
  if (CAREER.seasonTeamGoals == null) CAREER.seasonTeamGoals = 0;
  if (CAREER.seasonTeamFouls == null) CAREER.seasonTeamFouls = 0;
  evaluateAlwaysCheckableAchievements();
}
// AJUSTE (pedido do usuário: "acrescentar a Série B, C [ao Modo
// Carreira] com dados reais") — loadLeague() não pode mais rodar
// cego pra "brasileirao" ANTES de saber se existe carreira salva: uma
// carreira salva na Série B precisa reabrir com o campeonato salvo
// (CAREER.competitionId), não sempre Série A. Sem carreira salva, quem
// decide o campeonato é o novo seletor (ver renderCompetitionPicker) —
// loadLeague só roda depois que ele escolher.
async function enterAfterAuth() {
  show("screenLoading");
  document.getElementById("screenLoading").innerHTML = `<div class="ct-spinner"></div><p>Carregando o Modo Técnico...</p>`;
  const saved = await fetchJSON("/api/career").catch(() => ({ career: null }));
  if (saved && saved.career) {
    // forceDemo só quando a carreira JÁ GRAVOU explicitamente que nasceu
    // em Modo Exemplo (liveMode === false) -- carreira bem antiga, de
    // antes desse campo existir (liveMode undefined), mantém o
    // comportamento de sempre (tenta dado real, cai pro exemplo se
    // faltar chave), sem mudança de risco pra quem nunca teve esse bug.
    const homeCompetitionId = saved.career.competitionId || "brasileirao";
    await loadLeague(homeCompetitionId, { forceDemo: saved.career.liveMode === false });
    // AJUSTE (pedido do usuário: "o mercado deve trazer jogadores das
    // 3 ligas") — carreira "multi" (ver startCareer) também recarrega
    // os times das outras 2 competições ao retomar, mesma trava de
    // forceDemo de cima, agora por competição (ver
    // liveModeByCompetition/loadOtherCompetitionsTeams): uma que já
    // gravou uma das outras 2 como Modo Exemplo nunca tenta dado real
    // sozinha pra ela. Carreira "single" (de antes desta mudança, sem
    // marketScope) não entra aqui — continua só com o mercado da
    // própria divisão, por decisão do usuário (sem migração automática).
    if (saved.career.marketScope === "multi") {
      const lm = saved.career.liveModeByCompetition || {};
      const forceDemoMap = {};
      ALL_COMPETITIONS_ORDER.forEach((c) => { if (lm[c] === false) forceDemoMap[c] = true; });
      await loadOtherCompetitionsTeams(homeCompetitionId, forceDemoMap);
    }
    CAREER = saved.career;
    migrateCareerDefaults();
    // Nova feature (pedido do usuário: "reinicie o tema do
    // rebaixamento") — CAREER.divisionTeams (quando existe) é a fonte
    // de verdade de "quem está em qual divisão agora" (ver comentário
    // grande em initDivisionSystem) — sobrescreve o que loadLeague/
    // loadOtherCompetitionsTeams acabaram de carregar do catálogo/API
    // (que não sabe nada sobre time que já subiu/desceu nesta
    // carreira) — sem efeito em carreira sem o sistema ativado.
    if (CAREER.divisionTeams) {
      LEAGUE_TEAMS = CAREER.divisionTeams[CURRENT_COMPETITION_ID];
      ALL_TEAMS_FLAT = ALL_COMPETITIONS_ORDER.flatMap((id) => CAREER.divisionTeams[id]);
    }
    persistCareer(); // grava os campos novos pra não migrar de novo (e de novo) a cada load
    showGameScreen();
  } else {
    renderCompetitionPicker();
    show("screenCompetitionPicker");
  }
}
async function boot() {
  applyStoredTheme();
  wireStaticListeners();
  try {
    const me = await fetchJSON("/api/auth/me").catch(() => ({ authenticated: false }));
    if (!me.authenticated) { show("screenLoginRequired"); return; }
    ME = me.user; // ver ME lá em cima -- friendCode/friends/dailyLogin/createdAt da conta, usados pelo bloco de Retenção/Engajamento
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
