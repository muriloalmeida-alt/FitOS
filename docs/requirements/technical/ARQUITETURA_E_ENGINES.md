# Arquitetura e Motores — BRDATA (Modo Carreira)

**Origem:** `docs/sprints/S2/S2_GDD_TECNICO.md` (GDB Técnico v1.0,
14/08/2026) + `docs/sprints/S2/S2_GAME_ENGINE_SPEC.md` (Game Engine
Specification v1.0). **Migrado por:** `DOCS-REQ-001` (11/09/2026).

Este documento separa deliberadamente **estado atual** (confirmado no
código à época dos documentos-fonte) de **direção futura** (proposta,
ainda não necessariamente implementada) — os documentos-fonte às vezes
misturam os dois. Qualquer trabalho que use este documento deve
confirmar o estado atual contra o código vigente antes de assumir que
algo listado como "futuro" continua não implementado, ou que algo
listado como "atual" não mudou desde então (`docs/README.md` regra 4).

---

## 1. Princípio arquitetural

### Estado atual (confirmado)
```
carreira.js  →  Game State + Game Rules + Simulation + UI State + Rendering + Events
                              │ (JSON)
                              ↓
careerStore.js  →  Persistência + Validação básica
```
O cliente (`carreira.js`) é o "dono da verdade" do save; o backend
(`careerStore.js`) guarda o blob JSON e valida só estrutura básica —
isso é documentado explicitamente no próprio código.

### Decisão de arquitetura (vigente)
**Não migrar essa arquitetura imediatamente.** Para o estágio atual do
produto ela continua válida. Novas funcionalidades devem, no entanto,
ser desenvolvidas de forma que possam futuramente ser extraídas de
`carreira.js` (não aumentar deliberadamente o acoplamento).

## 2. Game State (`CAREER`)

O objeto `CAREER` é o estado persistente central. Regra vigente: **toda
informação persistente da carreira deve pertencer a `CAREER`** — estado
transitório de interface (ex.: partida ao vivo em andamento, contexto de
um picker/modal aberto, dia selecionado num formulário de treino) **não
deve** entrar no save. O próprio motor já separa esse tipo de estado
como transitório.

## 3. Versionamento de save

Regra obrigatória (origem: GDB Técnico §3, reforçada no Game Engine
Spec §5): todo save deve possuir `CAREER.schemaVersion`. Mudanças de
formato devem usar migrações determinísticas (`migrateCareerV1ToV2()`,
etc.), nunca `if (!field)` espalhados pelo código como única defesa.

> **Regra inegociável:** nunca quebrar uma carreira existente por causa
> de uma nova feature. Compatibilidade com saves antigos é requisito de
> aceite de qualquer mudança de estrutura de dados — ver também
> `CLAUDE.md` §9/§33 (que já trata disso como regra do projeto).

## 4. Ciclo de rodada

A rodada é a unidade temporal principal do jogo (não há passagem de
tempo diária real — treinamento representa uma semana virtual dentro de
cada rodada). Sequência conceitual (`processRound`/`simulateRound`):

```
validar estado → aplicar treinamento → recuperar jogadores → processar
contratos → processar mercado → executar IA dos clubes → simular
partidas → atualizar jogadores → atualizar finanças → atualizar
diretoria → atualizar reputação → gerar eventos → gerar notícias →
atualizar objetivos → avançar rodada → persistir
```

Essa ordem deve ser **determinística** — mesmo estado + mesma seed +
mesmas decisões = mesmo resultado (ver `CLAUDE.md` §44, mesmo princípio).

## 5. Os 4 grandes motores (framing conceitual)

O jogo deve ser pensado como 4 motores que se alimentam mutuamente:

- **⚽ Match Engine** — o que acontece dentro da partida.
- **🏢 Career Engine** — o que acontece com o treinador.
- **🌎 World Engine** — o que acontece no futebol ao redor do jogador.
- **💰 Economy Engine** — como dinheiro, mercado e recursos se movimentam.

```
MATCH ENGINE → RESULTADOS → (CAREER ENGINE + WORLD ENGINE) → REPUTAÇÃO / MERCADO·NOTÍCIAS → ECONOMY ENGINE → CLUBE → NOVA TEMPORADA
```

## 6. Modelo de jogador (dados)

```
IDENTIDADE   { id, nome, idade, posição, origem }
CAPACIDADE   { overall, ataque, defesa, físico, potencial }
ESTADO       { condição, moral, forma, lesão, suspensão }
CONTRATO     { salário, duração, vínculo }
CARREIRA     { jogos, gols, assistências, evolução }
```

Evolução já possui teto por jogador com retorno decrescente próximo ao
limite (fechando um problema antigo de "qualquer jogador → 99 só por
acumular semanas"). Regra vigente: quanto mais próximo do potencial,
menor o ganho marginal de treinamento (mesma regra já em `CLAUDE.md`
§17).

## 7. Treinamento — modelo técnico

Semana virtual (SEG–DOM, aplicada de uma vez ao avançar pra partida de
sábado), com proteção de idempotência por rodada. Eixos: **Foco**
(técnico/físico/tático/descanso), **Intensidade** (leve/moderada/
intensa), **Grupo** (elenco/misto/individual). Trade-off vigente:
intensidade ↑ → ganho potencial ↑ → fadiga ↑ → condição ↓ → risco de
lesão ↑ — nunca "treino forte = sempre melhor".

## 8. Tática — modelo técnico

4 eixos principais (escala 1–5, 3 = neutro): **ritmo**, **pressão**,
**linha defensiva**, **estilo de passe**. Mais instruções específicas
por setor (defesa/meio/ataque — lista completa em `game-design/`).
**Regra:** a tática deve alterar probabilidades, nunca determinar
eventos diretamente.

## 9. Formação

Biblioteca de formações maior que as 6 iniciais do GDD original — ver
lista completa em `CLAUDE.md` §15 (já reflete o estado atual, 14
formações). Direção futura (não confirmada como implementada): formação
afetar espaços/funções/compatibilidade/força ofensiva/defensiva de forma
mais rica que um modificador escalar simples (`atk *= 1.06`) — os
modificadores atuais são descritos como "relativamente abstratos" no
documento-fonte; confirmar contra o código antes de tratar como
resolvido.

## 10. Match Engine

### Estrutura atual
Partida dividida em blocos (15'/30'/45'/60'/75'/90'), pausa no
intervalo, técnico pode substituir/alterar tática/continuar/acelerar/
pular pro final. Limite de 5 substituições (com possibilidade de bônus).

### Variáveis de força e fórmulas conceituais
```
AttackPower  = BaseAttack  × SquadQuality × FormationModifier × TacticalModifier × ConditionModifier × MoraleModifier × TacticalFit
DefensePower = BaseDefense × SquadQuality × FormationModifier × TacticalModifier × ConditionModifier × MoraleModifier × TacticalFit
```
Modificadores devem ficar em faixas moderadas (anti-exploit). Vantagem
de mando: `HomeAdvantage > 1.0`, `AwayAdvantage = 1.0`, sem tornar
resultados previsíveis.

### Geração de gols
Abordagem confirmada no código: expectativa de gols + distribuição de
Poisson (`λ_home = f(HomeAttack, AwayDefense, Context)`, idem away),
com limites mín/máx pra evitar resultados absurdos.

### Momentum (direção de design, confirmar implementação)
Variável temporária -100..+100 (gol +15, grande chance +5, defesa
decisiva +5, cartão vermelho -20, gol sofrido -15, substituição decisiva
+5) — deve ser modificador pequeno, nunca determinístico.

> **Regra fundamental (vigente, não negociável):** decisões do treinador
> precisam alterar probabilidades, nunca determinar resultados
> diretamente. O jogador deve sentir "minha decisão aumentou minhas
> chances", nunca "cliquei em atacar e fiz gol".

## 11. CPU (clubes adversários)

Diferença arquitetural confirmada: o clube do usuário tem escalação/
jogadores/tática/condição/treinamento completos; a simulação de clubes
CPU tradicionalmente usa força agregada (aceitável por performance).
Direção de evolução (não confirmada como implementada por completo):
cada clube CPU evoluir progressivamente pra ter elenco, formação,
necessidades, finanças, estratégia, mercado e identidade próprios — ver
`game-design/` (IA dos clubes) pro detalhe de regras.

## 12. Mercado — separação de escopo

Regra vigente confirmada no código: **competição principal** (a divisão
escolhida pelo usuário, ~20 clubes) e **mercado de transferências** (já
com escopo maior, cobrindo Séries A/B/C) são conceitos **separados** —
não misturar. `CLAUDE.md` §21 já trata disso.

## 13. Transferência — modelo de dados

```
TRANSFER { buyer, seller, player, fee, installments, salary, contract, window, status }
STATUS: AVAILABLE | OFFERED | NEGOTIATING | ACCEPTED | REJECTED | COMPLETED | CANCELLED
```
Direção futura (não confirmada): contraproposta, empresário, cláusula,
bônus, percentual de venda futura — parte disso já existe no produto
(parcelamento, contrapropostas — ver `CLAUDE.md` §20/§21); confirmar
escopo exato contra o código antes de tratar como pendente.

## 14. Finanças

Estado financeiro confirmado: caixa, histórico de caixa, ledger, folha,
transferências, estádio, patrocínios. **Regra inegociável:** toda
movimentação financeira deve gerar `ledger entry` + `cash impact` —
nunca `CAREER.finances.cash -= value` isolado, sem histórico rastreável.

## 15. Moral

Já alterada por resultado, minutos e entrevistas (confirmado no
código). Modelo de inputs/outputs:
```
Inputs:  Resultado, Minutos, Titularidade, Desempenho, Contrato, Promessas, Relacionamento, Transferência, Hierarquia
Outputs: performanceModifier, complaintProbability, transferRequestProbability, teamChemistry
```

## 16. Carreira do treinador

Já existe e deve ser preservada: reputação (0–100, faixas Contestado/
Em dúvida/Estabelecido/Renomado/Lendário), histórico de clubes,
temporadas, títulos, posição média, demissão, propostas. Direção futura
(não confirmada): perfil estruturado (`TacticalProfile`/
`ManagementProfile`/`DevelopmentProfile`) além da reputação/experiência
já existentes.

## 17. Propostas de clubes (pro treinador)

Já gera propostas considerando força relativa do clube, diferença de
overall do elenco, reputação do treinador e orçamento oferecido. Direção
de evolução: `ProposalScore = ReputationFit + ClubNeed + TacticalFit + PreviousResults + ClubAmbition`.

## 18. Diretoria

Deve funcionar como entidade intermediária entre clube e treinador.
Objetivos por categoria (esportivo/financeiro/formação/mercado/
infraestrutura), cada um com `target/deadline/weight/currentValue/
status/reward/penalty`. Confiança em escala (0–20 Crítico · 21–40 Baixo
· 41–60 Normal · 61–80 Alto · 81–100 Excelente), considerando
resultados/objetivos/finanças/gestão de jogadores/promessas/expectativa
do clube. Resultado deve ser avaliado **relativo à expectativa** do
clube (`ResultScore ≠ PositionOnly` — 4º lugar é ruim pra um clube
grande e bom pra um pequeno).

## 19. Notícias

Geradas por templates estruturados usando eventos e mudanças reais da
tabela — **decisão de arquitetura vigente: não é IA generativa.** É
preferível ter "200 notícias coerentes" a "IA gerando textos bonitos mas
inconsistentes". Fluxo: evento de jogo → trigger de notícia → template →
variáveis de contexto → manchete.

## 20. Event Engine

Estrutura de evento:
```js
EVENT = { id, type, trigger, actor, target, context, effects, news, timestamp }
```
**Regra vigente:** eventos devem ser **data-driven** — preferir uma
lista de regras declarativas (`EVENT_RULES = [{ id, trigger, effects }]`)
a espalhar `if (...)` de efeito de evento pelo código. Isso é
especialmente importante pra permitir expansão sem duplicação de lógica
— ver também `CLAUDE.md` §28.

## 21. Persistência

Backend atual: 1 carreira por usuário, valida `clubId`/`squad`, limita
tamanho de save (768 KB — confirmado, mesmo valor já em `CLAUDE.md` §9),
persiste JSON, escrita agendada/debounced. Prioridade técnica: **não
migrar isso imediatamente**, mas separar conceitualmente Game Engine / UI
/ Persistence (mesmo que fisicamente continuem no mesmo arquivo por
enquanto).

## 22. Arquitetura-alvo (visão de longo prazo, não uma migração agendada)

```
UI → Game Controller → (Match Engine | Career Engine | World Engine) → Game State → Persistence
```
em vez de `carreira.js = absolutamente tudo`. **Não recomendado fazer
essa refatoração agora** — primeiro estabilizar as regras (mesmo
princípio de `CLAUDE.md` §40, refatoração incremental, nunca reescrita).

## 23. Regra de processo pra qualquer agente (Claude incluído)

Antes de alterar qualquer sistema, sempre:
```
1. INSPECIONAR   4. PRESERVAR comportamento atual
2. IDENTIFICAR implementação existente   5. IMPLEMENTAR mudança mínima
3. MAPEAR dependências                    6. TESTAR → 7. VALIDAR save/load → 8. DOCUMENTAR
```
Nunca "criar um sistema de X" quando X já existe — sempre "localizar o
sistema existente, entender seus contratos, ampliar sua capacidade".
Nunca assumir que uma funcionalidade não existe só porque documentação
antiga diz que ela não existe (mesma regra de `CLAUDE.md` §3).

## 24. Contrato mínimo de qualquer feature nova

Toda feature nova deve conseguir responder: qual problema resolve? qual
entidade/estado altera? quais sistemas consomem esse estado? quais
eventos gera? qual impacto econômico/esportivo/de carreira/de UI? como
será persistida? Se não conseguir responder, não está pronta pra
desenvolvimento.

## 25. Anti-exploit (arquitetural)

Testar sistematicamente contra: mercado (comprar barato/vender
instantaneamente por valor artificial, propostas infinitas, arbitragem
artificial), treinamento (intensidade permanente, evolução infinita),
finanças (geração infinita de dinheiro, valores negativos, duplicação de
receita), partidas (mudança tática abusiva, substituições infinitas,
exploração de momentum), carreira (propostas infinitas, reputação sem
limite). Mesmo princípio de `CLAUDE.md` §29.

## 26. Determinismo e observabilidade

Eventos importantes devem, quando possível, ter uma seed (`matchSeed`)
— facilita debug, testes, reprodução de bugs e balanceamento. Eventos
importantes deveriam gerar logs estruturados em desenvolvimento (mesmo
padrão de `CLAUDE.md` §31) — objetivo final é sempre conseguir responder
"por que este resultado aconteceu?", nunca "o algoritmo decidiu".

---

## Nota de reconciliação (obrigatória por `docs/README.md` regra 4)

Boa parte deste documento descreve **direção arquitetural e regras de
processo**, não uma auditoria linha a linha do `carreira.js` atual (que
já passou de 14.000 linhas). Onde uma seção descreve "estado atual", ela
reflete o que os documentos-fonte confirmaram ter visto no código no
momento em que foram escritos (14/08/2026) — não uma reconfirmação feita
nesta migração. Qualquer trabalho técnico que dependa de um detalhe
específico aqui deve confirmar contra o código vigente antes de agir,
mesma regra 4 de `docs/README.md`. As regras **de processo/regra de
ouro** (versionamento, determinismo, ledger financeiro, eventos
data-driven, "nunca quebrar save antigo") são as que têm maior confiança
de continuarem vigentes sem confirmação adicional — são princípios de
engenharia, não estado de feature específica.
