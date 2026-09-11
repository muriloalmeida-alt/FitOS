# Visão de Produto e Loop de Jogo — BRDATA (Modo Carreira)

**Origem:** `docs/sprints/S2/S2_GDD.md` (Game Design Bible v1.0, 14/08/2026)
**Migrado por:** `DOCS-REQ-001` (11/09/2026) — extração do que ainda é
regra vigente, não uma cópia integral do GDD original. O GDD completo
(37 seções, histórico do raciocínio original) permanece em
`docs/sprints/S2/S2_GDD.md`, imutável.

Este documento não substitui o GDD original — resume a parte dele que
continua sendo a referência viva de "o que o produto é e por que existe"
para qualquer trabalho futuro. Onde o GDD descreve algo como "proposta
futura" (não implementado ainda), isso é sinalizado explicitamente aqui,
não apresentado como estado atual.

---

## 1. Conceito

BRDATA (BR Data Treinador) é um jogo de gerenciamento de futebol: o
jogador assume o papel de técnico e administra todos os aspectos
esportivos e estratégicos de um clube — elenco, escalação, tática,
treinamento, contratos, finanças, desenvolvimento de jovens, diretoria,
relacionamento com jogadores, competições, decisões durante partidas,
reputação, propostas de outros clubes, e a carreira como um todo.

> **Princípio central:** você não joga partidas. Você constrói uma carreira.

## 2. Os 5 pilares

Toda funcionalidade nova deveria poder ser avaliada contra estes 5
pilares (regra ainda vigente, usada como critério de "boa feature" — ver
§8 abaixo):

1. **Decisão** — o jogador deve tomar decisões relevantes constantemente.
2. **Consequência** — toda decisão importante deve gerar algum efeito (ver §6).
3. **Progressão** — o clube e o treinador devem evoluir.
4. **História** — cada carreira deve produzir acontecimentos únicos (narrativa emergente, não roteirizada).
5. **Simplicidade** — profundidade sem virar planilha incompreensível.

## 3. Core loop (loop de partida/rodada)

```
ANALISAR → DECIDIR → EXECUTAR → JOGAR → RESULTADO → CONSEQUÊNCIA → EVOLUIR → (repete)
```

Exemplo do tipo de encadeamento esperado: um atacante em má fase é
colocado no banco → o reserva entra e marca dois gols → a moral do
titular cai enquanto a do reserva sobe → a imprensa noticia a disputa
pela posição → o técnico precisa decidir de novo. Isso é o que o loop
deve produzir na prática, não um evento isolado.

## 4. Meta loop (loop de carreira)

```
CLUBE → TEMPORADA → RESULTADOS → REPUTAÇÃO → MERCADO DE TREINADORES → NOVO CLUBE → NOVO DESAFIO → NOVA TEMPORADA
```

O objetivo final não é "ganhar o campeonato" isoladamente — é **construir
a carreira mais marcante possível**. Título é um evento dentro da
carreira, não o encerramento dela.

## 5. Entidades principais

### 5.1 Treinador (protagonista)
- **Reputação** (0–100), com faixas: 0–19 Contestado · 20–39 Em dúvida ·
  40–59 Estabelecido · 60–79 Renomado · 80–100 Lendário. A reputação
  influencia propostas, expectativa dos clubes, confiança da diretoria e
  valor percebido do treinador.
- **Experiência** — histórico acumulado.
- **Especialidades/perfil** (ex.: Mestre Tático, Formador, Gestor,
  Motivador) — cada perfil sugere um bônus temático (preparação/
  alterações em partida, desenvolvimento de jovens, eficiência
  financeira, recuperação de moral). Especialidades explícitas com bônus
  mecânico formal são **direção de design, a confirmar contra o código
  atual antes de tratar como implementado** — ver nota de reconciliação
  no `technical/`.
- **Carreira permanente**: clubes, temporadas, partidas, vitórias/
  empates/derrotas, gols, títulos, acessos, rebaixamentos, demissões,
  melhor campanha, maior sequência invicta. O histórico visual da
  carreira (ano/clube/posição final) deve ser uma das telas mais
  importantes do produto.

### 5.2 Clube
Quatro dimensões: **Esportivo** (força, elenco, base, estrutura),
**Financeiro** (caixa, receitas, despesas, folha, patrimônio, dívidas),
**Institucional** (reputação, tamanho, diretoria, pressão) e **Social**
(torcida, expectativa, rivalidades).

Cada clube deve ter uma **identidade/filosofia** própria (ex.: grande
clube de alta pressão e mercado caro vs. clube formador de baixo
orçamento que vende jogadores vs. clube de acesso que empresta e busca
experiência) — isso é insumo direto para a IA dos clubes (ver
`game-design/`).

### 5.3 Jogador
Quatro camadas: **Identidade** (nome, idade, posição, nacionalidade),
**Capacidade** (atributos, overall, potencial), **Estado** (condição,
forma, moral, confiança, lesão, suspensão), **Contexto** (contrato,
salário, titularidade, relacionamento, desejo de transferência).

> **Regra:** jogadores não devem ser apenas números. Traços
> comportamentais (ambicioso, leal, profissional, temperamental,
> paciente, competitivo, inseguro, líder) devem influenciar eventos —
> isso é direção de design; o grau de implementação real desses traços
> deve ser confirmado contra o código, não presumido a partir desta
> lista.

## 6. Princípio de consequência (regra de ouro)

Toda decisão importante deve alimentar outro sistema. Exemplos-guia (não
exaustivo, mas ilustra o padrão esperado):

| Decisão | Consequência esperada |
|---|---|
| Contratar jogador | Finanças + elenco |
| Vender titular | Caixa + força |
| Promover jovem da base | Base + moral |
| Deixar jogador no banco | Moral |
| Trocar formação | Match Engine |
| Ser ofensivo | Ataque ↑ / defesa ↓ |
| Investir no estádio | Caixa ↓ / receita futura ↑ |
| Cumprir objetivo da diretoria | Reputação ↑ |
| Ser demitido | Reputação ↓ |
| Ganhar título | Carreira ↑ |

Nenhum evento deve existir só para aparecer — todo evento deve responder
"o que isso muda?" (ver Event Engine em `game-design/`).

## 7. Mundo vivo

Enquanto o jogador está no seu clube, os outros clubes continuam
funcionando: contratam, vendem, demitem técnicos, promovem jovens, mudam
objetivos, sofrem crises financeiras, evoluem, sobem e caem de divisão.
O mundo não deve esperar pelo jogador — isso é responsabilidade do World
Engine (ver `technical/` e `game-design/`) e depende de IA de clubes com
personalidade própria, não decisões aleatórias sem contexto.

## 8. Definição de "boa feature"

Uma feature só deveria entrar no produto se cumprir pelo menos 3 destes
critérios: cria uma decisão · cria uma consequência · aumenta a sensação
de carreira · gera estratégia · cria narrativa · melhora a simulação.

### O que não fazer (regras negativas do projeto)

Não adicionar feature isolada sem ligação com o resto · não duplicar
funcionalidade existente · não criar componente visual fora do Design
System sem justificativa · não transformar tudo em números sem
personalidade · não fazer a IA agir aleatoriamente sem contexto · não
criar eventos sem consequência · não permitir que o motor de partidas
ignore as decisões do treinador · não fazer o jogador sentir que está só
navegando em menus.

## 9. UI / Design System (referência cruzada)

O GDD já definia, desde a v1.0, que a fundação visual deveria ser
Material 3 + BRDATA Design System, mobile-first, com um conjunto de
"componentes de jogo" nomeados (Player Card, Match Card, League Table,
Formation Pitch, Tactical Board, Player Rating, Financial Card, Manager
Profile, Career Timeline, News Card, Event Card, Objective Card). O
estado real de implementação desses componentes é tratado em
`docs/requirements/ui-ux/` (fonte vigente, reconciliada com o código),
não repetido aqui.

## 10. Retenção — os 3 horizontes

O jogo deve gerar 3 horizontes de motivação simultâneos:

- **Curto prazo** — próxima partida (ex.: "ganhar do rival").
- **Médio prazo** — próxima janela/objetivo da temporada (ex.:
  "classificar para a Libertadores").
- **Longo prazo** — construção da carreira (ex.: "virar treinador
  lendário").

## 11. Manifesto

> Você decide. O mundo reage. O futebol continua. Sua carreira é
> construída pelas consequências das suas escolhas.

Este é o princípio para avaliar toda nova funcionalidade, mecânica ou
alteração no jogo — vale como critério de aceite conceitual mesmo onde
não há um critério técnico formal.

---

## Nota de reconciliação (obrigatória por `docs/README.md` regra 4)

Este documento é fiel ao GDD original (visão/design, não estado de
implementação linha a linha). Ele **não afirma** que toda entidade,
perfil ou traço comportamental citado aqui já está implementado no
código — isso é responsabilidade de `docs/sprints/S2/S2_GDD_TECNICO.md`
(arquitetura, ver `technical/`) e do estado real do jogo (ver
`docs/HANDOFF_CLAUDE.md`/`docs/sprints/S4/` para o que já foi
verificado). Onde o produto atual (Modo Carreira, `public/js/carreira.js`)
diverge deste documento, a divergência deve ser registrada, não
silenciosamente ignorada nem presumida corrigida — regra de governança
0/4 de `docs/README.md`.
