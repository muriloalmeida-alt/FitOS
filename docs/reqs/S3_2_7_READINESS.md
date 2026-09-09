S3.2.7 — S4 Readiness Review

Documento: S3_2_7_READINESS.md
ID: S3-DS20-S4-READINESS-001
Sprint: S3 — BRDATA Design System 2.0
Fase: S3.2.7 — S4 Readiness Review
Prioridade: P0
Status: PRONTO PARA IMPLEMENTAÇÃO
Responsável pela especificação: PM
Implementação / auditoria: Claude
Validação: PM

⸻

1. Objetivo

Realizar uma auditoria da implementação atual do BRDATA Design System 2.0 e determinar se ela apresenta maturidade suficiente para atender aos requisitos definidos para a evolução mobile.

A avaliação deve verificar a implementação real existente, e não apenas a documentação ou a intenção de implementação.

A S3.2.7 é, portanto, uma etapa de Readiness Review.

⸻

2. Resultado esperado

A avaliação deverá determinar se a implementação atual está:

* consistente com a fundação definida;
* consistente com os contratos de componentes;
* preparada para responsividade;
* adequada em acessibilidade;
* suficientemente reutilizável;
* compatível com as telas previstas;
* livre de regressões críticas conhecidas.

A etapa não autoriza automaticamente qualquer evolução posterior.

Seu objetivo é exclusivamente determinar o estado de prontidão da implementação avaliada.

⸻

3. Escopo da auditoria

Claude deve avaliar os seguintes grupos:

Foundation
Components
Contracts
Responsive
Accessibility
S4 Coverage
Regression
Tests
Gaps
Divergences
Risks

⸻

4. Foundation

Avaliar a implementação da fundação do Design System.

Verificar:

* tokens de cor;
* tokens semânticos;
* espaçamento;
* tipografia;
* radius;
* elevação;
* ícones;
* primitivas;
* centralização;
* reutilização.

⸻

5. Tokens

Verificar se os tokens definidos na S3.1 existem e são utilizados de forma consistente.

Especial atenção para:

bg.canvas
bg.surface
bg.surfaceElevated
border.default
border.strong
text.primary
text.secondary
text.muted
brand.primary
brand.strong
state.success
state.warning
state.danger
state.info
accent.football

Também verificar a escala de espaçamento:

4
8
12
16
24
32
48
64

⸻

6. Tipografia

Verificar se existe hierarquia consistente para:

Display
Title
Section
Body
Small
Caption

Avaliar:

* legibilidade;
* consistência;
* contraste;
* aplicação dos níveis;
* comportamento mobile.

⸻

7. Ícones

Verificar:

* biblioteca principal;
* consistência;
* tamanho;
* área de toque;
* labels acessíveis;
* ausência de emoji como substituto de ícone de interface;
* utilização consistente dos ícones existentes.

⸻

8. Components

Avaliar os componentes fundamentais implementados.

Verificar especialmente:

App Bar / Header
Bottom Navigation
Tabs
Back Action
Card
List Item
Section Header
Stat / KPI
Empty State
Loading / Skeleton
Button
Icon Button
Dialog
Bottom Sheet
Snackbar / Toast
Inline Error

⸻

9. Componentes BRDATA

Avaliar a implementação e reutilização dos padrões:

PlayerCard
MatchCard
LeagueTable
TransferCard
ContractCard
FinancialSummary

Para cada componente verificar:

* existência;
* consistência;
* reutilização;
* estados;
* responsividade;
* acessibilidade;
* dependências;
* acoplamento com regras de negócio.

⸻

10. Contracts

Verificar se os componentes possuem responsabilidades bem delimitadas.

O componente deve cuidar de:

* apresentação;
* composição;
* interação;
* estados visuais.

O componente não deve assumir responsabilidades pertencentes aos engines de negócio.

⸻

11. Regra de separação

Verificar especialmente se componentes visuais não estão executando regras de:

* Transfer Engine;
* Contract Engine;
* Match Engine;
* Economy;
* Player Evolution;
* Career.

Quando uma divergência for encontrada, ela deve ser registrada.

⸻

12. Responsive

Avaliar o comportamento dos componentes e telas em diferentes larguras mobile.

Verificar:

* reflow;
* stack;
* collapse;
* progressive disclosure;
* scroll controlado;
* overflow;
* truncamento;
* quebra de texto;
* densidade.

⸻

13. Problemas críticos de responsividade

Registrar especialmente:

* scroll horizontal involuntário;
* conteúdo cortado;
* elementos sobrepostos;
* CTA inacessível;
* tabelas ilegíveis;
* navegação quebrada;
* componentes que dependem de largura desktop.

⸻

14. Accessibility

Avaliar:

* contraste;
* foco;
* labels;
* área de toque;
* ordem de leitura;
* suporte a aumento de texto;
* estados perceptíveis;
* mensagens de erro;
* feedback de sucesso.

⸻

15. Cor e acessibilidade

Verificar se informação relevante pode ser compreendida sem depender exclusivamente da cor.

Exemplos:

* status;
* erro;
* sucesso;
* disponibilidade;
* classificação;
* alertas.

Quando necessário, utilizar combinação de:

* cor;
* texto;
* ícone;
* posição;
* indicador adicional.

⸻

16. S4 Coverage

Avaliar a cobertura da implementação em relação às 19 telas definidas na matriz mobile.

1. Login / Entrada
2. Loading / Bootstrap
3. Escolha do clube
4. Onboarding
5. Início / Dashboard
6. Elenco
7. Perfil do jogador
8. Comparar jogadores
9. Tática / Formação
10. Eixos táticos
11. Marcação individual
12. Meus esquemas
13. Treino
14. Mercado
15. Negociação / Proposta
16. Contratos
17. Resumo da rodada
18. Notícias / Eventos
19. Histórico / Estatísticas

⸻

17. Cobertura P0

A avaliação deve dar prioridade às telas P0:

Login / Entrada
Loading / Bootstrap
Escolha do clube
Início / Dashboard
Elenco
Perfil do jogador
Tática / Formação
Treino
Mercado
Negociação / Proposta
Contratos
Resumo da rodada

A existência de lacunas em telas P0 deve receber atenção especial.

⸻

18. Cobertura P1

Também verificar:

Onboarding
Comparar jogadores
Eixos táticos
Marcação individual
Meus esquemas
Notícias / Eventos
Histórico / Estatísticas

As lacunas devem ser registradas mesmo que não sejam bloqueadoras.

⸻

19. Regression

Verificar se a evolução visual existente provocou regressões funcionais.

Avaliar, quando aplicável:

* navegação;
* seleção;
* formulários;
* mercado;
* contratos;
* escalação;
* tática;
* treino;
* rodada;
* persistência;
* carregamento;
* feedback.

⸻

20. Preservação funcional

A auditoria deve confirmar que alterações visuais não modificaram regras de negócio.

Não considerar aceitável uma melhoria visual que:

* remova funcionalidade;
* altere fluxo funcional;
* altere regras;
* quebre persistência;
* modifique resultados.

⸻

21. Tests

Claude deve identificar:

* testes existentes;
* testes executados;
* cobertura relevante;
* resultados;
* falhas;
* limitações.

Também deve verificar se mudanças da fundação introduziram regressões.

⸻

22. Gaps

Todos os gaps relevantes devem ser registrados.

Classificar, quando possível, como:

P0
P1
P2

Também identificar:

* impacto;
* componente afetado;
* tela afetada;
* risco;
* recomendação.

⸻

23. Divergences

Registrar divergências entre:

* especificação;
* Material Design 3;
* implementação;
* comportamento esperado.

Cada divergência deve indicar:

* onde ocorre;
* qual é o comportamento atual;
* qual deveria ser o comportamento;
* impacto;
* recomendação.

⸻

24. Material Design 3

O M3 permanece como autoridade visual e comportamental.

A auditoria deve verificar se a implementação:

* utiliza M3 quando aplicável;
* configura M3 adequadamente;
* respeita padrões de interação;
* respeita acessibilidade;
* evita criar componentes paralelos sem justificativa.

Não copiar a documentação oficial do M3 para o projeto.

⸻

25. Classificação das divergências

Quando relevante, classificar como:

M3 Official
M3 Configured
BRDATA Extension
BRDATA Product Pattern

Uma extensão BRDATA não é automaticamente um problema.

O problema ocorre quando uma extensão:

* substitui desnecessariamente M3;
* cria inconsistência;
* duplica componente existente;
* reduz acessibilidade;
* prejudica manutenção.

⸻

26. Risks

Registrar riscos técnicos e de produto.

Exemplos:

* componente duplicado;
* ausência de token;
* dependência de valores hardcoded;
* acoplamento visual/regra de negócio;
* acessibilidade insuficiente;
* comportamento mobile inconsistente;
* regressão funcional;
* dívida técnica relevante.

⸻

27. Evidências

A avaliação deve ser baseada na implementação real.

Claude deve informar:

* arquivos avaliados;
* componentes encontrados;
* evidências relevantes;
* testes executados;
* comportamento observado;
* problemas encontrados.

⸻

28. Arquivos

O relatório deve registrar:

Arquivos alterados

Lista dos arquivos modificados durante a auditoria, caso existam.

Arquivos criados

Lista de novos arquivos.

Arquivos removidos

Lista de arquivos removidos, se houver.

A remoção de arquivos deve possuir justificativa.

⸻

29. Regra de escopo

A S3.2.7 é uma auditoria.

Claude não deve utilizar a etapa como justificativa para realizar uma grande refatoração não solicitada.

Caso sejam encontrados problemas:

1. registrar;
2. classificar;
3. explicar impacto;
4. propor solução;
5. retornar para o PM.

⸻

30. Implementação durante a auditoria

Se uma correção for absolutamente necessária para executar ou validar a auditoria, ela deve ser claramente registrada.

Não transformar a Readiness Review em uma reconstrução do Design System.

⸻

31. Resultado por categoria

Claude deve retornar uma avaliação individual para:

Categoria	Resultado
Foundation	A avaliar
Components	A avaliar
Contracts	A avaliar
Responsive	A avaliar
Accessibility	A avaliar
S4 Coverage	A avaliar
Regression	A avaliar
Tests	A avaliar
Gaps	A avaliar
Divergences	A avaliar
Risks	A avaliar

⸻

32. Resultado final

A auditoria deve produzir exatamente uma das três classificações:

APPROVED
ADJUSTMENTS REQUIRED
BLOCKED

⸻

33. APPROVED

Utilizar quando a implementação atender aos critérios necessários e não existirem gaps relevantes que impeçam a aprovação.

⸻

34. ADJUSTMENTS REQUIRED

Utilizar quando a base estiver funcional, mas existirem ajustes necessários antes da aprovação.

O relatório deve listar claramente os ajustes.

⸻

35. BLOCKED

Utilizar quando existir impedimento relevante que impossibilite a aprovação.

O bloqueio deve possuir justificativa objetiva.

⸻

36. Critérios de avaliação

A avaliação deve considerar:

Foundation

A fundação deve estar suficientemente centralizada e consistente.

Components

Os componentes necessários devem estar implementados ou adequadamente estruturados.

Contracts

As responsabilidades devem estar bem delimitadas.

Responsive

A base deve permitir comportamento mobile adequado.

Accessibility

Não podem existir problemas críticos de acessibilidade que inviabilizem a evolução.

Coverage

A implementação deve possuir cobertura suficiente para as necessidades identificadas.

Regression

Não podem existir regressões críticas conhecidas.

⸻

37. Relatório obrigatório

Claude deve retornar um relatório contendo:

1. Resumo executivo
2. Foundation
3. Components
4. Contracts
5. Responsive
6. Accessibility
7. S4 Coverage
8. Regression
9. Tests
10. Gaps
11. Divergences
12. Risks
13. Arquivos avaliados
14. Arquivos alterados/criados/removidos
15. Resultado final
16. Recomendação

⸻

38. Retorno formal

Ao finalizar a avaliação, Claude deve sinalizar:

REVISÃO DO PM NECESSÁRIA

Esse retorno é obrigatório independentemente do resultado encontrado.

⸻

39. Validação pelo PM

O PM deve avaliar:

* aderência ao escopo;
* qualidade da implementação;
* aderência ao M3;
* coerência arquitetural;
* acessibilidade;
* responsividade;
* preservação funcional;
* testes;
* gaps;
* riscos;
* divergências.

O PM pode:

APROVAR

ou solicitar:

AJUSTES NECESSÁRIOS

ou considerar:

BLOQUEADO

⸻

40. Regra de commit

A aprovação técnica do Dev não equivale à autorização de commit.

A regra geral do projeto é:

Aprovação formal do PM + Handoff atualizado = autorização para commit.

⸻

41. Caso APPROVED

Se o PM considerar o resultado:

APPROVED

o PM deve:

1. registrar formalmente a aprovação;
2. atualizar HANDOFF_CLAUDE.md;
3. registrar a conclusão da demanda;
4. somente então autorizar o commit final.

⸻

42. Caso ADJUSTMENTS REQUIRED

Se o PM considerar:

ADJUSTMENTS REQUIRED

o PM deve:

1. registrar os ajustes;
2. atualizar HANDOFF_CLAUDE.md;
3. devolver a demanda ao Dev;
4. manter o commit final não autorizado.

⸻

43. Caso BLOCKED

Se o resultado for:

BLOCKED

o PM deve:

1. registrar o bloqueio;
2. documentar a causa;
3. atualizar HANDOFF_CLAUDE.md;
4. manter o commit final não autorizado.

⸻

44. Proibição de antecipação

Este documento não deve declarar automaticamente qual será a próxima etapa do roadmap em função do resultado da auditoria.

A decisão sobre continuidade pertence ao PM após a avaliação.

⸻

45. Critério de aprovação

A demanda somente poderá ser considerada formalmente aprovada quando:

* a auditoria tiver sido executada;
* o relatório tiver sido entregue;
* os critérios tiverem sido avaliados;
* o PM tiver realizado a revisão;
* o resultado tiver sido formalmente aprovado;
* o Handoff tiver sido atualizado.

⸻

46. Definition of Done

A S3.2.7 estará concluída somente quando:

* auditoria executada;
* implementação real avaliada;
* Foundation avaliada;
* Components avaliados;
* Contracts avaliados;
* Responsive avaliado;
* Accessibility avaliada;
* cobertura avaliada;
* regressões avaliadas;
* testes avaliados;
* gaps registrados;
* divergências registradas;
* riscos registrados;
* arquivos registrados;
* resultado final definido;
* relatório entregue ao PM;
* revisão do PM realizada;
* Handoff atualizado após a decisão.

⸻

47. Demanda oficial

ID: S3-DS20-S4-READINESS-001

Nome: S4 Readiness Review

Status: PRONTO PARA IMPLEMENTAÇÃO

Sprint: S3 — BRDATA Design System 2.0

Fase: S3.2.7

Prioridade: P0

Objetivo: auditar a implementação atual do Design System 2.0 e determinar seu nível de prontidão conforme os critérios estabelecidos.

⸻

48. Instrução para Claude

Claude deve:

1. ler este documento;
2. ler a documentação relacionada;
3. inspecionar a implementação atual;
4. identificar o que já existe;
5. mapear dependências;
6. avaliar a implementação;
7. executar os testes necessários;
8. registrar gaps;
9. registrar divergências;
10. registrar riscos;
11. registrar arquivos avaliados;
12. produzir o relatório;
13. retornar:

REVISÃO DO PM NECESSÁRIA

Claude não deve considerar a demanda aprovada por conta própria.

⸻

49. Documentação relacionada

A avaliação deve considerar, no mínimo:

docs/README_HANDOFF.md
docs/HANDOFF_CLAUDE.md
docs/project/ROADMAP.md
docs/project/PROJECT_CONTEXT.md
docs/project/CHANGELOG.md
docs/reqs/S3_DS20_FUNDACAO_EXECUTAVEL.md
docs/reqs/S3_2_COMPONENTES_E_CONTRATOS.md
docs/reqs/S3_S4_MATRIZ_TELAS_MOBILE.md

Quando disponíveis.

⸻

50. Princípio final

A Readiness Review deve avaliar a realidade da implementação, não apenas a existência da documentação.

O objetivo é fornecer ao PM evidências suficientes para tomar uma decisão formal sobre a qualidade e maturidade da base avaliada.

A implementação pode estar tecnicamente concluída e ainda assim não estar aprovada.

A aprovação pertence exclusivamente ao PM.
