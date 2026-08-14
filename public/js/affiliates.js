/* ===================================================================
   AFFILIATES.JS — Configuração das casas de apostas (monetização)
   -------------------------------------------------------------------
   IMPORTANTE — leia antes de publicar:

   1) Hoje (ainda sem cadastro em nenhum programa de afiliados) cada
      "url" abaixo é o LINK DIRETO pro site oficial de cada operadora —
      sem código de rastreamento nenhum, então NENHUMA comissão é gerada
      por esses cliques. É assim mesmo enquanto "affiliate" estiver
      "false". Quando sua inscrição em algum programa for aprovada:
        a) troque a "url" daquela operadora pelo link de afiliado real
           (com o seu código, obtido no painel de parceiros dela);
        b) mude "affiliate" pra "true" nela — isso adiciona rel=
           "sponsored" no link (recomendação do Google pra link
           patrocinado/monetizado, ver affiliateComplianceHTML em
           app.js), que não faz sentido cravar num link direto sem
           comissão nenhuma.
      As URLs abaixo foram conferidas por busca (domínio ".bet.br"
      citado como o endereço oficial de cada operadora com licença
      SPA/MF em várias fontes independentes) — mas o ambiente onde este
      código foi escrito bloqueia acesso direto a domínio de apostas,
      então NINGUÉM aqui conseguiu abrir a página de verdade antes de
      publicar. Teste cada link manualmente antes de divulgar.

   2) Só inclua aqui operadoras autorizadas pela Secretaria de Prêmios
      e Apostas do Ministério da Fazenda (SPA/MF). Confira a lista
      oficial atualizada antes de publicar — ela muda com frequência:
      https://www.gov.br/fazenda (busque "bets autorizadas" / SIGAP)

   3) Por lei/autorregulamentação publicitária no Brasil, conteúdo
      (mesmo sem ser afiliado ainda) que aponta pra casa de apostas
      precisa deixar claro que é publicidade e trazer os avisos "+18" e
      "jogue com responsabilidade". Isso já está implementado no card
      de odds (app.js / style.css) — não remova esses avisos ao editar.

   4) Logo de cada operadora: coloque o arquivo em
      public/img/partners/<id>.png (ex.: img/partners/bet365.png) — ver
      o README nessa pasta pra tamanho recomendado e onde conseguir o
      arquivo de forma legítima (kit de marca do programa de afiliados,
      não print/download da home). Sem o arquivo, o chip mostra o nome
      em texto mesmo (nunca fica com ícone de imagem quebrada) — dá pra
      publicar os links já funcionando mesmo antes de ter os logos.

   5) Onde conseguir cada programa de afiliados (para se cadastrar):
      procure por "programa de afiliados" + nome da operadora, ou
      acesse o rodapé do site de cada uma (normalmente tem o link lá).
      Isso muda de tempos em tempos, então não fixamos URLs aqui.
=================================================================== */

const AFFILIATE_OPERATORS = [
  { id: "bet365",   name: "bet365",   color: "#0A6C3C", url: "https://www.bet365.bet.br", affiliate: false },
  { id: "betano",   name: "Betano",   color: "#0E1E5B", url: "https://www.betano.bet.br",  affiliate: false },
  { id: "kto",      name: "KTO",      color: "#F5B301", url: "https://www.kto.bet.br",     affiliate: false },
  // Superbet tirada por enquanto (pedido do usuário) — só comentada,
  // não apagada: é só descomentar essa linha (e o logo já está salvo
  // em img/partners/superbet.png) pra voltar a mostrar.
  // { id: "superbet", name: "Superbet", color: "#E10600", url: "https://www.superbet.bet.br", affiliate: false },
];

const RESPONSIBLE_GAMBLING_URL = "https://www.gov.br/fazenda/pt-br/composicao/orgaos/secretaria-de-premios-e-apostas/autoexclusao";
