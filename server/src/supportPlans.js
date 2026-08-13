/* Planos da área "Apoie o BR Data" — fonte única de verdade dos
   preços. O front-end só EXIBE esses dados (via GET /api/support/plans);
   o valor cobrado de verdade na hora de criar a preference do Mercado
   Pago sempre vem daqui, nunca do que o navegador manda.

   Preço de cada plano pode ser sobrescrito por variável de ambiente
   (PLAN_LITE_PRICE / PLAN_PRO_PRICE / PLAN_ENTERPRISE_PRICE, ver
   server/.env.example) — pra reajustar valor sem precisar editar
   código nem dar redeploy manual de código, só a variável no
   Railway/host + reiniciar. Título/descrição/recursos continuam só
   em código por serem texto livre, não um valor único que se ajusta. */

function priceFromEnv(envVar, fallback) {
  const n = Number(process.env[envVar]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const PLANS = {
  freemium: {
    id: "freemium",
    title: "Freemium",
    price: 0,
    tagline: "Grátis — com anúncios",
    description: "Brasileirão da temporada atual, com anúncios",
    features: [
      "Campeonatos do Brasil da temporada atual",
      "Tabela, jogos e estatísticas",
      "Sem comparador de times, probabilidades ou simulador",
      "Anúncio em vídeo a cada 5 min",
    ],
  },
  lite: {
    id: "lite",
    title: "Lite",
    price: priceFromEnv("PLAN_LITE_PRICE", 5.99),
    tagline: "Pra quem quer acompanhar a temporada atual",
    description: "Brasileirão da temporada atual, sem anúncios",
    features: [
      "Campeonatos do Brasil da temporada atual",
      "Tabela, jogos e estatísticas",
      "Sem comparador de times, probabilidades ou simulador",
      "Odds simplificadas",
    ],
  },
  pro: {
    id: "pro",
    title: "Pro",
    price: priceFromEnv("PLAN_PRO_PRICE", 14.99),
    tagline: "Pra quem quer mais campeonatos e ferramentas",
    description: "Série A, B, C, D e Copa do Brasil, temporada atual",
    highlight: true,
    features: [
      "Brasileirão Série A, B, C, D e Copa do Brasil (temporada atual) — em breve",
      "Comparador de times, probabilidades e simulador",
      "Odds simplificadas",
    ],
  },
  enterprise: {
    id: "enterprise",
    title: "Enterprise",
    price: priceFromEnv("PLAN_ENTERPRISE_PRICE", 29.99),
    tagline: "Pra quem quer histórico completo",
    description: "Série A, B, C, D e Copa do Brasil, com 3 anos de histórico",
    features: [
      "Tudo do plano Pro",
      "Histórico de 3 temporadas anteriores — em breve",
      "Odds com análise de influencers — em breve",
    ],
  },
};

function getPlan(id) {
  return PLANS[id] || null;
}

function listPlans() {
  return Object.values(PLANS);
}

module.exports = { PLANS, getPlan, listPlans };
