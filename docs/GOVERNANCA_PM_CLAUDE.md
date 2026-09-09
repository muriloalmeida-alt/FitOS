# Governança PM ↔ Claude — BRDATA/FitOS

> **Nota de adaptação (09/2026):** este documento foi definido originalmente
> prevendo um GPT dedicado ao papel de PM e o Claude como implementador. Por
> instabilidade de conexão com o GPT, o papel de PM (seção 2) passou a ser
> **absorvido pelo Claude** via skill `pm` (`.claude/skills/pm/SKILL.md`),
> com uma única exceção: a **aprovação formal antes do commit** (seção 13)
> continua sendo feita por uma pessoa — o Murilo — porque quem implementa
> não pode ser também quem aprova formalmente a própria implementação sem
> checagem externa. Todo o resto do fluxo abaixo vale como escrito.

## 1. Objetivo

Este documento define a governança oficial entre o PM e o Claude no projeto
BRDATA/FitOS.

O objetivo é separar claramente:

* decisões de produto;
* especificação e arquitetura;
* implementação;
* testes;
* validação;
* documentação;
* autorização de commit.

---

## 2. Responsabilidade do PM

O PM é responsável por:

* definir requisitos e objetivos;
* manter roadmap e prioridades;
* definir escopo e fora de escopo;
* estabelecer critérios de aceite;
* preservar coerência de produto e arquitetura;
* avaliar impactos e dependências;
* revisar a implementação realizada pelo Claude;
* validar testes e resultados;
* aprovar, solicitar ajustes ou bloquear uma demanda;
* manter a documentação oficial em `docs/`.

O PM não desenvolve código de produção.

---

## 3. Responsabilidade do Claude

Claude é responsável por:

* inspecionar o código existente antes de alterar;
* compreender a arquitetura atual;
* implementar as demandas aprovadas;
* preservar funcionalidades existentes;
* executar testes e validações técnicas;
* identificar divergências e riscos;
* reportar arquivos alterados/criados/removidos;
* retornar o resultado ao PM para revisão.

Claude não altera requisitos ou decisões de produto por conta própria.

Quando identificar uma necessidade fora do escopo, deve reportá-la ao PM.

---

## 4. Limites de atuação

### PM

Pode atuar em:

* `docs/`
* requisitos;
* especificações;
* roadmap;
* decisões;
* critérios de aceite;
* validação funcional e arquitetural.

Não deve alterar:

* `src/`
* `server/`
* `public/`
* testes;
* configurações de produção;
* `package.json`;
* `CLAUDE.md`;
* ou qualquer outro arquivo fora de `docs/`.

### Claude

Pode atuar no código e nos artefatos necessários para implementação.

Deve respeitar:

* requisitos aprovados;
* arquitetura existente;
* Material Design 3;
* documentação oficial;
* critérios de aceite;
* escopo definido pelo PM.

---

## 5. Fluxo oficial

O fluxo obrigatório é:

```
PM
 ↓
Especificação
 ↓
Claude
 ↓
Implementação
 ↓
Testes
 ↓
Relatório técnico
 ↓
PM
 ↓
Validação
 ↓
APROVADO / AJUSTES NECESSÁRIOS / BLOQUEADO
```

Nenhuma demanda é considerada concluída apenas porque foi implementada.

---

## 6. Estados das demandas

* **PRONTO PARA IMPLEMENTAÇÃO** — a especificação está suficientemente
  definida para o Claude iniciar.
* **EM IMPLEMENTAÇÃO** — Claude está executando a demanda.
* **REVISÃO DO PM NECESSÁRIA** — Claude concluiu a implementação técnica e
  aguarda validação do PM.
* **AJUSTES NECESSÁRIOS** — o PM identificou divergências, problemas ou
  requisitos não atendidos.
* **BLOQUEADO** — a demanda não pode prosseguir até que uma dependência ou
  decisão seja resolvida.
* **APROVADO** — o PM validou a implementação e os critérios de aceite
  foram atendidos.

---

## 7. Início de uma demanda

Uma demanda só deve ser iniciada pelo Claude quando houver especificação
suficiente contendo, quando aplicável:

* ID;
* nome;
* objetivo;
* contexto;
* problema;
* escopo;
* fora de escopo;
* dependências;
* requisitos;
* critérios de aceite;
* validações;
* riscos;
* documentação relacionada.

Se houver ambiguidade relevante, Claude deve solicitar esclarecimento ao PM
antes de implementar.

---

## 8. Sequência obrigatória de trabalho

Claude deve seguir:

```
INSPECIONAR
↓
IDENTIFICAR IMPLEMENTAÇÃO EXISTENTE
↓
MAPEAR DEPENDÊNCIAS
↓
PRESERVAR COMPORTAMENTO ATUAL
↓
IMPLEMENTAR MUDANÇA MÍNIMA NECESSÁRIA
↓
TESTAR
↓
VALIDAR PERSISTÊNCIA / SAVE / LOAD QUANDO APLICÁVEL
↓
DOCUMENTAR
↓
RETORNAR PARA REVISÃO DO PM
```

Não é permitido reconstruir sistemas existentes sem autorização explícita.

---

## 9. Preservação de funcionalidades

Toda implementação deve ser incremental.

Claude deve:

* preservar funcionalidades existentes;
* evitar regressões;
* reutilizar componentes e serviços existentes;
* evitar duplicação de sistemas;
* evitar refatorações oportunistas;
* não substituir uma implementação existente por uma versão simplificada
  sem autorização.

Caso uma alteração estrutural seja necessária, ela deve ser reportada ao
PM.

---

## 10. Documentação

A documentação oficial do projeto está em `docs/`.

A documentação deve acompanhar a evolução do produto.

Devem ser atualizados, quando aplicável:

* roadmap;
* contexto do projeto;
* requisitos;
* especificações técnicas;
* decisões;
* changelog;
* handoff.

O `HANDOFF_CLAUDE.md` representa o estado operacional atual das demandas.

O `CHANGELOG.md` representa o histórico detalhado de implementação.

Eles não devem ser tratados como documentos duplicados.

---

## 11. Material Design 3

O Material Design 3 (M3) é a autoridade visual e comportamental do
projeto.

O BRDATA deve:

* utilizar M3 como referência oficial;
* configurar M3 para a identidade BRDATA;
* não criar um sistema visual paralelo;
* não copiar a documentação oficial do M3 para dentro do projeto;
* manter a capacidade de incorporar futuras atualizações oficiais do M3.

Classificações utilizadas:

* **M3 Official** — componente ou comportamento definido oficialmente
  pelo M3.
* **M3 Foundation** — fundamentos oficiais do M3, como: color,
  typography, shape, elevation, layout, motion, iconography.
* **M3 Configured** — componente M3 configurado com identidade visual
  BRDATA.
* **BRDATA Extension** — extensão necessária para necessidades
  específicas do domínio BRDATA.
* **BRDATA Product Pattern** — composição específica do produto
  utilizando componentes M3.

Quando o M3 possuir uma orientação aplicável, ela deve prevalecer.

---

## 12. Divergências

Se Claude identificar conflito entre:

* código existente;
* documentação;
* requisito;
* arquitetura;
* M3;
* ou nova demanda;

não deve resolver unilateralmente uma mudança de produto.

Deve:

1. identificar a divergência;
2. explicar o impacto;
3. registrar a decisão necessária;
4. aguardar orientação do PM quando houver impacto relevante.

---

## 13. Autorização formal para commit

A implementação técnica não autoriza automaticamente o commit final da
demanda.

O fluxo obrigatório é:

```
Claude implementa
↓
Claude testa
↓
Claude retorna: REVISÃO DO PM NECESSÁRIA
↓
PM valida
↓
├─ APROVADO
│     ↓
│  PM atualiza HANDOFF_CLAUDE
│     ↓
│  Claude autorizado a commit
│
├─ AJUSTES NECESSÁRIOS
│     ↓
│  PM atualiza HANDOFF
│     ↓
│  Commit final não autorizado
│
└─ BLOQUEADO
      ↓
   PM atualiza HANDOFF
      ↓
   Commit final não autorizado
```

**Regra geral:** aprovação formal do PM + Handoff atualizado = autorização
para commit. Essa regra vale para qualquer etapa do projeto.

> Na configuração atual (sem GPT), quem exerce a validação/aprovação
> formal desta seção é o Murilo diretamente na conversa — ver nota de
> adaptação no topo do documento.

---

## 14. Critérios de aprovação

Uma demanda somente pode ser considerada **APROVADA** quando:

* o escopo foi atendido;
* os critérios de aceite foram atendidos;
* não existem regressões críticas;
* os testes necessários foram executados;
* a arquitetura permanece coerente;
* funcionalidades existentes foram preservadas;
* divergências relevantes foram resolvidas;
* a documentação necessária foi atualizada.

---

## 15. Definition of Done

Uma demanda está concluída quando:

1. implementação realizada;
2. testes executados;
3. resultado técnico reportado;
4. PM realizou revisão;
5. eventuais ajustes foram resolvidos;
6. documentação atualizada;
7. PM aprovou formalmente;
8. `HANDOFF_CLAUDE.md` foi atualizado;
9. commit final foi autorizado pelo PM.

---

## 16. Idioma oficial

A documentação do projeto deve ser mantida em PT-BR.

Termos técnicos, nomes de APIs, componentes, classes, métodos e
identificadores de código podem permanecer em inglês quando fizer sentido
técnico.
