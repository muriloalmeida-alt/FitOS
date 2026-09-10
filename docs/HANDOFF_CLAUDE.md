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

Issue de rastreio: `https://github.com/muriloalmeida-alt/FitOS/issues/9`
— fechada como concluída (a execução da auditoria pedida nela foi
entregue e revisada); os ajustes que ela revelou passam a ser tratados
em uma nova demanda, não como reabertura dessa issue.

⸻

S4-B2-001 — Migrar tela Loading/Bootstrap para o Design System novo

Status: PRONTO PARA IMPLEMENTAÇÃO
Sprint: S4 — Redesign Mobile
Fase: Batch 2 (Core) — item 1 de 5
Prioridade: P0

Objetivo

Migrar a tela de carregamento inicial do produto (Loading/Bootstrap)
para o sistema de Design System novo, conforme
`docs/sprints/S3/S3_S4_MATRIZ_TELAS_MOBILE.md` (Tela 2): representar o
carregamento inicial diferenciando claramente carregamento, erro e
conclusão, usando o componente Skeleton onde apropriado.

Contexto

Com `S3-DS20-S4-PREP-001` aprovada e concluída, a fundação de
tokens/nomenclatura e os 3 componentes P0 que faltavam (Dialog, Bottom
Sheet, Skeleton) já existem. A Readiness Review (S3.2.7) tinha
identificado Loading/Bootstrap como uma das 9 telas P0 ainda fora do
sistema novo, e o relatório da PREP-001 registrou explicitamente que o
Skeleton ficou pronto mas sem uso real ainda, por falta de uma tela com
carregamento assíncrono de verdade dentro do escopo daquela demanda —
esta é exatamente essa primeira oportunidade real.

É a primeira tela do Batch 2 a ser retomada (as outras 2 do Batch 2 já
migradas — Escolha do clube e Início/Elenco — foram feitas antes da
S3.2.7; as 3 restantes depois desta — Perfil do jogador, Tática,
Treino — ficam para demandas seguintes, Perfil do jogador só depois de
`S3-DS20-S4-PREP-002`, que formaliza o componente de jogador que ela
usa).

Escolhida como primeira por ser a mais simples e independente das 5
telas restantes do Batch 2: sem dependência do componente PlayerCard
(ainda não formalizado, ver `S3-DS20-S4-PREP-002`), sem formulário,
sem regra de negócio própria — só apresentação de estado.

Problema

A tela de carregamento hoje está fora do sistema de Design System
novo. Sem diferenciação clara entre carregamento/erro/conclusão
usando os padrões definidos, a primeira impressão do produto (é
literalmente a primeira tela que o usuário vê) fica inconsistente com
o resto do redesign mobile que já está em produção.

Escopo

Chapéu implementador deve, quando retomar esta demanda:

1. Inspecionar a implementação atual da tela de carregamento antes de
   alterar qualquer coisa (regra de ouro de sempre — entender o que já
   existe, reaproveitar, só então estender).
2. Migrar a apresentação visual para os tokens do Design System novo.
3. Usar o componente Skeleton (entregue na `S3-DS20-S4-PREP-001`) para
   representar o carregamento, no lugar do indicador genérico atual,
   quando fizer sentido pro tipo de conteúdo sendo carregado.
4. Garantir que os 3 estados (carregamento, erro, conclusão) continuam
   todos cobertos e claramente diferenciados.
5. Preservar o comportamento funcional (o que a tela faz, quando
   aparece, pra onde leva) — este é um redesign visual/de apresentação,
   não uma mudança de fluxo.
6. Testar (mobile-first, mesmo padrão das demandas anteriores).
7. Atualizar `docs/requirements/ui-ux/S4_REQUISITOS_VIGENTES.md`
   marcando esta tela como migrada.
8. Retornar relatório técnico nesta mesma seção do handoff, status
   `REVISÃO DO PM NECESSÁRIA`.

Fora de escopo

* qualquer outra das 5 telas do Batch 2 (Perfil do jogador, Tática,
  Treino, Login) — demandas próprias;
* qualquer mudança de fluxo, regra de negócio, ou de quando/por que a
  tela de carregamento aparece;
* os componentes Dialog/Bottom Sheet — não são relevantes pra esta
  tela;
* qualquer gap P1/P2 não relacionado a esta tela específica.

Dependências

* `S3-DS20-S4-PREP-001` (aprovada, concluída — fundação de tokens e
  componente Skeleton disponíveis).
* `docs/sprints/S3/S3_S4_MATRIZ_TELAS_MOBILE.md` (Tela 2 — objetivo e
  requisitos).
* `docs/requirements/ui-ux/S4_REQUISITOS_VIGENTES.md`.

Requisitos

Mesma sequência obrigatória de sempre: inspecionar → localizar →
entender → planejar → alterar → testar → revisar. Mudança mínima
necessária — não reconstruir a tela do zero.

Critérios de aceite

* tela usa os tokens do Design System novo;
* Skeleton usado onde apropriado pro carregamento;
* os 3 estados (carregamento/erro/conclusão) continuam claros e
  diferenciados;
* nenhuma mudança de comportamento/fluxo;
* nenhuma outra tela tocada;
* teste mobile-first cobrindo a tela.

Validações

O PM deverá validar: aderência ao Design System, os 3 estados
continuam cobertos, uso apropriado do Skeleton, preservação funcional,
teste, escopo respeitado.

Riscos

* baixo — tela pequena, sem regra de negócio própria, sem dependência
  de componentes ainda não entregues.

Observações

Continuação natural do Batch 2 depois da fundação entregue em
`S3-DS20-S4-PREP-001`. Ordem recomendada das próximas telas do Batch 2
(fora desta demanda): Login (independente), depois Tática/Treino, com
Perfil do jogador por último (depende de `S3-DS20-S4-PREP-002`).

⸻

S4-B2-002 — Migrar tela Login/Entrada para o Design System novo

Status: PRONTO PARA IMPLEMENTAÇÃO
Sprint: S4 — Redesign Mobile
Fase: Batch 2 (Core) — item 2 de 5
Prioridade: P0

Objetivo

Migrar a tela de entrada do usuário no produto para o Design System
novo, conforme `docs/sprints/S3/S3_S4_MATRIZ_TELAS_MOBILE.md` (Tela
1): apresentar identidade BRDATA, hierarquia visual clara, entrada sem
fricção, feedback de erro, estados de loading, e funcionar bem em
mobile. Estados exigidos: default, loading, erro, sucesso.

Contexto

Segunda tela retomada do Batch 2, depois de `S4-B2-001` (Loading/
Bootstrap). A S3.2.7 Readiness Review identificou Login como uma das 9
telas P0 ainda fora do sistema novo.

Escolhida como segunda por ser, como a de Loading, independente do
componente PlayerCard (ainda não formalizado, ver
`S3-DS20-S4-PREP-002`) e sem regra de negócio de jogo — é uma tela de
autenticação, não de carreira.

Atenção específica desta demanda: a tela de Login pode ser compartilhada
com outras partes do produto além do Modo Técnico (o site principal
também tem fluxo de entrada de usuário). Chapéu implementador deve
confirmar, na inspeção inicial, se a tela é exclusiva do Modo Técnico
ou compartilhada — se for compartilhada, migrar sem afetar o
comportamento/visual de qualquer outra parte do produto que dependa
dela é requisito obrigatório, não opcional, e deve ser tratado com o
mesmo cuidado do princípio de preservação funcional do CLAUDE.md.

Escopo

Chapéu implementador deve, quando retomar esta demanda:

1. Inspecionar a implementação atual da tela de Login antes de alterar
   qualquer coisa, incluindo confirmar o escopo de compartilhamento
   citado acima.
2. Migrar a apresentação visual para os tokens do Design System novo.
3. Garantir que os 4 estados (default, loading, erro, sucesso)
   continuam todos cobertos e claramente diferenciados.
4. Usar os componentes já disponíveis (Dialog, Bottom Sheet, Skeleton)
   se a tela precisar de algum overlay ou carregamento — não criar
   nada novo em paralelo.
5. Preservar o comportamento funcional (fluxo de autenticação,
   validações, mensagens de erro) — redesign visual, não mudança de
   fluxo.
6. Testar (mobile-first, mesmo padrão das demandas anteriores).
7. Atualizar `docs/requirements/ui-ux/S4_REQUISITOS_VIGENTES.md`
   marcando esta tela como migrada.
8. Retornar relatório técnico nesta mesma seção do handoff, status
   `REVISÃO DO PM NECESSÁRIA`.

Fora de escopo

* qualquer outra das telas do Batch 2 (Tática, Treino, Perfil do
  jogador);
* qualquer mudança de fluxo de autenticação, regra de validação, ou
  de segurança;
* qualquer alteração em telas fora do Modo Técnico, se a tela de Login
  for de fato compartilhada — nesse caso, se uma migração completa
  exigir tocar nelas, a divergência deve ser registrada e devolvida ao
  PM antes de prosseguir, não decidida unilateralmente;
* gaps P1/P2 não relacionados a esta tela específica.

Dependências

* `S3-DS20-S4-PREP-001` (aprovada, concluída — fundação de tokens e
  componentes disponíveis).
* `docs/sprints/S3/S3_S4_MATRIZ_TELAS_MOBILE.md` (Tela 1 — objetivo e
  requisitos).
* `docs/requirements/ui-ux/S4_REQUISITOS_VIGENTES.md`.

Requisitos

Mesma sequência obrigatória de sempre: inspecionar → localizar →
entender → planejar → alterar → testar → revisar. Mudança mínima
necessária.

Critérios de aceite

* tela usa os tokens do Design System novo;
* os 4 estados (default/loading/erro/sucesso) continuam claros e
  diferenciados;
* nenhuma mudança de fluxo de autenticação;
* nenhuma tela fora do Modo Técnico afetada (ou, se compartilhada,
  divergência registrada e decisão do PM obtida antes de prosseguir);
* nenhuma outra tela do Modo Técnico tocada;
* teste mobile-first cobrindo a tela, incluindo os 4 estados.

Validações

O PM deverá validar: aderência ao Design System, os 4 estados
continuam cobertos, preservação funcional do fluxo de autenticação,
confirmação do escopo de compartilhamento (ou tratamento correto se
compartilhada), teste, escopo respeitado.

Riscos

* médio — ao contrário de Loading/Bootstrap, esta tela pode ser
  compartilhada com outras partes do produto; risco baixo se for
  exclusiva do Modo Técnico, mas precisa ser confirmado antes de
  migrar, não presumido.

Observações

Terceira e quarta telas recomendadas do Batch 2, depois desta: Tática
e Treino. Perfil do jogador continua por último, dependente de
`S3-DS20-S4-PREP-002`.

⸻

S4-B2-003 — Migrar tela Tática/Formação para o Design System novo

Status: PRONTO PARA IMPLEMENTAÇÃO
Sprint: S4 — Redesign Mobile
Fase: Batch 2 (Core) — item 3 de 5
Prioridade: P0

Objetivo

Migrar a tela de configuração de formação e escalação para o Design
System novo, conforme `docs/sprints/S3/S3_S4_MATRIZ_TELAS_MOBILE.md`
(Tela 9): contemplar formação, titulares, reservas, posições,
alterações e confirmação, com a representação do campo adaptada ao
mobile.

Contexto

Terceira tela retomada do Batch 2, depois de `S4-B2-001` (Loading/
Bootstrap) e `S4-B2-002` (Login/Entrada). A S3.2.7 Readiness Review
identificou Tática/Formação como uma das 9 telas P0 ainda fora do
sistema novo.

Diferente das duas anteriores, esta tela é interativa e mais complexa
(escolha de formação, posicionamento de jogadores em campo,
titulares/reservas) — não presumo aqui o nível de dependência dela em
relação ao componente PlayerCard (`S3-DS20-S4-PREP-002`, ainda não
implementado): a matriz cita "titulares; reservas; posições", o que
sugere alguma forma de lista/seleção de jogador dentro da tela, mas
isso precisa ser confirmado na inspeção, não presumido aqui — chapéu
PM não inspeciona código. Se a inspeção confirmar dependência real do
componente de jogador, isso é uma divergência a registrar e devolver
ao PM antes de prosseguir (mesma regra da tela de Login em relação a
telas compartilhadas), não uma decisão unilateral do implementador.

Escopo

Chapéu implementador deve, quando retomar esta demanda:

1. Inspecionar a implementação atual da tela de Tática/Formação antes
   de alterar qualquer coisa, incluindo avaliar e reportar a
   dependência real (ou não) do componente PlayerCard.
2. Migrar a apresentação visual para os tokens do Design System novo,
   incluindo a representação do campo adaptada ao mobile.
3. Garantir que formação, titulares, reservas, posições, alterações e
   confirmação continuam todos funcionando.
4. Usar os componentes já disponíveis (Dialog, Bottom Sheet, Skeleton)
   onde a tela precisar de overlay/carregamento — não criar nada novo
   em paralelo.
5. Preservar o comportamento funcional (regras de escalação, validação
   de posições, etc.) — redesign visual, não mudança de regra de jogo.
6. Testar (mobile-first, mesmo padrão das demandas anteriores),
   cobrindo interação com a representação do campo.
7. Atualizar `docs/requirements/ui-ux/S4_REQUISITOS_VIGENTES.md`
   marcando esta tela como migrada.
8. Retornar relatório técnico nesta mesma seção do handoff, status
   `REVISÃO DO PM NECESSÁRIA`.

Fora de escopo

* qualquer outra das telas do Batch 2 (Treino, Perfil do jogador);
* as 3 telas P1 relacionadas — Eixos táticos, Marcação individual,
  Meus esquemas (`S3_S4_MATRIZ_TELAS_MOBILE.md` Telas 10-12) — são
  Batch 4 (Complementary), não fazem parte desta demanda mesmo sendo
  conceitualmente próximas;
* qualquer mudança de regra de jogo (força por formação, cálculo
  tático, validação de escalação);
* se a inspeção confirmar dependência real do PlayerCard: implementar
  a migração completa dessa dependência não é desta demanda — registrar
  e devolver ao PM (pode virar ordem de execução revisada: esta tela
  esperar `S3-DS20-S4-PREP-002`, como já vale para Perfil do jogador);
* gaps P1/P2 não relacionados a esta tela específica.

Dependências

* `S3-DS20-S4-PREP-001` (aprovada, concluída — fundação de tokens e
  componentes disponíveis).
* `docs/sprints/S3/S3_S4_MATRIZ_TELAS_MOBILE.md` (Tela 9 — objetivo e
  requisitos).
* `docs/requirements/ui-ux/S4_REQUISITOS_VIGENTES.md`.
* Possível dependência de `S3-DS20-S4-PREP-002` — a confirmar na
  inspeção (ver Contexto acima), não presumida.

Requisitos

Mesma sequência obrigatória de sempre: inspecionar → localizar →
entender → planejar → alterar → testar → revisar. Mudança mínima
necessária. Dado o risco de escopo maior que as duas telas anteriores,
se a inspeção revelar que o trabalho é significativamente maior que o
esperado (ex.: reconstrução da representação de campo, não só
retoken), isso também é uma divergência a reportar, não a absorver
silenciosamente.

Critérios de aceite

* tela usa os tokens do Design System novo, incluindo a representação
  do campo;
* formação, titulares, reservas, posições, alterações e confirmação
  continuam todos funcionando;
* nenhuma mudança de regra de jogo;
* dependência (ou não) do PlayerCard confirmada e reportada;
* nenhuma outra tela tocada;
* teste mobile-first cobrindo a tela e a interação com o campo.

Validações

O PM deverá validar: aderência ao Design System, preservação de todas
as funcionalidades de escalação, confirmação da dependência (ou não)
do PlayerCard, teste, escopo respeitado.

Riscos

* médio-alto — tela interativa e mais complexa que as duas anteriores
  do Batch 2; possível dependência não confirmada do componente
  PlayerCard; representação do campo pode exigir mais esforço de
  adaptação mobile do que uma migração de tokens simples.

Observações

Última tela recomendada do Batch 2 antes de Perfil do jogador: Treino
(mesma cautela sobre dependências deve ser aplicada, a confirmar
quando essa demanda for especificada).

⸻

S4-B2-004 — Migrar tela Treino para o Design System novo

Status: PRONTO PARA IMPLEMENTAÇÃO
Sprint: S4 — Redesign Mobile
Fase: Batch 2 (Core) — item 4 de 5
Prioridade: P0

Objetivo

Migrar a tela de gerenciamento do treinamento para o Design System
novo, conforme `docs/sprints/S3/S3_S4_MATRIZ_TELAS_MOBILE.md` (Tela
13): apresentar treino atual, opções, impacto esperado, condição dos
jogadores e confirmação, com a informação organizada para leitura
rápida.

Contexto

Quarta e última tela do Batch 2 antes de Perfil do jogador (que segue
por último, dependente de `S3-DS20-S4-PREP-002`). A S3.2.7 Readiness
Review identificou Treino como uma das 9 telas P0 ainda fora do
sistema novo.

Mesma cautela de `S4-B2-003` (Tática/Formação) se aplica aqui: a
matriz cita "condição dos jogadores" entre o que a tela deve
apresentar, o que sugere alguma forma de lista/exibição de jogador —
possível dependência do componente PlayerCard (`S3-DS20-S4-PREP-002`,
ainda não implementado) que não presumo aqui e precisa ser confirmada
na inspeção, não decidida unilateralmente.

Escopo

Chapéu implementador deve, quando retomar esta demanda:

1. Inspecionar a implementação atual da tela de Treino antes de
   alterar qualquer coisa, incluindo avaliar e reportar a dependência
   real (ou não) do componente PlayerCard.
2. Migrar a apresentação visual para os tokens do Design System novo.
3. Garantir que treino atual, opções, impacto esperado, condição dos
   jogadores e confirmação continuam todos funcionando.
4. Usar os componentes já disponíveis (Dialog, Bottom Sheet, Skeleton)
   onde a tela precisar de overlay/carregamento — não criar nada novo
   em paralelo.
5. Preservar o comportamento funcional (regras de treinamento, cálculo
   de impacto, evolução) — redesign visual, não mudança de regra de
   jogo.
6. Testar (mobile-first, mesmo padrão das demandas anteriores).
7. Atualizar `docs/requirements/ui-ux/S4_REQUISITOS_VIGENTES.md`
   marcando esta tela como migrada e o Batch 2 como completo (exceto
   Perfil do jogador).
8. Retornar relatório técnico nesta mesma seção do handoff, status
   `REVISÃO DO PM NECESSÁRIA`.

Fora de escopo

* Perfil do jogador (última tela do Batch 2, demanda própria,
  dependente de `S3-DS20-S4-PREP-002`);
* qualquer mudança de regra de treinamento, fórmula de impacto ou
  evolução de jogador;
* se a inspeção confirmar dependência real do PlayerCard: implementar
  essa dependência não é desta demanda — registrar e devolver ao PM;
* gaps P1/P2 não relacionados a esta tela específica.

Dependências

* `S3-DS20-S4-PREP-001` (aprovada, concluída — fundação de tokens e
  componentes disponíveis).
* `docs/sprints/S3/S3_S4_MATRIZ_TELAS_MOBILE.md` (Tela 13 — objetivo e
  requisitos).
* `docs/requirements/ui-ux/S4_REQUISITOS_VIGENTES.md`.
* Possível dependência de `S3-DS20-S4-PREP-002` — a confirmar na
  inspeção (ver Contexto acima), não presumida.

Requisitos

Mesma sequência obrigatória de sempre: inspecionar → localizar →
entender → planejar → alterar → testar → revisar. Mudança mínima
necessária. Mesma regra de `S4-B2-003`: se a inspeção revelar escopo
significativamente maior que o esperado, reportar como divergência,
não absorver silenciosamente.

Critérios de aceite

* tela usa os tokens do Design System novo;
* treino atual, opções, impacto esperado, condição dos jogadores e
  confirmação continuam todos funcionando;
* nenhuma mudança de regra de treinamento/evolução;
* dependência (ou não) do PlayerCard confirmada e reportada;
* nenhuma outra tela tocada;
* teste mobile-first cobrindo a tela.

Validações

O PM deverá validar: aderência ao Design System, preservação de todas
as funcionalidades de treinamento, confirmação da dependência (ou não)
do PlayerCard, teste, escopo respeitado.

Riscos

* médio — mesma incerteza de dependência do PlayerCard que
  `S4-B2-003`, mas sem o componente de interação visual complexa
  (representação de campo) que eleva o risco daquela tela.

Observações

Com esta demanda especificada, o Batch 2 (Core) fica totalmente
coberto exceto Perfil do jogador — que aguarda
`S3-DS20-S4-PREP-002` (formalização do PlayerCard) antes de virar
demanda própria, por já ter dependência confirmada (não hipotética)
desse componente.

⸻

S4-B2-005 — Migrar tela Perfil do jogador para o Design System novo

Status: PRONTO PARA IMPLEMENTAÇÃO
Sprint: S4 — Redesign Mobile
Fase: Batch 2 (Core) — item 5 de 5 (último)
Prioridade: P0

Objetivo

Migrar a tela de perfil detalhado do jogador para o Design System
novo, conforme `docs/sprints/S3/S3_S4_MATRIZ_TELAS_MOBILE.md` (Tela
7): apresentar nome, posição, overall, atributos, idade, clube,
contrato, salário, evolução e status, priorizando as informações mais
importantes.

Contexto

Quinta e última tela do Batch 2. Bloqueada até agora pela dependência
confirmada do componente PlayerCard — `S3-DS20-S4-PREP-002` está
**aprovada e concluída** (Histórico deste handoff), então esta
dependência está resolvida e a demanda pode ser especificada.

A S3.2.7 Readiness Review identificou Perfil do jogador como uma das 9
telas P0 ainda fora do sistema novo.

Nota de escopo herdada do relatório de `S3-DS20-S4-PREP-002`: a
formalização do PlayerCard encontrou e registrou uma divergência entre
a especificação original e os pontos de uso reais do componente — o
relatório daquela demanda (no Histórico deste handoff, e no
CHANGELOG) detalha isso. Chapéu implementador desta demanda deve
consultar esse relatório antes de assumir como o PlayerCard se
encaixa na tela de Perfil do jogador, em vez de reconstruir esse
entendimento do zero.

Escopo

Chapéu implementador deve, quando retomar esta demanda:

1. Inspecionar a implementação atual da tela de Perfil do jogador
   antes de alterar qualquer coisa, incluindo como ela hoje se
   relaciona com a implementação de PlayerCard já formalizada.
2. Migrar a apresentação visual para os tokens do Design System novo,
   reutilizando o PlayerCard onde apropriado.
3. Garantir que nome, posição, overall, atributos, idade, clube,
   contrato, salário, evolução e status continuam todos apresentados,
   com a hierarquia de informação priorizada como a matriz pede.
4. Usar os componentes já disponíveis (Dialog, Bottom Sheet, Skeleton)
   onde a tela precisar de overlay/carregamento — não criar nada novo
   em paralelo.
5. Preservar o comportamento funcional (qualquer ação disponível na
   tela hoje — ex.: promover, renovar, o que a inspeção encontrar)
   — redesign visual, não mudança de regra.
6. Testar (mobile-first, mesmo padrão das demandas anteriores).
7. Atualizar `docs/requirements/ui-ux/S4_REQUISITOS_VIGENTES.md`
   marcando esta tela como migrada e o Batch 2 (Core) como
   completo.
8. Retornar relatório técnico nesta mesma seção do handoff, status
   `REVISÃO DO PM NECESSÁRIA`.

Fora de escopo

* qualquer tela de outro Batch;
* qualquer mudança de regra de negócio (contrato, evolução, promoção,
  etc.);
* qualquer mudança na definição do PlayerCard além do que
  `S3-DS20-S4-PREP-002` já formalizou — se a inspeção sugerir que o
  contrato precisa evoluir pra servir esta tela, registrar como
  divergência e devolver ao PM, não decidir unilateralmente;
* gaps P1/P2 não relacionados a esta tela específica.

Dependências

* `S3-DS20-S4-PREP-001` (aprovada, concluída).
* `S3-DS20-S4-PREP-002` (aprovada, concluída — dependência que
  bloqueava esta demanda, agora resolvida).
* `docs/sprints/S3/S3_S4_MATRIZ_TELAS_MOBILE.md` (Tela 7 — objetivo e
  requisitos).
* `docs/requirements/ui-ux/S4_REQUISITOS_VIGENTES.md`.

Requisitos

Mesma sequência obrigatória de sempre: inspecionar → localizar →
entender → planejar → alterar → testar → revisar. Mudança mínima
necessária.

Critérios de aceite

* tela usa os tokens do Design System novo, reutilizando o PlayerCard;
* todas as informações da tela (nome/posição/overall/atributos/idade/
  clube/contrato/salário/evolução/status) continuam presentes e
  priorizadas;
* nenhuma mudança de regra de negócio;
* nenhuma outra tela tocada;
* teste mobile-first cobrindo a tela.

Validações

O PM deverá validar: aderência ao Design System, reutilização correta
do PlayerCard, preservação de todas as informações/ações da tela,
teste, escopo respeitado.

Riscos

* baixo-médio — dependência principal (PlayerCard) já resolvida, mas
  é uma tela de detalhe com potencialmente mais ações/estados que as
  demais do Batch 2 (a confirmar na inspeção).

Observações

Última tela do Batch 2 (Core). Com esta demanda concluída e aprovada,
o Batch 2 estará completo — próximo passo do roadmap S4 é o Batch 3
(Transactional: Mercado, Negociação, Contratos, Resumo da rodada),
que por sua vez começa formalizando os componentes TransferCard e
ContractCard (ainda não existentes) antes de qualquer tela, mesmo
padrão já usado aqui.

⸻

S4-B3-001 — Criar os componentes TransferCard e ContractCard

Status: PRONTO PARA IMPLEMENTAÇÃO
Sprint: S4 — Redesign Mobile
Fase: Batch 3 (Transactional) — pré-requisito, item 1 de 4
Prioridade: P0

Objetivo

Criar os 2 componentes P0 ainda inexistentes que o Batch 3 inteiro
depende: **TransferCard** e **ContractCard**, conforme
`docs/sprints/S3/S3_2_COMPONENTES_E_CONTRATOS.md` §26/§27.

TransferCard — objetivo: representar uma oportunidade ou operação de
mercado. Pode apresentar jogador, clube, valor, salário, status, ação.
**O componente não deve calcular valuation** — só apresentação.

ContractCard — objetivo: representar a situação contratual de um
jogador. Pode apresentar jogador, clube, salário, duração, status,
proximidade do vencimento, ação. **O componente não deve determinar
regras de renovação** — só apresentação.

Contexto

Diferente de `S3-DS20-S4-PREP-002` (PlayerCard), que formalizou um
componente que já existia de fato (dívida retroativa), TransferCard e
ContractCard **não existem ainda** — a S3.2.7 Readiness Review
confirmou zero ocorrências dos 6 BRDATA Product Patterns no código, e
não há indício de equivalente ad hoc pra estes 2 especificamente (ao
contrário de MatchCard/FinancialSummary, que têm candidatos a
inspecionar). São trabalho novo, não retroativo.

São o pré-requisito comum de 3 das 4 telas do Batch 3: Mercado e
Negociação/Proposta dependem de TransferCard; Contratos depende de
ContractCard. Só Resumo da rodada não depende de nenhum dos dois (essa
tela segue fora desta rodada de demandas — ver observação no fim).

Escopo

Chapéu implementador deve, quando retomar esta demanda:

1. Inspecionar a implementação atual das 3 telas que vão consumir
   estes componentes (Mercado, Negociação, Contratos) antes de
   desenhar os componentes — mesmo sem migrá-las ainda, entender como
   jogador/clube/valor/salário/status já são hoje apresentados evita
   um componente que não encaixa no dado real.
2. Criar o componente **TransferCard** reaproveitando os tokens/
   primitivas do Design System já disponíveis (fundação de
   `S3-DS20-S4-PREP-001`, mesmo padrão do PlayerCard).
3. Criar o componente **ContractCard**, mesma reutilização de base.
4. Nenhum dos dois deve conter lógica de negócio (valuation, regra de
   renovação) — são apresentação pura, recebem os dados já calculados.
5. Documentar o contrato de cada um (Nome/Objetivo/Entradas/Estados),
   mesmo padrão de PlayerCard/Dialog/Bottom Sheet/Skeleton.
6. Validar via teste automatizado direto (mesmo padrão usado pra
   Bottom Sheet/Skeleton em `S3-DS20-S4-PREP-001`, que também não
   tinham integração em tela real na mesma demanda) — a integração
   real acontece nas demandas seguintes (`S4-B3-002`/`003`/`004`).
7. Atualizar `docs/requirements/ui-ux/S4_REQUISITOS_VIGENTES.md`
   marcando os 2 componentes como disponíveis.
8. Retornar relatório técnico nesta mesma seção do handoff, status
   `REVISÃO DO PM NECESSÁRIA`.

Fora de escopo

* migrar qualquer tela do Batch 3 — isso é `S4-B3-002`/`003`/`004`;
* qualquer lógica de valuation, cálculo de proposta, regra de
  renovação ou qualquer regra de negócio — os componentes só
  apresentam dado já calculado;
* MatchCard/FinancialSummary (Resumo da rodada) — continuam pendentes
  de inspeção própria, não fazem parte desta demanda;
* alteração do Transfer Engine ou de qualquer regra de mercado/
  contrato existente.

Dependências

* `S3-DS20-S4-PREP-001` (aprovada, concluída — fundação de tokens e
  Dialog/Bottom Sheet/Skeleton disponíveis).
* `docs/sprints/S3/S3_2_COMPONENTES_E_CONTRATOS.md` §26 (TransferCard),
  §27 (ContractCard).
* `docs/requirements/ui-ux/S4_REQUISITOS_VIGENTES.md`.

Requisitos

Mesma sequência obrigatória de sempre: inspecionar → localizar →
entender → planejar → alterar → testar → revisar.

Critérios de aceite

* TransferCard e ContractCard existem como componentes nomeados e
  documentados;
* nenhum dos dois contém lógica de negócio;
* nenhuma tela migrada ainda (isso é escopo das próximas demandas);
* teste automatizado cobrindo os 2 componentes.

Validações

O PM deverá validar: aderência ao Design System, separação correta
entre apresentação e lógica de negócio (nenhum dos 2 componentes
calcula nada), contrato documentado, teste.

Riscos

* baixo-médio — são componentes novos (não retroativos), mas
  conceitualmente simples (apresentação de dado já calculado); o
  maior risco é desenhar um componente genérico demais ou específico
  demais sem ver como as 3 telas consumidoras usam o dado hoje — daí o
  requisito de inspecionar as 3 antes de desenhar.

Observações

**Resumo da rodada fica deliberadamente fora desta rodada de demandas
do Batch 3** — depende de MatchCard/FinancialSummary, que
`docs/requirements/ui-ux/S4_REQUISITOS_VIGENTES.md` §5 (item 2b) já
registra como "candidatos identificados mas não inspecionados o
suficiente pra virar demanda" (mesmo problema não resolvido desde a
especificação do Batch 2). Essa tela vira demanda só depois dessa
inspeção acontecer — não presumida aqui.

⸻

S4-B3-002 — Migrar tela Mercado para o Design System novo

Status: PRONTO PARA IMPLEMENTAÇÃO
Sprint: S4 — Redesign Mobile
Fase: Batch 3 (Transactional) — item 2 de 4
Prioridade: P0

Objetivo

Migrar a tela de mercado de jogadores para o Design System novo,
conforme `docs/sprints/S3/S3_S4_MATRIZ_TELAS_MOBILE.md` (Tela 14):
permitir visualizar oportunidades, buscar jogadores, aplicar filtros,
visualizar valor, consultar contrato, iniciar negociação, identificar
status — usando o TransferCard quando apropriado.

Contexto

Primeira tela do Batch 3 a ser migrada, depois de `S4-B3-001`
(TransferCard/ContractCard). A S3.2.7 Readiness Review identificou
Mercado como uma das 9 telas P0 ainda fora do sistema novo — e, junto
com Negociação, é citada no próprio relatório como um dos fluxos
transacionais mais críticos do produto (toda semana de jogo passa por
ali).

Escopo

Chapéu implementador deve, quando retomar esta demanda:

1. Inspecionar a implementação atual da tela de Mercado antes de
   alterar qualquer coisa.
2. Migrar a apresentação visual para os tokens do Design System novo.
3. Usar o TransferCard (`S4-B3-001`) para representar cada
   oportunidade/jogador do mercado.
4. Garantir que busca, filtros, visualização de valor/contrato/status
   e o início de negociação continuam todos funcionando.
5. Usar os componentes já disponíveis (Dialog, Bottom Sheet, Skeleton)
   onde a tela precisar de overlay/carregamento/filtro — não criar
   nada novo em paralelo.
6. Preservar o comportamento funcional (regras de mercado, filtros,
   busca) — redesign visual, não mudança de regra.
7. Testar (mobile-first, mesmo padrão das demandas anteriores).
8. Atualizar `docs/requirements/ui-ux/S4_REQUISITOS_VIGENTES.md`
   marcando esta tela como migrada.
9. Retornar relatório técnico nesta mesma seção do handoff, status
   `REVISÃO DO PM NECESSÁRIA`.

Fora de escopo

* qualquer outra tela do Batch 3 (Negociação, Contratos, Resumo da
  rodada);
* qualquer mudança de regra de mercado, filtro, busca ou lógica de
  interesse/oferta (Transfer Engine intocado);
* qualquer mudança na definição do TransferCard além do que
  `S4-B3-001` já formalizou — divergência registrada e devolvida ao
  PM, não decidida unilateralmente;
* gaps P1/P2 não relacionados a esta tela específica.

Dependências

* `S4-B3-001` (TransferCard) — bloqueante, precisa estar concluída.
* `S3-DS20-S4-PREP-001` (aprovada, concluída).
* `docs/sprints/S3/S3_S4_MATRIZ_TELAS_MOBILE.md` (Tela 14).
* `docs/requirements/ui-ux/S4_REQUISITOS_VIGENTES.md`.

Requisitos

Mesma sequência obrigatória de sempre: inspecionar → localizar →
entender → planejar → alterar → testar → revisar.

Critérios de aceite

* tela usa os tokens do Design System novo, reutilizando o
  TransferCard;
* busca, filtros, valor/contrato/status e início de negociação
  continuam todos funcionando;
* nenhuma mudança de regra de mercado;
* nenhuma outra tela tocada;
* teste mobile-first cobrindo a tela.

Validações

O PM deverá validar: aderência ao Design System, reutilização correta
do TransferCard, preservação de todas as funcionalidades de mercado,
teste, escopo respeitado.

Riscos

* médio-alto — é um dos fluxos transacionais mais críticos do
  produto (toda semana de jogo passa por ali), com bastante
  interação (busca/filtros/listagem).

Observações

Segunda e terceira telas recomendadas do Batch 3, depois desta:
Negociação/Proposta (também usa TransferCard) e Contratos (usa
ContractCard).

⸻

S4-B3-003 — Migrar tela Negociação/Proposta para o Design System novo

Status: PRONTO PARA IMPLEMENTAÇÃO
Sprint: S4 — Redesign Mobile
Fase: Batch 3 (Transactional) — item 3 de 4
Prioridade: P0

Objetivo

Migrar a tela de negociação de jogadores para o Design System novo,
conforme `docs/sprints/S3/S3_S4_MATRIZ_TELAS_MOBILE.md` (Tela 15):
apresentar jogador, clube, proposta, valor, salário, duração,
condições relevantes, status, ações — reduzindo ambiguidades no fluxo.

Contexto

Terceira tela do Batch 3. A S3.2.7 Readiness Review identificou
Negociação/Proposta como uma das 9 telas P0 ainda fora do sistema
novo, e como uma das que mais depende de overlay/diálogo pesado — a
própria demanda `S3-DS20-S4-PREP-001` citou esta tela (junto com
Mercado e Contratos) como motivação pra ter Dialog pronto antes de
migrar aqui.

Escopo

Chapéu implementador deve, quando retomar esta demanda:

1. Inspecionar a implementação atual da tela de Negociação antes de
   alterar qualquer coisa.
2. Migrar a apresentação visual para os tokens do Design System novo.
3. Usar o TransferCard (`S4-B3-001`) para representar o jogador/oferta
   em negociação, e o Dialog (`S3-DS20-S4-PREP-001`) para os fluxos de
   confirmação/decisão.
4. Garantir que valor, salário, duração, condições, status e as ações
   disponíveis continuam todos funcionando, com o fluxo reduzindo
   ambiguidade (conforme pede a matriz).
5. Preservar o comportamento funcional (regras de negociação,
   validações, cálculo de proposta) — redesign visual, não mudança de
   regra.
6. Testar (mobile-first, mesmo padrão das demandas anteriores).
7. Atualizar `docs/requirements/ui-ux/S4_REQUISITOS_VIGENTES.md`
   marcando esta tela como migrada.
8. Retornar relatório técnico nesta mesma seção do handoff, status
   `REVISÃO DO PM NECESSÁRIA`.

Fora de escopo

* qualquer outra tela do Batch 3 (Mercado, Contratos, Resumo da
  rodada);
* qualquer mudança de regra de negociação, cálculo de proposta ou
  validação (Transfer Engine intocado);
* qualquer mudança na definição do TransferCard/Dialog além do que já
  foi formalizado — divergência registrada e devolvida ao PM;
* gaps P1/P2 não relacionados a esta tela específica.

Dependências

* `S4-B3-001` (TransferCard) — bloqueante, precisa estar concluída.
* `S3-DS20-S4-PREP-001` (Dialog) — aprovada, concluída.
* `docs/sprints/S3/S3_S4_MATRIZ_TELAS_MOBILE.md` (Tela 15).
* `docs/requirements/ui-ux/S4_REQUISITOS_VIGENTES.md`.

Requisitos

Mesma sequência obrigatória de sempre: inspecionar → localizar →
entender → planejar → alterar → testar → revisar.

Critérios de aceite

* tela usa os tokens do Design System novo, reutilizando TransferCard
  e Dialog;
* valor, salário, duração, condições, status e ações continuam todos
  funcionando;
* fluxo reduz ambiguidade (critério explícito da matriz);
* nenhuma mudança de regra de negociação;
* nenhuma outra tela tocada;
* teste mobile-first cobrindo a tela.

Validações

O PM deverá validar: aderência ao Design System, reutilização correta
de TransferCard/Dialog, preservação de todas as funcionalidades de
negociação, clareza do fluxo, teste, escopo respeitado.

Riscos

* médio-alto — mesmo nível de criticidade de Mercado; fluxo de
  decisão (aceitar/recusar/contrapropor) é sensível a regressão sutil
  de comportamento.

Observações

Quarta e última tela recomendada do Batch 3 (excluindo Resumo da
rodada, fora desta rodada): Contratos, usando ContractCard.

⸻

S4-B3-004 — Migrar tela Contratos para o Design System novo

Status: PRONTO PARA IMPLEMENTAÇÃO
Sprint: S4 — Redesign Mobile
Fase: Batch 3 (Transactional) — item 4 de 4
Prioridade: P0

Objetivo

Migrar a tela de gerenciamento de contratos para o Design System novo,
conforme `docs/sprints/S3/S3_S4_MATRIZ_TELAS_MOBILE.md` (Tela 16):
permitir visualizar jogador, duração, salário, situação, proximidade
do vencimento e ações disponíveis — usando o ContractCard quando
apropriado.

Contexto

Quarta tela do Batch 3 (a quinta, Resumo da rodada, fica fora desta
rodada — ver observação em `S4-B3-001`). A S3.2.7 Readiness Review
identificou Contratos como uma das 9 telas P0 ainda fora do sistema
novo.

Escopo

Chapéu implementador deve, quando retomar esta demanda:

1. Inspecionar a implementação atual da tela de Contratos antes de
   alterar qualquer coisa.
2. Migrar a apresentação visual para os tokens do Design System novo.
3. Usar o ContractCard (`S4-B3-001`) para representar cada contrato.
4. Garantir que duração, salário, situação, proximidade do vencimento
   e as ações disponíveis continuam todos funcionando.
5. Usar os componentes já disponíveis (Dialog, Bottom Sheet, Skeleton)
   onde a tela precisar de overlay/carregamento — não criar nada novo
   em paralelo.
6. Preservar o comportamento funcional (regras de contrato, renovação,
   rescisão) — redesign visual, não mudança de regra.
7. Testar (mobile-first, mesmo padrão das demandas anteriores).
8. Atualizar `docs/requirements/ui-ux/S4_REQUISITOS_VIGENTES.md`
   marcando esta tela como migrada.
9. Retornar relatório técnico nesta mesma seção do handoff, status
   `REVISÃO DO PM NECESSÁRIA`.

Fora de escopo

* qualquer outra tela do Batch 3 (Mercado, Negociação, Resumo da
  rodada);
* qualquer mudança de regra de contrato, renovação ou rescisão;
* qualquer mudança na definição do ContractCard além do que
  `S4-B3-001` já formalizou — divergência registrada e devolvida ao
  PM;
* gaps P1/P2 não relacionados a esta tela específica.

Dependências

* `S4-B3-001` (ContractCard) — bloqueante, precisa estar concluída.
* `S3-DS20-S4-PREP-001` (aprovada, concluída).
* `docs/sprints/S3/S3_S4_MATRIZ_TELAS_MOBILE.md` (Tela 16).
* `docs/requirements/ui-ux/S4_REQUISITOS_VIGENTES.md`.

Requisitos

Mesma sequência obrigatória de sempre: inspecionar → localizar →
entender → planejar → alterar → testar → revisar.

Critérios de aceite

* tela usa os tokens do Design System novo, reutilizando o
  ContractCard;
* duração, salário, situação, proximidade do vencimento e ações
  continuam todos funcionando;
* nenhuma mudança de regra de contrato;
* nenhuma outra tela tocada;
* teste mobile-first cobrindo a tela.

Validações

O PM deverá validar: aderência ao Design System, reutilização correta
do ContractCard, preservação de todas as funcionalidades de contrato,
teste, escopo respeitado.

Riscos

* médio — tela transacional mas com menos interação em tempo real
  que Mercado/Negociação (mais consulta/gestão do que decisão sob
  pressão de janela de mercado).

Observações

Com esta demanda concluída e aprovada, o Batch 3 estará completo
**exceto Resumo da rodada** — que continua fora até MatchCard/
FinancialSummary passarem por inspeção própria (ver
`S4_REQUISITOS_VIGENTES.md` §5, item 2b).

⸻

S4-B3-005 — Inspecionar e formalizar MatchCard e FinancialSummary

Status: PRONTO PARA IMPLEMENTAÇÃO
Sprint: S4 — Redesign Mobile
Fase: Batch 3 (Transactional) — pré-requisito de Resumo da rodada
Prioridade: P1

Objetivo

Determinar, com evidência real (não presumida), se os componentes
**MatchCard** e **FinancialSummary** já existem de fato no código (como
aconteceu com PlayerCard, formalização retroativa) ou se precisam ser
construídos do zero (como TransferCard/ContractCard) — e então
formalizar ou construir de acordo com o que for encontrado. Isso
desbloqueia a especificação de Resumo da rodada, a última tela do
Batch 3 ainda sem demanda.

Contexto

Esta lacuna já foi identificada 2 vezes sem ser resolvida:

* na refinação de `docs/requirements/ui-ux/S4_REQUISITOS_VIGENTES.md`
  (§3-4), que registrou candidatos possíveis — uma classe/estilo
  associado a confronto direto entre clubes (encontrado dentro de uma
  função de "H2H"/histórico de confrontos) pra MatchCard, e uma função
  de barras de histórico de caixa pra FinancialSummary — mas marcou
  ambos como "não inspecionados o suficiente", em particular
  levantando a suspeita de que o candidato a MatchCard seja um widget
  menor (confronto direto/H2H), não o card de "próxima partida"/
  resultado que a matriz de telas descreve;
* na especificação de `S4-B3-001` (TransferCard/ContractCard), que
  deliberadamente excluiu estes 2 componentes por causa da mesma
  incerteza.

Diferente de `S4-B3-001` (onde já sabíamos que os componentes eram
novos) e de `S3-DS20-S4-PREP-002` (onde já sabíamos que era retroativo
a partir de um candidato único e claro), aqui a primeira pergunta é
literalmente "qual desses dois caminhos é o certo" — e a resposta pode
até ser diferente pra cada um dos dois componentes (ex.: MatchCard
precisar ser construído novo enquanto FinancialSummary aproveita algo
existente, ou vice-versa).

Escopo

Chapéu implementador deve, quando retomar esta demanda:

1. Inspecionar a implementação atual de Início/Dashboard (já migrada
   pro Design System novo) e de Resumo da rodada (ainda legada) em
   busca de qualquer apresentação de partida (placar, mandante/
   visitante, status) e de resumo financeiro (caixa, histórico) — não
   só os candidatos já apontados, considerar que pode haver mais de um
   lugar candidato.
2. Para cada um dos 2 componentes, decidir com evidência: (a) já existe
   um candidato real e único que cobre o objetivo do componente
   (`docs/sprints/S3/S3_2_COMPONENTES_E_CONTRATOS.md` §24 MatchCard,
   §28 FinancialSummary) — formalizar como retroativo, mesmo padrão de
   PlayerCard; ou (b) não existe candidato adequado — construir novo,
   mesmo padrão de TransferCard/ContractCard.
3. Documentar o contrato de cada um (Nome/Objetivo/Entradas/Estados).
4. MatchCard: cobrir os estados definidos na especificação (próxima,
   em andamento, encerrada, adiada, cancelada) — se o candidato
   encontrado não cobrir todos, isso é parte da decisão formalizar-vs-
   construir do item 2, não um detalhe a ignorar.
5. Nenhuma lógica de negócio nos componentes (nem cálculo de
   resultado, nem regra financeira) — mesma regra de todos os outros
   Product Patterns.
6. Validar via teste automatizado direto (mesmo padrão de
   `S4-B3-001`/Bottom Sheet/Skeleton — sem integração em tela real
   nesta demanda).
7. Atualizar `docs/requirements/ui-ux/S4_REQUISITOS_VIGENTES.md`
   marcando os 2 componentes como resolvidos (e removendo o item 2b
   como pendência).
8. Retornar relatório técnico nesta mesma seção do handoff, incluindo
   explicitamente qual caminho (formalização retroativa vs. construção
   nova) foi seguido pra cada um dos 2 componentes e por quê — status
   `REVISÃO DO PM NECESSÁRIA`.

Fora de escopo

* migrar Resumo da rodada (ou qualquer outra tela) — isso é uma
  demanda futura, depois desta;
* qualquer lógica de negócio (cálculo de resultado de partida, regra
  financeira);
* qualquer alteração em Início/Dashboard além de, se a formalização
  retroativa for o caminho escolhido, adicionar o comentário de
  contrato (mesmo tratamento dado a Elenco em `S3-DS20-S4-PREP-002`) —
  sem mudança visual/funcional ali;
* LeagueTable — outro Product Pattern ainda pendente, mas fora desta
  demanda (não faz parte do Batch 3).

Dependências

* `S3-DS20-S4-PREP-001` (aprovada, concluída).
* `docs/sprints/S3/S3_2_COMPONENTES_E_CONTRATOS.md` §24 (MatchCard),
  §28 (FinancialSummary).
* `docs/requirements/ui-ux/S4_REQUISITOS_VIGENTES.md` §3-5.

Requisitos

Mesma sequência obrigatória de sempre: inspecionar → localizar →
entender → planejar → alterar → testar → revisar. A decisão
formalizar-vs-construir deve vir com evidência (arquivo/trecho
relevante) no relatório final, mesmo padrão de rigor da S3.2.7 — não
uma afirmação sem sustentação.

Critérios de aceite

* MatchCard e FinancialSummary existem como componentes nomeados e
  documentados, cada um com a decisão (retroativo ou novo)
  justificada com evidência;
* nenhum dos dois contém lógica de negócio;
* nenhuma tela migrada nesta demanda;
* teste automatizado cobrindo os 2 componentes;
* `S4_REQUISITOS_VIGENTES.md` atualizado, item 2b resolvido.

Validações

O PM deverá validar: a evidência por trás da decisão formalizar-vs-
construir pra cada componente, aderência ao Design System, ausência
de lógica de negócio, contrato documentado, teste.

Riscos

* baixo-médio — escopo é decisão + formalização/construção de
  componentes de apresentação, não migração de tela; o risco principal
  é a decisão formalizar-vs-construir sair errada ou mal justificada,
  não um risco de regressão funcional.

Observações

Ao concluir esta demanda, **Resumo da rodada** (última tela do Batch 3)
fica pronta pra ser especificada como demanda própria — mesmo padrão
de todas as outras telas do Batch 2/3.

⸻

S4-AUDIT-BACKLOG-001 — Auditoria de prontidão das demandas #12 a #21

Status: PRONTO PARA IMPLEMENTAÇÃO
Sprint: S4 — Redesign Mobile
Fase: pré-requisito transversal (Batch 2 + Batch 3) — substitui a
demanda anterior desta seção, que era `S4-B4-000` (auditoria das 7
telas do Batch 4) — reescopada a pedido do Murilo antes de qualquer
implementação.
Prioridade: P1

Objetivo

Auditar o estado real de todas as 10 demandas já especificadas e
abertas como issue — `S4-B2-001` (#12), `S4-B2-002` (#13),
`S4-B2-003` (#14), `S4-B2-004` (#15), `S4-B2-005` (#16), `S4-B3-001`
(#17), `S4-B3-002` (#18), `S4-B3-003` (#19), `S4-B3-004` (#20),
`S4-B3-005` (#21) — antes de qualquer uma delas ser implementada ou de
qualquer demanda nova ser especificada em cima das que já existem.

Contexto

Esta sessão especificou as 10 demandas acima em sequência, sem
implementar nenhuma delas diretamente — mas já se confirmou 2 vezes
que sessões de implementação externas pegam demandas do handoff e as
executam sem avisar esta sessão em tempo real: `S3-DS20-S4-PREP-001` e
`S3-DS20-S4-PREP-002` foram ambas implementadas, aprovadas e mescladas
em `main` por sessões separadas — a segunda só foi descoberta porque o
Murilo pediu explicitamente pra verificar ("Veja se Perfil de Jogador
não está liberado").

Não há garantia de que nenhuma das demandas #12-#21 tenha passado pelo
mesmo. Continuar especificando demandas novas (e demandas que dependem
delas, como as do Batch 3 dependem de `S4-B3-001`) em cima de um
pressuposto não verificado é um risco de coordenação, não só um
detalhe administrativo — se `S4-B3-001` já foi implementada e
aprovada, por exemplo, isso muda o que `S4-B3-002/003/004` deveriam
assumir como ponto de partida.

Escopo

Para cada uma das 10 demandas, Claude deve:

1. Verificar se existe branch, commit ou Pull Request associado no
   repositório (mesmo processo usado quando se confirmou que
   `S3-DS20-S4-PREP-002` já estava implementada) — buscar por
   referências relacionadas ao ID da demanda ou ao seu conteúdo.
2. Se encontrar progresso: confirmar o status real (em implementação?
   pronta pra revisão? já aprovada e mesclada?) e atualizar a seção
   correspondente do handoff de acordo — mesmo tratamento dado a
   `S3-DS20-S4-PREP-002` quando sua conclusão foi descoberta.
3. Se não encontrar progresso: confirmar que a especificação ainda é
   válida — inspecionar a implementação atual da tela/componente
   relacionado e confirmar que nada mudou desde a especificação
   original que invalide o escopo, as dependências ou os riscos
   descritos nela.
4. Revalidar a cadeia de dependências entre as demandas — em
   particular, que `S4-B3-002`/`003`/`004` de fato ainda dependem de
   `S4-B3-001` como bloqueante, e que a ordem recomendada continua
   fazendo sentido dado o estado real encontrado.
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
  necessária, precisa virar uma demanda própria depois desta;
* especificar qualquer demanda nova — isso só deve acontecer depois
  que esta auditoria confirmar (ou corrigir) o estado do backlog
  atual.

Dependências

* as 10 demandas em si (`S4-B2-001` a `S4-B2-005`, `S4-B3-001` a
  `S4-B3-005`), já especificadas em `docs/HANDOFF_CLAUDE.md` e como
  issues #12-#21.
* `docs/requirements/ui-ux/S4_REQUISITOS_VIGENTES.md`.

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

Esta demanda existe pra proteger contra o mesmo tipo de lacuna que já
aconteceu 2 vezes nesta sessão (progresso externo não percebido em
tempo real) — não é desconfiança de que as 10 demandas estejam
malfeitas, é confirmação de que o estado presumido (nenhuma
implementada ainda) ainda é real antes de continuar construindo mais
demandas em cima dele.

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
