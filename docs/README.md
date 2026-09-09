# docs/ — índice geral

Reorganização de 09/09/2026: os documentos que antes viviam soltos na
raiz do repositório (especificação de produto, engine, auditoria) e os
READMEs operacionais foram agrupados aqui, por finalidade.

**Regras de governança entre PM e Claude**: ver
`docs/README_HANDOFF.md` — este índice não as repete (evita duplicação
com a fonte oficial).

## Estrutura

```
docs/
├── README_HANDOFF.md   → regras permanentes do processo PM ↔ Claude
├── HANDOFF_CLAUDE.md    → demandas vigentes + índice histórico (operacional)
├── project/   → gestão e governança do projeto
├── reqs/      → requisitos e regras de negócio
├── library/   → material de referência (pesquisas, benchmarks, UX/UI, concorrentes)
└── ops/       → documentação técnica operacional (deploy, instalação, integrações, testes)
```

### docs/README_HANDOFF.md — regras permanentes (fonte oficial)
Responsabilidades do PM e do Claude, limites de escrita de cada um,
fluxo de trabalho, estados de uma demanda, sequência obrigatória antes
de alterar código, regras de documentação, regras de Material Design 3,
tratamento de divergências, critérios de aprovação, Definition of Done
e a regra de idioma (PT-BR). **Fonte única** dessas regras — se algo
aqui parecer desatualizado, `README_HANDOFF.md` prevalece.

### docs/HANDOFF_CLAUDE.md — operacional (demandas + histórico)
Documento enxuto, só com 3 partes: (1) referência ao
`README_HANDOFF.md`; (2) **Demandas vigentes** — cada uma com o
detalhe necessário pra Claude executar sem ambiguidade; (3)
**Histórico** — uma linha por demanda concluída (Demanda | Data |
Commit | Changelog), nunca um segundo changelog. Detalhamento real de
cada mudança vive no Git e em `docs/project/CHANGELOG.md`.

### docs/project/ — gestão e governança
- `BRDATA_Auditoria_v1.0.md` — auditoria completa do código vs. especificação + roadmap de implementação (08/09/2026).
- `ESTRUTURA_DE_PASTAS.md` — mapa completo da árvore de diretórios do repositório.
- `CHANGELOG.md` — histórico completo do projeto, versionado por dia de trabalho (v1.0.0 em diante).
- **Pendentes** (o usuário vai enviar): `ROADMAP.md`, `PROJECT_CONTEXT.md`, e futuramente `DECISIONS.md`, `SPRINT_STATUS.md`.

### docs/reqs/ — requisitos e regras de negócio
- `BRDATA_GDB_v1.0.md` — Game Design Document.
- `BRDATA_GDB_Tecnico_v1.0.md` — GDD Técnico (arquitetura, módulos, fluxos).
- `BRDATA_Game_Engine_Spec_v1.0.md` — regras sistêmicas do motor (partidas, jogadores, treinamento, mercado, finanças, carreira, IA, mundo).
- **Pendente** (o usuário vai enviar): `S8_MARKET_CONTRACTS.md` — requisitos/regras de negócio da Sprint 8 (Transfer AI). Documentos de requisitos das próximas Sprints entram aqui, um arquivo por Sprint (`S<n>_<assunto>.md`).

### docs/library/ — material de referência
Ver `docs/library/README.md`. Vazia até o primeiro material chegar.

### docs/ops/ — documentação técnica operacional
Não fazia parte dos 3 grupos originalmente pedidos (governança/requisitos/
biblioteca) — criada porque os READMEs de setup/deploy/integração não se
encaixam em nenhum dos três (não são regra de negócio nem material de
pesquisa). Se preferir outro nome/local para este grupo, é só pedir.
- `README-INSTALACAO.md`, `README-API-SPORTS.md`, `README-LOGIN.md`,
  `README-PAGAMENTOS.md`, `README-DEPLOY-RAILWAY.md`, `README-CARREIRA.md`.

## O que ficou fora desta migração (e por quê)

- **`CLAUDE.md`** continua na raiz do repositório. Não é uma escolha de
  organização — é uma exigência técnica: o agente de IA (e a convenção
  do Claude Code em geral) carrega automaticamente `CLAUDE.md` da raiz
  do projeto como instrução de sistema. Mover esse arquivo quebraria
  esse carregamento.
- **`README.md`** (raiz) continua na raiz — é a página de entrada padrão
  do repositório em qualquer visualização de código (GitHub/GitLab/etc.
  renderizam automaticamente o `README.md` da raiz). Ele foi atualizado
  para apontar para os novos caminhos em `docs/`.
- **Os 4 READMEs locais** (`public/img/partners/README.md`,
  `public/img/teams/README.md`, `server/frozen-catalog/README.md`,
  `tests/e2e/README.md`) foram **deliberadamente mantidos onde estão**,
  e não em `docs/ops/` — cada um documenta o conteúdo da própria pasta
  onde vive (convenção de "README ao lado do que descreve"); movê-los
  para `docs/` separaria a documentação do código/assets que ela
  explica. Esta foi uma decisão minha, não uma leitura literal do "migrar
  tudo" — avise se preferir que eu os mova também.
