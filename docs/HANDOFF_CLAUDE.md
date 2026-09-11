HANDOFF_CLAUDE — Demandas vigentes e histórico

As regras de governança deste Handoff estão definidas em
docs/README_HANDOFF.md. Claude deve consultar o README_HANDOFF.md
para conhecer as regras (responsabilidades, fluxo, estados, escopo,
divergências, aprovação) — elas não são repetidas aqui.

⸻

Demandas vigentes

S3-DS20-S4-READINESS-001 — S3.2.7 Readiness Review

Status: AJUSTES NECESSÁRIOS
Sprint: S3 — BRDATA Design System 2.0
Fase: S3.2.7 — S4 Readiness Review
Prioridade: P0

Objetivo

Auditar a implementação atual do BRDATA Design System 2.0 e determinar se a base apresenta maturidade suficiente segundo os critérios definidos na documentação de S3/S4.

A avaliação deve considerar a implementação real existente e não apenas a documentação.

A demanda não autoriza automaticamente qualquer etapa posterior.

Contexto

As etapas S3.2.1 a S3.2.6 foram atividades de especificação e documentação realizadas pelo PM e não geram, por si só, demanda de desenvolvimento.

A S3.2.7 é a etapa que exige atuação do Dev para auditar a implementação existente e retornar evidências para validação do PM.

Problema

É necessário confirmar se a implementação atual:

* atende à fundação definida;
* possui componentes suficientemente consistentes;
* respeita os contratos definidos;
* apresenta comportamento responsivo adequado;
* atende aos requisitos de acessibilidade;
* cobre adequadamente as telas mobile;
* preserva as funcionalidades existentes;
* não possui regressões críticas conhecidas.

Escopo

Claude deve avaliar:

* Foundation;
* Components;
* Contracts;
* Responsive;
* Accessibility;
* S4 Coverage;
* Regression;
* Tests;
* Gaps;
* Divergences;
* Risks.

A cobertura deve considerar as 19 telas definidas em:

docs/sprints/S3/S3_S4_MATRIZ_TELAS_MOBILE.md

Fora de escopo

* reconstrução completa do frontend;
* criação de novos sistemas de jogo;
* alteração de regras de negócio;
* alteração do Match Engine;
* alteração do Transfer Engine;
* alteração da Economy;
* refatoração arquitetural oportunista;
* redesign independente fora do escopo documentado;
* mudanças de backend/API sem necessidade direta da auditoria.

Documentação relacionada

* docs/README_HANDOFF.md
* docs/project/ROADMAP.md
* docs/project/PROJECT_CONTEXT.md
* docs/project/CHANGELOG.md
* docs/sprints/S3/S3_DS20_FUNDACAO_EXECUTAVEL.md
* docs/sprints/S3/S3_2_COMPONENTES_E_CONTRATOS.md
* docs/sprints/S3/S3_S4_MATRIZ_TELAS_MOBILE.md
* docs/sprints/S3/S3_2_7_READINESS.md

Dependências

* implementação atual do BRDATA DS 2.0;
* documentação S3.1;
* documentação S3.2;
* matriz de telas mobile;
* regras de Material Design 3.

Requisitos

Claude deve:

1. ler a documentação relacionada;
2. inspecionar a implementação atual;
3. identificar o que já existe;
4. mapear dependências;
5. avaliar a implementação real;
6. executar os testes necessários;
7. registrar gaps;
8. registrar divergências;
9. registrar riscos;
10. registrar arquivos avaliados;
11. produzir relatório técnico;
12. retornar REVISÃO DO PM NECESSÁRIA.

O relatório deve apresentar status e evidências para cada categoria avaliada.

Critérios de aceite

A demanda deverá resultar em uma das classificações:

* APPROVED
* ADJUSTMENTS REQUIRED
* BLOCKED

O resultado deve estar sustentado por evidências da implementação real.

O relatório deve incluir:

* resumo executivo;
* Foundation;
* Components;
* Contracts;
* Responsive;
* Accessibility;
* S4 Coverage;
* Regression;
* Tests;
* Gaps;
* Divergences;
* Risks;
* arquivos avaliados;
* arquivos alterados/criados/removidos, se houver;
* resultado final;
* recomendação.

A demanda somente poderá ser considerada formalmente concluída após revisão e decisão do PM.

Validações

O PM deverá validar:

* aderência ao escopo;
* aderência ao M3;
* qualidade da implementação;
* coerência arquitetural;
* acessibilidade;
* responsividade;
* cobertura;
* preservação funcional;
* testes;
* gaps;
* riscos;
* divergências.

Riscos

* falsa percepção de readiness baseada somente na documentação;
* componentes duplicados;
* divergências com M3;
* acessibilidade insuficiente;
* comportamento mobile inconsistente;
* regressões;
* acoplamento entre UI e regras de negócio;
* dívida técnica relevante.

Observações

A S3.2.7 é uma auditoria e não deve ser transformada em uma grande refatoração.

Problemas encontrados devem ser registrados e classificados.

Se houver necessidade de ajustes, o PM atualizará o Handoff com os ajustes.

A aprovação formal do PM é obrigatória.

Somente após APROVADO e atualização formal do Handoff o commit final estará autorizado.

⸻

Relatório técnico — S3.2.7 S4 Readiness Review

Executado por: Claude · Data: 09/09/2026 · Nenhum código de produção foi
alterado — apenas inspeção. Todo o levantamento abaixo é baseado no
código real em `origin/main` (auditoria de leitura, sem correções).

1. Resumo executivo

A implementação real do BRDATA DS 2.0 está fragmentada em **três
sistemas de tokens/componentes que coexistem sem unificação**:

* `public/css/style.css` — tokens `--brd-*` / `--bg-app` / `--text-0`
  (site principal `index.html`, `admin.html`, e a tela de Login do
  Modo Técnico via `.auth-gate`);
* `public/carreira.html` (bloco `<style>` inline, ~2410 linhas) —
  sistema legado `--mt-*` (761 ocorrências de classes `.mt-*`);
* o mesmo arquivo — sistema novo `--m3-*` (173 ocorrências de `.m3-*`),
  introduzido pelos commits `7795a64` e `4aa5b2d` ("Redesign M3"),
  aplicado apenas a Início, Escolha do Clube, Elenco e a um conjunto de
  componentes compartilhados ("bridge").

Nenhum dos 15 nomes de token exigidos pela especificação da S3.1
(`bg.canvas`, `bg.surface`, `bg.surfaceElevated`, `border.default`,
`border.strong`, `text.primary`, `text.secondary`, `text.muted`,
`brand.primary`, `brand.strong`, `state.success/warning/danger/info`,
`accent.football`) existe literalmente no código — busca por essas
strings exatas em `public/` retorna zero ocorrências. O sistema `--m3-*`
usa nomenclatura própria do Material Design 3 (`--m3-primary`,
`--m3-surface-container-*`, `--m3-on-surface`, etc.), semanticamente
próxima ao pedido mas com vocabulário diferente do documentado.

A cobertura mobile real da matriz de 19 telas é de aproximadamente 3
telas (Início, Escolha do clube, Elenco) totalmente no sistema `--m3-*`,
mais componentes compartilhados que herdam tokens M3 por "bridge" sem
reconstrução de tela. As demais 16 telas — incluindo 9 das 12 telas P0
(Login, Perfil do jogador, Tática/Formação, Treino, Mercado,
Negociação/Proposta, Contratos, Resumo da rodada, Dashboard central)
— continuam nos sistemas legados (`--mt-*`/`--brd-*`).

Não foram encontradas regressões funcionais decorrentes da migração
parcial (a estratégia de "bridge" nos commits preservou seletores
existentes deliberadamente, e há um teste E2E dedicado que passa pela
Fundação M3). Também não foi encontrado acoplamento de regra de negócio
dentro de componentes visuais nos pontos verificados (`negotiateOffer`
permanece isolado da camada de apresentação).

**Conclusão da auditoria: a fundação existe, é tecnicamente sólida onde
foi aplicada (nomenclatura M3 correta, fallback de contraste AA real,
paleta dinâmica por clube), mas está incompleta, fragmentada em 3
sistemas paralelos e cobre uma fração pequena das telas P0 exigidas
para a S4. Resultado: ADJUSTMENTS REQUIRED (não aprovado, não
bloqueado).**

2. Foundation — ADJUSTMENTS REQUIRED

Evidência:
* `public/css/style.css:6-52` — bloco `:root{}` rotulado "BRDATA DESIGN
  SYSTEM": tokens `--brd-blue/navy/yellow/green/red/info/warn/positive`,
  `--bg-app/--bg-surface/--bg-sidebar`, `--text-0/1/2`,
  `--radius-lg/md/sm`, `--shadow-card`. Cobre apenas paleta clara/escura
  via `[data-theme="dark"]` (linhas 43-52) — não há bg.surfaceElevated
  nem elevação em escala (só um `--shadow-card` único).
* `public/carreira.html:150-179` — bloco `--m3-*`: papéis M3 corretos
  (`primary/on-primary/primary-container`, `surface-dim` até
  `surface-container-highest`, `on-surface`, `outline/outline-variant`,
  `inverse-surface`), escala de forma (`--m3-shape-xs` a `-full`). Есta
  é a implementação mais aderente ao M3 encontrada no código, mas só
  serve o subconjunto de telas migrado.
* `.mt-*` (761 ocorrências) é um terceiro conjunto de tokens/classes
  legado, ainda ativo na maioria das telas do Modo Técnico.
* Tipografia: categorias do documento (Display/Title/Section/Body/
  Small/Caption) não existem com esses nomes; o que existe é
  `--fs-h1/h2/h3/body/caption` (style.css:23-27) — hierarquia parcial,
  nomenclatura diferente da especificada, sem nível "Display" nem
  "Section" explícitos.
* Espaçamento: não foi encontrada uma escala de tokens de espaçamento
  (4/8/12/16/24/32/48/64) centralizada — os valores de padding/margin/
  gap no CSS são majoritariamente literais (`padding:14px 16px`,
  `gap:10px` etc.), não tokens.
* Ícones: **nenhuma biblioteca central de ícones foi encontrada.**
  Contagem de emoji usado como ícone de interface: 120 ocorrências em
  `carreira.html` + 142 em `carreira.js` (ex.: 🏆⚽📊💰🔒📈✅🎯), em
  contradição direta com a regra explícita da S3.1 ("não utilizar emoji
  como substituto de ícone de interface"). Onde há ícone real, é SVG
  inline pontual (`.bn-item svg`, `.m3-nav-item svg`), sem abstração
  `Icon` centralizada.
* Primitivas (`Text`, `Surface`, `Divider`, `Icon`, `Button`,
  `IconButton`, `Badge`, `Chip`, `Avatar`, `Input/Select`, `Progress`,
  `Skeleton`) descritas na S3.1 §18: existem equivalentes ad hoc para
  Card/Chip/Button dentro do subconjunto `--m3-*` (`.m3-card`,
  `.m3-btn-primary`, `.m3-btn-ghost`, `.m3-filter-chip`), mas não como
  primitivas documentadas e reutilizáveis fora dessas telas — `Icon` e
  `Skeleton` não têm nenhuma implementação (ver §Gaps).

Resultado: fundação parcialmente correta (o bloco `--m3-*` é uma boa
base M3 Configured), mas centralização e nomenclatura ainda não
atendem ao que a S3.1 define, e a existência de 3 sistemas paralelos
viola diretamente a "Regra contra sistemas paralelos" (S3.1 §45).

3. Components — ADJUSTMENTS REQUIRED

Componentes M3 P0 encontrados (dentro do subconjunto migrado):
Card (`.m3-card`), List Item (`.m3-list-item`), Bottom Navigation
(`.m3-bottom-nav`, `.m3-nav-item`), Button/Icon Button
(`.m3-btn-primary`/`-ghost`, `.m3-commission-icon-btn`), Chip
(`.m3-filter-chip`, `.m3-mini-chip`), Empty State (`.m3-empty`), FAB
(`.m3-fab`), Stat/KPI (`.m3-stat-card`).

Componentes P0 **não migrados / não encontrados no sistema `--m3-*`**:
* Dialog e Bottom Sheet — só existem na nomenclatura legada
  (`.ct-modal-overlay/-header/-footer`, `.mt-sheet-overlay/-option`),
  33 ocorrências combinadas em `carreira.html`. Nenhum `.m3-dialog` ou
  `.m3-bottom-sheet`.
* Loading/Skeleton — **nenhuma implementação encontrada** em nenhum dos
  3 sistemas (busca por "skeleton"/"shimmer" não retornou nada em
  `carreira.html` nem `style.css`). Este é um componente P0 obrigatório
  pela S3.1 §18.12 e §19 que simplesmente não existe no produto.
* Snackbar/Toast — existe e funciona (`toast()` em `carreira.js:545`,
  elemento `#toast` único, cálculo dinâmico de posição via
  `toastBottomOffset()`), mas não está integrado a nenhum dos 3
  sistemas de token como componente formal — é uma implementação
  própria e isolada.

App Bar/Header, Tabs, Back Action, Section Header, Inline Error: não
foi encontrada uma implementação central e nomeada para nenhum desses;
o que existe está espalhado por seletores específicos de tela
(`.ct-topbar-title`, `.mt-card-title`, `.mt-card-sub`).

4. BRDATA Product Patterns (PlayerCard, MatchCard, LeagueTable,
TransferCard, ContractCard, FinancialSummary) — ADJUSTMENTS REQUIRED

Nenhum dos 6 padrões está implementado como componente nomeado e
reutilizável — não existe `PlayerCard`, `MatchCard`, `LeagueTable`,
`TransferCard`, `ContractCard` nem `FinancialSummary` no código
(busca pelos 6 nomes exatos retorna apenas a função `openPlayerCard()`,
que é um *handler de abertura de modal*, não o componente de
apresentação em si).

Equivalentes funcionais parciais encontrados no sistema `--m3-*`:
* Jogador em lista → `.m3-list-item`/`.m3-li-*` (Elenco) — cobre parte
  do papel do PlayerCard, mas sem o nome/contrato formal do documento.
* Partida → `.m3-score-card`, `.m3-match-row` (tela Ao Vivo/Jogos) —
  cobre parte do papel do MatchCard.
* Financeiro → `.m3-fin-bar`/`.m3-finance-num` — cobre parte do papel
  do FinancialSummary.
* Classificação (LeagueTable) — segue como tabela HTML tradicional
  dentro de um contêiner de scroll horizontal (`.ct-scroll-x`,
  confirmado em `carreira.html:770`), **não** foi redesenhada como
  padrão de cards priorizados conforme pede a S3.2 §42 ("tabelas
  densas não devem simplesmente ser comprimidas" — aqui ainda são).
* TransferCard e ContractCard (Mercado/Negociação/Contratos): não há
  evidência de um componente dedicado; essas telas P0 continuam fora
  do sistema `--m3-*` neste momento.

5. Contracts — sem evidência de violação nos pontos verificados

Verificação pontual (não exaustiva) da separação UI × regra de
negócio:
* `negotiateOffer()` (`carreira.js:3897`) é uma função isolada do
  Transfer Engine, chamada pela camada de tela (ex.: `carreira.js:4408`,
  `11104`, `11281`), e não está embutida dentro de nenhuma função de
  renderização de card/lista — consistente com a regra de separação.
* `deriveClubPalette()`/`applyClubPalette()` (`carreira.js:347-410`)
  fazem apenas derivação visual de cor (apresentação), não decisão de
  negócio — classificação correta como responsabilidade de componente.

Limitação: esta verificação cobriu os pontos amostrados durante a
auditoria, não uma varredura completa de todas as telas/funções de
render; não constitui garantia de ausência total de acoplamento.
Nenhum componente possui, no entanto, um contrato documentado no
código (docstring/comentário formal com Nome/Objetivo/Entradas/Estados)
como pede a S3.2 §7 — os "contratos" hoje existem apenas na
documentação (`S3_2_COMPONENTES_E_CONTRATOS.md`), não como artefato
rastreável no código.

6. Responsive — ADJUSTMENTS REQUIRED

* `public/css/style.css` contém 25 blocos `@media`, dos quais 22 são
  `max-width` (redução progressiva a partir de layout desktop) e
  apenas 3 são `min-width` (telas grandes). Isso é o padrão
  "desktop-first com breakpoint de compressão" que a
  `S3_S4_MATRIZ_TELAS_MOBILE.md` §3 proíbe explicitamente ("não é
  permitido simplesmente: reduzir fontes; diminuir cards; reduzir
  espaçamentos; esconder elementos; comprimir tabelas — e considerar
  isso um redesign mobile").
* As telas migradas para `--m3-*` (Início/Elenco/Escolha do clube)
  foram, pelo contrário, testadas/desenvolvidas com viewport mobile
  nativo (`test_m3_bloco1_inicio.js` usa `viewport:{width:390}`) — bom
  sinal de que a *nova* abordagem é de fato mobile-first, mas isso vale
  só para as ~3 telas já migradas.
* `overflow-x:hidden` no `body` (`style.css:65`) é descrito no próprio
  código como "rede de segurança" para pontos de scroll horizontal já
  corrigidos na origem — funciona como fallback, não como garantia
  estrutural, e mascara possíveis pontos de overflow ainda não
  identificados.
* LeagueTable/Classificação usa `overflow-x:auto` como estratégia
  (`.ct-scroll-x`) — aceitável como "scroll controlado" pela S3.2 §41,
  mas não foi reorganizada em cards/priorização como o mesmo documento
  recomenda no caso de tabelas densas.

7. Accessibility — ADJUSTMENTS REQUIRED

* Densidade de atributos de acessibilidade é muito baixa: 19
  ocorrências de `aria-label`/`role`/`aria-live`/`aria-hidden` em
  `carreira.html` (5463 linhas) e 12 em `carreira.js` (14207 linhas).
  Não há evidência de uma estratégia sistemática de ARIA fora de
  pontos isolados.
* Área de toque: `.icon-btn` genérico (`style.css:178`) mede 36×36px —
  abaixo da recomendação M3 de 48dp; `.m3-nav-item` (bottom nav) não
  define altura mínima explícita, ficando dependente do conteúdo
  interno (ícone 20px + texto + paddings ≈ 44-47px, no limite).
* Ponto positivo real: `contrastRatio()` (`carreira.js`, introduzida no
  commit `7795a64`) implementa a fórmula de luminância relativa/WCAG
  corretamente, e `deriveClubPalette()` rejeita paletas de clube que não
  atinjam 4.5:1 (AA texto normal), recaindo no tema padrão — é a única
  verificação de contraste automatizada encontrada no projeto, e cobre
  só a paleta dinâmica por clube, não o restante da interface.
* Não foi encontrado suporte explícito a aumento de texto (nenhum uso
  de `rem`/`clamp()` relevante para escala de fonte do usuário — as
  fontes são majoritariamente `px` fixos).

8. S4 Coverage — ADJUSTMENTS REQUIRED (gap crítico em P0)

| Tela (prioridade) | Sistema atual |
|---|---|
| Login/Entrada (P0) | `--brd-*` (legado, `.auth-gate`) |
| Loading/Bootstrap (P0) | não identificado como tela própria migrada |
| Escolha do clube (P0) | `--m3-*` ✅ migrada |
| Início/Dashboard (P0) | `--m3-*` ✅ migrada (parcial — "Início/Clube") |
| Elenco (P0) | `--m3-*` ✅ migrada |
| Perfil do jogador (P0) | `.ct-modal-*` (legado) |
| Tática/Formação (P0) | `--mt-*` (legado) |
| Treino (P0) | `--mt-*` (legado) |
| Mercado (P0) | `--mt-*` (legado) |
| Negociação/Proposta (P0) | `--mt-*` (legado) |
| Contratos (P0) | `--mt-*` (legado) |
| Resumo da rodada (P0) | `--mt-*` (legado) |

Das 12 telas P0, apenas 3 (25%) estão no sistema `--m3-*` da S3. As 9
telas P0 restantes — incluindo os fluxos transacionais mais críticos
do produto (Mercado, Negociação, Contratos) — permanecem no sistema
legado. As 7 telas P1 não foram verificadas individualmente (fora do
foco de atenção especial pedido pelo documento, dado o gap já
encontrado em P0).

9. Regression — sem regressões identificadas na amostra verificada

* Os dois commits de migração (`7795a64`, `4aa5b2d`) descrevem
  deliberadamente uma estratégia de preservar seletores existentes
  (“não renomeado — evita ripple nos ~70 scripts de teste que clicam
  nele direto”), reduzindo risco de regressão por design.
* Existe 1 teste E2E dedicado (`test_m3_bloco1_inicio.js`) cobrindo nav
  de 5 itens, identidade do clube na topbar e fluxo de onboarding —
  passou pela leitura do código sem indício de quebra.
* Um ponto de dívida técnica confirmado pelo próprio código: comentário
  em `carreira.js:485-487` afirma que `.mt-bottom-nav` "não existe mais
  nesse elemento, só continua no CSS por enquanto" — CSS morto
  reconhecido e ainda não removido.
* Esta auditoria não executou a suíte E2E completa (fora do escopo de
  uma revisão de leitura sem alteração de ambiente); a ausência de
  regressão é inferida da leitura do código e do teste dedicado
  existente, não de uma execução de CI nesta sessão.

10. Tests — ADJUSTMENTS REQUIRED (cobertura insuficiente para o DS)

* `tests/e2e/` tem 121 arquivos de teste (120 `test_*` + 1 `sim_*`
  visível na busca), mas apenas **1** (`test_m3_bloco1_inicio.js`) é
  específico do redesign M3, cobrindo só Bloco 1 (Início/Clube/Elenco).
* Não há testes automatizados de contraste, responsividade (múltiplos
  viewports) ou regressão visual (screenshot diffing) para o Design
  System em si — o `contrastRatio()` embutido no app não tem teste
  unitário dedicado encontrado.
* Nenhum teste cobre as 9 telas P0 ainda não migradas quanto a
  aderência ao DS (natural, já que ainda não foram migradas).

11. Gaps

| Gap | Prioridade | Componente/Tela afetada | Risco | Recomendação |
|---|---|---|---|---|
| 3 sistemas de token paralelos (`--brd-*`/`--mt-*`/`--m3-*`) sem plano de convergência único | P0 | Toda a base | Duplicação, inconsistência visual crescente, custo de manutenção | PM decide: adotar vocabulário `--m3-*` como único sistema-alvo (ou mapear `bg.canvas` etc. como aliases dele) e formalizar prazo de descontinuação de `--mt-*`/`--brd-*` |
| 9 de 12 telas P0 fora do sistema `--m3-*` | P0 | Tática, Treino, Mercado, Negociação, Contratos, Resumo da rodada, Perfil do jogador, Login, Loading | S4 não pode iniciar com cobertura real, apenas com fundação parcial | Definir sequência de migração destas 9 telas como parte inicial da S4, não como pré-requisito bloqueante |
| Dialog e Bottom Sheet não existem em `--m3-*` | P0 | Todas as telas que usam modal/sheet (maioria) | Overlays continuam com identidade visual antiga mesmo em telas já migradas | Criar `.m3-dialog`/`.m3-bottom-sheet` antes de expandir a migração |
| Loading/Skeleton inexistente em qualquer sistema | P0 | Todo carregamento de dados | Layout shift, percepção de erro em vez de carregamento | Implementar componente Skeleton conforme S3.1 §18.12 |
| Emoji usado como ícone de interface (262 ocorrências combinadas) | P1 | Praticamente todo o app | Inconsistência visual, sem controle de tamanho/acessibilidade | Substituir por biblioteca de ícones central + labels acessíveis |
| Nenhuma biblioteca de ícones centralizada | P1 | Toda a base | Inconsistência, duplicação de SVGs ad hoc | Escolher 1 biblioteca (M3 Symbols ou equivalente) e criar primitiva `Icon` |
| LeagueTable não redesenhada como padrão mobile (cards/priorização) | P1 | Classificação | Leitura difícil em telas estreitas apesar do scroll funcionar | Tratar como item da S4, conforme S3.2 §42 |
| Densidade muito baixa de ARIA (19+12 ocorrências em ~20k linhas) | P1 | Toda a base | Acessibilidade insuficiente para leitores de tela | Auditoria de acessibilidade dedicada antes/durante S4 |
| `.icon-btn` com 36×36px (abaixo de 48dp M3) | P2 | Ícones de ação no site principal/topbar | Erros de toque em mobile | Ajustar para 40-48px na próxima revisão de contrato do componente |
| CSS morto confirmado (`.mt-bottom-nav` não usado) | P2 | Bottom nav legado | Peso de bundle, confusão de manutenção | Remover quando a tela correspondente for migrada |
| Cobertura de teste do DS limitada a 1 arquivo | P1 | Todo o redesign M3 | Regressões futuras não detectadas automaticamente | Ampliar suíte E2E a cada bloco migrado, incluir teste de contraste |

12. Divergences

| Onde | Comportamento atual | Comportamento esperado (spec) | Impacto | Recomendação | Classificação M3 |
|---|---|---|---|---|---|
| Nomenclatura de tokens | `--m3-primary`, `--m3-surface-container-*`, `--brd-blue`, `--mt-navy` etc. | `bg.canvas`, `text.primary`, `state.success` etc. (S3.1 §6-10) | Documentação e código usam vocabulários diferentes — dificulta rastreabilidade entre spec e implementação | PM decide se o vocabulário `--m3-*` (mais próximo do M3 oficial) substitui a nomenclatura da S3.1, ou se a S3.1 precisa de uma camada de alias | M3 Configured (o `--m3-*` já é isso; a S3.1 documentou um vocabulário próprio que nunca foi implementado literalmente) |
| Existência de 3 sistemas simultâneos | `--brd-*`, `--mt-*`, `--m3-*` coexistem | Um único sistema de tokens centralizado (S3.1 §45 "regra contra sistemas paralelos") | Risco de inconsistência visual crescente conforme mais telas migram | Formalizar `--m3-*` como sistema-alvo único e roadmap de descontinuação dos outros dois | Divergência de implementação (não é extensão BRDATA legítima) |
| Ícones via emoji | 262 ocorrências de emoji como ícone de UI | "não utilizar emoji como substituto de ícone de interface" (S3.1 §16) | Inconsistência visual e de acessibilidade | Substituição gradual por ícones reais ao migrar cada tela | Divergência direta da regra documentada |
| LeagueTable em tabela + scroll horizontal | Tabela HTML tradicional dentro de container com overflow-x | "avaliar: redução de colunas, agrupamento, expansão, cards" (S3.2 §42) | Leitura mobile aceitável mas não ideal | Redesenhar como parte da S4, não bloqueante para a S3 | BRDATA Extension ainda não evoluída |

13. Risks

* Componente duplicado/fragmentado: 3 sistemas de token e ausência de
  Dialog/Bottom Sheet/Skeleton unificados — risco alto de inconsistência
  crescente à medida que mais telas migrarem sem essas peças resolvidas
  primeiro.
* Dependência de valores hardcoded: espaçamento e parte da tipografia
  não usam escala de tokens, são valores literais em `px`.
* Acessibilidade insuficiente: densidade de ARIA muito baixa e ausência
  de suporte a aumento de texto do usuário.
* Dívida técnica confirmada: CSS morto (`.mt-bottom-nav`) já identificado
  pelo próprio código-fonte.
* Cobertura de teste concentrada: só 1 dos 121 testes E2E cobre o
  redesign M3; expandir a migração sem expandir a suíte aumenta o risco
  de regressão silenciosa.
* Falsa percepção de readiness: o roadmap oficial (`ROADMAP.md`) marca
  S3 como "🟢 Concluída*" — esta auditoria mostra que a fundação visual
  real cobre uma fração pequena da superfície do produto, o que reforça
  a nota "* não congelada" já presente no roadmap, mas merece atenção
  antes de tratar S4 como só aplicação direta da S3.

14. Arquivos avaliados (não exaustivo — arquivos centrais do escopo)

* `public/css/style.css` (1262 linhas)
* `public/carreira.html` (5463 linhas, incl. bloco `<style>` inline de
  ~2410 linhas)
* `public/js/carreira.js` (14207 linhas)
* `public/index.html`, `public/admin.html` (leitura pontual)
* `tests/e2e/test_m3_bloco1_inicio.js`
* Histórico de commits: `7795a64`, `4aa5b2d`, `ed7bf7f`, `0b2bf0c`
* Documentação: `docs/README.md`, `docs/README_HANDOFF.md`,
  `docs/HANDOFF_CLAUDE.md`, `docs/project/ROADMAP.md`,
  `docs/project/PROJECT_CONTEXT.md`,
  `docs/sprints/S3/S3_DS20_FUNDACAO_EXECUTAVEL.md`,
  `docs/sprints/S3/S3_2_COMPONENTES_E_CONTRATOS.md`,
  `docs/sprints/S3/S3_S4_MATRIZ_TELAS_MOBILE.md`,
  `docs/sprints/S3/S3_2_7_READINESS.md`

15. Arquivos alterados/criados/removidos

Nenhum arquivo de código de produção foi alterado, criado ou removido
durante esta auditoria — conforme exigido pelo escopo (S3.2.7 §30 e
§Fora de escopo). A única alteração desta demanda é a atualização
desta seção do próprio `docs/HANDOFF_CLAUDE.md`, que é o mecanismo de
entrega do relatório.

16. Resultado final

**ADJUSTMENTS REQUIRED**

Justificativa: a fundação técnica onde foi aplicada (`--m3-*`) é sólida
e corretamente alinhada ao Material Design 3 (nomenclatura de papéis
correta, fallback de contraste AA real, forma em escala), e não há
evidência de regressão funcional ou de acoplamento de regra de negócio
na camada visual nos pontos verificados. Isso descarta BLOCKED.
Porém, a implementação está fragmentada em 3 sistemas paralelos, cobre
apenas ~25% das telas P0 (3 de 12) exigidas para a S4, carece de 3
componentes P0 inteiros (Dialog, Bottom Sheet, Skeleton no sistema
M3), usa emoji como ícone de interface em 262 pontos, e tem densidade
de acessibilidade (ARIA) muito baixa fora do subconjunto já migrado.
Isso descarta APPROVED. Os ajustes necessários estão listados na seção
11 (Gaps) e não exigem reconstrução — são extensões pontuais e
convergência de nomenclatura sobre o que já existe.

17. Recomendação

1. PM decide a convergência de nomenclatura de tokens (`--m3-*` como
   sistema único vs. formalizar aliases para o vocabulário da S3.1) —
   pré-requisito para qualquer trabalho novo de S4, para não criar um
   4º sistema paralelo.
2. Antes de expandir a migração para as 9 telas P0 restantes, resolver
   os 3 componentes P0 ausentes no sistema M3 (Dialog, Bottom Sheet,
   Skeleton) — eles serão necessários em praticamente todas as telas
   seguintes (Mercado, Negociação, Contratos usam modais pesadamente).
3. Migração das 9 telas P0 pendentes pode proceder incrementalmente
   como o próprio trabalho da S4 (não como pré-requisito bloqueante
   adicional à S3) — a estratégia de "bridge" já usada nos commits
   `7795a64`/`4aa5b2d` provou reduzir risco de regressão e pode
   continuar sendo o padrão.
4. Reduzir uso de emoji como ícone junto com cada tela migrada, não
   como projeto separado.
5. Incluir 1 teste E2E básico (nav + tokens aplicados) por bloco de
   telas migrado, seguindo o padrão de `test_m3_bloco1_inicio.js`.
6. Não é necessário nem recomendado interromper a S4 para resolver tudo
   isto de uma vez — os gaps P1/P2 podem ser tratados durante a
   execução da S4, conforme a própria S3_S4_MATRIZ_TELAS_MOBILE.md §"Relação S3↔S4" já prevê revisão do DS com o aprendizado real do mobile.

REVISÃO DO PM NECESSÁRIA.

18. Decisão do PM

Data: 09/09/2026
Decisão: **AJUSTES NECESSÁRIOS**
Decidido por: Murilo — aprovação/validação formal, conforme
`docs/README_HANDOFF.md` §13/§17 e a adaptação de governança registrada
em `docs/README.md` (regra 1): quem especifica/implementa/revisa
tecnicamente (Claude) não fecha essa decisão sozinho.

Parecer técnico prévio (Claude, chapéu PM, registrado como comentário na
issue #9): concordância com a classificação `ADJUSTMENTS REQUIRED`
proposta no relatório — evidências conferidas por amostragem direta
contra o código em `origin/main` (linhas, contagens e uma citação de
comentário do código), sem indício de fabricação nem de regressão.

Ajustes necessários (base: seção 11 "Gaps" e seção 17 "Recomendação"
deste relatório):
1. Decidir a convergência de nomenclatura de tokens (`--m3-*` como
   sistema único vs. formalizar alias para o vocabulário da S3.1) antes
   de qualquer trabalho novo de S4, para não criar um 4º sistema
   paralelo.
2. Resolver os 3 componentes P0 ausentes no sistema `--m3-*` (Dialog,
   Bottom Sheet, Skeleton) antes de expandir a migração às 9 telas P0
   ainda no sistema legado.
3. Migração das 9 telas P0 pendentes (Login, Perfil do jogador,
   Tática/Formação, Treino, Mercado, Negociação/Proposta, Contratos,
   Resumo da rodada, Loading/Bootstrap) pode prosseguir de forma
   incremental como trabalho inicial da própria S4 — não é
   pré-requisito bloqueante adicional à S3.
4. Reduzir uso de emoji como ícone de interface (262 ocorrências) à
   medida que cada tela for migrada, não como projeto isolado.
5. Ampliar a cobertura de teste E2E do Design System a cada bloco de
   telas migrado (hoje só 1 dos ~121 testes cobre o redesign M3).
6. Os demais gaps P1/P2 (LeagueTable não redesenhada, densidade de ARIA
   baixa, `.icon-btn` abaixo de 48dp, CSS morto) podem ser tratados
   durante a execução da S4, não bloqueiam o início dela.

Encerramento desta demanda: a auditoria em si
(`S3-DS20-S4-READINESS-001`) está **concluída** — seu objetivo era
determinar a prontidão da implementação, e a determinação foi entregue
com evidência real, revisada e agora decidida. O resultado não libera
o início "puro" da S4: os itens 1 e 2 acima devem ser resolvidos
primeiro (ou tratados como as primeiras tarefas formais da S4).

Esta demanda **não é movida para a seção Histórico** — essa seção é
reservada a demandas `APROVADO`, conforme `docs/README_HANDOFF.md` §16.
Fica registrada aqui, com status `AJUSTES NECESSÁRIOS`, como a decisão
vigente. O trabalho de ajuste em si (itens 1-6 acima) deve ser aberto
como uma nova demanda quando o Murilo priorizar — não é reaberto sob
este mesmo ID.

**Nota de fechamento (sessão PM, 11/09/2026):** os 6 ajustes pedidos
acima já foram todos endereçados, sob IDs próprios (nunca reabrindo
este) — evidência real, não presumida:

1. Convergência de nomenclatura de tokens — resolvida por
   `S3-DS20-S4-PREP-001` (título da própria demanda: "+ convergência
   de tokens"), aprovada e mesclada.
2. Dialog/Bottom Sheet/Skeleton — os 3 componentes P0 criados na mesma
   `S3-DS20-S4-PREP-001`, aprovada e mesclada.
3. Migração das 9 telas P0 — **todas as 9 concluídas**: Loading/
   Bootstrap (`S4-B2-001`), Login (`S4-B2-002`), Tática/Formação
   (`S4-B2-003`), Treino (`S4-B2-004`), Perfil do jogador
   (`S4-B2-005`), Mercado (`S4-B3-002`), Negociação/Proposta
   (`S4-B3-003`), Contratos (`S4-B3-004`), Resumo da rodada
   (`S4-B3-006`) — todas aprovadas e mescladas em `main`
   (`docs/sprints/S4/S4_REQUISITOS_VIGENTES.md` §2 confirma 8/8 + 4/4
   = 100% dos Batches 2 e 3).
4. Redução de emoji como ícone — tratada incrementalmente a cada tela
   migrada (não virou projeto isolado, como pedido).
5. Cobertura de teste E2E do Design System — ampliada a cada bloco:
   9 testes novos dedicados (`test_s4_b2_*`/`test_s4_b3_*`), contra 1
   único antes desta rodada.
6. Gaps P1/P2 remanescentes (LeagueTable, ARIA, `.icon-btn`, CSS
   morto) — não bloquearam a execução da S4, como previsto; seguem
   como dívida técnica conhecida, não resolvida nesta rodada
   (nenhuma delas foi endereçada especificamente até aqui).

Com os itens 1-3 (os únicos genuinamente bloqueantes) 100% resolvidos,
esta demanda está pronta para fechamento formal — proposto ao PM:
`APROVADO`. Decisão final continua sendo do Murilo (mesma regra desde
o início: quem especifica/revisa tecnicamente não fecha essa decisão
sozinho).

Issue de rastreio: `https://github.com/muriloalmeida-alt/FitOS/issues/9`
— fechada como concluída (a execução da auditoria pedida nela foi
entregue e revisada); os ajustes que ela revelou passam a ser tratados
em uma nova demanda, não como reabertura dessa issue.

⸻

SAVE-LIMIT-001 — Save de carreira "grande demais": eliminar o beco sem saída

Status: REVISÃO DO PM NECESSÁRIA
Sprint: fora da S4 (Confiabilidade — CLAUDE.md §9/§10, prioridade P0
"Confiabilidade" no CLAUDE.md §47, a mais alta do projeto — acima de
qualquer Game Engine/Mundo/UX)
Prioridade: P0
Issue: https://github.com/muriloalmeida-alt/FitOS/issues/29

**Decisão do PM (Murilo, 11/09/2026): implementação autorizada** ("Pode
seguir com o desenvolvimento"). Implementação concluída nesta mesma
sessão — relatório abaixo, aguardando revisão antes do merge em `main`.

Objetivo

Eliminar o cenário em que uma carreira em andamento simplesmente para
de salvar porque o save ultrapassou o limite de tamanho — hoje isso
acontece e a única saída oferecida ao jogador é reiniciar a carreira
do zero (perder tudo). **Esse cenário não pode existir de jeito
nenhum** — nem como "limite alto o bastante que na prática nunca
acontece", precisa de uma saída real quando o crescimento se
aproximar do limite, não um beco sem saída quando ele for ultrapassado.

Contexto

Pedido do usuário: "O save ficou muito grande não pode existir em
nenhum cenário. Devo convencer nosso jogador que ele deve desistir do
seu jogo?" — não, a resposta é consertar o sistema, não convencer
ninguém a desistir.

**Evidência real, já levantada (inspeção de
`server/src/careerStore.js` + `public/js/carreira.js`):**

1. `MAX_BYTES = 768 * 1024` (768KB) em `careerStore.js` — já foi
   levantado uma vez (de 400KB) especificamente porque uma carreira
   "multi" (elenco dos 60 clubes das 3 divisões, não só os 19 da
   própria — decisão de produto documentada no próprio comentário do
   arquivo) **já nasce em ~500KB medido**, deixando só ~268KB de folga
   pra tudo que acumula depois (temporadas, notícias, transferências,
   base, scouts, premiações).
2. Quando o save excede 768KB, `saveCareer()` lança erro
   `status = 413` ("Save da carreira grande demais."). O cliente
   (`persistCareer()`, `carreira.js:4568`) mostra o toast: **"O save
   dessa carreira ficou grande demais — reinicie a carreira pra
   continuar salvando."** e retorna `false` — sem quebrar a sessão
   atual (o jogo continua rodando na aba aberta), mas **nenhum
   progresso novo é salvo a partir daí**. Fechar a aba, trocar de
   dispositivo ou só recarregar a página perde tudo desde o último
   save bem-sucedido. A única saída oferecida é literalmente
   abandonar a carreira.
3. **Mitigações que já existem** (então parte do trabalho de conter
   crescimento já foi feito antes, não é um problema ignorado):
   `MAX_SEASON_HISTORY = 15`, `NEWS_FEED_MAX = 60`,
   `MAX_PLAYER_SEASON_HISTORY = 15`, `TRANSFER_LOG_MAX`,
   `FINANCE_LEDGER_MAX`, `CASH_HISTORY_MAX = 8`,
   `MAX_LEAGUE_SQUAD_OTHER_DIVISION = 16` (elenco de clube de outra
   divisão capado a 16 jogadores, vs. o elenco cheio do seu próprio).
   Um comentário no próprio código (`carreira.js:7622`) já registra
   que `CAREER.resultsByRound` foi reduzido pra guardar só a rodada
   atual e a anterior especificamente por causa de uma falha 413
   anterior — ou seja, **este mesmo bug já se manifestou antes e foi
   parcialmente mitigado, mas continua acontecendo**.
4. **Gap confirmado, não mitigado**: `CAREER.clubHistory` (histórico
   de clubes que o técnico dirigiu ao longo da carreira) não tem
   nenhum cap — cresce sem limite a cada troca de clube.
5. **Alavancas disponíveis, ainda não usadas**: nenhuma compressão
   (gzip) no arquivo salvo em disco nem na resposta/corpo da
   requisição HTTP — o servidor não tem middleware de compressão
   nenhum hoje; um blob JSON de save comprime tipicamente bem (texto
   repetitivo, muitas chaves iguais).

Escopo

Chapéu implementador deve, nesta ordem:

1. **Medir de verdade** (não estimar) o tamanho real de uma carreira
   "multi" ao longo de várias temporadas simuladas (mesmo padrão de
   simulação usado em S8/`sim_transfer_ai_*`), pra confirmar onde o
   crescimento realmente concentra — elenco base (maior suspeito,
   dado o `~500KB` já na criação) vs. estruturas acumulativas
   (histórico, log, notícias).
2. **Eliminar o gap confirmado**: capar `CAREER.clubHistory` (mesmo
   padrão de `MAX_SEASON_HISTORY`).
3. **Avaliar compressão** (gzip) tanto no arquivo persistido em disco
   quanto na resposta HTTP (`Content-Encoding`) — medir o ganho real
   antes de decidir se compensa a complexidade adicional.
4. **Eliminar o "beco sem saída"**: antes de chegar em 413 (recusa
   dura), implementar aviso proativo quando o save se aproximar do
   limite (ex.: 85-90% de `MAX_BYTES`) E/OU um mecanismo de poda
   automática de dados históricos não-essenciais (reduzir caps
   existentes ainda mais como último recurso automático, nunca
   perdendo estado de jogo ativo — elenco, contratos, tabela,
   finanças) antes de recusar salvar — a decisão exata de qual
   mecanismo (aviso, poda automática, ou os dois) fica pro
   implementador propor com evidência da medição do item 1, mas o
   resultado final não pode ser "usuário vê 413 e não tem o que
   fazer".
5. Se a medição do item 1 mostrar que o elenco multi-divisão é
   realmente o fator dominante, avaliar (registrar como divergência
   se for uma mudança grande, não decidir sozinho) se compensa
   estruturalmente: subir `MAX_BYTES` de novo com compressão como
   contrapeso, reduzir ainda mais `MAX_LEAGUE_SQUAD_OTHER_DIVISION`,
   ou outra alternativa — sem tirar a decisão de mercado "3 divisões"
   já tomada (CLAUDE.md: preservar funcionalidade existente).
6. Testar compatibilidade de save (CLAUDE.md §33): save novo, save
   antigo sem os campos/caps novos, save que já está perto/acima do
   limite atual — nenhum desses pode corromper ou travar irrecuperável.
7. Retornar relatório técnico nesta mesma seção, com os números reais
   medidos, status `REVISÃO DO PM NECESSÁRIA`.

Fora de escopo

* remover a decisão de produto de mercado com as 3 divisões (60
  clubes) — é consequência, não causa a reverter;
* mudar a arquitetura de persistência (blob único por conta) — fora
  do tamanho desta demanda; se a medição revelar que isso é
  inevitável a longo prazo, registrar como divergência pro PM decidir
  separadamente;
* qualquer mudança de regra de jogo pra "reduzir dado gerado" (ex.:
  diminuir elenco de verdade, tirar temporada de histórico visível ao
  usuário) — a poda, se acontecer, é de dado interno/técnico, nunca
  de funcionalidade que o usuário vê e usa.

Dependências

* `server/src/careerStore.js` (`MAX_BYTES`, `saveCareer`).
* `public/js/carreira.js` (`persistCareer`, todos os `*_MAX`
  existentes).
* Testes/simulações de S8 como referência de padrão de medição.

Requisitos

Mesma sequência obrigatória, com ênfase em medir antes de decidir:
inspecionar → **medir com evidência real** → localizar → entender →
planejar → alterar → testar → revisar.

Critérios de aceite

* medição real do crescimento de uma carreira "multi" ao longo de
  múltiplas temporadas, documentada;
* `CAREER.clubHistory` capado;
* decisão registrada (com números) sobre compressão — implementada
  ou justificado por que não;
* nenhum cenário realista de uso (carreira "multi" longa) termina em
  413 sem alternativa — ou o limite efetivo aumenta o suficiente
  (medido, não chutado), ou existe poda/aviso automático antes do
  beco sem saída, ou os dois;
* compatibilidade de save (novo/antigo/no limite) preservada.

Validações

O PM deverá validar: evidência de medição real (não estimativa),
eliminação do gap de `clubHistory`, decisão sobre compressão com
números, e — o critério mais importante — confirmação de que o
cenário relatado pelo usuário (save trava, única saída é reiniciar)
deixou de ser possível.

Riscos

* baixo pra maioria dos itens (caps, compressão) — mudança aditiva,
  sem alterar regra de jogo;
* médio se a medição apontar que só subir o limite não resolve de
  verdade e uma poda automática de histórico for necessária —
  precisa de cuidado pra nunca podar dado que o usuário ainda usa
  (CLAUDE.md §33/§48, preservar o que funciona).

Relatório técnico (implementação)

Branch: `claude/save-limit-001`.

1. Medição real (script novo, temporário, mesmo espírito de
   `sim_transfer_ai_*.js`: `tests/e2e/sim_save_growth.js` — usa só
   funções de produção reais: `resolveRoundInstant`/`finishRoundTail`/
   `advanceSeason`, nunca reimplementa fórmula nem regra):
   * Uma carreira "multi" real nasce em **~560KB** (73% do limite de
     768KB) — confirma o achado já registrado na especificação.
   * 4 temporadas simuladas: o tamanho **não cresce sem parar** — na
     verdade cai levemente (560KB → ~480KB, com um pico de ~660KB ao
     fim da 1ª temporada). As estruturas acumulativas
     (`newsFeed`/`transferLog`/`financeLedger`/`resultsByRound`/etc.)
     já estão bem capadas pelos `*_MAX` existentes — não são o
     problema real.
   * **Achado principal, com evidência**: `CAREER.leagueSquads` (o
     elenco dos 59 outros clubes das 3 divisões) responde por **~79%
     do tamanho total** (380KB de 482KB no estado final medido) — é
     um dado altamente repetitivo (mesmas ~15-20 chaves de jogador
     repetidas ~1300+ vezes). Confirma a hipótese do item 5 do escopo:
     o elenco multi-divisão é de fato o fator dominante, não as
     estruturas acumulativas.
2. `CAREER.clubHistory` capado: `CLUB_HISTORY_MAX = 15` (mesmo padrão
   de `MAX_SEASON_HISTORY`), aplicado em `endCurrentClubStint()` e
   também retroativamente pra save antigo em `migrateCareerDefaults()`
   (compatibilidade — CLAUDE.md §33). Custo medido por entrada: ~83-111
   bytes — real, mas pequeno; não é o achado que resolve o problema
   sozinho (ver item 1).
3. **Compressão gzip — a alavanca que resolve de verdade** (medida
   real, não estimada): o blob de save comprime **92-93%** com gzip
   nível 6 (560KB → ~42KB; brotli chega a 95%, mas gzip já é nativo do
   Node e universalmente suportado por `fetch`, sem exigir nada do
   cliente). Decisão implementada:
   * `server/src/careerStore.js`: cada carreira é armazenada (memória
     + disco) já comprimida, num envelope `{ __gz: "<base64>" }` — e
     **`MAX_BYTES` passa a valer sobre o tamanho COMPRIMIDO**, não o
     JSON bruto. Na prática, o teto efetivo de JSON bruto sobe de
     ~768KB pra **~10MB** (768KB / ~0,075 de razão medida) sem mexer
     no número declarado. Migração transparente: save gravado antes
     desta demanda (objeto cru, sem `__gz`) é comprimido automaticamente
     ao carregar (`load()`), sem perda de dado nem ação do cliente.
     Benefício colateral: o arquivo agregado `careers.json` (todas as
     contas juntas) também fica ~92-95% menor no disco — acelera a
     escrita síncrona já documentada no arquivo.
   * `server/server.js`: resposta HTTP de `GET /api/career` (a única
     rota que devolve o blob inteiro) agora vem com
     `Content-Encoding: gzip` quando o cliente aceita (`fetch` do
     navegador aceita e descomprime sozinho, sem mudança nenhuma no
     cliente) — medido/confirmado via teste real (header presente,
     dado íntegro depois de descomprimido).
   * **Decisão registrada, não implementada**: compressão do lado do
     UPLOAD (cliente comprimir o `PUT` antes de enviar) foi avaliada e
     **não implementada** — exigiria mudança no cliente
     (`CompressionStream`, checar suporte de navegador) sem resolver
     nada que ainda esteja quebrado (o problema relatado já está
     resolvido pela compressão no armazenamento/leitura); fica
     registrado caso um dia o volume de upload em si vire gargalo.
4. **Elimina o "beco sem saída" de verdade**: como última linha de
   defesa (não encontrada necessária em nenhuma medição real, mas "não
   pode existir em nenhum cenário" é categórico), `saveCareer()` agora
   poda histórico não-essencial automaticamente e tenta salvar de novo
   **uma vez** antes de recusar — nunca toca elenco, contrato,
   escalação, tabela ou finanças (estado de jogo ativo, intocável).
   Testado com payload sintético incompressível grande o bastante pra
   provar o mecanismo (`test_save_limit_001_careerstore.js`): resolve
   sozinho quando o excesso está em histórico; ainda assim recusa
   (413) quando o excesso está em estado ativo (squad), como deveria —
   nunca fica "meio salvo".
   Mensagem do cliente (413) atualizada: não manda mais "reinicie a
   carreira" (não é mais a única saída, e não resolveria nada hoje) —
   convida a tentar de novo e reportar como bug, já que o cenário
   descrito no relato original não foi reproduzido em nenhuma medição.
5. Compatibilidade de save testada explicitamente: save novo, save
   "antigo" (pré-compressão, objeto cru no arquivo), save no limite
   (payload sintético) — nenhum corrompe nem trava irrecuperável
   (`test_save_limit_001_careerstore.js`, 6/6).

Testes novos: `tests/e2e/test_save_limit_001_careerstore.js` (6/6,
lógica pura de `careerStore.js` — compressão, migração, poda, 413/400
preservados) e `tests/e2e/test_save_limit_001.js` (5/5, fluxo real via
UI — save real sem 413, `Content-Encoding: gzip` confirmado,
`CLUB_HISTORY_MAX` e compatibilidade de save antigo). Regressão:
`test_ao_vivo.js` (7/7), `test_mercado_multi_persist.js` (1/1, já
confirma "sem 413" no cenário real de mercado multi-divisão),
`test_board_goals.js` e `test_bloco789_perfil_config.js` (fluxos de
persistência/reload, ambos passando). `test_save.js` e `test_cup.js`
deram timeout num passo de UI não relacionado (modal de pré-jogo/Copa)
— confirmado **pré-existente** (mesmo comportamento em `main` sem
estas mudanças).

Resultado proposto: **APROVADO** — medição real documentada,
`clubHistory` capado, compressão implementada com números reais (não
estimativa), nenhum cenário medido termina em 413 sem alternativa, e o
mecanismo de poda automática garante que mesmo o cenário extremo tem
saída. Compatibilidade de save preservada e testada. Aguardando
revisão formal do PM antes do merge em `main`.

Observações

Prioridade P0 — reliability tem precedência sobre as 5 outras demandas
abertas nesta rodada (`GE-BALANCE-001/002`, `GE-COPA-001`,
`S4-B3-006`, `S4-B4-READINESS-001`), nenhuma das quais envolve risco
de perda de progresso do jogador.

⸻

GE-BALANCE-001 — Reduzir sequências de invencibilidade do clube humano

Status: PRONTO PARA IMPLEMENTAÇÃO
Sprint: fora da S4 (Game Engine / Balanceamento — CLAUDE.md §13/§22/§30,
mais próximo de S6 "Motor de partida 2.0" no roadmap oficial, mas
tratado aqui como demanda isolada, a pedido do Murilo, não como
antecipação da S6 inteira)
Prioridade: P1
Issue: https://github.com/muriloalmeida-alt/FitOS/issues/26

Objetivo

Reduzir a frequência/facilidade com que o clube do jogador emenda
sequências longas (10+) de vitórias sem contrapeso, preservando o
princípio de determinismo/explicabilidade (CLAUDE.md §44/§45) — não é
"deixar o jogo trapacear contra o jogador", é fazer o motor reagir de
forma plausível a um time em grande fase, do jeito que futebol de
verdade reage (times menores jogam a vida contra o líder, cansaço
acumula sem rotação, etc.).

Contexto

Pedido do usuário: "Em vários momentos o jogador está vencendo 10
partidas consecutivas se transformando em um clube invencível. O jogo
precisa ser mais real."

Inspeção real do motor atual (`computeHumanStrength`,
`carreira.js:4981`): a força efetiva considera qualidade dos titulares,
completude do elenco, formação, tática e condição física média dos
titulares — mas **nenhum desses fatores reage a uma sequência de
vitórias em si**. `applyConditionRecovery` (`carreira.js:7018`)
recupera 10-16 pontos de condição por rodada só pra quem ficou no
banco — quem joga toda rodada sem rotação perde condição
progressivamente (via `applyMatchWearChunk`), o que já é uma pressão
real contra "escalar os 11 melhores toda rodada pra sempre" — mas não
há:
* motivação extra de adversários contra um líder disparado/invicto;
* qualquer viés que dê zebra estruturalmente mais provável contra um
  time muito mais forte, além do que a distribuição de Poisson já
  produz sozinha;
* qualquer penalidade ligada especificamente ao tamanho da sequência
  de vitórias (moral do adversário, "jogo decisivo", imprensa/pressão).

**Fórmula exata de qualquer contrapeso não é decidida aqui** — é
trabalho de balanceamento do chapéu implementador, com evidência
(rodar `sim_transfer_ai_*`-style simulações, mesmo padrão de S8, pra
comparar distribuição de sequências de vitórias antes/depois).

Escopo

Chapéu implementador deve:

1. Inspecionar a curva real de recuperação de condição/fadiga pra
   titulares que jogam toda rodada sem rotação (não presumido aqui) —
   confirmar se ela já limita sequências longas na prática ou se
   permanece alta o suficiente pra sustentar 10+ vitórias sem custo
   perceptível.
2. Avaliar e propor (não precisa implementar todas de uma vez —
   registrar o que entra nesta rodada e o que fica pra depois) 1 ou
   mais mecanismos plausíveis de "resistência dinâmica" contra
   sequências longas, por exemplo (lista de candidatos, não
   prescrição fechada):
   - motivação extra de adversários (pequeno bônus de atk/def) contra
     o líder da tabela ou um time numa sequência longa de vitórias —
     narrativamente explicável ("clube pequeno joga a vida contra o
     líder");
   - reforçar a pressão de fadiga acumulada pra quem não faz rotação,
     se a inspeção do item 1 confirmar que ela é fraca demais hoje;
   - checar se `poissonSample`/os `lambda` calculados já produzem
     zebra com frequência plausível quando a força relativa é muito
     alta, e ajustar clamps se necessário.
3. Qualquer mecanismo novo deve ser determinístico dado
   estado+seed+decisões (CLAUDE.md §44) e explicável ao usuário
   (CLAUDE.md §45) — nunca um "nerf" arbitrário sem causa visível na
   partida.
4. Validar com simulação (mesmo padrão dos testes `sim_*` já
   existentes pra IA de transferências, S8) comparando distribuição de
   sequências de vitórias antes/depois — não só "parece melhor".
5. Testar que nenhuma regra de negócio existente quebra (transferências,
   moral, fadiga, lesões).
6. Retornar relatório técnico nesta mesma seção do handoff, com a
   evidência da inspeção do item 1 e os mecanismos efetivamente
   implementados, status `REVISÃO DO PM NECESSÁRIA`.

Fora de escopo

* reescrever o motor de gols (Poisson) do zero;
* mudar fórmulas de treinamento/evolução de atributos;
* qualquer competição além do Brasileirão (Copa do Brasil é
  `GE-COPA-001`, separada);
* "trapacear" contra o jogador sem lastro narrativo/explicável.

Dependências

* motor de partida atual (`computeHumanStrength`, `poissonSample`,
  `applyMatchWearChunk`/`applyConditionRecovery`).
* Testes/simulações existentes de S8 como referência de padrão de
  validação.

Requisitos

Mesma sequência obrigatória: inspecionar → localizar → entender →
planejar → alterar → testar/simular → revisar.

Critérios de aceite

* curva real de fadiga/rotação documentada com evidência;
* pelo menos 1 mecanismo de resistência dinâmica implementado e
  validado por simulação, com efeito mensurável na distribuição de
  sequências de vitórias;
* nenhuma regra de negócio existente quebrada;
* mecanismo é explicável ao usuário (não uma penalidade invisível).

Validações

O PM deverá validar: evidência da inspeção, mecanismo(s) escolhido(s)
e por quê, resultado da simulação comparativa, explicabilidade.

Riscos

* médio — balanceamento é fácil de errar pro lado oposto (jogo ficar
  artificialmente contra o jogador); validação por simulação antes de
  aprovar é obrigatória, não opcional.

Observações

Pedido do usuário matinha (Corinthians/Flamengo) sendo rebaixados é
tratado como demanda separada (`GE-BALANCE-002`), mesmo pedido
original mas mecanismo diferente (força/reputação de clube, não
sequência de vitórias).

⸻

GE-BALANCE-002 — Peso da tradição/força de clube na simulação (relegação)

Status: PRONTO PARA IMPLEMENTAÇÃO
Sprint: fora da S4 (Game Engine / Mundo — CLAUDE.md §13/§22, mais
próximo de S9/S10 no roadmap oficial, tratado aqui como demanda
isolada a pedido do Murilo)
Prioridade: P1
Issue: https://github.com/muriloalmeida-alt/FitOS/issues/27

Objetivo

Fazer clubes com histórico/tradição maior terem uma força de base mais
condizente com sua realidade, reduzindo (sem eliminar — futebol de
verdade tem crises reais) a chance de um clube tradicional cair até a
Série C numa carreira simulada.

Contexto

Pedido do usuário: "Clubes com histórico devem ter um rating maior.
Não faz sentido clubes como Corinthians e Flamengo sendo rebaixados
até a Série C."

Inspeção real do sistema atual:
* Elenco inicial de clubes reais vem de dados reais via API-Sports
  (`buildRealPlayer`, `carreira.js:1346`) quando disponível — então a
  força inicial de um clube grande tende a refletir seu elenco real na
  temporada capturada. **Não há, porém, nenhum atributo de "tradição"/
  "reputação de clube" separado** — o único campo `reputation` que
  existe (`CAREER.reputation`, `carreira.js:1868` em diante) é a
  reputação do TÉCNICO (jogador), não do clube.
* Relegação (`relegationZoneIds`, `carreira.js:3285`,
  `applyPromotionRelegation` ao redor de `carreira.js:3308-3336`) é
  **puramente posicional** — os últimos N times da tabela caem, sem
  nenhum piso ou proteção ligada a história/torcida/orçamento do
  clube. Um clube grande com elenco mal gerido pela IA (ou pelo
  próprio jogador, se assumir o clube) cai exatamente como qualquer
  outro.
* Elencos da CPU são renovados por sorteio inteiro na virada de
  temporada (`renewLeagueSquad`, citado em `applyNaturalAgingEvolution`)
  — sem uma correção estrutural puxando de volta pra cima um clube
  tradicional que caiu, ele pode ficar preso numa divisão inferior
  indefinidamente.

**Fórmula exata (quanto de piso, como se recupera com o tempo) não é
decidida aqui** — trabalho de balanceamento do implementador, com
evidência.

Escopo

Chapéu implementador deve:

1. Inspecionar a fonte de dados de clube (frozen-catalog/API-Sports) e
   confirmar se já existe algum campo aproveitável de força histórica/
   torcida/orçamento (ex.: capacidade de estádio, receita) antes de
   inventar um novo do zero — reuso antes de criação (CLAUDE.md §5).
2. Se não existir, propor um campo novo de "força de base"/tradição
   por clube (pequeno conjunto curado, não uma tabela gigante mantida
   à mão pra centenas de clubes — avaliar se um proxy calculável, tipo
   histórico de posições/títulos já presente nos dados, resolve sem
   dado novo mantido manualmente).
3. Usar esse fator pra influenciar, com peso moderado (não absoluto):
   - a geração/renovação de elenco da CPU pra esse clube
     (`renewLeagueSquad`), puxando de volta em direção à força
     histórica ao longo de temporadas, não instantaneamente;
   - opcionalmente, um pequeno amortecedor na zona de rebaixamento
     pra clubes de tradição muito alta (ex.: não imunidade, mas menor
     probabilidade relativa) — **avaliar com cautela**, um "piso"
     artificial rígido quebraria a lógica de mérito esportivo
     (CLAUDE.md §22, IA deve representar decisões plausíveis, não
     favoritismo).
4. Preservar 100% a possibilidade de um clube grande realmente cair —
   é sobre tornar menos provável, não impossível; futebol real tem
   Botafogo/Palmeiras/Vasco em Série B/C historicamente.
5. Testar com simulação de múltiplas temporadas (mesmo padrão de
   `GE-BALANCE-001`) comparando frequência de rebaixamento de clubes
   tradicionais antes/depois.
6. Retornar relatório técnico nesta mesma seção, status `REVISÃO DO PM
   NECESSÁRIA`.

Fora de escopo

* imunidade total a rebaixamento pra qualquer clube;
* mudar a fonte de dados de clubes/jogadores (API-Sports/frozen
  catalog) de forma estrutural;
* qualquer mudança na regra de pontos corridos/critérios de
  desempate da tabela.

Dependências

* `server/frozen-catalog/` (dados reais de clubes).
* `renewLeagueSquad`, `relegationZoneIds`,
  `applyPromotionRelegation`.

Requisitos

Mesma sequência obrigatória: inspecionar → localizar → entender →
planejar → alterar → testar/simular → revisar.

Critérios de aceite

* fator de tradição/força de base definido com evidência (reuso de
  dado existente preferido a dado novo mantido à mão);
* influencia renovação de elenco da CPU de forma gradual, não
  instantânea;
* rebaixamento continua sendo possível pra qualquer clube — só menos
  provável pra tradicionais, validado por simulação;
* nenhuma regra de tabela/desempate alterada.

Validações

O PM deverá validar: fonte do fator de tradição (reuso vs. novo),
evidência de que rebaixamento continua genuinamente possível,
resultado da simulação comparativa.

Riscos

* médio-alto — é fácil errar pro lado de favoritismo perceptível
  ("o jogo protege os grandes"), o que quebraria a credibilidade
  competitiva do produto; validação por simulação e linguagem de
  "menos provável, não impossível" são obrigatórias na implementação.

Observações

Relacionada a `GE-BALANCE-001` (mesmo pedido do usuário, mecanismos
diferentes — uma é sobre sequência de vitórias do clube do jogador,
esta é sobre força/tradição de clube na simulação como um todo,
incluindo CPU).

⸻

GE-COPA-001 — Expandir Copa do Brasil (60 clubes, ida e volta, cabeças de chave, ao vivo)

Status: PRONTO PARA IMPLEMENTAÇÃO
Sprint: fora da S4 (Mundo / Competições — CLAUDE.md §13, mais próximo
de S9/S11 no roadmap oficial, tratado aqui como demanda isolada a
pedido do Murilo)
Prioridade: P1
Issue: https://github.com/muriloalmeida-alt/FitOS/issues/28

Objetivo

Expandir a Copa do Brasil existente pra um formato mais realista:
60 clubes (não 16), mata-mata com ida e volta (não jogo único),
cabeças de chave entrando em fases posteriores (não todos na 1ª fase),
e partidas do próprio clube do jogador jogáveis "ao vivo" (não só
resolvidas instantaneamente).

Contexto

Pedido do usuário: "Copa do Brasil: Maior torneio nacional com 60
clubes disputando. Me ajude a criar um mata mata onde todos
participam. Com tabela própria, com jogos ao vivo, com partidas de ida
e volta. Para que o chaveamento funcione os primeiros pode colocar
alguns cabeças de chave que entrem nas próximas fases."

**A Copa do Brasil já existe no jogo hoje — isto é uma expansão
estrutural, não uma criação do zero** (regra de ouro do CLAUDE.md §5:
buscar antes de criar). Inspeção real (`setupCup`/`resolveCupPhase`/
`simulateCupTie`, `carreira.js:2385-2470`):

* **16 clubes**, não 60 — os 16 elencos de maior overall médio entram
  direto (`strengths.slice(0, 16)`), sorteio embaralhado com RNG
  determinístico pro chaveamento das oitavas.
* **Jogo único por confronto** (`simulateCupTie`), decidido nos
  pênaltis em caso de empate — não há ida e volta.
* **Sem cabeças de chave por fase** — os 16 entram todos juntos na
  mesma fase inicial (oitavas), sem nenhum grupo entrando só depois.
* **Sem partida "ao vivo"** — mesmo o confronto do próprio clube do
  jogador é resolvido instantaneamente via `resolveCupPhase` (chamada
  em `finishRoundTail`), nunca passa por `startLiveMatch` (o motor que
  dá o modo ao vivo pro Brasileirão). Confirmado: `resolveCupPhase` é
  chamado direto, sem qualquer branch pro fluxo ao vivo.
* 4 fases (`CUP_PHASES = ["r16","qf","sf","final"]`), prêmios fixos
  por fase (`CUP_PRIZE`), calendário fixo de rodadas
  (`CUP_ROUNDS = { r16: 6, qf: 14, sf: 22, final: 30 }`, uma fase a
  cada ~8 rodadas do Brasileirão).

Esta é a maior das 3 demandas desta rodada — mudança estrutural real
no motor de competições, não um ajuste de balanceamento. Decisões de
produto que precisam ficar registradas aqui (feitas nesta
especificação, não deixadas pro implementador decidir sozinho):

1. **Quem entra nos 60** — não só os 16 mais fortes; precisa incluir
   clubes de todas as divisões (A/B/C/D), mesmo espírito da Copa do
   Brasil real (clubes de todo o país, não só a elite da Série A). A
   fonte de dados de clubes hoje é por divisão
   (`CAREER.divisionTeams`) — o implementador deve inspecionar se há
   clubes suficientes em todas as divisões pra montar 60 sem repetir
   nem inventar clubes fictícios além do que `DEMO_TEAMS_SERIE_C` já
   cobre.
2. **Cabeças de chave** — clubes mais fortes (critério: overall médio
   do elenco, mesmo usado hoje) entram numa fase mais avançada
   (ex.: 1ª fase só com os mais fracos/menores, cabeças de chave
   entram a partir da 2ª ou 3ª fase) — replica o formato real da Copa
   do Brasil (times menores começam antes, grandes entram depois).
   Número exato de cabeças de chave e em qual fase entram fica pro
   implementador propor com uma tabela de fases explícita (quantos
   clubes por fase, de onde vêm) antes de codar, e trazer de volta
   pra validação do PM antes de implementar (CLAUDE.md §36 —
   "quais dados entram/saem, qual fórmula" precisa estar claro antes
   de escrever código pra algo desse tamanho).
3. **Ida e volta** — todas as fases, ou só a partir de alguma fase (final
   às vezes é jogo único até na Copa do Brasil real, dependendo do
   ano/formato)? Decisão do implementador propor com justificativa,
   trazer pra validação.
4. **Ao vivo** — só as partidas do PRÓPRIO clube do jogador (mesmo
   critério já usado no Brasileirão, CPU x CPU continua instantâneo)
   — reaproveitar `startLiveMatch`, não construir um 2º motor de
   partida ao vivo (CLAUDE.md §5).
5. **Tabela própria** — uma tela/visualização de chaveamento dedicada
   (diferente da Tabela do Brasileirão, que é pontos corridos, não
   mata-mata) — decisão de UI fica registrada como pendente pra quando
   isto virar trabalho de tela (pode ser uma extensão da inspeção do
   Batch 4 se fizer sentido, ou demanda de UI própria depois que a
   engine estiver pronta — **não misturar engine com redesign visual
   nesta demanda**, mesmo princípio de "menor conjunto de mudanças"
   do CLAUDE.md §49).

Escopo

Chapéu implementador deve, ANTES de escrever código:

1. Inspecionar `setupCup`/`resolveCupPhase`/`simulateCupTie` por
   completo (a base desta expansão é evolução, não substituição —
   CLAUDE.md §5/§9).
2. Propor e registrar aqui (retornando ao PM pra validação antes de
   implementar, dado o tamanho da mudança) uma tabela de fases
   explícita: quantos clubes entram em cada fase, de onde vêm
   (todas as divisões ou só um subconjunto), quantos cabeças de chave
   e a partir de qual fase, ida e volta em quais fases.
3. Só depois da validação do PM nesse desenho, implementar:
   - expandir o pool de entrada pra 60 clubes cruzando as divisões
     disponíveis;
   - implementar confronto de ida e volta (2 jogos, gols fora como
     critério de desempate se empatar no agregado — ou pênaltis
     direto, decisão a registrar);
   - implementar entrada escalonada de cabeças de chave por fase;
   - conectar o confronto do próprio clube do jogador ao
     `startLiveMatch` existente, sem duplicar o motor.
4. Preservar prêmios/calendário existentes na medida do possível,
   ajustando `CUP_ROUNDS`/`CUP_PRIZE` conforme o novo número de fases
   exigir (mais fases pra chegar de 60 a 1 campeão).
5. Testar (mesmo padrão de sempre — mobile-first se tocar UI, mais
   simulação de chaveamento completo pra confirmar que sempre fecha
   num campeão único sem clube duplicado/perdido).
6. Retornar relatório técnico nesta mesma seção, status `REVISÃO DO PM
   NECESSÁRIA` — mas o desenho do item 2 acima retorna ANTES, como um
   checkpoint intermediário obrigatório, dado o tamanho da mudança.

Fora de escopo

* redesign visual da tela de Copa do Brasil (fica pra depois, quando
  a engine estiver pronta — pode virar demanda própria, inclusive
  dentro do trabalho do Batch 4 se fizer sentido na ocasião);
* qualquer mudança nas outras competições (Brasileirão A/B/C/D);
* criar um 2º motor de partida ao vivo — reaproveitar `startLiveMatch`;
* mudar a fonte de dados de clubes (frozen-catalog/API-Sports)
  estruturalmente — só usar o que já existe pra montar os 60.

Dependências

* `setupCup`, `resolveCupPhase`, `simulateCupTie`, `CUP_PHASES`,
  `CUP_ROUNDS`, `CUP_PRIZE` (motor atual da Copa).
* `startLiveMatch` (motor ao vivo do Brasileirão, a reaproveitar).
* `CAREER.divisionTeams` (clubes de todas as divisões).

Requisitos

Mesma sequência obrigatória, com um checkpoint extra dado o tamanho:
inspecionar → localizar → entender → **planejar e validar o desenho
com o PM antes de codar** → alterar → testar/simular → revisar.

Critérios de aceite

* desenho de fases (quantos clubes, cabeças de chave, ida e volta)
  validado pelo PM antes da implementação;
* 60 clubes participam, cruzando divisões;
* mata-mata sempre fecha num campeão único, sem clube duplicado/
  perdido, validado por simulação;
* ida e volta implementado nas fases decididas;
* cabeças de chave entram na(s) fase(s) decidida(s);
* confronto do próprio clube do jogador pode ser jogado ao vivo,
  reaproveitando `startLiveMatch`;
* nenhuma outra competição alterada.

Validações

O PM deverá validar em 2 momentos: (1) o desenho de fases antes da
implementação; (2) o relatório final com evidência de simulação
completa do chaveamento.

Riscos

* alto — é a maior mudança estrutural das 3 demandas desta rodada,
  toca calendário/premiação/motor ao vivo; o checkpoint de desenho
  antes de codar existe justamente pra reduzir esse risco.

Observações

Das 3 demandas desta rodada (`GE-BALANCE-001`, `GE-BALANCE-002`,
`GE-COPA-001`), esta é a única que exige validação de desenho em 2
etapas — as outras 2 só retornam ao final. Recomenda-se começar pelas
outras 2 (menor risco) antes desta, se a ordem de execução ficar a
critério do PM.

⸻

S4-B4-READINESS-001 — Verificação individual das 7 telas do Batch 4

Status: PRONTO PARA IMPLEMENTAÇÃO
Sprint: S4 — Redesign Mobile
Fase: Batch 4 (Complementary) — passo 0, antes de qualquer demanda de
migração/criação individual
Prioridade: P1
Issue: https://github.com/muriloalmeida-alt/FitOS/issues/25

Objetivo

Auditar o estado real das 7 telas do Batch 4 — mesmo rigor da S3.2.7
Readiness Review (`S3-DS20-S4-READINESS-001`), mas escopo restrito a
essas 7 — pra então cada uma virar demanda própria de migração/criação
(mesmo caminho que os Batches 2 e 3 seguiram). Nenhuma tela é
implementada, migrada ou criada nesta demanda.

Contexto

A S3.2.7 Readiness Review não verificou essas 7 telas individualmente
— "fora do foco da auditoria, dado o gap já encontrado em P0"
(`docs/sprints/S4/S4_REQUISITOS_VIGENTES.md` §2). Uma demanda
específica pra essa verificação (`S4-B4-000`) chegou a ser aberta, mas
foi reescopada a pedido do Murilo pra virar `S4-AUDIT-BACKLOG-001`
(auditoria pós-implementação das demandas #12-#21, propósito
diferente) — a verificação individual do Batch 4 nunca aconteceu de
fato. Com o Batch 3 fechado (`S4-B3-006` aprovada), esta é a única
frente de telas que falta pra completar a S4 antes do Batch 5 (QA).

As 7 telas (Tela 4, 8, 10, 11, 12, 18, 19 da matriz,
`docs/sprints/S3/S3_S4_MATRIZ_TELAS_MOBILE.md`), com uma checagem
preliminar rasa (não substitui a auditoria completa pedida abaixo):

1. **Onboarding** — parece existir (`renderOnboardingSlide()`,
   tutorial de boas-vindas no primeiro acesso).
2. **Comparar jogadores** — nenhuma tela dedicada encontrada numa
   busca preliminar; pode ser o mesmo caso de `S4-B3-004`/Contratos
   (conceito sem tela própria) — **a confirmar com evidência, não
   presumido aqui**.
3. **Eixos táticos** — `CAREER.lineup.tactics` (ritmo/pressão/linha
   defensiva/estilo de passe, `TACTIC_AXES`) parece estar embutido
   dentro da tela Tática/Formação (`#tacticAxisRows`, já migrada em
   `S4-B2-003`), não numa tela própria separada — diferente de
   "Instruções por setor" (`sectorTactics`, `openSectorScreen()`, tela
   separada). **Relação exata a confirmar com evidência** — pode não
   haver "tela" pra migrar aqui, e sim uma seção já coberta.
4. **Marcação individual** — parece existir (`openManMarkingScreen`-
   equivalente, `activeManMarkingSuppression` etc.).
5. **Meus esquemas** — parece existir (`renderSchemesScreen()`/
   `openSchemesScreen()`).
6. **Notícias/Eventos** — parece existir (`renderNewsScreen()`/
   `openNewsScreen()`).
7. **Histórico/Estatísticas** — parece existir (`renderEstatisticas`),
   mas a cobertura de "histórico" (temporadas passadas, títulos,
   histórico financeiro/do clube — não só a temporada atual) precisa
   ser confirmada, não presumida.

Escopo

Chapéu implementador deve, pra cada uma das 7 telas:

1. Inspecionar a implementação atual com evidência real (grep, leitura
   de código) — nunca presumir a partir do nome da tela ou da checagem
   preliminar acima.
2. Confirmar se a tela existe hoje, e se sim, onde (arquivo, função,
   ponto de acesso no menu/navegação).
3. Se não existir uma tela dedicada, confirmar isso com evidência
   (mesmo padrão de `S4-B3-004`: grep completo, inspeção do menu
   inteiro) antes de reportar como "não existe".
4. Determinar o estado real de tokens (`--m3-*` vs. legado `--mt-*`/
   `--brd-*`), reutilização de componentes formalizados (PlayerCard
   pra "Comparar jogadores", Dialog/Bottom Sheet/Skeleton onde
   aplicável) e qualquer padrão ad hoc duplicado (mesmo tipo de achado
   que gerou o `MatchCard`/`TransferCard`/`ContractCard`).
5. Para "Eixos táticos": esclarecer com evidência a relação real entre
   `tacticAxisRows`/`TACTIC_AXES` (dentro de Tática/Formação) e
   "Instruções por setor" (tela separada) — determinar se há de fato
   uma tela/seção de "Eixos táticos" fora do que `S4-B2-003` já migrou,
   ou se o conceito da matriz já está coberto ali.
6. Produzir uma tabela de estado por tela (mesmo formato de
   `docs/sprints/S4/S4_REQUISITOS_VIGENTES.md` §2, Batch 2/3), com
   gaps encontrados e ordem de execução recomendada.
7. Retornar relatório técnico nesta mesma seção do handoff, status
   `REVISÃO DO PM NECESSÁRIA`.

Fora de escopo

* implementar, migrar ou criar qualquer uma das 7 telas — essa
  auditoria só produz o diagnóstico; cada tela vira demanda própria
  depois, mesmo caminho de Batch 2/3;
* qualquer mudança de código de produção;
* qualquer mudança de regra de negócio;
* Batch 5 (QA Visual/UX transversal) — fica pra depois do Batch 4.

Dependências

* `docs/sprints/S3/S3_S4_MATRIZ_TELAS_MOBILE.md` (Telas 4, 8, 10, 11,
  12, 18, 19).
* `docs/sprints/S4/S4_REQUISITOS_VIGENTES.md`.
* Componentes já formalizados que podem ser relevantes: PlayerCard
  (`S3-DS20-S4-PREP-002`), Dialog/Bottom Sheet/Skeleton
  (`S3-DS20-S4-PREP-001`).

Requisitos

Mesma sequência obrigatória de sempre: inspecionar → localizar →
entender → planejar → alterar (não aplicável aqui — sem alteração) →
testar (não aplicável) → revisar. Mesmo rigor de evidência da S3.2.7
original — nenhum veredito ("existe"/"não existe"/"está coberto em
outra tela") sem grep/leitura de código confirmando.

Critérios de aceite

* as 7 telas têm estado real documentado, cada uma com evidência;
* a ambiguidade de "Comparar jogadores" (existe ou não) resolvida com
  evidência;
* a relação entre "Eixos táticos" e a tela Tática/Formação já migrada
  esclarecida com evidência;
* tabela de estado + ordem de execução recomendada produzida.

Validações

O PM deverá validar: cobertura das 7 telas, qualidade da evidência por
trás de cada veredito, coerência da ordem de execução recomendada.

Riscos

* baixo — é auditoria/inspeção, nenhuma mudança de código.

Observações

Resultado esperado: um conjunto de demandas candidatas (`S4-B4-001` a
`S4-B4-007`, ou menos se alguma tela se revelar já coberta/não
aplicável, mesmo tipo de achado de `S4-B2-002`/Login) pra especificar
em seguida, uma de cada vez, mesmo padrão incremental usado nos
Batches 2 e 3 — não uma "Batch 4 inteira" de uma vez.

⸻

S4-AUDIT-BACKLOG-001 — Auditoria de prontidão das demandas #12 a #21

Status: APROVADO

Decisão do PM (Murilo, 10/09/2026): os 4 critérios de aceite foram
cumpridos — as 10 demandas têm veredito com evidência (tabela abaixo),
9 foram formalmente aprovadas (#12,13,14,15,16,17,18,19,21 — #14 com
2 divergências de design resolvidas, ver seção `S4-B2-003`), 1 foi
redefinida com mini-spec nova (`S4-B3-004`/#20, tela não existia), e a
cadeia de dependências foi revalidada sem quebras. Auditoria concluída.
Sprint: S4 — Redesign Mobile
Fase: pós-implementação transversal (Batch 2 + Batch 3) — auditoria de
consolidação. Substitui a demanda anterior desta seção, que era
`S4-B4-000` (auditoria das 7 telas do Batch 4) — reescopada a pedido
do Murilo. Correção (mesmo pedido, 10/09/2026): esta é uma auditoria
**pós-implementação**, não um gate pré-implementação — ver Objetivo e
Contexto abaixo, ajustados.
Prioridade: P1

Objetivo

Depois que uma ou mais das 10 demandas já especificadas e abertas como
issue — `S4-B2-001` (#12), `S4-B2-002` (#13), `S4-B2-003` (#14),
`S4-B2-004` (#15), `S4-B2-005` (#16), `S4-B3-001` (#17), `S4-B3-002`
(#18), `S4-B3-003` (#19), `S4-B3-004` (#20), `S4-B3-005` (#21) — forem
implementadas por qualquer sessão, auditar o resultado real entregue:
confirmar o que foi de fato implementado/aprovado/mesclado, atualizar
o handoff de acordo, e revalidar a cadeia de dependências entre as
demandas restantes à luz do que já foi concluído.

Contexto

Esta sessão especificou as 10 demandas acima em sequência, sem
implementar nenhuma delas diretamente — mas já se confirmou 2 vezes
que sessões de implementação externas pegam demandas do handoff e as
executam sem avisar esta sessão em tempo real: `S3-DS20-S4-PREP-001` e
`S3-DS20-S4-PREP-002` foram ambas implementadas, aprovadas e mescladas
em `main` por sessões separadas — a segunda só foi descoberta porque o
Murilo pediu explicitamente pra verificar ("Veja se Perfil de Jogador
não está liberado").

Esta auditoria **não é um gate antes do trabalho começar** —
implementações acontecem de forma assíncrona, por sessões que este PM
não controla nem consegue bloquear (o próprio precedente de
PREP-001/002 mostra isso: aconteceram sem aviso, não depois de uma
autorização prévia). É, em vez disso, o processo de **consolidação que
roda depois** que qualquer uma das 10 demandas for implementada —
formalizando como demanda o mesmo processo que já foi feito
manualmente pra PREP-001/PREP-002 (checar branch/commit, confirmar
status real, atualizar o handoff, revalidar dependências), em vez de
depender de alguém lembrar de pedir a checagem.

Escopo

Quando uma ou mais das 10 demandas tiver sido implementada, Claude
deve, para cada uma que tiver progresso:

1. Verificar se existe branch, commit ou Pull Request associado no
   repositório (mesmo processo usado quando se confirmou que
   `S3-DS20-S4-PREP-002` já estava implementada) — buscar por
   referências relacionadas ao ID da demanda ou ao seu conteúdo.
2. Confirmar o status real (em implementação? pronta pra revisão? já
   aprovada e mesclada?) e atualizar a seção correspondente do handoff
   de acordo — mesmo tratamento dado a `S3-DS20-S4-PREP-002` quando
   sua conclusão foi descoberta.
3. Para as demandas que ainda não tiverem nenhum progresso: confirmar
   que a especificação continua válida — inspecionar a implementação
   atual da tela/componente relacionado e confirmar que nada mudou
   desde a especificação original que invalide o escopo, as
   dependências ou os riscos descritos nela.
4. Revalidar a cadeia de dependências entre as demandas à luz do que
   foi encontrado — em particular, se alguma das demandas do Batch 3
   já pode prosseguir porque `S4-B3-001` foi concluída, ou se a ordem
   recomendada precisa mudar dado o estado real.
5. Registrar, por demanda, um veredito único: "sem progresso externo,
   especificação continua válida" / "sem progresso externo,
   especificação precisa de ajuste (detalhar o quê)" / "progresso
   externo encontrado (detalhar o estado e a atualização feita no
   handoff)".
6. Produzir um relatório consolidado nesta mesma seção do handoff,
   com a lista das 10 demandas e o veredito de cada uma.
7. Retornar `REVISÃO DO PM NECESSÁRIA`.

Fora de escopo

* implementar qualquer coisa nova — mudanças de código só acontecem
  se decorrerem diretamente de uma demanda já aprovada encontrada com
  progresso pendente de finalização (mesmo tratamento que
  `S3-DS20-S4-PREP-001` recebeu quando sua aprovação foi processada);
* a auditoria original das 7 telas do Batch 4 (Onboarding, Comparar
  jogadores, Eixos táticos, Marcação individual, Meus esquemas,
  Notícias/Eventos, Histórico/Estatísticas) — não faz mais parte desta
  demanda (era o escopo de `S4-B4-000`, substituído); se ainda for
  necessária, precisa virar uma demanda própria depois desta.

Dependências

* as 10 demandas em si (`S4-B2-001` a `S4-B2-005`, `S4-B3-001` a
  `S4-B3-005`), já especificadas em `docs/HANDOFF_CLAUDE.md` e como
  issues #12-#21 — pelo menos uma delas precisa ter algum progresso
  real (branch/commit/PR) pra esta auditoria fazer sentido; se nenhuma
  tiver, o resultado é só confirmar que todas as specs continuam
  válidas, sem muito mais a fazer.
* `docs/sprints/S4/S4_REQUISITOS_VIGENTES.md`.

Requisitos

Mesma sequência obrigatória de sempre: inspecionar → localizar →
entender → planejar → (alterar só se decorrer de aprovação já
concluída) → testar (se houver alteração) → revisar. Cada veredito
deve vir com evidência real (branch/commit encontrado, ou trecho de
código conferido), mesmo rigor da S3.2.7 original — não presunção.

Critérios de aceite

* as 10 demandas têm veredito registrado, cada um com evidência;
* qualquer progresso externo encontrado está refletido no handoff
  (status atualizado, movido pro Histórico se aprovado);
* qualquer especificação desatualizada está corrigida ou marcada pra
  correção;
* a cadeia de dependências entre as demandas foi revalidada.

Validações

O PM deverá validar: cobertura das 10 demandas, qualidade da evidência
por trás de cada veredito, qualquer atualização de status feita no
handoff, coerência da cadeia de dependências revalidada.

Riscos

* baixo — é auditoria/verificação de estado, mudança de código só
  ocorre se decorrer de algo já formalmente aprovado e ainda não
  processado.

Observações

Esta demanda existe pra formalizar, como processo repetível, o mesmo
tipo de checagem que já foi feita manualmente 2 vezes nesta sessão
(progresso externo descoberto depois do fato) — não é um bloqueio
antes de qualquer trabalho começar, é a consolidação que roda depois
que ele acontecer. Especificar novas demandas em cima das #12-#21 não
precisa esperar esta auditoria — ela existe pra manter o handoff
alinhado com a realidade à medida que implementações forem
acontecendo, não pra travar o fluxo até rodar.

Relatório consolidado (auditoria, 10/09/2026)

Todas as 10 demandas tinham progresso real no momento desta auditoria
— nenhuma foi encontrada "sem progresso" (não existe o caso "sem
progresso, spec continua válida"/"sem progresso, spec precisa de
ajuste" nesta rodada). Evidência coletada por demanda: `git branch -r`
+ `git log origin/main..origin/<branch>` (confirma cada branch existe,
o commit exato, e quantos commits à frente de `main`), `list_pull_requests`
(nenhum PR aberto pra nenhuma das 10 — confirmado 2x, antes e depois
desta auditoria) e `get_comments` em cada uma das 10 issues (exatamente
1 comentário em cada — o meu próprio relatório técnico; nenhuma
resposta ou aprovação do usuário ainda em nenhuma delas).

| # | Demanda | Branch | Commits à frente de `main` | Veredito |
|---|---|---|---|---|
| #12 | `S4-B2-001` | `claude/s4-b2-001-loading` | 1 | Progresso externo encontrado — implementada, aguardando revisão. Proposto: APROVADO |
| #13 | `S4-B2-002` | `claude/s4-b2-002-login` | 1 | Progresso externo encontrado — implementada (sem mudança de código), aguardando revisão. Proposto: APROVADO |
| #14 | `S4-B2-003` | `claude/s4-b2-003-tatica` | 1 | Progresso externo encontrado — parcial, 2 divergências aguardando decisão do PM. Proposto: ADJUSTMENTS REQUIRED |
| #15 | `S4-B2-004` | `claude/s4-b2-004-treino` | 1 | Progresso externo encontrado — implementada, aguardando revisão. Proposto: APROVADO |
| #16 | `S4-B2-005` | `claude/s4-b2-005-perfil` | 1 | Progresso externo encontrado — implementada, aguardando revisão. Proposto: APROVADO |
| #17 | `S4-B3-001` | `claude/s4-b3-001-transfer-contract-card` | 1 | Progresso externo encontrado — implementada, aguardando revisão. Proposto: APROVADO |
| #18 | `S4-B3-002` | `claude/s4-b3-002-mercado` | 3 (empilhada sobre #17) | Progresso externo encontrado — implementada, aguardando revisão. Proposto: APROVADO |
| #19 | `S4-B3-003` | `claude/s4-b3-003-negociacao` | 4 (empilhada sobre #17/#18) | Progresso externo encontrado — implementada, corrigiu bug crítico pré-existente. Proposto: APROVADO |
| #20 | `S4-B3-004` | `claude/s4-b3-004-contratos` | 5 (empilhada, só docs) | Progresso externo encontrado — bloqueada por decisão de produto, nenhum código alterado. Proposto: BLOQUEADO |
| #21 | `S4-B3-005` | `claude/s4-b3-005-matchcard-financialsummary` | 6 (empilhada sobre as anteriores) | Progresso externo encontrado — implementada, aguardando revisão. Proposto: APROVADO |

("Progresso externo" no sentido da demanda original — trabalho que
esta auditoria encontrou pronto, não necessariamente de uma sessão
diferente; nestes 10 casos específicos, o trabalho foi feito pela
mesma linha de sessões deste handoff, mas a auditoria trata a
verificação do mesmo jeito independente de quem implementou, que é o
ponto do processo.)

Cadeia de dependências revalidada:

* `S4-B3-002`/`003` dependiam de `S4-B3-001` (TransferCard) como
  bloqueante — confirmado: ambas as branches partem de
  `claude/s4-b3-001-transfer-contract-card` (empilhadas de propósito,
  não paralelas), então o TransferCard que elas consomem já é o mesmo
  código, sem risco de divergência entre "o que `S4-B3-001` propôs" e
  "o que `S4-B3-002`/`003` realmente usam".
* `S4-B3-004` dependia de `ContractCard` (`S4-B3-001`) — o componente
  existe, mas a dependência real que bloqueia é outra (a tela em si
  não existe), então a conclusão de `S4-B3-001` não desbloqueia
  `S4-B3-004` sozinha, como o relatório daquela demanda já registrou.
* `S4-B3-005` era o pré-requisito declarado de "Resumo da rodada" —
  confirmado concluído; "Resumo da rodada" pode ser especificada como
  demanda própria a qualquer momento agora, não depende de mais nada.
* Nenhuma dependência quebrada ou invalidada foi encontrada — a ordem
  de execução usada (Batch 2 em sequência, depois `S4-B3-001` antes de
  `002`/`003`/`004`, `S4-B3-005` em paralelo por ser independente)
  continua fazendo sentido.

Risco de coordenação identificado (não é sobre as 10 demandas em si):
`docs/sprints/S4/S4_REQUISITOS_VIGENTES.md` foi movido de
`docs/requirements/ui-ux/` pra `docs/sprints/S4/` por uma sessão
paralela (commit `ce2a25b`, depois de todas as 10 branches acima terem
sido criadas) — as 10 branches ainda editam o arquivo no caminho
antigo. Isso vai gerar um conflito de rename no merge (não um
conflito de conteúdo — o `git mv` deve resolver automaticamente na
maioria dos casos, mas quem for mesclar deve conferir). Registrado
aqui, não corrigido nas branches (mudar o caminho editado em 9
branches já com relatório fechado estaria fora do escopo desta
auditoria — é um ajuste mecânico pro momento do merge, não uma
mudança de conteúdo).

Decisão do PM (Murilo, 10/09/2026): aprovadas 8 das 10 demandas
auditadas (#12, #13, #15, #16, #17, #18, #19, #21) — todas mescladas
em `main` nesta sessão, ver `Histórico` abaixo. `S4-B2-003` (#14)
ficou como `AJUSTES NECESSÁRIOS` até o PM decidir as 2 divergências
registradas — decidido em seguida (mesma sessão do usuário) e também
mesclada. `S4-B3-004` (#20) ficou `BLOQUEADO` até decisão de produto
sobre a tela Contratos — o PM escolheu "criar do zero"; implementada
e aguardando revisão (ver seção própria acima). Risco de coordenação
do rename de `S4_REQUISITOS_VIGENTES.md` confirmado e resolvido
manualmente em cada merge, sem perda de conteúdo.

⸻

Histórico

Demanda	Data	Commit	Changelog
S3-DS20-S4-PREP-001 — Dialog/Bottom Sheet/Skeleton (`--m3-*`) + convergência de tokens	09/09/2026	merge de `claude/s4-prep-001-tokens-components` em `main` (commit de código original `4d80d99`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 09/09/2026. Relatório técnico completo (o que
foi implementado, testes, gaps, arquivos avaliados/alterados) fica
preservado no histórico do git — `git show dc382a8:docs/HANDOFF_CLAUDE.md`
(commit em que este relatório foi registrado) — e não é reproduzido
aqui, pra manter este documento como o estado operacional atual, não um
arquivo permanente (esse é o papel do CHANGELOG.md, conforme
`docs/README.md`).

**Merge do código:** exceção pontual aberta pelo Murilo pra concluir
esta demanda já aprovada — nenhuma alteração de código nova, só a
integração em `main` do que já estava implementado, testado e
revisado na branch. A instrução geral de "não mexer em código" desta
sessão continua valendo pra qualquer outra alteração.

S3-DS20-S4-PREP-002 — Formalizar PlayerCard (`playerRow()`), retroativo em Elenco	09/09/2026	merge de `claude/s3-ds20-s4-prep-002` em `main` (commit de código original `1998f02`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 09/09/2026. Relatório técnico completo (o que
foi implementado — mudança puramente documental, zero comportamento
alterado —, testes, a divergência encontrada em relação à
especificação original, e a regressão pré-existente de
`S3-DS20-S4-PREP-001` encontrada mas fora de escopo) fica preservado no
histórico do git — `git show 1998f02:docs/HANDOFF_CLAUDE.md` (commit em
que este relatório foi registrado) — e não é reproduzido aqui, pelo
mesmo motivo do item acima.

**Merge do código:** autorizado pela aprovação formal acima
(`docs/README_HANDOFF.md` §13) — feito nesta mesma sessão, já com
chapéu implementador (diferente do caso da PREP-001, onde o merge
ficou pendente de outra sessão).

S4-B2-001 — Migrar tela Loading/Bootstrap para o Design System novo	10/09/2026	merge de `claude/s4-b2-001-loading` em `main` (commit de código original `6267fc6`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 10/09/2026 (issue #12, junto com #13/#15/#16/
#17/#18/#19/#21). Relatório técnico completo fica preservado no
histórico do git — `git show 6267fc6:docs/HANDOFF_CLAUDE.md` — e não é
reproduzido aqui, mesmo motivo dos itens acima.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#12, executado nesta sessão junto com as outras 7 demandas aprovadas
no mesmo lote.

S4-B2-002 — Migrar tela Login/Entrada para o Design System novo	10/09/2026	merge de `claude/s4-b2-002-login` em `main` (commit de código original `7fcb3a7`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 10/09/2026 (issue #13). Achado de inspeção: a
tela já estava migrada (`#screenLoginRequired`) — mudança puramente
documental, zero código de produção alterado. Relatório técnico
completo em `git show 7fcb3a7:docs/HANDOFF_CLAUDE.md`.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#13, executado nesta sessão junto com o lote de 8 demandas.

S4-B2-003 — Migrar tela Tática/Formação para o Design System novo	10/09/2026	merge de `claude/s4-b2-003-tatica` em `main` (commit de código original `f92a339`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 10/09/2026 (issue #14), depois de resolvidas
as 2 divergências registradas na inspeção original (`.mt-bench-row`
mantido como padrão próprio; tipografia `Rajdhani` classificada como
BRDATA Extension). Relatório técnico completo em
`git show f92a339:docs/HANDOFF_CLAUDE.md`.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#14, executado nesta sessão.

S4-B2-004 — Migrar tela Treino para o Design System novo	10/09/2026	merge de `claude/s4-b2-004-treino` em `main` (commit de código original `6bf1467`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 10/09/2026 (issue #15). Relatório técnico
completo em `git show 6bf1467:docs/HANDOFF_CLAUDE.md`.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#15, executado nesta sessão junto com o lote de 8 demandas.

S4-B2-005 — Migrar tela Perfil do jogador para o Design System novo	10/09/2026	merge de `claude/s4-b2-005-perfil` em `main` (commit de código original `13c0991`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 10/09/2026 (issue #16). Relatório técnico
completo (inclui a divergência registrada sobre as setas de tendência
▲/▼ não migradas, sem token `--m3-*` equivalente) em
`git show 13c0991:docs/HANDOFF_CLAUDE.md`.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#16, executado nesta sessão junto com o lote de 8 demandas.

S4-B3-001 — Criar os componentes TransferCard e ContractCard	10/09/2026	merge de `claude/s4-b3-001-transfer-contract-card` em `main` (commit de código original `44edc50`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 10/09/2026 (issue #17). Relatório técnico
completo em `git show 44edc50:docs/HANDOFF_CLAUDE.md`.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#17, executado nesta sessão junto com o lote de 8 demandas.

S4-B3-002 — Migrar tela Mercado para o Design System novo	10/09/2026	merge de `claude/s4-b3-002-mercado` em `main` (commit de código original `48289d1`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 10/09/2026 (issue #18). Relatório técnico
completo em `git show 48289d1:docs/HANDOFF_CLAUDE.md`.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#18, executado nesta sessão junto com o lote de 8 demandas.

S4-B3-003 — Migrar tela Negociação/Proposta para o Design System novo	10/09/2026	merge de `claude/s4-b3-003-negociacao` em `main` (commit de código original `4d3f703`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 10/09/2026 (issue #19). Relatório técnico
completo — inclui o bug crítico pré-existente de CSS (Dialog/Bottom
Sheet sem `position:fixed`/`z-index` de verdade desde
`S3-DS20-S4-PREP-001`) encontrado e corrigido nesta demanda — em
`git show 4d3f703:docs/HANDOFF_CLAUDE.md`.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#19, executado nesta sessão junto com o lote de 8 demandas.

S4-B3-005 — Inspecionar e formalizar MatchCard e FinancialSummary	10/09/2026	merge de `claude/s4-b3-005-matchcard-financialsummary` em `main` (commit de código original `7ef29b6`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 10/09/2026 (issue #21). Relatório técnico
completo (MatchCard construído novo — motor de partidas só produz 2
dos 5 estados suportados pelo componente; FinancialSummary formalizado
retroativamente sobre o card "Financeiro" já existente) em
`git show 7ef29b6:docs/HANDOFF_CLAUDE.md`.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#21, executado nesta sessão junto com o lote de 8 demandas.

S4-B3-004 — Criar a tela Contratos (redefinida de "migrar" para "criar do zero")	10/09/2026	merge de `claude/s4-b3-004-contratos` em `main` (commit de código original `ba88891`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 10/09/2026 (issue #20), depois de decidir a
opção 1 (criar a tela do zero) e revisar a implementação. Relatório
técnico completo (inspeção original que bloqueou a demanda, mini-spec
do PM, e a implementação final — reaproveitando 100% da lógica já
existente, nenhuma regra de contrato nova) em
`git show ba88891:docs/HANDOFF_CLAUDE.md`.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#20, executado nesta sessão.

**Nota de governança (sessão PM, 10/09/2026):** ao contrário das
outras 9 demandas desta rodada (aprovadas pelo Murilo diretamente
nesta conversa, com a mensagem "Aprovado" registrada), o "Aprovado"
que fechou esta demanda foi postado pela sessão implementadora na
própria issue #20
(https://github.com/muriloalmeida-alt/FitOS/issues/20#issuecomment-5625550397),
sem um checkpoint externo verificável nesta conversa — o tipo exato de
situação que `docs/README_HANDOFF.md` §1 veda ("quem implementa e
especifica não pode também aprovar formalmente o próprio trabalho sem
checagem externa"). Pode ser que o Murilo tenha autorizado essa
implementação/merge diretamente com a sessão implementadora (mesmo
padrão de "passei a instrução para o dev" usado nesta conversa pras
outras 9) — mas essa sessão PM não tem como confirmar isso pelas
fontes disponíveis (GitHub, git). Registrado aqui pra transparência;
não desfeito unilateralmente (o merge de código já é fato consumado,
reverter é decisão de produto/técnica, não documental). Se o Murilo
não autorizou, é um gap de processo a corrigir daqui pra frente, não
desta demanda específica retroativamente.

**Resolução (sessão implementadora, 11/09/2026):** confirmado — o
Murilo autorizou a aprovação/merge de `S4-B3-004` diretamente na
conversa desta sessão implementadora ("Aprovar a #20", mesmo padrão
usado pras outras 9 demandas do lote). O gap era só de
visibilidade cruzada entre sessões paralelas (a sessão PM não tinha
como ver esta conversa), não uma aprovação ausente de fato. Nenhuma
ação de reversão necessária.

⸻

DOCS-REQ-001 — Povoar docs/requirements/ com regras vigentes migradas de docs/sprints/	11/09/2026	merge de `claude/docs-req-001` em `main` (commit de código original `a493286`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 11/09/2026 (issue #23), diretamente nesta
conversa ("Pode mesclar. Aprovado pelo PM"). Relatório técnico completo
(4 documentos criados em `docs/requirements/` — um por subpasta —,
cada um citando a origem em `docs/sprints/S2/`/`S3/` e separando
estado atual confirmado de direção futura/proposta) em
`git show a493286:docs/HANDOFF_CLAUDE.md`.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#23, executado nesta sessão.

S4-B3-006 — Migrar Resumo da rodada e Rodada (menu) pro MatchCard	11/09/2026	merge de `claude/s4-b3-006-resumo-rodada` em `main` (commit de código original `29fa8f7`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 11/09/2026 (issue #24), diretamente nesta
conversa ("Pode seguir com o desenvolvimento"). Relatório técnico
completo (3 pontos de código migrados pro MatchCard —
`showRoundResultsModal()`, `cupRoundResultsHTML()`, `renderRodada()` —
sem alterar a definição do componente; 4º ponto de `.ct-round-result-row`
confirmado fora do escopo) em `git show 29fa8f7:docs/HANDOFF_CLAUDE.md`.
Com esta demanda, o **Batch 3 (Transactional) da S4 fecha 100%**.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#24, executado nesta sessão.
