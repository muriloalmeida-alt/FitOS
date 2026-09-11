# Mecânicas, Balanceamento e Economia — BRDATA (Modo Carreira)

**Origem:** `docs/sprints/S2/S2_GDD.md` (seções de mecânica) +
`docs/sprints/S2/S2_GAME_ENGINE_SPEC.md` (Game Engine Specification
v1.0). **Migrado por:** `DOCS-REQ-001` (11/09/2026).

Este documento cobre as **regras de jogo** (o "como" mecânico) que
complementam a visão de produto (`functional/`) e a arquitetura técnica
(`technical/`). Onde uma regra aqui é "direção proposta" e não
necessariamente implementada, isso é sinalizado — não presumido como
estado atual.

---

## 1. Princípios centrais do motor

1. **Decisão > Resultado** — o treinador aumenta ou reduz
   probabilidades, nunca determina resultados diretamente.
2. **Sistemas conectados** — toda decisão importante deve alterar algum
   sistema esportivo, financeiro, humano, institucional ou de carreira.
3. **Aleatoriedade contextual** — randomização deve ocorrer dentro de
   limites coerentes com força, contexto, estado e estratégia (nunca
   pura sorte desconectada do estado do jogo).
4. **CPU também joga** — clubes controlados por IA devem ter objetivos e
   comportamento próprios, não decisões aleatórias sem contexto.
5. **Mundo persistente** — o futebol ao redor continua acontecendo sem
   depender da ação direta do jogador.

## 2. Jogadores — evolução e declínio

### Evolução (modelo conceitual)
```
Development = Training + MatchMinutes + AgeFactor + PotentialFactor + Professionalism + CoachDevelopmentBonus
```
O ganho deve diminuir conforme o jogador se aproxima do teto de
desenvolvimento (potencial) — **regra vigente confirmada no código**:
existe teto por jogador com retorno decrescente perto do limite. Nunca
permitir "qualquer jogador → 99 só por acumular semanas".

### Declínio (curva conceitual por idade)
```
18–23  crescimento
24–27  pico
28–30  estabilidade
31–33  início de declínio
34+    declínio maior
```
Os limites exatos podem variar por posição (goleiros declinam mais
tarde, por exemplo) — confirmar contra o código antes de tratar como
regra fixa universal.

### Forma
Deve representar desempenho recente — janela sugerida: **últimos 5
jogos** (rating, gols, assistências, erros, minutos, resultado). Forma
influencia desempenho, mas **não substitui** os atributos base do
jogador.

## 3. Moral e personalidade

Inputs de moral: playing time, resultados, desempenho, contrato,
promessas, relacionamento, status no time, interesse de outros clubes.
Outputs: modificador de performance, probabilidade de reclamação,
probabilidade de pedido de transferência, "team chemistry".

Traços de personalidade possíveis (0–100 cada, conceitual): ambição,
profissionalismo, lealdade, liderança, paciência, temperamento — ver
nota de reconciliação, grau de implementação real a confirmar.

## 4. Treinamento (Training Engine)

Eixos: **Foco** (equilibrado/ataque/defesa/físico/tático/técnico),
**Intensidade** (leve/moderada/intensa), **Grupo** (elenco/misto/
individual), **Schedule** (semana virtual).

Trade-off obrigatório:
```
Intensidade ↑ → DevelopmentPotential ↑ + Fadiga ↑ + InjuryRisk ↑
```
Nunca "treino forte = sempre melhor" sem custo.

## 5. Tática — os 4 eixos + instruções por setor

**Eixos principais** (escala 1–5, 3 = neutro): ritmo de jogo, pressão,
linha defensiva, estilo de passe.

**Instruções por setor:**
- **Defesa** — linha defensiva, pressão pós-perda, compactação, saída de
  bola, bola parada defensiva.
- **Meio** — intensidade de marcação, amplitude, transição, circulação/
  rotação de bola, cobertura de espaços.
- **Ataque** — amplitude ofensiva, movimentação, últimos passes,
  finalização, bola parada ofensiva.

**Regra:** a tática deve alterar probabilidades, nunca determinar
eventos diretamente.

## 6. Formações

Biblioteca vigente (14 formações — lista idêntica já consolidada em
`CLAUDE.md` §15): 4-4-2, 4-3-3, 4-2-3-1, 3-5-2, 4-5-1, 5-3-2, 4-1-4-1,
4-4-1-1, 3-4-3, 4-1-3-2, 3-4-2-1, 4-3-1-2, 4-2-2-2, 5-4-1.

## 7. Match Engine — regras de simulação

### Variáveis de força
Attack, Defense, Goalkeeper, Condition, Morale, TacticalFit,
FormationFit.

### Fórmulas conceituais de força
```
AttackPower  = BaseAttack  × SquadQuality × FormationModifier × TacticalModifier × ConditionModifier × MoraleModifier × TacticalFit
DefensePower = BaseDefense × SquadQuality × FormationModifier × TacticalModifier × ConditionModifier × MoraleModifier × TacticalFit
```
Modificadores devem ficar em faixas moderadas (anti-exploit — nenhum
multiplicador deve dominar o resultado sozinho).

### Vantagem de mando
`HomeAdvantage > 1.0`, `AwayAdvantage = 1.0` — vantagem contextual, sem
tornar o resultado previsível.

### Geração de gols
Expectativa de gols via distribuição de Poisson, com limites mín/máx:
```
λ_home = f(HomeAttack, AwayDefense, Context)
λ_away = f(AwayAttack, HomeDefense, Context)
HomeGoals ~ Poisson(λ_home) · AwayGoals ~ Poisson(λ_away)
```

### Momentum
Variável temporária (-100 a +100), modificador **pequeno, nunca
determinístico**:
```
Gol +15 · Grande chance +5 · Defesa decisiva +5 · Cartão vermelho -20 · Gol sofrido -15 · Substituição decisiva +5
```

### Eventos de partida
gol, assistência, finalização, defesa, cartão amarelo/vermelho, lesão,
substituição, grande chance, erro, contra-ataque, bola parada.

### Cartões
Considerar: intensidade de disputa, pressão, agressividade, variância do
árbitro, estado do jogo. Expulsão altera significativamente força,
posse, criação e defesa.

### Lesões
Risco deve considerar: idade, condição, fadiga, carga de treino, lesão
prévia, intensidade da partida, aleatoriedade.

### Substituições e alteração tática ao vivo
Substituição altera o estado imediatamente (posição, condição, moral,
atributos, função tática do jogador que entra) — força da equipe
recalculada a partir daquele momento. Alteração tática tem efeito
temporal (ex.: postura ofensiva sobe ataque e desce defesa, aumenta
fadiga; postura defensiva o inverso, reduz espaço do adversário) e
**não deve recalcular retroativamente** eventos já ocorridos.

## 8. IA dos clubes (World Engine / CPU)

Cada clube deve ter **personalidade** (conservador, agressivo, formador,
vendedor, gastador), **estratégia** (contratar, vender, desenvolver,
emprestar) e **necessidades por posição** derivadas do elenco real —
decisões da CPU devem ser plausíveis e contextuais, nunca aleatórias sem
explicação (mesmo princípio de `CLAUDE.md` §22).

### CPU Club Decision Loop (conceitual)
```
Avaliar elenco → identificar necessidades → avaliar orçamento → mercado
→ treinamento → escalação → partida → resultado → reavaliar
```

## 9. Mercado e IA de transferências

Cada clube deve ter perfil: orçamento, teto salarial, idade preferida,
posições preferidas, estilo tático, estratégia de transferência
(Formador/Comprador/Vendedor/Conservador/Agressivo/Empréstimos),
necessidades de elenco.

### Score de contratação (conceitual)
```
TransferScore = NeedScore + QualityScore + TacticalFit + AgeFit + Potential + FinancialFit + StrategyFit
```
A IA escolhe o jogador com maior score dentro das restrições
financeiras.

### Estados de uma transferência
`AVAILABLE | OFFERED | NEGOTIATING | ACCEPTED | REJECTED | COMPLETED | CANCELLED`

### Contratos
Campos conceituais: salário, anos, função, cláusula de rescisão, bônus
de assinatura. Estados: `ACTIVE | EXPIRING | RENEWAL | TERMINATED`.
Contratos próximos do vencimento devem aumentar a probabilidade de
renovação, negociação ou saída do jogador.

## 10. Finanças e economia

### Receitas / despesas
Receitas: bilheteria, patrocínio, premiação, venda de atletas, outras.
Despesas: salários, comissão técnica, transferências, parcelas,
estádio, scouting, base, outras.

### Regra de ledger (inegociável)
Toda alteração financeira deve produzir um lançamento no ledger — nunca
alterar só `cash` sem histórico rastreável.

### Fluxo de caixa
```
OpeningBalance + Revenue - Expenses = ClosingBalance
```
O caixa nunca deve mudar sem origem identificável.

### Economia — ciclo
```
Receita → Caixa → Decisões → Investimento → Performance → Receita futura
```
Exemplo-guia: investir no estádio → capacidade ↑ → bilheteria ↑ →
receita ↑ → mais dinheiro pro elenco. O dinheiro deve ser escasso o
suficiente pra gerar decisões reais, mas não tão escasso a ponto de
frustrar.

### IA financeira dos clubes CPU
Deve considerar caixa, receita projetada, folha salarial, orçamento de
transferência e dívida — clubes pressionados financeiramente devem
reduzir gastos e aumentar vendas (comportamento reativo, não estático).

## 11. Diretoria (Board Engine)

Objetivos por categoria: esportivo, financeiro, formação, mercado,
infraestrutura — cada um com alvo, prazo, peso, valor atual, status,
recompensa e penalidade. Confiança da diretoria em escala 0–100 (faixas:
0–20 Crítico, 21–40 Baixo, 41–60 Normal, 61–80 Alto, 81–100 Excelente),
considerando resultados, objetivos, finanças, gestão de jogadores,
promessas e expectativa do clube. **Punição deve ser progressiva** —
nunca demissão aleatória sem acúmulo de causa (mesmo princípio de
`CLAUDE.md` §24).

## 12. Reputação do treinador

Escala 0–100. Fatores positivos: vitórias, títulos, acessos,
desenvolvimento de jovens, objetivos cumpridos. Fatores negativos:
derrotas, rebaixamento, demissão, crise, objetivos fracassados. O peso
de cada resultado depende da **expectativa do clube** (resultado deve
ser avaliado relativo à expectativa, não só posição final absoluta).

## 13. Propostas de outros clubes ao treinador

```
ProposalScore = CoachReputation + ClubNeed + TacticalFit + PreviousResults + ClubAmbition
```
Clubes maiores devem exigir reputação maior; clubes em crise podem
aceitar treinadores menos renomados.

## 14. Notícias e narrativa emergente

Notícias devem ser consequência de eventos reais, geradas por template
(não IA generativa) — decisão de arquitetura vigente (ver `technical/`).
A narrativa não deve depender de história pré-escrita: nasce da
combinação dos sistemas (ex.: jovem promovido → ganha minutos → marca
gols → vira titular → valor sobe → recebe proposta → clube decide).

## 15. Balanceamento

Nenhuma variável isolada deve dominar o resultado. A combinação de
tática + forma + condição + moral + contexto deve permitir resultados
inesperados (upsets), sem tornar o jogo arbitrário. Antes de alterar
qualquer valor de balanceamento, observar distribuição (média, mediana,
extremos, evolução por temporada) — nunca balancear olhando um caso
isolado (mesmo princípio de `CLAUDE.md` §30).

## 16. Anti-exploit (checklist por sistema)

Testar sistematicamente:

- **Mercado** — comprar barato e vender imediatamente por valor
  artificial; propostas infinitas; arbitragem artificial.
- **Treinamento** — treino intenso permanente sem custo; evolução
  infinita.
- **Finanças** — geração infinita de dinheiro; valores negativos;
  duplicação de receita.
- **Partidas** — mudança tática abusiva; substituições infinitas;
  exploração de momentum.
- **Carreira** — propostas infinitas; reputação crescendo sem limite.

Pergunta obrigatória antes de qualquer nova mecânica econômica: "como um
jogador tentaria quebrar esse sistema?" (mesmo princípio de `CLAUDE.md`
§29).

## 17. Métricas de qualidade (para avaliação de balanceamento)

Distribuição de vitórias, distribuição de gols, frequência de upsets,
média de cartões, média de lesões, evolução de jogadores ao longo do
tempo, inflação de mercado, inflação salarial, concentração de títulos
entre poucos clubes, rotatividade de treinadores, saúde financeira dos
clubes CPU.

## 18. Testes obrigatórios por sistema (checklist de QA de mecânica)

- **Match** — força maior vence mais; mando de campo importa; expulsão
  afeta o jogo; lesão remove jogador; substituição funciona; mudança
  tática tem efeito.
- **Player** — evolução funciona; declínio por idade funciona; moral
  responde a inputs; fadiga acumula e recupera.
- **Market** — orçamento é respeitado; necessidade de posição influencia
  IA; proposta segue fluxo correto; transferência conclui corretamente.
- **Finance** — receita/despesa/saldo/ledger batem entre si.
- **Career** — reputação responde a resultados; proposta de clube
  aparece; demissão acontece quando esperado; mudança de clube funciona.

---

## Nota de reconciliação (obrigatória por `docs/README.md` regra 4)

Este documento mistura **regras conceituais/fórmulas de referência** (o
"espírito" do balanceamento, ainda válido como direção de design) com
alguns detalhes que podem já ter evoluído no código real (`carreira.js`)
desde 14/08/2026 — em particular Match Engine, IA de mercado e sistema
de moral já passaram por iterações registradas em
`docs/project/CHANGELOG.md` (ex.: "Transfer AI Fase 1.x", "Fase 2 —
moral do elenco") que podem ter refinado ou substituído partes do
modelo conceitual aqui descrito. Qualquer ajuste de balanceamento real
deve partir do código atual e do `CHANGELOG.md`, usando este documento
como referência de princípios (anti-exploit, determinismo, "decisão >
resultado"), não como a fórmula exata vigente linha a linha.
