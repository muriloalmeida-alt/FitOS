HANDOFF_CLAUDE — Demandas vigentes e histórico

As regras de governança deste Handoff estão definidas em
docs/README_HANDOFF.md. Claude deve consultar o README_HANDOFF.md
para conhecer as regras (responsabilidades, fluxo, estados, escopo,
divergências, aprovação) — elas não são repetidas aqui.

⸻

Demandas vigentes

S3-DS20-S4-READINESS-001 — S3.2.7 Readiness Review

Status: PRONTO PARA IMPLEMENTAÇÃO
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

Histórico

Demanda	Data	Commit	Changelog
(nenhuma demanda concluída sob este fluxo ainda)
