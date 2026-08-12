/* Registro de campeonatos suportados — a peça central da expansão
   multi-campeonato (Pro: Brasil/Inglaterra/Espanha temporada atual;
   Enterprise: as mesmas 3 ligas + histórico de temporadas anteriores).

   IMPORTANTE: cada entrada aqui já é capaz de puxar dado real da
   API-Sports (o apiLeagueId de cada uma é o id oficial da liga lá,
   conferido em https://dashboard.api-football.com) assim que:
     (a) API_SPORTS_KEY estiver configurada no host, e
     (b) o plano contratado na API-Sports cobrir aquela liga/temporada
         (nem todo tier cobre todas as ligas, e planos free geralmente
         só cobrem temporada corrente — confirme antes de ativar).

   Até você confirmar a cobertura, cada campeonato fica com
   `enabled:false` — aparece no app como "em breve" (Pro/Enterprise) ou
   bloqueado por plano (Freemium/Lite) em vez de tentar buscar um dado
   que ainda não existe (ou que existe mas não está incluído no seu
   plano — daria erro 403 da própria API-Sports). Enquanto isso, o
   Pro/Enterprise continua explorando esse campeonato normalmente em
   modo exemplo (ver DEMO_DATA_BY_COMPETITION em public/js/data.js) —
   habilitar aqui só troca esse modo exemplo por dado real.

   ATIVAÇÃO — via variável de ambiente (Railway/host), SEM editar
   código nem dar redeploy manual de código:
     ENABLED_COMPETITIONS=premier_league,la_liga
   Lista separada por vírgula com os "id" que você quer habilitar (os
   mesmos ids do array COMPETITIONS abaixo — "brasileirao" já vem
   habilitado sempre, não precisa incluir). Pra habilitar só uma:
     ENABLED_COMPETITIONS=premier_league
   Pra desabilitar as duas de novo (voltar pro modo exemplo), apague a
   variável ou deixe em branco. Ver server/.env.example. */

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

const COMPETITIONS = [
  {
    id: "brasileirao",
    apiLeagueId: process.env.LEAGUE_ID || "71",
    name: "Brasileirão Série A",
    country: "Brasil",
    flag: "🇧🇷",
    minPlan: "freemium", // liberado pra todo mundo
    enabled: true, // sempre — é o único campeonato coberto por todos os planos
  },
  {
    id: "premier_league",
    apiLeagueId: "39", // Premier League (Inglaterra) na API-Sports
    name: "Premier League",
    country: "Inglaterra",
    flag: "🏴",
    minPlan: "pro",
    enabled: ENABLED_COMPETITION_IDS.has("premier_league"),
  },
  {
    id: "la_liga",
    apiLeagueId: "140", // La Liga (Espanha) na API-Sports
    name: "La Liga",
    country: "Espanha",
    flag: "🇪🇸",
    minPlan: "pro",
    enabled: ENABLED_COMPETITION_IDS.has("la_liga"),
  },
];

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
  getCompetition, planAllowsCompetition, planAllowsHistory, listForPlan,
};
