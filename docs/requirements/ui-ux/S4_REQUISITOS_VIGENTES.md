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
| Elenco | ✅ migrada `--m3-*` | **mas sem PlayerCard formalizado** (ver §3) |
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
| PlayerCard | Elenco, Perfil do jogador | **Sim — Elenco já foi migrada usando `.m3-list-item` ad hoc, sem nunca formalizar PlayerCard como contrato** |
| MatchCard | Início/Dashboard, Resumo da rodada | Início usa `.m3-score-card`/`.m3-match-row` ad hoc, mesmo padrão |
| LeagueTable | Início/Dashboard, Histórico | Não migrada — segue tabela HTML tradicional |
| TransferCard | Mercado, Negociação | Não migrada |
| ContractCard | Contratos | Não migrada |
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

Consequência prática: quando o Batch 2 retomar (após
`S3-DS20-S4-PREP-001`), a primeira tarefa não é uma tela nova — é
**formalizar retroativamente o PlayerCard** a partir do que já existe em
Elenco (`.m3-list-item`), antes de tocar Perfil do jogador (que também
usa PlayerCard). O mesmo vale para MatchCard/FinancialSummary a partir
do que já existe em Início, antes de tocar Resumo da rodada.

Isso não é trabalho extra descartável — é dívida já contraída (Elenco e
Início já estão em produção sem o contrato formal) que só cresce se não
for paga agora, antes de replicar o padrão ad hoc em mais telas.

⸻

## 5. Ordem de execução refinada

1. **`S3-DS20-S4-PREP-001`** (em implementação) — Dialog/Bottom
   Sheet/Skeleton + convergência de nomenclatura. Sem mudança.
2. **Formalizar PlayerCard e MatchCard/FinancialSummary** a partir do
   que já existe em Elenco/Início (dívida retroativa, §4 acima) — nova
   demanda, pequena, sem tela nova, só contrato + eventual refactor de
   nome de classe.
3. **Completar Batch 2** — migrar Login, Bootstrap, Perfil do jogador,
   Tática, Treino (5 telas), reutilizando Dialog (item 1) e PlayerCard
   (item 2) onde aplicável.
4. **Batch 3 (Transactional)** — antes de qualquer tela, formalizar
   TransferCard e ContractCard (não existem, sem dívida retroativa
   aqui, são novos). Depois migrar Mercado, Negociação, Contratos,
   Resumo da rodada.
5. **Batch 4 (Complementary)** — as 7 telas P1, começando por uma
   verificação individual (não foram auditadas na S3.2.7).
6. **Batch 5 (QA Visual/UX)** — revisão transversal, como já definido
   na matriz original.

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
