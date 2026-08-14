/* Provider "sportmonks" — usa a Sportmonks Football API v3
   (https://www.sportmonks.com/football-api/), fornecedor comercial
   (planos a partir de €29/mês) com cobertura de Brasil/Inglaterra/
   Espanha + histórico, que foi o que levou a essa integração.

   HISTÓRICO DE AJUSTE (útil se aparecer outro erro parecido): a 1ª
   versão desse arquivo usava "includes aninhados" (sintaxe
   "relacao.subrelacao", ex.: "details.type", "player.position") em
   vários lugares — e a Sportmonks rejeitou com "You may not use more
   than 0 nested includes in this endpoint" assim que testado com um
   token de verdade (alguns endpoints da Sportmonks simplesmente não
   aceitam nenhum nível de aninhamento). A correção: em vez de pedir
   pra Sportmonks já devolver o nome resolvido de cada "tipo" via
   include aninhado, uso os IDS NUMÉRICOS FIXOS de cada tipo (ver
   STANDING_TYPE/EVENT_TYPE abaixo — conferidos via documentação
   pública, são constantes estáveis da Sportmonks) direto nos campos
   type_id que já vêm nos includes FLAT (sem ponto), sem precisar
   resolver nome nenhum.

   AJUSTE 2 (13/08/2026): o próprio getFixtures batia no MESMO erro
   "0 nested includes" contra /schedules/seasons/{id} MESMO com include
   flat (sem ponto nenhum: "participants;scores;state;round;venue") —
   confirmado com log real do Railway. Explicação: esse endpoint
   organiza a resposta por rodada/fase (season -> stage -> round ->
   fixtures), então pedir uma relação de NÍVEL DE JOGO (participants,
   scores...) já significa descer 1+ nível dentro dessa árvore, mesmo
   sem ponto na sintaxe — não é sobre a sintaxe do include, é sobre a
   PROFUNDIDADE do dado pedido em relação à raiz do endpoint. Troquei
   getFixtures pra usar /fixtures/between/{de}/{até} (endpoint de
   LISTAGEM DE JOGOS — não de calendário por temporada), filtrado por
   liga (filters=fixtureLeagues:ID) e pelas datas de início/fim da
   temporada (já vêm do mesmo /leagues/{id}?include=seasons de sempre)
   — nesse endpoint, participants/scores/etc. SÃO relações diretas do
   jogo (não precisam descer nenhum nível), o mesmo padrão que já
   funciona em getFixtureStatistics/Events/Lineups (/fixtures/{id}).
   Paginado via sportmonksGetAll (cursor, ver sportmonksClient.js) —
   uma temporada inteira passa fácil dos 25 itens por página padrão da
   Sportmonks. MESMA LIÇÃO se aparecer de novo em outro endpoint:
   confira se a relação pedida é de 1º nível DAQUELE endpoint
   específico, não só se a sintaxe do include tem ponto ou não.

   AJUSTE 3 (13/08/2026, mesmo dia): a troca acima resolveu o "nested
   includes", mas /fixtures/between/{de}/{até} tem outro limite
   documentado — MÁXIMO 100 DIAS entre "de" e "até" ("Invalid request
   parameters", confirmado com log real de novo). Uma temporada
   brasileira inteira (~10-11 meses) estoura isso fácil. Correção:
   chunkDateRange() abaixo quebra o intervalo da temporada em pedaços
   de até 100 dias, getFixtures dispara 1 requisição (já paginada) por
   pedaço e junta tudo (dedupe por id, embora não devesse haver
   sobreposição já que os pedaços são contíguos sem overlap).

   AJUSTE 4 (14/08/2026): getPlayersLeaders (Estatísticas > Jogadores)
   mostrava um "artilheiro" errado — /topscorers/seasons/{id} devolve
   VÁRIOS rankings misturados na mesma resposta (gols, assistências,
   cartões, nota), cada item com um type_id diferente (confirmado via
   documentação pública: GOALS=208, ASSISTS=209, CARDS=210,
   RATING=211 — ver TOPSCORER_TYPE abaixo), e o código tratava
   qualquer item como se fosse gol. Relatado pelo usuário ("o
   artilheiro real é outro", confirmado batendo com o Elenco, que usa
   getTeamPlayers — fonte diferente, sem esse problema). Corrigido
   agregando por jogador e só preenchendo o campo certo (goals/
   assists/yellow/rating) conforme o type_id de cada item.

   AJUSTE 5 (14/08/2026): getFixtureLineups (card "Escalação titular"
   na página do Time) tinha 3 problemas ao mesmo tempo, relatados pelo
   usuário como "está incorreto" + pedido de mostrar as posições reais
   no campinho: (1) titular vs banco usava formation_position
   preenchido como sinal — errado, o certo é type_id (11=titular,
   12=banco, confirmado via documentação pública); (2) "pos" de cada
   jogador (usada pra agrupar as linhas do campinho — goleiro/zaga/
   meio/ataque) nunca era lida, sempre null — o certo é position_id
   (24/25/26/27); (3) sem ordem nenhuma dentro de cada linha — agora
   usa formation_field ("linha:posição", ex.: "4:1") pra ordenar da
   esquerda pra direita. "formation" (ex.: "4-3-3") também nunca era
   preenchido — vem de um include separado (fixtures?include=formations).
   Ver LINEUP_TYPE/LINEUP_POSITION acima.

   AJUSTE 6 (14/08/2026): getFixtureStatistics (card "Desempenho" —
   radar ofensivo — na página do Time) vinha com posse/finalizações/
   escanteios/cartões sempre zerados, relatado pelo usuário como
   "Desempenho ofensivo não está ok". Era exatamente o ponto já
   sinalizado como não confirmado no AJUSTE anterior: a extração tinha
   2 problemas ao mesmo tempo — (1) tentava casar o TIPO de cada
   estatística pelo NOME (campo "type"), mas com include:"statistics"
   (sem o nested "statistics.type", que a gente nunca pediu) a API só
   devolve type_id numérico, nenhum nome — então nunca batia com
   nenhuma keyword; e (2) o valor de cada estatística não vem solto em
   "value", vem aninhado em "data.value" (formato confirmado via
   pesquisa pública: {id, fixture_id, type_id, participant_id, data:
   {value}, location}) — mesmo se o nome tivesse batido, o valor lido
   seria sempre undefined. Corrigido usando type_id numérico direto
   (mesmo padrão de STANDING_TYPE/EVENT_TYPE/PLAYER_STAT_TYPE acima —
   ver FIXTURE_STAT_TYPE) + lendo data.value. POSSESSION (45),
   SHOTS_TOTAL (42) e CORNERS (34) confirmados via pesquisa pública;
   YELLOWCARDS (84) e REDCARDS (83) reaproveitam os mesmos ids já
   confirmados contra uma resposta REAL no contexto de jogador (ver
   PLAYER_STAT_TYPE/AJUSTE 4) — tipos são globais na Sportmonks, o id
   de "cartão amarelo" é o mesmo não importa se é estatística de time,
   de jogador ou evento de partida. Ainda não testado contra uma
   resposta real de getFixtureStatistics especificamente (docs.
   sportmonks.com bloqueado nesse sandbox) — se posse/finalizações/
   escanteios ainda vierem errados (não necessariamente zerados dessa
   vez, já que a estrutura agora bate), esse é o lugar de novo.

   Cobertura: qualquer liga/temporada que o SEU plano na Sportmonks
   incluir (ver server/src/competitions.js). */

const { sportmonksGet, sportmonksGetAll, getQuota } = require("../sportmonksClient");

function hasCredential() { return !!process.env.SPORTMONKS_API_TOKEN; }

// Ids numéricos fixos da Sportmonks (não mudam, são constantes da
// plataforma) — conferidos via documentação pública. Usar isso em vez
// de nome evita depender de includes aninhados (ver aviso no topo).
const STANDING_TYPE = { PLAYED: 129, WON: 130, DRAW: 131, LOST: 132, GOALS_FOR: 133, GOALS_AGAINST: 134, GOAL_DIFF: 188 };
const EVENT_TYPE = { GOAL: 14, OWN_GOAL: 15, PENALTY: 16, MISSED_PENALTY: 17, SUBSTITUTION: 18, YELLOW_CARD: 19, RED_CARD: 20 };

// leagueId aqui é o id da liga NA SPORTMONKS (ver providerLeagueIds em
// competitions.js) — diferente da API-Sports, a Sportmonks não aceita
// liga+ano direto nos endpoints de dado: precisa resolver pro
// "seasonId" dela primeiro (um id só que já representa "essa liga,
// esse ano"). Cache em memória — a lista de temporadas de uma liga
// não muda de um dia pro outro. Guarda o objeto INTEIRO da temporada
// (não só o id) porque getFixtures também precisa de starting_at/
// ending_at (ver AJUSTE 2 no topo do arquivo).
const seasonCache = new Map();
async function resolveSeason(leagueId, season) {
  const key = `${leagueId}:${season}`;
  if (seasonCache.has(key)) return seasonCache.get(key);
  const league = await sportmonksGet(`/leagues/${leagueId}`, { include: "seasons" });
  const seasons = league?.seasons || [];
  const found = seasons.find((s) => String(s.name) === String(season))
    || seasons.find((s) => String(s.starting_at || "").startsWith(String(season)));
  if (!found) {
    const err = new Error(`Temporada ${season} não encontrada pra liga ${leagueId} na Sportmonks (confira as temporadas disponíveis no seu plano).`);
    err.status = 501; err.code = "NOT_SUPPORTED_BY_PROVIDER";
    throw err;
  }
  seasonCache.set(key, found);
  return found;
}
async function resolveSeasonId(leagueId, season) {
  const s = await resolveSeason(leagueId, season);
  return s.id;
}

function mapTeam(t) {
  if (!t) return null;
  return {
    id: t.id,
    name: t.name,
    short: (t.short_code || t.name || "???").toUpperCase().slice(0, 3),
    logo: t.image_path || null,
    venue: t.venue ? { name: t.venue.name || null, city: t.venue.city_name || null } : null,
  };
}

// Busca um item do array "details" da Sportmonks pelo type_id numérico
// (ver STANDING_TYPE acima) — sem depender de include aninhado.
function findDetailById(details, typeId) {
  const item = (details || []).find((d) => d.type_id === typeId);
  return item && item.value != null ? Number(item.value) : null;
}

function mapStandingEntry(entry) {
  const gp = findDetailById(entry.details, STANDING_TYPE.GOALS_FOR);
  const gc = findDetailById(entry.details, STANDING_TYPE.GOALS_AGAINST);
  let sg = findDetailById(entry.details, STANDING_TYPE.GOAL_DIFF);
  if (sg == null && gp != null && gc != null) sg = gp - gc;
  return {
    id: entry.participant?.id ?? entry.participant_id,
    rank: entry.position,
    // "points" costuma vir como campo direto na Sportmonks (não
    // dentro de "details") — fallback pro type_id só por precaução.
    pts: entry.points ?? findDetailById(entry.details, 187),
    j: findDetailById(entry.details, STANDING_TYPE.PLAYED),
    v: findDetailById(entry.details, STANDING_TYPE.WON),
    e: findDetailById(entry.details, STANDING_TYPE.DRAW),
    d: findDetailById(entry.details, STANDING_TYPE.LOST),
    gp, gc, sg,
  };
}

function mapStatus(shortName) {
  if (["FT", "AET", "PEN", "AWARDED"].includes(shortName)) return "FT";
  if (shortName === "NS" || !shortName) return "NS";
  return "LIVE"; // 1H, HT, 2H, ET etc.
}

// BUG CORRIGIDO (14/08/2026): "horário da partida" errado nos
// "Próximos jogos" — relatado pelo usuário. Causa (confirmada via
// pesquisa pública): a Sportmonks manda starting_at em UTC no formato
// "YYYY-MM-DD HH:mm:ss", SEM sufixo "Z"/offset nenhum. `new Date(...)`
// no front-end, sem esse sufixo, interpreta a string como hora LOCAL
// do dispositivo (não UTC) — o horário exibido saía deslocado pelo
// fuso horário de quem tava vendo (ou do ambiente de teste, cujo
// padrão costuma ser UTC) em vez de convertido certinho pra
// horário de Brasília. Corrigido normalizando pra ISO 8601 de
// verdade ("...T...Z") aqui, antes de devolver — front-end também
// passou a fixar timeZone:"America/Sao_Paulo" no toLocaleString (ver
// fmtFixtureDate em app.js), pra sempre mostrar hora de Brasília
// independente do fuso do aparelho de quem acessa (o app é sobre
// futebol brasileiro, os horários sempre são referenciados em BRT).
function normalizeUtcDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  return /[Zz]|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s.replace(" ", "T")}Z`;
}

function mapFixture(fx) {
  const home = (fx.participants || []).find((p) => p.meta?.location === "home");
  const away = (fx.participants || []).find((p) => p.meta?.location === "away");
  const scoreFor = (participantId) => {
    const s = (fx.scores || []).find((sc) => sc.participant_id === participantId && sc.description === "CURRENT");
    return s?.score?.goals ?? null;
  };
  return {
    id: fx.id,
    date: normalizeUtcDate(fx.starting_at),
    status: mapStatus(fx.state?.short_name),
    round: Number(fx.round?.name) || null,
    home: home?.id ?? null,
    away: away?.id ?? null,
    gh: home ? scoreFor(home.id) : null,
    ga: away ? scoreFor(away.id) : null,
    venue: fx.venue ? { name: fx.venue.name || null, city: fx.venue.city_name || null } : null,
  };
}

// BUG CORRIGIDO (14/08/2026): /topscorers/seasons/{id} NÃO devolve só
// artilheiros — devolve VÁRIOS rankings misturados na mesma resposta
// (artilharia, assistências, cartões, nota), cada item marcado com um
// type_id diferente (confirmado via documentação pública — sem isso
// não tinha como saber, a resposta não separa por endpoint nenhum).
// mapPlayerFromTopscorer tratava TODO item como se fosse artilheiro
// (usava item.total direto como "goals", não importa o type_id de
// verdade) — resultado: o "artilheiro" que aparecia em Estatísticas >
// Jogadores podia ser, na real, o líder de cartão ou assistência,
// dependendo da ordem em que os itens vieram. Relatado pelo usuário
// ("o artilheiro real é outro") e confirmado batendo com o Elenco
// (que usa uma fonte diferente, getTeamPlayers, e não tinha esse
// problema).
const TOPSCORER_TYPE = { GOALS: 208, ASSISTS: 209, CARDS: 210, RATING: 211 };

// AJUSTE (13/08/2026): item.appearances/goals/assists/yellowcards/
// redcards NUNCA vêm preenchidos aqui — o endpoint de elenco
// (/squads/teams/{id}) só devolve VÍNCULO do jogador com o time
// (posição, camisa...), não estatística de temporada nenhuma. Por
// isso "games"/"goals"/"assists" ficavam sempre null (Elenco aparecia
// com nome mas sem número nenhum). Agora recebe um objeto "stats" já
// pronto (ver playerSeasonStats abaixo, buscado separado por
// jogador) — sem ele, cai de volta pro item.xxx antigo só por
// garantia (não deveria nunca vir preenchido, mas não custa nada).
function mapPlayerFromSquad(item, stats) {
  const p = item.player;
  if (!p) return null;
  return {
    id: p.id,
    name: p.display_name || p.name,
    photo: p.image_path || null,
    teamId: item.team_id ?? null,
    position: null,
    games: stats?.games ?? item.appearances ?? null,
    goals: stats?.goals ?? item.goals ?? null,
    assists: stats?.assists ?? item.assists ?? null,
    yellow: stats?.yellow ?? item.yellowcards ?? null,
    red: stats?.red ?? item.redcards ?? null,
    rating: null,
  };
}

// Ids numéricos fixos da Sportmonks pra estatística de JOGADOR
// (diferente de STANDING_TYPE/EVENT_TYPE acima, que são de tabela e
// eventos de partida) — conferidos via documentação pública.
const PLAYER_STAT_TYPE = { APPEARANCES: 321, GOALS: 52, ASSISTS: 79, YELLOWCARDS: 84, REDCARDS: 83, REDCARDS_2ND_YELLOW: 85 };

// Soma os type_id de PLAYER_STAT_TYPE dentro do array "statistics" de
// 1 jogador (vindo de GET /players/{id}?include=statistics, filtrado
// por temporada — ver getPlayerSeasonStats abaixo). "statistics" pode
// vir com mais de 1 item mesmo filtrando por 1 temporada só (ex.:
// jogador que atuou por 2 times na mesma temporada) — por isso soma
// em vez de pegar só o primeiro. d.value tolera tanto um número direto
// quanto um objeto {total: N} (formato exato não confirmado contra
// resposta real — ver aviso no topo do arquivo).
function extractPlayerSeasonStats(statistics) {
  const out = { games: null, goals: null, assists: null, yellow: null, red: null };
  (statistics || []).forEach((stat) => {
    (stat.details || []).forEach((d) => {
      const raw = d.value?.total ?? d.value;
      const n = Number(raw);
      if (!Number.isFinite(n)) return;
      if (d.type_id === PLAYER_STAT_TYPE.APPEARANCES) out.games = (out.games || 0) + n;
      else if (d.type_id === PLAYER_STAT_TYPE.GOALS) out.goals = (out.goals || 0) + n;
      else if (d.type_id === PLAYER_STAT_TYPE.ASSISTS) out.assists = (out.assists || 0) + n;
      else if (d.type_id === PLAYER_STAT_TYPE.YELLOWCARDS) out.yellow = (out.yellow || 0) + n;
      else if (d.type_id === PLAYER_STAT_TYPE.REDCARDS || d.type_id === PLAYER_STAT_TYPE.REDCARDS_2ND_YELLOW) out.red = (out.red || 0) + n;
    });
  });
  return out;
}

// Log de diagnóstico — só dispara quando a extração deu em nada
// (nenhum type_id de PLAYER_STAT_TYPE bateu), pra não poluir o log
// numa temporada normal onde tudo funciona. Os type_id em
// PLAYER_STAT_TYPE foram conferidos via busca pública (não achei doc
// oficial acessível daqui pra bater 100%, ver histórico de ajuste no
// topo do arquivo) — se o elenco continuar sem número mesmo depois do
// fix anterior, essa linha aparece nos logs do Railway com o "raw" de
// verdade (1º jogador só, pra não floodar) e dá pra corrigir os
// type_id certos direto contra dado real, em vez de ficar chutando de
// novo.
let loggedEmptyStatsOnce = false;
function logEmptyStatsIfNeeded(playerId, statistics) {
  if (loggedEmptyStatsOnce) return;
  loggedEmptyStatsOnce = true;
  const typeIdsFound = (statistics || []).flatMap((s) => (s.details || []).map((d) => d.type_id));
  console.error(`[sportmonks] estatística de jogador ${playerId} não bateu com nenhum PLAYER_STAT_TYPE conhecido. ` +
    `statistics.length=${(statistics || []).length}, type_id encontrados=${JSON.stringify(typeIdsFound)}, ` +
    `raw (1º item)=${JSON.stringify(statistics?.[0] || null)}`);
}

// AJUSTE (13/08/2026): include=statistics (flat) devolvia cada item
// SEM o array "details" — só metadados (has_values:true, position_id,
// jersey_number), confirmado com log real do Railway. "details" aqui
// é sub-relação de CADA item de "statistics" (não do jogador direto),
// então precisa mesmo de um include ANINHADO — statistics.details —
// pra vir junto. Isso não contradiz o que foi aprendido antes: a
// restrição de "0 nested includes" era só de alguns endpoints
// específicos (schedules/seasons, standings/seasons — todos
// organizados como "temporada -> algo -> algo"), não universal;
// /players/{id} é um endpoint de 1 entidade só, mais provável de
// aceitar 1 nível de aninhamento (mesmo espírito do que já foi
// confirmado pra /fixtures/{id}, que aceita até 3 níveis segundo a
// doc pública). Se isso voltar a dar "nested includes" de novo, é
// porque esse endpoint específico também não aceita — nesse caso a
// saída seria um endpoint de estatística agregada por temporada (bulk,
// não por jogador), ainda não pesquisado.
//
// 1 chamada por jogador (GET /players/{id}?include=statistics.details,
// filtrado pra só trazer a temporada que interessa via
// playerStatisticSeasons). Tolerante a falha por jogador (um jogador
// sem estatística nessa temporada, ou uma chamada que falhe, não
// derruba o elenco inteiro — só aquele jogador fica sem número).
async function getPlayerSeasonStats(playerId, seasonId) {
  try {
    const p = await sportmonksGet(`/players/${playerId}`, {
      include: "statistics.details",
      filters: `playerStatisticSeasons:${seasonId}`,
    });
    const stats = extractPlayerSeasonStats(p?.statistics);
    if (Object.values(stats).every((v) => v == null)) logEmptyStatsIfNeeded(playerId, p?.statistics);
    return stats;
  } catch {
    return null;
  }
}

async function searchLeagues({ name }) {
  const leagues = await sportmonksGet("/leagues/search/" + encodeURIComponent(name || ""), { include: "country" });
  return (Array.isArray(leagues) ? leagues : [leagues]).filter(Boolean).map((l) => ({
    id: l.id, name: l.name, type: "League",
    country: l.country?.name || null,
    seasons: [],
  }));
}

async function getTeams({ leagueId, season }) {
  const seasonId = await resolveSeasonId(leagueId, season);
  const teams = await sportmonksGet(`/teams/seasons/${seasonId}`, { include: "venue" });
  return (teams || []).map(mapTeam).filter(Boolean);
}

async function getStandings({ leagueId, season }) {
  const seasonId = await resolveSeasonId(leagueId, season);
  const standings = await sportmonksGet(`/standings/seasons/${seasonId}`, { include: "participant;details" });
  return (standings || []).map(mapStandingEntry);
}

// Ver AJUSTE 3 no topo do arquivo — /fixtures/between/{de}/{até} só
// aceita até 100 dias entre as duas datas; quebra [from, to] numa
// lista de pedaços contíguos de até maxDays cada (o último pedaço fica
// menor, do jeito que sobrar). Datas em "YYYY-MM-DD" (mesmo formato
// que a Sportmonks espera na URL e que starting_at/ending_at já vêm).
function chunkDateRange(fromStr, toStr, maxDays = 100) {
  const chunks = [];
  const to = new Date(`${toStr}T00:00:00Z`);
  let cursor = new Date(`${fromStr}T00:00:00Z`);
  while (cursor <= to) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + maxDays - 1);
    if (chunkEnd > to) chunkEnd.setTime(to.getTime());
    chunks.push([cursor.toISOString().slice(0, 10), chunkEnd.toISOString().slice(0, 10)]);
    cursor = new Date(chunkEnd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return chunks;
}

// Ver AJUSTE 2 e 3 no topo do arquivo — /fixtures/between/{de}/{até}
// filtrado por liga, não /schedules/seasons/{id} (que rejeitava
// include de nível de jogo com "0 nested includes"); quebrado em
// pedaços de até 100 dias (limite da Sportmonks pra esse endpoint) e
// cada pedaço já paginado (uma temporada inteira, ~380 jogos num
// campeonato de 20 times, passa fácil do per_page padrão).
async function getFixtures({ leagueId, season }) {
  const s = await resolveSeason(leagueId, season);
  const start = String(s.starting_at || "").slice(0, 10);
  const end = String(s.ending_at || "").slice(0, 10);
  if (!start || !end) {
    const err = new Error(`Temporada ${season} da liga ${leagueId} não tem starting_at/ending_at na Sportmonks — não dá pra montar o calendário.`);
    err.status = 501; err.code = "NOT_SUPPORTED_BY_PROVIDER";
    throw err;
  }
  const chunks = chunkDateRange(start, end, 100);
  const perChunk = await Promise.all(chunks.map(([from, to]) =>
    sportmonksGetAll(`/fixtures/between/${from}/${to}`, {
      include: "participants;scores;state;round;venue",
      filters: `fixtureLeagues:${leagueId}`,
    })
  ));
  const byId = new Map();
  perChunk.flat().forEach((fx) => byId.set(fx.id, fx));
  return Array.from(byId.values()).map(mapFixture);
}

// Ver TOPSCORER_TYPE acima — a resposta mistura vários rankings
// (artilharia/assistência/cartão/nota), cada um top-25, então
// acumula por jogador em vez de mapear 1 item = 1 jogador: um mesmo
// player_id pode aparecer em mais de um ranking (ex.: no top 25 de
// gols E no top 25 de assistências), e cada aparição só preenche o
// campo daquele type_id específico — os campos que esse jogador não
// aparece em nenhum top-25 ficam null (não é "zero", é "não sabemos",
// já que só os 25 primeiros de cada categoria vêm nessa resposta).
// sportmonksGetAll (paginado) — top 25 de ~4 categorias facilmente
// passa dos 25 itens por página padrão da Sportmonks.
async function getPlayersLeaders({ leagueId, season }) {
  const seasonId = await resolveSeasonId(leagueId, season);
  const entries = await sportmonksGetAll(`/topscorers/seasons/${seasonId}`, { include: "player" });
  const byId = new Map();
  entries.forEach((item) => {
    const p = item.player;
    if (!p) return;
    if (!byId.has(p.id)) {
      byId.set(p.id, {
        id: p.id, name: p.display_name || p.name, photo: p.image_path || null,
        teamId: item.participant_id ?? null, position: null,
        games: null, goals: null, assists: null, yellow: null, red: null, rating: null,
      });
    }
    const entry = byId.get(p.id);
    const total = Number(item.total);
    if (!Number.isFinite(total)) return;
    if (item.type_id === TOPSCORER_TYPE.GOALS) entry.goals = total;
    else if (item.type_id === TOPSCORER_TYPE.ASSISTS) entry.assists = total;
    else if (item.type_id === TOPSCORER_TYPE.CARDS) entry.yellow = total; // agregado (não separa amarelo/vermelho) — melhor aproximação disponível dessa fonte
    else if (item.type_id === TOPSCORER_TYPE.RATING) entry.rating = total;
  });
  return Array.from(byId.values());
}

// BUG CORRIGIDO (13/08/2026): essa função usava
// /squads/seasons/{season}/teams/{teamId} sempre que "season" vinha
// preenchido (que é sempre — a rota /api/teams/:id/players em
// server.js exige season) — só que "season" aqui chega como o ANO
// (ex.: "2026", o mesmo valor cru do LIVE_SEASON), não como o
// seasonId NUMÉRICO INTERNO da Sportmonks que esse endpoint espera
// (ex.: 26763, ver resolveSeason acima) — e essa função nem recebe
// leagueId (ver contrato em providers/index.js) pra poder resolver o
// id certo. Resultado: sempre batia num id de temporada que não
// existe, a Sportmonks respondia com uma lista vazia (sem erro
// nenhum pra logar) e o elenco aparecia como "não disponível" sem
// pista nenhuma nos logs. Correção: usar sempre /squads/teams/{id}
// (elenco ATUAL do time, sem precisar de season/seasonId nenhum) — é
// exatamente o que a tela de "Elenco" mostra mesmo (o elenco de
// agora, não um histórico por temporada).
//
// AJUSTE (13/08/2026): elenco aparecia com nome mas sem jogos/gols/
// assistências — /squads/teams/{id} não traz estatística de temporada
// nenhuma (só vínculo do jogador com o time, ver mapPlayerFromSquad).
// Agora busca a estatística de CADA jogador do elenco em paralelo
// (getPlayerSeasonStats, 1 chamada por jogador — só dá pra saber a
// temporada certa se tiver leagueId, por isso esse parâmetro agora é
// aceito aqui; ver contrato em providers/index.js) e junta no mapeamento
// final. Custo: ~20-30 chamadas extra por time, mas cacheado por 12h
// no server (ver TTL.teams em server.js) — não bate na Sportmonks de
// novo a cada usuário que abre a mesma página de time. Tolerante a
// falha por jogador (getPlayerSeasonStats já trata isso) e também
// tolerante a leagueId ausente (aí cai sem estatística nenhuma, só
// nome/posição, em vez de quebrar a página inteira).
// sportmonksGetAll (paginado) — elenco com reservas facilmente passa
// dos 25 itens por página padrão da Sportmonks.
async function getTeamPlayers({ teamId, season, leagueId }) {
  const squad = await sportmonksGetAll(`/squads/teams/${teamId}`, { include: "player" });

  let statsByPlayerId = new Map();
  if (leagueId && season) {
    try {
      const seasonId = await resolveSeasonId(leagueId, season);
      const playerIds = squad.map((item) => item.player?.id).filter(Boolean);
      const statsList = await Promise.all(playerIds.map((pid) => getPlayerSeasonStats(pid, seasonId)));
      playerIds.forEach((pid, i) => { if (statsList[i]) statsByPlayerId.set(pid, statsList[i]); });
    } catch {
      // Temporada não resolvida (ver resolveSeason) — segue sem
      // estatística nenhuma, melhor um elenco incompleto do que a
      // página inteira quebrada.
    }
  }

  const byId = new Map();
  squad.forEach((item) => {
    const p = mapPlayerFromSquad(item, statsByPlayerId.get(item.player?.id));
    if (p) byId.set(p.id, p);
  });
  return Array.from(byId.values());
}

async function getPlayer({ playerId }) {
  const p = await sportmonksGet(`/players/${playerId}`, {});
  if (!p) return null;
  return {
    id: p.id, name: p.display_name || p.name, photo: p.image_path || null,
    teamId: null, position: null,
    games: null, goals: null, assists: null, yellow: null, red: null, rating: null,
  };
}

// Ver AJUSTE 6 no topo do arquivo — type_id numérico direto (não
// precisa do include aninhado "statistics.type" só pra saber o nome
// de um tipo que a gente já sabe o id), valor lido de "data.value"
// (não "value" solto). YELLOWCARDS/REDCARDS reaproveitam os mesmos
// ids de PLAYER_STAT_TYPE (tipos são globais na Sportmonks).
const FIXTURE_STAT_TYPE = {
  POSSESSION: 45, SHOTS_TOTAL: 42, CORNERS: 34,
  YELLOWCARDS: PLAYER_STAT_TYPE.YELLOWCARDS, REDCARDS: PLAYER_STAT_TYPE.REDCARDS,
};

async function getFixtureStatistics({ fixtureId, homeId, awayId }) {
  const fx = await sportmonksGet(`/fixtures/${fixtureId}`, { include: "statistics" });
  const stats = fx?.statistics || [];
  const statFor = (teamId, typeId) => {
    const found = stats.find((s) =>
      s.type_id === typeId && (s.participant_id === teamId || s.location === (teamId === homeId ? "home" : "away"))
    );
    return found?.data?.value != null ? Number(found.data.value) : 0;
  };
  const out = {
    posse: [statFor(homeId, FIXTURE_STAT_TYPE.POSSESSION), statFor(awayId, FIXTURE_STAT_TYPE.POSSESSION)],
    finalizacoes: [statFor(homeId, FIXTURE_STAT_TYPE.SHOTS_TOTAL), statFor(awayId, FIXTURE_STAT_TYPE.SHOTS_TOTAL)],
    escanteios: [statFor(homeId, FIXTURE_STAT_TYPE.CORNERS), statFor(awayId, FIXTURE_STAT_TYPE.CORNERS)],
    amarelos: [statFor(homeId, FIXTURE_STAT_TYPE.YELLOWCARDS), statFor(awayId, FIXTURE_STAT_TYPE.YELLOWCARDS)],
    vermelhos: [statFor(homeId, FIXTURE_STAT_TYPE.REDCARDS), statFor(awayId, FIXTURE_STAT_TYPE.REDCARDS)],
  };
  // Diagnóstico (só loga quando dá zero em tudo E a Sportmonks devolveu
  // pelo menos 1 estatística pra esse jogo — ou seja, o problema não é
  // "esse jogo não tem estatística", é "nenhum type_id conhecido bateu")
  // — mesmo espírito do log de getPlayerSeasonStats (AJUSTE 4): se o
  // FIXTURE_STAT_TYPE ainda estiver errado, o próximo relato do usuário
  // já vem com a forma real da resposta, sem precisar adivinhar de novo.
  const allZero = Object.values(out).every(([h, a]) => h === 0 && a === 0);
  if (allZero && stats.length) {
    const typeIdsFound = [...new Set(stats.map((s) => s.type_id))];
    console.error(`[sportmonks] estatística do jogo ${fixtureId} não bateu com nenhum FIXTURE_STAT_TYPE conhecido. ` +
      `statistics.length=${stats.length}, type_id encontrados=${JSON.stringify(typeIdsFound)}, ` +
      `raw (1º item)=${JSON.stringify(stats[0])}`);
  }
  return out;
}

async function getFixtureEvents({ fixtureId }) {
  const fx = await sportmonksGet(`/fixtures/${fixtureId}`, { include: "events" });
  const events = fx?.events || [];
  const goals = events
    .filter((e) => [EVENT_TYPE.GOAL, EVENT_TYPE.OWN_GOAL, EVENT_TYPE.PENALTY].includes(e.type_id))
    .map((e) => ({ team: e.participant_id, min: e.minute, playerId: e.player_id ?? null, player: e.player_name || "Desconhecido", detail: e.type_id === EVENT_TYPE.OWN_GOAL ? "Own Goal" : e.type_id === EVENT_TYPE.PENALTY ? "Penalty" : "Normal Goal" }))
    .sort((a, b) => a.min - b.min);
  const substitutions = events
    .filter((e) => e.type_id === EVENT_TYPE.SUBSTITUTION)
    .map((e) => ({ team: e.participant_id, min: e.minute, outId: e.related_player_id ?? null, out: e.related_player_name || "Desconhecido", inId: e.player_id ?? null, in: e.player_name || "Desconhecido" }))
    .sort((a, b) => a.min - b.min);
  return { goals, substitutions };
}

// BUG CORRIGIDO (14/08/2026): titular vs banco era um chute
// (formation_position preenchido = titular) — confirmado via
// documentação pública que o certo é type_id (11 = titular, 12 =
// banco). "pos" (posição do jogador — goleiro/zagueiro/meia/atacante,
// usada pra agrupar as linhas do campinho em formationPitchHTML no
// front-end) SEMPRE vinha null — também nunca lido de verdade; o
// campo certo é position_id (24=goleiro, 25=zagueiro, 26=meia,
// 27=atacante). formation_field (formato "linha:posição", ex.: "4:1")
// dá a ordem de esquerda pra direita dentro de cada linha — sem isso,
// os jogadores apareciam em qualquer ordem dentro da posição.
// "formation" (ex.: "4-3-3") vem de um include separado
// (fixtures?include=formations, por participant_id) — também nunca
// preenchido antes.
const LINEUP_TYPE = { STARTING: 11, BENCH: 12 };
const LINEUP_POSITION = { GOALKEEPER: 24, DEFENDER: 25, MIDFIELDER: 26, ATTACKER: 27 };
function mapLineupPosition(positionId) {
  switch (positionId) {
    case LINEUP_POSITION.GOALKEEPER: return "G";
    case LINEUP_POSITION.DEFENDER: return "D";
    case LINEUP_POSITION.MIDFIELDER: return "M";
    case LINEUP_POSITION.ATTACKER: return "F";
    default: return null;
  }
}
// "4:1" -> 1 (posição dentro da linha, usada só pra ordenar da
// esquerda pra direita) — null se não vier no formato esperado.
function formationFieldOrder(raw) {
  if (!raw) return null;
  const n = Number(String(raw).split(":").pop());
  return Number.isFinite(n) ? n : null;
}
async function getFixtureLineups({ fixtureId }) {
  const fx = await sportmonksGet(`/fixtures/${fixtureId}`, { include: "lineups;formations" });
  const formationByTeam = new Map();
  (fx?.formations || []).forEach((f) => {
    if (f.participant_id != null) formationByTeam.set(f.participant_id, f.formation || null);
  });

  const out = {};
  (fx?.lineups || []).forEach((entry) => {
    const teamId = entry.team_id;
    if (!teamId) return;
    if (!out[teamId]) out[teamId] = { formation: formationByTeam.get(teamId) || null, coach: null, startXI: [], substitutes: [] };
    const player = {
      id: entry.player_id ?? null,
      name: entry.player_name || "Desconhecido",
      number: entry.jersey_number ?? null,
      pos: mapLineupPosition(entry.position_id),
      _order: formationFieldOrder(entry.formation_field),
    };
    if (entry.type_id === LINEUP_TYPE.STARTING) out[teamId].startXI.push(player);
    else if (entry.type_id === LINEUP_TYPE.BENCH) out[teamId].substitutes.push(player);
  });
  // Ordena cada linha (mesma posição) da esquerda pra direita — quem
  // não tem formation_field (não deveria acontecer pra titular, mas
  // degrada bem) fica no fim. "_order" é só um campo interno de
  // ordenação, não faz parte do formato público — removido antes de
  // devolver.
  Object.values(out).forEach((t) => {
    t.startXI.sort((a, b) => (a._order ?? 99) - (b._order ?? 99));
    [...t.startXI, ...t.substitutes].forEach((p) => { delete p._order; });
  });
  return out;
}

async function getFixtureOdds({ fixtureId }) {
  const odds = await sportmonksGet(`/odds/pre-match/fixtures/${fixtureId}`, { include: "market;bookmaker" });
  const market = (odds || []).filter((o) => /match winner|1x2|full time result/i.test(o.market?.name || ""));
  if (!market.length) return null;
  const pick = (label) => {
    const o = market.find((m) => new RegExp(`^${label}$`, "i").test(m.label || ""));
    return o ? parseFloat(o.value) : null;
  };
  return {
    bookmaker: market[0]?.bookmaker?.name || null,
    home: pick("home") ?? pick("1"),
    draw: pick("draw") ?? pick("x"),
    away: pick("away") ?? pick("2"),
  };
}

// Emissora de TV nativa da Sportmonks (endpoint dedicado — não
// depende de "onde assistir" fazer casamento por nome de time/data
// como as fontes comunitárias externas em broadcastSource.js/
// epgSource.js; aqui é direto pelo fixtureId, sem ambiguidade
// nenhuma). Disponível em todos os planos da Sportmonks (Starter,
// Growth, Pro, Enterprise), confirmado via documentação pública. Um
// jogo pode ter mais de uma emissora (ex.: canal fechado + streaming)
// — junta os nomes com ", ".
async function getFixtureBroadcast({ fixtureId }) {
  const stations = await sportmonksGet(`/tv-stations/fixtures/${fixtureId}`, {});
  const names = (Array.isArray(stations) ? stations : []).map((s) => s.name).filter(Boolean);
  // Log só do caso "respondeu 200 OK, sem erro nenhum, mas a lista
  // veio vazia" — diferente de uma falha (essa já cai no logFailure()
  // de sportmonksClient.js), isso aqui é "a Sportmonks simplesmente
  // não tem emissora cadastrada pra esse jogo". Sem esse log, esse
  // caso específico (bem provável de ser o mais comum — nem toda liga/
  // jogo tem direito de transmissão mapeado) ficaria invisível nos
  // logs do Railway, obrigando a olhar a aba Network do navegador (que
  // não dá pra usar no celular).
  if (!names.length) console.log(`[sportmonks] /tv-stations/fixtures/${fixtureId} -> 0 emissoras cadastradas (resposta OK, lista vazia).`);
  return names.length ? names.join(", ") : null;
}

module.exports = {
  name: "sportmonks",
  requiresKey: true,
  hasCredential,
  searchLeagues, getTeams, getStandings, getFixtures,
  getPlayersLeaders, getTeamPlayers, getPlayer,
  getFixtureStatistics, getFixtureEvents, getFixtureLineups, getFixtureOdds,
  getFixtureBroadcast,
  getQuota,
};
