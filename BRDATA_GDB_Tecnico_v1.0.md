# BR DATA TREINADOR

# GDB Técnico — Game Design Bible v1.0

**Objetivo:** definir como os sistemas do jogo funcionam e como devem evoluir sem quebrar a arquitetura existente.

**Fonte de verdade atual:** código da branch `main` do repositório. O `carreira.js` atual possui 13.333 linhas e concentra o motor da carreira; o `careerStore.js` persiste o estado da carreira no backend.

---

## 1. PRINCÍPIO ARQUITETURAL

### 1.1 Estado atual

Hoje o modelo é:

```text
┌─────────────────────┐
│     carreira.js     │
│                     │
│  Game State         │
│  Game Rules         │
│  Simulation         │
│  UI State            │
│  Rendering           │
│  Events              │
└──────────┬──────────┘
           │
           │ JSON
           ↓
┌─────────────────────┐
│    careerStore.js   │
│                     │
│  Persistência       │
│  Validação básica   │
└─────────────────────┘
```

Isso é explicitamente documentado no código: o cliente é o "dono da verdade" do save e o backend guarda o blob JSON.

### Decisão do GDB

Não migrar imediatamente.

Para o estágio atual do produto, essa arquitetura continua válida.

Porém, novas funcionalidades devem ser desenvolvidas de forma que possam futuramente ser extraídas do `carreira.js`.

---

## 2. GAME STATE

O objeto `CAREER` é o coração do jogo.

Conceitualmente:

```js
CAREER = {
  version,
  clubId,
  clubName,
  competitionId,
  seasonYear,
  currentRound,
  squad,
  leagueSquads,
  lineup,
  schedule,
  standings,
  finances,
  stadium,
  trainingPlan,
  objectives,
  achievements,
  reputation,
  clubHistory,
  transferLog,
  pendingOffer,
  clubProposals,
  news,
  cup,
  teamStats,
  careerTotals,
  ...
}
```

O código confirma que o estado já contém, entre outros elementos, finanças, histórico financeiro, estádio, transferências, diretoria, forma recente e mercado.

### Regra

Toda informação persistente da carreira deve pertencer ao `CAREER`.

Estado temporário de interface não deve entrar no save.

Exemplo:

```text
LIVE_MATCH
PICKER_CTX
TRAINING_SELECTED_DAY
```

O próprio motor já separa `LIVE_MATCH` como estado transitório que não é persistido.

---

## 3. VERSIONAMENTO DO SAVE

Esse é um item que eu considero obrigatório daqui para frente.

Adicionar:

```text
CAREER.schemaVersion
```

Exemplo:

```text
schemaVersion: 3
```

Quando uma nova versão do jogo alterar o formato:

```text
Save v1
 ↓
migrateCareerV1ToV2()
 ↓
Save v2
 ↓
migrateCareerV2ToV3()
 ↓
Save v3
```

### Regra

Nunca quebrar uma carreira existente por causa de uma nova feature.

---

## 4. CICLO PRINCIPAL DO MOTOR

A unidade temporal do jogo atualmente é a rodada.

O motor não trabalha com passagem de tempo diária real.

O treinamento, por exemplo, representa uma semana virtual dentro de cada rodada.

Portanto:

```text
RODADA
│
├── Treinamento
├── Recuperação
├── Mercado
├── CPU
├── Partidas
├── Eventos
├── Finanças
├── Notícias
├── Objetivos
├── Moral
└── Persistência
```

Essa sequência precisa ser determinística e documentada.

---

## 5. GAME TICK

Proponho formalizar:

```text
processRound(round)
```

Conceitualmente:

```text
processRound()
│
├── validateCareerState()
│
├── applyTraining()
│
├── recoverPlayers()
│
├── processTransfers()
│
├── processLoans()
│
├── processAI()
│
├── resolveMatches()
│
├── updatePlayerState()
│
├── updateFinances()
│
├── updateBoard()
│
├── updateReputation()
│
├── generateEvents()
│
├── generateNews()
│
├── updateObjectives()
│
├── advanceRound()
│
└── persist()
```

Hoje boa parte disso já acontece dentro de `simulateRound` e funções auxiliares; a proposta é formalizar o conceito, não necessariamente reescrever tudo imediatamente. O `simulateRound` atual já processa mercado, outras divisões, Copa, resultados e notícias.

---

## 6. SISTEMA DE JOGADORES

### 6.1 Modelo

Todo jogador deve possuir:

```text
IDENTIDADE
├── id
├── nome
├── idade
├── posição
└── origem

CAPACIDADE
├── overall
├── ataque
├── defesa
├── físico
└── potencial

ESTADO
├── condição
├── moral
├── forma
├── lesão
└── suspensão

CONTRATO
├── salário
├── duração
└── vínculo

CARREIRA
├── jogos
├── gols
├── assistências
└── evolução
```

---

## 7. EVOLUÇÃO DO JOGADOR

O motor já possui evolução natural e treinamento.

Um problema antigo identificado no próprio código era a ausência de um teto efetivo de evolução; a implementação atual já introduziu lógica de teto por jogador e retorno decrescente próximo ao limite.

### Regra oficial

```text
Potencial
    ↓
Teto de desenvolvimento
    ↓
Treinamento
    ↓
Minutos jogados
    ↓
Idade
    ↓
Evolução
```

Não permitir:

> qualquer jogador → 99 simplesmente por acumular semanas.

---

## 8. TREINAMENTO

O sistema atual trabalha com uma semana virtual:

```text
SEG
TER
QUA
QUI
SEX
SÁB → JOGO
DOM
```

A semana inteira é aplicada ao avançar para a partida, e existe proteção de idempotência por rodada.

**Focos atuais**
- Técnico
- Físico
- Tático
- Descanso

**Intensidade**
- Leve
- Moderada
- Intensa

**Grupo**
- Elenco
- Misto
- Individual

---

## 9. FADIGA

Treinamento deve gerar trade-off:

```text
Intensidade ↑
     ↓
Ganho potencial ↑
     ↓
Fadiga ↑
     ↓
Condição ↓
     ↓
Risco ↑
```

Isso é muito melhor que:

> "Treino forte = sempre melhor."

O sistema atual já possui histórico de fadiga e lesões associado ao treinamento.

---

## 10. TÁTICA

O sistema atual evoluiu para 4 eixos principais:

- ritmo;
- pressão;
- linha defensiva;
- estilo de passe.

Cada eixo possui escala 1–5, com 3 como neutro.

Além disso existem instruções específicas para:

**Defesa**
- linha defensiva;
- pressão pós-perda;
- compactação;
- saída de bola;
- bola parada defensiva.

**Meio**
- intensidade;
- amplitude;
- transição;
- circulação;
- cobertura.

**Ataque**
- amplitude;
- movimentação;
- últimos passes;
- finalização;
- bola parada.

### Regra

A tática deve alterar probabilidades, nunca determinar eventos.

---

## 11. FORMAÇÃO

O motor já possui uma biblioteca significativamente maior que os seis esquemas iniciais.

Entre elas:

- 4-4-2
- 4-3-3
- 4-2-3-1
- 3-5-2
- 4-5-1
- 5-3-2
- 4-1-4-1
- 4-4-1-1
- 3-4-3
- 4-1-3-2
- 3-4-2-1
- 4-3-1-2
- 4-2-2-2
- 5-4-1

### Regra futura

Formação deve afetar:

```text
espaços
+
funções
+
compatibilidade
+
força ofensiva
+
força defensiva
```

e não apenas:

```js
atk *= 1.06
```

Os modificadores atuais ainda são relativamente abstratos; esse é um dos pontos que considero candidatos a evolução do Match Engine.

---

## 12. MATCH ENGINE

### 12.1 Estrutura atual

A partida do usuário é dividida em:

```text
15'
30'
45'
60'
75'
90'
```

O jogo pausa no intervalo.

O técnico pode:

- substituir;
- alterar tática;
- continuar;
- acelerar;
- pular para o final.

Há limite de 5 substituições, com possibilidade de bônus no sistema atual.

---

## 13. MATCH ENGINE 2.0

A próxima evolução deve ser:

**Fase 1 — Força**

```text
Ataque
Defesa
Condição
Moral
Formação
Tática
```

↓

**Fase 2 — Contexto**

```text
Casa/Fora
Placar
Tempo
Cartões
Cansaço
Momentum
```

↓

**Fase 3 — Evento**

```text
Ataque
Finalização
Gol
Cartão
Lesão
Chance perdida
Defesa
```

↓

**Fase 4 — Consequência**

```text
Placar
Moral
Tática
Condição
Estatísticas
Notícias
```

---

## 14. CPU

Há uma diferença arquitetural importante hoje:

**Seu clube**

Possui:

- escalação;
- jogadores;
- tática;
- condição;
- treinamento.

**CPU**

A simulação de clubes adversários tradicionalmente usa força agregada.

O próprio código explica essa diferença.

Isso é aceitável para performance.

Porém, o GDB define:

A CPU deve evoluir progressivamente para:

```text
CPU CLUB
├── Elenco
├── Formação
├── Necessidades
├── Finanças
├── Estratégia
├── Mercado
└── Identidade
```

---

## 15. IA DE MERCADO

Já existe negociação entre os clubes CPU e geração de propostas por jogadores do usuário.

A evolução proposta:

```text
AI Club Profile
│
├── budget
├── wageLimit
├── preferredAge
├── preferredPositions
├── tacticalStyle
├── transferStrategy
└── squadNeeds
```

**Score de contratação**

Conceitualmente:

```text
TransferScore =
  Need
+ TacticalFit
+ PlayerQuality
+ Potential
+ AgeFit
+ FinancialFit
+ ClubStrategy
```

A IA então escolhe o jogador com maior score dentro das restrições.

---

## 16. MERCADO

O mercado atual já possui escopo envolvendo os clubes das Séries A, B e C, enquanto a competição principal da carreira permanece restrita à divisão escolhida.

Isso é uma boa separação:

```text
COMPETIÇÃO
20 clubes

MERCADO
60 clubes
```

### GDB oficial

Não misturar esses dois conceitos.

---

## 17. TRANSFERÊNCIA

Uma transferência possui:

```text
buyer
seller
player
fee
installments
salary
contract
window
status
```

Estados:

```text
AVAILABLE
OFFERED
NEGOTIATING
ACCEPTED
REJECTED
COMPLETED
CANCELLED
```

Isso permitirá futuramente criar:

- contraproposta;
- empresário;
- cláusula;
- bônus;
- percentual de venda futura.

---

## 18. FINANÇAS

O estado financeiro já inclui:

- caixa;
- histórico de caixa;
- ledger;
- folha;
- transferências;
- estádio;
- patrocínios.

### Regra

Toda movimentação financeira precisa gerar:

```text
ledger entry
+
cash impact
```

Nunca alterar apenas:

```js
CAREER.finances.cash -= value
```

sem histórico.

---

## 19. ECONOMIA

A economia futura deve obedecer:

```text
Receita
    ↓
Caixa
    ↓
Decisões
    ↓
Investimento
    ↓
Performance
    ↓
Receita futura
```

Exemplo:

```text
Investir no estádio
↓
capacidade ↑
↓
bilheteria ↑
↓
receita ↑
↓
mais dinheiro para elenco.
```

---

## 20. MORAL

A moral já é alterada por resultado, minutos e entrevistas.

### Evolução

A moral deve receber inputs:

```text
Resultado
Minutos
Titularidade
Desempenho
Contrato
Promessas
Relacionamento
Transferência
Hierarquia
```

E produzir:

```text
performanceModifier
complaintProbability
transferRequestProbability
teamChemistry
```

---

## 21. CARREIRA DO TREINADOR

Já existe e deve ser preservada.

O sistema atual possui:

- reputação;
- histórico de clubes;
- temporadas;
- títulos;
- posição média;
- demissão;
- propostas.

A reputação atual varia em uma escala 0–100 e possui níveis como Contestado, Em dúvida, Estabelecido, Renomado e Lendário.

### Próxima versão

Adicionar:

```text
Coach
├── Reputation
├── Experience
├── TacticalProfile
├── ManagementProfile
├── DevelopmentProfile
└── CareerHistory
```

---

## 22. PROPOSTAS DE CLUBES

O sistema atual gera propostas considerando:

- força relativa do clube;
- diferença de overall;
- reputação do treinador;
- orçamento oferecido.

Isso deve evoluir para:

```text
ProposalScore =
  ReputationFit
+ ClubNeed
+ TacticalFit
+ PreviousResults
+ ClubAmbition
```

---

## 23. DIRETORIA

A diretoria deve ser uma entidade intermediária entre:

```text
clube ↔ treinador
```

Objetivos:

```text
Esportivo
Financeiro
Formação
Mercado
Infraestrutura
```

Cada objetivo deve ter:

```text
target
deadline
weight
currentValue
status
reward
penalty
```

---

## 24. NOTÍCIAS

Hoje as notícias da rodada são geradas por templates, utilizando eventos e mudanças reais da tabela, e não por IA generativa.

### Decisão do GDB

Manter templates estruturados por enquanto.

É melhor ter:

> 200 notícias coerentes

do que:

> IA gerando textos bonitos, mas inconsistentes.

Futuro:

```text
Game Event
 ↓
News Trigger
 ↓
News Template
 ↓
Context variables
 ↓
Headline
```

---

## 25. EVENT ENGINE

Esse será um dos componentes mais importantes da próxima geração.

```js
EVENT = {
  id,
  type,
  trigger,
  actor,
  target,
  context,
  effects,
  news,
  timestamp
}
```

Exemplo:

```js
{
  type: "PLAYER_UNHAPPY",
  actor: playerId,
  trigger: "LOW_PLAYING_TIME",
  effects: {
    morale: -10,
    transferDesire: +15
  }
}
```

---

## 26. EVENTOS DEVEM SER DATA-DRIVEN

Não espalhar:

```js
if (...)
```

por milhares de pontos do código.

Preferir:

```js
EVENT_RULES = [
  {
    id: "low_playing_time",
    trigger: ...
    effects: ...
  }
]
```

Isso será muito importante para permitir que Claude expanda o jogo sem criar lógica duplicada.

---

## 27. PERSISTÊNCIA

O backend atual:

- mantém uma carreira por usuário;
- valida `clubId`;
- valida `squad`;
- limita o tamanho do save;
- persiste o JSON;
- utiliza escrita agendada/debounce.

O limite atual é 768 KB e uma carreira multi pode nascer acima de 500 KB.

### Prioridade técnica

🟡 Não migrar imediatamente.

Mas:

**P1**

Separar conceitualmente:

```text
Game Engine
UI
Persistence
```

Mesmo que continuem no mesmo arquivo inicialmente.

---

## 28. ARQUITETURA ALVO

O objetivo futuro:

```text
                    UI
                     │
                     ↓
              Game Controller
                     │
        ┌────────────┼────────────┐
        ↓            ↓            ↓
   Match Engine  Career Engine  World Engine
        │            │            │
        └────────────┼────────────┘
                     ↓
                 Game State
                     │
                     ↓
                Persistence
```

E não:

```text
carreira.js = absolutamente tudo
```

---

## 29. ESTRUTURA DE CÓDIGO ALVO

Quando chegar a hora da refatoração:

```text
career/
│
├── engine/
│   ├── roundEngine.js
│   ├── matchEngine.js
│   ├── seasonEngine.js
│   └── worldEngine.js
│
├── systems/
│   ├── playerSystem.js
│   ├── trainingSystem.js
│   ├── transferSystem.js
│   ├── financeSystem.js
│   ├── moraleSystem.js
│   ├── boardSystem.js
│   └── reputationSystem.js
│
├── ai/
│   ├── clubAI.js
│   ├── transferAI.js
│   └── managerAI.js
│
├── events/
│   ├── eventEngine.js
│   └── eventRules.js
│
├── state/
│   ├── careerState.js
│   └── migrations.js
│
└── ui/
    ├── components/
    └── screens/
```

Não recomendo fazer essa refatoração agora.

Primeiro estabilizamos as regras.

---

## 30. MATRIZ DE PRIORIDADE

| Sistema | Atual | Próxima evolução | Prioridade |
|---|---|---|---|
| Save | 🟢 | versionamento | P1 |
| Jogadores | 🟢 | personalidade | P1 |
| Treino | 🟢 | maior profundidade | P2 |
| Tática | 🟢 | efeitos contextuais | P1 |
| Match Engine | 🟢 | decisões → eventos | P0 |
| CPU | 🟡 | identidade | P0 |
| Mercado | 🟢 | IA contextual | P0 |
| Finanças | 🟢 | decisões estratégicas | P1 |
| Moral | 🟢 | relacionamentos | P1 |
| Diretoria | 🟢 | dinâmica | P1 |
| Carreira | 🟢 | especializações | P0 |
| Notícias | 🟢 | narrativa contextual | P2 |
| Mundo | 🟡 | simulação global | P0 |
| Arquitetura | 🟡 | modularização | P2 |

---

## 31. OS 4 GRANDES MOTORES

A partir daqui eu considero que o jogo deve ser pensado como quatro motores:

**⚽ MATCH ENGINE**

O que acontece dentro da partida?

**🏢 CAREER ENGINE**

O que acontece com o treinador?

**🌎 WORLD ENGINE**

O que acontece no futebol ao redor do jogador?

**💰 ECONOMY ENGINE**

Como dinheiro, mercado e recursos se movimentam?

Eles se alimentam mutuamente:

```text
             ┌──────────────┐
             │ MATCH ENGINE │
             └──────┬───────┘
                    ↓
             RESULTADOS
                    ↓
       ┌────────────┴────────────┐
       ↓                         ↓
CAREER ENGINE              WORLD ENGINE
       ↓                         ↓
REPUTAÇÃO                   MERCADO / NOTÍCIAS
       └────────────┬────────────┘
                    ↓
             ECONOMY ENGINE
                    ↓
                 CLUBE
                    ↓
             NOVA TEMPORADA
```

---

## 32. REGRA PARA O CLAUDE

Esta é talvez a parte mais importante do documento.

Antes de modificar o jogo, o agente de desenvolvimento deve sempre executar:

1. IDENTIFICAR
2. LOCALIZAR
3. ENTENDER
4. REUTILIZAR
5. ALTERAR
6. VALIDAR

Nunca:

> "Criar um sistema de mercado."

Sempre:

> "Localizar o sistema de mercado existente, compreender seus contratos e ampliar sua capacidade."

---

## 33. CONTRATO DE DESENVOLVIMENTO

Toda nova feature deve responder:

```text
FEATURE
│
├── Qual problema resolve?
├── Qual entidade altera?
├── Qual estado altera?
├── Quais sistemas consomem esse estado?
├── Quais eventos gera?
├── Qual impacto econômico?
├── Qual impacto esportivo?
├── Qual impacto na carreira?
├── Qual impacto na UI?
└── Como será persistida?
```

Se não conseguir responder essas perguntas:

> a feature ainda não está pronta para desenvolvimento.

---

## 34. DEFINITION OF DONE

Uma funcionalidade só está pronta quando:

**Produto**
- [ ] cria decisão;
- [ ] possui consequência;
- [ ] está integrada ao loop.

**Game Design**
- [ ] possui regras;
- [ ] possui limites;
- [ ] não cria exploit óbvio.

**Técnico**
- [ ] estado persistido;
- [ ] compatível com saves antigos;
- [ ] sem duplicação de lógica;
- [ ] sem quebrar sistemas existentes.

**UX**
- [ ] usa BR Data DS;
- [ ] funciona no mobile;
- [ ] estados de loading/erro/vazio;
- [ ] feedback da ação.

**QA**
- [ ] cenário positivo;
- [ ] cenário negativo;
- [ ] edge cases;
- [ ] save/load;
- [ ] nova temporada.

---

## 35. PRIMEIRO BACKLOG DERIVADO DO GDB

Agora sim chegamos a um backlog que considero tecnicamente coerente.

### P0 — Match Engine 2.0

Objetivo: fazer a partida refletir melhor as decisões.

- [ ] contextualizar tática;
- [ ] criar momentum;
- [ ] melhorar impacto de substituições;
- [ ] melhorar efeito de cartões;
- [ ] criar padrões de jogo;
- [ ] melhorar estatísticas;
- [ ] validar equilíbrio.

### P0 — World Engine

Objetivo: fazer o mundo existir independentemente do jogador.

- [ ] técnicos CPU;
- [ ] demissões;
- [ ] contratações CPU;
- [ ] evolução de clubes;
- [ ] mercado global;
- [ ] notícias;
- [ ] classificação entre divisões;
- [ ] eventos.

### P0 — Career Engine 2.0

- [ ] perfil do treinador;
- [ ] especializações;
- [ ] estilo;
- [ ] histórico;
- [ ] evolução;
- [ ] reputação contextual;
- [ ] mercado de treinadores.

### P1 — Player Engine 2.0

- [ ] personalidade;
- [ ] relacionamento;
- [ ] hierarquia;
- [ ] liderança;
- [ ] ambição;
- [ ] insatisfação;
- [ ] desenvolvimento.

### P1 — Economy Engine 2.0

- [ ] orçamento anual;
- [ ] fluxo de caixa;
- [ ] decisões de investimento;
- [ ] impacto do estádio;
- [ ] folha;
- [ ] sustentabilidade;
- [ ] economia dos clubes CPU.

---

## 36. A PRINCIPAL DECISÃO DO GDB

Eu colocaria isso literalmente no topo do documento que será entregue ao Claude:

> **BR Data Treinador não deve evoluir pela quantidade de funcionalidades. Deve evoluir pela quantidade de sistemas que reagem uns aos outros.**
