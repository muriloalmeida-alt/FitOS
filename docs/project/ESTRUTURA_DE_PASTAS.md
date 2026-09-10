# BRDATA — Estrutura de Pastas do Repositório
**Criado em:** 09/09/2026
**Atualizado em:** 10/09/2026 (chapéu PM — correção de staleness apontada em
`docs/project/DIAGNOSTICO_2026-09-09.md` §5, item 3)
**Status:** reflete o estado real do repositório em `origin/main`
(276 arquivos rastreados) nesta data. As seções "Propostas adicionais"
no fim continuam sendo sugestões, não aplicadas.

## O que mudou desde a versão de 09/09/2026

A versão anterior deste documento ficou desatualizada em poucas horas
(achado registrado no diagnóstico citado acima): referenciava
`docs/reqs/` (nome que nunca chegou a ser usado de fato — a pasta
nasceu direto como `docs/requirements/`), listava `ROADMAP.md` e
`PROJECT_CONTEXT.md` como "(pendentes)" quando já existiam, e não
mencionava `docs/sprints/`, `docs/HANDOFF_CLAUDE.md` nem
`docs/README_HANDOFF.md` — todos criados depois dela. Esta revisão
corrige os quatro pontos e atualiza as contagens de arquivo.

## Árvore completa

```
FitOS/                                    (raiz do repositório)
│
├── CLAUDE.md                             ← constituição de dev p/ agentes de IA (fixo na raiz — ver docs/README.md)
├── README.md                             ← landing page do repo (fixo na raiz — convenção GitHub/GitLab)
├── Caddyfile                             ← reverse proxy/HTTPS (deploy opção B)
├── Dockerfile                            ← deploy via Docker
├── docker-compose.yml                    ← deploy via Docker, 1 comando
├── .dockerignore
├── .gitignore
│
├── .claude/
│   └── skills/
│       └── pm/SKILL.md                   ← skill que faz Claude absorver o chapéu de PM (ver docs/README.md regra 1)
│
├── docs/                                 ← documentação do projeto (reorganizada 09/09/2026, 33 arquivos)
│   ├── README.md                         ← índice + regras de governança (fonte da verdade — ver regra 0)
│   ├── README_HANDOFF.md                 ← governança oficial PM ↔ Claude (papéis, fluxo, estados, aprovação)
│   ├── HANDOFF_CLAUDE.md                 ← comunicação oficial PM ↔ Claude: demandas vigentes + histórico
│   ├── sprints/                          ← histórico por Sprint (registro imutável do que foi decidido/auditado)
│   │   ├── S1/S1_AUDITORIA_JOGO.md
│   │   ├── S2/S2_GDD.md, S2_GDD_TECNICO.md, S2_GDD_TECNICO_RESUMO.md,
│   │   │      S2_GAME_ENGINE_SPEC.md, S2_GAME_ENGINE_SPEC_RESUMO.md
│   │   ├── S3/S3_DS20_FUNDACAO_EXECUTAVEL.md, S3_2_COMPONENTES_E_CONTRATOS.md,
│   │   │      S3_S4_MATRIZ_TELAS_MOBILE.md, S3_2_7_READINESS.md
│   │   └── S4/README.md, S4_REQUISITOS_VIGENTES.md
│   ├── project/                          → gestão e governança do projeto
│   │   ├── BRDATA_Auditoria_v1.0.md      ← auditoria código vs. spec (08/09/2026)
│   │   ├── DIAGNOSTICO_2026-09-09.md     ← diagnóstico do estado de docs/ (09/09/2026)
│   │   ├── ESTRUTURA_DE_PASTAS.md        ← este arquivo
│   │   ├── CHANGELOG.md                  ← histórico técnico completo, derivado de git log
│   │   ├── PROJECT_CONTEXT.md            ← contexto permanente do produto
│   │   └── ROADMAP.md                    ← roadmap oficial (S1–S16)
│   ├── requirements/                     → requisitos e regras de negócio VIVOS, por tipo
│   │   ├── README.md
│   │   ├── functional/README.md          (vazia até o 1º requisito chegar)
│   │   ├── technical/README.md           (vazia até o 1º requisito chegar)
│   │   ├── game-design/README.md         (vazia até o 1º requisito chegar)
│   │   └── ui-ux/README.md               (vazia até o 1º requisito chegar)
│   ├── library/                          → material de referência (pesquisas, benchmarks, UX/UI, concorrentes)
│   │   └── README.md                     (vazia até o 1º material chegar)
│   └── ops/                              → documentação técnica operacional
│       ├── README-INSTALACAO.md
│       ├── README-API-SPORTS.md
│       ├── README-LOGIN.md
│       ├── README-PAGAMENTOS.md
│       ├── README-DEPLOY-RAILWAY.md
│       └── README-CARREIRA.md
│
├── deploy/                               ← arquivos de deploy (opção A: VPS + systemd)
│   ├── brasileirao.service
│   └── nginx.conf.example
│
├── public/                               ← front-end (servido pelo backend)
│   ├── index.html                        ← site principal (resultados/tabela ao vivo)
│   ├── carreira.html                     ← Modo Técnico (SPA da carreira)
│   ├── admin.html                        ← painel administrativo
│   ├── historico.html                    ← histórico de atualizações (versionamento do produto)
│   ├── privacidade.html
│   ├── manifest.json                     ← PWA do site principal ("BR Data")
│   ├── manifest-treinador.json           ← PWA do Modo Técnico ("BR Treinador")
│   ├── sw.js                             ← service worker
│   ├── css/
│   │   └── style.css                     ← CSS do site principal (compartilhado com carreira.html)
│   ├── js/
│   │   ├── app.js                        ← lógica do site principal
│   │   ├── carreira.js                   ← núcleo do Modo Técnico (monólito crítico — ver CLAUDE.md §4)
│   │   ├── data.js                       ← catálogos demo (DEMO_TEAMS por divisão)
│   │   ├── engine.js                     ← motor de pontos corridos (tabela/calendário)
│   │   ├── liveData.js                   ← integração de dado ao vivo (site principal)
│   │   ├── admin.js
│   │   ├── affiliates.js
│   │   └── qrcode-lib.js
│   └── img/
│       ├── logo.png, brand-icon.png, cbf-logo.png, og-image.png
│       ├── icons/                        (7 arquivos — ícones de app/PWA)
│       ├── partners/                     (5 arquivos + README.md — logos de casas de apostas)
│       └── teams/                        (31 arquivos + README.md — brasões locais/fallback offline)
│
├── server/                               ← backend Node (sem framework — módulos nativos + libs mínimas)
│   ├── server.js                         ← entrypoint HTTP (rotas)
│   ├── package.json / package-lock.json
│   ├── .env.example                      ← modelo de variáveis de ambiente
│   ├── .gitignore
│   ├── src/                              (24 arquivos + providers/, 4 arquivos — lógica de domínio)
│   │   ├── careerStore.js                ← persistência do save da carreira
│   │   ├── competitions.js               ← registro de competições (Série A/B/C, Copa, etc.)
│   │   ├── users.js / sessions.js        ← contas, login, sessão
│   │   ├── paymentsLedger.js             ← histórico de receita/funil
│   │   ├── mercadoPago.js                ← integração de pagamento
│   │   ├── leaderboard.js                ← ranking (engajamento)
│   │   ├── lojaCatalog.js                ← catálogo da Loja
│   │   ├── captureSnapshot.js            ← captura de retrato real (usado pelo script + endpoint admin)
│   │   ├── debouncedPersist.js           ← escrita em disco assíncrona/debounced
│   │   ├── providers/                    ← abstração de fornecedor de dado
│   │   │   └── index.js, apiSports.js, sportmonks.js, frozen.js
│   │   └── (demais: analytics, cache, adapter, push, slug, publicRateLimit,
│   │        contentStore, oddsHistory, newsSource, broadcastSource,
│   │        epgSource, sportmonksClient, supportPlans)
│   ├── scripts/
│   │   └── capture-real-snapshot.js      ← CLI de captura de retrato real (ver server/frozen-catalog/)
│   └── frozen-catalog/                   ← catálogo real congelado (commitado — fora de server/data/)
│       ├── README.md
│       └── snapshot-brasileirao.json, snapshot-serie_b.json, snapshot-serie_c.json
│
└── tests/
    └── e2e/                              ← suíte de regressão E2E (Playwright), 128 arquivos
        ├── README.md
        ├── package.json / package-lock.json
        ├── run_parallel.js               ← runner que executa a suíte em paralelo
        ├── _grant_test_credits.js        ← helper compartilhado
        ├── test_*.js                     (122 arquivos — 1 script por fluxo/feature testada)
        └── sim_*.js                      (3 arquivos — scripts de simulação em massa, não são regressão)
```

## Observações sobre pastas gitignoradas (não aparecem acima)

- `server/data/` — dado local descartável (contas, careers.json, snapshots de captura sem credencial). Nunca commitado; resetado para `{}` periodicamente por acúmulo de teste.
- `server/node_modules/`, `tests/e2e/node_modules/` — dependências de terceiros.

## Propostas adicionais (não aplicadas — para sua decisão)

Nenhuma destas foi executada; são sugestões que nasceram ao mapear a
árvore completa, fora do pedido original de `docs/`. Seguem válidas da
versão anterior deste documento (09/09/2026) — nada mudou na estrutura
de código desde então que as invalide.

1. **`tests/e2e/` está 100% flat com 128 arquivos** (122 `test_*` + 3
   `sim_*` + 5 arquivos de suporte, incluindo `.gitignore`). Funciona
   porque `run_parallel.js` provavelmente descobre os testes por glob
   nesse mesmo nível — separar em subpastas (`tests/e2e/regression/`,
   `tests/e2e/sim/`) exigiria confirmar como esse discovery funciona e
   ajustar antes de mover qualquer arquivo, para não quebrar a suíte.
   Só vale a pena se o volume continuar crescendo; não é urgente.
2. **`server/frozen-catalog/`** mistura o README com os 3 arquivos de
   dado (`snapshot-*.json`) — poderia virar `server/frozen-catalog/data/`
   + README na raiz da pasta, mas o ganho é pequeno para o risco de
   mexer no `providers/frozen.js` que lê esses caminhos.
3. **`public/js/`** tem 8 arquivos misturando o site principal (`app.js`,
   `admin.js`, `affiliates.js`, `liveData.js`, `qrcode-lib.js`) com o
   Modo Técnico (`carreira.js`, `engine.js`, `data.js` — este último
   compartilhado pelos dois). Uma eventual separação
   `public/js/site/` vs. `public/js/carreira/` exigiria atualizar todos
   os `<script src>` em `index.html`/`carreira.html`/`admin.html` — só
   vale a pena se você quiser essa separação explicitamente.

Nenhuma dessas 3 foi tocada. Se quiser seguir com alguma, trato como uma
etapa própria (branch, testar, merge — mesmo padrão de sempre).
