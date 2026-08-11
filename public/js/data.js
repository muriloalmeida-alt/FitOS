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
const DEMO_TEAMS = [
  { id: "fla", name: "Flamengo",             short: "FLA", uf: "RJ", c1: "#E30613", c2: "#1A1A1A", atk: 1.85, def: 0.78 },
  { id: "pal", name: "Palmeiras",             short: "PAL", uf: "SP", c1: "#0B6E33", c2: "#F5F5F5", atk: 1.80, def: 0.75 },
  { id: "bot", name: "Botafogo",              short: "BOT", uf: "RJ", c1: "#1A1A1A", c2: "#FFFFFF", atk: 1.72, def: 0.82 },
  { id: "for", name: "Fortaleza",             short: "FOR", uf: "CE", c1: "#1E3A8A", c2: "#DC2626", atk: 1.55, def: 0.92 },
  { id: "int", name: "Internacional",         short: "INT", uf: "RS", c1: "#C8102E", c2: "#FFFFFF", atk: 1.60, def: 0.90 },
  { id: "sao", name: "São Paulo",             short: "SAO", uf: "SP", c1: "#C8102E", c2: "#1A1A1A", atk: 1.58, def: 0.88 },
  { id: "cor", name: "Corinthians",           short: "COR", uf: "SP", c1: "#1A1A1A", c2: "#FFFFFF", atk: 1.50, def: 0.95 },
  { id: "gre", name: "Grêmio",                short: "GRE", uf: "RS", c1: "#1E90CE", c2: "#1A1A1A", atk: 1.48, def: 0.97 },
  { id: "cap", name: "Athletico Paranaense",  short: "CAP", uf: "PR", c1: "#C8102E", c2: "#1A1A1A", atk: 1.52, def: 0.94 },
  { id: "cru", name: "Cruzeiro",              short: "CRU", uf: "MG", c1: "#003399", c2: "#FFFFFF", atk: 1.46, def: 0.98 },
  { id: "cam", name: "Atlético-MG",           short: "CAM", uf: "MG", c1: "#1A1A1A", c2: "#FFFFFF", atk: 1.51, def: 0.99 },
  { id: "bah", name: "Bahia",                 short: "BAH", uf: "BA", c1: "#1E3A8A", c2: "#DC2626", atk: 1.44, def: 1.02 },
  { id: "vas", name: "Vasco da Gama",         short: "VAS", uf: "RJ", c1: "#1A1A1A", c2: "#FFFFFF", atk: 1.40, def: 1.05 },
  { id: "flu", name: "Fluminense",            short: "FLU", uf: "RJ", c1: "#8A2432", c2: "#1E7A3D", atk: 1.38, def: 1.08 },
  { id: "san", name: "Santos",                short: "SAN", uf: "SP", c1: "#1A1A1A", c2: "#FFFFFF", atk: 1.35, def: 1.10 },
  { id: "bra", name: "Bragantino",            short: "BRA", uf: "SP", c1: "#DC2626", c2: "#FFFFFF", atk: 1.33, def: 1.12 },
  { id: "vit", name: "Vitória",               short: "VIT", uf: "BA", c1: "#DC2626", c2: "#1A1A1A", atk: 1.20, def: 1.22 },
  { id: "juv", name: "Juventude",             short: "JUV", uf: "RS", c1: "#1E7A3D", c2: "#FFFFFF", atk: 1.15, def: 1.28 },
  { id: "mir", name: "Mirassol",              short: "MIR", uf: "SP", c1: "#FFC93C", c2: "#1E7A3D", atk: 1.10, def: 1.30 },
  { id: "cui", name: "Cuiabá",                short: "CUI", uf: "MT", c1: "#1E3A8A", c2: "#FFC93C", atk: 1.08, def: 1.32 },
];

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
