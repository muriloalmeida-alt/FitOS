# docs/ — índice e regras de governança documental

Reorganização de 09/09/2026: os documentos que antes viviam soltos na
raiz do repositório (especificação de produto, engine, auditoria) e os
READMEs operacionais foram agrupados aqui, por finalidade.

## Estrutura

```
docs/
├── project/   → gestão e governança do projeto
├── reqs/      → requisitos e regras de negócio
├── library/   → material de referência (pesquisas, benchmarks, UX/UI, concorrentes)
└── ops/       → documentação técnica operacional (deploy, instalação, integrações, testes)
```

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

## Regras de governança (fixadas pelo usuário em 09/09/2026)

0. **A pasta `docs/` tal como está no GitHub (branch remota, não o
   estado local de uma sessão) é A FONTE DA VERDADE do projeto.** Isso
   vale em duas direções:
   - **Ao consultar**: antes de tratar qualquer conteúdo de `docs/`
     como atual, dar `git fetch`/`pull` primeiro — nunca confiar em
     memória de conversa ou num checkout local desatualizado. Isso
     importa especialmente porque terceiros (ex.: o GPT, responsável
     pela arquitetura funcional/product management) podem empurrar
     mudanças em `docs/reqs/` direto pro GitHub, fora desta sessão.
   - **Ao decidir**: uma decisão de governança, requisito ou arquitetura
     só é real quando está commitada em `docs/` no GitHub — o que foi
     dito em chat mas não chegou a um arquivo aqui não vale como fonte
     de verdade pra ninguém além dessa conversa específica.
1. **Divisão de responsabilidade**: Claude é responsável pela arquitetura
   de solução e por toda a parte técnica do projeto; GPT é o arquiteto
   funcional / product manager. Refinamento funcional do GPT entra em
   `docs/reqs/` (ele empurra direto pro GitHub; Claude lê de lá).
2. **`docs/project/ROADMAP.md`** (quando existir) é a **fonte de verdade**
   da sequência e do status das Sprints.
3. **`docs/reqs/`** é a **fonte de verdade** das regras de negócio.
4. **Se o código divergir de um requisito documentado, a divergência deve
   ser identificada e reportada — nunca assumir que o código está
   correto.** Qualquer trabalho futuro que envolva `docs/reqs/` deve
   comparar código vs. documento e sinalizar discrepâncias explicitamente
   (mesmo padrão já usado em `BRDATA_Auditoria_v1.0.md`), em vez de tratar
   o comportamento atual do código como verdade por padrão.
5. **Conflito entre requisito funcional (docs/reqs/) e viabilidade
   técnica** (compatibilidade de save, anti-exploit, regra do
   `CLAUDE.md`, ou simplesmente inviável do jeito que foi escrito):
   Claude reporta o conflito e uma alternativa viável ao usuário, que
   decide ou repassa ao GPT — nunca implementa nem ajusta o requisito
   por conta própria nesse caso.
6. **Mudanças de governança, requisitos ou decisões relevantes devem ser
   refletidas nos MDs correspondentes** — uma decisão tomada em conversa
   e não registrada aqui é uma decisão que se perde na próxima sessão.
