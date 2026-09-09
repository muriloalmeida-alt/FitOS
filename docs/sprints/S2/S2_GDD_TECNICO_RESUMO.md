BRDATA — S2

GDD TÉCNICO / ARQUITETURA

Sprint: S2
Status: Concluída
Produto: BR Data Treinador

⸻

1. Objetivo

Definir a arquitetura conceitual que sustenta o Game Design.

A arquitetura deve permitir:

* evolução incremental;
* persistência;
* integração entre sistemas;
* simulação;
* IA;
* carreira;
* expansão futura.

⸻

2. Arquitetura conceitual

```
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

Os motores compartilham o estado da carreira através de interfaces claras.

⸻

3. CAREER

O objeto `CAREER` representa o estado principal da carreira.

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

⸻

4. Career Engine

Responsável por:

* ciclo de temporadas;
* rodada atual;
* clube;
* treinador;
* calendário;
* objetivos;
* histórico;
* progressão de carreira.

⸻

5. Match Engine

Responsável por:

* simulação;
* força das equipes;
* eventos;
* gols;
* cartões;
* substituições;
* alterações táticas;
* resultado.

Princípio:

```
estado inicial
+
seed
+
decisões
=
resultado
```

Sempre que possível, o resultado deve ser reproduzível.

⸻

6. Player Engine

Responsável por:

* atributos;
* potencial;
* condição;
* forma;
* moral;
* personalidade;
* evolução;
* declínio;
* relacionamento;
* papel no elenco.

⸻

7. Training Engine

Responsável por:

* treinamento;
* foco;
* intensidade;
* desenvolvimento;
* fadiga;
* risco de lesão.

Trade-off:

```
Intensidade ↑
    ↓
Desenvolvimento ↑
    +
Fadiga ↑
    +
Risco de lesão ↑
```

⸻

8. Transfer Engine

Responsável por:

* mercado;
* compra;
* venda;
* propostas;
* negociação;
* contratos;
* transferências.

Estados conceituais:

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

9. Economy Engine

Responsável por:

* receitas;
* despesas;
* salários;
* transferências;
* parcelas;
* orçamento;
* caixa.

Fluxo:

```
OpeningBalance
+ Revenue
- Expenses
= ClosingBalance
```

Toda alteração financeira deve possuir origem identificável.

⸻

10. Board Engine

Responsável por:

* objetivos;
* expectativas;
* confiança;
* recompensas;
* penalidades.

Objetivo:

transformar a diretoria em sistema de pressão e não apenas em interface.

⸻

11. Reputation Engine

Reputação do treinador:

```
0–100
```

Pode ser influenciada por:

* vitórias;
* títulos;
* acessos;
* desenvolvimento;
* objetivos;
* derrotas;
* rebaixamento;
* crises.

⸻

12. World Engine

O mundo deve simular:

* resultados;
* mercado;
* técnicos;
* demissões;
* promoções;
* rebaixamentos;
* desenvolvimento;
* finanças;
* notícias.

O mundo continua existindo sem a ação direta do jogador.

⸻

13. Event Engine

Eventos devem possuir:

```
trigger
conditions
effect
message
cooldown
```

Devem ser determinísticos e testáveis quando possível.

⸻

14. Persistence

A persistência deve armazenar o estado necessário da carreira.

O estado transitório de UI não deve ser confundido com o estado permanente.

⸻

15. Versionamento

Todo save deve possuir:

```js
career.schemaVersion
```

Evoluções estruturais devem utilizar migrações.

Modelo:

```
Save v1
 ↓
Migration v1 → v2
 ↓
Save v2
```

Nunca quebrar uma carreira existente por causa de uma nova funcionalidade.

⸻

16. Separação de dados

O sistema deve separar conceitualmente:

```
REAL WORLD DATA
        vs
CAREER WORLD
```

Dados externos podem alimentar o produto, mas não devem ser tratados como dependência absoluta da carreira.

A carreira deve sobreviver mesmo quando uma API externa estiver indisponível.

⸻

17. Determinismo

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

Benefícios:

* testes;
* debug;
* reprodução de bugs;
* balanceamento.

⸻

18. Princípio de arquitetura

Antes de adicionar qualquer propriedade ou sistema:

1. verificar se já existe;
2. verificar se pode ser derivado;
3. verificar impacto nos saves;
4. definir valor padrão;
5. definir migração.

⸻

19. Evolução arquitetural

A arquitetura deve evoluir incrementalmente.

Evitar:

```
monólito
↓
reescrita completa
```

Preferir:

```
monólito
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

⸻

Status final: CONCLUÍDA
