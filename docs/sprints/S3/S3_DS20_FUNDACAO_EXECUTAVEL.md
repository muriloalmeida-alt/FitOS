S3 — BRDATA Design System 2.0

S3.1 — Fundação Executável

Documento: S3_DS20_FUNDACAO_EXECUTAVEL.md
Sprint: S3 — BRDATA Design System 2.0
Fase: S3.1 — Fundação
Status: PRONTO PARA IMPLEMENTAÇÃO
Prioridade: P0
Responsável pela especificação: PM
Implementação: Claude
Validação: PM

⸻

1. Objetivo

Estabelecer a fundação executável do BRDATA Design System 2.0, criando uma camada visual e comportamental consistente para suportar a evolução do produto, especialmente o redesign mobile da Sprint S4.

A fundação deve organizar:

* tokens;
* tipografia;
* espaçamento;
* cores;
* elevação;
* bordas;
* ícones;
* primitivas;
* componentes fundamentais;
* estados;
* acessibilidade;
* padrões necessários para evolução posterior.

O objetivo não é reconstruir o frontend inteiro.

A implementação deve evoluir o sistema existente de forma incremental, preservando funcionalidades e arquitetura já existentes.

⸻

2. Princípio central

O BRDATA deve utilizar o Material Design 3 (M3) como autoridade visual e comportamental.

A regra é:

O BRDATA adapta e configura o Material Design 3; não cria um sistema visual paralelo para substituí-lo.

Sempre que o M3 possuir orientação oficial para determinado elemento, essa orientação deve prevalecer.

Quando o M3 oferecer opções, o BRDATA deve escolher a alternativa adequada ao produto e documentar a decisão.

Quando houver necessidade específica não coberta pelo M3, o elemento deve ser classificado como uma extensão do BRDATA.

⸻

3. Classificação das decisões de Design

Toda decisão relevante de Design System deve ser enquadrada em uma das seguintes categorias.

3.1 M3 Official

Elemento ou comportamento diretamente baseado na especificação oficial do Material Design 3.

Exemplos:

* princípios de interação;
* estados;
* componentes;
* acessibilidade;
* comportamento de controles.

⸻

3.2 M3 Configured

Elemento baseado no M3, mas configurado para a identidade visual do BRDATA.

Exemplos:

* cores;
* tipografia;
* shape;
* tonalidade;
* densidade;
* aplicação dos componentes.

⸻

3.3 BRDATA Extension

Elemento criado especificamente para uma necessidade do BRDATA que não é coberta adequadamente pelo M3.

Deve ser utilizado com parcimônia.

⸻

3.4 BRDATA Product Pattern

Composição específica do produto formada a partir de componentes M3 e/ou extensões BRDATA.

Exemplos:

* PlayerCard;
* MatchCard;
* LeagueTable;
* TransferCard;
* ContractCard;
* FinancialSummary.

Esses padrões representam necessidades de produto, não uma substituição do M3.

⸻

4. Diretriz de evolução

A fundação deve ser criada seguindo a ordem:

Tokens
   ↓
Primitivas
   ↓
Componentes
   ↓
Padrões de produto
   ↓
Telas

Não iniciar o redesign das telas antes de possuir uma base suficientemente consistente de tokens e componentes.

⸻

5. Identidade visual

A identidade do BRDATA deve preservar a associação com:

* futebol;
* Campeonato Brasileiro;
* dados;
* performance;
* tecnologia;
* competição.

A linguagem visual deve utilizar como base:

* navy;
* branco;
* cinza escuro;
* amarelo/dourado;
* acentos relacionados ao futebol.

A identidade futebolística deve estar presente sem transformar a interface em uma composição excessivamente decorativa.

⸻

6. Tokens de cor

Os tokens devem ser semânticos.

O código de produto não deve depender diretamente de valores hexadecimais espalhados pela aplicação quando o valor representar uma função semântica.

6.1 Background

bg.canvas
bg.surface
bg.surfaceElevated

bg.canvas

Fundo principal da aplicação.

bg.surface

Superfície padrão para cards, listas e agrupamentos de conteúdo.

bg.surfaceElevated

Superfície com maior destaque hierárquico ou elevação.

⸻

7. Tokens de borda

border.default
border.strong

border.default

Utilizado para separação visual padrão.

border.strong

Utilizado quando uma separação mais evidente for necessária.

Bordas não devem ser utilizadas indiscriminadamente para criar hierarquia quando elevação, espaçamento ou contraste já forem suficientes.

⸻

8. Tokens de texto

text.primary
text.secondary
text.muted

text.primary

Informação principal e conteúdo prioritário.

text.secondary

Informação complementar.

text.muted

Metadados, informações auxiliares e conteúdos de menor prioridade.

A hierarquia não deve depender exclusivamente de cor.

⸻

9. Tokens de marca

brand.primary
brand.strong
accent.football

brand.primary

Cor principal da identidade BRDATA.

brand.strong

Variação de maior destaque da cor de marca.

accent.football

Cor/acento utilizado para representar a identidade futebolística quando apropriado.

⸻

10. Tokens de estado

state.success
state.warning
state.danger
state.info

Os estados devem ser utilizados semanticamente.

Exemplos:

* success: sucesso, conclusão, resultado positivo;
* warning: atenção, risco ou informação que requer observação;
* danger: erro, bloqueio ou situação crítica;
* info: informação contextual.

Regra de acessibilidade

Nunca utilizar apenas a cor para comunicar um estado.

Sempre que necessário, combinar:

* cor;
* texto;
* ícone;
* posição;
* padrão visual;
* ou outro indicador perceptível.

⸻

11. Espaçamento

A escala base deve utilizar:

4
8
12
16
24
32
48
64

A utilização deve ser consistente e baseada em tokens.

Evitar valores arbitrários espalhados pelo código.

A escala deve servir para:

* padding;
* margin;
* gap;
* composição;
* espaçamento entre seções;
* distância entre elementos;
* densidade das telas.

⸻

12. Tipografia

A hierarquia tipográfica deve possuir níveis semânticos claros.

Categorias:

Display
Title
Section
Body
Small
Caption

Display

Utilizado para informação de grande destaque.

Exemplos:

* placar;
* indicador principal;
* informação de alto impacto.

⸻

Title

Utilizado para títulos principais de telas ou áreas.

⸻

Section

Utilizado para títulos de seções e agrupamentos.

⸻

Body

Utilizado para conteúdo principal.

⸻

Small

Utilizado para informações secundárias compactas.

⸻

Caption

Utilizado para metadados e informações auxiliares.

⸻

13. Regras tipográficas

A hierarquia deve ser perceptível sem depender apenas da cor.

Deve existir diferenciação adequada por:

* tamanho;
* peso;
* espaçamento;
* posição;
* contexto.

A tipografia deve continuar legível em dispositivos móveis e com aumento de tamanho do texto.

⸻

14. Radius

O sistema deve possuir uma escala de radius consistente.

O valor escolhido deve ser centralizado nos tokens do Design System.

Componentes não devem criar valores arbitrários sem justificativa.

O radius deve contribuir para a hierarquia visual e manter coerência entre:

* cards;
* botões;
* campos;
* chips;
* dialogs;
* bottom sheets;
* containers.

⸻

15. Elevação

O sistema deve possuir uma escala de elevação coerente com Material Design 3.

A elevação deve ser utilizada para estabelecer hierarquia entre superfícies.

Evitar utilizar sombra apenas como elemento decorativo.

A combinação de:

* superfície;
* contraste;
* borda;
* elevação;
* espaçamento

deve determinar a hierarquia visual.

⸻

16. Ícones

Deve existir uma biblioteca principal de ícones.

Não devem ser utilizadas múltiplas bibliotecas sem justificativa.

Diretrizes

* ícones outline como padrão;
* tamanhos semânticos;
* 16 px;
* 20 px;
* 24 px;
* área de toque maior que o glyph;
* labels acessíveis quando necessário;
* consistência visual;
* não utilizar emoji como substituto de ícone de interface.

⸻

17. Área de toque

Elementos interativos devem possuir uma área de toque confortável.

O tamanho visual do ícone não deve ser confundido com a área interativa.

Especialmente em mobile:

touch target > glyph

O objetivo é reduzir erros de interação.

⸻

18. Primitivas

A fundação deve contemplar as seguintes primitivas.

18.1 Text

Responsável pela aplicação consistente da hierarquia tipográfica.

⸻

18.2 Surface

Responsável pela aplicação consistente das superfícies.

⸻

18.3 Divider

Responsável pela separação visual entre conteúdos quando necessária.

⸻

18.4 Icon

Abstração para utilização consistente da biblioteca de ícones.

⸻

18.5 Button

Ação principal ou secundária.

Deve contemplar os estados definidos pelo sistema.

⸻

18.6 IconButton

Ação representada exclusivamente por ícone.

Deve possuir acessibilidade adequada.

⸻

18.7 Badge

Indicação compacta de estado ou informação.

⸻

18.8 Chip

Elemento compacto para filtros, categorias ou informações contextuais.

⸻

18.9 Avatar / Club Crest Container

Container padronizado para:

* avatar;
* escudo;
* identificação visual de clube.

⸻

18.10 Input / Select

Controles de entrada e seleção.

Devem contemplar estados e feedback de validação.

⸻

18.11 Progress / Indicator

Indicadores de:

* progresso;
* carregamento;
* processamento;
* estado.

⸻

18.12 Skeleton

Representação de carregamento estrutural.

Deve preservar a percepção do layout final sem apresentar conteúdo incorreto.

⸻

19. Componentes P0

Os componentes abaixo devem ser considerados prioritários para a evolução do Design System.

Navegação

* App Bar / Header;
* Bottom Navigation;
* Tabs;
* Back Action.

⸻

Estrutura

* Card;
* List Item;
* Section Header;
* Stat / KPI.

⸻

Estados

* Empty State;
* Loading / Skeleton;
* Inline Error;
* Snackbar / Toast.

⸻

Ações

* Button;
* Icon Button.

⸻

Sobreposição

* Dialog;
* Bottom Sheet.

⸻

20. Componentes específicos BRDATA

Os seguintes componentes representam padrões de produto do BRDATA.

PlayerCard
MatchCard
LeagueTable
TransferCard
ContractCard
FinancialSummary

Eles devem reutilizar os componentes fundamentais do Design System.

Não devem criar estilos independentes que entrem em conflito com a fundação.

⸻

21. PlayerCard

Responsável por representar um jogador de maneira consistente.

Pode contemplar:

* identificação;
* posição;
* overall;
* atributos relevantes;
* clube;
* status;
* informações contratuais quando aplicável.

A composição exata deve ser definida conforme a tela e o contexto.

⸻

22. MatchCard

Responsável por representar uma partida.

Pode contemplar:

* clubes;
* escudos;
* data;
* horário;
* placar;
* status;
* competição;
* indicadores contextuais.

⸻

23. LeagueTable

Responsável pela representação da classificação.

Deve priorizar:

* leitura rápida;
* hierarquia;
* posição;
* clube;
* pontos;
* indicadores relevantes.

No mobile, a informação deve ser organizada para evitar excesso de largura.

⸻

24. TransferCard

Responsável por representar uma oportunidade ou movimentação de mercado.

Pode contemplar:

* jogador;
* clube;
* valor;
* status;
* contexto;
* ação disponível.

⸻

25. ContractCard

Responsável por representar informações contratuais.

Pode contemplar:

* jogador;
* clube;
* salário;
* duração;
* status;
* proximidade do vencimento;
* ações disponíveis.

⸻

26. FinancialSummary

Responsável pela representação resumida das finanças.

Pode contemplar:

* saldo;
* receitas;
* despesas;
* orçamento;
* indicadores relevantes.

Deve priorizar leitura rápida.

⸻

27. Estados obrigatórios

Os componentes interativos devem considerar, quando aplicável:

default
focus
pressed
disabled
loading
error

Componentes de dados devem considerar adicionalmente:

empty
success
stale
updated

Nem todo componente precisa necessariamente implementar todos os estados, mas a ausência de um estado deve ser uma decisão consciente.

⸻

28. Estado Default

Representação normal do componente.

Deve ser claramente identificável como estado disponível para interação ou leitura.

⸻

29. Estado Focus

Deve existir indicação clara de foco quando aplicável.

Especialmente importante para:

* teclado;
* navegação assistiva;
* acessibilidade.

O foco não deve depender exclusivamente de cor.

⸻

30. Estado Pressed

Representa a interação ativa do usuário.

Deve fornecer feedback perceptível.

⸻

31. Estado Disabled

Representa uma ação indisponível.

O componente deve comunicar claramente que a ação não está disponível.

Não utilizar somente redução de opacidade como único mecanismo de comunicação.

⸻

32. Estado Loading

Representa processamento ou carregamento.

Quando apropriado, utilizar Skeleton ou indicador de progresso.

Evitar mudanças bruscas de layout.

⸻

33. Estado Error

Deve comunicar:

* o que aconteceu;
* quando possível, como corrigir;
* qual ação está disponível.

O erro deve ser perceptível sem depender somente da cor.

⸻

34. Estado Empty

Utilizado quando não existe conteúdo para exibir.

Deve diferenciar:

não há dados

de:

dados ainda estão carregando

e:

ocorreu um erro

⸻

35. Estado Success

Utilizado quando uma operação foi concluída com sucesso.

O feedback deve ser proporcional à importância da ação.

⸻

36. Estado Stale / Updated

Componentes de dados podem indicar quando uma informação:

* está atualizada;
* foi atualizada recentemente;
* pode estar desatualizada.

Essa diferenciação é especialmente importante para dados esportivos.

⸻

37. Acessibilidade

A acessibilidade é requisito de aceitação da fundação.

Não deve ser tratada como atividade posterior.

⸻

38. Requisitos de acessibilidade

A implementação deve contemplar:

* foco visível quando aplicável;
* contraste suficiente;
* informação não dependente exclusivamente de cor;
* áreas de toque confortáveis;
* labels acessíveis;
* ordem lógica de leitura;
* suporte a aumento de tamanho do texto;
* ausência de perda de conteúdo com redimensionamento;
* feedback perceptível para erro e sucesso.

⸻

39. Leitura por tecnologia assistiva

Elementos relevantes devem possuir nomes e papéis compreensíveis para tecnologias assistivas.

Ícones sem texto visível devem possuir label acessível quando forem interativos.

Informações decorativas não devem criar ruído desnecessário.

⸻

40. Responsividade

A fundação deve preparar o BRDATA para uma abordagem mobile-first.

O objetivo não é simplesmente reduzir a interface desktop.

A estrutura deve permitir:

* adaptação de layout;
* reorganização de conteúdo;
* mudança de densidade;
* navegação adequada;
* componentes responsivos;
* preservação de legibilidade.

⸻

41. Relação com S4

A fundação S3.1 deve preparar a execução da Sprint S4 — Redesign Mobile.

A S4 utilizará:

tokens
↓
primitivas
↓
componentes
↓
padrões
↓
telas mobile

A fundação não autoriza automaticamente o início da S4.

A maturidade da implementação deve ser avaliada posteriormente no processo de readiness.

⸻

42. Preservação da implementação existente

A execução deve seguir o princípio:

Evolução incremental, não reconstrução indiscriminada.

Antes de alterar qualquer componente:

1. inspecionar a implementação existente;
2. identificar o que já existe;
3. mapear dependências;
4. preservar comportamento atual;
5. realizar a menor alteração necessária;
6. testar;
7. validar persistência e funcionamento;
8. documentar.

⸻

43. O que NÃO faz parte da S3.1

Está fora do escopo:

* alteração de regras de negócio;
* alteração do Transfer AI;
* alteração do Match Engine;
* implementação do Economy Engine;
* criação de novos sistemas de jogo;
* reconstrução completa do frontend;
* redesign desktop independente;
* mudanças de API/backend sem necessidade direta para a fundação;
* refatoração arquitetural oportunista;
* alteração de regras de mercado;
* alteração de contratos;
* alteração de evolução de jogadores;
* alteração de scouting.

⸻

44. Regra contra regressão

Nenhuma funcionalidade existente deve ser removida ou alterada funcionalmente apenas para facilitar a implementação visual.

O redesign deve alterar:

* apresentação;
* composição;
* hierarquia;
* interação visual;
* responsividade;

sem alterar regras de negócio existentes.

⸻

45. Regra contra sistemas paralelos

Não criar:

* segundo sistema de tokens;
* segunda biblioteca de ícones;
* segunda hierarquia tipográfica;
* componentes duplicados;
* estilos paralelos sem justificativa.

Antes de criar algo novo, verificar se existe uma solução existente reutilizável.

⸻

46. Implementação mínima esperada

Claude deve primeiro auditar a implementação atual.

A implementação deve priorizar:

1. tokens;
2. primitivas;
3. componentes fundamentais;
4. estados;
5. acessibilidade;
6. componentes BRDATA prioritários.

A ordem exata de implementação pode ser ajustada caso a arquitetura existente exija outra sequência, desde que a alteração seja justificada e documentada.

⸻

47. Validação

Ao finalizar a implementação, Claude deve retornar ao PM com:

* arquivos alterados;
* arquivos criados;
* arquivos removidos, se houver;
* componentes implementados;
* tokens implementados;
* estados implementados;
* validações de acessibilidade;
* testes executados;
* resultados dos testes;
* possíveis divergências;
* riscos identificados;
* limitações;
* pontos que exigem decisão do PM.

⸻

48. Critérios de aceite

A S3.1 será considerada tecnicamente pronta para revisão quando:

Fundação

* tokens estiverem centralizados;
* cores semânticas estiverem disponíveis;
* espaçamento estiver centralizado;
* tipografia possuir hierarquia;
* radius estiver padronizado;
* elevação estiver padronizada;
* ícones estiverem centralizados.

Componentes

* componentes P0 necessários estiverem disponíveis;
* componentes utilizarem os tokens;
* componentes não criarem padrões paralelos desnecessários;
* estados relevantes estiverem contemplados.

BRDATA

* PlayerCard estiver compatível com a fundação;
* MatchCard estiver compatível;
* LeagueTable estiver compatível;
* TransferCard estiver compatível;
* ContractCard estiver compatível;
* FinancialSummary estiver compatível.

Acessibilidade

* foco estiver contemplado;
* contraste estiver adequado;
* informação não depender apenas de cor;
* áreas de toque forem adequadas;
* labels acessíveis estiverem disponíveis;
* ordem de leitura for coerente;
* aumento de texto não destruir a interface.

Produto

* funcionalidades existentes forem preservadas;
* nenhuma regra de negócio for alterada;
* a fundação estiver preparada para utilização no mobile;
* não houver regressões conhecidas.

⸻

49. Material Design 3

A implementação deve consultar a documentação oficial e atual do Material Design 3 sempre que existir orientação aplicável.

O BRDATA não deve copiar a documentação do M3 para dentro do projeto.

A documentação do projeto deve registrar apenas:

* decisões específicas do BRDATA;
* configurações escolhidas;
* extensões;
* padrões de produto;
* divergências justificadas.

A referência oficial continua sendo o M3.

⸻

50. Divergências

Caso a implementação existente do BRDATA entre em conflito com a orientação do M3:

1. identificar a divergência;
2. registrar;
3. avaliar impacto;
4. propor solução;
5. não criar uma regra paralela sem justificativa.

Divergências relevantes devem retornar para validação do PM.

⸻

51. Definition of Done da implementação

A implementação técnica somente estará pronta para avaliação quando:

* código implementado;
* testes executados;
* regressões avaliadas;
* estados verificados;
* acessibilidade verificada;
* comportamento mobile avaliado;
* documentação técnica atualizada;
* divergências registradas;
* riscos registrados;
* retorno formal enviado ao PM.

O término da implementação não significa aprovação da fase.

⸻

52. Fluxo de aprovação

Após concluir a implementação:

Claude implementa
       ↓
Claude testa
       ↓
Claude documenta
       ↓
Claude retorna
"REVISÃO DO PM NECESSÁRIA"
       ↓
PM valida
       ↓
┌─────────────────────────────┐
│                             │
↓                             ↓
APROVADO                 AJUSTES NECESSÁRIOS
│                             │
↓                             ↓
PM atualiza Handoff       PM atualiza Handoff
│                             │
↓                             ↓
Commit autorizado        Commit não autorizado

A aprovação do PM é obrigatória.

⸻

53. Regra de commit

A implementação não deve ser considerada formalmente concluída apenas porque o código foi executado ou testado.

A autorização para commit final depende de:

Aprovação formal do PM + Handoff atualizado = autorização para commit.

Se o resultado da revisão for:

APROVADO

o PM atualiza o HANDOFF_CLAUDE.md e o commit final fica autorizado.

Se o resultado for:

AJUSTES NECESSÁRIOS

o PM atualiza o Handoff com os ajustes e o commit final permanece não autorizado.

Se o resultado for:

BLOQUEADO

o PM registra o bloqueio no Handoff e o commit final permanece não autorizado.

⸻

54. Resultado esperado

Ao final da S3.1, o BRDATA deverá possuir uma fundação de Design System capaz de sustentar a evolução visual do produto sem criar um sistema paralelo ao Material Design 3.

A fundação deverá permitir que as próximas telas sejam construídas de maneira:

* consistente;
* responsiva;
* acessível;
* escalável;
* reutilizável;
* orientada a tokens;
* alinhada ao M3;
* coerente com a identidade BRDATA.

⸻

55. Demanda oficial

ID: S3-DS2-FND-001
Nome: BRDATA DS 2.0 — Fundação Executável
Status: READY FOR IMPLEMENTATION
Sprint: S3
Fase: S3.1
Prioridade: P0

Objetivo da demanda

Implementar a fundação executável do BRDATA Design System 2.0 conforme este documento, preservando a implementação existente e preparando o produto para sua evolução mobile.

Resultado esperado

Uma fundação visual e comportamental reutilizável, baseada em Material Design 3, com tokens, primitivas, componentes P0, estados e requisitos de acessibilidade implementados de forma consistente.

Próximo retorno obrigatório do Dev

Claude deverá retornar:

REVISÃO DO PM NECESSÁRIA

acompanhado do relatório técnico da implementação, testes, divergências, riscos e arquivos alterados.

A conclusão formal da demanda depende da validação do PM.
