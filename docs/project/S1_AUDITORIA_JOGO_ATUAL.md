BRDATA — S1

Auditoria do Jogo Atual

Sprint: S1
Status: Concluída
Objetivo: compreender o estado real do produto antes da evolução arquitetural e de game design.

⸻

1. Objetivo da Sprint

Realizar uma auditoria completa do jogo existente para identificar:

* funcionalidades já implementadas;
* arquitetura existente;
* estado da carreira;
* sistemas de gameplay;
* persistência;
* interfaces;
* limitações técnicas;
* problemas de UX;
* oportunidades de evolução;
* riscos de regressão.

A auditoria tem como princípio fundamental:

Não reconstruir o que já funciona.

⸻

2. Estado encontrado

O BRDATA já possuía um Modo Carreira funcional e significativamente desenvolvido.

Entre os sistemas identificados:

* escolha de clube;
* campeonatos;
* calendário;
* elenco;
* escalação;
* formações;
* banco;
* táticas;
* instruções por setor;
* treinamento;
* evolução de jogadores;
* fadiga;
* lesões;
* cartões;
* suspensões;
* moral;
* conversas com jogadores;
* contratos;
* salários;
* finanças;
* orçamento;
* mercado de transferências;
* compra e venda;
* propostas;
* pagamentos parcelados;
* scouts;
* categorias de base;
* partidas simuladas;
* partidas em modo live;
* substituições;
* alterações táticas durante partidas;
* intervalo;
* tabela;
* notícias;
* notificações;
* objetivos do clube;
* confiança/reputação do treinador;
* histórico de clubes;
* propostas de outros clubes;
* conquistas;
* ranking;
* estádio;
* comissão técnica.

A documentação posterior confirma que esses sistemas já faziam parte da implementação e não deveriam ser tratados como inexistentes.

⸻

3. Arquitetura encontrada

A carreira estava concentrada principalmente em:

```
public/
├── carreira.html
└── js/
    └── carreira.js
server/
└── src/
    └── careerStore.js
```

O `carreira.js` concentrava grande parte da lógica da aplicação.

Responsabilidades identificadas:

* estado da carreira;
* elenco;
* calendário;
* partidas;
* simulação;
* treinamento;
* mercado;
* contratos;
* finanças;
* moral;
* evolução;
* carreira do treinador;
* notícias;
* interface;
* modais;
* ações do jogador.

⸻

4. Diagnóstico arquitetural

O sistema funcionava, mas apresentava concentração significativa de responsabilidades.

O principal risco identificado era a evolução descontrolada de um núcleo monolítico.

A recomendação foi:

* evoluir incrementalmente;
* evitar reescrita completa;
* preservar funcionalidades;
* separar responsabilidades gradualmente;
* manter o estado da carreira como núcleo comum;
* evitar duplicação de sistemas.

⸻

5. Persistência

A carreira utilizava persistência baseada no estado da carreira.

O objeto de carreira deveria ser tratado como fonte central de estado.

Qualquer alteração estrutural deveria considerar:

* compatibilidade;
* saves existentes;
* tamanho do payload;
* serialização;
* histórico;
* arrays;
* objetos aninhados;
* migração.

⸻

6. Problemas e riscos identificados

**Arquitetura**

* concentração de lógica no frontend;
* forte acoplamento entre UI e lógica;
* risco de duplicação de regras;
* dificuldade de evolução sem regressões.

**Persistência**

* risco de quebra de saves;
* necessidade de versionamento;
* crescimento do objeto de carreira.

**Gameplay**

* necessidade de maior integração entre sistemas;
* necessidade de determinismo;
* necessidade de maior explicabilidade;
* necessidade de comportamento mais sistêmico da IA.

**UX**

* necessidade de maior clareza;
* excesso potencial de informação;
* necessidade de evolução mobile;
* necessidade de componentes consistentes.

⸻

7. Princípios derivados da auditoria

A evolução do BRDATA deveria seguir:

```
AUDITAR
↓
ENTENDER
↓
PRESERVAR
↓
ESTRUTURAR
↓
EVOLUIR
```

E não:

```
AUDITAR
↓
DESCARTAR
↓
REESCREVER
```

⸻

8. Resultado da Sprint

A S1 foi considerada concluída.

A auditoria forneceu a base para a definição da arquitetura e do Game Design da S2.

**Conclusão**

O BRDATA não deveria ser tratado como um projeto vazio.

O produto já possuía uma base funcional relevante que deveria ser preservada e evoluída incrementalmente.

⸻

Status final: CONCLUÍDA
