/* Planos da área "Apoie o BR Data" — fonte única de verdade dos
   preços. O front-end só EXIBE esses dados (via GET /api/support/plans);
   o valor cobrado de verdade na hora de criar a preference do Mercado
   Pago sempre vem daqui, nunca do que o navegador manda. */

const PLANS = {
  lite: {
    id: "lite",
    title: "Lite",
    price: 5.99,
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
    price: 14.99,
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
    price: 29.99,
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
