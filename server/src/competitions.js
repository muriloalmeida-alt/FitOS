/* Registro de campeonatos suportados — a peça central da expansão
   multi-campeonato. Estratégia atual (Sportmonks, ver
   server/src/providers/sportmonks.js): Freemium/Lite ficam só com o
   Brasileirão Série A (grátis); Pro/Enterprise desbloqueiam os outros
   4 campeonatos nacionais contratados — Série B, Série C, Série D e
   Copa do Brasil. (Premier League/La Liga continuam cadastradas mais
   abaixo pra não perder o trabalho já feito, mas saíram do foco — ver
   histórico da conversa; não fazem mais parte do plano contratado.)

   IMPORTANTE: cada entrada aqui já é capaz de puxar dado real assim
   que:
     (a) o fornecedor ativo (ver server/src/providers/, escolhido pela
         env var DATA_PROVIDER) tiver credencial configurada,
     (b) o plano contratado nesse fornecedor cobrir aquela liga/
         temporada (nem todo tier cobre todas as ligas, e planos free
         geralmente só cobrem temporada corrente — confirme antes de
         ativar), e
     (c) o id numérico da liga NESSE FORNECEDOR estiver preenchido em
         `providerLeagueIds` (ver abaixo).

   `providerLeagueIds` guarda o id de cada campeonato NO FORNECEDOR
   (o mesmo campeonato pode ter ids diferentes em cada um — por isso é
   um objeto por fornecedor, não um valor único). Ao adicionar um novo
   fornecedor em providers/, é só somar a entrada dele aqui (ex.:
   `sportmonks: "123"`) — resolveCompetition() (ver server.js) já
   resolve automaticamente pro fornecedor ativo. Campeonato bem
   conhecido/popular (Brasileirão, Premier League, La Liga) teve o id
   confirmado via busca pública; Série B/C/D e Copa do Brasil NÃO —
   Sportmonks não expõe esses ids fora da própria API/documentação
   (atrás de login), então cada um vem de uma env var própria (ver
   sportmonksIdFromEnv abaixo e server/.env.example) que você preenche
   depois de descobrir o id certo em GET /api/leagues/search?name=Brazil
   rodando no seu host de verdade (esse ambiente de desenvolvimento não
   consegue falar com a Sportmonks pra descobrir sozinho).

   Até você confirmar a cobertura (e preencher o id, quando aplicável),
   cada campeonato fica com `enabled:false` — aparece no app como "em
   breve" (Pro/Enterprise) ou bloqueado por plano (Freemium/Lite) em
   vez de tentar buscar um dado que ainda não existe (ou que existe mas
   não está incluído no seu plano — daria erro da própria API).
   Enquanto isso, o plano que libera aquele campeonato continua
   explorando ele normalmente em modo exemplo (ver
   DEMO_DATA_BY_COMPETITION em public/js/data.js) — habilitar aqui só
   troca esse modo exemplo por dado real.

   ATIVAÇÃO — via variável de ambiente (Railway/host), SEM editar
   código nem dar redeploy manual de código:
     ENABLED_COMPETITIONS=serie_b,serie_c,serie_d,copa_do_brasil
   Lista separada por vírgula com os "id" que você quer habilitar (os
   mesmos ids do array COMPETITIONS abaixo — "brasileirao" já vem
   habilitado sempre, não precisa incluir). Pra habilitar só uma:
     ENABLED_COMPETITIONS=serie_b
   Pra desabilitar de novo (voltar pro modo exemplo), tire o id da
   lista (ou apague a variável pra desabilitar todas). Ver
   server/.env.example. */

const DEFAULT_SEASON = process.env.LIVE_SEASON || "2023";

// "premier_league,la_liga" -> Set{"premier_league","la_liga"} (trim +
// minúsculo, pra tolerar espaço depois da vírgula ou maiúscula por
// engano). Vazia/ausente = nenhuma das duas habilitada ainda.
const ENABLED_COMPETITION_IDS = new Set(
  (process.env.ENABLED_COMPETITIONS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

// Série B/C/D e Copa do Brasil na Sportmonks: ao contrário de
// Brasileirão/Premier League/La Liga (ids conferidos via busca pública
// — são as ligas mais populares, então aparecem em vários lugares),
// não achei o id numérico dessas 4 documentado publicamente (Sportmonks
// não expõe isso fora da própria API/documentação, e ambas ficam atrás
// de login). Em vez de arriscar um id CHUTADO (puxaria dado da liga
// errada silenciosamente, sem erro nenhum pra avisar), cada uma fica
// configurável por variável de ambiente — descubra o id certo com
// GET /api/leagues/search?name=Brazil (rodando já no Railway, que
// consegue falar com a Sportmonks de verdade — esse ambiente aqui não
// consegue) e cole o "id" retornado na env var correspondente, sem
// precisar editar código nem dar redeploy manual. Ver server/.env.example.
function sportmonksIdFromEnv(envVar) {
  const v = (process.env[envVar] || "").trim();
  return v || null;
}

const COMPETITIONS = [
  {
    id: "brasileirao",
    providerLeagueIds: {
      "api-sports": process.env.LEAGUE_ID || "71",
      "sportmonks": "648", // conferido via busca pública — confirme no seu painel Sportmonks antes de ativar
    },
    name: "Brasileirão Série A",
    country: "Brasil",
    flag: "🇧🇷",
    minPlan: "freemium", // liberado pra todo mundo
    enabled: true, // sempre — é o único campeonato coberto por todos os planos
  },
  {
    id: "serie_b",
    providerLeagueIds: {
      "sportmonks": sportmonksIdFromEnv("SPORTMONKS_LEAGUE_ID_SERIE_B"),
    },
    name: "Brasileirão Série B",
    country: "Brasil",
    flag: "🇧🇷",
    minPlan: "pro",
    enabled: ENABLED_COMPETITION_IDS.has("serie_b"),
  },
  {
    id: "serie_c",
    providerLeagueIds: {
      "sportmonks": sportmonksIdFromEnv("SPORTMONKS_LEAGUE_ID_SERIE_C"),
    },
    name: "Brasileirão Série C",
    country: "Brasil",
    flag: "🇧🇷",
    minPlan: "pro",
    enabled: ENABLED_COMPETITION_IDS.has("serie_c"),
  },
  {
    id: "serie_d",
    providerLeagueIds: {
      "sportmonks": sportmonksIdFromEnv("SPORTMONKS_LEAGUE_ID_SERIE_D"),
    },
    name: "Brasileirão Série D",
    country: "Brasil",
    flag: "🇧🇷",
    minPlan: "pro",
    enabled: ENABLED_COMPETITION_IDS.has("serie_d"),
  },
  {
    id: "copa_do_brasil",
    providerLeagueIds: {
      "sportmonks": sportmonksIdFromEnv("SPORTMONKS_LEAGUE_ID_COPA_DO_BRASIL"),
    },
    name: "Copa do Brasil",
    country: "Brasil",
    flag: "🇧🇷",
    minPlan: "pro",
    // AVISO: é mata-mata, não pontos corridos — a Tabela (getStandings)
    // pode vir vazia ou num formato diferente do esperado pelas outras
    // competições (que são todas de pontos corridos). Testar com dado
    // real antes de anunciar essa competição pro usuário final; pode
    // precisar de ajuste na tela (ex.: esconder aba Tabela pra essa
    // competição específica) — não fiz esse ajuste agora.
    enabled: ENABLED_COMPETITION_IDS.has("copa_do_brasil"),
  },
  {
    id: "premier_league",
    providerLeagueIds: {
      "api-sports": "39",
      "sportmonks": "8",
    },
    name: "Premier League",
    country: "Inglaterra",
    flag: "🏴",
    minPlan: "pro",
    enabled: ENABLED_COMPETITION_IDS.has("premier_league"),
  },
  {
    id: "la_liga",
    providerLeagueIds: {
      "api-sports": "140",
      "sportmonks": "564",
    },
    name: "La Liga",
    country: "Espanha",
    flag: "🇪🇸",
    minPlan: "pro",
    enabled: ENABLED_COMPETITION_IDS.has("la_liga"),
  },
];

// Id desse campeonato NO FORNECEDOR informado, ou null se esse
// fornecedor não tiver esse campeonato cadastrado ainda (ver
// resolveCompetition em server.js — nesse caso trata como "em breve",
// igual a enabled:false).
function providerLeagueId(comp, providerName) {
  return comp.providerLeagueIds?.[providerName] ?? null;
}

// Hierarquia de plano só pra decidir "esse plano alcança aquele
// mínimo?" — Freemium e Lite são equivalentes aqui (nenhum dos dois
// desbloqueia campeonatos além do Brasil), Pro e Enterprise também são
// equivalentes em COBERTURA DE LIGA (a diferença entre eles é só o
// histórico de temporadas, ver planAllowsHistory abaixo).
const PLAN_RANK = { freemium: 0, lite: 0, pro: 1, enterprise: 1 };

// Enterprise: histórico de temporadas anteriores, além da atual —
// combinado com o usuário: 3 anos pra começar (não os 10 originalmente
// cogitados), pra reduzir risco de estourar cota da API-Sports numa
// primeira fase. Ativa com ENABLE_HISTORY=true (env var, mesmo
// espírito do ENABLED_COMPETITIONS acima) quando confirmar que o plano
// da API-Sports cobre temporadas passadas (geralmente exige tier pago
// específico — confirme antes de ativar).
const HISTORY_SEASONS_BACK = 3;
const HISTORY_ENABLED = (process.env.ENABLE_HISTORY || "").trim().toLowerCase() === "true";

function getCompetition(id) {
  return COMPETITIONS.find((c) => c.id === id) || null;
}

function planAllowsCompetition(plan, comp) {
  return (PLAN_RANK[plan] ?? 0) >= (PLAN_RANK[comp.minPlan] ?? 0);
}

function planAllowsHistory(plan) {
  return plan === "enterprise";
}

// Lista dos últimos N anos anteriores à temporada padrão (ex.: 2023 →
// ["2022","2021","2020"]) — só a lista de anos, não valida se a
// API-Sports realmente tem dado pra cada um (isso só se sabe na hora
// de consultar de verdade, quando HISTORY_ENABLED virar true).
function historySeasons() {
  const base = parseInt(DEFAULT_SEASON, 10);
  if (!Number.isFinite(base)) return [];
  return Array.from({ length: HISTORY_SEASONS_BACK }, (_, i) => String(base - (i + 1)));
}

// Lista pro front-end (GET /api/competitions), já anotada com o que
// ESSE usuário específico pode ou não usar agora:
//   locked     → fora do plano dele (precisa upgrade)
//   comingSoon → o plano dele libera, mas ainda não tem dado real
function listForPlan(plan) {
  return {
    competitions: COMPETITIONS.map((c) => ({
      id: c.id, name: c.name, country: c.country, flag: c.flag,
      locked: !planAllowsCompetition(plan, c),
      comingSoon: !c.enabled,
    })),
    history: {
      locked: !planAllowsHistory(plan),
      comingSoon: !HISTORY_ENABLED,
      seasons: historySeasons(),
    },
  };
}

module.exports = {
  COMPETITIONS, DEFAULT_SEASON, HISTORY_SEASONS_BACK, HISTORY_ENABLED,
  getCompetition, planAllowsCompetition, planAllowsHistory, listForPlan, providerLeagueId,
};
