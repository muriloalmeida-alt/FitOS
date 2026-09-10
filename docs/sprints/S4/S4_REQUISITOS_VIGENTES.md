# S4 — Requisitos Vigentes (Redesign Mobile)
**Data:** 09/09/2026 (criado) · **relocado em 10/09/2026**
**Autor:** Claude, de chapéu PM
**Natureza:** o estado de execução vivo da Sprint S4 — estado real por
tela, gaps encontrados, ordem de execução e status de cada demanda —
não substitui `docs/sprints/S3/S3_S4_MATRIZ_TELAS_MOBILE.md` (o
documento original, 954 linhas, que continua sendo a referência
completa de objetivo/requisitos/estados por tela — não reescrito
aqui).

**Nota de relocação (10/09/2026):** este documento vivia em
`docs/requirements/ui-ux/`, por ter sido tratado inicialmente como
"regra de negócio vigente" (ver §1 abaixo, preservado como histórico
do raciocínio original). O Murilo apontou a classificação errada: o
conteúdo predominante daqui — estado por tela, ordem de execução,
status/ID de demanda — é histórico e operacional da própria Sprint S4
("o que foi decidido/especificado, e quando", exatamente a definição
de `docs/sprints/S<n>/` em `docs/README.md`), não uma regra de
negócio/UX permanente e independente de Sprint (`docs/requirements/`).
Movido pra cá em consequência. Se algo aqui um dia se mostrar uma
regra realmente permanente e não específica da S4 (candidato natural:
a regra de DoD do §4, sobre Product Patterns precisarem de contrato
formal — pode valer além desta Sprint), promovê-la de volta pra
`docs/requirements/` é decisão de governança separada, não feita
agora.

⸻

## 1. Por que este documento existe (raciocínio original, 09/09/2026 — ver nota de relocação acima)

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
| Login / Entrada | ✅ migrada `--m3-*` (achado de `S4-B2-002`, ver §5) | Estado real desta linha estava desatualizado — inspeção encontrou a tela do Modo Técnico (`#screenLoginRequired`) já 100% migrada por refatoração anterior, não `.auth-gate`/`--brd-*` como aqui registrado. `.auth-gate` continua existindo, mas é exclusivo do site principal (`index.html`) — telas comprovadamente separadas |
| Loading / Bootstrap | ✅ migrada `--m3-*` (`S4-B2-001`) | Skeleton avaliado e não usado (sem formato de conteúdo conhecido nas 3 transições desta tela — ver relatório); spinner já migrado é o "indicador definido pelo Design System" alternativo previsto pela matriz |
| Perfil do jogador | ✅ migrada `--m3-*` (`S4-B2-005`) | Correção em relação à nota anterior: o overlay (`#detailOverlay`/`.ct-modal-overlay`) já estava com tokens `--m3-*` mesmo ANTES de `S3-DS20-S4-PREP-001` — a implementação de Dialog daquela demanda migrou o fluxo DIFERENTE de visualização somente-leitura de jogador de outro clube (`openPlayerCard()`/`.m3-dialog`), não este. Migrados nesta demanda os 2 seletores exclusivos de `openDetail()` que restavam legados (hero nome/subtítulo, aviso de teto salarial). Setas de tendência (▲/▼) NÃO migradas — token `--brd-*` sem equivalente `--m3-*` estabelecido, registrado como divergência aberta |
| Tática / Formação | ✅ migrada `--m3-*` (parcial, `S4-B2-003`) | 2 tokens duplicados migrados (badge "problema" → `--m3-error`; indicador de lesão → `--m3-secondary`, mesmo mapeamento da #10). 2 divergências levantadas e **decididas pelo PM**: (1) `.mt-bench-row` mantido como padrão compacto próprio, não unificado com PlayerCard — contexto de uso diferente (reservas dentro do campinho); (2) tipografia `Rajdhani` do campinho/banco classificada como **BRDATA Extension** (identidade "placar de estádio", mesma lógica do `Bebas Neue` nos escudos) — não migra pra `--m3-display`. Verde do gramado também é BRDATA Extension (decorativo, sem equivalente semântico M3) |
| Treino | ✅ migrada `--m3-*` | Maioria já estava `--m3-*` (`.mt-scheme-card`, `.mt-dur-stepper`, `.mt-seg-group`, `.mt-card`/`.mt-stat-grid`/`.mt-week-strip`) antes desta demanda (`S4-B2-004`) — migrados 2 seletores legados restantes (aviso de folga protegida sobrescrita e botão "escolher jogador" do treino individual). Lista de elenco confirmada reaproveitando `playerRow()`/PlayerCard (`S3-DS20-S4-PREP-002`), sem mudança necessária. Paleta categórica de foco de treino (técnico/físico/tático) NÃO migrada — classificada como BRDATA Extension, mesmo tratamento de `.mt-pos-chip` (`S4-B2-003`). Botão de treino individual usa tipografia Rajdhani — mesma divergência já registrada em `S4-B2-003` (resolvida como BRDATA Extension, ver linha acima) |

**8 de 8 (100%) migradas** (Escolha do clube, Início, Elenco, Login,
Loading/Bootstrap, Tática/Formação, Treino, Perfil do jogador — todas
mescladas em `main`). **Batch 2 (Core) fechado por completo.**

Batch 3 — Transactional (4 telas, todas P0)

| Tela | Estado real | Observação |
|---|---|---|
| Mercado | ✅ migrada `--m3-*` (`S4-B3-002`) | Cada linha usa o TransferCard (`transferCardHTML()`, `S4-B3-001`) no lugar do antigo `.mt-market-row` ad hoc — mesma informação/ações, componente nomeado. `.mt-btn-loan`/`.mt-btn-sell` migrados junto (`--mt-ink-muted`/`--mt-crimson-400` → `--m3-on-surface-variant`/`--m3-error`) |
| Negociação / Proposta | ✅ migrada `--m3-*` (`S4-B3-003`) | "Fazer proposta" virou Dialog dinâmico (`openM3Dialog()`) no lugar do `#offerOverlay` estático. "Minhas propostas" usa TransferCard no lugar de `.mt-sponsor-proposal-row`. **Achado e corrigido nesta demanda: bug crítico pré-existente** que desde `S3-DS20-S4-PREP-001` deixava `--mt-*` TODO Dialog/Bottom Sheet sem `position:fixed`/`z-index` de verdade (um comentário CSS continha sem querer a sequência de fechamento de comentário no meio do texto) — ver `docs/HANDOFF_CLAUDE.md` (`S4-B3-003`) para o detalhe técnico completo |
| Contratos | 🟡 tela criada, em revisão do PM (`S4-B3-004`) | ContractCard (`S4-B3-001`) integrado numa tela nova (não existia — confirmado por inspeção com evidência: grep completo por "contrato", painel Clube inteiro, árvore inteira do menu). PM decidiu (opção 1: criar do zero); implementada em `claude/s4-b3-004-contratos`, aguardando aprovação antes do merge em `main` — ver `docs/HANDOFF_CLAUDE.md` |
| Resumo da rodada | ❌ `--mt-*` (legado) | MatchCard e FinancialSummary disponíveis e mesclados em `main` (`S4-B3-005`) — tela em si ainda sem demanda própria de migração |

**3 de 4 (75%) migradas e mescladas em `main`** (Mercado, Negociação/
Proposta, e o pré-requisito de componentes pra Resumo da rodada).
Contratos tem tela implementada mas ainda em branch própria, aguardando
revisão do PM (`S4-B3-004`) — com essa aprovação, o Batch 3 fecha por
completo exceto a migração de Resumo da rodada em si (que segue sem
demanda própria aberta).

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
| PlayerCard | Elenco, Treino, `openClubRoster()` | **Resolvido por `S3-DS20-S4-PREP-002`** — `playerRow()` formalizado como PlayerCard, contrato documentado em `carreira.js` e adendo em `S3_2_COMPONENTES_E_CONTRATOS.md` §60. Correção: Perfil do jogador NÃO é um ponto de uso do PlayerCard (é uma tela de detalhe própria, `openDetail()`, visualmente maior — o componente PlayerCard é a linha compacta de LISTA) — ver `S3_2_COMPONENTES_E_CONTRATOS.md` §60.2. Perfil do jogador migrada em `S4-B2-005` (ver linha 39 acima) sem depender do PlayerCard |
| MatchCard | Início/Dashboard, Resumo da rodada | **Componente disponível (`S4-B3-005`)** — `matchCardHTML()` em `carreira.js`, contrato documentado. Construído NOVO (não retroativo): inspeção encontrou 2 candidatos ad hoc, nenhum adequado sozinho (`#nextMatchBox` só cobre "próxima"; `.ct-round-result-row`, duplicado em 4 lugares do arquivo, só cobre "encerrada") — nenhum candidato único cobre os 5 estados da especificação, e o motor de partidas atual só produz 2 desses 5 de verdade ("próxima"/"encerrada"; "andamento"/"adiada"/"cancelada" são suportados pelo componente mas sem produtor real hoje). Nenhuma tela migrada nesta demanda |
| LeagueTable | Início/Dashboard, Histórico | Não migrada — segue tabela HTML tradicional |
| TransferCard | Mercado, Negociação | **Resolvido e mesclado em `main`**: componente criado em `S4-B3-001`, integrado de verdade em Mercado (`S4-B3-002`) e Negociação/Proposta (`S4-B3-003`) |
| ContractCard | Contratos | **Componente disponível (`S4-B3-001`)** — `contractCardHTML()` em `carreira.js`, contrato documentado. Divergência maior: a tela "Contratos" (Tela 16 da matriz) **não existe no app hoje** — só há pontos isolados (tag "fim de contrato" no Elenco, modal de renovação a partir do Perfil). `S4-B3-004` **bloqueada** por causa disso — migrar pressupõe uma tela existente, e não há nenhuma; decisão do PM pendente antes de prosseguir (ver `docs/HANDOFF_CLAUDE.md`) |
| FinancialSummary | Início/Dashboard, Resumo da rodada | **Resolvido por `S4-B3-005`** (formalização retroativa, mesmo caminho de PlayerCard) — o card "Financeiro" de `renderCentral()` (Início/Dashboard) já cobre saldo/variações/indicadores da especificação; contrato documentado como comentário acima do bloco em `carreira.js` (composição inline, sem função própria extraída — mudança estrutural ficaria fora do escopo de uma formalização). Nenhuma mudança visual/funcional |

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
   - Item 1: **Loading/Bootstrap** (`S4-B2-001`). **Concluída e
     APROVADA, mesclada em `main`** — tokens migrados nos 3 estados
     (carregamento/erro/conclusão); Skeleton avaliado e não usado (sem
     formato de conteúdo conhecido nas 3 transições desta tela —
     decisão registrada no relatório técnico), spinner já migrado
     cobre o "indicador definido pelo Design System" alternativo que a
     matriz também permite.
   - Item 2: **Login/Entrada** (`S4-B2-002`). **Concluída e APROVADA,
     mesclada em `main`, sem mudança de código**: inspeção encontrou a
     tela (`#screenLoginRequired`) já 100% migrada pros tokens
     `--m3-*` por refatoração anterior, e confirmou que ela é
     estrutura própria (`.mt-*`), sem compartilhamento nenhum com
     `.auth-gate` (exclusivo do site principal) — o risco de
     compartilhamento citado originalmente não se confirmou. Teste
     novo travando essa evidência contra regressão futura
     (`tests/e2e/test_s4_b2_002_login.js`).
   - Item 3: **Tática/Formação** (`S4-B2-003`, **concluída e mesclada em
     `main`**) — 2 tokens de cor legados migrados; 2 divergências
     confirmadas por inspeção (dependência do PlayerCard pro
     `.mt-bench-row`; esforço de tipografia `Rajdhani` acima de
     migração simples) e decididas pelo PM: `.mt-bench-row` mantido
     como padrão próprio, `Rajdhani` classificada como BRDATA
     Extension. As 3 telas P1 relacionadas (Eixos táticos, Marcação
     individual, Meus esquemas) seguem fora, são Batch 4.
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
   - Item 1: **TransferCard + ContractCard** (`S4-B3-001`) — **concluída
     e mesclada em `main`** — 2 componentes novos (não retroativos),
     sem lógica de negócio (valuation/renovação ficam fora dos
     componentes). Pré-requisito dos itens seguintes.
   - Item 2: **Mercado** (`S4-B3-002`) — **concluída e mesclada em
     `main`** — usa TransferCard; um dos fluxos transacionais mais
     críticos do produto (toda semana de jogo passa por ali).
   - Item 3: **Negociação/Proposta** (`S4-B3-003`) — **concluída e
     mesclada em `main`** (usa TransferCard + Dialog; achou e corrigiu
     de quebra o bug crítico de z-index do Dialog/Bottom Sheet).
   - Item 4: **Contratos** (`S4-B3-004`) — **implementada, aguardando
     revisão do PM**: tela criada do zero (decisão do PM depois de
     bloqueada por inspeção — ver §2/§3 acima e
     `docs/HANDOFF_CLAUDE.md`), branch `claude/s4-b3-004-contratos`,
     ainda não mesclada em `main`.
   - Item 5: **Inspecionar/formalizar MatchCard e FinancialSummary**
     (`S4-B3-005`) — **concluída e mesclada em `main`** (MatchCard
     construído novo, FinancialSummary formalizado retroativamente).
     Resolve a pendência do item 2b acima.
   - Item 6: **Resumo da rodada** — os 2 componentes que dependiam
     dela agora existem (item 5 concluído), mas a tela em si ainda
     está sem demanda própria de migração — pode ser especificada a
     qualquer momento agora, não depende mais de nada.
5. **Batch 4 (Complementary)** — as 7 telas P1, começando por uma
   verificação individual (não foram auditadas na S3.2.7). Ainda **sem
   demanda própria** — a demanda que cobria isso (`S4-B4-000`) foi
   reescopada a pedido do Murilo pra virar `S4-AUDIT-BACKLOG-001` (ver
   item 7 abaixo), então esta auditoria específica do Batch 4 volta a
   ficar pendente de nova especificação.
6. **Batch 5 (QA Visual/UX)** — revisão transversal, como já definido
   na matriz original.
7. **Auditoria de prontidão do backlog** (`S4-AUDIT-BACKLOG-001`,
   status `PRONTO PARA IMPLEMENTAÇÃO`) — **pós-implementação, não
   pré** (correção do Murilo, 10/09/2026): roda depois que uma ou mais
   das 10 demandas já especificadas (itens 3-4 acima, issues #12-#21)
   forem implementadas por qualquer sessão, pra confirmar o que foi de
   fato entregue (mesmo padrão que aconteceu 2 vezes com
   `S3-DS20-S4-PREP-001`/`002`, descoberto depois do fato), atualizar
   o handoff, e revalidar a cadeia de dependências entre elas à luz do
   que já foi concluído. Não bloqueia nem espera por novas
   especificações — é consolidação, não gate.

Cada um dos passos 2-5 deve nascer como uma demanda própria em
`docs/HANDOFF_CLAUDE.md` (mesmo formato de `S3-DS20-S4-PREP-001`), não
como uma "S4 inteira" de uma vez — mantém o padrão de escopo pequeno e
testável que already funcionou até aqui.

**Atualização (10/09/2026 — pós `S4-AUDIT-BACKLOG-001` + merge do
código):** dos itens 3 e 4 acima (as 10 demandas #12-#21), 9 foram
aprovadas pelo PM e o código já está mesclado em `main`
(`S4-B2-001/002/003/004/005`, `S4-B3-001/002/003/005` — ver §2 acima
pro estado real por tela, todas ✅). A 10ª (`S4-B3-004`/#20, item 4
acima) foi redefinida ("migrar" → "criar do zero", tela não existia)
com mini-spec em `docs/HANDOFF_CLAUDE.md`; já implementada na branch
`claude/s4-b3-004-contratos`, aguardando revisão/aprovação do PM antes
do merge em `main` (ver §2, linha "Contratos"). Item 6 (**Resumo da
rodada**) segue sem demanda própria — pré-requisito (`S4-B3-005`) já
mesclado, pode ser especificado agora. Item 5 (**Batch 4**) segue sem
verificação individual nem demanda própria. Item 7
(`S4-AUDIT-BACKLOG-001`) concluído e aprovado.

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
