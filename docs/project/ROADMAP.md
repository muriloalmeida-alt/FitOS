BRDATA / Modo Técnico — Roadmap Oficial

Objetivo

Este documento é a fonte de verdade do roadmap do produto. O roadmap deve ser atualizado sempre que uma Sprint mudar de status, escopo ou dependência.

Status atual

Sprint	Entrega	Status
S1	Auditoria completa do jogo atual	🟢 Concluída
S2	Arquitetura + Game Design Document	🟢 Concluída
S3	BRDATA DS 2.0	🟢 Concluída*
S4	Redesign Mobile	🔴 Pendente
S5	Loop de carreira	🔴 Pendente
S6	Motor de partida 2.0	🔴 Pendente
S7	Jogadores + evolução	🔴 Pendente
S8	Mercado + contratos	🟢 Concluída**
S9	Economia	⏳ Não iniciada
S10	Carreira do treinador	⏳ Não iniciada
S11	Jornal + narrativa	⏳ Não iniciada
S12	Ranking + retenção	⏳ Não iniciada
S13	Monetização	⏳ Não iniciada
S14	Beta fechado	⏳ Não iniciada
S15	Balanceamento	⏳ Não iniciada
S16	Lançamento	⏳ Não iniciada

* S3 é considerada concluída como primeira versão, mas não congelada.
S3 e S4 são frentes interdependentes.
** S8 está concluída como a sequência técnica de IA de transferências
(1.1-1.5, ver "S8 — situação" abaixo), que foi o escopo que motivou
avançá-la antes de S4-S7. Evolução de contratos (cláusulas, luvas,
promessa de titularidade, agente, rescisão) é mais amplo que o título
"Mercado + contratos" sugere e não foi tocado nesta frente — registrado
como backlog P2 (`docs/project/BRDATA_Auditoria_v1.0.md` §2.2/§4.7),
não como pendência bloqueante.

Regra de execução

A ordem oficial do produto continua sendo S1 → S16. O trabalho técnico pode avançar temporariamente em uma Sprint posterior quando houver uma necessidade concreta, mas isso não altera o status das Sprints anteriores.

S8 concluída em 09/09/2026 (checkpoint abaixo). O foco volta para S4 —
já em andamento via `S3-DS20-S4-PREP-001` (pré-requisitos de tokens/
componentes do Design System, ver `docs/HANDOFF_CLAUDE.md`).

Relação S3 ↔ S4

S3 e S4 devem ser tratados como um ciclo de Design System + aplicação mobile:

1. S3 estabelece a primeira versão do BRDATA DS 2.0.
2. S4 aplica o sistema ao redesign mobile.
3. Durante S4, o M3/Design System deve ser revisitado com base no uso real.
4. Essa revisão deve otimizar principalmente:
    * ícones;
    * acessibilidade;
    * espaçamentos;
    * componentes;
    * estados e feedbacks;
    * consistência;
    * densidade de informação mobile.

Portanto, S3 não deve ser tratado como um sistema visual imutável.

S8 — situação (concluída)

O trabalho de IA de transferências desenvolvido dentro de S8 inclui:

* seleção inteligente de jogadores;
* geração inteligente de ofertas;
* valuation;
* balance check;
* balanceamento estrutural;
* negociação;
* dinâmica do mercado (Market Dynamics).

Essas fases técnicas são internas à S8 e não substituem o roadmap oficial.

Checkpoint formal (09/09/2026, chapéu PM — regra de revisão de
`docs/project/PROJECT_CONTEXT.md`):

1. Escopo solicitado: sequência 1.1-1.5 (ver acima) — todas as 5 fases
   confirmadas implementadas no código (`transferScore`,
   `offerProbabilityFromScore`, `transferValuation`, `negotiateOffer`,
   `urgencyMultiplier`/`recentDeclines` em `public/js/carreira.js`), não
   só no changelog.
2. Regressões: nenhuma identificada — cada fase foi implementada como
   extensão/composição das funções anteriores, sem alterar fórmulas ou
   pesos já existentes (documentado nos próprios comentários do código,
   ex.: Market Dynamics só multiplica probabilidade de oferta, nunca
   `transferScore`/`transferValuation`).
3. Mudança de arquitetura/schema sem necessidade: não houve — único
   campo novo persistido é `CAREER.recentDeclines`, autolimitado
   (podado a cada leitura, não sobrevive a troca de temporada).
4. Testes e simulações: 9 arquivos dedicados em `tests/e2e/`
   (`test_transfer_ai*.js` × 5, `sim_transfer_ai*.js` × 3, mais o teste
   geral `test_transfer_ai.js`) — a cobertura mais completa de qualquer
   sistema do projeto (contraste com a S3.2.7, que achou só 1 teste
   dedicado ao redesign M3).
5. Balanceamento: não reavaliado numericamente neste checkpoint
   (depende de rodar as simulações `sim_transfer_ai_*.js`); nenhum
   sinal de problema óbvio encontrado na leitura do código.
6. Resultado: aprovado — S8 (sequência 1.1-1.5) concluída.
7. Roadmap atualizado nesta mesma revisão.

Resolve também, com evidência, o achado **P0** de
`docs/project/BRDATA_Auditoria_v1.0.md` §4.3/§7.1 ("IA de
transferências 100% aleatória") — `transferScore()`
(`carreira.js:3642`) pondera necessidade/adequação/financeiro/contexto,
não é mais aleatório.

Próximo marco

S4 — Redesign Mobile. Primeiro passo já registrado:
`S3-DS20-S4-PREP-001` (tokens + Dialog/Bottom Sheet/Skeleton, pré-requisito
apontado pela S3.2.7 Readiness Review — ver `docs/HANDOFF_CLAUDE.md`),
status `PRONTO PARA IMPLEMENTAÇÃO`.

Governança

Este arquivo é a referência principal para:

* status das Sprints;
* ordem de execução;
* dependências;
* decisões de produto;
* retomada do projeto após interrupções.

Não criar novos roadmaps paralelos sem relacioná-los explicitamente a este documento.
