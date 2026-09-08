# BR DATA TREINADOR

# Game Design Bible — GDB v1.0

**Status:** Documento-base
**Produto:** BR Data Treinador
**Gênero:** Football Management / Simulation
**Plataforma:** Web + Mobile Web
**Referências:** Elifoot, Football Manager, Top Eleven
**Foco:** Futebol brasileiro
**Escopo inicial:** Clubes brasileiros + carreira de treinador

**Princípio:** Você não joga partidas. Você constrói uma carreira.

---

## 01. VISÃO DO PRODUTO

### 1.1 Conceito

BR Data Treinador é um jogo de gerenciamento de futebol no qual o jogador assume o papel de um treinador e administra todos os aspectos esportivos e estratégicos de um clube.

O jogador deve:

- montar elenco;
- contratar e vender jogadores;
- definir escalações;
- criar estratégias;
- treinar jogadores;
- administrar contratos;
- controlar finanças;
- desenvolver jovens;
- lidar com diretoria;
- administrar relacionamento com jogadores;
- disputar competições;
- tomar decisões durante partidas;
- construir reputação;
- receber propostas;
- mudar de clube;
- construir uma carreira.

---

## 02. PILARES DO JOGO

O jogo deve ser guiado por 5 pilares.

**01 — DECISÃO**

O jogador deve tomar decisões relevantes constantemente.

**02 — CONSEQUÊNCIA**

Toda decisão importante deve gerar algum efeito.

**03 — PROGRESSÃO**

O clube e o treinador devem evoluir.

**04 — HISTÓRIA**

Cada carreira deve produzir acontecimentos únicos.

**05 — SIMPLICIDADE**

A profundidade deve existir sem transformar a interface em uma planilha incompreensível.

---

## 03. CORE LOOP

O loop principal é:

```text
ANALISAR
   ↓
DECIDIR
   ↓
EXECUTAR
   ↓
JOGAR
   ↓
RESULTADO
   ↓
CONSEQUÊNCIA
   ↓
EVOLUIR
   ↓
ANALISAR NOVAMENTE
```

Exemplo:

```text
O atacante está em má fase.
↓
O treinador decide colocá-lo no banco.
↓
O reserva entra.
↓
Marca dois gols.
↓
A moral do titular cai.
↓
O reserva ganha confiança.
↓
A imprensa começa a falar da disputa pela posição.
↓
O treinador precisa tomar uma nova decisão.
```

Isso é gameplay.

---

## 04. META LOOP

Além do loop diário existe o loop de carreira:

```text
CLUBE
 ↓
TEMPORADA
 ↓
RESULTADOS
 ↓
REPUTAÇÃO
 ↓
MERCADO DE TREINADORES
 ↓
NOVO CLUBE
 ↓
NOVO DESAFIO
 ↓
NOVA TEMPORADA
```

O objetivo final não é simplesmente ganhar o campeonato.

É:

> Construir a carreira mais marcante possível.

---

## 05. ENTIDADE: TREINADOR

O treinador é o protagonista.

### Atributos principais

**Reputação**

0–100.

**Experiência**

Representa o histórico acumulado.

**Especialidades**

- Tática
- Gestão
- Formação
- Motivação
- Desenvolvimento

**Perfil**

Exemplos:

- **Mestre Tático** — bônus em preparação e alterações durante partidas.
- **Formador** — bônus no desenvolvimento de jovens.
- **Gestor** — maior eficiência financeira.
- **Motivador** — maior recuperação de moral.

---

## 06. REPUTAÇÃO

Faixas:

| Pontuação | Status |
|---|---|
| 0–19 | Contestado |
| 20–39 | Em dúvida |
| 40–59 | Estabelecido |
| 60–79 | Renomado |
| 80–100 | Lendário |

A reputação influencia:

- propostas;
- expectativa dos clubes;
- facilidade para conseguir emprego;
- confiança da diretoria;
- imprensa;
- valor percebido do treinador.

---

## 07. CARREIRA DO TREINADOR

Cada treinador possui um histórico permanente.

### Registro

- clubes;
- temporadas;
- partidas;
- vitórias;
- empates;
- derrotas;
- gols;
- títulos;
- acessos;
- rebaixamentos;
- demissões;
- melhor campanha;
- maior sequência invicta.

### Histórico visual

```text
2026  Londrina    8º lugar
2027  Londrina    3º lugar
2028  Coritiba    6º lugar
2029  Coritiba    🏆 Campeão
```

Esse histórico deve ser uma das telas mais importantes do jogo.

---

## 08. ENTIDADE: CLUBE

Todo clube possui identidade própria.

**Esportivo**

- força;
- elenco;
- profundidade;
- qualidade da base;
- estrutura.

**Financeiro**

- caixa;
- receitas;
- despesas;
- folha;
- patrimônio;
- dívidas.

**Institucional**

- reputação;
- tamanho;
- diretoria;
- pressão.

**Social**

- torcida;
- expectativa;
- rivalidades.

---

## 09. IDENTIDADE DO CLUBE

Cada clube deve possuir uma filosofia.

Exemplos:

```text
CLUBE A
Grande clube
Alta pressão
Busca títulos
Mercado caro

CLUBE B
Formador
Baixo orçamento
Aposta em jovens
Vende jogadores

CLUBE C
Acesso
Baixo orçamento
Empréstimos
Busca jogadores experientes
```

Isso será fundamental para a IA.

---

## 10. ENTIDADE: JOGADOR

O jogador possui quatro camadas.

**Identidade**

- nome;
- idade;
- posição;
- nacionalidade.

**Capacidade**

- atributos;
- overall;
- potencial.

**Estado**

- condição;
- forma;
- moral;
- confiança;
- lesão;
- suspensão.

**Contexto**

- contrato;
- salário;
- titularidade;
- relacionamento;
- desejo de transferência.

---

## 11. JOGADOR COMO PERSONAGEM

Regra:

> Jogadores não devem ser apenas números.

Cada jogador pode possuir características comportamentais:

- ambicioso;
- leal;
- profissional;
- temperamental;
- paciente;
- competitivo;
- inseguro;
- líder.

Essas características influenciam eventos.

---

## 12. MORAL

A moral é dinâmica.

Pode ser afetada por:

- titularidade;
- banco;
- sequência de jogos;
- gols;
- desempenho;
- contrato;
- relacionamento com treinador;
- resultados;
- promessas;
- transferências.

Estados:

```text
Excelente
Boa
Normal
Baixa
Muito baixa
```

---

## 13. ESCALAÇÃO

O treinador define:

- titulares;
- banco;
- formação;
- capitão;
- cobradores;
- funções.

O sistema deve alertar:

> "Jogador fora de posição."

> "Jogador com condição baixa."

> "Reserva mais adequado disponível."

Mas não deve impedir a decisão do jogador, salvo regras fundamentais.

---

## 14. TÁTICA

A tática é um dos principais diferenciais do jogo.

**Formação**

Exemplos:

- 4-4-2
- 4-3-3
- 4-2-3-1
- 3-5-2
- 4-5-1
- 5-3-2

**Mentalidade**

- defensiva;
- equilibrada;
- ofensiva.

**Marcação**

- zona;
- individual.

**Ritmo**

- paciente;
- normal;
- direto.

**Setores**

Permitir instruções específicas para:

- defesa;
- meio;
- ataque.

---

## 15. TREINAMENTO

O treinamento deve representar preparação, não apenas um botão de bônus.

**Tipos:**

- equilibrado;
- ataque;
- defesa;
- físico.

**No futuro:**

- tática;
- bola parada;
- finalização;
- posse;
- pressão;
- recuperação.

---

## 16. PARTIDA

A partida é o principal momento de execução das decisões.

Fluxo:

```text
PRÉ-JOGO
 ↓
ESCALAÇÃO
 ↓
TÁTICA
 ↓
PARTIDA
 ↓
INTERVALO
 ↓
AJUSTES
 ↓
2º TEMPO
 ↓
RESULTADO
 ↓
PÓS-JOGO
```

Durante a partida:

- substituições;
- mudança tática;
- eventos;
- gols;
- cartões;
- lesões;
- posse;
- finalizações;
- momentum.

---

## 17. MATCH ENGINE

O motor deve considerar:

**Força**

- ataque;
- defesa;
- goleiro.

**Contexto**

- mando;
- formação;
- mentalidade;
- ritmo;
- condição;
- moral;
- qualidade dos titulares.

**Estado da partida**

- placar;
- tempo;
- cartões;
- substituições;
- expulsões;
- momentum.

### Regra fundamental

> Decisões do treinador precisam alterar probabilidades, não determinar resultados.

O jogador deve sentir:

> "Minha decisão aumentou minhas chances."

Nunca:

> "Cliquei em atacar e fiz gol."

---

## 18. MERCADO

O mercado deve ser um ecossistema.

Cada clube possui:

- orçamento;
- necessidades;
- política de contratação;
- perfil;
- prioridades.

Mercado inclui:

- compra;
- venda;
- empréstimo;
- propostas;
- contrapropostas;
- parcelas;
- salários;
- contratos.

---

## 19. FINANÇAS

Categorias:

**Receitas**

- bilheteria;
- patrocínio;
- premiação;
- vendas;
- outras receitas.

**Despesas**

- salários;
- comissão;
- contratações;
- parcelas;
- estádio;
- scouting;
- base.

O jogador deve sempre conseguir responder:

> "Por que meu caixa está diminuindo?"

---

## 20. DIRETORIA

A diretoria possui expectativas.

Exemplos:

- terminar no G8;
- conquistar título;
- desenvolver jovens;
- reduzir folha;
- melhorar finanças.

**Confiança**

```text
████████░░ 78%
DIRETORIA SATISFEITA
```

A confiança deve reagir à temporada.

---

## 21. TORCIDA

A torcida acompanha:

- resultados;
- rivalidades;
- contratações;
- desempenho;
- estilo de jogo;
- promessas.

Estados:

```text
Eufórica → Satisfeita → Neutra → Insatisfeita → Revoltada
```

---

## 22. IMPRENSA

A imprensa transforma eventos em narrativa.

Exemplos:

> "Treinador aposta em jovem de 18 anos."

> "Torcida perde paciência após terceira derrota."

> "Atacante reserva pede mais oportunidades."

> "Diretoria banca treinador."

As notícias devem ser consequência dos sistemas.

---

## 23. MUNDO VIVO

Esse é um dos grandes objetivos do GDB.

Enquanto o jogador está no seu clube: outros clubes continuam funcionando.

Eles:

- contratam;
- vendem;
- demitem técnicos;
- promovem jovens;
- mudam objetivos;
- sofrem crises financeiras;
- evoluem;
- caem;
- sobem.

O mundo não pode esperar pelo jogador.

---

## 24. IA DOS CLUBES

Cada clube terá:

**Personalidade**

- conservador;
- agressivo;
- formador;
- vendedor;
- gastador.

**Estratégia**

- contratar;
- vender;
- desenvolver;
- emprestar.

**Necessidades**

```text
GK  █░░
DEF ███
MEI ██
ATA ████
```

A IA deve tomar decisões de acordo com isso.

---

## 25. TEMPORADA

Cada temporada possui:

```text
PRÉ-TEMPORADA
 ↓
MERCADO
 ↓
CAMPEONATO
 ↓
JANELA
 ↓
SEGUNDO TURNO
 ↓
DECISÕES
 ↓
ENCERRAMENTO
 ↓
PREMIAÇÕES
 ↓
BALANÇO
 ↓
MERCADO DE TREINADORES
 ↓
NOVA TEMPORADA
```

---

## 26. PROGRESSÃO

Existem três progressões diferentes:

**Treinador**

Reputação e experiência.

**Clube**

Financeiro, estrutura e reputação.

**Jogador**

Forma, evolução e potencial.

Isso evita que o jogo seja simplesmente:

> "aumentar overall".

---

## 27. EVENTOS

Eventos são gerados pelo estado do mundo.

**Categorias:**

**Esportivos**

- lesão;
- suspensão;
- sequência;
- crise técnica.

**Humanos**

- jogador insatisfeito;
- promessa;
- conflito;
- liderança.

**Financeiros**

- patrocinador;
- crise;
- receita inesperada.

**Mercado**

- proposta;
- interesse;
- oportunidade.

**Institucionais**

- diretoria;
- torcida;
- imprensa.

---

## 28. REGRA DE OURO DOS EVENTOS

Nenhum evento deve existir apenas para aparecer.

Todo evento deve responder:

> "O que isso muda?"

Exemplo:

```text
JOGADOR PEDE PARA SAIR
        ↓
    MORAL -15
        ↓
  DESEMPENHO ↓
        ↓
TREINADOR DECIDE
   ↙          ↘
VENDER       CONVENCER
   ↓             ↓
MERCADO       MORAL ↑
```

---

## 29. UI / DESIGN SYSTEM

O GDB também passa a definir a regra visual.

**Fundação**

Material 3

**Identidade**

BR Data Design System

**Princípios**

- navy;
- branco;
- tons escuros;
- alto contraste;
- informação hierarquizada;
- densidade controlada;
- mobile-first.

**Componentes de jogo**

- Player Card
- Match Card
- League Table
- Formation Pitch
- Tactical Board
- Player Rating
- Financial Card
- Manager Profile
- Career Timeline
- News Card
- Event Card
- Objective Card

**Regra:** uma nova tela deve reutilizar componentes do DS antes de criar componentes próprios.

---

## 30. MOBILE FIRST

A experiência principal precisa funcionar com uma mão.

Prioridade:

```text
INFORMAÇÃO
 ↓
DECISÃO
 ↓
AÇÃO
```

Evitar:

- tabelas gigantes;
- menus profundos;
- excesso de modais;
- texto sem hierarquia;
- telas com muitas decisões simultâneas.

---

## 31. ECONOMIA DO JOGO

A economia deve possuir:

**Fontes**

- bilheteria;
- patrocínio;
- premiação;
- venda de atletas.

**Sumidouros**

- salários;
- transferências;
- infraestrutura;
- scouting;
- base.

O dinheiro deve ser escasso o suficiente para gerar decisões, mas não tão escasso que torne o jogo frustrante.

---

## 32. RETENÇÃO

O jogo deve gerar três horizontes.

**Curto prazo**

Próxima partida.

**Médio prazo**

Próxima janela / objetivo.

**Longo prazo**

Construção da carreira.

Exemplo:

```text
HOJE
Ganhar do rival.

ESTA TEMPORADA
Classificar para Libertadores.

CARREIRA
Virar treinador lendário.
```

---

## 33. PRINCÍPIO FUNDAMENTAL: CONSEQUÊNCIA

Toda decisão importante deve alimentar outro sistema.

| Decisão | Consequência |
|---|---|
| Contratar jogador | Finanças + elenco |
| Vender titular | Caixa + força |
| Promover jovem | Base + moral |
| Deixar jogador no banco | Moral |
| Trocar formação | Match Engine |
| Ser ofensivo | Ataque ↑ / defesa ↓ |
| Gastar no estádio | Caixa ↓ / receita futura ↑ |
| Cumprir objetivo | Reputação ↑ |
| Ser demitido | Reputação ↓ |
| Ganhar título | Carreira ↑ |

---

## 34. O QUE NÃO FAZER

Estas passam a ser regras do projeto.

❌ Não adicionar feature isolada.

❌ Não duplicar funcionalidades existentes.

❌ Não criar componentes visuais fora do DS sem justificativa.

❌ Não transformar tudo em números.

❌ Não fazer a IA agir aleatoriamente sem contexto.

❌ Não criar eventos sem consequência.

❌ Não permitir que o Match Engine ignore as decisões do treinador.

❌ Não fazer o jogador sentir que está apenas navegando em menus.

---

## 35. DEFINIÇÃO DE "BOA FEATURE"

Uma feature só deve entrar no produto se cumprir pelo menos três destes critérios:

① Cria uma decisão

② Cria uma consequência

③ Aumenta a sensação de carreira

④ Gera estratégia

⑤ Cria narrativa

⑥ Melhora a simulação

---

## 36. VISÃO DE FUTURO

A experiência ideal seria algo assim:

Você começa como um treinador desconhecido.

Escolhe um clube pequeno.

Tem pouco dinheiro.

Contrata dois jogadores baratos.

Promove um garoto da base.

O garoto começa a marcar gols.

A torcida gosta.

Você termina em terceiro.

Recebe proposta de um clube maior.

Aceita.

No novo clube, precisa lidar com jogadores caros, diretoria exigente e torcida pressionando.

Depois de cinco temporadas:

Você já não está jogando "uma carreira".

Você está contando a história de um treinador.

---

## 37. MANIFESTO DO BR DATA TREINADOR

> Você decide.
>
> O mundo reage.
>
> O futebol continua.
>
> Sua carreira é construída pelas consequências das suas escolhas.

Esse é o princípio que eu usaria para avaliar toda nova funcionalidade, mecânica ou alteração no jogo.
