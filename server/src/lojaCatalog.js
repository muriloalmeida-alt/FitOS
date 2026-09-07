/* Item 7 da lista de melhorias sugeridas pelo usuário: "Loja com
   pagamento de verdade... plugar nos pacotes de Créditos BR sem
   reinventar nada" (reaproveitando server/src/mercadoPago.js).

   Espelha CREDIT_PACKAGES/BOOST_ITEMS de public/js/carreira.js — fonte
   de verdade do PREÇO fica aqui (nunca confia em valor vindo do
   cliente), mesmo padrão de server/src/supportPlans.js pros planos de
   assinatura. Mudar preço/catálogo exige atualizar os dois lados (aqui
   e o array espelho no cliente, usado só pra exibição).

   Créditos BR (moeda "dura", mora na CONTA — ver users.js) só pode
   crescer via pagamento aprovado de verdade (ver webhook em
   server.js); só pode diminuir gastando um boost daqui — nenhuma outra
   rota do jogo mexe nesse saldo. */
const CREDIT_PACKAGES = [
  { id: "bronze", title: "Pacote Bronze", price: 4.90, credits: 490 },
  { id: "prata", title: "Pacote Prata", price: 14.90, credits: 1680 },
  { id: "ouro", title: "Pacote Ouro", price: 34.90, credits: 4480 },
  { id: "platina", title: "Pacote Platina", price: 69.90, credits: 10200 },
  { id: "diamante", title: "Pacote Diamante", price: 149.90, credits: 25350 },
];
// Preço em Créditos BR de cada boost/patrocínio — mesmos valores de
// BOOST_ITEMS (carreira.js); o EFEITO de cada um (o que ele realmente
// faz na carreira) é decidido inteiramente no cliente (applyBoostEffect),
// já que o servidor não entende nada de futebol (mesma divisão de
// responsabilidade de sempre neste projeto) — aqui só o preço, pra
// decidir quanto debitar do saldo real.
const BOOST_PRICES = {
  recuperacao_instantanea: 90,
  reset_moral: 120,
  treino_extra: 150,
  injecao_moral: 210,
  desconto_contratacao: 300,
  uniforme_alternativo: 180,
};
function getCreditPackage(id) {
  return CREDIT_PACKAGES.find((p) => p.id === id) || null;
}
function getBoostPrice(id) {
  return Object.prototype.hasOwnProperty.call(BOOST_PRICES, id) ? BOOST_PRICES[id] : null;
}
module.exports = { CREDIT_PACKAGES, getCreditPackage, getBoostPrice };
