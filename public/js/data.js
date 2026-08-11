/* ===================================================================
   DATA.JS — Dados de exemplo do Brasileirão 2026
   -------------------------------------------------------------------
   Este arquivo concentra TODOS os dados "mockados" do protótipo.
   Para ligar o site a dados reais, basta substituir:
     - TEAMS        -> times, força de ataque/defesa e cores
     - (opcional)   -> trocar o gerador de tabela/rodadas por uma
                        chamada fetch() para sua API de resultados
   O motor de simulação (engine.js) não precisa mudar.
=================================================================== */

// RNG determinístico (mulberry32) — garante que o "primeiro turno"
// gerado seja sempre o mesmo a cada carregamento da página.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Amostra de distribuição de Poisson (número de gols de um time)
function poissonSample(lambda, rng) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}

/* 20 clubes de exemplo — nomes reais do futebol brasileiro, mas
   força de ataque/defesa e posição na tabela são FICTÍCIAS,
   usadas apenas quando não há integração com a API-Sports ativa.
   Em modo "ao vivo" (ver js/liveData.js), este array é substituído
   pelos times e força real calculados a partir da tabela atual. */
// venue = estádio-sede real de cada clube (dado público estável — não
// é estatística fictícia, só contexto de local do jogo).
const DEMO_TEAMS = [
  { id: "fla", name: "Flamengo",             short: "FLA", uf: "RJ", c1: "#E30613", c2: "#1A1A1A", atk: 1.85, def: 0.78, venue: { name: "Maracanã", city: "Rio de Janeiro" } },
  { id: "pal", name: "Palmeiras",             short: "PAL", uf: "SP", c1: "#0B6E33", c2: "#F5F5F5", atk: 1.80, def: 0.75, venue: { name: "Allianz Parque", city: "São Paulo" } },
  { id: "bot", name: "Botafogo",              short: "BOT", uf: "RJ", c1: "#1A1A1A", c2: "#FFFFFF", atk: 1.72, def: 0.82, venue: { name: "Nilton Santos", city: "Rio de Janeiro" } },
  { id: "for", name: "Fortaleza",             short: "FOR", uf: "CE", c1: "#1E3A8A", c2: "#DC2626", atk: 1.55, def: 0.92, venue: { name: "Arena Castelão", city: "Fortaleza" } },
  { id: "int", name: "Internacional",         short: "INT", uf: "RS", c1: "#C8102E", c2: "#FFFFFF", atk: 1.60, def: 0.90, venue: { name: "Beira-Rio", city: "Porto Alegre" } },
  { id: "sao", name: "São Paulo",             short: "SAO", uf: "SP", c1: "#C8102E", c2: "#1A1A1A", atk: 1.58, def: 0.88, venue: { name: "Morumbis", city: "São Paulo" } },
  { id: "cor", name: "Corinthians",           short: "COR", uf: "SP", c1: "#1A1A1A", c2: "#FFFFFF", atk: 1.50, def: 0.95, venue: { name: "Neo Química Arena", city: "São Paulo" } },
  { id: "gre", name: "Grêmio",                short: "GRE", uf: "RS", c1: "#1E90CE", c2: "#1A1A1A", atk: 1.48, def: 0.97, venue: { name: "Arena do Grêmio", city: "Porto Alegre" } },
  { id: "cap", name: "Athletico Paranaense",  short: "CAP", uf: "PR", c1: "#C8102E", c2: "#1A1A1A", atk: 1.52, def: 0.94, venue: { name: "Ligga Arena", city: "Curitiba" } },
  { id: "cru", name: "Cruzeiro",              short: "CRU", uf: "MG", c1: "#003399", c2: "#FFFFFF", atk: 1.46, def: 0.98, venue: { name: "Mineirão", city: "Belo Horizonte" } },
  { id: "cam", name: "Atlético-MG",           short: "CAM", uf: "MG", c1: "#1A1A1A", c2: "#FFFFFF", atk: 1.51, def: 0.99, venue: { name: "Arena MRV", city: "Belo Horizonte" } },
  { id: "bah", name: "Bahia",                 short: "BAH", uf: "BA", c1: "#1E3A8A", c2: "#DC2626", atk: 1.44, def: 1.02, venue: { name: "Arena Fonte Nova", city: "Salvador" } },
  { id: "vas", name: "Vasco da Gama",         short: "VAS", uf: "RJ", c1: "#1A1A1A", c2: "#FFFFFF", atk: 1.40, def: 1.05, venue: { name: "São Januário", city: "Rio de Janeiro" } },
  { id: "flu", name: "Fluminense",            short: "FLU", uf: "RJ", c1: "#8A2432", c2: "#1E7A3D", atk: 1.38, def: 1.08, venue: { name: "Maracanã", city: "Rio de Janeiro" } },
  { id: "san", name: "Santos",                short: "SAN", uf: "SP", c1: "#1A1A1A", c2: "#FFFFFF", atk: 1.35, def: 1.10, venue: { name: "Vila Belmiro", city: "Santos" } },
  { id: "bra", name: "Bragantino",            short: "BRA", uf: "SP", c1: "#DC2626", c2: "#FFFFFF", atk: 1.33, def: 1.12, venue: { name: "Nabi Abi Chedid", city: "Bragança Paulista" } },
  { id: "vit", name: "Vitória",               short: "VIT", uf: "BA", c1: "#DC2626", c2: "#1A1A1A", atk: 1.20, def: 1.22, venue: { name: "Barradão", city: "Salvador" } },
  { id: "juv", name: "Juventude",             short: "JUV", uf: "RS", c1: "#1E7A3D", c2: "#FFFFFF", atk: 1.15, def: 1.28, venue: { name: "Alfredo Jaconi", city: "Caxias do Sul" } },
  { id: "mir", name: "Mirassol",              short: "MIR", uf: "SP", c1: "#FFC93C", c2: "#1E7A3D", atk: 1.10, def: 1.30, venue: { name: "Campos Maia", city: "Mirassol" } },
  { id: "cui", name: "Cuiabá",                short: "CUI", uf: "MT", c1: "#1E3A8A", c2: "#FFC93C", atk: 1.08, def: 1.32, venue: { name: "Arena Pantanal", city: "Cuiabá" } },
];

/* Jogadores de exemplo (fictícios) — 4 por time, usados na sub-aba
   "Jogadores" de Estatísticas quando não há integração ao vivo com a
   API-Sports. Nomes são combinações aleatórias (com seed fixo, pra
   ficarem estáveis entre recarregamentos) de nomes comuns — NÃO
   representam atletas reais, só como a força de ataque/defesa dos
   times em DEMO_TEAMS acima. */
const DEMO_FIRST_NAMES = ["Gabriel", "Lucas", "Matheus", "Rafael", "Bruno", "Diego", "Thiago", "Felipe", "Vitor", "Gustavo", "Rodrigo", "Leonardo", "Danilo", "Wesley", "Everton", "Kaique", "Yuri", "Igor", "Renan", "Caio"];
const DEMO_LAST_NAMES = ["Souza", "Silva", "Oliveira", "Santos", "Pereira", "Costa", "Almeida", "Ribeiro", "Carvalho", "Gomes", "Martins", "Araújo", "Barbosa", "Rocha", "Dias", "Nascimento", "Moreira", "Cardoso", "Teixeira", "Lopes"];
const DEMO_POSITIONS = ["Attacker", "Midfielder", "Defender", "Goalkeeper"];

function buildDemoPlayers(teams) {
  const rng = mulberry32(20260101); // seed fixo -> mesmo elenco fictício a cada carregamento
  const players = [];
  let idSeq = 1;
  teams.forEach(team => {
    for (let i = 0; i < 4; i++) {
      const first = DEMO_FIRST_NAMES[Math.floor(rng() * DEMO_FIRST_NAMES.length)];
      const last = DEMO_LAST_NAMES[Math.floor(rng() * DEMO_LAST_NAMES.length)];
      const position = DEMO_POSITIONS[i % DEMO_POSITIONS.length];
      const isGK = position === "Goalkeeper";
      const isAttacker = position === "Attacker";
      players.push({
        id: idSeq++,
        name: `${first} ${last}`,
        photo: null,
        teamId: team.id,
        position,
        goals: isGK ? 0 : Math.round(rng() * (isAttacker ? 22 : 8)),
        assists: isGK ? 0 : Math.round(rng() * (isAttacker ? 10 : 12)),
        yellow: Math.round(rng() * 9) + 1,
        red: rng() < 0.12 ? 1 : 0,
        rating: +(6.2 + rng() * 2.3).toFixed(2),
      });
    }
  });
  return players;
}
const DEMO_PLAYERS = buildDemoPlayers(DEMO_TEAMS);

/* Escalação e substituições fictícias — usadas no card de jogo
   expandido (aba Jogos) quando não há integração ao vivo. Geradas
   por partida com seed determinístico (mesma rodada/mesmo confronto
   sempre dá a mesma escalação fictícia, sem precisar guardar nada).
   Nomes são fictícios, igual DEMO_PLAYERS acima — não representam
   atletas reais. */
const DEMO_FORMATIONS = ["4-3-3", "4-4-2", "4-2-3-1", "4-1-4-1", "3-5-2"];
const DEMO_FORMATION_SLOTS = {
  "4-3-3": ["G", "D", "D", "D", "D", "M", "M", "M", "F", "F", "F"],
  "4-4-2": ["G", "D", "D", "D", "D", "M", "M", "M", "M", "F", "F"],
  "4-2-3-1": ["G", "D", "D", "D", "D", "M", "M", "M", "M", "M", "F"],
  "4-1-4-1": ["G", "D", "D", "D", "D", "M", "M", "M", "M", "M", "F"],
  "3-5-2": ["G", "D", "D", "D", "M", "M", "M", "M", "M", "F", "F"],
};
function seededRngFromKey(key) {
  const seed = Array.from(String(key)).reduce((s, c) => (s + c.charCodeAt(0) * 31) | 0, 0);
  return mulberry32(seed);
}
function demoRandomName(rng) {
  const first = DEMO_FIRST_NAMES[Math.floor(rng() * DEMO_FIRST_NAMES.length)];
  const last = DEMO_LAST_NAMES[Math.floor(rng() * DEMO_LAST_NAMES.length)];
  return `${first} ${last}`;
}
function buildDemoLineupSide(seedKey) {
  const rng = seededRngFromKey(seedKey);
  const formation = DEMO_FORMATIONS[Math.floor(rng() * DEMO_FORMATIONS.length)];
  const slots = DEMO_FORMATION_SLOTS[formation];
  const usedNumbers = new Set([1]); // 1 fica reservado pro goleiro
  const nextNumber = (isGK) => {
    if (isGK) return 1;
    let n;
    do { n = 2 + Math.floor(rng() * 98); } while (usedNumbers.has(n));
    usedNumbers.add(n);
    return n;
  };
  const startXI = slots.map(pos => ({ name: demoRandomName(rng), number: nextNumber(pos === "G"), pos }));
  const substitutes = Array.from({ length: 7 }, (_, i) => ({ name: demoRandomName(rng), number: nextNumber(false), pos: ["G", "D", "M", "F"][i % 4] }));
  return { formation, coach: demoRandomName(rng), startXI, substitutes };
}
// Retorna { [homeId]: {...}, [awayId]: {...} } — mesmo formato do
// mapLineups() do backend, pra renderLineups() no app.js não precisar
// saber se está em modo demo ou ao vivo.
function buildDemoLineups(seedKey, homeId, awayId) {
  return {
    [homeId]: buildDemoLineupSide(`${seedKey}:home`),
    [awayId]: buildDemoLineupSide(`${seedKey}:away`),
  };
}
function buildDemoSubstitutions(seedKey, homeId, awayId, lineups) {
  const rng = seededRngFromKey(`${seedKey}:subs`);
  const events = [];
  [homeId, awayId].forEach(teamId => {
    const lineup = lineups[teamId];
    if (!lineup) return;
    const outfield = lineup.startXI.filter(p => p.pos !== "G");
    const bench = [...lineup.substitutes];
    const subCount = Math.min(2 + Math.floor(rng() * 2), outfield.length, bench.length);
    for (let i = 0; i < subCount; i++) {
      const outIdx = Math.floor(rng() * outfield.length);
      const inIdx = Math.floor(rng() * bench.length);
      const min = 46 + Math.floor(rng() * 44); // 46'-89'
      events.push({ team: teamId, min, out: outfield[outIdx].name, in: bench[inIdx].name });
      outfield.splice(outIdx, 1);
      bench.splice(inIdx, 1);
    }
  });
  return events.sort((a, b) => a.min - b.min);
}

/* Gera calendário de turno + returno (método do círculo) já "achatado"
   num objeto { 1: [...jogos], 2: [...], ..., 38: [...] }.
   Usado apenas no modo demo — no modo ao vivo o calendário real vem
   da API-Sports (ver js/liveData.js). */
function generateAllRounds(teamIds) {
  const teams = [...teamIds];
  if (teams.length % 2 !== 0) teams.push(null);
  const n = teams.length;
  const roundsPerLeg = n - 1;
  const half = n / 2;
  const turno = [];
  let arr = [...teams];
  for (let r = 0; r < roundsPerLeg; r++) {
    const roundMatches = [];
    for (let i = 0; i < half; i++) {
      const home = arr[i];
      const away = arr[n - 1 - i];
      if (home !== null && away !== null) {
        if (r % 2 === 0) roundMatches.push({ home, away });
        else roundMatches.push({ home: away, away: home });
      }
    }
    turno.push(roundMatches);
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop());
    arr = [fixed, ...rest];
  }
  const returno = turno.map(round => round.map(m => ({ home: m.away, away: m.home })));

  const allRounds = {};
  turno.forEach((round, i) => allRounds[i + 1] = round);
  returno.forEach((round, i) => allRounds[roundsPerLeg + i + 1] = round);
  return allRounds; // { 1: [...], ..., 38: [...] }
}
