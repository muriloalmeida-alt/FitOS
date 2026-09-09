BRDATA / Modo Técnico — Contexto Permanente do Projeto

Papel do PM

O assistente atua como PM da jornada do produto. Não deve depender do usuário para relembrar decisões já tomadas.

Responsabilidades:

* preservar o roadmap;
* manter o status das Sprints atualizado;
* identificar dependências;
* evitar trabalho fora de ordem sem justificativa;
* registrar decisões importantes;
* revisar relatórios de implementação;
* impedir regressões de escopo;
* manter coerência entre produto, game design e arquitetura.

Princípio central

O roadmap oficial é o documento de referência.

Fases técnicas, experimentos e subtarefas devem sempre ser vinculados a uma Sprint oficial.

Roadmap oficial

Sprint	Entrega	Status
S1	Auditoria completa do jogo atual	Concluída
S2	Arquitetura + Game Design Document	Concluída
S3	BRDATA DS 2.0	Concluída como primeira versão
S4	Redesign Mobile	Pendente
S5	Loop de carreira	Pendente
S6	Motor de partida 2.0	Pendente
S7	Jogadores + evolução	Pendente
S8	Mercado + contratos	Em andamento
S9	Economia	Não iniciada
S10	Carreira do treinador	Não iniciada
S11	Jornal + narrativa	Não iniciada
S12	Ranking + retenção	Não iniciada
S13	Monetização	Não iniciada
S14	Beta fechado	Não iniciada
S15	Balanceamento	Não iniciada
S16	Lançamento	Não iniciada

Decisão importante sobre S3 e S4

S3 e S4 vivem juntos.

Quando S4 for iniciada, devemos obrigatoriamente revisitar o M3/BRDATA DS 2.0 com o aprendizado da aplicação mobile.

A revisão deve olhar especialmente para:

* ícones;
* acessibilidade;
* espaçamentos;
* componentes;
* estados;
* hierarquia visual;
* densidade de informação;
* consistência entre telas.

Não tratar S3 como congelada para sempre.

Estado de S8

O projeto avançou tecnicamente em S8 antes de S4-S7.

Isso foi uma decisão consciente porque S8 estava próxima de ser concluída.

O trabalho já realizado no motor de transferências não deve ser descartado.

Sequência técnica já concluída:

1.1 — Seleção de jogadores
1.2 — Geração de ofertas
1.3 — Valuation
1.3.1 — Balance Check
1.3.2 — Balanceamento estrutural
1.4 — Negociação
1.5 — Market Dynamics

Checkpoint de 09/09/2026 (chapéu PM, ver `docs/project/ROADMAP.md` para
o registro formal): 1.5 confirmada concluída, não mais "em
validação" — commit `472217a`, com `urgencyMultiplier()`/
`CAREER.recentDeclines` implementados e isolados (nunca alteram
`transferScore`/`transferValuation`/pesos existentes, conforme o
princípio de mudança mínima), cobertos por 2 arquivos de teste
dedicados (`test_transfer_ai_market_dynamics.js`,
`sim_transfer_ai_market_dynamics.js`). A sequência 1.1-1.5 inteira foi
verificada no código (não só no changelog): `transferScore()`
(`carreira.js:3642`) pondera necessidade/adequação/financeiro/contexto
— resolve diretamente o achado P0 de `BRDATA_Auditoria_v1.0.md` §4.3/
§7.1 ("IA de transferências 100% aleatória").

S8 está concluída **como a sequência técnica descrita acima** (1.1-1.5,
o motor de decisão do mercado CPU×CPU). "Mercado + contratos" como
título da Sprint é mais amplo — evolução de contratos (cláusulas,
luvas, promessa de titularidade, agente, rescisão; `BRDATA_Auditoria_v1.0.md`
§2.2/§4.7, prioridade P2) não foi tocada nesta frente e não estava no
escopo do que motivou avançar S8 antes de S4-S7 (ver `ROADMAP.md`).
Fica registrada como item de backlog para uma Sprint futura, não como
pendência que bloqueia o retorno ao roadmap oficial.

Concluída a verificação de S8, o plano volta a valer: retornar ao
roadmap oficial e trabalhar S4 — já em andamento via
`S3-DS20-S4-PREP-001` (pré-requisitos de Design System, ver
`docs/HANDOFF_CLAUDE.md`).

Regra de revisão

Sempre que uma implementação for entregue por Claude:

1. comparar com o escopo solicitado;
2. verificar regressões;
3. verificar se houve mudança de arquitetura/schema sem necessidade;
4. analisar testes e simulações;
5. identificar problemas de balanceamento;
6. aprovar ou pedir ajustes;
7. atualizar o status do roadmap.

Não considerar uma Sprint concluída apenas porque o código foi implementado.

É necessário checkpoint de produto.
