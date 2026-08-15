# Arquitetura

## Visão geral

```
WhatsApp (candidato)
      │  mensagens de texto, PDF, áudio
      ▼
Meta Cloud API ──POST /webhook──▶ src/server.js (Express)
                                        │
                                        ▼
                          src/conversation/engine.js  (máquina de estados)
                          │        │           │
              src/services/whatsapp.js   src/ai/interviewAI.js ──▶ Claude API
              (enviar/baixar mídia)      │
                                         ▼
                            src/services/transcription.js ──▶ Whisper (OpenAI)
                            src/services/resumeParser.js  (PDF → texto)
                            src/services/jobScraper.js    (URL → texto)
                                        │
                                        ▼
                              src/db/store.js (data/db.json)
                                        ▲
                                        │
                        src/services/scheduler.js (lembrete + follow-up 24h)
```

## Por que um arquivo JSON como banco de dados

Pra um MVP validando um conceito (meta de sucesso: "30% dos usuários
voltam pra uma segunda simulação"), o volume de dados é pequeno o
suficiente pra não justificar operar um banco de dados de verdade ainda.
Um arquivo JSON:
- não tem dependência nativa (roda em qualquer container sem compilar nada)
- é trivial de inspecionar/debugar (`cat data/db.json`)
- é trivial de fazer backup (copiar o arquivo)

**Limite conhecido:** escreve o arquivo inteiro a cada mutação
(`src/db/store.js`) e não lida com concorrência entre múltiplos processos
— funciona bem com uma única instância do servidor, que é o cenário de
deploy assumido (`docker-compose.yml`, ver `docs/DEPLOY.md`).

### Caminho de migração

A interface do `store.js` (`getUser`, `createSession`, `updateSession`,
`getQuestionsFromBank`, `scheduleReminder`, ...) foi desenhada pra ser
estável — trocar a implementação por um adaptador Postgres (ou SQLite,
se só precisar de concorrência sem precisar de um servidor de banco
separado) não deve exigir mudar nada fora de `src/db/`. Sinais de que é
hora de migrar: mais de uma instância do servidor rodando, ou o arquivo
JSON passando de alguns MB.

## Por que fetch nativo em vez de SDKs (Anthropic, OpenAI)

O projeto propositalmente evita SDKs pesados pra chamadas de API que são,
na prática, um POST com JSON. Node 18+ já tem `fetch`, `FormData` e
`Blob` nativos — suficiente pra `src/services/claude.js`,
`src/services/whatsapp.js`, `src/services/transcription.js` e
`src/services/tts.js`. Isso mantém `package.json` com só 3 dependências
(`express`, `dotenv`, `pdf-parse`) e reduz superfície de bugs/CVEs de
terceiros. Se o projeto crescer a ponto de precisar de streaming,
retries automáticos ou tipos gerados, adotar o SDK oficial da Anthropic
é uma troca localizada em `src/services/claude.js`.

## Scraping de vaga: limitação conhecida

`src/services/jobScraper.js` faz um `GET` simples e limpa o HTML — não
renderiza JavaScript. Funciona bem pra páginas server-rendered, mas pode
vir incompleto em páginas que montam o conteúdo via client-side JS. O
fluxo de conversa (`conversation/engine.js`) já cobre esse caso: se o
usuário mandar um link e o scraping vier vazio/curto demais, o bot pede
pra colar a descrição da vaga em texto — sem travar a jornada. Evoluir
isso pra um browser headless (Playwright) é o próximo passo natural
quando o volume de vagas com esse problema justificar o custo extra de
infraestrutura.

## Ganchos de observabilidade (não implementados ainda)

O case do produto (`docs/CASE.md`) define métricas de acompanhamento:
funil de conclusão da simulação, recorrência de acesso, faturamento e
assertividade da IA. Este MVP não inclui um pipeline de analytics — os
dados brutos pra calcular essas métricas já existem em
`data/db.json` (timestamps de criação/atualização de sessão, status de
cada etapa, respostas do banco de perguntas), então a implementação
futura é uma questão de agregação, não de captura.
