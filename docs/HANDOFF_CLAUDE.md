HANDOFF_CLAUDE — Demandas vigentes e histórico

As regras de governança deste Handoff estão definidas em
docs/README_HANDOFF.md. Claude deve consultar o README_HANDOFF.md
para conhecer as regras (responsabilidades, fluxo, estados, escopo,
divergências, aprovação) — elas não são repetidas aqui.

⸻

Demandas vigentes

GE-BALANCE-003 — Corrigir inversão de defesa no motor de partida

Status: REVISÃO DO PM NECESSÁRIA
Branch: `claude/ge-balance-003-impl` (checkpoint de desenho aprovado em
`claude/ge-balance-003-design`, mesclado antes desta implementação)
Sprint: fora da S4 (Game Engine — CLAUDE.md §13, mais próximo de S6
"Motor de partida 2.0" no roadmap oficial, tratado aqui como demanda
isolada — achado de `GE-BALANCE-001`, não pedido original do usuário)
Prioridade: P1
Issue: https://github.com/muriloalmeida-alt/FitOS/issues/30

Objetivo

Corrigir uma inversão real no cálculo de defesa do motor de partida —
hoje, em 2 pontos distintos, "melhor defesa" produz numericamente
**mais** gols sofridos, não menos. Recalibrar sem quebrar o
comportamento agregado já validado do campeonato (pontos por
temporada, distribuição de resultados).

Contexto

Achado registrado como recomendação pelo relatório técnico de
`GE-BALANCE-001` (issue #26, não incluído naquela implementação de
propósito — risco/escopo maiores) — **verificado de forma
independente nesta sessão, direto no código e nos dados, não apenas
relatado**:

1. **`computeHumanStrength` (`carreira.js:5093`)**: `def:
   clamp(club.def / clamp(defMult, 0.55, 1.6), 0.3, 2.6)` — `defMult`
   já embute condição física/completude do elenco/tática
   (`carreira.js:5090`). Como o gol esperado do ADVERSÁRIO usa esse
   valor como divisor (`lambdaAway = as.atk / hs.def`,
   `carreira.js:5100`/`2461`/`7705` — mesma fórmula repetida em 3
   pontos), um `defMult` MENOR (time em pior condição) produz um `def`
   MAIOR, que **reduz** o gol esperado do adversário. Confirmado:
   quanto pior a condição física do time titular, "melhor" fica a
   defesa na fórmula — o oposto do esperado. Só afeta o clube humano
   (`computeHumanStrength` não é usado pra CPU).
2. **Calibração `atk`/`def` em `public/js/data.js`**: confirmado por
   amostragem direta — Flamengo (`atk:1.85, def:0.78`), Palmeiras
   (`atk:1.80, def:0.75`) têm valores de `def` MENORES que Cuiabá
   (`atk:1.08, def:1.32`). Como a mesma fórmula usa `def` como divisor
   do ataque adversário, um `def` menor produz MAIS gols esperados
   contra aquele time — ou seja, pela calibração atual, Flamengo e
   Palmeiras são estruturalmente **mais fáceis de fazer gol** do que
   Cuiabá, o oposto do que se esperaria de 2 das defesas mais
   qualificadas do campeonato real. Isso afeta TODO jogo do motor,
   CPU x CPU incluído — não é um problema isolado do clube humano
   como o item 1.

**Duas hipóteses de causa-raiz, a avaliar com evidência antes de
decidir qual corrigir** (não presumido aqui):
a. a fórmula do gol esperado (`atk_atacante / def_defensor`) foi
   desenhada assumindo "def maior = defesa melhor" (uma força), mas os
   valores de `def` em `data.js` foram curados com o sentido oposto
   ("def menor = concede menos gols", tipo um coeficiente de gols
   sofridos/GAA) — nesse caso o conserto é na FÓRMULA (trocar divisão
   por multiplicação do def do defensor), não nos ~180 valores de
   `data.js`;
b. os valores de `def` em `data.js` realmente foram curados errado
   (deveriam refletir força defensiva, maior=melhor, mas foram
   digitados como se fosse o oposto) — nesse caso o conserto é
   recalibrar os dados, não a fórmula.

O item 1 (`computeHumanStrength`) é um bug isolado e de baixo risco
independente da hipótese escolhida pro item 2 — a mesma correção de
direção (trocar `/` por `*`, ou inverter o sentido de `defMult`)
resolve os dois casos.

Escopo

Chapéu implementador deve, ANTES de tocar em `data.js` ou em qualquer
fórmula usada por CPU x CPU:

1. Inspecionar todos os pontos que leem `club.def`/`p.def` na fórmula
   de gol (confirmar se são realmente só os 3 já identificados) e
   todo ponto que já depende do sentido atual de `def` pra outra
   coisa (ex.: valuation de jogador, scouting, exibição de atributo
   pro usuário) — mudar o sentido de `def` sem checar isso quebra
   silenciosamente outro sistema.
2. Determinar com evidência qual das 2 hipóteses (a ou b) é a causa
   raiz — ex.: rodar os valores atuais de `data.js` contra tabelas
   reais de gols sofridos dos mesmos clubes na temporada de origem
   dos dados, ver qual hipótese bate melhor com a realidade.
3. **Corrigir primeiro o item 1** (`computeHumanStrength`, isolado,
   baixo risco) — validar com simulação (mesmo padrão de
   `sim_ge_balance_001.js`) que o efeito de condição física na defesa
   passa a ir na direção certa (pior condição = mais gols sofridos).
4. Pra o item 2 (calibração de `data.js` ou fórmula global): propor e
   registrar aqui (retornando ao PM pra validação antes de
   implementar, dado que afeta CPU x CPU e todo o campeonato) a
   correção escolhida, com evidência da hipótese a/b.
5. Validar a correção do item 2 com simulação de campeonato completo
   (todas as 60 equipes, múltiplas temporadas) comparando distribuição
   de gols/pontos antes/depois — confirmar que times historicamente
   fortes (Flamengo, Palmeiras) não pioram de forma implausível nem
   melhoram artificialmente além do razoável; e que a validação já
   feita por `GE-BALANCE-001`/`002` (sequências de invencibilidade,
   redução de rebaixamento de tradicionais) continua válida depois da
   mudança — rodar os mesmos `sim_ge_balance_001.js`/`002.js` de novo
   e confirmar que os números não regridem.
6. Testar que nenhuma outra regra de negócio quebra (valuation de
   transferência, scouting, exibição de atributo).
7. Retornar relatório técnico nesta mesma seção, status `REVISÃO DO PM
   NECESSÁRIA` — o item 2 (checkpoint de desenho) retorna ANTES, como
   checkpoint intermediário obrigatório, mesmo padrão de `GE-COPA-001`.

Fora de escopo

* qualquer mudança de regra de negócio não ligada à fórmula de gol
  (fadiga em si, moral, treinamento);
* recalibrar `atk` (só `def` está sob suspeita aqui);
* Copa do Brasil (`GE-COPA-001`, motor de partida compartilhado mas
  demanda separada — esta correção se aplica automaticamente lá
  também, sem trabalho extra, já que `simulateCupTie` usa a mesma
  fórmula).

Dependências

* `computeHumanStrength`, `lambdaHome`/`lambdaAway` (3 pontos:
  `carreira.js:2461`, `3283`, `7705`), `public/js/data.js`.
* Testes/simulações de `GE-BALANCE-001`/`002` como baseline de
  regressão (os números medidos ali não podem piorar).

Requisitos

Mesma sequência obrigatória, com checkpoint extra pro item 2 dado o
tamanho: inspecionar → determinar causa raiz com evidência → corrigir
item 1 (baixo risco) → **propor e validar correção do item 2 com o PM
antes de aplicar em `data.js`/fórmula global** → testar/simular →
revisar.

Critérios de aceite

* causa raiz (hipótese a ou b) determinada com evidência real, não
  presumida;
* item 1 (`computeHumanStrength`) corrigido e validado por simulação;
* correção do item 2 validada pelo PM antes da implementação;
* simulação de campeonato completo confirma direção correta (defesa
  melhor → menos gols sofridos) sem regredir os resultados já medidos
  de `GE-BALANCE-001`/`002`;
* nenhuma outra regra de negócio quebrada.

Validações

O PM deverá validar em 2 momentos: (1) a causa raiz e a correção
proposta pro item 2, antes da implementação; (2) o relatório final com
evidência de simulação completa.

Riscos

* alto pro item 2 — muda o resultado de toda partida do jogo,
  inclusive CPU x CPU, com efeito cascata em tabela/rebaixamento/
  acesso/premiação; o checkpoint de desenho existe justamente pra
  reduzir esse risco. Item 1 isolado é baixo risco (só afeta o clube
  humano, mesmo padrão de validação já usado em `GE-BALANCE-001`).

Observações

Achado por `GE-BALANCE-001`, não pedido original do usuário — mas
descrito pelo próprio relatório como possivelmente "uma causa
estrutural mais forte de imprevisibilidade do motor de partida do que
a falta de resistência dinâmica contra sequências", o que justifica
tratar como prioridade P1 própria, não deixar como dívida técnica
esquecida.

CHECKPOINT DE DESENHO (item 2 do escopo) — causa raiz determinada com
evidência, revisa o item 1

Item 1 (`inspecionar todos os pontos que leem club.def/p.def`): feito.
Além dos 3 pontos já citados na especificação original, a busca
literal por `atk / ... .def` achou **6 funções, 11 divisões** — a
especificação subestimou o tamanho real do problema:

1. `resolveCpuFixture` (`carreira.js:7956-7957`) — Brasileirão CPU x CPU.
2. `resolveLiveChunk` (`carreira.js:8435-8436`) — partida ao vivo do
   próprio técnico (Brasileirão).
3. `simulateCupLeg` (`carreira.js:2558-2559`) — Copa do Brasil
   (`GE-COPA-001`), ida/volta e formato legado.
4. `resolveOtherDivisionsRound` (`carreira.js:3488-3489`) — Séries B/C
   (sistema de divisões, CPU x CPU).
5. `attributeChances` (`carreira.js:7159`) — sorteio de chances
   perdidas/defesas do goleiro dentro de um chunk ao vivo.
6. `suggestTactics` (`carreira.js:10860-10861`) — sugestão de postura
   tática pro próximo jogo (o próprio comentário do código já diz
   "mesma fórmula que o motor usa pra decidir o placar") — sem ser o
   motor de partida em si, gera CONSELHO ao usuário usando a MESMA
   fórmula, então herda o mesmo problema (sugeriria postura cautelosa
   contra um adversário de defesa fraca, e ofensiva contra um de
   defesa forte — o oposto do correto).

(`attributePenaltyMisses` recebe `defStrength` como parâmetro mas
nunca o usa no cálculo — parâmetro morto, não é bug, fora de escopo
corrigir isso aqui.)

Determinação da causa raiz (hipótese a vs. b), com evidência nova:

**Evidência 1 — padrão sistemático em `data.js`, não 2 exemplos
isolados.** Os ~60+ clubes reais verificados (não só Flamengo/Palmeiras/
Cuiabá, citados no relatório original) seguem o MESMO padrão: `atk`
alto sempre acompanha `def` BAIXO, e vice-versa, de forma consistente
(Man City `atk:1.82/def:0.80`, Arsenal `atk:1.78/def:0.76`, times
fracos como Cuiabá/Juventude com `atk` baixo e `def` alto). Isso não é
compatível com "curadoria manual errada em alguns clubes" (erro
aleatório) — é um padrão DELIBERADO em toda a base, incompatível com
"maior = melhor".

**Evidência 2 — decisiva: o código JÁ trata `club.def` como "menor =
melhor" em outro lugar, de forma explícita.** `buildRealPlayer`
(`carreira.js:1352`) e `buildGeneratedProPlayer` (`carreira.js:1469`)
— as 2 funções que geram jogador pra qualquer clube da liga — calculam
`clubFactor = (2 - club.def)` pra defensores/goleiros, exatamente pra
INVERTER o valor baixo-é-melhor de `club.def` numa escala alta-é-melhor
antes de usá-lo num cálculo de `overall` que espera "maior = melhor".
Ou seja, o próprio autor do código já sabia e já tratava corretamente
o sentido de `club.def` — só a fórmula de gol (e a sugestão tática que
a copia) ficou com o operador errado.

**Verificação numérica (não só álgebra abstrata — números concretos,
mesmo espírito de simulação já usado em `GE-BALANCE-001`/`002`):**
atacante com `atk=1.5` contra defesa "elite" (`def=0.78`, tipo
Flamengo) e defesa "fraca" (`def=1.32`, tipo Cuiabá):

* fórmula ATUAL (`atk / def`): elite → λ=1,92 gols esperados; fraca →
  λ=1,14. **Time com defesa elite sofre MAIS gols esperados que o de
  defesa fraca — confirma o bug, exatamente como o relatório original
  descreveu.**
* fórmula PROPOSTA (`atk * def`): elite → λ=1,17; fraca → λ=1,98.
  **Time com defesa elite sofre MENOS, o fraco sofre MAIS — direção
  correta.**

**Conclusão: hipótese (a) é a causa raiz — o problema é o OPERADOR da
fórmula (divisão quando deveria ser multiplicação), não os ~180
valores de `def` em `data.js`.** Os dados já foram curados com o
sentido certo (menor = defesa melhor, um coeficiente de "propensão a
sofrer gol", não uma "força defensiva"); é a fórmula que trata isso
como se fosse o oposto.

**Isso também revisa o item 1** (a correção isolada de
`computeHumanStrength` que a especificação original pedia como "baixo
risco, resolve os 2 casos"): refazendo as mesmas contas concretas,
`computeHumanStrength` (`club.def / defMult`) já está CORRETO no
sentido "menor = melhor" — pior condição física (`defMult` menor)
produz um `def` MAIOR (pior defesa, correto nesse sentido), e melhor
condição produz um `def` MENOR (defesa melhor, correto). O diagnóstico
original do item 1 presumiu (razoavelmente, antes desta investigação)
o sentido "maior = melhor" — a investigação do item 2 mostra que essa
presunção não procede. **Recomendação: NÃO alterar
`computeHumanStrength` — mudar SÓ o operador nas 6 funções listadas
acima resolve os 2 sintomas ao mesmo tempo** (a inversão específica do
clube humano E a inversão geral CPU x CPU), sem precisar de 2
correções separadas nem de recalibrar `data.js`.

Proposta de correção (aguardando aprovação antes de qualquer commit de
código de produção)

* Trocar `atk / def` por `atk * def` nas 6 funções listadas (11
  divisões) — mesmo operador, mesma direção, em todos os lugares, sem
  exceção (consistência é o que evita reintroduzir a mesma inversão em
  outro ponto no futuro).
* NÃO alterar `computeHumanStrength`, NÃO alterar nenhum valor de
  `atk`/`def` em `data.js`, NÃO alterar `buildRealPlayer`/
  `buildGeneratedProPlayer` (já corretos).
* Validar com simulação de campeonato completo (60 clubes, múltiplas
  temporadas) comparando distribuição de gols/pontos antes/depois, e
  reexecutando `sim_ge_balance_001.js`/`002.js` pra confirmar que os
  números já medidos (sequências de invencibilidade, rebaixamento de
  tradicionais) não regridem — exatamente como o critério de aceite já
  pede.
* Testar que nenhuma outra regra de negócio quebra: valuation de
  jogador/scouting/exibição de atributo NÃO usam a fórmula de gol
  (usam `p.atk`/`p.def`/`p.phys` — atributos de JOGADOR, alta-é-melhor,
  namespace diferente de `club.atk`/`club.def` em `data.js` — a mesma
  palavra "def" nomeando 2 conceitos com sentido oposto é uma
  armadilha de nomenclatura já existente no código, não algo que este
  fix cria nem que está em escopo renomear).

RELATÓRIO DE IMPLEMENTAÇÃO (checkpoint de desenho aprovado — "Aprovada
a 30")

Mudança aplicada — exatamente a proposta acima, sem desvio

* `public/js/carreira.js` — `atk / def` → `atk * def` nas 6 funções/11
  divisões listadas (`simulateCupLeg`, `resolveOtherDivisionsRound`,
  `attributeChances`, `resolveCpuFixture`, `resolveLiveChunk`,
  `suggestTactics`). `computeHumanStrength`/`data.js`/
  `buildRealPlayer`/`buildGeneratedProPlayer` intocados, como proposto.

**Achado durante a implementação (2 pontos adicionais, necessários pra
não quebrar o que já foi validado):** `resolveLiveChunk` tinha 2
ajustes multiplicativos simétricos em atk+def que dependiam do sentido
ANTIGO (assumido "maior=melhor") de `def`:

1. `formationPenaltyChunksLeft` (penalidade de familiaridade tática) —
   `humanSide.def *= 0.92` virou `humanSide.def /= 0.92`. Uma
   PENALIDADE precisa deixar a defesa PIOR — sob "menor=melhor", pior
   defesa é um número MAIOR, não menor.
2. `opponentMotivationMod` (`GE-BALANCE-001`, issue #26) —
   `cpuSide.def *= motivationMod` virou `cpuSide.def /= motivationMod`.
   Um adversário "mais ligado" precisa de defesa MELHOR — sob
   "menor=melhor", isso é um número MENOR, não maior.

Sem essas 2 correções, aplicar só o fix da fórmula de gol teria
INVERTIDO o efeito de ambos os mecanismos (a penalidade de trocar de
tática viraria bônus; o adversário "motivado" ficaria com defesa PIOR,
não melhor) — quebrando silenciosamente o que `GE-BALANCE-001` já
validou. Confirmado com busca literal (`grep ".atk *=|.def *="`) que
são os ÚNICOS 2 pontos desse tipo no arquivo inteiro.

Validação — simulação de campeonato completo (novo)

`tests/e2e/sim_ge_balance_003.js` (novo): 300 temporadas simuladas,
turno e returno completo (38 rodadas), 20 clubes REAIS do Brasileirão
(`atk`/`def` extraídos de `data.js` por regex), fórmula ANTES vs
DEPOIS lado a lado, mesma seed:

1. **Direção confirmada com números reais:** Palmeiras (defesa mais
   forte real, `def=0.75`) sofria em MÉDIA 77,13 gols/temporada com a
   fórmula ANTIGA (mais que a Cuiabá, defesa mais fraca real,
   `def=1.32`, que sofria 45,80) — confirma o bug relatado. Com a
   fórmula CORRIGIDA: Palmeiras passa a sofrer 43,76 (menos que
   Cuiabá, que sofre 77,07) — direção correta.
2. **Achado maior que o esperado:** com a fórmula ANTIGA, o ranking
   médio de pontos por temporada era essencialmente ACHATADO — os
   favoritos reais (Flamengo/Palmeiras/Botafogo) e os lanternas reais
   (Cuiabá/Mirassol/Juventude) terminavam todos na faixa de ~50-53
   pontos, estatisticamente indistinguíveis (o bug de defesa cancelava
   a vantagem que o `atk` mais alto deveria dar). Com a fórmula
   corrigida, o ranking passa a refletir a força real dos clubes:
   Palmeiras/Flamengo/Botafogo no topo (72,4/72,3/67,2 pts), Cuiabá/
   Mirassol/Juventude na base (32,4/33,6/35,5 pts) — a tabela do
   Brasileirão simulado agora se parece com o campeonato real, o que
   NÃO acontecia antes.
3. Nenhum time com aproveitamento médio implausível (máximo observado:
   63,5% pro campeão médio, Palmeiras) — dentro do razoável pra um
   "campeão típico" do futebol brasileiro real.

Validação — reexecução de `sim_ge_balance_001.js`/`002.js`

* `sim_ge_balance_001.js` — **atualizado** (a cópia local da fórmula
  dentro do script precisou do MESMO fix, senão estaria validando a
  fórmula antiga; o script já é uma reimplementação isolada de
  propósito, não importa `carreira.js`). Números mudaram de patamar
  (esperado — a fórmula mudou de verdade): ANTES (baseline, sem
  motivação) agora mostra 93,0% das temporadas com sequência
  invicta ≥10 jogos (era medido como ~6,2% antes do fix — o número
  antigo estava artificialmente baixo porque o bug punia a defesa
  excelente do time de teste). DEPOIS (com motivação):
  90,9% — ainda uma redução na direção certa, mas
  proporcionalmente menor que a medida original (93,0%→90,9%, ~2,3%
  de redução relativa, contra ~35% medido antes do fix). **Achado
  registrado, fora de escopo desta demanda:** o mecanismo de
  `GE-BALANCE-001` continua funcionando na direção certa, mas parece
  menos eficaz contra a nova linha de base (mais realista, sem o
  bug) de dominância de um time de elite — candidato a uma futura
  recalibração de `OPPONENT_MOTIVATION_STREAK_STEPS`, não tratado
  aqui (mudar a fórmula do gol e recalibrar a força do bônus de
  motivação são 2 decisões separadas).
* `sim_ge_balance_002.js` — **não precisou de nenhuma mudança** (roda
  código de produção real via `vm`, e não toca em `club.atk`/`club.def`
  nem na fórmula de gol — só `relegationZoneIds`/`applyTraditionReprieve`).
  Reexecutado: 40,7% de redução relativa no rebaixamento de clube de
  tradição — **idêntico ao já medido**, confirmando que esta demanda
  não afeta aquele mecanismo.

Teste (motor real, dentro da UI)

Novo `tests/e2e/test_ge_balance_003.js` (2/2 passando):
1. `resolveCpuFixture` (função de produção real, chamada direto — não
   reimplementada) — o mesmo clube atacante marca MENOS gols em média
   contra a defesa elite real (Palmeiras) do que contra a defesa fraca
   real (Cuiabá), 300 confrontos simulados;
2. `suggestTactics` roda sem erro com a fórmula corrigida.

Regressão (nenhuma mudança de comportamento fora do esperado)

`tests/e2e/test_ao_vivo.js` (7/7 — inclui a penalidade de familiaridade
tática, que agora usa `/=` em vez de `*=` pro `def`, confirmado
funcionando). `tests/e2e/test_ge_copa_001.js` (4/4 — `simulateCupLeg`
tocado). `tests/e2e/test_cup.js` (6/6). `tests/e2e/test_comissao_tecnica.js`
(7/7 — `suggestTactics` tocado). `tests/e2e/test_estatisticas_completas.js`
(9/9 — `renderStatsCopaContent`/cobertura geral). `tests/e2e/test_tabela_modal.js`
(1 check já falhava identicamente em `main` sem nenhuma mudança minha,
confirmado via `git stash` — não é regressão). `node -c
public/js/carreira.js` limpo.

Fora de escopo (confirmado, nada tocado)

* `computeHumanStrength`, `data.js`, `buildRealPlayer`/
  `buildGeneratedProPlayer` — já corretos, não alterados;
* recalibração de `OPPONENT_MOTIVATION_STREAK_STEPS`
  (`GE-BALANCE-001`) — achado registrado acima, candidato a demanda
  futura separada, não tratado aqui;
* valuation de jogador/scouting — confirmado que não usam a fórmula de
  gol, não tocados.

⸻

S4-AUDIT-BACKLOG-001 — Auditoria de prontidão das demandas #12 a #21

Status: APROVADO

Decisão do PM (Murilo, 10/09/2026): os 4 critérios de aceite foram
cumpridos — as 10 demandas têm veredito com evidência (tabela abaixo),
9 foram formalmente aprovadas (#12,13,14,15,16,17,18,19,21 — #14 com
2 divergências de design resolvidas, ver seção `S4-B2-003`), 1 foi
redefinida com mini-spec nova (`S4-B3-004`/#20, tela não existia), e a
cadeia de dependências foi revalidada sem quebras. Auditoria concluída.
Sprint: S4 — Redesign Mobile
Fase: pós-implementação transversal (Batch 2 + Batch 3) — auditoria de
consolidação. Substitui a demanda anterior desta seção, que era
`S4-B4-000` (auditoria das 7 telas do Batch 4) — reescopada a pedido
do Murilo. Correção (mesmo pedido, 10/09/2026): esta é uma auditoria
**pós-implementação**, não um gate pré-implementação — ver Objetivo e
Contexto abaixo, ajustados.
Prioridade: P1

Objetivo

Depois que uma ou mais das 10 demandas já especificadas e abertas como
issue — `S4-B2-001` (#12), `S4-B2-002` (#13), `S4-B2-003` (#14),
`S4-B2-004` (#15), `S4-B2-005` (#16), `S4-B3-001` (#17), `S4-B3-002`
(#18), `S4-B3-003` (#19), `S4-B3-004` (#20), `S4-B3-005` (#21) — forem
implementadas por qualquer sessão, auditar o resultado real entregue:
confirmar o que foi de fato implementado/aprovado/mesclado, atualizar
o handoff de acordo, e revalidar a cadeia de dependências entre as
demandas restantes à luz do que já foi concluído.

Contexto

Esta sessão especificou as 10 demandas acima em sequência, sem
implementar nenhuma delas diretamente — mas já se confirmou 2 vezes
que sessões de implementação externas pegam demandas do handoff e as
executam sem avisar esta sessão em tempo real: `S3-DS20-S4-PREP-001` e
`S3-DS20-S4-PREP-002` foram ambas implementadas, aprovadas e mescladas
em `main` por sessões separadas — a segunda só foi descoberta porque o
Murilo pediu explicitamente pra verificar ("Veja se Perfil de Jogador
não está liberado").

Esta auditoria **não é um gate antes do trabalho começar** —
implementações acontecem de forma assíncrona, por sessões que este PM
não controla nem consegue bloquear (o próprio precedente de
PREP-001/002 mostra isso: aconteceram sem aviso, não depois de uma
autorização prévia). É, em vez disso, o processo de **consolidação que
roda depois** que qualquer uma das 10 demandas for implementada —
formalizando como demanda o mesmo processo que já foi feito
manualmente pra PREP-001/PREP-002 (checar branch/commit, confirmar
status real, atualizar o handoff, revalidar dependências), em vez de
depender de alguém lembrar de pedir a checagem.

Escopo

Quando uma ou mais das 10 demandas tiver sido implementada, Claude
deve, para cada uma que tiver progresso:

1. Verificar se existe branch, commit ou Pull Request associado no
   repositório (mesmo processo usado quando se confirmou que
   `S3-DS20-S4-PREP-002` já estava implementada) — buscar por
   referências relacionadas ao ID da demanda ou ao seu conteúdo.
2. Confirmar o status real (em implementação? pronta pra revisão? já
   aprovada e mesclada?) e atualizar a seção correspondente do handoff
   de acordo — mesmo tratamento dado a `S3-DS20-S4-PREP-002` quando
   sua conclusão foi descoberta.
3. Para as demandas que ainda não tiverem nenhum progresso: confirmar
   que a especificação continua válida — inspecionar a implementação
   atual da tela/componente relacionado e confirmar que nada mudou
   desde a especificação original que invalide o escopo, as
   dependências ou os riscos descritos nela.
4. Revalidar a cadeia de dependências entre as demandas à luz do que
   foi encontrado — em particular, se alguma das demandas do Batch 3
   já pode prosseguir porque `S4-B3-001` foi concluída, ou se a ordem
   recomendada precisa mudar dado o estado real.
5. Registrar, por demanda, um veredito único: "sem progresso externo,
   especificação continua válida" / "sem progresso externo,
   especificação precisa de ajuste (detalhar o quê)" / "progresso
   externo encontrado (detalhar o estado e a atualização feita no
   handoff)".
6. Produzir um relatório consolidado nesta mesma seção do handoff,
   com a lista das 10 demandas e o veredito de cada uma.
7. Retornar `REVISÃO DO PM NECESSÁRIA`.

Fora de escopo

* implementar qualquer coisa nova — mudanças de código só acontecem
  se decorrerem diretamente de uma demanda já aprovada encontrada com
  progresso pendente de finalização (mesmo tratamento que
  `S3-DS20-S4-PREP-001` recebeu quando sua aprovação foi processada);
* a auditoria original das 7 telas do Batch 4 (Onboarding, Comparar
  jogadores, Eixos táticos, Marcação individual, Meus esquemas,
  Notícias/Eventos, Histórico/Estatísticas) — não faz mais parte desta
  demanda (era o escopo de `S4-B4-000`, substituído); se ainda for
  necessária, precisa virar uma demanda própria depois desta.

Dependências

* as 10 demandas em si (`S4-B2-001` a `S4-B2-005`, `S4-B3-001` a
  `S4-B3-005`), já especificadas em `docs/HANDOFF_CLAUDE.md` e como
  issues #12-#21 — pelo menos uma delas precisa ter algum progresso
  real (branch/commit/PR) pra esta auditoria fazer sentido; se nenhuma
  tiver, o resultado é só confirmar que todas as specs continuam
  válidas, sem muito mais a fazer.
* `docs/sprints/S4/S4_REQUISITOS_VIGENTES.md`.

Requisitos

Mesma sequência obrigatória de sempre: inspecionar → localizar →
entender → planejar → (alterar só se decorrer de aprovação já
concluída) → testar (se houver alteração) → revisar. Cada veredito
deve vir com evidência real (branch/commit encontrado, ou trecho de
código conferido), mesmo rigor da S3.2.7 original — não presunção.

Critérios de aceite

* as 10 demandas têm veredito registrado, cada um com evidência;
* qualquer progresso externo encontrado está refletido no handoff
  (status atualizado, movido pro Histórico se aprovado);
* qualquer especificação desatualizada está corrigida ou marcada pra
  correção;
* a cadeia de dependências entre as demandas foi revalidada.

Validações

O PM deverá validar: cobertura das 10 demandas, qualidade da evidência
por trás de cada veredito, qualquer atualização de status feita no
handoff, coerência da cadeia de dependências revalidada.

Riscos

* baixo — é auditoria/verificação de estado, mudança de código só
  ocorre se decorrer de algo já formalmente aprovado e ainda não
  processado.

Observações

Esta demanda existe pra formalizar, como processo repetível, o mesmo
tipo de checagem que já foi feita manualmente 2 vezes nesta sessão
(progresso externo descoberto depois do fato) — não é um bloqueio
antes de qualquer trabalho começar, é a consolidação que roda depois
que ele acontecer. Especificar novas demandas em cima das #12-#21 não
precisa esperar esta auditoria — ela existe pra manter o handoff
alinhado com a realidade à medida que implementações forem
acontecendo, não pra travar o fluxo até rodar.

Relatório consolidado (auditoria, 10/09/2026)

Todas as 10 demandas tinham progresso real no momento desta auditoria
— nenhuma foi encontrada "sem progresso" (não existe o caso "sem
progresso, spec continua válida"/"sem progresso, spec precisa de
ajuste" nesta rodada). Evidência coletada por demanda: `git branch -r`
+ `git log origin/main..origin/<branch>` (confirma cada branch existe,
o commit exato, e quantos commits à frente de `main`), `list_pull_requests`
(nenhum PR aberto pra nenhuma das 10 — confirmado 2x, antes e depois
desta auditoria) e `get_comments` em cada uma das 10 issues (exatamente
1 comentário em cada — o meu próprio relatório técnico; nenhuma
resposta ou aprovação do usuário ainda em nenhuma delas).

| # | Demanda | Branch | Commits à frente de `main` | Veredito |
|---|---|---|---|---|
| #12 | `S4-B2-001` | `claude/s4-b2-001-loading` | 1 | Progresso externo encontrado — implementada, aguardando revisão. Proposto: APROVADO |
| #13 | `S4-B2-002` | `claude/s4-b2-002-login` | 1 | Progresso externo encontrado — implementada (sem mudança de código), aguardando revisão. Proposto: APROVADO |
| #14 | `S4-B2-003` | `claude/s4-b2-003-tatica` | 1 | Progresso externo encontrado — parcial, 2 divergências aguardando decisão do PM. Proposto: ADJUSTMENTS REQUIRED |
| #15 | `S4-B2-004` | `claude/s4-b2-004-treino` | 1 | Progresso externo encontrado — implementada, aguardando revisão. Proposto: APROVADO |
| #16 | `S4-B2-005` | `claude/s4-b2-005-perfil` | 1 | Progresso externo encontrado — implementada, aguardando revisão. Proposto: APROVADO |
| #17 | `S4-B3-001` | `claude/s4-b3-001-transfer-contract-card` | 1 | Progresso externo encontrado — implementada, aguardando revisão. Proposto: APROVADO |
| #18 | `S4-B3-002` | `claude/s4-b3-002-mercado` | 3 (empilhada sobre #17) | Progresso externo encontrado — implementada, aguardando revisão. Proposto: APROVADO |
| #19 | `S4-B3-003` | `claude/s4-b3-003-negociacao` | 4 (empilhada sobre #17/#18) | Progresso externo encontrado — implementada, corrigiu bug crítico pré-existente. Proposto: APROVADO |
| #20 | `S4-B3-004` | `claude/s4-b3-004-contratos` | 5 (empilhada, só docs) | Progresso externo encontrado — bloqueada por decisão de produto, nenhum código alterado. Proposto: BLOQUEADO |
| #21 | `S4-B3-005` | `claude/s4-b3-005-matchcard-financialsummary` | 6 (empilhada sobre as anteriores) | Progresso externo encontrado — implementada, aguardando revisão. Proposto: APROVADO |

("Progresso externo" no sentido da demanda original — trabalho que
esta auditoria encontrou pronto, não necessariamente de uma sessão
diferente; nestes 10 casos específicos, o trabalho foi feito pela
mesma linha de sessões deste handoff, mas a auditoria trata a
verificação do mesmo jeito independente de quem implementou, que é o
ponto do processo.)

Cadeia de dependências revalidada:

* `S4-B3-002`/`003` dependiam de `S4-B3-001` (TransferCard) como
  bloqueante — confirmado: ambas as branches partem de
  `claude/s4-b3-001-transfer-contract-card` (empilhadas de propósito,
  não paralelas), então o TransferCard que elas consomem já é o mesmo
  código, sem risco de divergência entre "o que `S4-B3-001` propôs" e
  "o que `S4-B3-002`/`003` realmente usam".
* `S4-B3-004` dependia de `ContractCard` (`S4-B3-001`) — o componente
  existe, mas a dependência real que bloqueia é outra (a tela em si
  não existe), então a conclusão de `S4-B3-001` não desbloqueia
  `S4-B3-004` sozinha, como o relatório daquela demanda já registrou.
* `S4-B3-005` era o pré-requisito declarado de "Resumo da rodada" —
  confirmado concluído; "Resumo da rodada" pode ser especificada como
  demanda própria a qualquer momento agora, não depende de mais nada.
* Nenhuma dependência quebrada ou invalidada foi encontrada — a ordem
  de execução usada (Batch 2 em sequência, depois `S4-B3-001` antes de
  `002`/`003`/`004`, `S4-B3-005` em paralelo por ser independente)
  continua fazendo sentido.

Risco de coordenação identificado (não é sobre as 10 demandas em si):
`docs/sprints/S4/S4_REQUISITOS_VIGENTES.md` foi movido de
`docs/requirements/ui-ux/` pra `docs/sprints/S4/` por uma sessão
paralela (commit `ce2a25b`, depois de todas as 10 branches acima terem
sido criadas) — as 10 branches ainda editam o arquivo no caminho
antigo. Isso vai gerar um conflito de rename no merge (não um
conflito de conteúdo — o `git mv` deve resolver automaticamente na
maioria dos casos, mas quem for mesclar deve conferir). Registrado
aqui, não corrigido nas branches (mudar o caminho editado em 9
branches já com relatório fechado estaria fora do escopo desta
auditoria — é um ajuste mecânico pro momento do merge, não uma
mudança de conteúdo).

Decisão do PM (Murilo, 10/09/2026): aprovadas 8 das 10 demandas
auditadas (#12, #13, #15, #16, #17, #18, #19, #21) — todas mescladas
em `main` nesta sessão, ver `Histórico` abaixo. `S4-B2-003` (#14)
ficou como `AJUSTES NECESSÁRIOS` até o PM decidir as 2 divergências
registradas — decidido em seguida (mesma sessão do usuário) e também
mesclada. `S4-B3-004` (#20) ficou `BLOQUEADO` até decisão de produto
sobre a tela Contratos — o PM escolheu "criar do zero"; implementada
e aguardando revisão (ver seção própria acima). Risco de coordenação
do rename de `S4_REQUISITOS_VIGENTES.md` confirmado e resolvido
manualmente em cada merge, sem perda de conteúdo.

⸻

Histórico

Demanda	Data	Commit	Changelog
S3-DS20-S4-READINESS-001 — S3.2.7 Readiness Review	11/09/2026	sem commit de código — demanda de auditoria/decisão; nota de fechamento registrada no commit `9ac51bf`	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 11/09/2026, diretamente nesta conversa
("Aprovado"). Auditoria original (09/09/2026) determinou
`AJUSTES NECESSÁRIOS` com 6 itens — os 3 bloqueantes (convergência de
tokens, Dialog/Bottom Sheet/Skeleton, migração das 9 telas P0)
resolvidos por `S3-DS20-S4-PREP-001` e pelos Batches 2/3 da S4,
completos e mesclados; os 3 não-bloqueantes (emoji, cobertura de
teste, gaps P1/P2) tratados incrementalmente conforme previsto, sem
virar projeto isolado. Relatório técnico completo (evidência original
da auditoria + nota de fechamento com o mapeamento de cada item pra
sua demanda de resolução) em `git show 9ac51bf:docs/HANDOFF_CLAUDE.md`.

S3-DS20-S4-PREP-001 — Dialog/Bottom Sheet/Skeleton (`--m3-*`) + convergência de tokens	09/09/2026	merge de `claude/s4-prep-001-tokens-components` em `main` (commit de código original `4d80d99`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 09/09/2026. Relatório técnico completo (o que
foi implementado, testes, gaps, arquivos avaliados/alterados) fica
preservado no histórico do git — `git show dc382a8:docs/HANDOFF_CLAUDE.md`
(commit em que este relatório foi registrado) — e não é reproduzido
aqui, pra manter este documento como o estado operacional atual, não um
arquivo permanente (esse é o papel do CHANGELOG.md, conforme
`docs/README.md`).

**Merge do código:** exceção pontual aberta pelo Murilo pra concluir
esta demanda já aprovada — nenhuma alteração de código nova, só a
integração em `main` do que já estava implementado, testado e
revisado na branch. A instrução geral de "não mexer em código" desta
sessão continua valendo pra qualquer outra alteração.

S3-DS20-S4-PREP-002 — Formalizar PlayerCard (`playerRow()`), retroativo em Elenco	09/09/2026	merge de `claude/s3-ds20-s4-prep-002` em `main` (commit de código original `1998f02`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 09/09/2026. Relatório técnico completo (o que
foi implementado — mudança puramente documental, zero comportamento
alterado —, testes, a divergência encontrada em relação à
especificação original, e a regressão pré-existente de
`S3-DS20-S4-PREP-001` encontrada mas fora de escopo) fica preservado no
histórico do git — `git show 1998f02:docs/HANDOFF_CLAUDE.md` (commit em
que este relatório foi registrado) — e não é reproduzido aqui, pelo
mesmo motivo do item acima.

**Merge do código:** autorizado pela aprovação formal acima
(`docs/README_HANDOFF.md` §13) — feito nesta mesma sessão, já com
chapéu implementador (diferente do caso da PREP-001, onde o merge
ficou pendente de outra sessão).

S4-B2-001 — Migrar tela Loading/Bootstrap para o Design System novo	10/09/2026	merge de `claude/s4-b2-001-loading` em `main` (commit de código original `6267fc6`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 10/09/2026 (issue #12, junto com #13/#15/#16/
#17/#18/#19/#21). Relatório técnico completo fica preservado no
histórico do git — `git show 6267fc6:docs/HANDOFF_CLAUDE.md` — e não é
reproduzido aqui, mesmo motivo dos itens acima.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#12, executado nesta sessão junto com as outras 7 demandas aprovadas
no mesmo lote.

S4-B2-002 — Migrar tela Login/Entrada para o Design System novo	10/09/2026	merge de `claude/s4-b2-002-login` em `main` (commit de código original `7fcb3a7`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 10/09/2026 (issue #13). Achado de inspeção: a
tela já estava migrada (`#screenLoginRequired`) — mudança puramente
documental, zero código de produção alterado. Relatório técnico
completo em `git show 7fcb3a7:docs/HANDOFF_CLAUDE.md`.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#13, executado nesta sessão junto com o lote de 8 demandas.

S4-B2-003 — Migrar tela Tática/Formação para o Design System novo	10/09/2026	merge de `claude/s4-b2-003-tatica` em `main` (commit de código original `f92a339`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 10/09/2026 (issue #14), depois de resolvidas
as 2 divergências registradas na inspeção original (`.mt-bench-row`
mantido como padrão próprio; tipografia `Rajdhani` classificada como
BRDATA Extension). Relatório técnico completo em
`git show f92a339:docs/HANDOFF_CLAUDE.md`.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#14, executado nesta sessão.

S4-B2-004 — Migrar tela Treino para o Design System novo	10/09/2026	merge de `claude/s4-b2-004-treino` em `main` (commit de código original `6bf1467`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 10/09/2026 (issue #15). Relatório técnico
completo em `git show 6bf1467:docs/HANDOFF_CLAUDE.md`.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#15, executado nesta sessão junto com o lote de 8 demandas.

S4-B2-005 — Migrar tela Perfil do jogador para o Design System novo	10/09/2026	merge de `claude/s4-b2-005-perfil` em `main` (commit de código original `13c0991`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 10/09/2026 (issue #16). Relatório técnico
completo (inclui a divergência registrada sobre as setas de tendência
▲/▼ não migradas, sem token `--m3-*` equivalente) em
`git show 13c0991:docs/HANDOFF_CLAUDE.md`.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#16, executado nesta sessão junto com o lote de 8 demandas.

S4-B3-001 — Criar os componentes TransferCard e ContractCard	10/09/2026	merge de `claude/s4-b3-001-transfer-contract-card` em `main` (commit de código original `44edc50`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 10/09/2026 (issue #17). Relatório técnico
completo em `git show 44edc50:docs/HANDOFF_CLAUDE.md`.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#17, executado nesta sessão junto com o lote de 8 demandas.

S4-B3-002 — Migrar tela Mercado para o Design System novo	10/09/2026	merge de `claude/s4-b3-002-mercado` em `main` (commit de código original `48289d1`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 10/09/2026 (issue #18). Relatório técnico
completo em `git show 48289d1:docs/HANDOFF_CLAUDE.md`.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#18, executado nesta sessão junto com o lote de 8 demandas.

S4-B3-003 — Migrar tela Negociação/Proposta para o Design System novo	10/09/2026	merge de `claude/s4-b3-003-negociacao` em `main` (commit de código original `4d3f703`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 10/09/2026 (issue #19). Relatório técnico
completo — inclui o bug crítico pré-existente de CSS (Dialog/Bottom
Sheet sem `position:fixed`/`z-index` de verdade desde
`S3-DS20-S4-PREP-001`) encontrado e corrigido nesta demanda — em
`git show 4d3f703:docs/HANDOFF_CLAUDE.md`.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#19, executado nesta sessão junto com o lote de 8 demandas.

S4-B3-005 — Inspecionar e formalizar MatchCard e FinancialSummary	10/09/2026	merge de `claude/s4-b3-005-matchcard-financialsummary` em `main` (commit de código original `7ef29b6`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 10/09/2026 (issue #21). Relatório técnico
completo (MatchCard construído novo — motor de partidas só produz 2
dos 5 estados suportados pelo componente; FinancialSummary formalizado
retroativamente sobre o card "Financeiro" já existente) em
`git show 7ef29b6:docs/HANDOFF_CLAUDE.md`.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#21, executado nesta sessão junto com o lote de 8 demandas.

S4-B3-004 — Criar a tela Contratos (redefinida de "migrar" para "criar do zero")	10/09/2026	merge de `claude/s4-b3-004-contratos` em `main` (commit de código original `ba88891`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 10/09/2026 (issue #20), depois de decidir a
opção 1 (criar a tela do zero) e revisar a implementação. Relatório
técnico completo (inspeção original que bloqueou a demanda, mini-spec
do PM, e a implementação final — reaproveitando 100% da lógica já
existente, nenhuma regra de contrato nova) em
`git show ba88891:docs/HANDOFF_CLAUDE.md`.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#20, executado nesta sessão.

**Nota de governança (sessão PM, 10/09/2026):** ao contrário das
outras 9 demandas desta rodada (aprovadas pelo Murilo diretamente
nesta conversa, com a mensagem "Aprovado" registrada), o "Aprovado"
que fechou esta demanda foi postado pela sessão implementadora na
própria issue #20
(https://github.com/muriloalmeida-alt/FitOS/issues/20#issuecomment-5625550397),
sem um checkpoint externo verificável nesta conversa — o tipo exato de
situação que `docs/README_HANDOFF.md` §1 veda ("quem implementa e
especifica não pode também aprovar formalmente o próprio trabalho sem
checagem externa"). Pode ser que o Murilo tenha autorizado essa
implementação/merge diretamente com a sessão implementadora (mesmo
padrão de "passei a instrução para o dev" usado nesta conversa pras
outras 9) — mas essa sessão PM não tem como confirmar isso pelas
fontes disponíveis (GitHub, git). Registrado aqui pra transparência;
não desfeito unilateralmente (o merge de código já é fato consumado,
reverter é decisão de produto/técnica, não documental). Se o Murilo
não autorizou, é um gap de processo a corrigir daqui pra frente, não
desta demanda específica retroativamente.

**Resolução (sessão implementadora, 11/09/2026):** confirmado — o
Murilo autorizou a aprovação/merge de `S4-B3-004` diretamente na
conversa desta sessão implementadora ("Aprovar a #20", mesmo padrão
usado pras outras 9 demandas do lote). O gap era só de
visibilidade cruzada entre sessões paralelas (a sessão PM não tinha
como ver esta conversa), não uma aprovação ausente de fato. Nenhuma
ação de reversão necessária.

⸻

DOCS-REQ-001 — Povoar docs/requirements/ com regras vigentes migradas de docs/sprints/	11/09/2026	merge de `claude/docs-req-001` em `main` (commit de código original `a493286`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 11/09/2026 (issue #23), diretamente nesta
conversa ("Pode mesclar. Aprovado pelo PM"). Relatório técnico completo
(4 documentos criados em `docs/requirements/` — um por subpasta —,
cada um citando a origem em `docs/sprints/S2/`/`S3/` e separando
estado atual confirmado de direção futura/proposta) em
`git show a493286:docs/HANDOFF_CLAUDE.md`.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#23, executado nesta sessão.

S4-B3-006 — Migrar Resumo da rodada e Rodada (menu) pro MatchCard	11/09/2026	merge de `claude/s4-b3-006-resumo-rodada` em `main` (commit de código original `29fa8f7`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 11/09/2026 (issue #24), diretamente nesta
conversa ("Pode seguir com o desenvolvimento"). Relatório técnico
completo (3 pontos de código migrados pro MatchCard —
`showRoundResultsModal()`, `cupRoundResultsHTML()`, `renderRodada()` —
sem alterar a definição do componente; 4º ponto de `.ct-round-result-row`
confirmado fora do escopo) em `git show 29fa8f7:docs/HANDOFF_CLAUDE.md`.
Com esta demanda, o **Batch 3 (Transactional) da S4 fecha 100%**.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#24, executado nesta sessão.

SAVE-LIMIT-001 — Save de carreira "grande demais": eliminar o beco sem saída	11/09/2026	merge de `claude/save-limit-001` em `main` (commit de código original `5ab43d8`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 11/09/2026 (issue #29), diretamente nesta
conversa ("mesclar e seguir para a próxima"). Relatório técnico
completo (medição real — `leagueSquads` responde por ~79% do save,
não estruturas acumulativas; compressão gzip 92-93% real,
`MAX_BYTES` passa a valer sobre o tamanho comprimido; poda automática
de histórico não-essencial como última linha de defesa; `clubHistory`
capado) em `git show 5ab43d8:docs/HANDOFF_CLAUDE.md`.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#29, executado nesta sessão.

GE-BALANCE-001 — Reduzir sequências de invencibilidade do clube humano	11/09/2026	merge de `claude/ge-balance-001` em `main` (commit de código original `4fc3cde`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 11/09/2026 (issue #26), diretamente nesta
conversa ("Merge"). Relatório técnico completo (inspeção real da curva
de fadiga/rotação, achado da inversão `club.def/defMult`, mecanismo
"motivação do adversário" implementado e validado por simulação Monte
Carlo — 5000 temporadas, queda de 6.2% pra 4.0% na fração de
temporadas com sequência ≥10 jogos invicto —, recomendação de
`GE-BALANCE-003` separada pra corrigir a inversão de calibração
ataque/defesa) em `git show 4fc3cde:docs/HANDOFF_CLAUDE.md`.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#26, executado nesta sessão.

GE-BALANCE-002 — Peso da tradição/força de clube na simulação (relegação)	11/09/2026	merge de `claude/ge-balance-002` em `main` (commit de código original `830a051`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 11/09/2026 (issue #27), diretamente nesta
conversa ("Aprovar #27"). Relatório técnico completo (club.atk/def já
reaproveitado por buildGeneratedProPlayer sem mudança, mas não é
tradição — CLUB_TRADITION_IDS novo, pequeno e curado; mecanismo de
reprieve probabilístico na zona de rebaixamento, gap encontrado e
corrigido pela própria simulação de validação — 17.3% → 40.7% de
redução medida) em `git show 830a051:docs/HANDOFF_CLAUDE.md`.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#27, executado nesta sessão.

S4-B4-READINESS-001 — Verificação individual das 7 telas do Batch 4	11/09/2026	merge de `claude/s4-b4-readiness-001` em `main` (commit de código original `38884d8`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 11/09/2026 (issue #25), diretamente nesta
conversa ("ordem da #25 aprovada"). Relatório técnico completo
(auditoria com evidência das 7 telas — 6 existem e precisam de
migração, 1 — Eixos táticos — já está coberta dentro de Tática/
Formação; ordem de execução recomendada: Onboarding → Meus esquemas →
Marcação individual → Comparar jogadores → Notícias/Eventos →
Histórico/Estatísticas) em `git show 38884d8:docs/HANDOFF_CLAUDE.md`.

**Merge do código:** auditoria pura, sem código de produção — merge
autorizado pela aprovação formal do PM na issue #25, executado nesta
sessão.

GE-COPA-001 — Expandir Copa do Brasil (60 clubes, ida e volta, cabeças de chave, ao vivo)	11/09/2026	merge de `claude/ge-copa-001-impl` em `main` (commit de código original `9e416d7`; checkpoint de desenho aprovado antes, `claude/ge-copa-001-design`, commit `729033f`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 11/09/2026 (issue #28), diretamente nesta
conversa — em 2 etapas, como a especificação exigia dado o tamanho da
mudança: (1) desenho de fases validado ("desenho da #28 aprovado" +
escolha de cabeças de chave por força atual via pergunta direta), (2)
implementação + validação por simulação aprovada ("Pode fazer o merge
de 25 a 28"). Relatório técnico completo (60 clubes cruzando as 3
divisões, 4 cabeças de chave pulando a Fase 1, ida e volta em todas
as 6 fases, motor ao vivo 100% reaproveitado de resolveLiveChunk,
formato legado de 16 clubes preservado intacto pra saves antigos,
3 temporadas inteiras simuladas sem quebra de chaveamento,
`test_cup.js` reescrito por ter ficado obsoleto) em
`git show 9e416d7:docs/HANDOFF_CLAUDE.md`.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#28, executado nesta sessão.

S4-B4-001 — Migrar tela Onboarding para o Design System novo	11/09/2026	merge de `claude/s4-b4-001-onboarding` em `main` (commit de código original `d36d8e0`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 11/09/2026 (issue #31), diretamente nesta
conversa ("Aprovado. Seguir para o próximo"). Relatório técnico
completo (3 seletores CSS migrados — `.mt-onboard-title`/`.mt-onboard-text`/
`.mt-onboard-skip`, `--mt-ivory-50`/`--mt-ink-muted` →
`--m3-on-surface`/`--m3-on-surface-variant`; tipografia Bebas Neue do
título mantida como BRDATA Extension) em
`git show d36d8e0:docs/HANDOFF_CLAUDE.md`.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#31, executado nesta sessão.

S4-B4-002 — Migrar tela Meus esquemas para o Design System novo	11/09/2026	merge de `claude/s4-b4-002-meus-esquemas` em `main` (commit de código original `c8b1b28`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 11/09/2026 (issue #32), diretamente nesta
conversa ("Aprovado"). Relatório técnico completo (achado que corrige
a auditoria `S4-B4-READINESS-001` — a tela não era "100% legada": a
casca de modal/sheet e as linhas da lista de esquemas já estavam 100%
`--m3-*` de demandas anteriores; único token legado real era o campo
de nome do sheet "Novo esquema", `.mt-friend-input` cru fora de
`.mt-form-row`; migrado envolvendo-o em `.mt-form-row`, reaproveitando
regra que já existia pra "Editar perfil", sem CSS novo) em
`git show c8b1b28:docs/HANDOFF_CLAUDE.md`.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#32, executado nesta sessão.

S4-B4-003 — Migrar tela Marcação individual para o Design System novo	11/09/2026	merge de `claude/s4-b4-003-marcacao-individual` em `main` (commit de código original `a4cdb6d`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 11/09/2026 (issue #33), diretamente nesta
conversa ("Aprovado"). Relatório técnico completo (mesmo achado de
`S4-B4-002` — casca de modal já `--m3-*` antes desta demanda; tokens
legados reais eram `.mt-sel-row`/`.mt-sel-name`/`.mt-info-line b`,
migrados via override CSS ESCOPADO a `#markingOverlay` em vez de mudar
a regra base, compartilhada com Comparar jogadores e o seletor de
substituição ao vivo, ambos fora de escopo; decisão registrada de NÃO
reaproveitar `playerRow()`/PlayerCard — o componente não mostra
posição/subposição, informação essencial numa lista não agrupada por
posição; guard `:not(.selected)` necessário pra não quebrar o estado
selecionado pré-existente, achado e corrigido no próprio teste antes do
merge) em `git show a4cdb6d:docs/HANDOFF_CLAUDE.md`.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#33, executado nesta sessão.

S4-B4-004 — Migrar tela Comparar jogadores para o Design System novo	11/09/2026	merge de `claude/s4-b4-004-comparar-jogadores` em `main` (commit de código original `74465a1`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 11/09/2026 (issue #34), diretamente nesta
conversa ("Aprovado"). Relatório técnico completo (decisão registrada:
reaproveitar `playerRow()`/PlayerCard na lista de escolha — SIM, ao
contrário de `S4-B4-003`, porque aqui o pool já é sempre da mesma
subposição e o subtítulo já anuncia qual, então o chip por linha seria
redundante; achado de 3 tokens exclusivos do resultado que a auditoria
tinha marcado como "novo" — `.m3-compare-player b`/`.m3-compare-row`/
`.m3-compare-val`, migrados na regra base já que a classe é exclusiva
desta tela, sem precisar de override escopado) em
`git show 74465a1:docs/HANDOFF_CLAUDE.md`.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#34, executado nesta sessão.

S4-B4-005 — Migrar tela Notícias/Eventos e formalizar NewsCard	11/09/2026	merge de `claude/s4-b4-005-noticias-eventos` em `main` (commit de código original `4f56673`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 11/09/2026 (issue #35), diretamente nesta
conversa ("Aprovado"). Relatório técnico completo (`NewsCard`
formalizado PARCIALMENTE retroativo — `newsItemHTML()` já cobria o
layout de linha do feed; a manchete em destaque, que nunca foi função
própria, virou a variação `featured` do MESMO componente; classes
`.mt-news-*` renomeadas `.m3-news-*`, tokens `--mt-gold-400/600` →
`--m3-secondary` e demais → `--m3-on-surface(-variant)`/
`--m3-outline-variant`; cores categóricas por tipo e destaque "mine"
preservados como cor categórica da BRDATA; verificação pós-merge
encontrou 1 flake em `test_noticias_fullscreen_fluxo.js` — timing de
simulação ao vivo, não relacionado a esta demanda, confirmado
reproduzindo isoladamente 2x limpo em seguida) em
`git show 4f56673:docs/HANDOFF_CLAUDE.md`.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#35, executado nesta sessão.

S4-B4-006 — Migrar tela Histórico/Estatísticas para o Design System novo	11/09/2026	merge de `claude/s4-b4-006-historico-estatisticas` em `main` (commit de código original `a4238b0`)	docs/project/CHANGELOG.md (a atualizar)

APROVADO pelo Murilo em 11/09/2026 (issue #36), diretamente nesta
conversa ("Aprovado e a 30 tbm"). Relatório técnico completo
(`kpiHTML()` já tinha a variante `block:"m3"` em produção no card
Financeiro — Estatísticas nunca adotou, migração foi só passar `"m3"`
em cada chamada, zero CSS novo; `.mt-obj-tabs`/`.mt-obj-tab`/
`.mt-mini-*` migrados via override ESCOPADO a `#panel-estatisticas`,
compartilhados com Objetivos/Loja e o Histórico por temporada do
Perfil do jogador; MatchCard avaliado e não aplicável, nenhuma lista
de "resultados recentes" nesta tela) em
`git show a4238b0:docs/HANDOFF_CLAUDE.md`.

**Última tela do Batch 4 (Complementary) — fecha 100% (6/6 telas
migradas + Eixos táticos já coberto, sem demanda própria).** Resta só
o Batch 5 (QA Visual/UX transversal) pra completar a Sprint S4 por
inteiro.

**Merge do código:** autorizado pela aprovação formal do PM na issue
#36, executado nesta sessão.
