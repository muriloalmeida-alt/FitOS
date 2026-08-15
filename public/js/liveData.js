/* ===================================================================
   LIVEDATA.JS — Carrega dados reais via o backend (proxy da API-Sports)
   -------------------------------------------------------------------
   Se o backend não tiver uma API_SPORTS_KEY configurada, ou a chamada
   falhar por qualquer motivo, tryLoadLiveData() retorna null e o
   app.js segue no modo de exemplo (DEMO_TEAMS + calendário gerado).
=================================================================== */

// Temporada do modo ao vivo — NÃO é mais fixada aqui no código. Vem do
// backend (GET /api/health, campo "season", configurável via variável
// de ambiente LIVE_SEASON no Railway/host — ver server/.env.example)
// e é atualizada em tryLoadLiveData() antes de qualquer outra chamada
// usar esse valor como default. O ano atual aqui é só um chute inicial
// caso algo dispare uma chamada antes do health check responder.
let LIVE_SEASON = new Date().getFullYear();

async function safeFetchJSON(url) {
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.error) throw new Error(data?.error || `Falha ao buscar ${url}`);
  return data;
}

// Calibra força de ataque/defesa de cada time a partir da tabela real
// (gols marcados/sofridos por jogo, normalizados pela média da liga).
// Essa força alimenta o mesmo motor de Monte Carlo (engine.js) usado
// no modo de exemplo, agora com números tirados da temporada real.
function calibrateStrengths(standings) {
  const withGames = standings.filter(r => r.j > 0);
  if (!withGames.length) return {};
  const avg = withGames.reduce((s, r) => s + r.gp / r.j, 0) / withGames.length || 1;
  const out = {};
  standings.forEach(r => {
    const gfpg = r.j ? r.gp / r.j : avg;
    const gapg = r.j ? r.gc / r.j : avg;
    out[r.id] = {
      atk: clamp(gfpg / avg, 0.5, 2.3),
      def: clamp(gapg / avg, 0.4, 2.3),
    };
  });
  return out;
}

const PALETTE = ["#20D08A", "#3E7BFF", "#FFC93C", "#FF4D5E", "#8A2432", "#1E90CE", "#DC2626", "#0B6E33"];
function colorForId(id) { return PALETTE[id % PALETTE.length]; }

// BUG CORRIGIDO (pedido do usuário: "Os heros não estão nas cores dos
// times... Flamengo deve ser vermelho com degrade preto... Palmeiras
// deve ser verde e branco. Sempre respeitando as cores do clube") --
// em modo ao vivo, todo time usava colorForId(t.id) acima: um hash
// (id % paleta de 8 cores) sem NENHUMA relação com a cor de verdade
// do clube -- Flamengo podia sair azul, Palmeiras amarelo, dependendo
// só do id numérico que a Sportmonks/API-Sports desse a ele, e c2
// era sempre o mesmo #12121A fixo pra todo mundo. Corrigido
// reaproveitando o MESMO catálogo de cores já curado em data.js pro
// modo Exemplo (DEMO_DATA_BY_COMPETITION) -- casando por NOME
// normalizado (sem acento/maiúscula, mesma técnica de
// normalizeTeamName em app.js, mas duplicada aqui pra não depender de
// app.js, que carrega DEPOIS deste arquivo), pra não duplicar a lista
// de cores em 2 lugares -- Flamengo em modo ao vivo passa a usar
// exatamente o mesmo vermelho/preto que já usa no modo Exemplo. Time
// que não bate com nenhum nome do catálogo (só aconteceria pra um
// time de fora da lista curada dessa competição) cai pro hash antigo
// (colorForId), só pra nunca ficar sem degradê nenhum no hero.
function normalizeNameForColor(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function realTeamColor(name, competitionId) {
  const demoTeams = DEMO_DATA_BY_COMPETITION[competitionId]?.teams || [];
  const norm = normalizeNameForColor(name);
  const match = demoTeams.find(t => normalizeNameForColor(t.name) === norm);
  return match ? { c1: match.c1, c2: match.c2 } : null;
}

async function tryLoadLiveData(season = LIVE_SEASON, competitionId = "brasileirao") {
  try {
    const health = await safeFetchJSON("/api/health");
    if (!health.hasKey) {
      console.info("[liveData] Sem API_SPORTS_KEY configurada no servidor — usando modo de exemplo.");
      return null;
    }
    // A partir daqui, qualquer chamada nesse arquivo que use o default
    // `season = LIVE_SEASON` (elenco, jogador, ranking de jogadores)
    // já pega o valor configurado no backend, não o chute inicial.
    // Só vale pro Brasileirão Série A — as outras competições (Série
    // B/C/D, Copa do Brasil) usam a mesma temporada "atual" por
    // enquanto, ver server/src/competitions.js.
    if (health.season && competitionId === "brasileirao") { LIVE_SEASON = Number(health.season) || LIVE_SEASON; season = LIVE_SEASON; }

    const comp = `&competition=${encodeURIComponent(competitionId)}`;
    const [teamsData, standingsData, fixturesData] = await Promise.all([
      safeFetchJSON(`/api/teams?season=${season}${comp}`),
      safeFetchJSON(`/api/standings?season=${season}${comp}`),
      safeFetchJSON(`/api/fixtures?season=${season}${comp}`),
    ]);

    if (!teamsData.teams?.length || !fixturesData.fixtures?.length) {
      console.warn("[liveData] Resposta da API-Sports veio vazia — usando modo de exemplo.");
      return null;
    }

    const strengths = calibrateStrengths(standingsData.standings || []);
    const teams = teamsData.teams.map(t => {
      const realColor = realTeamColor(t.name, competitionId);
      return {
        ...t,
        atk: strengths[t.id]?.atk ?? 1.3,
        def: strengths[t.id]?.def ?? 1.05,
        c1: realColor?.c1 || colorForId(t.id),
        c2: realColor?.c2 || "#12121A",
      };
    });

    const allRounds = {};
    const results = {};
    let maxRound = 0;
    fixturesData.fixtures.forEach(fx => {
      if (!fx.round) return;
      maxRound = Math.max(maxRound, fx.round);
      allRounds[fx.round] = allRounds[fx.round] || [];
      allRounds[fx.round].push({ home: fx.home, away: fx.away, fixtureId: fx.id, date: fx.date, venue: fx.venue });
      if (["FT", "AET", "PEN"].includes(fx.status)) {
        results[`${fx.round}_${fx.home}_${fx.away}`] = {
          home: fx.home, away: fx.away, gh: fx.gh, ga: fx.ga, round: fx.round,
          fixtureId: fx.id, official: true, venue: fx.venue,
        };
      }
    });

    return {
      teams, allRounds, results,
      totalRounds: maxRound || 38,
      season,
    };
  } catch (err) {
    console.warn("[liveData] Não foi possível carregar dados reais, usando modo de exemplo:", err.message);
    return null;
  }
}

// Escalação (titulares + banco + formação + técnico) de UM jogo —
// compartilhada entre o card de jogo encerrado (escalação que jogou)
// e o de jogo futuro (escalação já publicada, quando existir). Lazy
// e cacheada: só busca quando o card é expandido, e só uma vez.
// BUG CORRIGIDO (15/08/2026): mesmo padrão do resto deste arquivo (ver
// AJUSTE em loadPlayersLeaders) — cacheava a PROMISE na hora, então uma
// falha passageira (ou o jogo ainda não ter escalação publicada, que
// também devolve {} normalmente) ficava presa em cache pro resto da
// sessão. Pra escalação isso é ainda mais relevante: {} "ainda não
// publicada" é um estado que muda com o tempo (a escalação sai perto
// do jogo) — não cachear o vazio faz o app tentar de novo na próxima
// vez que o card for expandido, em vez de ficar preso em "não
// disponível" pro resto da sessão mesmo depois de publicada.
const fixtureLineupsCache = new Map();
async function loadFixtureLineups(fixtureId) {
  const cached = fixtureLineupsCache.get(fixtureId);
  if (cached && Object.keys(cached).length) return cached;
  try {
    const data = await safeFetchJSON(`/api/fixtures/${fixtureId}/lineups`);
    const lineups = data.lineups || {};
    if (Object.keys(lineups).length) fixtureLineupsCache.set(fixtureId, lineups);
    return lineups;
  } catch {
    return {};
  }
}

// Emissora de TV de UM jogo — GET /api/broadcast já tenta EPG
// (epgSource.js) e depois TheSportsDB (broadcastSource.js). O
// fornecedor de dados esportivos ativo (ex.: Sportmonks tvStations)
// FOI TIRADO dessa busca (ver aviso em server.js) — devolvia lista
// genérica de emissoras possíveis da competição, não o canal
// específico do jogo; fixtureId continua sendo mandado pra rota (usa
// só no log do servidor agora, ver server.js) caso isso mude no
// futuro. Lazy, cacheada, e tolerante a falha: erro vira null, o
// front-end cai no texto genérico nesse caso. Resolve pra
// { station, source } | null.
// BUG CORRIGIDO (15/08/2026): mesmo padrão do resto deste arquivo —
// null (falha OU sem emissora achada) não é mais gravado em cache, só
// o resultado com emissora de verdade.
const broadcastCache = new Map();
async function loadBroadcastInfo(dateIso, homeName, awayName, fixtureId) {
  const day = String(dateIso || "").slice(0, 10);
  const key = `${day}:${homeName}:${awayName}:${fixtureId || ""}`;
  const cached = broadcastCache.get(key);
  if (cached) return cached;
  const fx = fixtureId ? `&fixtureId=${encodeURIComponent(fixtureId)}` : "";
  try {
    const r = await safeFetchJSON(`/api/broadcast?date=${encodeURIComponent(day)}&home=${encodeURIComponent(homeName)}&away=${encodeURIComponent(awayName)}${fx}`);
    const info = r.station ? { station: r.station, source: r.source || null } : null;
    if (info) broadcastCache.set(key, info);
    return info;
  } catch {
    return null;
  }
}

// Busca estatísticas + gols + substituições + escalação de UM jogo já
// encerrado — lazy, só quando o usuário expande aquele card em "Jogos".
// BUG CORRIGIDO (15/08/2026): antes cacheava a PROMISE do Promise.all
// direto, sem nenhum .catch — se qualquer uma das 3 chamadas falhasse
// (ex.: 429 do rate-limit de leitura pública), a promise REJEITADA
// ficava presa em cache pro resto da sessão, e todo mundo que abrisse
// aquele card de novo esbarrava na mesma rejeição, pra sempre. Agora só
// entra em cache depois de um sucesso de verdade — falha propaga o
// erro pra quem chamou (igual antes), mas a PRÓXIMA tentativa busca de
// novo em vez de reusar a rejeição antiga.
const fixtureDetailCache = new Map();
async function loadFixtureDetails(fixtureId, homeId, awayId) {
  const cached = fixtureDetailCache.get(fixtureId);
  if (cached) return cached;
  const [statsRes, eventsRes, lineups] = await Promise.all([
    safeFetchJSON(`/api/fixtures/${fixtureId}/statistics?home=${homeId}&away=${awayId}`),
    safeFetchJSON(`/api/fixtures/${fixtureId}/events`),
    loadFixtureLineups(fixtureId),
  ]);
  const result = { stats: statsRes.stats, goals: eventsRes.goals, substitutions: eventsRes.substitutions, lineups };
  fixtureDetailCache.set(fixtureId, result);
  return result;
}

// Versão mais leve de loadFixtureDetails: só a estatística (sem
// eventos/escalação) — usada no preenchimento em massa de m.stats pra
// VÁRIOS jogos de uma vez (ver ensureLeagueCardStats em app.js), onde
// só interessa cartão/posse/finalizações/escanteios, não vale a pena
// pagar as 2 chamadas extra (eventos + escalação) por jogo.
async function loadFixtureStatisticsOnly(fixtureId, homeId, awayId) {
  const res = await safeFetchJSON(`/api/fixtures/${fixtureId}/statistics?home=${homeId}&away=${awayId}`);
  return res.stats;
}

// Busca odds (1X2) de UM jogo específico ainda não realizado — lazy,
// só quando o card daquela partida é renderizado na tela.
// BUG CORRIGIDO (15/08/2026): antes cacheava a PROMISE sem nenhum
// .catch — falha (ex.: 429 do rate-limit de leitura pública) virava
// uma promise REJEITADA presa em cache pro resto da sessão. Agora só
// cacheia depois de um sucesso de verdade; falha devolve null (odds
// ainda não disponíveis é um estado normal/temporário, não erro) e
// tenta buscar de novo na próxima vez que o card for renderizado.
const fixtureOddsCache = new Map();
async function loadFixtureOdds(fixtureId) {
  const cached = fixtureOddsCache.get(fixtureId);
  if (cached) return cached;
  try {
    const r = await safeFetchJSON(`/api/fixtures/${fixtureId}/odds`);
    if (r.odds) fixtureOddsCache.set(fixtureId, r.odds);
    return r.odds;
  } catch {
    return null;
  }
}

// Histórico de movimentação de odds (gravado pelo próprio backend a
// cada consulta — ver server/src/oddsHistory.js). Sem cache local
// porque o range pode mudar (24h/7d/30d).
async function loadOddsHistory(fixtureId, range) {
  try {
    const data = await safeFetchJSON(`/api/fixtures/${fixtureId}/odds/history?range=${range}`);
    return data.points || [];
  } catch {
    return [];
  }
}

// Ranking de jogadores (gols, assistências, cartões, nota) — lazy,
// só busca quando o usuário abre a sub-aba "Jogadores" em
// Estatísticas (ver app.js). Cacheado em memória: a lista não muda
// dentro de uma mesma sessão de navegação.
//
// BUG CORRIGIDO (14/08/2026): "Mais cartões" (Estatísticas) e o card
// "Cartões" da sub-aba Jogadores ficavam zerados/vazios pro resto da
// sessão inteira mesmo em modo ao vivo, relatado pelo usuário. Causa:
// `if (playersLeadersCache) return ...` tratava um array VAZIO como
// "já carreguei, não precisa buscar de novo" (em JS, [] é truthy) —
// então se a 1ª tentativa falhasse ou voltasse vazia (instabilidade
// pontual da Sportmonks, timeout, etc.), o resultado vazio ficava
// gravado em cache PERMANENTEMENTE, e nenhuma tentativa nova acontecia
// depois, nem trocando de página/aba. Correção: só entra no cache um
// resultado que realmente veio com jogador — resultado vazio (erro OU
// resposta genuinamente sem dados) NÃO é gravado, então a próxima
// tentativa de usar essa função tenta buscar de novo.
let playersLeadersCache = null;
async function loadPlayersLeaders(season = LIVE_SEASON, competitionId = "brasileirao") {
  if (playersLeadersCache && playersLeadersCache.length) return playersLeadersCache;
  try {
    const data = await safeFetchJSON(`/api/players/leaders?season=${season}&competition=${encodeURIComponent(competitionId)}`);
    const players = data.players || [];
    if (players.length) playersLeadersCache = players;
    return players;
  } catch (err) {
    console.warn("[liveData] Não foi possível carregar estatísticas de jogadores:", err.message);
    return [];
  }
}

// Notícias sobre futebol brasileiro — fonte independente da
// API-Sports (ver server/src/newsSource.js), funciona igual em modo
// demo ou ao vivo. Cacheada em memória: uma busca por sessão de
// navegação (o backend já cacheia 20min do lado dele também).
// teamName opcional — busca notícias só daquele time (usado pelo card
// "Últimas notícias" do Dashboard quando há um Clube Favorito
// selecionado); cache separado do feed genérico, por nome de time.
// BUG CORRIGIDO (15/08/2026): mesmo padrão do resto deste arquivo —
// lista vazia (falha OU realmente sem notícia nenhuma) não é mais
// gravada em cache, só um resultado com notícia de verdade.
const newsCache = new Map(); // chave: "" (genérico) ou nome do time
async function loadNews(teamName = "") {
  const key = teamName || "";
  const cached = newsCache.get(key);
  if (cached && cached.length) return cached;
  try {
    const url = teamName ? `/api/news?team=${encodeURIComponent(teamName)}` : "/api/news";
    const r = await safeFetchJSON(url);
    const items = r.items || [];
    if (items.length) newsCache.set(key, items);
    return items;
  } catch {
    return [];
  }
}

// Lista de campeonatos disponíveis (Brasileirão Série A + Série B/C —
// as duas últimas ainda "em breve", ver server/src/competitions.js) e
// as temporadas de histórico do plano Enterprise, já anotadas com o
// que o plano do usuário logado libera. Usada só pra atualizar os
// itens da barra lateral (ver applyCompetitionsSidebar em app.js) —
// não bloqueia o boot do app se essa chamada falhar.
async function loadCompetitionsInfo() {
  try {
    return await safeFetchJSON("/api/competitions");
  } catch (err) {
    console.warn("[competitions] não foi possível carregar a lista de campeonatos:", err.message);
    return null;
  }
}

// Elenco completo de UM time — lazy, só quando a página de detalhe
// do time é aberta em modo ao vivo. Cacheado por time. competitionId
// precisa ir junto (ver /api/teams/:id/players em server.js) — alguns
// fornecedores precisam saber a liga pra resolver estatística de
// jogador por temporada.
// BUG CORRIGIDO (15/08/2026): mesmo padrão já corrigido em
// loadPlayersLeaders (empty array é truthy) — antes cacheava a PROMISE
// na hora, então qualquer falha passageira (ex.: 429 do rate-limit de
// leitura pública, ver publicRateLimit.js) virava "" [] permanente pro
// resto da sessão, sem tentar de novo nunca mais. Relatado pelo
// usuário como "elenco não disponível". Agora só guarda em cache
// quando vem elenco de verdade — falha simplesmente tenta buscar de
// novo na próxima vez que a página desse time abrir.
const teamRosterCache = new Map();
async function loadTeamRoster(teamId, season = LIVE_SEASON, competitionId = "brasileirao") {
  const cached = teamRosterCache.get(teamId);
  if (cached && cached.length) return cached;
  try {
    const data = await safeFetchJSON(`/api/teams/${teamId}/players?season=${season}&competition=${encodeURIComponent(competitionId)}`);
    const players = data.players || [];
    if (players.length) teamRosterCache.set(teamId, players);
    return players;
  } catch (err) {
    console.warn("[liveData] Não foi possível carregar elenco:", err.message);
    return [];
  }
}

// Busca 1 jogador específico por id — fallback pra quando a página
// de detalhe do jogador abre pra alguém que não está nem nos líderes
// (Estatísticas > Jogadores) nem no elenco já carregado de algum time.
// BUG CORRIGIDO (15/08/2026): mesmo padrão do resto deste arquivo —
// null (falha OU jogador realmente não encontrado) não é mais gravado
// em cache, só um resultado com jogador de verdade.
const singlePlayerCache = new Map();
async function loadPlayerById(playerId, season = LIVE_SEASON) {
  const cached = singlePlayerCache.get(playerId);
  if (cached) return cached;
  try {
    const r = await safeFetchJSON(`/api/players/${playerId}?season=${season}`);
    if (r.player) singlePlayerCache.set(playerId, r.player);
    return r.player || null;
  } catch {
    return null;
  }
}
