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
    tagline: "Grátis — em breve, com anúncios",
    description: "Mesmo acesso do plano Lite",
    features: [
      "Tabela, jogos e estatísticas da temporada atual",
      "Simulador e calculadora de probabilidades",
      "Alertas e times favoritos",
      "Grátis — com anúncios em breve",
    ],
  },
  lite: {
    id: "lite",
    title: "Lite",
    price: priceFromEnv("PLAN_LITE_PRICE", 5.99),
    tagline: "Pra quem quer acompanhar a temporada atual",
    description: "Acesso aos campeonatos atuais",
    features: [
      "Tabela, jogos e estatísticas da temporada atual",
      "Simulador e calculadora de probabilidades",
      "Alertas e times favoritos",
    ],
  },
  pro: {
    id: "pro",
    title: "Pro",
    price: priceFromEnv("PLAN_PRO_PRICE", 14.99),
    tagline: "Pra quem quer o histórico completo",
    description: "Acesso a todo o histórico de campeonatos",
    highlight: true,
    features: [
      "Tudo do plano Lite",
      "Histórico completo de temporadas anteriores",
      "Comparador de times entre temporadas",
    ],
  },
  enterprise: {
    id: "enterprise",
    title: "Enterprise",
    price: priceFromEnv("PLAN_ENTERPRISE_PRICE", 29.99),
    tagline: "Pra quem quer o pacote completo",
    description: "Acesso a todo o histórico e análise ao vivo de odds",
    features: [
      "Tudo do plano Pro",
      "Análise de odds ao vivo, com histórico de variação",
      "Suporte prioritário",
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
