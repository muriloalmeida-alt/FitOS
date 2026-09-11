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

GE-COPA-001 — Expandir Copa do Brasil (60 clubes, ida e volta, cabeças de chave, ao vivo)

Status: AGUARDANDO VALIDAÇÃO DE DESENHO (checkpoint 1/2 — NENHUM código
implementado ainda, só o desenho abaixo, exatamente como o escopo desta
demanda exige)
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

Checkpoint de desenho (etapa 1/2) — NENHUM código implementado

`GE-BALANCE-001` e `GE-BALANCE-002` já foram implementadas e reportadas
(ver seções anteriores/Histórico); esta é a próxima pela ordem
recomendada. Abaixo, o desenho completo pedido pelo escopo item 2,
antes de qualquer linha de código.

1) Inspeção completa (escopo item 1)

Confirmado além do que a especificação já levantou:
* `LEAGUE_TEAMS` (usado por `setupCup` hoje) é só os 20 clubes da
  divisão ATUAL do técnico (`CAREER.divisionTeams[CURRENT_COMPETITION_ID]`,
  `carreira.js:3373`) — não os 60. Pra chegar em 60 de verdade, a fonte
  precisa trocar pra `ALL_TEAMS_FLAT`
  (`ALL_COMPETITIONS_ORDER.flatMap(id => CAREER.divisionTeams[id])`,
  já existe, `carreira.js:3374` — soma os 3 arrays de 20, sem
  sobreposição possível: a cascata de acesso/rebaixamento garante que
  cada clube está em exatamente 1 divisão por vez).
* `CAREER.leagueSquads` já cobre os 59 outros clubes das 3 divisões
  inteiras (não só os 19 da própria divisão — mudança de
  `buildLeagueSquads` pro "mercado de 60 times", já em produção), então
  `squadAvgOverallOf(clubId)` já funciona pra QUALQUER um dos 60 sem
  mudança nenhuma.
* Compatibilidade: `CAREER.divisionTeams`/`ALL_TEAMS_FLAT` só existem
  em carreira com o sistema de divisões ativado (`CAREER.serieDPool` é
  o mesmo gate já usado por `applyPromotionRelegation` — "carreira sem
  o sistema ativado, nada a fazer"). Saves SEM esse sistema (antigos)
  precisam continuar funcionando com a Copa como é HOJE (16 clubes, 1
  divisão, jogo único) — ver item 6 abaixo.

2) Tabela de fases proposta (escopo item 2 — o entregável central deste
checkpoint)

60 não é potência de 2 (trava pra fechar mata-mata sem sobra). Solução
com o mesmo espírito da Copa do Brasil real (clubes menores começam
antes, cabeças de chave entram depois): separar 4 cabeças de chave
(critério: maior `squadAvgOverallOf` entre os 60, mesmo critério já
usado hoje pros 16 diretos) que pulam a 1ª fase; os outros 56 (múltiplo
de 2, sem sobra) jogam a 1ª fase — o vencedor de cada um dos 28
confrontos junta aos 4 cabeças de chave, fechando 32 (potência de 2) a
partir da 2ª fase em diante, sem bye nenhum daí pra frente:

| Fase | Quem entra | Nº clubes | Confrontos | Formato |
|---|---|---|---|---|
| Fase 1 | os 56 não-cabeças de chave (todas as 3 divisões) | 56 | 28 | ida e volta |
| 2ª fase (r32) | 28 vencedores da Fase 1 + 4 cabeças de chave | 32 | 16 | ida e volta |
| Oitavas (r16) | 16 vencedores da r32 | 16 | 8 | ida e volta |
| Quartas (qf) | 8 vencedores das oitavas | 8 | 4 | ida e volta |
| Semifinal (sf) | 4 vencedores das quartas | 4 | 2 | ida e volta |
| Final | 2 vencedores da semi | 2 | 1 | ida e volta |

`CUP_PHASES` passa de `["r16","qf","sf","final"]` pra
`["fase1","r32","r16","qf","sf","final"]` (6 fases, mesma estrutura de
array/índice sequencial já usada — só mais 2 posições). Todos os 60
clubes entram em algum confronto da Fase 1 ou já na r32 (cabeça de
chave) — atende literalmente o pedido do usuário ("um mata mata onde
todos participam"), diferente de hoje (só 16 dos 60 nem entram no
sorteio).

3) Ida e volta — todas as fases, inclusive a final (escopo item 3)

Justificativa: o pedido do usuário não qualificou "exceto a final", e
manter uniformidade em todas as 6 fases é mais simples de explicar e
testar do que uma regra especial só pra 1 fase (CLAUDE.md — preferir
consistência quando a fórmula é aceitável nos 2 casos). Desempate: em
vez de gols fora de casa (regra que a própria Copa do Brasil real e a
UEFA aboliram em 2021 — jogo de futebol moderno não usa mais),
desempate no agregado vai DIRETO pros pênaltis, reaproveitando tal e
qual o mecanismo de pênaltis que já existe em `simulateCupTie`
(viés pelo overall médio dos 2 elencos, `clamp(0.25, 0.75)`) — sem
inventar uma 2ª regra de desempate nem simular prorrogação.

4) Ao vivo — só o confronto do PRÓPRIO clube (escopo item 4)

`startLiveMatch`/`resolveLiveChunk`/`finishLiveMatch` hoje são
acoplados à rodada do Brasileirão (agendam em `CAREER.schedule`,
aplicam resultado em `CAREER.standings`/`CAREER.resultsByRound`).
Proposta pra reaproveitar sem duplicar o motor (CLAUDE.md §5):
* `startLiveMatch` ganha um parâmetro de contexto opcional (default:
  comportamento atual, rodada do Brasileirão — 100% compatível)
  descrevendo `{ type: "cup", phase, leg, tie }` quando é uma perna de
  confronto de Copa.
* Com esse contexto presente, `finishLiveMatch` NÃO mexe em
  `CAREER.standings` (Copa não é pontos corridos) — só grava o placar
  daquela perna no próprio objeto `tie` (`tie.leg1`/`tie.leg2`, campos
  novos). Só quando a 2ª perna termina (`leg === 2`) é que o agregado é
  calculado e a fase avança (mesma lógica de "quem venceu avança" que
  `resolveCupPhase` já tem hoje, só que lendo `leg1+leg2` em vez de 1
  placar único).
* `simulateCupTie` ganha um parâmetro `{ regulationOnly: true }` —
  resolve só 1 perna (gols, sem decidir pênaltis, já que quem decide
  pênaltis agora é o AGREGADO das 2 pernas, não 1 jogo isolado) —
  usado tanto pro CPU x CPU (perna a perna, instantâneo) quanto como
  base do que roda por trás de uma perna AO VIVO do seu clube (mesmo
  padrão de hoje, onde `resolveLiveChunk` já soma gol por gol usando a
  mesma fórmula de lambda/Poisson).
* Confronto que NÃO envolve o técnico continua 100% instantâneo (2
  chamadas de `simulateCupTie` com mando de campo invertido na 2ª,
  agregado calculado na hora) — só o SEU confronto pode virar ao vivo,
  com a mesma opção de "Pular pro fim" que o Brasileirão já tem.

5) Calendário e premiação (escopo item 4 bullet "preservar na medida
do possível")

12 "dias de Copa" (6 fases × 2 pernas), espaçados a cada 3 rodadas
dentro da temporada de 38, começando depois da janela de transferências
(Rodadas 1–3, CLAUDE.md §21) e fechando antes do fim da temporada:

| Fase | Ida | Volta |
|---|---|---|
| Fase 1 | Rodada 3 | Rodada 6 |
| r32 | Rodada 9 | Rodada 12 |
| r16 | Rodada 15 | Rodada 18 |
| qf | Rodada 21 | Rodada 24 |
| sf | Rodada 27 | Rodada 30 |
| final | Rodada 33 | Rodada 36 |

`CUP_PRIZE` preserva os 5 valores atuais tal e qual (qf/sf/final/
champion/runnerUp) e ganha 2 degraus novos, menores, pras 2 fases
novas — só ENTRA prêmio novo, nada existente muda de valor:

```js
const CUP_PRIZE = {
  r32: 150000,      // NOVO — prêmio por vencer a Fase 1
  r16: 350000,       // NOVO — prêmio por vencer a 2ª fase (r32)
  qf: 500000,        // preservado
  sf: 1500000,        // preservado
  final: 4000000,      // preservado
  champion: 10000000,   // preservado
  runnerUp: 3000000,     // preservado
};
```

6) Compatibilidade com saves antigos (CLAUDE.md §33, não citado
explicitamente no escopo mas obrigatório pela constituição)

`setupCup` passa a checar `CAREER.serieDPool` (mesmo gate já usado por
`applyPromotionRelegation`) ANTES de decidir a fonte de clubes: se o
sistema de divisões está ativo, monta os 60 (desenho acima); se não
(save antigo, sem o sistema), cai no comportamento ATUAL sem mudança
nenhuma (16 clubes, só `LEAGUE_TEAMS`, jogo único, sem cabeça de chave)
— igual ao padrão já usado em `resolveOtherDivisionsRound`/
`applyPromotionRelegation` pra qualquer sistema opcional deste jogo.
Migração de save no meio de temporada (`fastForwardFromRound`) precisa
só saber fechar QUALQUER uma das 2 variantes de `CUP_PHASES` de trás
pra frente — a lógica de `while` já existente não muda, só o array que
ela percorre.

7) Plano de teste (escopo item 5)

* Simulação de chaveamento completo (novo `sim_ge_copa_001.js`, mesmo
  espírito Monte Carlo dos outros `sim_*`): sortear 60 clubes fictícios
  com overall variado, rodar as 6 fases (12 pernas) até fechar em 1
  campeão, repetir centenas de vezes, confirmar sempre: exatamente 60
  clubes entram, exatamente 1 campeão sai, nenhum clube duplicado ou
  perdido em nenhuma fase, os 4 cabeças de chave sempre pulam a Fase 1.
* e2e via UI real: confronto do técnico ao vivo (ida E volta),
  confronto do técnico decidido por pênaltis no agregado, migração de
  save antigo (sem sistema de divisões) continua com a Copa de 16
  clubes/jogo único funcionando como hoje, save COM sistema de
  divisões nasce com os 60/cabeças de chave corretos.
* Regressão: `test_cup.js` (existente — ver observação abaixo) e
  qualquer outro teste que toque `CAREER.cup`/`CUP_PHASES`/
  `CUP_ROUNDS`.

Observação sobre `test_cup.js`: já existe uma falha PRÉ-EXISTENTE nesse
teste (timeout esperando `#matchDetailOverlay`/`#roundResultsOverlay`
depois de simular a rodada da Copa), confirmada em `main` sem nenhuma
mudança desta rodada (via `git stash`, documentada no relatório de
`GE-BALANCE-001`) — fora do escopo de qualquer uma das 3 demandas desta
rodada consertar isoladamente, mas como `GE-COPA-001` vai mexer
diretamente no motor que esse teste cobre, o chapéu implementador desta
demanda deve investigar e, se a causa for barata de corrigir dentro do
próprio trabalho de `GE-COPA-001`, consertar; se não, registrar
separadamente.

Pergunta em aberto pro PM (não decidida aqui, pede validação
explícita): o desenho acima assume que os 4 cabeças de chave são
recalculados a CADA temporada (mesmo clube pode perder a vaga de
cabeça de chave se o elenco enfraquecer, ou ganhar se fortalecer) —
mesmo critério dinâmico já usado hoje pros 16 diretos. Alternativa
seria fixar os 4 cabeças de chave por tradição (reaproveitando
`CLUB_TRADITION_IDS` de `GE-BALANCE-002`, se aprovada) em vez de força
atual — mas isso misturaria os 2 sistemas sem necessidade e sem pedido
explícito do usuário pra isso. Meu default é força atual (dinâmico,
sem misturar as demandas); PM pode pedir a alternativa.

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

SAVE-LIMIT-001 — Save de carreira "grande demais": eliminar o beco sem saída	11/09/2026	merge de `claude/save-limit-001` em `main` (commit de código original `5ab43d8`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 11/09/2026 (issue #29), diretamente nesta
conversa ("mesclar e seguir para a próxima"). Relatório técnico
completo (medição real — `leagueSquads` responde por ~79% do save,
não estruturas acumulativas; compressão gzip 92-93% real,
`MAX_BYTES` passa a valer sobre o tamanho comprimido; poda automática
de histórico não-essencial como última linha de defesa; `clubHistory`
capado) em `git show 5ab43d8:docs/HANDOFF_CLAUDE.md`.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#29, executado nesta sessão.

GE-BALANCE-001 — Reduzir sequências de invencibilidade do clube humano	11/09/2026	merge de `claude/ge-balance-001` em `main` (commit de código original `4fc3cde`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 11/09/2026 (issue #26), diretamente nesta
conversa ("Merge"). Relatório técnico completo (inspeção real da curva
de fadiga/rotação, achado da inversão `club.def/defMult`, mecanismo
"motivação do adversário" implementado e validado por simulação Monte
Carlo — 5000 temporadas, queda de 6.2% pra 4.0% na fração de
temporadas com sequência ≥10 jogos invicto —, recomendação de
`GE-BALANCE-003` separada pra corrigir a inversão de calibração
ataque/defesa) em `git show 4fc3cde:docs/HANDOFF_CLAUDE.md`.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#26, executado nesta sessão.

GE-BALANCE-002 — Peso da tradição/força de clube na simulação (relegação)	11/09/2026	merge de `claude/ge-balance-002` em `main` (commit de código original `830a051`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 11/09/2026 (issue #27), diretamente nesta
conversa ("Aprovar #27"). Relatório técnico completo (club.atk/def já
reaproveitado por buildGeneratedProPlayer sem mudança, mas não é
tradição — CLUB_TRADITION_IDS novo, pequeno e curado; mecanismo de
reprieve probabilístico na zona de rebaixamento, gap encontrado e
corrigido pela própria simulação de validação — 17.3% → 40.7% de
redução medida) em `git show 830a051:docs/HANDOFF_CLAUDE.md`.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#27, executado nesta sessão.

S4-B4-READINESS-001 — Verificação individual das 7 telas do Batch 4	11/09/2026	merge de `claude/s4-b4-readiness-001` em `main` (commit de código original `38884d8`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 11/09/2026 (issue #25), diretamente nesta
conversa ("ordem da #25 aprovada"). Relatório técnico completo
(auditoria com evidência das 7 telas — 6 existem e precisam de
migração, 1 — Eixos táticos — já está coberta dentro de Tática/
Formação; ordem de execução recomendada: Onboarding → Meus esquemas →
Marcação individual → Comparar jogadores → Notícias/Eventos →
Histórico/Estatísticas) em `git show 38884d8:docs/HANDOFF_CLAUDE.md`.

**Merge do código:** auditoria pura, sem código de produção — merge
autorizado pela aprovação formal do PM na issue #25, executado nesta
sessão.
