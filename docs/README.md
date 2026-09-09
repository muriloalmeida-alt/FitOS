# docs/ — índice e regras de governança documental

Reorganização de 09/09/2026 (revisada em 09/09/2026 para separar
histórico por Sprint dos requisitos vivos): os documentos que antes
viviam soltos na raiz do repositório (especificação de produto, engine,
auditoria) e os READMEs operacionais foram agrupados aqui, por
finalidade.

## Estrutura

```
docs/
├── README.md            → este arquivo
├── README_HANDOFF.md     → governança oficial PM ↔ Claude (papéis, fluxo, estados, aprovação)
├── HANDOFF_CLAUDE.md     → comunicação oficial PM (ChatGPT) ↔ Desenvolvimento (Claude): demanda vigente
├── sprints/       → histórico por Sprint (o que foi decidido/auditado/especificado, e quando)
│   ├── S1/
│   ├── S2/
│   ├── S3/
│   ├── S4/
│   └── ...
├── project/       → gestão e governança do projeto (roadmap, contexto, changelog)
├── requirements/  → requisitos e regras de negócio VIVOS, por tipo (functional/technical/game-design/ui-ux)
├── library/       → material de referência (pesquisas, benchmarks, UX/UI, concorrentes)
└── ops/           → documentação técnica operacional (deploy, instalação, integrações, testes)
```

### docs/README_HANDOFF.md — governança PM ↔ Claude
Documento oficial das regras: papéis, limites de atuação, escopo de
arquivos, fluxo, estados das demandas, regra de início/implementação,
preservação de funcionalidades, Material Design 3, divergências,
autorização formal para commit, critérios de aprovação, Definition of
Done. `docs/HANDOFF_CLAUDE.md` referencia este arquivo em vez de repetir
as regras.

### docs/HANDOFF_CLAUDE.md — comunicação oficial PM ↔ Claude
Fluxo formal fixado em 09/09/2026: o PM abre uma tarefa lá com
`Status: PRONTO PARA IMPLEMENTAÇÃO`, Claude só começa a implementar
quando ler esse status, e devolve o relatório de implementação/testes/
divergências/pendências na MESMA seção, mudando o status pra `REVISÃO DO
PM NECESSÁRIA`. Esse documento é o ponto de entrada oficial de qualquer
tarefa nova — não presumir o estado do projeto só pela conversa ou pelo
código.

### docs/sprints/ — histórico por Sprint
Cada Sprint tem sua própria pasta (`docs/sprints/S<n>/`) com os
documentos produzidos naquela Sprint — auditorias, GDD/GDD Técnico/Game
Engine Spec, specs de feature, matrizes de tela, readiness reviews etc.
Diferença em relação a `docs/requirements/`: aqui é o registro histórico
("o que foi decidido na S3"), não a regra vigente atualizada — se algo
mudar depois, o registro da Sprint não é reescrito, uma Sprint nova (ou
`docs/requirements/`) é que reflete o estado atual.
- `S1/` — Auditoria do Jogo Atual (concluída).
- `S2/` — GDD, GDD Técnico e Game Engine Specification (concluída).
- `S3/` — BRDATA Design System 2.0: fundação executável, componentes e
  contratos, matriz de telas mobile S4, S3.2.7 Readiness Review.
- `S4/` — ainda não iniciada, ver `docs/sprints/S4/README.md`.

### docs/project/ — gestão e governança
- `BRDATA_Auditoria_v1.0.md` — auditoria completa do código vs. especificação + roadmap de implementação (08/09/2026).
- `DIAGNOSTICO_2026-09-09.md` — diagnóstico do projeto a partir de `docs/` (estado do roadmap, achados herdados da auditoria, lacunas documentais, recomendação priorizada).
- `ESTRUTURA_DE_PASTAS.md` — mapa completo da árvore de diretórios do repositório.
- `CHANGELOG.md` — histórico completo do projeto, versionado por dia de trabalho (v1.0.0 em diante).
- `PROJECT_CONTEXT.md`, `ROADMAP.md` — contexto permanente e roadmap oficial do produto.

### docs/requirements/ — requisitos e regras de negócio vivos
Ver `docs/requirements/README.md`. Ainda vazia (09/09/2026) — os
documentos de requisito que existiam antes desta reorganização ficaram
em `docs/sprints/`, por Sprint de origem, até serem revisitados aqui como
regra vigente e não histórica.

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
     mudanças em `docs/sprints/` ou `docs/requirements/` direto pro
     GitHub, fora desta sessão.
   - **Ao decidir**: uma decisão de governança, requisito ou arquitetura
     só é real quando está commitada em `docs/` no GitHub — o que foi
     dito em chat mas não chegou a um arquivo aqui não vale como fonte
     de verdade pra ninguém além dessa conversa específica.
1. **Divisão de responsabilidade** (fluxo oficial fixado em 09/09/2026,
   detalhado em `docs/HANDOFF_CLAUDE.md`):
   - **PM (ChatGPT)**: produto, requisitos, arquitetura funcional,
     priorização, escopo, critérios de aceite, decisões de produto,
     governança, documentação em `docs/`, validação final. Escopo de
     escrita **somente dentro de `docs/`** — nunca em código de
     produção, testes, configuração ou `CLAUDE.md`.
   - **Claude**: arquitetura de solução, implementação, preservação de
     funcionalidades existentes, testes, identificação de regressões,
     relato de divergências, atualização do handoff.
   - **`docs/HANDOFF_CLAUDE.md`** é o documento bidirecional oficial
     dessa comunicação — Claude só inicia implementação quando o status
     da tarefa lá estiver `READY FOR IMPLEMENTATION`; uma tarefa só está
     de fato concluída quando `PM REVIEW REQUIRED → APPROVED`.
   - **Adaptação (09/09/2026):** o GPT está indisponível como PM dedicado
     por instabilidade de conexão. Enquanto isso durar, **Claude absorve
     as tarefas funcionais de PM** (especificação, escopo, critérios de
     aceite, priorização, manutenção de `docs/`) via skill `pm`
     (`.claude/skills/pm/SKILL.md`), continuando a exercer também o papel
     de implementação. A única exceção: a **validação/aprovação formal**
     de uma demanda (a decisão `APPROVED` / `ADJUSTMENTS REQUIRED` /
     `BLOCKED` que fecha o ciclo) continua sendo feita pelo Murilo
     diretamente — quem implementa e especifica não pode também aprovar
     formalmente o próprio trabalho sem checagem externa. Se o GPT
     voltar a ficar disponível como PM, essa adaptação é removida e a
     divisão original acima volta a valer integralmente.
2. **`docs/project/ROADMAP.md`** (quando existir) é a **fonte de verdade**
   da sequência e do status das Sprints.
3. **`docs/requirements/`** (regra vigente) e `docs/sprints/` (registro
   histórico por Sprint) são a **fonte de verdade** das regras de
   negócio — `docs/requirements/` prevalece quando os dois divergirem,
   por ser a versão atualizada.
4. **Se o código divergir de um requisito documentado, a divergência deve
   ser identificada e reportada — nunca assumir que o código está
   correto.** Qualquer trabalho futuro que envolva `docs/requirements/`
   ou `docs/sprints/` deve comparar código vs. documento e sinalizar
   discrepâncias explicitamente (mesmo padrão já usado em
   `BRDATA_Auditoria_v1.0.md`), em vez de tratar o comportamento atual do
   código como verdade por padrão.
5. **Conflito entre requisito funcional (docs/requirements/ ou
   docs/sprints/) e viabilidade técnica** (compatibilidade de save,
   anti-exploit, regra do
   `CLAUDE.md`, ou simplesmente inviável do jeito que foi escrito):
   Claude registra a divergência no handoff com a alternativa técnica
   viável e aguarda decisão do PM quando afeta produto/escopo — nunca
   implementa nem ajusta o requisito por conta própria nesse caso.
6. **Mudanças de governança, requisitos ou decisões relevantes devem ser
   refletidas nos MDs correspondentes** — uma decisão tomada em conversa
   e não registrada aqui é uma decisão que se perde na próxima sessão.
   Toda implementação deve verificar impacto documental (arquitetura,
   comportamento, regras de negócio, persistência, contratos, mercado,
   economia, UI/UX, APIs, testes, roadmap, decisões técnicas) — nunca
   deixar o código deliberadamente mais atualizado que a documentação.
