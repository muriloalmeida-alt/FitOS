# BR DATA TREINADOR
# GAME ENGINE SPECIFICATION
## Especificação do Motor de Jogo — v1.0

**Produto:** BR Data Treinador  
**Documento:** Game Engine Specification  
**Versão:** 1.0  
**Status:** Base para implementação  
**Plataforma:** Web / Mobile Web  
**Princípio central:** decisões do treinador devem gerar consequências sistêmicas.

---

## 1. Objetivo

Este documento especifica as regras funcionais e técnicas dos principais motores do BR Data Treinador.

Ele complementa o Game Design Bible e o GDB Técnico.

O documento não substitui o código atual. Antes de implementar qualquer alteração, o agente deve verificar o comportamento existente e preservar funcionalidades já implementadas.

---

## 2. Princípios

### 2.1 Decisão > Resultado
O treinador aumenta ou reduz probabilidades. Não determina resultados.

### 2.2 Sistemas conectados
Toda decisão importante deve alterar algum sistema esportivo, financeiro, humano, institucional ou de carreira.

### 2.3 Aleatoriedade contextual
Randomização deve ocorrer dentro de limites coerentes com força, contexto, estado e estratégia.

### 2.4 CPU também joga
Clubes controlados pela IA devem possuir objetivos e comportamento próprios.

### 2.5 Mundo persistente
Os acontecimentos do futebol devem continuar acontecendo sem depender da ação direta do jogador.

---

## 3. Game Engine

```text
Game State
    |
    +-- Career Engine
    +-- Match Engine
    +-- Player Engine
    +-- Transfer Engine
    +-- Economy Engine
    +-- World Engine
    +-- Event Engine
    +-- Persistence
```

Os motores devem compartilhar o estado da carreira através de interfaces claras.

---

## 4. Game State

Estrutura conceitual:

```js
CAREER = {
  schemaVersion,
  seasonYear,
  currentRound,

  manager,
  club,

  squad,
  leagueSquads,

  lineup,
  tactics,
  training,

  schedule,
  standings,

  finances,
  stadium,

  transfers,
  contracts,

  objectives,
  achievements,

  reputation,
  news,
  events,

  history
}
```

Estado transitório de UI ou partida em andamento não deve ser persistido como parte permanente da carreira.

---

## 5. Versionamento

Todo save deve possuir `schemaVersion`.

Novas versões devem utilizar migrações:

```text
Save v1
  ↓
Migration v1 → v2
  ↓
Save v2
```

Nunca quebrar uma carreira existente por causa de uma nova feature.

---

## 6. Ciclo de rodada

A rodada é a principal unidade temporal do jogo.

Fluxo recomendado:

```text
1. Validar estado
2. Aplicar treinamento
3. Recuperar jogadores
4. Processar contratos
5. Processar mercado
6. Executar IA dos clubes
7. Simular partidas
8. Atualizar jogadores
9. Atualizar finanças
10. Atualizar diretoria
11. Atualizar reputação
12. Gerar eventos
13. Gerar notícias
14. Atualizar objetivos
15. Avançar rodada
16. Persistir save
```

A ordem deve ser determinística.

---

## 7. Match Engine

### 7.1 Objetivo
Simular partidas de forma rápida, compreensível, estratégica e imprevisível.

### 7.2 Variáveis de força

- Attack
- Defense
- Goalkeeper
- Condition
- Morale
- TacticalFit
- FormationFit

### 7.3 Força ofensiva

```text
AttackPower =
BaseAttack
× SquadQuality
× FormationModifier
× TacticalModifier
× ConditionModifier
× MoraleModifier
× TacticalFit
```

### 7.4 Força defensiva

```text
DefensePower =
BaseDefense
× SquadQuality
× FormationModifier
× TacticalModifier
× ConditionModifier
× MoraleModifier
× TacticalFit
```

Os modificadores devem permanecer em faixas moderadas para impedir exploits.

---

## 8. Vantagem de mando

O mandante recebe vantagem contextual.

```text
HomeAdvantage > 1.0
AwayAdvantage = 1.0
```

A vantagem não deve tornar resultados previsíveis.

---

## 9. Geração de gols

A implementação atual utiliza uma abordagem baseada em expectativa de gols e distribuição de Poisson.

```text
λ_home = f(HomeAttack, AwayDefense, Context)
λ_away = f(AwayAttack, HomeDefense, Context)

HomeGoals ~ Poisson(λ_home)
AwayGoals ~ Poisson(λ_away)
```

Os valores devem possuir limites mínimos e máximos para evitar resultados absurdos.

---

## 10. Momentum

Adicionar uma variável temporária:

```text
momentum = -100 ... +100
```

Exemplos de impacto:

```text
Gol                 +15
Grande chance        +5
Defesa decisiva      +5
Cartão vermelho     -20
Gol sofrido         -15
Substituição decisiva +5
```

Momentum deve ser um modificador pequeno, nunca determinístico.

---

## 11. Eventos de partida

Eventos possíveis:

- gol;
- assistência;
- finalização;
- defesa;
- cartão amarelo;
- cartão vermelho;
- lesão;
- substituição;
- grande chance;
- erro;
- contra-ataque;
- bola parada.

Estrutura:

```js
MATCH_EVENT = {
  minute,
  type,
  teamId,
  playerId,
  secondaryPlayerId,
  impact
}
```

---

## 12. Cartões

Cartões devem considerar:

```text
TackleIntensity
Pressure
Aggression
RefereeVariance
GameState
```

Expulsão altera significativamente força, posse, criação e defesa.

---

## 13. Lesões

Risco de lesão deve considerar:

```text
Age
Condition
Fatigue
TrainingLoad
PreviousInjury
MatchIntensity
Randomness
```

---

## 14. Substituições

Substituições durante a partida devem alterar o estado imediatamente.

O jogador que entra passa a contribuir com:

- posição;
- condição;
- moral;
- atributos;
- função tática.

A força da equipe deve ser recalculada a partir daquele momento.

---

## 15. Alteração tática ao vivo

Mudanças táticas possuem efeitos temporais.

Exemplo:

```text
Ofensiva
Attack ↑
Defense ↓
Fatigue ↑
```

```text
Defensiva
Attack ↓
Defense ↑
OpponentSpace ↓
```

A alteração não deve recalcular retroativamente eventos já ocorridos.

---

## 16. Intervalo

O intervalo permite:

- substituições;
- alteração tática;
- leitura do contexto;
- retomada.

Futuro:

```text
TeamTalk
```

pode alterar moral, concentração e intensidade.

---

## 17. Player Engine

### Capacidade

- Overall
- Potential
- Attack
- Defense
- Physical
- Technical

### Estado

- Condition
- Morale
- Form
- Confidence
- Fatigue
- Injury
- Suspension

### Contexto

- PlayingTime
- Role
- Salary
- Contract
- Relationship
- TransferDesire

---

## 18. Forma

A forma deve representar desempenho recente.

Janela sugerida:

```text
últimos 5 jogos
```

Entradas:

- rating;
- gols;
- assistências;
- erros;
- minutos;
- resultado.

Forma influencia desempenho, mas não substitui os atributos do jogador.

---

## 19. Moral

Inputs:

```text
PlayingTime
Results
Performance
Contract
Promises
Relationship
TeamStatus
TransferInterest
```

Outputs:

```text
PerformanceModifier
ComplaintProbability
TransferRequestProbability
TeamChemistry
```

---

## 20. Personalidade

Jogadores podem possuir traços:

```text
Ambition
Professionalism
Loyalty
Leadership
Patience
Temperament
```

Cada traço varia de 0 a 100.

---

## 21. Evolução

Modelo conceitual:

```text
Development =
Training
+ MatchMinutes
+ AgeFactor
+ PotentialFactor
+ Professionalism
+ CoachDevelopmentBonus
```

O ganho deve diminuir conforme o jogador se aproxima do teto de desenvolvimento.

---

## 22. Declínio

Curva conceitual:

```text
18–23  crescimento
24–27  pico
28–30  estabilidade
31–33  início de declínio
34+    declínio maior
```

Os limites podem variar por posição.

---

## 23. Training Engine

Treinamento possui:

```text
Focus
Intensity
Group
Schedule
```

Focos:

- equilibrado;
- ataque;
- defesa;
- físico;
- tático;
- técnico.

Intensidade:

- leve;
- moderada;
- intensa.

Trade-off:

```text
Intensity ↑
    ↓
DevelopmentPotential ↑
    +
Fatigue ↑
    +
InjuryRisk ↑
```

---

## 24. Transfer Engine

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

Estrutura:

```js
TRANSFER = {
  playerId,
  sellerClubId,
  buyerClubId,
  fee,
  installments,
  salary,
  contractYears,
  status,
  window
}
```

---

## 25. IA de mercado

Cada clube deve possuir:

```text
Budget
WageBudget
SquadNeeds
PreferredAge
PreferredPositions
TacticalStyle
TransferStrategy
```

Estratégias:

- Formador;
- Comprador;
- Vendedor;
- Conservador;
- Agressivo;
- Empréstimos.

---

## 26. Score de contratação

```text
TransferScore =
NeedScore
+ QualityScore
+ TacticalFit
+ AgeFit
+ Potential
+ FinancialFit
+ StrategyFit
```

A IA seleciona oportunidades dentro das restrições financeiras.

---

## 27. Contratos

Contrato:

```text
Salary
Years
Role
ReleaseClause
SigningBonus
```

Estados:

```text
ACTIVE
EXPIRING
RENEWAL
TERMINATED
```

Contratos próximos do vencimento devem aumentar a probabilidade de renovação, negociação ou saída.

---

## 28. Finance Engine

### Receitas

- Matchday;
- Sponsorship;
- Prize;
- PlayerSales;
- Other.

### Despesas

- Wages;
- Transfers;
- Installments;
- Stadium;
- Scouting;
- Academy;
- Other.

Toda alteração financeira deve produzir um lançamento no ledger.

---

## 29. Fluxo de caixa

```text
OpeningBalance
+ Revenue
- Expenses
= ClosingBalance
```

O caixa nunca deve ser alterado sem origem identificável.

---

## 30. IA financeira

A IA deve considerar:

```text
Cash
ProjectedRevenue
WageBill
TransferBudget
Debt
Objectives
```

Clubes pressionados financeiramente devem reduzir gastos e aumentar vendas.

---

## 31. Board Engine

Objetivos possuem:

```text
Target
Deadline
Weight
CurrentValue
Status
Reward
Penalty
```

Categorias:

- esportivo;
- financeiro;
- formação;
- mercado;
- infraestrutura.

---

## 32. Board Trust

Escala:

```text
0–20   Crítico
21–40  Baixo
41–60  Normal
61–80  Alto
81–100 Excelente
```

Considerar:

```text
Results
Objectives
Finances
PlayerManagement
Promises
ClubExpectations
```

---

## 33. Reputation Engine

Reputação do treinador:

```text
0–100
```

Positivos:

- vitórias;
- títulos;
- acessos;
- desenvolvimento;
- objetivos cumpridos.

Negativos:

- derrotas;
- rebaixamento;
- demissão;
- crise;
- objetivos fracassados.

O peso depende da expectativa do clube.

---

## 34. Club Expectation

Resultado deve ser avaliado em relação à expectativa.

```text
Clube grande
Expectativa: campeão
Resultado: 4º
→ abaixo

Clube pequeno
Expectativa: evitar rebaixamento
Resultado: 10º
→ positivo
```

Portanto:

```text
ResultScore ≠ PositionOnly
```

---

## 35. Career Engine

Registrar:

```text
Club
Season
Games
Wins
Draws
Losses
Titles
Promotions
Relegations
AveragePosition
Reputation
```

Cada mudança de clube cria uma nova etapa.

---

## 36. Propostas de clubes

Score conceitual:

```text
ProposalScore =
CoachReputation
+ ClubNeed
+ TacticalFit
+ PreviousResults
+ ClubAmbition
```

Clubes maiores devem exigir reputação maior.

Clubes em crise podem aceitar treinadores menos renomados.

---

## 37. World Engine

O mundo simula:

- resultados;
- mercado;
- técnicos;
- demissões;
- promoções;
- rebaixamentos;
- desenvolvimento;
- finanças;
- notícias.

O futebol continua sem o jogador.

---

## 38. CPU Manager

```js
MANAGER = {
  id,
  name,
  reputation,
  tacticalProfile,
  managementProfile,
  developmentProfile
}
```

A IA deve tomar decisões baseadas no perfil.

---

## 39. CPU Club Decision Loop

```text
Avaliar elenco
      ↓
Identificar necessidades
      ↓
Avaliar orçamento
      ↓
Mercado
      ↓
Treinamento
      ↓
Escalação
      ↓
Partida
      ↓
Resultado
      ↓
Reavaliar
```

---

## 40. Event Engine

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
  createdAt
}
```

Exemplo:

```text
LOW_PLAYING_TIME
    ↓
Morale -10
    ↓
Complaint probability +15
    ↓
Potential transfer request
```

---

## 41. Eventos data-driven

Evitar espalhar regras de eventos pelo código.

Preferir:

```js
EVENT_RULES = [
  {
    id: "low_playing_time",
    trigger: "...",
    effects: [...]
  }
]
```

Isso facilita expansão sem duplicação.

---

## 42. News Engine

Fluxo:

```text
Game Event
    ↓
News Trigger
    ↓
Template
    ↓
Context
    ↓
Headline
```

Notícias devem ser consequência de acontecimentos reais.

---

## 43. Narrativa emergente

O jogo não deve depender de uma história pré-definida.

A história nasce dos sistemas:

```text
Jovem promovido
    ↓
ganha minutos
    ↓
marca gols
    ↓
vira titular
    ↓
valor aumenta
    ↓
recebe proposta
    ↓
clube decide
```

---

## 44. Balanceamento

Nenhuma variável deve dominar o jogo.

```text
No single variable should determine outcome.
```

Força do elenco continua relevante, mas:

```text
Tática
+
Forma
+
Condição
+
Moral
+
Contexto
```

devem permitir resultados inesperados.

---

## 45. Anti-exploit

Testar:

### Mercado
- comprar barato e vender imediatamente;
- propostas infinitas;
- arbitragem artificial.

### Treinamento
- treino intenso permanente;
- evolução infinita.

### Finanças
- geração infinita de dinheiro;
- valores negativos;
- duplicação de receita.

### Partidas
- mudança tática abusiva;
- substituições infinitas;
- exploração de momentum.

### Carreira
- propostas infinitas;
- reputação crescendo sem limite.

---

## 46. Determinismo

Quando possível, eventos importantes devem possuir uma seed:

```js
matchSeed
```

Isso facilita:

- debugging;
- testes;
- reprodução de bugs;
- balanceamento.

---

## 47. Observabilidade

Registrar futuramente:

```text
round
match
seed
teamStrength
tacticalModifiers
events
goals
injuries
transfers
financialChanges
```

O objetivo é responder:

> Por que este resultado aconteceu?

---

## 48. Testes

### Match

- força maior;
- mando;
- expulsão;
- lesão;
- substituição;
- mudança tática.

### Player

- evolução;
- declínio;
- moral;
- fadiga.

### Market

- orçamento;
- necessidade;
- proposta;
- transferência.

### Finance

- receita;
- despesa;
- saldo;
- ledger.

### Career

- reputação;
- proposta;
- demissão;
- mudança de clube.

---

## 49. Métricas de qualidade

Avaliar:

- distribuição de vitórias;
- distribuição de gols;
- upsets;
- média de cartões;
- média de lesões;
- evolução de jogadores;
- inflação de mercado;
- inflação salarial;
- concentração de títulos;
- rotatividade de treinadores;
- saúde financeira dos clubes.

---

## 50. Prioridades

### P0

1. Match Engine 2.0
2. World Engine
3. CPU Manager
4. Career Engine 2.0
5. Transfer AI

### P1

6. Player Personality
7. Relationship System
8. Economy 2.0
9. Board Dynamics
10. Event Engine

### P2

11. Advanced News
12. Manager Specializations
13. Advanced scouting
14. Advanced contracts
15. Long-term infrastructure

---

## 51. Regra para agentes de código

Antes de alterar qualquer sistema:

```text
1. INSPECT
2. IDENTIFY EXISTING IMPLEMENTATION
3. MAP DEPENDENCIES
4. PRESERVE CURRENT BEHAVIOR
5. IMPLEMENT MINIMAL CHANGE
6. TEST
7. VALIDATE SAVE/LOAD
8. DOCUMENT
```

Nunca assumir que uma funcionalidade não existe apenas porque documentação antiga diz que ela não existe.

---

## 52. Definition of Done

Uma alteração de engine só está pronta quando:

- [ ] regra documentada;
- [ ] estado definido;
- [ ] persistência validada;
- [ ] impacto nos sistemas dependentes validado;
- [ ] edge cases testados;
- [ ] save antigo testado;
- [ ] mobile UI validada quando aplicável;
- [ ] logs/debug disponíveis;
- [ ] sem regressão nas funcionalidades existentes.

---

## 53. Visão final

O BR Data Treinador deve evoluir de:

```text
Simulador de partidas
```

para:

```text
SIMULADOR DE CARREIRA
```

Onde:

```text
TREINADOR
    ↓
DECISÕES
    ↓
CLUBE
    ↓
JOGADORES
    ↓
PARTIDAS
    ↓
RESULTADOS
    ↓
MERCADO
    ↓
FINANÇAS
    ↓
REPUTAÇÃO
    ↓
MUNDO
    ↓
NOVA DECISÃO
```

## Princípio final

> **O jogador controla o treinador.  
> O treinador controla suas decisões.  
> As decisões alteram o clube.  
> O clube altera o mundo.  
> E o mundo reage ao treinador.**
