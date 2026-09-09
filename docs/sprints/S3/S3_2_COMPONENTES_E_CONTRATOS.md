S3.2 — Componentes e Contratos

BRDATA Design System 2.0

Documento: S3_2_COMPONENTES_E_CONTRATOS.md
Sprint: S3 — BRDATA Design System 2.0
Fase: S3.2 — Componentes e Contratos
Status: Especificação consolidada
Responsável pela especificação: PM
Implementação: Claude
Validação: PM

⸻

1. Objetivo

Definir a arquitetura funcional dos componentes do BRDATA Design System 2.0 e estabelecer contratos claros para sua utilização nas telas do produto.

A S3.2 tem como objetivo garantir que os componentes:

* sejam reutilizáveis;
* possuam responsabilidades claras;
* sejam consistentes;
* utilizem a fundação da S3.1;
* respeitem Material Design 3;
* sejam preparados para mobile;
* possuam estados previsíveis;
* sejam acessíveis;
* não criem padrões visuais paralelos.

⸻

2. Princípio central

O Design System deve ser construído seguindo:

Fundação
   ↓
Primitivas
   ↓
Componentes
   ↓
Padrões de produto
   ↓
Telas

Os componentes não devem conter regras de negócio que pertençam aos sistemas do jogo.

O componente é responsável pela apresentação, interação e composição visual.

A regra de negócio continua pertencendo à camada funcional correspondente.

⸻

3. Material Design 3 como autoridade

O Material Design 3 é a autoridade visual e comportamental.

O BRDATA deve:

* reutilizar componentes M3 quando aplicáveis;
* configurar M3 para a identidade do BRDATA;
* respeitar os estados definidos pelo M3;
* respeitar as diretrizes de acessibilidade;
* evitar duplicação desnecessária.

As decisões devem ser classificadas como:

M3 Official
M3 Configured
BRDATA Extension
BRDATA Product Pattern

⸻

4. Responsabilidade do componente

Cada componente deve responder claramente:

1. qual problema resolve;
2. qual conteúdo recebe;
3. quais estados suporta;
4. quais ações suporta;
5. quais variações possui;
6. como se comporta em mobile;
7. quais requisitos de acessibilidade possui.

⸻

5. Separação entre UI e regra de negócio

Os componentes não devem assumir decisões de negócio.

Exemplo:

PlayerCard pode receber:

* overall;
* posição;
* salário;
* contrato;
* status.

Mas não deve decidir:

* se o jogador pode ser contratado;
* quanto vale;
* se deve receber proposta;
* se está disponível no mercado.

Essas decisões pertencem aos respectivos engines/sistemas.

⸻

6. Estados

Os componentes devem contemplar os estados aplicáveis.

Estados básicos:

default
focus
pressed
disabled
loading
error

Componentes orientados a dados podem possuir:

empty
success
stale
updated

O estado deve fazer parte do contrato do componente.

⸻

7. Contrato mínimo

Todo componente relevante deve possuir:

Nome
Objetivo
Responsabilidade
Entradas
Saídas/eventos
Estados
Variações
Responsividade
Acessibilidade
Dependências

⸻

8. Inventário de componentes

O inventário deve considerar os seguintes grupos.

8.1 Navegação

* App Bar / Header
* Bottom Navigation
* Tabs
* Back Action

8.2 Estrutura

* Card
* List Item
* Section Header
* Surface
* Divider

8.3 Informação

* Stat / KPI
* Badge
* Chip
* Avatar / Club Crest

8.4 Entrada

* Button
* Icon Button
* Input
* Select

8.5 Feedback

* Loading
* Skeleton
* Empty State
* Inline Error
* Snackbar / Toast
* Progress / Indicator

8.6 Sobreposição

* Dialog
* Bottom Sheet

8.7 Produto BRDATA

* PlayerCard
* MatchCard
* LeagueTable
* TransferCard
* ContractCard
* FinancialSummary

⸻

9. App Bar / Header

Objetivo

Fornecer identificação da tela e ações contextuais.

Responsabilidade

* título;
* navegação;
* ações relevantes;
* contexto atual.

Estados

* default;
* scroll, quando aplicável;
* loading, quando necessário.

Mobile

Deve preservar a hierarquia da tela sem ocupar espaço excessivo.

⸻

10. Bottom Navigation

Objetivo

Permitir navegação entre áreas principais do produto.

Estrutura proposta:

Início
Elenco
Mercado
Partidas/Rodada
Menu

Requisitos

* indicação clara da área atual;
* labels acessíveis;
* área de toque adequada;
* consistência entre telas.

⸻

11. Tabs

Objetivo

Alternar entre conteúdos relacionados dentro de uma mesma área.

As tabs não devem ser utilizadas para substituir navegação global.

Devem possuir:

* estado selecionado;
* estado não selecionado;
* foco;
* interação;
* comportamento adequado em mobile.

⸻

12. Back Action

Objetivo

Retornar ao contexto anterior.

Deve possuir:

* área de toque adequada;
* label acessível;
* indicação visual consistente.

⸻

13. Card

Objetivo

Agrupar informações relacionadas.

O Card deve funcionar como componente estrutural, não como container obrigatório para todo conteúdo.

Deve permitir:

* conteúdo;
* ações;
* estados;
* variações de densidade.

⸻

14. List Item

Objetivo

Representar um item em uma lista.

Pode possuir:

* ícone;
* avatar;
* título;
* descrição;
* metadados;
* ação;
* indicador.

Deve preservar leitura e toque adequados no mobile.

⸻

15. Section Header

Objetivo

Separar e identificar grupos de conteúdo.

Pode possuir:

* título;
* descrição;
* ação contextual.

Deve contribuir para a hierarquia da informação.

⸻

16. Stat / KPI

Objetivo

Destacar uma métrica importante.

Pode representar:

* valor;
* label;
* tendência;
* estado;
* comparação.

A representação não deve depender exclusivamente de cor.

⸻

17. Empty State

Objetivo

Comunicar ausência de conteúdo.

Deve diferenciar:

* ausência real de dados;
* carregamento;
* erro.

Quando houver ação possível, ela deve ser claramente apresentada.

⸻

18. Loading / Skeleton

Objetivo

Representar carregamento sem causar percepção de erro.

O Skeleton deve preservar a estrutura aproximada do conteúdo final.

Evitar layout shift excessivo.

⸻

19. Inline Error

Objetivo

Comunicar erro associado a uma área específica.

Deve informar, quando possível:

* problema;
* consequência;
* ação de recuperação.

⸻

20. Snackbar / Toast

Objetivo

Comunicar feedback breve e contextual.

Deve ser utilizado para mensagens que não exigem interrupção do fluxo.

Exemplos:

* salvamento;
* atualização;
* ação concluída;
* erro recuperável.

⸻

21. Dialog

Objetivo

Interromper temporariamente o fluxo para solicitar decisão ou confirmação.

Deve ser utilizado apenas quando a decisão exigir atenção.

⸻

22. Bottom Sheet

Objetivo

Apresentar conteúdo ou ações contextuais de maneira adequada ao mobile.

Pode ser utilizado para:

* filtros;
* ações;
* detalhes complementares;
* seleção.

⸻

23. PlayerCard

Objetivo

Representar um jogador.

Conteúdo possível

* nome;
* posição;
* overall;
* idade;
* clube;
* condição;
* contrato;
* salário;
* status.

Responsabilidade

Apresentar informações recebidas.

Não deve executar regras do Player Engine ou Transfer Engine.

⸻

24. MatchCard

Objetivo

Representar uma partida.

Conteúdo

* clube mandante;
* clube visitante;
* escudos;
* data;
* horário;
* placar;
* status;
* competição.

Estados

* próxima;
* em andamento;
* encerrada;
* adiada;
* cancelada, quando aplicável.

⸻

25. LeagueTable

Objetivo

Representar a classificação de uma competição.

Conteúdo

* posição;
* clube;
* pontos;
* jogos;
* vitórias;
* empates;
* derrotas;
* saldo;
* gols.

A versão mobile deve priorizar as informações essenciais.

Informações secundárias podem ser apresentadas por expansão ou contexto adicional.

⸻

26. TransferCard

Objetivo

Representar uma oportunidade ou operação de mercado.

Pode apresentar:

* jogador;
* clube;
* valor;
* salário;
* status;
* ação.

O componente não deve calcular valuation.

⸻

27. ContractCard

Objetivo

Representar a situação contratual de um jogador.

Pode apresentar:

* jogador;
* clube;
* salário;
* duração;
* status;
* proximidade do vencimento;
* ação.

O componente não deve determinar regras de renovação.

⸻

28. FinancialSummary

Objetivo

Apresentar um resumo financeiro.

Pode contemplar:

* saldo;
* receitas;
* despesas;
* orçamento;
* variações;
* indicadores.

O componente apenas apresenta os dados recebidos.

⸻

29. Responsividade

Todos os componentes devem possuir comportamento definido para mobile.

A adaptação pode ocorrer por:

* redução de conteúdo secundário;
* reorganização;
* empilhamento;
* mudança de orientação;
* expansão contextual;
* scroll controlado quando necessário.

Não utilizar redução arbitrária de escala como estratégia principal.

⸻

30. Touch

Elementos interativos devem possuir área de toque confortável.

A área de interação deve ser maior que o glyph quando o controle utilizar ícone.

⸻

31. Acessibilidade

Todo componente interativo deve considerar:

* foco;
* contraste;
* nome acessível;
* papel semântico;
* estado;
* feedback;
* ordem de leitura.

Componentes visuais não devem depender exclusivamente de cor.

⸻

32. Contrato de estados

Os estados devem possuir comportamento previsível.

Exemplo:

default
→ usuário interage
→ pressed
→ ação
→ loading
→ success / error

Quando aplicável.

⸻

33. Dados desatualizados

Componentes que apresentam dados sujeitos a atualização devem permitir indicação de:

stale
updated

Isso é especialmente importante para:

* resultados;
* mercado;
* notícias;
* estatísticas;
* informações financeiras.

⸻

34. Reutilização

O mesmo componente deve ser utilizado em diferentes telas sempre que a necessidade for equivalente.

A diferença de contexto deve ser resolvida preferencialmente por:

* propriedades;
* variantes;
* composição;
* slots;
* configuração.

Não criar cópias independentes.

⸻

35. Variantes

Variantes devem representar diferenças reais de comportamento ou contexto.

Não criar variantes apenas para acomodar pequenas diferenças visuais que poderiam ser resolvidas por tokens.

⸻

36. Componentes específicos versus genéricos

Um componente genérico deve ser criado quando:

* existe necessidade recorrente;
* possui responsabilidade bem definida;
* pode ser reutilizado;
* não contém regra específica de uma única tela.

Um componente BRDATA Product Pattern deve ser utilizado quando representa um conceito próprio do produto.

⸻

37. Matriz componente × tela

Os componentes devem ser relacionados às 19 telas definidas na matriz mobile.

A matriz deve permitir identificar:

* componentes reutilizados;
* componentes prioritários;
* lacunas;
* duplicações;
* dependências.

⸻

38. Telas contempladas

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

39. Padrões de composição

O Design System deve permitir composições recorrentes.

Exemplos:

Section Header
+
List
+
PlayerCard

ou:

Section Header
+
Stat/KPI
+
FinancialSummary

ou:

App Bar
+
Tabs
+
Content

A composição deve ser orientada ao contexto da tela.

⸻

40. Não duplicação

Antes de criar qualquer novo componente, verificar:

1. se já existe componente equivalente;
2. se existe primitiva aplicável;
3. se existe padrão BRDATA;
4. se uma variante resolve;
5. se a criação é realmente necessária.

⸻

41. Responsive Patterns

Os componentes devem ser classificados conforme seu comportamento responsivo.

Possibilidades:

Reflow

O conteúdo reorganiza sua posição.

Stack

Elementos passam de horizontal para vertical.

Collapse

Conteúdo secundário é reduzido ou ocultado.

Progressive Disclosure

Informações secundárias aparecem mediante interação.

Scroll controlado

Utilizado apenas quando o conteúdo realmente exige navegação horizontal.

⸻

42. Regra para tabelas

Tabelas densas não devem simplesmente ser comprimidas.

No mobile, avaliar:

* redução de colunas;
* agrupamento;
* expansão;
* cards;
* priorização de informação;
* navegação contextual.

A LeagueTable deve ser tratada como padrão específico do produto.

⸻

43. Interaction Patterns

Interações devem possuir feedback consistente.

Exemplos:

* toque;
* seleção;
* confirmação;
* loading;
* erro;
* sucesso;
* mudança de estado.

O feedback deve seguir M3.

⸻

44. Acessibilidade e interação

Acessibilidade deve ser considerada desde o contrato do componente.

Não criar primeiro a versão visual e adicionar acessibilidade posteriormente.

⸻

45. Inventário

O inventário da S3.2 deve servir como fonte para identificar:

* componentes existentes;
* componentes necessários;
* componentes duplicados;
* componentes incompletos;
* componentes candidatos à evolução.

⸻

46. Contratos

Os contratos devem impedir que componentes assumam responsabilidades indevidas.

Exemplo:

TransferCard

pode exibir:

fee
salary
status
player
club

mas não deve executar:

calculateTransferScore()
calculateValuation()
negotiateOffer()

Essas responsabilidades pertencem aos sistemas de negócio.

⸻

47. Estado de implementação

As etapas da S3.2 foram organizadas da seguinte forma:

Etapa	Nome	Resultado	Status
S3.2.1	Inventário de Componentes	Mapeamento/classificação	Concluído — PM
S3.2.2	Contratos de Componentes	Contratos/responsabilidades	Concluído — PM
S3.2.3	Componentes BRDATA	Definição de componentes proprietários	Concluído — PM
S3.2.4	Matriz Componente × Tela	Mapeamento das 19 telas	Concluído — PM
S3.2.5	Responsive Patterns	Comportamento responsivo	Concluído — PM
S3.2.6	Accessibility & Interaction Patterns	Acessibilidade/interação	Concluído — PM
S3.2.7	S4 Readiness Review	Auditoria da implementação atual	Pendente de execução

⸻

48. Natureza das etapas S3.2.1 — S3.2.6

As etapas:

S3.2.1
S3.2.2
S3.2.3
S3.2.4
S3.2.5
S3.2.6

são atividades de especificação e documentação do PM.

Não geram, por si só, demanda de desenvolvimento.

Seu resultado é utilizado como base para a avaliação e implementação posterior.

⸻

49. S3.2.7 — Readiness Review

A S3.2.7 é a etapa responsável por avaliar a implementação real existente.

Seu objetivo é determinar se a fundação e os componentes possuem maturidade suficiente segundo os critérios estabelecidos.

A etapa deve avaliar:

* Foundation;
* Components;
* Contracts;
* Responsive;
* Accessibility;
* cobertura das telas;
* regressões;
* testes;
* gaps;
* divergências;
* riscos.

⸻

50. Resultado possível da Readiness Review

A avaliação deverá produzir um dos seguintes resultados:

APPROVED
ADJUSTMENTS REQUIRED
BLOCKED

APPROVED

A implementação atende aos critérios definidos.

ADJUSTMENTS REQUIRED

Existem ajustes necessários antes da aprovação.

BLOCKED

Existe impedimento relevante que impede a aprovação.

⸻

51. Retorno obrigatório do Dev

Após executar a avaliação solicitada, Claude deve retornar:

REVISÃO DO PM NECESSÁRIA

O relatório deve conter:

* status por categoria;
* evidências;
* testes;
* gaps;
* divergências;
* riscos;
* arquivos alterados;
* arquivos criados;
* arquivos removidos;
* recomendação.

⸻

52. Regra de aprovação

A implementação técnica não representa aprovação.

O PM deve validar o retorno do Dev.

Somente após a aprovação formal do PM o Handoff pode ser atualizado para refletir a conclusão.

⸻

53. Regra de commit

A regra geral do projeto é:

Aprovação formal do PM + Handoff atualizado = autorização para commit.

Se:

APPROVED

o PM atualiza o Handoff e o commit final fica autorizado.

Se:

ADJUSTMENTS REQUIRED

o PM registra os ajustes no Handoff e o commit permanece não autorizado.

Se:

BLOCKED

o PM registra o bloqueio e o commit permanece não autorizado.

⸻

54. Preservação da funcionalidade

A evolução do Design System não deve remover ou alterar funcionalidades existentes.

Alterações visuais e de interação não devem alterar regras de:

* mercado;
* contratos;
* partidas;
* economia;
* jogadores;
* evolução;
* persistência.

⸻

55. Fora de escopo

Esta especificação não autoriza:

* reconstrução completa do frontend;
* alteração de backend;
* mudança de regras de negócio;
* criação de novos engines;
* refatoração arquitetural oportunista;
* alteração do Match Engine;
* alteração do Transfer Engine;
* alteração da Economy;
* alteração da persistência.

⸻

56. Critérios de qualidade

Os componentes devem apresentar:

* consistência;
* previsibilidade;
* reutilização;
* acessibilidade;
* responsividade;
* integração com tokens;
* aderência ao M3;
* baixo acoplamento com regras de negócio.

⸻

57. Definition of Done

A S3.2 será considerada tecnicamente madura quando:

* inventário estiver definido;
* contratos estiverem definidos;
* componentes BRDATA estiverem definidos;
* matriz componente × tela estiver definida;
* responsive patterns estiverem definidos;
* accessibility patterns estiverem definidos;
* implementação atual tiver sido auditada;
* gaps tiverem sido identificados;
* regressões tiverem sido avaliadas;
* documentação estiver atualizada.

A conclusão da documentação não equivale à aprovação da implementação.

⸻

58. Resultado esperado

A S3.2 deve fornecer uma arquitetura clara para que o BRDATA evolua suas interfaces sem criar componentes duplicados, regras de negócio dentro da camada visual ou padrões incompatíveis com Material Design 3.

O resultado esperado é:

Design System consistente
+
Componentes reutilizáveis
+
Contratos claros
+
Responsividade
+
Acessibilidade
+
Padrões BRDATA
+
Aderência ao M3

⸻

59. Princípio final

Componentes devem resolver problemas de interface. Regras de negócio devem continuar nos sistemas de negócio.

O Design System deve servir ao produto sem assumir o controle da arquitetura funcional do jogo.

⸻

60. Adendo — PlayerCard formalizado (S3-DS20-S4-PREP-002)

Adendo, não reescrita: as seções 1-59 acima permanecem como a
especificação original. Este adendo registra que o BRDATA Product
Pattern **PlayerCard** (§23-24, §46) já está implementado — não é
trabalho novo, é reconhecimento formal de código existente.

60.1 Implementação

PlayerCard = `playerRow()` (`public/js/carreira.js`), com contrato
completo (Nome/Objetivo/Responsabilidade/Entradas/Saídas-eventos/
Estados/Variações/Responsividade/Acessibilidade/Dependências, formato
da seção 7) documentado como comentário imediatamente acima da função.

60.2 Pontos de uso reais (confirmados por busca literal no código, não
presumidos)

1. Elenco (`renderElenco()`) — gestão completa do próprio elenco.
2. Treino — roster completo do elenco (`trainingRosterList`).
3. `openClubRoster()` — elenco somente-leitura de outro clube (mesmo
   fluxo usado por `S3-DS20-S4-PREP-001` como ponto de validação do
   Dialog).

60.3 Divergência registrada em relação à especificação original da
demanda

A especificação de `S3-DS20-S4-PREP-002` (`docs/HANDOFF_CLAUDE.md`)
citava como um dos 3 pontos de uso o "roster overlay de ajuste de
escalação" (`carreira.js:5448`). Inspeção direta do código mostrou que
isso está incorreto: `openAdjustLineupModal()` não renderiza uma lista
própria — ele move o nó DOM existente de `#panel-escalacao`
(`renderEscalacao()`) pra dentro do modal, e essa tela não usa
`playerRow()`. O ponto de uso real que a especificação não capturou é
o roster completo da tela **Treino**. O total continua sendo 3 pontos
de uso, só o conjunto exato mudou — divergência registrada aqui
conforme `docs/README.md` regra 4 ("nunca assumir que o código está
correto" vale nos dois sentidos: aqui foi a especificação, não o
código, que precisou de correção).

60.4 Estados não contemplados (fora de escopo desta demanda)

`playerRow()` não tem estado "loading" próprio nem atributos ARIA
explícitos — ambos são gaps já conhecidos (S3.2.7) e ficam para a
execução geral de acessibilidade da S4, não para esta demanda
(formalização de contrato, sem mudança funcional).
