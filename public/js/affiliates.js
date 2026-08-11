/* ===================================================================
   AFFILIATES.JS — Configuração das casas de apostas (monetização)
   -------------------------------------------------------------------
   IMPORTANTE — leia antes de publicar:

   1) Troque cada "url" abaixo pelo SEU link de afiliado real, obtido
      no painel de parceiros de cada operadora DEPOIS que sua inscrição
      no programa de afiliados for aprovada. Enquanto estiver com o
      placeholder "#", o botão fica desativado (ver app.js).

   2) Só inclua aqui operadoras autorizadas pela Secretaria de Prêmios
      e Apostas do Ministério da Fazenda (SPA/MF). Confira a lista
      oficial atualizada antes de publicar — ela muda com frequência:
      https://www.gov.br/fazenda (busque "bets autorizadas" / SIGAP)

   3) Por lei/autorregulamentação publicitária no Brasil, conteúdo de
      afiliados de apostas precisa deixar claro que é publicidade e
      trazer os avisos "+18" e "jogue com responsabilidade". Isso já
      está implementado no card de odds (app.js / style.css) — não
      remova esses avisos ao editar.

   4) Onde conseguir cada programa de afiliados (para se cadastrar):
      procure por "programa de afiliados" + nome da operadora, ou
      acesse o rodapé do site de cada uma (normalmente tem o link lá).
      Isso muda de tempos em tempos, então não fixamos URLs aqui.
=================================================================== */

const AFFILIATE_OPERATORS = [
  { id: "bet365",      name: "bet365",      color: "#0A6C3C", url: "#" },
  { id: "betano",      name: "Betano",      color: "#0E1E5B", url: "#" },
  { id: "kto",         name: "KTO",         color: "#F5B301", url: "#" },
  { id: "superbet",    name: "Superbet",    color: "#E10600", url: "#" },
  { id: "betnacional", name: "Betnacional", color: "#00A651", url: "#" },
  { id: "sportingbet", name: "Sportingbet", color: "#D2001F", url: "#" },
];

const RESPONSIBLE_GAMBLING_URL = "https://www.gov.br/fazenda/pt-br/composicao/orgaos/secretaria-de-premios-e-apostas/autoexclusao";
