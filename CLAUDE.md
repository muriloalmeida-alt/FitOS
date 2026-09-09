# BRDATA — CLAUDE.md
## Master Specification & Development Constitution
**Versão:** 1.0  
**Projeto:** BRDATA — Modo Carreira / Simulador de Futebol  
**Stack atual:** HTML + CSS + JavaScript + Node.js  
**Design:** Material 3 + BRDATA Design System

> **Governança PM ↔ Claude:** antes de tratar qualquer demanda funcional
> (feature, escopo, priorização, auditoria), ver `docs/README.md`
> (regras de governança) e `docs/HANDOFF_CLAUDE.md` (demanda vigente).
> GPT está indisponível como PM dedicado (09/2026) — Claude absorve as
> tarefas funcionais de PM via skill `pm` (`.claude/skills/pm/SKILL.md`),
> exceto a aprovação formal final, que continua sendo do Murilo. Este
> arquivo (constituição técnica) não muda por causa disso.

---

# 1. PROPÓSITO DESTE ARQUIVO

Este documento é a fonte de verdade para qualquer agente de IA que trabalhe no código do BRDATA.

Antes de alterar código, o agente deve:

1. entender a arquitetura existente;
2. preservar funcionalidades já implementadas;
3. consultar o Game Design Document (GDD), o GDD Técnico e o Game Engine Spec;
4. identificar se uma solicitação é:
   - correção;
   - evolução;
   - refatoração;
   - nova funcionalidade;
   - mudança de balanceamento;
5. evitar reconstruir sistemas que já existem.

> **Regra principal:** o BRDATA deve evoluir incrementalmente. Não substituir sistemas existentes por versões simplificadas sem autorização explícita.

---

# 2. DOCUMENTOS DE REFERÊNCIA

Os documentos abaixo devem ser tratados como uma cadeia de especificação:

```text
GDD
 ↓
GDD Técnico
 ↓
Game Engine Spec
 ↓
CLAUDE.md
 ↓
Código
```

### GDD
Define a visão do produto, experiência desejada e princípios de game design.

### GDD Técnico
Define arquitetura, módulos, dados, fluxos e responsabilidades técnicas.

### Game Engine Spec
Define as regras sistêmicas do jogo: partidas, jogadores, treinamento, mercado, finanças, carreira, IA e mundo.

### CLAUDE.md
Define como agentes de IA devem trabalhar no código.

Quando houver conflito:

1. solicitação explícita do usuário;
2. código atual validado;
3. GDD;
4. GDD Técnico;
5. Game Engine Spec;
6. suposições do agente.

---

# 3. ESTADO ATUAL DO PRODUTO

O BRDATA possui um Modo Carreira funcional e significativamente desenvolvido.

A implementação atual inclui, entre outros:

- escolha de clube;
- campeonato e calendário;
- elenco;
- escalação;
- formações;
- banco;
- táticas;
- instruções por setor;
- treinamento;
- evolução de jogadores;
- fadiga;
- lesões;
- cartões;
- suspensão;
- moral;
- conversas com jogadores;
- contratos;
- salários;
- finanças;
- orçamento;
- mercado de transferências;
- compra e venda;
- propostas;
- pagamentos parcelados;
- scouts;
- base;
- partidas simuladas;
- partidas em modo live;
- substituições durante partidas;
- alterações táticas durante partidas;
- intervalo;
- tabela;
- notícias;
- notificações;
- objetivos do clube;
- confiança/reputação do treinador;
- histórico de clubes;
- propostas de outros clubes;
- conquistas;
- ranking;
- estádio;
- comissão técnica.

**Não tratar esses sistemas como inexistentes.**

Se uma documentação antiga indicar que determinado sistema não existe, verificar o código atual antes de concluir qualquer coisa.

---

# 4. ARQUITETURA ATUAL

A carreira está concentrada principalmente em:

```text
public/
├── carreira.html
└── js/
    └── carreira.js

server/
└── src/
    └── careerStore.js
```

O Modo Carreira é relativamente independente do restante da aplicação.

## 4.1 carreira.js

É atualmente o principal núcleo da lógica da carreira.

Ele contém:

- estado da carreira;
- elenco;
- calendário;
- partidas;
- simulação;
- treinamento;
- mercado;
- contratos;
- finanças;
- moral;
- evolução;
- carreira do treinador;
- notícias;
- interface;
- modais;
- ações do jogador.

**Atenção:** o arquivo é grande e deve ser tratado como um monólito crítico.

Não fazer uma grande refatoração estrutural apenas para "organizar o código" sem um plano incremental.

---

# 5. REGRA DE OURO SOBRE FUNCIONALIDADES EXISTENTES

Antes de criar uma funcionalidade:

```text
SEARCH → UNDERSTAND → REUSE → EXTEND → ONLY THEN CREATE
```

O agente deve procurar:

- funções existentes;
- estado existente;
- componentes existentes;
- IDs existentes;
- eventos existentes;
- cálculos existentes;
- persistência existente;
- estilos existentes.

Nunca criar uma segunda implementação para o mesmo conceito sem justificar.

Exemplo:

❌ criar novo sistema de contratos quando `computeContractFields()` já existe.

✅ evoluir o sistema existente.

---

# 6. DESIGN SYSTEM

O BRDATA utiliza:

```text
Material 3
+
BRDATA Design System
+
Football Game UI
```

## 6.1 Material 3

M3 deve fornecer:

- princípios de acessibilidade;
- componentes;
- estados;
- hierarquia;
- interação;
- responsividade;
- navegação;
- feedback.

## 6.2 BRDATA DS

O Design System proprietário define a identidade visual.

Direção visual:

- navy;
- branco;
- cinzas escuros;
- amarelo/dourado como destaque;
- alto contraste;
- visual moderno;
- leitura rápida;
- densidade adequada para produto de gestão esportiva.

## 6.3 Regra

Não criar estilos isolados quando existir token/componente equivalente.

Evitar:

```css
color: #123456;
padding: 13px;
border-radius: 7px;
```

quando existir token do DS.

Preferir tokens semânticos.

---

# 7. COMPONENTES DE JOGO

Sempre que possível, utilizar ou evoluir componentes conceituais como:

- PlayerCard;
- MatchCard;
- LeagueTable;
- FormationPitch;
- TacticalBoard;
- PlayerRating;
- TrainingCard;
- InjuryStatus;
- MatchEvent;
- ManagerProfile;
- ClubObjective;
- FinancialSummary;
- TransferCard;
- ContractCard;
- NewsCard.

O objetivo é que o usuário reconheça imediatamente o padrão visual e funcional.

---

# 8. ESTADO DA CARREIRA

O objeto `CAREER` é a principal fonte de estado da carreira.

Antes de criar uma nova propriedade:

1. verificar se ela já existe;
2. verificar se pode ser derivada;
3. verificar impacto em saves antigos;
4. definir valor default;
5. definir estratégia de migração/backfill.

Nunca introduzir uma propriedade sem considerar saves existentes.

---

# 9. PERSISTÊNCIA

A persistência atual utiliza o backend como armazenamento do blob da carreira.

O backend valida apenas a estrutura básica.

Isso significa que a maior parte da regra de negócio atualmente está no cliente.

### Implicações

Qualquer mudança em:

- tamanho do save;
- estrutura de `CAREER`;
- serialização;
- histórico;
- arrays;
- objetos aninhados;

deve considerar:

- limite de payload;
- saves antigos;
- compatibilidade;
- corrupção;
- performance.

O `careerStore.js` possui limite de aproximadamente 768 KB por save.

O sistema também utiliza persistência com escrita debounced.

---

# 10. VERSIONAMENTO DE SAVE

Toda evolução estrutural importante deve considerar:

```js
career.schemaVersion
```

Quando possível, usar migrações explícitas:

```text
v1 → v2 → v3
```

Nunca depender exclusivamente de `if (!field)` espalhados pelo código.

Objetivo futuro:

```js
migrateCareer(save)
```

com migrações determinísticas.

---

# 11. GAME LOOP

O loop conceitual da carreira é:

```text
ROUND START
   ↓
Calendar
   ↓
Training
   ↓
Market / Management
   ↓
Match
   ↓
Events
   ↓
Finances
   ↓
Player Evolution
   ↓
News / Notifications
   ↓
Standings
   ↓
Board / Objectives
   ↓
Next Round
```

Qualquer nova mecânica deve declarar em qual etapa do loop ela entra.

---

# 12. MATCH ENGINE

O motor de partidas deve permanecer determinístico quando receber:

```text
estado inicial
+
seed
+
decisões
```

A partida deve ser reproduzível.

O usuário não deve perceber resultados arbitrários sem causa.

---

# 13. FORÇA DAS EQUIPES

O BRDATA utiliza força agregada de equipe para simulação.

A força humana deve considerar, conforme a implementação atual:

- qualidade dos titulares;
- ataque;
- defesa;
- completude do elenco;
- formação;
- tática;
- treinamento;
- condição/fadiga;
- alterações feitas durante a partida.

Não criar uma segunda fórmula paralela sem necessidade.

---

# 14. LIVE MATCH

O modo live atualmente trabalha em blocos de partida.

A estrutura existente permite:

- evolução por etapas;
- intervalo;
- substituições;
- alterações táticas;
- atualização de força;
- eventos;
- conclusão da partida.

Alterações realizadas pelo treinador durante o jogo devem afetar os blocos subsequentes.

---

# 15. FORMAÇÕES

O sistema atual suporta diversas formações.

Entre elas:

- 4-4-2;
- 4-3-3;
- 4-2-3-1;
- 3-5-2;
- 4-5-1;
- 5-3-2;
- 4-1-4-1;
- 4-4-1-1;
- 3-4-3;
- 4-1-3-2;
- 3-4-2-1;
- 4-3-1-2;
- 4-2-2-2;
- 5-4-1.

Ao adicionar formação:

1. definir distribuição posicional;
2. validar posições;
3. atualizar visualização;
4. atualizar cálculo;
5. testar escalação;
6. testar substituições;
7. testar saves existentes.

---

# 16. TÁTICAS

O sistema possui quatro eixos principais:

- ritmo de jogo;
- pressão;
- linha defensiva;
- estilo de passe.

Cada eixo possui escala de 1 a 5.

Também existem instruções por setor:

### Defesa
- linha defensiva;
- pressão pós-perda;
- compactação;
- saída de bola;
- bola parada defensiva.

### Meio
- intensidade de marcação;
- amplitude;
- transição;
- rotação de bola;
- cobertura de espaços.

### Ataque
- amplitude ofensiva;
- movimentação;
- últimos passes;
- finalização;
- bola parada ofensiva.

Qualquer alteração deve preservar a coerência entre UI e engine.

---

# 17. TREINAMENTO

O treinamento é semanal.

Existe:

- foco;
- intensidade;
- grupos;
- descanso;
- treinamento individual;
- impacto físico;
- evolução;
- fadiga;
- risco de lesão.

A evolução deve respeitar o potencial do jogador.

Regra de design:

> Quanto mais próximo do potencial, menor deve ser o ganho marginal.

Treinamento não pode ser uma fonte infinita de crescimento.

---

# 18. JOGADORES

Jogadores devem ser tratados como entidades persistentes, não apenas números.

Características importantes:

- idade;
- posição;
- overall;
- potencial;
- atributos;
- condição;
- forma;
- moral;
- contrato;
- salário;
- valor de mercado;
- histórico;
- comportamento.

A evolução deve gerar histórias.

---

# 19. MORAL E PERSONALIDADE

Moral deve influenciar comportamento.

Exemplos:

```text
Banco frequente
→ queda de moral
→ desejo de transferência
→ conversa
→ decisão
```

Conversas devem ter consequências.

Evitar sistemas decorativos.

---

# 20. CONTRATOS

O sistema já possui contratos e deve ser evoluído, não reconstruído.

Devem existir relações entre:

```text
idade
+
overall
+
potencial
+
valor
+
salário
+
duração
```

Futuras evoluções podem incluir:

- renovação;
- cláusulas;
- bônus;
- luvas;
- promessa de titularidade;
- insatisfação;
- agente;
- rescisão.

---

# 21. MERCADO

O mercado possui:

- janelas;
- compra;
- venda;
- propostas;
- listagens;
- IA;
- parcelamento;
- recebíveis.

Janelas atuais:

```text
Rodadas 1–3
Rodadas 20–22
```

Venda pode ocorrer fora da janela conforme regra atual.

Qualquer evolução deve evitar mercado infinito ou economicamente quebrado.

---

# 22. IA DOS CLUBES

A IA deve representar decisões plausíveis de clubes.

Um clube deve considerar:

- posição na tabela;
- força do elenco;
- orçamento;
- idade;
- potencial;
- necessidade por posição;
- salários;
- contexto da temporada.

Evitar decisões aleatórias sem explicação.

---

# 23. FINANÇAS

Finanças são parte estrutural do jogo.

O caixa deve refletir:

- salários;
- comissão;
- scouts;
- patrocínio;
- transferências;
- parcelas;
- estádio;
- premiações;
- outras receitas/despesas.

O ledger financeiro deve permitir explicar ao usuário por que o caixa mudou.

---

# 24. CONSELHO

O conselho deve funcionar como sistema de pressão.

Possíveis dimensões:

- resultado esportivo;
- finanças;
- objetivos;
- reputação;
- confiança.

A punição deve ser progressiva.

Evitar demissões aleatórias.

---

# 25. CARREIRA DO TREINADOR

A carreira do técnico já existe.

Deve ser tratada como uma camada superior ao clube.

O treinador possui:

- reputação;
- histórico;
- títulos;
- posições;
- passagens por clubes;
- propostas.

A reputação deve ser consequência das decisões e resultados.

Objetivo:

```text
começar pequeno
→ performar
→ ganhar reputação
→ receber propostas
→ assumir clubes maiores
→ construir legado
```

---

# 26. NARRATIVA

O BRDATA não deve ser apenas uma planilha.

O objetivo é criar:

> **uma história emergente de futebol.**

Exemplo:

```text
Jogador jovem sobe da base
↓
entra no time
↓
marca gol decisivo
↓
vira titular
↓
recebe proposta
↓
clube recusa
↓
jogador fica insatisfeito
↓
renovação
↓
vira capitão
```

A narrativa deve surgir dos sistemas existentes.

---

# 27. NEWS ENGINE

As notícias devem transformar dados em contexto.

Exemplos:

- vitória importante;
- sequência negativa;
- jogador em grande fase;
- lesão;
- transferência;
- crise financeira;
- troca de treinador;
- título;
- briga contra rebaixamento.

Não criar notícias desconectadas dos dados reais.

---

# 28. EVENT ENGINE

Eventos devem possuir:

```text
trigger
+
conditions
+
effect
+
message
+
cooldown
```

Exemplo:

```text
IF
player.morale < 30
AND
benchStreak >= 5

THEN
wantsTransfer = true
```

Eventos devem ser testáveis.

---

# 29. ANTI-EXPLOIT

Toda mecânica econômica deve ser analisada contra exploits.

Exemplos:

- comprar barato e vender instantaneamente por valor artificial;
- farm infinito de treinamento;
- abuso de empréstimos;
- parcelamento infinito;
- manipulação de moral;
- reset de partida;
- repetição de eventos.

Pergunta obrigatória:

> "Como um jogador tentaria quebrar esse sistema?"

---

# 30. BALANCEAMENTO

Antes de alterar valores, observar:

- média;
- mediana;
- distribuição;
- extremos;
- evolução por temporada;
- impacto no usuário;
- impacto na IA.

Nunca balancear apenas olhando um caso.

---

# 31. OBSERVABILIDADE

Sempre que possível, eventos importantes devem gerar logs estruturados em desenvolvimento.

Exemplo:

```js
debugGameEvent({
  type: 'TRANSFER',
  playerId,
  clubFrom,
  clubTo,
  value,
  round
});
```

Não expor informações técnicas desnecessárias ao usuário final.

---

# 32. TESTES

Toda mecânica crítica deve possuir testes ou funções testáveis.

Prioridades:

1. match engine;
2. standings;
3. transferências;
4. finanças;
5. contratos;
6. treinamento;
7. evolução;
8. moral;
9. carreira;
10. persistência.

Casos extremos são obrigatórios.

---

# 33. COMPATIBILIDADE DE SAVES

Qualquer alteração de dados deve testar:

- save novo;
- save antigo;
- save incompleto;
- save grande;
- valores nulos;
- jogadores sem campos novos;
- clubes sem campos novos.

Nunca quebrar uma carreira existente por causa de uma nova propriedade opcional.

---

# 34. UI/UX

O usuário deve sempre saber:

```text
ONDE ESTOU?
O QUE POSSO FAZER?
O QUE ACONTECEU?
POR QUE ACONTECEU?
O QUE POSSO FAZER AGORA?
```

Toda tela importante deve possuir:

- hierarquia;
- contexto;
- ação primária;
- feedback;
- estado vazio;
- estado de erro;
- estado de carregamento quando necessário.

---

# 35. MOBILE FIRST

O jogo deve funcionar muito bem em mobile.

Priorizar:

- toque;
- leitura;
- densidade;
- navegação;
- scroll;
- modais;
- bottom sheets;
- feedback visual;
- ações rápidas.

Não simplesmente "encolher" a versão desktop.

---

# 36. REGRA PARA NOVAS FEATURES

Toda nova feature deve responder:

### Produto
- qual problema resolve?
- qual comportamento cria?
- qual impacto no loop?

### Game Design
- qual decisão o jogador toma?
- qual risco existe?
- qual recompensa existe?

### Engine
- quais dados entram?
- quais dados saem?
- qual fórmula?
- quais efeitos colaterais?

### UX
- onde aparece?
- como o jogador entende?
- como desfaz/corrige?

### Persistência
- precisa salvar?
- como migrar?

### IA
- CPU também utiliza?

### Balance
- como pode ser abusada?

---

# 37. PROCESSO OBRIGATÓRIO DO AGENTE

Antes de editar:

```text
1. INSPECIONAR
2. LOCALIZAR
3. ENTENDER
4. PLANEJAR
5. ALTERAR
6. TESTAR
7. REVISAR
```

Nunca começar escrevendo código.

---

# 38. CHECKLIST PRÉ-CÓDIGO

```text
[ ] Encontrei a implementação existente?
[ ] Entendi o estado envolvido?
[ ] Entendi o fluxo?
[ ] Identifiquei dependências?
[ ] Verifiquei saves antigos?
[ ] Verifiquei UI?
[ ] Verifiquei engine?
[ ] Verifiquei IA?
[ ] Verifiquei impacto econômico?
[ ] Verifiquei mobile?
```

---

# 39. CHECKLIST PÓS-CÓDIGO

```text
[ ] Feature funciona?
[ ] Não quebrou feature existente?
[ ] Save continua compatível?
[ ] UI usa DS?
[ ] Mobile funciona?
[ ] CPU continua funcionando?
[ ] Balanceamento continua razoável?
[ ] Não existem duplicações?
[ ] Erros são tratados?
[ ] Código não criou dívida desnecessária?
```

---

# 40. REFATORAÇÃO

Refatorações grandes devem ser feitas em etapas.

Preferir:

```text
Monólito
↓
extrair função
↓
testar
↓
extrair módulo
↓
testar
↓
migrar chamadas
↓
remover código antigo
```

Evitar:

```text
carreira.js gigante
↓
reescrever tudo
↓
"deve funcionar"
```

---

# 41. PERFORMANCE

Evitar:

- renders desnecessários;
- cálculos repetidos;
- loops sobre todo o universo sem necessidade;
- serialização excessiva;
- listeners duplicados;
- DOM excessivo;
- chamadas de API redundantes.

Especialmente importante em mobile.

---

# 42. SEGURANÇA

Nunca confiar no cliente para regras que futuramente precisem ser protegidas.

A arquitetura atual possui lógica importante no cliente, mas futuras evoluções podem mover regras críticas para o servidor.

Nunca expor:

- segredos;
- tokens;
- credenciais;
- chaves privadas.

---

# 43. API-Sports / DADOS EXTERNOS

Dados externos devem ser tratados como fonte de dados, não como autoridade absoluta da simulação.

Separar conceitualmente:

```text
REAL WORLD DATA
vs
CAREER WORLD
```

A carreira precisa sobreviver mesmo quando a API externa estiver indisponível.

---

# 44. PRINCÍPIO DE DETERMINISMO

Sempre que possível:

```text
mesmo estado
+
mesma seed
+
mesmas decisões
=
mesmo resultado
```

Isso facilita:

- testes;
- debug;
- reprodução de bugs;
- balanceamento.

---

# 45. PRINCÍPIO DE EXPLICABILIDADE

Resultados importantes devem poder ser explicados.

Exemplo:

> "Seu time perdeu porque sofreu queda física no segundo tempo e o adversário explorou a faixa direita."

É melhor do que:

> "O algoritmo decidiu."

---

# 46. PRINCÍPIO DE EMERGÊNCIA

O jogo deve permitir que histórias inesperadas apareçam da combinação dos sistemas.

Não escrever scripts para cada história.

Criar sistemas que permitam:

```text
causa
→ consequência
→ nova situação
→ nova decisão
```

---

# 47. PRIORIDADES DE EVOLUÇÃO

A ordem recomendada é:

### P0 — Confiabilidade
- bugs;
- saves;
- persistência;
- crashes;
- regressões.

### P1 — Game Engine
- profundidade;
- consistência;
- determinismo;
- explicabilidade.

### P2 — Jogadores
- personalidade;
- evolução;
- moral;
- relações;
- histórico.

### P3 — Mundo
- IA;
- mercado;
- clubes;
- competições;
- narrativa.

### P4 — UX
- onboarding;
- mobile;
- navegação;
- feedback;
- dashboards.

### P5 — Retenção
- objetivos;
- conquistas;
- carreira;
- temporadas;
- legado.

---

# 48. DEFINIÇÃO DE PRONTO

Uma feature só está pronta quando:

```text
FUNCIONA
+
É COMPREENSÍVEL
+
É PERSISTENTE
+
É BALANCEADA
+
É RESPONSIVA
+
NÃO QUEBRA O EXISTENTE
```

---

# 49. REGRA FINAL PARA AGENTES DE IA

O agente não deve tentar "melhorar o jogo" de forma genérica.

Ele deve:

> **preservar o que funciona, entender o sistema, evoluir com intenção e deixar o código melhor do que encontrou.**

Antes de qualquer alteração importante, apresentar mentalmente esta sequência:

```text
O que já existe?
↓
O que o usuário quer?
↓
Qual é o menor conjunto de mudanças?
↓
Quais sistemas serão afetados?
↓
Como testar?
↓
Como evitar regressão?
```

---

# 50. VISÃO DO BRDATA

O BRDATA deve evoluir de:

> "um simulador de futebol"

para:

> **"um mundo de futebol em que o jogador constrói sua própria carreira como treinador."**

O diferencial não será apenas ter mais telas ou mais estatísticas.

Será a combinação de:

```text
MATCH ENGINE
+
PLAYER ENGINE
+
TRAINING
+
MARKET
+
FINANCE
+
BOARD
+
MANAGER CAREER
+
WORLD AI
+
NARRATIVE
+
DATA
```

formando um sistema único.

---

## FIM

**BRDATA — Game Design & Engineering Constitution**

Versão 1.0
