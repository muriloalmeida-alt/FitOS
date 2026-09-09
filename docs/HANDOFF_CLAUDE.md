HANDOFF_CLAUDE — Demandas vigentes e histórico

As regras de governança deste Handoff estão definidas em
docs/README_HANDOFF.md. Claude deve consultar o README_HANDOFF.md
para conhecer as regras (responsabilidades, fluxo, estados, escopo,
divergências, aprovação) — elas não são repetidas aqui.

⸻

Demandas vigentes

S3-DS20-S4-READINESS-001 — S3.2.7 Readiness Review

Status: REVISÃO DO PM NECESSÁRIA
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

⸻

Histórico

Demanda	Data	Commit	Changelog
(nenhuma demanda concluída sob este fluxo ainda)
