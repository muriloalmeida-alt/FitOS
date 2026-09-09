# README_HANDOFF — Regras de Governança PM ↔ Claude

**Idioma oficial:** Português do Brasil (PT-BR).
**Fixado em:** 09/09/2026.
**Escopo deste documento:** este é o único lugar onde as regras
**permanentes** do processo entre o PM e o Claude vivem. Nenhuma delas
deve ser duplicada em `docs/HANDOFF_CLAUDE.md` — aquele documento é só
operacional (demandas vigentes + índice histórico de uma linha por
demanda). Ver seção 15 para o princípio geral da separação.

---

## 1. Responsabilidades do PM (ChatGPT)

O PM é responsável por:
- produto;
- requisitos;
- arquitetura funcional;
- priorização;
- definição de escopo;
- critérios de aceite;
- decisões de produto;
- governança;
- documentação em `docs/`;
- validação final das implementações.

## 2. Responsabilidades do Claude

O Claude é responsável por:
- analisar o código existente antes de alterar qualquer coisa;
- implementar as especificações registradas em
  `docs/HANDOFF_CLAUDE.md`;
- preservar funcionalidades existentes;
- executar testes e identificar regressões;
- reportar divergências entre especificação e realidade técnica;
- atualizar o handoff (`docs/HANDOFF_CLAUDE.md`) com o retorno de cada
  demanda;
- entregar a implementação para validação do PM.

## 3. Limites de atuação de cada um (regra de escopo)

- O **PM possui escopo de escrita SOMENTE dentro de `docs/`**. Não deve
  alterar código de produção, testes, configuração, `CLAUDE.md` ou
  qualquer outro arquivo fora de `docs/`.
- O **Claude é quem implementa no código** — e também é quem escreve
  nos documentos técnicos (`docs/project/`, `docs/ops/`) e no retorno
  operacional do handoff.
- `docs/reqs/` é preenchido pelo PM (requisitos/regras de negócio);
  `docs/project/CHANGELOG.md` e `docs/project/ESTRUTURA_DE_PASTAS.md`
  são mantidos pelo Claude, como parte da entrega de cada demanda.

## 4. Fonte da verdade

A pasta `docs/` tal como está no GitHub (branch remota, não o estado
local de uma sessão) é **a fonte da verdade** do projeto. Isso vale nas
duas direções:
- **Ao consultar**: antes de tratar qualquer conteúdo de `docs/` como
  atual, o Claude dá `git fetch`/`pull` primeiro — nunca confia em
  memória de conversa ou num checkout local desatualizado. Isso importa
  especialmente porque o PM pode empurrar mudanças em `docs/reqs/`
  direto pro GitHub, fora de qualquer sessão do Claude.
- **Ao decidir**: uma decisão de governança, requisito ou arquitetura
  só é real quando está commitada em `docs/` no GitHub — o que foi dito
  numa conversa mas não chegou a um arquivo aqui não vale como fonte de
  verdade pra ninguém além daquela conversa específica.
- `docs/project/ROADMAP.md` (quando existir) é a fonte de verdade da
  sequência e do status das Sprints. `docs/reqs/` é a fonte de verdade
  das regras de negócio.

## 5. Fluxo de trabalho PM → Claude → PM

```
PM
 ↓
Atualiza docs/HANDOFF_CLAUDE.md (abre ou edita uma demanda em "Demandas vigentes")
 ↓
Status: PRONTO PARA IMPLEMENTAÇÃO
 ↓
CLAUDE LÊ O HANDOFF INTEIRO + TODA A DOCUMENTAÇÃO OBRIGATÓRIA LISTADA NA DEMANDA
 ↓
INSPECIONA O CÓDIGO (ver seção 7 — sequência de trabalho obrigatória)
 ↓
IMPLEMENTA → TESTA → ATUALIZA O HANDOFF (retorno completo na própria demanda)
 ↓
Status: REVISÃO DO PM NECESSÁRIA
 ↓
PM ANALISA
     │
     ├─► APROVADO → demanda sai de "vigentes", vira 1 linha no histórico do handoff
     │
     └─► AJUSTES NECESSÁRIOS → Claude ajusta → volta pra REVISÃO DO PM NECESSÁRIA (repete até aprovar)
```

## 6. Estados possíveis de uma demanda

| Status | Significado |
|---|---|
| **RASCUNHO** | O PM ainda está escrevendo/ajustando a demanda. Claude não inicia nada. |
| **PRONTO PARA IMPLEMENTAÇÃO** | A demanda está completa e aprovada pelo PM para o Claude começar. **Único status que autoriza início de implementação.** |
| **EM IMPLEMENTAÇÃO** | Claude está trabalhando nela. |
| **REVISÃO DO PM NECESSÁRIA** | Implementação terminada, mas a demanda **ainda não está concluída** — aguardando o PM revisar. |
| **APROVADO** | O PM validou a entrega. Só agora a demanda está de fato concluída — sai de "vigentes" e vira uma linha no histórico. |
| **AJUSTES NECESSÁRIOS** | O PM pediu mudanças. Claude relê a demanda, identifica exatamente o que foi pedido, implementa, testa de novo, atualiza o handoff e retorna para REVISÃO DO PM NECESSÁRIA. |
| **BLOQUEADO** | A demanda não pode avançar (dependência externa, decisão pendente, etc.). |

## 7. Regras para início e conclusão de uma demanda

- Claude **só inicia** uma implementação nova quando o status da
  demanda estiver exatamente `PRONTO PARA IMPLEMENTAÇÃO`. Se estiver
  `RASCUNHO`, `BLOQUEADO` ou `AJUSTES NECESSÁRIOS`, Claude não inicia
  nem prossegue sem orientação do PM.
- Uma demanda **só está concluída** quando `REVISÃO DO PM NECESSÁRIA →
  APROVADO`. Terminar a implementação e os testes não encerra a
  demanda — é um passo intermediário, não o fim.
- Ao terminar de implementar e testar, Claude sempre muda o status para
  `REVISÃO DO PM NECESSÁRIA` — nunca direto para `APROVADO` (essa
  transição é exclusiva do PM).

## 8. Sequência de trabalho obrigatória (antes de alterar qualquer código)

```
INSPECIONAR
 → IDENTIFICAR IMPLEMENTAÇÃO EXISTENTE
 → MAPEAR DEPENDÊNCIAS
 → PRESERVAR COMPORTAMENTO ATUAL
 → IMPLEMENTAR MUDANÇA MÍNIMA
 → TESTAR
 → VALIDAR SAVE/LOAD
 → DOCUMENTAR
```

Esta sequência é específica do fluxo PM↔Claude e complementa (não
substitui) o processo geral do `CLAUDE.md` §37
(INSPECIONAR→LOCALIZAR→ENTENDER→PLANEJAR→ALTERAR→TESTAR→REVISAR) e a
regra de ouro do `CLAUDE.md` §5
(SEARCH→UNDERSTAND→REUSE→EXTEND→ONLY THEN CREATE). Não reconstruir um
sistema existente simplesmente porque há uma forma mais simples de
implementá-lo — descobrir primeiro se ele já existe.

## 9. Preservação das funcionalidades existentes

O BRDATA já possui dezenas de sistemas funcionais (ver `CLAUDE.md` §3).
Antes de criar algo novo, Claude descobre se já existe — e, se existir,
evolui em vez de reconstruir. Qualquer nova propriedade em `CAREER`
considera saves antigos (default, migração/backfill) antes de ser
introduzida (`CLAUDE.md` §8-9, §33).

## 10. Regras de documentação

- Toda implementação verifica se há impacto documental. Se houver
  mudança em arquitetura, comportamento, regras de negócio,
  persistência, contratos, mercado, economia, UI/UX, APIs, testes,
  roadmap ou decisões técnicas, a documentação correspondente deve ser
  atualizada como parte da MESMA entrega — nunca deixar o código
  deliberadamente mais atualizado que a documentação.
- Se uma atualização documental estiver fora do escopo técnico do
  Claude (ex.: é uma decisão de produto que cabe ao PM), isso é
  registrado no retorno da demanda em `docs/HANDOFF_CLAUDE.md`, não
  decidido silenciosamente.
- `docs/project/CHANGELOG.md` é atualizado pelo Claude a cada dia de
  trabalho com commits reais (ver sua própria metodologia interna).
  `docs/HANDOFF_CLAUDE.md` NÃO duplica esse detalhamento — só referencia
  o commit final de cada demanda (ver seção 13).

## 11. Regras relacionadas ao Material Design 3 (M3)

- O Modo Técnico adotou o Material Design 3 como base do design system
  do produto — fundação + Blocos 1-9 concluídos em 04/09/2026 (ver
  `docs/project/CHANGELOG.md`, v6.0.0). `CLAUDE.md` §6 (Design System)
  continua sendo a referência normativa de M3 + BRDATA DS + Football
  Game UI.
- Toda tela ou componente novo **reaproveita os tokens e componentes M3
  já existentes** (`--m3-*`, `--mt-*`, cartões chanfrados, botões
  `.mt-btn-*`, badges de OVR, modais/bottom sheets, nav inferior) em vez
  de criar um padrão visual paralelo — a mesma regra de "buscar antes
  de criar" do `CLAUDE.md` §5, aplicada especificamente à camada visual.
- Cor dinâmica por clube (`deriveClubPalette`/`applyClubPalette`) e a
  verificação de contraste WCAG (`contrastRatio`) já estão
  implementadas — não recriar.
- Qualquer necessidade de fugir do padrão M3 numa tela específica (por
  motivo de produto, não técnico) é uma decisão do PM, registrada
  explicitamente na demanda — não uma escolha silenciosa do Claude.

## 12. Tratamento de divergências

Se a implementação precisar fugir da especificação do PM (por
inviabilidade técnica, risco de exploit, quebra de compatibilidade de
save, ou qualquer outro motivo), Claude:
1. **nunca esconde** — registra o que mudou, por quê, o impacto e a
   decisão tomada, no retorno da demanda;
2. se a divergência é só um detalhe técnico de implementação (não muda
   o resultado percebido nem o escopo), Claude decide e documenta;
3. se a divergência afeta produto ou escopo, Claude registra a
   divergência com uma alternativa técnica viável e aguarda decisão do
   PM antes de prosseguir — nunca ajusta a especificação por conta
   própria nesse caso.

## 13. Critérios de aprovação

O PM aprova uma demanda (`APROVADO`) quando, a partir do retorno
registrado em `docs/HANDOFF_CLAUDE.md`:
- todos os critérios de aceite da demanda foram atendidos (ou as
  exceções foram justificadas e aceitas);
- os testes relevantes passaram, e qualquer falha/regressão foi
  explicada;
- as divergências registradas são aceitáveis;
- a documentação impactada foi de fato atualizada.

Ao aprovar, o PM (ou o Claude, a pedido do PM) reduz o registro da
demanda para uma linha no histórico do handoff (seção 14) e garante que
o commit final da demanda está referenciado no
`docs/project/CHANGELOG.md`.

## 14. Definição de concluído (Definition of Done)

Uma demanda está **pronta para revisão** (`REVISÃO DO PM NECESSÁRIA`)
quando: implementação concluída; testes executados; regressões
verificadas; arquivos alterados/criados/removidos registrados;
divergências registradas; pendências registradas; impacto documental
identificado e tratado; `docs/HANDOFF_CLAUDE.md` atualizado.

Uma demanda está **realmente concluída** somente quando:
`REVISÃO DO PM NECESSÁRIA → APROVADO`.

## 15. Princípio geral da separação de documentos

```
README_HANDOFF.md
        ↓
REGRAS PERMANENTES
"Como PM e Claude trabalham"        ← este documento

HANDOFF_CLAUDE.md
        ↓
OPERAÇÃO
"O que está sendo trabalhado agora" ← demandas vigentes + índice histórico

CHANGELOG.md
        ↓
HISTÓRICO
"O que foi realizado"               ← detalhamento real, por commit/dia
```

- **`README_HANDOFF.md`** = regras (este arquivo).
- **`HANDOFF_CLAUDE.md`** = demandas vigentes + índice histórico (uma
  linha por demanda concluída: Demanda | Data | Commit | Changelog).
- **`CHANGELOG.md`** = histórico detalhado de todas as mudanças, por
  dia de trabalho.

Essas responsabilidades não se sobrepõem. Uma regra nova de processo
entra aqui. Uma demanda nova ou em andamento entra no
`HANDOFF_CLAUDE.md`. O detalhamento de uma implementação concluída vive
no Git e no `CHANGELOG.md` — nunca reescrito ou duplicado no handoff.

## 16. Regra de idioma

Todo o conteúdo dos documentos de Handoff (`README_HANDOFF.md` e
`HANDOFF_CLAUDE.md`) está em **Português do Brasil (PT-BR)** — títulos,
instruções, status, descrições, regras, histórico e mensagens
operacionais inclusos. Termos técnicos que precisam permanecer na forma
original (nomes de arquivo, branches, commits, APIs, bibliotecas,
identificadores de código) continuam no idioma original.
