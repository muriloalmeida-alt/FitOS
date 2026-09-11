# BRDATA Design System 2.0 — Estado Vigente

**Origem:** `docs/sprints/S3/S3_DS20_FUNDACAO_EXECUTAVEL.md` (S3.1 —
Fundação) + `docs/sprints/S3/S3_2_COMPONENTES_E_CONTRATOS.md` (S3.2 —
Componentes e Contratos). **Migrado por:** `DOCS-REQ-001` (11/09/2026),
reconciliado com os achados reais da S3.2.7 Readiness Review
(09/09/2026) e com todo o trabalho de migração da Sprint S4 concluído
até esta data — **não é uma cópia da especificação original como se já
estivesse implementada.**

Este é o documento mais sujeito a ficar desatualizado rápido (a S4
segue em execução). Antes de tratar qualquer afirmação de "estado real"
abaixo como verdade absoluta, confirmar contra `docs/sprints/S4/
S4_REQUISITOS_VIGENTES.md` (estado de execução vivo da Sprint) e contra
o código — regra 4 de `docs/README.md`.

---

## 1. Princípio central (vigente, não mudou desde a S3.1)

O BRDATA **adapta e configura** o Material Design 3 (M3) — não cria um
sistema visual paralelo pra substituí-lo. Toda decisão de Design System
deve ser classificada como uma das 4 categorias:

- **M3 Official** — direto da spec oficial do M3 (estados, interação,
  acessibilidade).
- **M3 Configured** — M3 configurado pra identidade BRDATA (cores,
  tipografia, shape, densidade).
- **BRDATA Extension** — necessidade real não coberta pelo M3, usada com
  parcimônia (ex.: tipografia `Rajdhani` no campinho/banco da tela
  Tática — ver §5).
- **BRDATA Product Pattern** — composição de produto (PlayerCard,
  MatchCard, LeagueTable, TransferCard, ContractCard, FinancialSummary).

## 2. Sistema de tokens — decisão de convergência (vigente)

A S3.1 original (§6-10) definiu um vocabulário conceitual próprio
(`bg.canvas`, `text.primary`, `state.success` etc.) que **nunca foi
implementado literalmente no código** — a S3.2.7 Readiness Review
confirmou isso por busca literal (zero ocorrências). Decisão de
convergência (tomada em `S3-DS20-S4-PREP-001`, 09/09/2026):

> **`--m3-*` é o sistema-alvo único do BRDATA DS 2.0.** O vocabulário
> `bg.canvas`/`text.primary`/`state.*` da S3.1 vira vocabulário
> conceitual/de documentação, mapeado assim:

| Vocabulário conceitual (S3.1 §6-10) | Token real |
|---|---|
| `bg.canvas` | `--m3-surface-dim` |
| `bg.surface` | `--m3-surface` |
| `bg.surfaceElevated` | `--m3-surface-container-high` |
| `border.default` | `--m3-outline-variant` |
| `border.strong` | `--m3-outline` |
| `text.primary` | `--m3-on-surface` |
| `text.secondary` / `text.muted` | `--m3-on-surface-variant` (mesmo token — M3 não separa os dois) |
| `brand.primary` | `--m3-primary` |
| `brand.strong` | `--m3-primary-container` |
| `accent.football` | `--m3-secondary` (dourado) |
| `state.danger` | `--m3-error` / `--m3-on-error` |
| `state.info` | `--m3-tertiary` / `--m3-on-tertiary` |
| `state.success` / `state.warning` | sem token direto pra superfície padrão ainda — só calibrado pro Toast (`--m3-inverse-success/-warning`); criar par próprio quando houver caso de uso real fora do Toast |

`--brd-*` (site principal — `index.html`/`admin.html`) e `--mt-*` (Modo
Técnico legado, `carreira.html`) continuam existindo e funcionando **sem
prazo de remoção definido** — descontinuação é trabalho de migração
tela a tela da própria S4, não um projeto separado.

## 3. Componentes de sobreposição/estado — implementados (S4)

Os 3 componentes P0 que a S3.2.7 encontrou **ausentes** no sistema
`--m3-*` foram criados em `S3-DS20-S4-PREP-001`:

- **Dialog** — `openM3Dialog()`/`closeM3Overlay()`, `.m3-dialog-overlay`.
  Focus-trap, Escape-to-close, restauração de foco ao fechar.
- **Bottom Sheet** — `m3OpenOverlay()` (mesma família de função do
  Dialog), `.m3-bottom-sheet-overlay`.
- **Skeleton** — implementado; avaliado e **intencionalmente não usado**
  em algumas transições (ex.: Loading/Bootstrap) por não haver formato
  de conteúdo conhecido nelas — não é um gap, é uma decisão registrada.

**Bug crítico já corrigido:** um comentário CSS continha sem querer a
sequência de fechamento de comentário (`*/`) no meio do texto, o que
derrubava silenciosamente a regra `position:fixed`/`z-index:500` de
`.m3-dialog-overlay, .m3-bottom-sheet-overlay` desde que
`S3-DS20-S4-PREP-001` foi implementada — todo Dialog/Bottom Sheet
renderizava com `position:static`/`z-index:auto` (mascarado pela
animação de escurecimento do backdrop). Achado e corrigido em
`S4-B3-003` (11/09/2026) — ver `git show 4d3f703:docs/HANDOFF_CLAUDE.md`
pro detalhe técnico completo.

## 4. BRDATA Product Patterns — estado real (11/09/2026)

| Padrão | Estado | Implementação |
|---|---|---|
| **PlayerCard** | ✅ Formalizado (retroativo) | `playerRow()` em `carreira.js`, contrato documentado (`S3-DS20-S4-PREP-002`). Usos reais: Elenco, roster do Treino, `openClubRoster()` (elenco de outro clube, somente leitura). **Perfil do jogador NÃO usa este componente** — é uma tela de detalhe própria (`openDetail()`), maior, não a linha compacta de lista. |
| **TransferCard** | ✅ Criado e integrado | `transferCardHTML()` (`S4-B3-001`), em uso real em Mercado (`S4-B3-002`) e Negociação/Proposta (`S4-B3-003`). |
| **ContractCard** | ✅ Criado e integrado | `contractCardHTML()` (`S4-B3-001`), em uso real na tela Contratos, criada do zero em `S4-B3-004` (a tela não existia antes — decisão do PM, issue #20). |
| **MatchCard** | ✅ Criado, sem ponto de uso ainda | `matchCardHTML()` (`S4-B3-005`), construído novo (não havia candidato único adequado — `#nextMatchBox` só cobria "próxima", `.ct-round-result-row` só "encerrada"). Motor de partidas hoje só produz de verdade 2 dos 5 estados suportados pelo componente ("próxima"/"encerrada"). Ponto de uso real (`#roundResultsOverlay`/`#rodadaOverlay`) é a demanda `S4-B3-006` (issue #24), especificada mas ainda não implementada nesta migração. |
| **FinancialSummary** | ✅ Formalizado (retroativo) | O card "Financeiro" de `renderCentral()` (Início/Dashboard) já cobria saldo/variações/indicadores da especificação — contrato documentado como comentário no código (`S4-B3-005`), sem extrair função própria (mudança estrutural ficaria fora do escopo de uma formalização). |
| **LeagueTable** | ❌ Não migrado | Segue como tabela HTML tradicional dentro de container de scroll horizontal (`.ct-scroll-x`) — aceitável como "scroll controlado" (S3.2 §41), mas não redesenhado como padrão de cards/priorização conforme a própria S3.2 §42 recomenda pra tabelas densas. Ainda sem demanda própria. |

## 5. Cobertura de telas — S4 Redesign Mobile (11/09/2026)

**Batch 2 — Core (8 telas): 100% migradas.** Escolha do clube, Início/
Dashboard, Elenco, Login/Entrada, Loading/Bootstrap, Tática/Formação
(migração parcial — ver nota abaixo), Treino, Perfil do jogador.

> **Nota — Tática/Formação:** migração parcial deliberada. 2 tokens de
> cor legados migrados (badge "problema" → `--m3-error`, indicador de
> lesão → `--m3-secondary`). 2 elementos classificados formalmente como
> **BRDATA Extension**, não migrados de propósito: tipografia
> `Rajdhani` do campinho/banco (identidade "placar de estádio", mesma
> lógica do `Bebas Neue` nos escudos) e `.mt-bench-row` (padrão compacto
> próprio pra reservas dentro do campinho, não unificado com
> PlayerCard — contexto de uso diferente). Verde do gramado também é
> BRDATA Extension (decorativo, sem equivalente semântico M3).

**Batch 3 — Transactional (4 telas): 3 de 4 migradas/criadas.**
Mercado ✅, Negociação/Proposta ✅, Contratos ✅ (criada do zero).
**Resumo da rodada** ❌ — MatchCard já disponível, mas a migração das 2
telas que cobrem esse conceito (`#roundResultsOverlay`,
`#rodadaOverlay`) tem demanda própria especificada (`S4-B3-006`) ainda
não implementada.

**Batch 4 — Complementary (7 telas): não verificado individualmente
ainda.** Telas: Onboarding, Comparar jogadores, Eixos táticos, Marcação
individual, Meus esquemas, Notícias/Eventos, Histórico/Estatísticas.
Auditoria própria (`S4-B4-READINESS-001`) especificada, ainda não
executada.

**Batch 5 — QA visual/UX transversal:** ainda não iniciado, depende do
fechamento dos Batches 2-4.

## 6. Gaps conhecidos, ainda abertos (herdados da S3.2.7, não resolvidos por nenhuma demanda de S4 até agora)

- **Ícones via emoji** — nenhuma biblioteca central de ícones; emoji
  ainda usado como ícone de interface em centenas de pontos do app.
  Contradiz a regra da S3.1 §16 ("não utilizar emoji como substituto de
  ícone de interface"). Recomendação vigente: substituir gradualmente ao
  migrar cada tela, não como projeto isolado.
- **Densidade de acessibilidade (ARIA) baixa** fora do que
  `S3-DS20-S4-PREP-001` já cobriu (Dialog/Bottom Sheet têm focus-trap e
  restauração de foco — um ganho real, mas pontual). Sem reauditoria
  completa desde 09/09/2026.
- **`LeagueTable`** não redesenhada como padrão mobile (ver §4).
- **Área de toque de alguns ícones do site principal** (`.icon-btn`
  36×36px, abaixo dos 48dp recomendados pelo M3) — não confirmado se
  ainda vale, escopo fora de `carreira.html`.

## 7. Regras de contrato de componente (vigentes, sem mudança)

Todo componente relevante deve ter, documentado como comentário no
código (não só na especificação): Nome, Objetivo, Responsabilidade,
Entradas, Saídas/eventos, Estados, Variações, Responsividade,
Acessibilidade, Dependências — formato já seguido por `playerRow()`,
`transferCardHTML()`, `contractCardHTML()` e `matchCardHTML()`.

**Regra de separação (inegociável):** o componente é responsável só
pela apresentação. Regra de negócio (valuation, cálculo de score de
contratação, decisão de renovação) pertence à camada funcional — nenhum
Product Pattern criado até agora viola isso (verificado em cada demanda
de criação).

## 8. Regras de processo (vigentes, sem mudança)

- **Ordem de evolução obrigatória:** tokens → primitivas → componentes →
  padrões de produto → telas. Não migrar uma tela sem os componentes de
  que ela depende existirem primeiro (essa foi a razão de
  `S3-DS20-S4-PREP-001`/`S4-B3-001` virem antes das telas que os usam).
- **Antes de criar componente novo:** verificar se já existe componente
  equivalente, primitiva aplicável, ou padrão BRDATA — nunca criar cópia
  independente (mesma regra de `CLAUDE.md` §5).
- **Preservação funcional:** migração visual nunca deve alterar regra de
  negócio, mercado, contratos, partidas, economia, evolução ou
  persistência.
- **Nenhuma implementação é considerada aprovada só por estar
  tecnicamente pronta** — aprovação formal do PM (Murilo) + atualização
  do `docs/HANDOFF_CLAUDE.md` = autorização de commit final em `main`.

---

## Nota de reconciliação (obrigatória por `docs/README.md` regra 4)

Este documento reflete o estado em **11/09/2026**. A Sprint S4 segue em
execução — Batch 4 (7 telas) ainda não foi auditado individualmente, e
`S4-B3-006` (Resumo da rodada) está especificada mas não implementada.
Qualquer trabalho novo deve reconfirmar o estado das telas/componentes
citados aqui contra `docs/sprints/S4/S4_REQUISITOS_VIGENTES.md` (fonte
viva de execução) antes de presumir que algo listado como "não migrado"
continua assim, ou que algo listado como "migrado" não sofreu
regressão.
