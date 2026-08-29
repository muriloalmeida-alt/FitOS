# Modo Técnico — carreira estilo Elifoot (`/carreira`)

Modo de jogo separado do dashboard principal: você escolhe um clube do
Brasileirão e assume o papel de técnico — define escalação, formação,
banco de reservas, táticas e cuida do elenco (promoção de jovens da
base, dispensa de jogador) ao longo de uma temporada de 38 rodadas
simulada rodada a rodada. Os outros 19 clubes são controlados pela CPU.

Acesso: link **"Modo Técnico"** na barra lateral do site principal, ou
direto em `/carreira`. Exige login (mesma conta do BR Data) — o
progresso fica salvo por conta, não por navegador.

## Arquitetura (resumo — comentários mais detalhados em cada arquivo)

```
public/carreira.html    → página própria (mesmo padrão de public/admin.html)
public/js/carreira.js   → toda a lógica do jogo (elenco, escalação, simulação, tabela, notícias)
server/src/careerStore.js → persistência (arquivo JSON local, 1 carreira por conta)
```

Diferente do resto do backend (que entende times/jogos/tabela), o
**save da carreira é opaco pro servidor** — `careerStore.js` só guarda
o blob JSON que `carreira.js` manda. Elenco, calendário, tabela e
notícias são montados e recalculados inteiramente no cliente. Isso é
seguro porque é um jogo solo, sem placar competitivo entre contas.

## De onde vem cada coisa

- **Elenco principal**: quando há dado ao vivo configurado no host
  (mesma API-Sports/Sportmonks que o resto do BR Data usa — ver
  README-API-SPORTS.md), usa o elenco REAL do clube
  (`GET /api/teams/:id/players`) — nome, foto e estatística da
  temporada. Sem dado ao vivo (ou sem chave no host), cai no mesmo
  elenco de exemplo (`DEMO_PLAYERS`) que o resto do site usa em Modo
  Exemplo.
- **Atributos de jogo** (ataque/defesa/físico/geral) de cada jogador
  real são **estimados** a partir da estatística disponível (gols,
  assistências, nota quando existe, força do clube) — nenhuma API de
  futebol pública expõe "força" de jogador, isso não é dado oficial.
- **Elenco da base**: a API-Sports/Sportmonks não cobre elenco sub-20
  do Brasileirão de forma confiável hoje. Por decisão explícita (ver
  histórico da conversa que criou essa feature), a base é **sempre
  gerada** — 16 jogadores fictícios e jovens por clube, atributos mais
  baixos que o elenco principal, prontos pra promoção.
- **Calendário/tabela da carreira**: gerados com o mesmo algoritmo de
  turno/returno já usado no Modo Exemplo do dashboard
  (`generateAllRounds`, `public/js/data.js`) — é uma tabela PRÓPRIA
  dessa carreira, não a tabela real do Brasileirão.

## Motor de simulação

"Força agregada por escalação" (não é evento a evento por jogador):
a força de ataque/defesa do SEU time num jogo vem da força-base do
clube combinada com a qualidade média dos titulares escalados, ajustada
por formação, instruções táticas (mentalidade/marcação/ritmo) e
condição física — ver `computeHumanStrength()` em `public/js/carreira.js`
pra fórmula exata e os multiplicadores (todos ilustrativos, não vieram
de nenhuma calibração estatística real). Os outros 19 times usam a
mesma distribuição de Poisson do motor principal (`public/js/engine.js`)
com a força bruta do clube, sem lineup nenhum.

Cada rodada simulada também sorteia, só pros SEUS jogadores titulares:
artilheiro do gol (ponderado pela posição/ataque), cartão
amarelo/vermelho (com suspensão automática no acúmulo de 3 amarelos ou
direto no vermelho) e lesão (1 a 4 rodadas fora) — jogadores
indisponíveis são substituídos automaticamente pelo melhor disponível
do banco/elenco ao avançar de rodada, com aviso na aba Notícias.

## Limitações conhecidas (escopo desta 1ª versão)

- 1 carreira ativa por conta (trocar de clube reinicia do zero).
- Sem mercado de transferências entre clubes (só promoção/dispensa
  dentro do próprio elenco) e sem orçamento/finanças.
- Sem trocas no meio do jogo (decisão é só pré-jogo: escalação, banco,
  táticas) — não simula evento a evento.
- Se a carreira foi criada com dado ao vivo e depois o host perde a
  chave da API (ou vice-versa), os ids de time mudam de esquema — a
  tabela/calendário dessa carreira específica pode ficar com "Time
  #123" no lugar do nome real até você reiniciar a carreira.
