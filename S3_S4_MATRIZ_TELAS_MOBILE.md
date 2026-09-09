S3 / S4 — Matriz de Telas Mobile

Documento: S3_S4_MATRIZ_TELAS_MOBILE.md
Sprint: S3 — BRDATA Design System 2.0 / S4 — Redesign Mobile
Status: Especificação consolidada
Responsável pela especificação: PM
Implementação: Claude
Validação: PM

⸻

1. Objetivo

Definir a matriz oficial de telas que deverá orientar o redesign mobile do BRDATA.

A matriz estabelece:

* telas prioritárias;
* objetivo funcional de cada tela;
* componentes esperados;
* relação com o Design System 2.0;
* prioridade de execução;
* requisitos de responsividade;
* requisitos de acessibilidade;
* critérios mínimos de aceite.

O redesign deve ser mobile-first.

Não deve ser tratado como uma simples redução das telas desktop.

⸻

2. Relação entre S3 e S4

S3 e S4 são interdependentes.

S3

Responsável pela evolução do:

BRDATA Design System 2.0

S4

Responsável pelo:

Redesign Mobile

A S3 estabelece:

Tokens
↓
Primitivas
↓
Componentes
↓
Padrões

A S4 utiliza essa base para construir:

Telas Mobile

⸻

3. Princípio Mobile-first

O mobile deve ser tratado como uma experiência própria.

Não é permitido simplesmente:

* reduzir fontes;
* diminuir cards;
* reduzir espaçamentos;
* esconder elementos;
* comprimir tabelas;

e considerar isso um redesign mobile.

A interface deve ser reorganizada considerando:

* largura reduzida;
* interação por toque;
* leitura vertical;
* prioridade de informação;
* navegação com uma mão;
* densidade adequada;
* hierarquia visual;
* feedback de interação.

⸻

4. Navegação principal

A sugestão de agrupamento da navegação mobile é:

Início
Elenco
Mercado
Partidas / Rodada
Menu

A navegação deve ser persistente quando fizer sentido para o contexto.

O padrão visual deve seguir Material Design 3 configurado para BRDATA.

⸻

5. Matriz oficial de telas

#	Tela	Prioridade
1	Login / Entrada	P0
2	Loading / Bootstrap	P0
3	Escolha do clube	P0
4	Onboarding	P1
5	Início / Dashboard	P0
6	Elenco	P0
7	Perfil do jogador	P0
8	Comparar jogadores	P1
9	Tática / Formação	P0
10	Eixos táticos	P1
11	Marcação individual	P1
12	Meus esquemas	P1
13	Treino	P0
14	Mercado	P0
15	Negociação / Proposta	P0
16	Contratos	P0
17	Resumo da rodada	P0
18	Notícias / Eventos	P1
19	Histórico / Estatísticas	P1

⸻

6. Tela 1 — Login / Entrada

Prioridade: P0

Objetivo

Permitir entrada do usuário no produto.

Requisitos

A tela deve:

* apresentar identidade BRDATA;
* possuir hierarquia visual clara;
* permitir entrada sem fricção;
* apresentar feedback de erro;
* possuir estados de loading;
* funcionar adequadamente em mobile.

Estados

* default;
* loading;
* erro;
* sucesso.

⸻

7. Tela 2 — Loading / Bootstrap

Prioridade: P0

Objetivo

Representar o carregamento inicial do produto.

Deve diferenciar claramente:

* carregamento;
* erro;
* conclusão.

Quando apropriado, utilizar Skeleton ou indicador definido pelo Design System.

⸻

8. Tela 3 — Escolha do clube

Prioridade: P0

Objetivo

Permitir ao jogador escolher o clube para iniciar a carreira.

Requisitos

A interface deve facilitar:

* busca;
* identificação dos clubes;
* visualização dos escudos;
* seleção;
* confirmação.

A seleção deve possuir feedback visual claro.

⸻

9. Tela 4 — Onboarding

Prioridade: P1

Objetivo

Apresentar ao novo jogador os principais conceitos do modo carreira.

Pode explicar:

* clube;
* elenco;
* mercado;
* partidas;
* finanças;
* objetivos.

O onboarding deve ser curto e objetivo.

⸻

10. Tela 5 — Início / Dashboard

Prioridade: P0

Objetivo

Ser o centro operacional da carreira.

Deve permitir ao usuário identificar rapidamente:

* situação do clube;
* próxima partida;
* posição na tabela;
* situação financeira;
* notícias;
* objetivos;
* alertas;
* ações prioritárias.

⸻

11. Tela 6 — Elenco

Prioridade: P0

Objetivo

Permitir gerenciamento do elenco.

Deve facilitar:

* visualização dos jogadores;
* posição;
* overall;
* condição;
* status;
* contrato;
* acesso ao perfil.

O componente PlayerCard deve ser reutilizado.

⸻

12. Tela 7 — Perfil do jogador

Prioridade: P0

Objetivo

Apresentar informações detalhadas de um jogador.

Pode contemplar:

* nome;
* posição;
* overall;
* atributos;
* idade;
* clube;
* contrato;
* salário;
* evolução;
* status.

A tela deve priorizar as informações mais importantes.

⸻

13. Tela 8 — Comparar jogadores

Prioridade: P1

Objetivo

Permitir comparação entre jogadores.

A comparação deve evitar uma tabela excessivamente larga no mobile.

As informações devem ser reorganizadas para leitura vertical ou comparação por grupos.

⸻

14. Tela 9 — Tática / Formação

Prioridade: P0

Objetivo

Permitir configuração da formação e escalação.

Deve contemplar:

* formação;
* titulares;
* reservas;
* posições;
* alterações;
* confirmação.

A representação do campo deve ser adaptada ao mobile.

⸻

15. Tela 10 — Eixos táticos

Prioridade: P1

Objetivo

Permitir configuração dos principais comportamentos táticos.

Deve utilizar controles adequados para toque.

As opções devem possuir feedback claro.

⸻

16. Tela 11 — Marcação individual

Prioridade: P1

Objetivo

Permitir definir marcações individuais.

A interface deve apresentar:

* jogador;
* alvo;
* relacionamento;
* ação;
* confirmação.

⸻

17. Tela 12 — Meus esquemas

Prioridade: P1

Objetivo

Permitir salvar e recuperar configurações táticas.

Deve contemplar:

* lista de esquemas;
* criação;
* edição;
* seleção;
* exclusão, quando aplicável.

⸻

18. Tela 13 — Treino

Prioridade: P0

Objetivo

Permitir gerenciamento do treinamento.

Deve apresentar:

* treino atual;
* opções;
* impacto esperado;
* condição dos jogadores;
* confirmação.

A informação deve ser organizada para leitura rápida.

⸻

19. Tela 14 — Mercado

Prioridade: P0

Objetivo

Ser o principal ponto de interação com o mercado de jogadores.

Deve permitir:

* visualizar oportunidades;
* buscar jogadores;
* aplicar filtros;
* visualizar valor;
* consultar contrato;
* iniciar negociação;
* identificar status.

O TransferCard deve ser utilizado quando apropriado.

⸻

20. Tela 15 — Negociação / Proposta

Prioridade: P0

Objetivo

Permitir negociação de jogadores.

Deve apresentar:

* jogador;
* clube;
* proposta;
* valor;
* salário;
* duração;
* condições relevantes;
* status;
* ações.

O fluxo deve reduzir ambiguidades.

⸻

21. Tela 16 — Contratos

Prioridade: P0

Objetivo

Permitir gerenciamento dos contratos.

Deve permitir visualizar:

* jogador;
* duração;
* salário;
* situação;
* proximidade do vencimento;
* ações disponíveis.

O ContractCard deve ser utilizado quando apropriado.

⸻

22. Tela 17 — Resumo da rodada

Prioridade: P0

Objetivo

Apresentar o resultado da rodada e permitir avanço da carreira.

Pode contemplar:

* resultado da partida;
* classificação;
* desempenho;
* finanças;
* evolução;
* eventos;
* notícias;
* objetivos.

Deve deixar claro qual é a próxima ação do usuário.

⸻

23. Tela 18 — Notícias / Eventos

Prioridade: P1

Objetivo

Apresentar acontecimentos relevantes do mundo do jogo.

Pode contemplar:

* notícias;
* eventos;
* transferências;
* acontecimentos do clube;
* acontecimentos de rivais;
* alertas relevantes.

⸻

24. Tela 19 — Histórico / Estatísticas

Prioridade: P1

Objetivo

Permitir consulta do histórico da carreira.

Pode contemplar:

* temporadas;
* resultados;
* estatísticas;
* títulos;
* desempenho;
* evolução;
* histórico financeiro;
* histórico do clube.

⸻

25. Componentes prioritários

A matriz deve utilizar prioritariamente os componentes definidos no Design System.

Principais componentes:

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
PlayerCard
MatchCard
LeagueTable
TransferCard
ContractCard
FinancialSummary

⸻

26. Regra de reutilização

Antes de criar qualquer componente novo para uma tela, verificar se:

1. já existe um componente equivalente;
2. existe uma primitiva que permita composição;
3. existe um padrão BRDATA reutilizável;
4. a necessidade realmente exige uma extensão.

A criação de componentes paralelos deve ser evitada.

⸻

27. Responsividade

Todas as telas devem funcionar adequadamente em diferentes larguras mobile.

Não deve existir:

* scroll horizontal involuntário;
* conteúdo cortado;
* CTA inacessível;
* texto sobreposto;
* componentes quebrados;
* tabelas ilegíveis.

Quando uma informação não couber horizontalmente, deve ser reorganizada.

⸻

28. Densidade de informação

O BRDATA é um produto de dados.

Portanto, interfaces densas são aceitáveis.

Porém:

densidade não pode significar desorganização.

A informação deve ser:

* agrupada;
* hierarquizada;
* escaneável;
* contextualizada.

⸻

29. Acessibilidade

Todas as telas devem considerar:

* contraste adequado;
* foco visível quando aplicável;
* labels acessíveis;
* áreas de toque adequadas;
* ordem lógica de leitura;
* suporte a aumento de texto;
* estados perceptíveis;
* informações que não dependam exclusivamente de cor.

⸻

30. Estados

Cada tela deve contemplar os estados aplicáveis:

Default
Loading
Empty
Error
Success
Disabled

Quando relevante:

Stale
Updated

Os estados fazem parte do comportamento esperado da tela e não devem ser tratados como detalhe posterior.

⸻

31. Feedback

A interface deve fornecer feedback para ações relevantes.

Exemplos:

* seleção;
* confirmação;
* salvamento;
* erro;
* carregamento;
* negociação;
* contratação;
* avanço de rodada.

O feedback deve ser proporcional à importância da ação.

⸻

32. Material Design 3

O Material Design 3 é a autoridade visual e comportamental.

O BRDATA deve:

* utilizar componentes M3 quando aplicáveis;
* configurar M3 para sua identidade;
* respeitar padrões de interação;
* respeitar acessibilidade;
* evitar criar substitutos desnecessários.

As decisões específicas do BRDATA devem ser classificadas como:

M3 Official
M3 Configured
BRDATA Extension
BRDATA Product Pattern

⸻

33. Identidade BRDATA

A identidade deve preservar:

* navy;
* branco;
* cinza escuro;
* amarelo/dourado;
* identidade futebolística.

A identidade visual não deve comprometer:

* legibilidade;
* acessibilidade;
* hierarquia;
* desempenho;
* usabilidade.

⸻

34. Ordem de execução

A implementação da matriz deve seguir batches.

Batch 1 — Foundation

Preparação e consolidação dos elementos necessários do Design System.

⸻

Batch 2 — Core

Telas centrais:

* Login;
* Bootstrap;
* Escolha do clube;
* Dashboard;
* Elenco;
* Perfil;
* Tática;
* Treino.

⸻

Batch 3 — Transactional

Fluxos transacionais:

* Mercado;
* Negociação;
* Contratos;
* Resumo da rodada.

⸻

Batch 4 — Complementary

Telas complementares:

* Onboarding;
* Comparação;
* Eixos táticos;
* Marcação individual;
* Meus esquemas;
* Notícias;
* Histórico.

⸻

Batch 5 — QA Visual / UX

Revisão transversal:

* responsividade;
* acessibilidade;
* estados;
* navegação;
* consistência;
* densidade;
* feedback;
* regressões.

⸻

35. Critérios gerais de aceite

A implementação mobile será considerada adequada quando:

Layout

* não houver zoom horizontal;
* não houver conteúdo cortado;
* a hierarquia estiver clara;
* os CTAs forem facilmente identificáveis.

Componentes

* componentes existentes forem reutilizados;
* tokens forem utilizados;
* estados forem contemplados;
* padrões paralelos não forem criados sem justificativa.

Interação

* áreas de toque forem adequadas;
* feedback estiver presente;
* navegação for consistente;
* ações críticas forem claras.

Acessibilidade

* contraste estiver adequado;
* labels existirem quando necessários;
* informação não depender somente de cor;
* texto puder ser ampliado sem perda significativa;
* ordem de leitura for lógica.

Produto

* nenhuma funcionalidade existente for removida;
* regras de negócio forem preservadas;
* comportamento funcional permanecer consistente.

⸻

36. Regra de preservação funcional

O redesign visual não deve alterar:

* regras de negócio;
* lógica de mercado;
* contratos;
* Match Engine;
* evolução;
* economia;
* persistência;

salvo quando uma alteração funcional for explicitamente especificada em uma demanda própria.

⸻

37. Fora de escopo

A matriz não autoriza:

* reconstrução do backend;
* alteração das APIs;
* alteração de regras de negócio;
* refatoração arquitetural oportunista;
* criação de novos sistemas de jogo;
* alteração do motor de partidas;
* alteração da economia;
* alteração do sistema de mercado;
* alteração do sistema de contratos.

⸻

38. Dependência S3.2

A implementação das telas deve considerar o resultado da evolução dos componentes BRDATA na S3.2.

A matriz de telas funciona como referência para:

* contratos;
* componentes;
* padrões;
* responsividade;
* acessibilidade;
* cobertura.

⸻

39. Readiness

Antes da execução ampla da S4, deve ser realizada uma avaliação da maturidade da implementação da S3.

Essa avaliação corresponde à:

S3.2.7 — S4 Readiness Review

Ela deve verificar:

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

40. Regra de aprovação

A existência desta matriz não significa aprovação automática para implementação de todas as telas.

A evolução deve respeitar os gates definidos pela governança do projeto.

O resultado da avaliação pode ser:

APPROVED
ADJUSTMENTS REQUIRED
BLOCKED

⸻

41. Definition of Done

Uma tela estará tecnicamente pronta para revisão quando:

* implementação concluída;
* componentes reutilizados;
* tokens aplicados;
* estados implementados;
* responsividade verificada;
* acessibilidade verificada;
* funcionalidades preservadas;
* testes realizados;
* regressões avaliadas;
* divergências registradas;
* documentação atualizada.

A conclusão técnica não representa aprovação do PM.

⸻

42. Resultado esperado

Ao final da execução desta matriz, o BRDATA deverá possuir uma experiência mobile consistente, moderna e funcional, baseada no Design System 2.0 e alinhada ao Material Design 3.

O resultado deve combinar:

Produto de dados + futebol + usabilidade mobile + consistência visual + acessibilidade.

A interface deve ser densa quando necessário, mas sempre organizada e escaneável.

⸻

43. Matriz resumida

Tela	Prioridade	Grupo
Login / Entrada	P0	Core
Loading / Bootstrap	P0	Core
Escolha do clube	P0	Core
Onboarding	P1	Complementar
Início / Dashboard	P0	Core
Elenco	P0	Core
Perfil do jogador	P0	Core
Comparar jogadores	P1	Complementar
Tática / Formação	P0	Core
Eixos táticos	P1	Complementar
Marcação individual	P1	Complementar
Meus esquemas	P1	Complementar
Treino	P0	Core
Mercado	P0	Transacional
Negociação / Proposta	P0	Transacional
Contratos	P0	Transacional
Resumo da rodada	P0	Transacional
Notícias / Eventos	P1	Complementar
Histórico / Estatísticas	P1	Complementar

⸻

44. Princípio final

A matriz deve ser utilizada como referência oficial para a construção mobile do BRDATA.

O princípio central é:

Não adaptar desktop para mobile. Projetar a experiência mobile usando a fundação do BRDATA Design System 2.0 e a autoridade do Material Design 3.
