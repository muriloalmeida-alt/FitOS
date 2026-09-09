# BRDATA — Auditoria Completa do Projeto + Roadmap de Implementação
**Versão:** 1.0
**Data:** 08/09/2026
**Escopo:** Comparação do código atual do Modo Técnico (`carreira.js`,
`carreira.html`, `server/`) contra os documentos de especificação —
`CLAUDE.md` (raiz), `docs/sprints/S2/S2_GDD.md`,
`docs/sprints/S2/S2_GDD_TECNICO.md`,
`docs/sprints/S2/S2_GAME_ENGINE_SPEC.md`.

> Nota (09/09/2026): este relatório foi escrito quando esses arquivos
> ainda estavam na raiz do repositório — os caminhos acima refletem a
> reorganização em `docs/` feita depois (primeiro pra `docs/reqs/`,
> depois pra `docs/sprints/S2/`); o conteúdo abaixo não foi alterado.

**Metodologia:** leitura direta do código (`carreira.js` 13.514 linhas,
`carreira.html` 5.463 linhas, `server/`) cruzada com os 4 documentos de
especificação. Auditoria estritamente somativa — nenhuma alteração de
código foi feita durante a produção deste relatório.

---

## 1. O que já está implementado e funcionando

| # | Item | Arquivo/Função | Situação |
|---|---|---|---|
| 1.1 | Fluxo completo de carreira (escolha divisão→clube→elenco→temporada→demissão/renovação) | `carreira.js`, `startCareer`, `advanceSeason`, `endCurrentClubStint` | Sólido, testado por dezenas de scripts e2e ao longo da sessão. |
| 1.2 | Match engine "ao vivo" em blocos reais (6×15min), com Play-by-Play v1+v2 completo (gol, assistência, cartão, substituição, lesão, pênalti, VAR, posse) | `resolveLiveChunk` (7335), `COMMENTARY_BANK`, `updateLiveStats` | Interativo de verdade — trocar tática/jogador no intervalo muda o resto do jogo. Cumpre GDB Técnico §11/§14 em espírito. |
| 1.3 | Táticas: 4 eixos gerais + 15 instruções setoriais (defesa/meio/ataque), todos multiplicativos com clamp | `TACTIC_AXES`, `SECTOR_INSTRUCTIONS`, `combinedTacticMod` (l.74-195) | Mais profundo do que o mínimo do CLAUDE.md §16 exige — 19 dials reais, não apenas um seletor decorativo. |
| 1.4 | 14 formações com modificador atk/def próprio | `FORMATION_MOD` (l.74) | Cobre a lista do CLAUDE.md §15 por completo. |
| 1.5 | Contratos: geração por idade/overall/potencial + renovação | `computeContractFields` (963), `proposeRenewal` (8461) | Núcleo funcional, evolutivo (ver §3/§4 abaixo). |
| 1.6 | Propostas de emprego pro técnico (job offers) — genuinamente contextual | `maybeGenerateClubProposals` (1801) | Usa gap de overall real, limiar de reputação escalado pelo gap, orçamento com RNG **semeado** (`seededRngFromKey`). Contraste positivo forte com a IA de transferências (ver §7.1). |
| 1.7 | Persistência com validação de forma + limite de tamanho + escrita debounced | `server/src/careerStore.js` | `isValidCareerShape` (clubId+squad array), `MAX_BYTES=768KB`, `scheduleWrite`. Simples mas funcional e documentado com justificativa real. |
| 1.8 | Multi-divisão (Série A/B/C) com mercado entre as 60 times, fonte de dados fixada por carreira (`liveModeByCompetition`) | `carreira.js` (`ALL_TEAMS_FLAT`, `marketTeamsPool`) | Resolve corretamente o bug "Time #xxx" documentado. |
| 1.9 | Engajamento: login diário com streak, objetivos em camadas (diário/semanal/temporada), conquistas permanentes, ranking assíncrono | `claimDailyLogin` (server/users.js), `CAREER.objectives/achievements` | Cobre GDD §retenção. Ranking calculado no cliente (ver risco em §9). |
| 1.10 | Loja com pagamento real (Mercado Pago Checkout Pro) + Créditos BR como ledger server-authoritative | `server/src/users.js` (`addCredits`), rotas `/api/loja/*` | Única quebra deliberada e documentada do "cliente é dono da verdade" — corretamente isolada. |
| 1.11 | Redesign visual completo M3 + Design System próprio (`--m3-*`/`--mt-*`), cor dinâmica por clube com checagem WCAG em runtime | `deriveClubPalette`, `contrastRatio` | Cumpre CLAUDE.md §6/§35 (mobile-first, tokens) com folga. |
| 1.12 | Service worker com cache offline do shell inteiro do Modo Técnico | `public/sw.js` | Cumpre requisito de resiliência básica. |

---

## 2. O que está parcialmente implementado

| # | Item | Arquivo/Função | Situação atual | Problema | Impacto | Prioridade |
|---|---|---|---|---|---|---|
| 2.1 | Migração de saves | `migrateCareerDefaults()` (13158, 245 linhas) | 117 ocorrências de `if (!CAREER.…)`/`if (CAREER.…)` espalhadas, sem `schemaVersion` | Funciona hoje, mas cresce sem limite e sem ordem determinística — CLAUDE.md §10 pede exatamente o oposto (`v1→v2→v3` explícito) | Risco crescente de regressão silenciosa em saves antigos à medida que mais campos são adicionados | **P1** |
| 2.2 | Contratos | `computeContractFields`, `proposeRenewal` | Idade/overall/potencial/valor/salário/duração existem; renovação existe | Sem cláusulas, luvas, bônus, promessa de titularidade, agente, rescisão — todos citados no CLAUDE.md §20 como evolução esperada | Sistema econômico raso perto do que o GDD Técnico descreve; jogador não sente "negociação" | **P2** |
| 2.3 | Conselho/Diretoria | `computeBoardGoal`, `boardGoalMet`, `askBoard` (l.1628+) | Meta de posição na tabela existe, com cooldown de pedido | Só considera posição na tabela — CLAUDE.md §24 pede também finanças, reputação, confiança como dimensões de pressão | Punição (demissão) não reflete todo o contexto do clube, é uma dimensão só | **P2** |
| 2.4 | IA dos clubes (CPU) — perfil/identidade | `LEAGUE_TEAMS`, elenco por clube | Cada clube tem força agregada (atk/def) e cor própria | Não há "personalidade" (agressivo no mercado, conservador, foco em base) — CLAUDE.md §22/GDD §24 pedem decisões plausíveis considerando "necessidade por posição" e "contexto da temporada" | CPU parece homogêneo além da força bruta | **P2** |
| 2.5 | Notícias / News Engine | `newsFeed`, geração por rodada | Cobre vitória/derrota/lesão/transferência/crise financeira | Não checado nesta auditoria se cobre TODOS os gatilhos do CLAUDE.md §27 (ex.: "briga contra rebaixamento" como narrativa contínua, não só evento pontual) | Risco médio — provavelmente cobre a maioria, mas não confirmado item a item | **P3** |

---

## 3. O que está implementado mas precisa ser refatorado

| # | Item | Arquivo/Função | Situação | Problema | Impacto | Prioridade |
|---|---|---|---|---|---|---|
| 3.1 | `carreira.js` como monólito de 13.514 linhas | arquivo inteiro | Um único arquivo concentra estado, engine, UI, persistência | CLAUDE.md §4.1/§40 já reconhece isso como aceitável "por enquanto", mas o arquivo só cresceu nesta sessão (novas features sempre inseridas aqui) | Tempo de leitura/contexto para qualquer IA ou dev cresce a cada feature; risco de colisão de nomes/estado global | **P2** (não bloqueante, mas se degradando) |
| 3.2 | `migrateCareerDefaults()` | mesmo de 2.1 | 245 linhas, 117 checagens ad-hoc | Função monolítica de compatibilidade sem estrutura — violação direta e nomeada do CLAUDE.md §10 | Difícil auditar "o que muda entre versões de save" | **P1** |
| 3.3 | Toast/mensagens de rodapé | `toastBottomOffset`, reposicionamento a cada 150ms via polling | Funciona, mas usa polling em vez de observar transições de tela via evento | Overhead pequeno mas desnecessário; contraria CLAUDE.md §41 ("evitar cálculos repetidos") | Baixo, mas é dívida técnica classificável | **P3** |
| 3.4 | `realTeamColor()` duplicada em `carreira.js` e `liveData.js` | ambos arquivos | Mesma lógica (match exato + "contém" + aliases) mantida em 2 lugares | Cada correção de clube (Atlético-MG, Coritiba) precisa ser replicada manualmente nos dois arquivos — já aconteceu | Risco de divergência silenciosa entre Modo Técnico e site principal | **P2** |

---

## 4. O que está especificado nos documentos mas ainda não existe

| # | Item | Documento | Situação | Problema | Impacto | Prioridade |
|---|---|---|---|---|---|---|
| 4.1 | **Event Engine formal** (trigger+conditions+effect+message+cooldown, testável) | CLAUDE.md §28, GDB Técnico §25-26 | Confirmado via grep: `EVENT_RULES`/`EventEngine`/`eventEngine` — **zero ocorrências** em `carreira.js` | Toda lógica de evento (moral, insatisfação, pedido de transferência) está espalhada inline, sem estrutura declarativa nem cooldown genérico | Impossível testar eventos isoladamente; risco de regras conflitantes/duplicadas crescer sem controle | **P1** |
| 4.2 | **`schemaVersion` + migrações explícitas** | CLAUDE.md §10, GDB Técnico §3 | Zero ocorrências de `schemaVersion`; `CAREER.version` existe mas é escrito uma vez (linha 4039) e nunca lido — campo morto | Nenhum controle real de versão de save | Bloqueia qualquer estratégia futura de migração segura em massa | **P1** |
| 4.3 | **IA de transferências contextual** (`TransferScore`: necessidade por posição, ajuste tático, orçamento, idade/potencial, "personalidade" do clube) | CLAUDE.md §22, GDB Técnico §15, GDD §24 | `simulateAiTransfers` (3773) e `findInterestedBuyer` (3451) são **puramente aleatórios** — só limitados por tamanho de elenco | Já bem documentado no código como aleatório, mas contradiz diretamente 3 documentos de especificação diferentes | Mercado CPU×CPU e ofertas pelo jogador do usuário não refletem nenhuma lógica de necessidade/qualidade — quebra a promessa de "decisões plausíveis" | **P1** |
| 4.4 | **Determinismo do match engine** (mesma seed+estado+decisões = mesmo resultado) | CLAUDE.md §12/§44 | `resolveLiveChunk` (7335) usa `Math.random` cru para `poissonSample`, não uma seed | Resultado de partida não é reproduzível — contradiz princípio nomeado explicitamente | Impossibilita replay/debug determinístico de uma partida específica; dificulta relatar bugs de resultado | **P1** |
| 4.5 | **Testes unitários de lógica pura** (match engine, standings, transferências, finanças, contratos — nessa ordem, CLAUDE.md §32) | CLAUDE.md §32 | Só existe `tests/e2e/*.js` (Playwright, ponta a ponta via browser) — nenhum teste unitário isolado de função pura | Um bug de fórmula (ex.: `computeContractFields`, `poissonSample`) só é pego indiretamente via e2e, se o cenário de teste passar por ali | Cobertura de regressão fraca para lógica financeira/estatística fina | **P2** |
| 4.6 | **Perfis do treinador** (TacticalProfile/ManagementProfile/DevelopmentProfile) | GDB Técnico §21, GDD §5-7 | Só existe `reputation` (número único) + histórico de clubes | Carreira do treinador é unidimensional — não há especialização (ex.: treinador formador de base vs. gestor financeiro) | Progressão de carreira do técnico é rasa perto do que o GDD descreve | **P2** |
| 4.7 | Cláusulas/luvas/bônus/agente/rescisão em contratos | CLAUDE.md §20 | Ver 2.2 | — | — | **P2** (mesmo item, categorizado aqui por ausência total) |
| 4.8 | Notificação push para eventos com o app fechado (ex.: streak prestes a quebrar) | Documento de Retenção (histórico da sessão) | Confirmado como fora de escopo por decisão explícita do usuário durante a implementação de engajamento — infraestrutura de push existe parcialmente (VAPID) mas o gatilho "app fechado" não foi implementado | Não é uma omissão silenciosa — já foi decidida e comunicada | Baixo (decisão consciente, documentada) | **P3** |

---

## 5. Problemas arquiteturais e técnicos

| # | Item | Arquivo | Problema | Impacto | Prioridade |
|---|---|---|---|---|---|
| 5.1 | Estado global espalhado (`CAREER`, `LEAGUE_TEAMS`, `ALL_TEAMS_FLAT`, `LIVE_MODE_BY_COMPETITION`, `PENDING_ROUND_SUMMARY`, `PICKER_CTX`, dezenas de outros) | `carreira.js`, topo do arquivo | Nenhum encapsulamento — qualquer função pode ler/escrever qualquer global | Efeitos colaterais difíceis de rastrear; já causou pelo menos 1 bug real nesta sessão (ordem de `enterAfterAuth`/`loadLeague`) | **P1** |
| 5.2 | Backend "sem lógica de futebol" por design | `server/src/careerStore.js` | Validação de shape é intencionalmente rasa (`clubId` + `squad` array) | Qualquer corrupção de dado gerada por bug no cliente é aceita e persistida sem verificação de consistência interna (ex.: overall negativo, array de escalação com id inexistente) | **P2** |
| 5.3 | `careers.json` reescrito por inteiro a cada save (não é por-usuário) | `careerStore.js` `persist()` | Documentado no histórico como causa real de lentidão "fantasma" (583 carreiras de teste = 231MB, PUT levando 3-5s) | Não escala com base de usuários — cada carreira ativa aumenta o custo de TODA escrita de TODO usuário | **P1** |
| 5.4 | `DATA_PROVIDER` é uma escolha única e global no servidor | `server/src/providers/index.js`, `competitions.js` | Confirmado durante a preparação para desligar a Sportmonks: não dá para ter Série A em "frozen" e Série B em "sportmonks" ao mesmo tempo | Limita flexibilidade operacional futura (ex.: manter 1 competição ao vivo e outra congelada) | **P3** |
| 5.5 | `realTeamColor()` duplicada (ver 3.4) | 2 arquivos | — | — | **P2** |

---

## 6. Problemas de UX/UI

| # | Item | Situação | Problema | Impacto | Prioridade |
|---|---|---|---|---|---|
| 6.1 | Cobertura visual M3 | 31 telas do documento de design cobertas | Nenhum problema estrutural encontrado nesta auditoria — o histórico de ajustes mostra um processo iterativo saudável (feedback→correção→teste) | — | — |
| 6.2 | Premiações (`#awardsOverlay`) | Confirmado no histórico como "funcionalmente completo mas não pixel-perfect com o mockup restyled" | Débito de polish visual já identificado e conscientemente adiado pelo próprio time de trabalho anterior | Baixo — cosmético | **P3** |
| 6.3 | Ausência de indicador visão explícita "dado real vs. Modo Exemplo" | Decisão consciente do usuário (só documentado no Histórico de Atualizações, sem selo na UI) | Jogador não tem como saber, dentro do jogo, se está em dado real ou fictício sem consultar documentação externa | Confusão potencial ao trocar de ambiente/anunciar mudanças de fornecedor | **P3** |

---

## 7. Problemas no Game Engine

| # | Item | Arquivo/Função | Problema | Impacto | Prioridade |
|---|---|---|---|---|---|
| 7.1 | IA de transferências 100% aleatória | `simulateAiTransfers` (3773), `findInterestedBuyer` (3451) | Ver 4.3 — repetido aqui por ser uma falha de ENGINE, não só de spec | Mercado CPU×CPU e propostas pelo jogador do usuário sem qualquer coerência estratégica — quebra "Princípio de Explicabilidade" (CLAUDE.md §45): o jogador não pode entender "por que" recebeu ou não uma proposta | **P0** — impacto direto na jogabilidade central (Mercado é sistema P0-adjacente: toda semana de jogo passa por ele) |
| 7.2 | Match engine não determinístico | `resolveLiveChunk` (7335) | Ver 4.4 | Viola CLAUDE.md §12/§44 diretamente; impede replay/debug reproduzível de um resultado específico reportado por usuário | **P1** |
| 7.3 | Ausência de Event Engine formal | Ver 4.1 | Toda lógica condicional de evento é inline e duplicada em pontos diferentes do arquivo | Risco de regras conflitantes (ex.: 2 gatilhos de moral competindo) crescer sem detecção | **P1** |
| 7.4 | Anti-exploit não auditado sistematicamente | — | CLAUDE.md §29 pede pergunta obrigatória "como um jogador tentaria quebrar isso" para toda mecânica econômica; não há evidência de checklist formal aplicado (compra→venda instantânea, farm de treino, abuso de empréstimo) | Risco real: o mercado multi-divisão (60 times) amplia a superfície de possíveis exploits de compra/revenda entre divisões sem verificação cruzada | **P1** |

---

## 8. Problemas de balanceamento

| # | Item | Situação | Problema | Impacto | Prioridade |
|---|---|---|---|---|---|
| 8.1 | Treinamento — ganho determinístico sem decaimento por proximidade do potencial verificado nesta auditoria | `applyWeeklyTraining` | Documentado no histórico como "ganho = round(2×mult)" fixo — não foi confirmado nesta auditoria se há de fato o amortecimento "quanto mais perto do potencial, menor o ganho marginal" exigido pelo CLAUDE.md §17 | Se ausente, jogador pode evoluir linearmente até o teto e "bater" nele abruptamente, em vez de desacelerar suavemente | **P2** (necessita confirmação direta antes de decidir prioridade final) |
| 8.2 | Mercado multi-divisão — teto de elenco de times "de fora" | `MAX/MIN_LEAGUE_SQUAD_OTHER_DIVISION` (16/12) | Ajuste já feito para resolver estouro de save (768KB), mas não há confirmação de que a IA CPU×CPU entre divisões respeita alguma lógica de "faz sentido esse negócio pra ambos" — ver 7.1 | Combinação de IA aleatória + mercado de 60 times aumenta a chance de transferências absurdas (jogador ruim de Série C vendido caro para clube de Série A) | **P1** |
| 8.3 | Créditos BR / Loja — preço do "Uniforme Alternativo" estimado, não fornecido pela planilha original | Documentado no próprio código como estimativa | Baixo risco por ser cosmético, mas é um valor "inventado" em sistema de pagamento real | **P3** |

---

## 9. Riscos de segurança e persistência

| # | Item | Arquivo | Situação | Risco | Impacto | Prioridade |
|---|---|---|---|---|---|---|
| 9.1 | Cliente é "dono da verdade" do save inteiro (exceto Créditos BR) | `careerStore.js`, todo `carreira.js` | Documentado e aceito conscientemente (jogo solo, sem placar competitivo) | Um usuário pode em teoria editar o `localStorage`/requisição para inflar overall/dinheiro/reputação | Baixo/aceito — mas **o Ranking (engajamento) calcula o score no CLIENTE** e o publica; isso É um dado comparado entre contas (ainda que sem prêmio material) | **P2** — vale reavaliar se ranking deveria ter alguma validação mínima no servidor, já que é o único ponto onde dado "de um cliente" é exposto a outros usuários |
| 9.2 | `isValidCareerShape` extremamente permissiva | `careerStore.js:89` | Só checa `clubId` string + `squad` array | Um payload malformado mas "raso o suficiente" pode corromper campos internos sem ser barrado | Corrupção de save só detectada em runtime pelo cliente (se detectada) | **P2** |
| 9.3 | Persistência em disco efêmero (Railway sem Volume) | comentário em `careerStore.js` | Já documentado como risco conhecido e comunicado | Perda de progresso em redeploy sem volume anexado | Depende de infraestrutura de produção, fora do controle do código | **P1** operacional (não é bug de código, é checklist de deploy) |
| 9.4 | `careers.json` cresce sem rotina de limpeza de contas de teste/abandonadas | `careerStore.js` | Confirmado como causa real de degradação de performance nesta sessão (231MB) | Sem purga automática, poderá voltar a acontecer em produção com contas abandonadas acumulando | **P2** |
| 9.5 | Endpoints admin (`/api/admin/snapshot*`) protegidos só por `ADMIN_SECRET` em query string | `server.js` | Segredo em query string pode vazar em logs de acesso/proxy | Baixo (uso pontual, não é fluxo de usuário comum) mas é prática abaixo do ideal | **P3** |

---

## 10. Dívida técnica

| # | Item | Situação | Prioridade |
|---|---|---|---|
| 10.1 | `migrateCareerDefaults()` monolítica (117 checagens) | Ver 2.1/3.2 | **P1** |
| 10.2 | `carreira.js` monólito de 13,5k linhas crescendo a cada feature | Ver 3.1 | **P2** |
| 10.3 | `realTeamColor()` duplicada | Ver 3.4/5.5 | **P2** |
| 10.4 | Zero testes unitários — só e2e Playwright | Ver 4.5 | **P2** |
| 10.5 | `CAREER.version` campo morto (nunca lido) | linha 4039 | **P3** — remover ou transformar em `schemaVersion` real |
| 10.6 | `CAREER.liveMode` (versão antiga, pré-multi-divisão) mantido só para saves legados | comentário no código | **P3** — aceitável como compatibilidade, mas vale documentar prazo de descontinuação |

---

## ROADMAP DE IMPLEMENTAÇÃO

*Ordenado por prioridade e dependência — cada fase assume que a anterior está concluída, sempre seguindo o processo do CLAUDE.md §37 (inspecionar→localizar→entender→planejar→alterar→testar→revisar) e sem reescrever sistemas funcionando.*

### FASE 0 — Confirmações rápidas (pré-requisito, sem código)

Antes de tocar em qualquer coisa: confirmar diretamente no código se `applyWeeklyTraining` já implementa o amortecimento por proximidade do potencial (item 8.1) — decide se essa entra como bug real (P1) ou fica como está.

### FASE 1 — P0/P1 de Engine (risco direto ao core loop)

1. **IA de Mercado contextual** (4.3/7.1/8.2) — maior prioridade isolada: afeta todo `simulateAiTransfers`/`findInterestedBuyer`, que já são usados por 3 fluxos (mercado do jogador, IA CPU×CPU, virada de temporada). Introduzir um `TransferScore` simples (necessidade por posição vaga + ajuste de overall ao "nível" do clube + orçamento disponível) sem reescrever a estrutura de dados existente — extensão pura de função.
2. **Determinismo do match engine** (4.4/7.2) — trocar `Math.random` cru por RNG seedado por partida em `resolveLiveChunk`/`poissonSample`, reaproveitando `seededRngFromKey` já existente. Baixo risco de regressão visível (resultado estatístico não muda de distribuição, só passa a ser reproduzível).
3. **`schemaVersion` real + função `migrateCareer(save)`** (4.2/2.1/3.2/10.1) — não é reescrever `migrateCareerDefaults`, é envolvê-la: gravar `schemaVersion` atual no save, e futuras migrações passam a ser incrementais e nomeadas (`v1→v2`), aposentando o padrão "checagem solta" só para NOVOS campos daqui pra frente (não precisa migrar as 117 existentes de uma vez).
4. **Auditoria formal de anti-exploit no mercado multi-divisão** (7.4) — dado que a IA de transferências está sendo mexida na mesma fase, aproveitar para aplicar a pergunta do CLAUDE.md §29 contra o fluxo de compra/revenda entre as 3 divisões.

### FASE 2 — P1 de Arquitetura/Persistência (não bloqueia jogabilidade, mas escala mal)

5. **Event Engine mínimo** (4.1/7.3) — não precisa ser um motor genérico completo de uma vez: começar extraindo 3-4 regras já existentes e espalhadas (ex.: moral baixa + banco → pedido de transferência) para um array `EVENT_RULES` avaliado num único lugar, provando o padrão antes de migrar o resto incrementalmente (mesmo espírito do CLAUDE.md §40, refatoração em etapas).
6. **Persistência por-usuário em vez de arquivo único** (5.3) — maior risco de escala identificado; migrar `careers.json` de um blob único para arquivos por `userId` (ou registro indexado) elimina o custo O(n) por escrita. Requer cuidado de migração de dado existente.
7. **Rotina de limpeza/expiração de saves de teste/abandonados** (9.4) — decorre naturalmente do item 6.

### FASE 3 — P2 de Profundidade de Sistema (evolução de conteúdo, não de risco)

8. **Contratos: cláusulas, luvas, promessa de titularidade, agente** (2.2/4.7) — evoluir `computeContractFields`/`proposeRenewal`, nunca substituir.
9. **Perfis do treinador (Tactical/Management/Development)** (4.6) — camada nova sobre `reputation`, sem remover o campo existente.
10. **Personalidade/identidade de clube CPU** (2.4) — dá suporte adicional à IA de mercado já refeita na Fase 1 (ordem importa: fazer depois do TransferScore, para reaproveitar a mesma estrutura de decisão).
11. **Conselho multidimensional** (2.3) — somar finanças/reputação como fatores de pressão, além de posição.
12. **Testes unitários de lógica pura** (4.5/10.4) — começar exatamente pela ordem do CLAUDE.md §32: match engine → standings → transferências → finanças → contratos. Os itens 1 e 2 desta Fase 1 já são o momento ideal para nascerem com teste unitário dedicado, não e2e.

### FASE 4 — P2/P3 de Limpeza (dívida técnica pura, fazer quando houver folga)

13. Deduplicar `realTeamColor()` entre `carreira.js`/`liveData.js` (3.4/5.5) — extrair para módulo compartilhado.
14. Remover/transformar `CAREER.version` morto (10.5).
15. Avaliar extração incremental de `carreira.js` em módulos menores (3.1/10.2) — só depois que os itens estruturais acima estabilizarem, para não competir por atenção com mudanças de engine ativas.

### FASE 5 — P3 (polish, quando o resto estiver estável)

16. Selo/indicador de dado real vs. Modo Exemplo na UI (6.3).
17. Polish visual de Premiações contra o mockup restyled (6.2).
18. Corrigir preço estimado do "Uniforme Alternativo" com valor real, se a planilha for atualizada (8.3).
19. Mover segredo admin de query string para header (9.5).

---

## Adendo (09/09/2026) — achado P0 4.3/7.1 confirmado resolvido

Este relatório original é preservado sem alteração acima (registro
histórico de 08/09/2026). Este adendo documenta uma verificação
posterior, não uma correção do relatório.

O achado **P0** dos itens **4.3** e **7.1** ("IA de transferências
100% aleatória, sem lógica de necessidade/orçamento/contexto") foi
resolvido pelo trabalho de Transfer AI (Fases 1.1-1.5, commits
`bcf3395` a `472217a`, 08-09/09/2026) — confirmado por leitura direta
do código em `origin/main`, não apenas pelo changelog:

* `transferScore()` (`public/js/carreira.js:3642`) pondera
  necessidade/adequação/financeiro/contexto — as 4 dimensões que este
  relatório apontava como ausentes;
* `simulateAiTransfers`/`findInterestedBuyer` (citados no achado
  original) agora consomem esse score em vez de serem puramente
  aleatórios;
* 9 arquivos de teste dedicados em `tests/e2e/` cobrem a sequência.

Checkpoint formal e detalhamento completo em
`docs/project/ROADMAP.md` § "S8 — situação (concluída)".

Os demais achados deste relatório (4.4 determinismo do match engine,
4.2 `schemaVersion`, 4.1 Event Engine formal, 5.3 persistência em blob
único, entre outros P1/P2) **não foram reverificados** neste adendo —
continuam como estavam na auditoria original até nova verificação.

---

## FIM
