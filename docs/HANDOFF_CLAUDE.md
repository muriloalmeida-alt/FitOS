# HANDOFF — PM (ChatGPT) ↔ Desenvolvimento (Claude)

Documento oficial e **bidirecional** de comunicação entre o PM
(ChatGPT — produto, requisitos, arquitetura funcional, priorização,
critérios de aceite, governança) e o Desenvolvimento (Claude —
arquitetura de solução, implementação, testes, regressões).

Fixado em 09/09/2026, conforme o fluxo oficial de governança do projeto
BRDATA/FitOS. Ver `docs/README.md` para o restante das regras de
governança (escopo de escrita, fonte de verdade, etc.).

**Escopo de escrita**: o PM só escreve dentro de `docs/` — nunca em
código de produção, testes, configuração ou `CLAUDE.md`. Claude
implementa no código e registra o retorno de cada tarefa aqui, na
mesma seção que o PM abriu.

---

## Como este documento funciona

1. O PM abre uma tarefa nova preenchendo o bloco **"PM → CLAUDE"** de
   uma seção `## TASK-<ID>` (ver template abaixo), com
   `Status: READY FOR IMPLEMENTATION`.
2. Claude só inicia implementação quando o status for exatamente
   `READY FOR IMPLEMENTATION`. Se estiver `DRAFT`, `BLOCKED` ou
   `ADJUSTMENTS REQUIRED`, aguarda orientação do PM.
3. Claude lê o handoff inteiro + todos os documentos listados em
   "Leitura obrigatória" antes de tocar em código — nunca presume
   conhecer o estado do projeto só pela memória de conversas
   anteriores (`docs/` no GitHub é a fonte de verdade, ver
   `docs/README.md` regra 0).
4. Ao terminar, Claude preenche o bloco **"CLAUDE → PM"** da MESMA
   seção (não cria uma seção nova) e muda o status pra
   `PM REVIEW REQUIRED`.
5. O PM revisa. Se aprovar, status vira `APPROVED` e a tarefa está
   encerrada. Se pedir ajuste, status vira `ADJUSTMENTS REQUIRED` e
   Claude repete o ciclo (implementa → testa → atualiza → `PM REVIEW
   REQUIRED`) até aprovação.
6. Ao encerrar (`APPROVED`), a seção inteira é movida pra
   "Histórico de tarefas" no fim deste arquivo, mais recente primeiro
   — mesma lógica de arquivo append-only já usada em
   `docs/project/CHANGELOG.md`, pra nunca perder o rastro de uma
   tarefa concluída.

### Status possíveis
`DRAFT` · `READY FOR IMPLEMENTATION` · `IN IMPLEMENTATION` ·
`PM REVIEW REQUIRED` · `APPROVED` · `ADJUSTMENTS REQUIRED` · `BLOCKED`

### Fluxo resumido
```
PM
 ↓
Atualiza docs/HANDOFF_CLAUDE.md
 ↓
READY FOR IMPLEMENTATION
 ↓
CLAUDE LÊ HANDOFF + DOCUMENTOS OBRIGATÓRIOS
 ↓
INSPECIONA CÓDIGO (INSPECT → IDENTIFY → MAP DEPENDENCIES → PRESERVE →
                    MINIMAL CHANGE → TEST → VALIDATE SAVE/LOAD → DOCUMENT)
 ↓
IMPLEMENTA → TESTA → ATUALIZA HANDOFF
 ↓
PM REVIEW REQUIRED
 ↓
PM ANALISA ──► APPROVED (fim, arquiva no histórico)
     │
     └──► ADJUSTMENTS REQUIRED ──► Claude ajusta ──► PM REVIEW REQUIRED (repete)
```

### Regra de preservação (antes de alterar qualquer código)
`INSPECT → IDENTIFY EXISTING IMPLEMENTATION → MAP DEPENDENCIES →
PRESERVE CURRENT BEHAVIOR → IMPLEMENT MINIMAL CHANGE → TEST → VALIDATE
SAVE/LOAD → DOCUMENT`. Não reconstruir sistema existente só porque há
forma mais simples de implementá-lo — descobrir primeiro se já existe.

### Regra de divergência
Se a implementação precisar fugir da especificação do PM, Claude
**nunca esconde** — registra o quê mudou, por quê, o impacto, e a
decisão tomada, na seção "Divergências" do retorno. Se a divergência
afeta produto/escopo (não só detalhe técnico), Claude aguarda decisão
do PM antes de seguir — não implementa a mudança de especificação por
conta própria.

### Definition of Done
Pronto pra revisão (`PM REVIEW REQUIRED`) exige: implementação
concluída, testes executados, regressões verificadas, arquivos
alterados registrados, divergências registradas, pendências
registradas, impacto documental identificado, handoff atualizado.
Só está **realmente concluída** quando `PM REVIEW REQUIRED → APPROVED`.

---

## Template de uma tarefa (copiar para abrir uma nova `## TASK-<ID>`)

```markdown
## TASK-<ID> — <título curto>

**Status:** DRAFT
**Fase/Sprint:** <ex.: Sprint 8>
**Aberta em:** <data>

### PM → CLAUDE

**Objetivo:**
<o que deve ser entregue e por quê>

**Documentos novos:**
- <caminho, se o PM criou algum doc novo em docs/ pra esta tarefa>

**Documentos alterados:**
- <caminho, se o PM alterou algum doc existente>

**Leitura obrigatória:**
- <lista de docs que Claude PRECISA ler antes de implementar>

**Documentos de referência:**
- <docs úteis mas não obrigatórios>

**Escopo:**
- <o que entra>

**Fora de escopo:**
- <o que NÃO entra nesta tarefa>

**Dependências:**
- <outras tarefas/sistemas que isso depende>

**Critérios de aceite:**
- <lista verificável>

**Riscos:**
- <riscos conhecidos pelo PM>

**Restrições:**
- <restrições de produto/técnicas já conhecidas>

**Observações importantes:**
- <qualquer contexto adicional>

### CLAUDE → PM

**Implementação:**
- O que foi implementado: <resumo>
- Arquivos alterados: <lista>
- Arquivos criados: <lista ou "nenhum">
- Arquivos removidos: <lista ou "nenhum">
- Documentação alterada: <lista ou "nenhuma">

**Testes:**
- Testes executados: <lista>
- Comandos utilizados: <comandos reais>
- Resultado de cada teste: <pass/fail por teste>
- Testes que falharam: <lista ou "nenhum">
- Motivo das falhas: <se houver>
- Regressões identificadas: <lista ou "nenhuma">

**Conformidade:**
- Requisitos atendidos: <lista>
- Requisitos parcialmente atendidos: <lista ou "nenhum">
- Requisitos não atendidos: <lista ou "nenhum">

**Divergências:**
- <o que mudou / por que / impacto / decisão tomada — ou "nenhuma">

**Pendências:**
- Bugs conhecidos: <lista ou "nenhum">
- Limitações: <lista ou "nenhuma">
- Pontos que dependem do PM: <lista ou "nenhum">
- Itens deliberadamente não implementados: <lista ou "nenhum">

**Git:**
- Branch: <nome>
- Commit(s): <hash(es)>
- PR: <link, se houver>
- Resultado de CI: <se aplicável>
```

---

## Tarefa ativa

_Nenhuma tarefa aberta no momento — aguardando o primeiro handoff do
PM. Quando o PM abrir uma `## TASK-<ID>` acima desta linha (ou nesta
seção), ela vira a tarefa ativa até ser arquivada no histórico abaixo._

---

## Histórico de tarefas (mais recente primeiro)

_Vazio — nenhuma tarefa concluída sob este fluxo ainda._
