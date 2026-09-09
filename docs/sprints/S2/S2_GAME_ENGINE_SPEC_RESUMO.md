BR DATA TREINADOR

GAME ENGINE SPECIFICATION

Sprint: S2
Versão: 1.0
Status: Base para implementação
Plataforma: Web / Mobile Web

⸻

1. Princípios

**1.1 Decisão > Resultado**

O treinador aumenta ou reduz probabilidades.

Não determina diretamente o resultado.

**1.2 Sistemas conectados**

Decisões importantes devem gerar consequências sistêmicas.

**1.3 Aleatoriedade contextual**

Randomização deve respeitar:

* força;
* contexto;
* estado;
* estratégia.

**1.4 CPU também joga**

Clubes controlados pela IA devem possuir objetivos e comportamento próprios.

**1.5 Mundo persistente**

Os acontecimentos devem continuar acontecendo sem depender da ação direta do jogador.

⸻

2. Game State

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

⸻

3. Ciclo de rodada

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

⸻

4. Match Engine

Variáveis:

* Attack;
* Defense;
* Goalkeeper;
* Condition;
* Morale;
* TacticalFit;
* FormationFit.

Modelo conceitual:

```
AttackPower =
BaseAttack
× SquadQuality
× FormationModifier
× TacticalModifier
× ConditionModifier
× MoraleModifier
× TacticalFit

DefensePower =
BaseDefense
× SquadQuality
× FormationModifier
× TacticalModifier
× ConditionModifier
× MoraleModifier
× TacticalFit
```

⸻

5. Mando de campo

O mandante recebe vantagem contextual:

```
HomeAdvantage > 1.0
AwayAdvantage = 1.0
```

A vantagem não deve tornar o resultado previsível.

⸻

6. Substituições

Substituições devem alterar imediatamente o estado da equipe.

O jogador que entra passa a contribuir com:

* posição;
* condição;
* moral;
* atributos;
* função tática.

A força da equipe deve ser recalculada.

⸻

7. Alterações táticas ao vivo

Alterações possuem efeito temporal.

Exemplo:

```
Ofensiva
Attack ↑
Defense ↓
Fatigue ↑

Defensiva
Attack ↓
Defense ↑
OpponentSpace ↓
```

Alterações não devem recalcular retroativamente eventos já ocorridos.

⸻

8. Player Engine

**Capacidade**

* Overall;
* Potential;
* Attack;
* Defense;
* Physical;
* Technical.

**Estado**

* Condition;
* Morale;
* Form;
* Confidence;
* Fatigue;
* Injury;
* Suspension.

**Contexto**

* PlayingTime;
* Role;
* Salary;
* Contract;
* Relationship;
* TransferDesire.

⸻

9. Forma

A forma representa desempenho recente.

Janela conceitual:

```
últimos 5 jogos
```

Entradas:

* rating;
* gols;
* assistências;
* erros;
* minutos;
* resultado.

A forma influencia desempenho, mas não substitui os atributos.

⸻

10. Moral

Inputs:

```
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

```
PerformanceModifier
ComplaintProbability
TransferRequestProbability
TeamChemistry
```

⸻

11. Personalidade

Traços possíveis:

```
Ambition
Professionalism
Loyalty
Leadership
Patience
Temperament
```

Escala:

```
0–100
```

⸻

12. Evolução

```
Development =
Training
+ MatchMinutes
+ AgeFactor
+ PotentialFactor
+ Professionalism
+ CoachDevelopmentBonus
```

O ganho diminui conforme o jogador se aproxima do teto.

⸻

13. Declínio

```
18–23  crescimento
24–27  pico
28–30  estabilidade
31–33  início de declínio
34+    declínio maior
```

⸻

14. Training Engine

```
Focus
Intensity
Group
Schedule
```

Focos:

* equilibrado;
* ataque;
* defesa;
* físico;
* tático;
* técnico.

Intensidades:

* leve;
* moderada;
* intensa.

⸻

15. Transfer Engine

Estados:

```
AVAILABLE
OFFERED
NEGOTIATING
ACCEPTED
REJECTED
COMPLETED
CANCELLED
```

⸻

16. IA de mercado

Clubes consideram:

```
Budget
WageBudget
SquadNeeds
PreferredAge
PreferredPositions
TacticalStyle
TransferStrategy
```

Estratégias:

* Formador;
* Comprador;
* Vendedor;
* Conservador;
* Agressivo;
* Empréstimos.

⸻

17. Finance Engine

**Receitas**

* Matchday;
* Sponsorship;
* Prize;
* PlayerSales;
* Other.

**Despesas**

* Wages;
* Transfers;
* Installments;
* Stadium;
* Scouting;
* Academy;
* Other.

Toda alteração deve gerar lançamento identificável.

⸻

18. Board Engine

Objetivos:

```
Target
Deadline
Weight
CurrentValue
Status
Reward
Penalty
```

Categorias:

* esportivo;
* financeiro;
* formação;
* mercado;
* infraestrutura.

⸻

19. Reputation Engine

Escala:

```
0–100
```

Influências positivas:

* vitórias;
* títulos;
* acessos;
* desenvolvimento;
* objetivos cumpridos.

Influências negativas:

* derrotas;
* rebaixamento;
* demissão;
* crise;
* objetivos fracassados.

⸻

20. Career Engine

Registrar:

```
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

⸻

21. World Engine

O mundo simula:

* resultados;
* mercado;
* técnicos;
* demissões;
* promoções;
* rebaixamentos;
* desenvolvimento;
* finanças;
* notícias.

⸻

22. CPU Manager

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

⸻

23. CPU Club Decision Loop

```
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

⸻

24. Determinismo

Sempre que possível:

```
mesmo estado
+
mesma seed
+
mesmas decisões
=
mesmo resultado
```

⸻

25. Explicabilidade

Resultados importantes devem possuir explicação contextual.

⸻

26. Emergência

Sistemas devem permitir:

```
causa
→ consequência
→ nova situação
→ nova decisão
```

⸻

Status final: CONCLUÍDA
