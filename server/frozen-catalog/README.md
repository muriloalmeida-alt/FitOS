# Catálogo real congelado (Modo Técnico)

Retrato real de times, tabela e elenco do Brasileirão Série A, B e C,
capturado da Sportmonks e commitado aqui pra sempre — ver
`server/src/providers/frozen.js` (o fornecedor que lê estes arquivos) e
`server/src/captureSnapshot.js` (a ferramenta que os gerou).

## Origem

| Arquivo | Competição | Capturado em | Times | Jogadores |
|---|---|---|---|---|
| `snapshot-brasileirao.json` | Brasileirão Série A | 03/09/2026 | 20 | 655 |
| `snapshot-serie_b.json` | Brasileirão Série B | 03/09/2026 | 20 | 605 |
| `snapshot-serie_c.json` | Brasileirão Série C | 03/09/2026 | 20 | 622 |

Cada arquivo é a resposta crua de `getTeams`/`getStandings`/
`getTeamPlayers` (Sportmonks, temporada 2026) no momento da captura —
mesmo formato que o app já usa para dado ao vivo (ver contrato completo
em `server/src/providers/index.js`), então nenhum outro código do app
precisou mudar pra consumir isso: o fornecedor `frozen` só lê estes
arquivos em vez de chamar a API.

## Por que existe

O contrato com a Sportmonks foi cancelado (ou está para ser). O Modo
Técnico não depende de dado AO VIVO — só precisa de um retrato inicial
de elenco real pra montar cada carreira nova; o motor de partidas é
100% simulado localmente (`engine.js`), nunca leu resultado de verdade.
Congelar esse retrato permite manter o elenco real do Modo Técnico
funcionando pra sempre, sem nenhuma credencial de API.

## Como ativar

No host, defina a variável de ambiente:

```
DATA_PROVIDER=frozen
```

Sem redeploy de código — mesmo mecanismo já usado por
`ENABLED_COMPETITIONS`. A Série B/C continuam precisando também de
`ENABLED_COMPETITIONS=serie_b,serie_c` (ou o que já estiver
configurado) — essa variável decide se a competição existe no registro;
`DATA_PROVIDER` decide de onde vem o dado dela.

## Nunca mais atualiza

Isto é uma FOTOGRAFIA — elenco, idade, estatística de temporada de cada
jogador ficam parados na data da captura pra sempre. Times que sobem/
descem de divisão numa temporada seguinte não são refletidos aqui (mesmo
problema, em menor escala, que já existia com `DEMO_TEAMS_SERIE_B`
antes da Série B ganhar dado real — ver histórico de correções em
`public/js/data.js`). Recapturar exigiria voltar a ter uma credencial de
fornecedor configurada (mesmo que temporariamente).
