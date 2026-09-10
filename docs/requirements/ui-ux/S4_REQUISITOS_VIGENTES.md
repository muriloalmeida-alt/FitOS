# S4 — Requisitos Vigentes (Redesign Mobile)
**Data:** 09/09/2026
**Autor:** Claude, de chapéu PM
**Natureza:** este é o requisito **vigente** para a execução da S4 —
complementa, não substitui, `docs/sprints/S3/S3_S4_MATRIZ_TELAS_MOBILE.md`
(o documento original, 954 linhas, que continua sendo a referência
completa de objetivo/requisitos/estados por tela — não reescrito aqui).
Este documento existe porque a matriz original foi escrita **antes** da
S3.2.7 Readiness Review rodar, então seu quadro de prioridades não
reflete o estado real do código. Aqui: o estado real verificado, um gap
adicional que a matriz original não previa, e a ordem de execução
refinada a partir disso.

⸻

## 1. Por que este documento existe

A regra de governança (`docs/README.md` §"docs/requirements/") diz que
quando um requisito de Sprint (`docs/sprints/`) se torna regra vigente
para execução em andamento, ele deve ser refletido em
`docs/requirements/` em vez de o time depender de lembrar "qual Sprint
tem a versão atualizada". A S4 está prestes a começar a executar
(primeiro passo, `S3-DS20-S4-PREP-001`, já em implementação) — é o
momento de promover a parte vigente da matriz para cá.

⸻

## 2. Estado real por tela (S3.2.7 Readiness Review, verificado no código)

Batch 2 — Core (8 telas)

| Tela | Estado real | Observação |
|---|---|---|
| Escolha do clube | ✅ migrada `--m3-*` | — |
| Início / Dashboard | ✅ migrada `--m3-*` (parcial) | — |
| Elenco | ✅ migrada `--m3-*` | PlayerCard formalizado (`S3-DS20-S4-PREP-002`, ver §3) — `playerRow()` agora tem contrato documentado |
| Login / Entrada | ❌ `--brd-*` (legado) | — |
| Loading / Bootstrap | ❌ não identificada como tela própria migrada | — |
| Perfil do jogador | ❌ `.ct-modal-*` (legado) | overlay vira `.m3-dialog` assim que `S3-DS20-S4-PREP-001` for aprovada (é o próprio ponto de validação dessa demanda) — mas isso NÃO formaliza o PlayerCard nem migra o resto da tela pros tokens `--m3-*`, só o container do modal |
| Tática / Formação | ❌ `--mt-*` (legado) | — |
| Treino | ❌ `--mt-*` (legado) | — |

**3 de 8 (37%) migradas.**

Batch 3 — Transactional (4 telas, todas P0)

| Tela | Estado real | Observação |
|---|---|---|
| Mercado | ❌ `--mt-*` (legado) | precisa de TransferCard (não existe) |
| Negociação / Proposta | ❌ `--mt-*` (legado) | precisa de Dialog (`S3-DS20-S4-PREP-001`) |
| Contratos | ❌ `--mt-*` (legado) | precisa de ContractCard (não existe) |
| Resumo da rodada | ❌ `--mt-*` (legado) | precisa de MatchCard/FinancialSummary (não existem) |

**0 de 4 (0%) migradas — e é o batch com mais componentes formais
ausentes, não só telas por migrar.**

Batch 4 — Complementary (7 telas, todas P1)

Nenhuma verificada individualmente na S3.2.7 (fora do foco da
auditoria, dado o gap já encontrado em P0). Tratar como
"desconhecido", não como "ok por omissão".

⸻

## 3. Gap adicional identificado (não coberto por `S3-DS20-S4-PREP-001`)

A S3.2.7 verificou os 6 **BRDATA Product Patterns** exigidos pela
matriz original (§20 de `S3_2_COMPONENTES_E_CONTRATOS.md`, §525 de
`S3_S4_MATRIZ_TELAS_MOBILE.md`) — `PlayerCard`, `MatchCard`,
`LeagueTable`, `TransferCard`, `ContractCard`, `FinancialSummary` — e
achou **zero** ocorrências desses 6 nomes no código (reconfirmado nesta
refinação: `grep` em `carreira.js`/`carreira.html` não retorna nada).

Isso é um gap **diferente** dos 3 componentes P0 que
`S3-DS20-S4-PREP-001` está resolvendo (Dialog/Bottom Sheet/Skeleton —
componentes de **overlay/estado**, usados em várias telas). Os 6
Product Patterns são componentes de **apresentação de dado**, cada um
específico de 1-2 telas:

| Padrão | Tela(s) que depende dele | Já migrada sem ele? |
|---|---|---|
| PlayerCard | Elenco, Perfil do jogador | **Resolvido por `S3-DS20-S4-PREP-002`** — `playerRow()` formalizado como PlayerCard, contrato documentado em `carreira.js` e adendo em `S3_2_COMPONENTES_E_CONTRATOS.md` §60. Perfil do jogador continua fora (não migrada — ver linha 39 acima) |
| MatchCard | Início/Dashboard, Resumo da rodada | Início usa `.m3-score-card`/`.m3-match-row` ad hoc, mesmo padrão |
| LeagueTable | Início/Dashboard, Histórico | Não migrada — segue tabela HTML tradicional |
| TransferCard | Mercado, Negociação | **Componente disponível (`S4-B3-001`)** — `transferCardHTML()` em `carreira.js`, contrato documentado. Correção: já existiam 2 formatos ad hoc próximos (`.mt-market-row` no Mercado, `.mt-sponsor-proposal-row` em "Minhas propostas") — TransferCard não parte do zero conceitualmente, mas nenhuma tela foi migrada nesta demanda (ver §5, item 3). Mercado/Negociação continuam fora (não migradas) |
| ContractCard | Contratos | **Componente disponível (`S4-B3-001`)** — `contractCardHTML()` em `carreira.js`, contrato documentado. Divergência maior: a tela "Contratos" (Tela 16 da matriz) **não existe no app hoje** — só há pontos isolados (tag "fim de contrato" no Elenco, modal de renovação a partir do Perfil). Migrar essa tela em `S4-B3-004` significa CRIAR uma tela nova, não re-estilizar uma existente — registrado como divergência de escopo, decisão do PM antes de prosseguir (ver `docs/HANDOFF_CLAUDE.md`) |
| FinancialSummary | Início/Dashboard, Resumo da rodada | Início usa `.m3-fin-bar`/`.m3-finance-num` ad hoc, mesmo padrão |

**O risco concreto:** o precedente já aconteceu 3 vezes (Elenco,
Início) — uma tela é migrada pro `--m3-*`, funciona visualmente, mas o
Product Pattern nunca é formalizado como componente nomeado/reutilizável
com contrato documentado (Nome/Objetivo/Entradas/Estados, como pede
`S3_2_COMPONENTES_E_CONTRATOS.md` §7). Sem uma regra explícita, o mesmo
vai se repetir nas próximas 6 telas do Batch 2/3, e o produto termina a
S4 com uma tela por padrão de card, em vez de um padrão reutilizado por
N telas — exatamente o problema que os Product Patterns existem pra
evitar.

⸻

## 4. Requisito novo: Definition of Done reforçada por Batch

Além da DoD já definida em `S3_S4_MATRIZ_TELAS_MOBILE.md` §41, esta
refinação adiciona:

> **Nenhuma tela é considerada tecnicamente pronta se ela usa um
> BRDATA Product Pattern (§20/§525) sem esse padrão existir como
> componente nomeado e documentado** (função/classe com contrato — nome,
> objetivo, entradas, estados — não apenas uma classe CSS ad hoc reaproveitada).

Consequência prática: antes de tocar Perfil do jogador (que também usa
PlayerCard), a dívida retroativa do PlayerCard precisa estar paga —
demanda própria já especificada (`S3-DS20-S4-PREP-002`, ver §5). O
mesmo vale, em princípio, para MatchCard/FinancialSummary antes de
tocar Resumo da rodada — mas essa dívida específica ainda não virou
demanda porque os candidatos no código (`.m3-match-row`,
`financeCashBarsHTML()`) não foram inspecionados o suficiente pra
confirmar se são de fato o padrão certo a formalizar (ver §5, item 2b).

Isso não é trabalho extra descartável — é dívida já contraída (Elenco e
Início já estão em produção sem o contrato formal) que só cresce se não
for paga agora, antes de replicar o padrão ad hoc em mais telas.

⸻

## 5. Ordem de execução refinada

1. **`S3-DS20-S4-PREP-001`** — Dialog/Bottom Sheet/Skeleton +
   convergência de nomenclatura. **Concluído**: aprovado pelo PM e
   mesclado em `main` (commit `8dcff10`), registrado no Histórico de
   `docs/HANDOFF_CLAUDE.md` e em `docs/project/CHANGELOG.md` — fundação
   e os 3 componentes disponíveis pras próximas telas do Batch 2.
2. **Formalizar PlayerCard** a partir do que já existe em Elenco
   (`playerRow()`, dívida retroativa, §4 acima) — demanda própria
   (`S3-DS20-S4-PREP-002`). **Concluído**: aprovado pelo PM e mesclado
   em `main`, registrado no Histórico de `docs/HANDOFF_CLAUDE.md` e em
   `docs/project/CHANGELOG.md` — deliberadamente isolada de
   MatchCard/FinancialSummary (item 2b abaixo) por já ter candidato
   claro e único (3 pontos de reuso confirmados por inspeção direta —
   ver adendo em `S3_2_COMPONENTES_E_CONTRATOS.md` §60.3 pra uma
   correção em relação ao conjunto exato desses 3 pontos). Não
   dependeu da aprovação da PREP-001. Libera Perfil do jogador (item 5
   abaixo).
2b. **MatchCard e FinancialSummary** — candidatos identificados
   (`.m3-match-row` em `renderH2H`, `financeCashBarsHTML()`) mas
   **ainda não inspecionados o suficiente** pra virar demanda de
   migração de tela — o candidato a MatchCard parece ser um widget
   menor (confronto direto), não o card de "próxima partida" que a
   matriz descreve. **Agora tem demanda própria**: `S4-B3-005`, status
   `PRONTO PARA IMPLEMENTAÇÃO` — decide com evidência se cada um dos 2
   é formalização retroativa (como PlayerCard) ou construção nova
   (como TransferCard/ContractCard), e resolve os dois de acordo.
3. **Completar Batch 2** — migrar Login, Bootstrap, Perfil do jogador,
   Tática, Treino (5 telas), reutilizando Dialog (item 1) e PlayerCard
   (item 2) onde aplicável.
   - Item 1: **Loading/Bootstrap** (`S4-B2-001`, status `PRONTO PARA
     IMPLEMENTAÇÃO`) — a mais simples e independente (sem PlayerCard,
     sem formulário, sem regra de negócio própria), primeiro uso real
     do componente Skeleton.
   - Item 2: **Login/Entrada** (`S4-B2-002`, status `PRONTO PARA
     IMPLEMENTAÇÃO`) — independente de PlayerCard, sem regra de
     negócio de jogo, mas com um risco próprio: pode ser compartilhada
     com outras partes do produto além do Modo Técnico — confirmar
     escopo de compartilhamento antes de migrar é requisito da
     demanda, não opcional.
   - Item 3: **Tática/Formação** (`S4-B2-003`, status `PRONTO PARA
     IMPLEMENTAÇÃO`) — tela interativa, mais complexa que as duas
     anteriores; possível dependência não confirmada do PlayerCard
     (a inspecionar, não presumida); as 3 telas P1 relacionadas (Eixos
     táticos, Marcação individual, Meus esquemas) ficam fora, são
     Batch 4.
   - Item 4: **Treino** (`S4-B2-004`, status `PRONTO PARA
     IMPLEMENTAÇÃO`) — mesma incerteza de dependência do PlayerCard
     que o item 3 (a inspecionar, não presumida), sem o componente de
     interação visual complexa que eleva o risco daquele. Com esta
     demanda, o Batch 2 fica totalmente coberto exceto Perfil do
     jogador.
   - Item 5 (último): **Perfil do jogador** (`S4-B2-005`, status
     `PRONTO PARA IMPLEMENTAÇÃO`) — dependência do PlayerCard resolvida
     agora que `S3-DS20-S4-PREP-002` está concluída; reutiliza o
     PlayerCard já formalizado. Com esta demanda, o Batch 2 (Core)
     fica totalmente especificado.
4. **Batch 3 (Transactional)** — antes de qualquer tela, formalizar
   TransferCard e ContractCard (não existem, sem dívida retroativa
   aqui, são novos). Depois migrar Mercado, Negociação, Contratos.
   Resumo da rodada fica fora desta rodada (ver item 4e).
   - Item 1: **TransferCard + ContractCard** (`S4-B3-001`, status
     `PRONTO PARA IMPLEMENTAÇÃO`) — 2 componentes novos (não
     retroativos), sem lógica de negócio (valuation/renovação ficam
     fora dos componentes). Pré-requisito bloqueante dos 3 itens
     seguintes.
   - Item 2: **Mercado** (`S4-B3-002`, status `PRONTO PARA
     IMPLEMENTAÇÃO`) — usa TransferCard; um dos fluxos transacionais
     mais críticos do produto (toda semana de jogo passa por ali).
   - Item 3: **Negociação/Proposta** (`S4-B3-003`, status `PRONTO PARA
     IMPLEMENTAÇÃO`) — usa TransferCard + Dialog; mesmo nível de
     criticidade de Mercado.
   - Item 4: **Contratos** (`S4-B3-004`, status `PRONTO PARA
     IMPLEMENTAÇÃO`) — usa ContractCard. Com esta, o Batch 3 fica
     completo exceto Resumo da rodada.
   - Item 5: **Inspecionar/formalizar MatchCard e FinancialSummary**
     (`S4-B3-005`, status `PRONTO PARA IMPLEMENTAÇÃO`) — resolve a
     pendência do item 2b acima. Pré-requisito de Resumo da rodada.
   - Item 6: **Resumo da rodada** — ainda sem demanda própria, aguarda
     a conclusão de `S4-B3-005` (mesma lógica de Perfil do jogador
     esperando `S3-DS20-S4-PREP-002`).
5. **Batch 4 (Complementary)** — as 7 telas P1, começando por uma
   verificação individual (não foram auditadas na S3.2.7). Ainda **sem
   demanda própria** — a demanda que cobria isso (`S4-B4-000`) foi
   reescopada a pedido do Murilo pra virar `S4-AUDIT-BACKLOG-001` (ver
   item 7 abaixo), então esta auditoria específica do Batch 4 volta a
   ficar pendente de nova especificação.
6. **Batch 5 (QA Visual/UX)** — revisão transversal, como já definido
   na matriz original.
7. **Auditoria de prontidão do backlog** (`S4-AUDIT-BACKLOG-001`,
   status `PRONTO PARA IMPLEMENTAÇÃO`) — verifica o estado real das 10
   demandas já especificadas (itens 3-4 acima, issues #12-#21) antes de
   qualquer implementação ou nova especificação: confirma se alguma já
   teve progresso externo (mesmo padrão que aconteceu 2 vezes com
   `S3-DS20-S4-PREP-001`/`002`) e revalida a cadeia de dependências
   entre elas. Pré-requisito transversal, não é um item sequencial do
   Batch 2/3 em si.

Cada um dos passos 2-5 deve nascer como uma demanda própria em
`docs/HANDOFF_CLAUDE.md` (mesmo formato de `S3-DS20-S4-PREP-001`), não
como uma "S4 inteira" de uma vez — mantém o padrão de escopo pequeno e
testável que already funcionou até aqui.

⸻

## 6. O que este documento não muda

* Não altera objetivo, requisitos por tela, estados, critérios de
  acessibilidade/responsividade ou qualquer outra seção de
  `S3_S4_MATRIZ_TELAS_MOBILE.md` — continua a referência completa.
* Não autoriza execução de nenhuma tela por si só — cada passo da
  ordem de execução (§5) ainda precisa virar uma demanda especificada e
  aprovada, mesmo fluxo de sempre.
* Não resolve os gaps P1/P2 já conhecidos (emoji, ARIA geral,
  LeagueTable como tabela tradicional, `.icon-btn` 36px) — continuam
  como registrados na S3.2.7, a serem tratados durante os batches
  correspondentes.
