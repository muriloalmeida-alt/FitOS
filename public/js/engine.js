/* ===================================================================
   ENGINE.JS — Motor de simulação do Brasileirão
   -------------------------------------------------------------------
   Regras de classificação (padrão Série A, ajustável em CONFIG):
     1º              -> Campeão
     1º ao 6º         -> Libertadores (G6)
     7º ao 12º        -> Sul-Americana
     17º ao 20º        -> Rebaixamento (Z4)
=================================================================== */

const CONFIG = {
  libertadores: 6,   // quantas vagas de G-Libertadores
  sulamericana: 6,   // quantas vagas de Sul-Americana logo abaixo
  rebaixamento: 4,   // quantos caem
  totalTeams: 20,
};

// TEAM_MAP é reconstruído sempre que os times ativos mudam
// (troca entre modo demo e modo ao vivo — ver setActiveTeams em app.js).
let TEAM_MAP = {};
function setTeamMap(teams) {
  TEAM_MAP = Object.fromEntries(teams.map(t => [t.id, t]));
  CONFIG.totalTeams = teams.length;
}

// Simula um jogo único a partir da força dos times. Retorna placar + stats.
function simulateMatch(homeId, awayId, rng) {
  const H = TEAM_MAP[homeId], A = TEAM_MAP[awayId];
  const HOME_ADV = 1.12;
  const lambdaHome = H.atk / A.def * HOME_ADV;
  const lambdaAway = A.atk / H.def;
  const gh = poissonSample(lambdaHome, rng);
  const ga = poissonSample(lambdaAway, rng);

  // Estatísticas de exemplo, plausíveis a partir do placar/força
  const posseHome = clamp(Math.round(50 + (H.atk - A.atk) * 12 + (rng() - 0.5) * 8), 32, 68);
  const finalizacoesHome = clamp(Math.round(8 + gh * 2.2 + rng() * 6), 4, 24);
  const finalizacoesAway = clamp(Math.round(8 + ga * 2.2 + rng() * 6), 4, 24);
  const escanteiosHome = clamp(Math.round(3 + rng() * 6 + gh), 1, 14);
  const escanteiosAway = clamp(Math.round(3 + rng() * 6 + ga), 1, 14);
  const faltasHome = clamp(Math.round(9 + rng() * 8), 4, 22);
  const faltasAway = clamp(Math.round(9 + rng() * 8), 4, 22);
  const amarelosHome = clamp(Math.round(rng() * 4), 0, 6);
  const amarelosAway = clamp(Math.round(rng() * 4), 0, 6);
  const vermelhoHome = rng() < 0.04 ? 1 : 0;
  const vermelhoAway = rng() < 0.04 ? 1 : 0;

  const goals = [];
  for (let i = 0; i < gh; i++) goals.push({ team: homeId, min: 1 + Math.floor(rng() * 90), camisa: 1 + Math.floor(rng() * 30) });
  for (let i = 0; i < ga; i++) goals.push({ team: awayId, min: 1 + Math.floor(rng() * 90), camisa: 1 + Math.floor(rng() * 30) });
  goals.sort((a, b) => a.min - b.min);

  return {
    home: homeId, away: awayId, gh, ga,
    stats: {
      posse: [posseHome, 100 - posseHome],
      finalizacoes: [finalizacoesHome, finalizacoesAway],
      escanteios: [escanteiosHome, escanteiosAway],
      faltas: [faltasHome, faltasAway],
      amarelos: [amarelosHome, amarelosAway],
      vermelhos: [vermelhoHome, vermelhoAway],
    },
    goals,
  };
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// Calcula a tabela de classificação a partir de uma lista de jogos concluídos
function computeStandings(matches) {
  const table = {};
  Object.keys(TEAM_MAP).forEach(id => table[id] = {
    id, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0, pts: 0
  });
  matches.forEach(m => {
    const H = table[m.home], A = table[m.away];
    H.j++; A.j++;
    H.gp += m.gh; H.gc += m.ga;
    A.gp += m.ga; A.gc += m.gh;
    if (m.gh > m.ga) { H.v++; H.pts += 3; A.d++; }
    else if (m.gh < m.ga) { A.v++; A.pts += 3; H.d++; }
    else { H.e++; A.e++; H.pts += 1; A.pts += 1; }
  });
  Object.values(table).forEach(r => r.sg = r.gp - r.gc);
  return Object.values(table).sort(sortStandings);
}

// Critérios de desempate: pontos, vitórias, saldo de gols, gols pró
function sortStandings(a, b) {
  return (b.pts - a.pts) || (b.v - a.v) || (b.sg - a.sg) || (b.gp - a.gp) || a.id.localeCompare(b.id);
}

// Rotula a posição segundo as zonas de classificação
function zoneOfPosition(pos) {
  if (pos === 1) return "campeao";
  if (pos <= CONFIG.libertadores) return "libertadores";
  if (pos <= CONFIG.libertadores + CONFIG.sulamericana) return "sulamericana";
  if (pos > CONFIG.totalTeams - CONFIG.rebaixamento) return "rebaixamento";
  return "meio";
}

/* Monte Carlo: simula os jogos restantes N vezes e tabula em quantas
   simulações cada time termina campeão / G6 / Sul-Americana / Z4.
   playedMatches = jogos já concluídos (fixos)
   remainingFixtures = array de {home, away} ainda não jogados */
function runMonteCarlo(playedMatches, remainingFixtures, iterations = 1500, seed = 12345) {
  const rng = mulberry32(seed);
  const counts = {};
  Object.keys(TEAM_MAP).forEach(id => counts[id] = { campeao: 0, libertadores: 0, top4: 0, sulamericana: 0, rebaixamento: 0, posSum: 0 });

  for (let it = 0; it < iterations; it++) {
    const simMatches = [...playedMatches];
    remainingFixtures.forEach(fx => {
      const r = simulateMatch(fx.home, fx.away, rng);
      simMatches.push(r);
    });
    const table = computeStandings(simMatches);
    table.forEach((row, idx) => {
      const pos = idx + 1;
      const zone = zoneOfPosition(pos);
      counts[row.id].posSum += pos;
      if (zone === "campeao") counts[row.id].campeao++;
      if (zone === "campeao" || zone === "libertadores") counts[row.id].libertadores++;
      if (pos <= 4) counts[row.id].top4++;
      if (zone === "sulamericana") counts[row.id].sulamericana++;
      if (zone === "rebaixamento") counts[row.id].rebaixamento++;
    });
  }

  const result = {};
  Object.entries(counts).forEach(([id, c]) => {
    result[id] = {
      campeao: c.campeao / iterations,
      libertadores: c.libertadores / iterations,
      top4: c.top4 / iterations,
      sulamericana: c.sulamericana / iterations,
      rebaixamento: c.rebaixamento / iterations,
      posMedia: c.posSum / iterations,
    };
  });
  return result;
}
