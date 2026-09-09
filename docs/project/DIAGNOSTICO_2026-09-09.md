# BRDATA — Diagnóstico do Projeto (a partir de `docs/`)
**Data:** 09/09/2026
**Autor:** Claude, de chapéu PM (papel absorvido enquanto o GPT está
indisponível — ver `docs/README.md` regra 1 e `.claude/skills/pm/SKILL.md`)
**Escopo:** análise da pasta `docs/` em `origin/main` (fiz `git fetch`
antes de ler, conforme regra 0 de governança). Não inspeciona o código do
jogo diretamente — onde a documentação pode estar desatualizada em
relação à implementação real, isso é sinalizado explicitamente em vez de
presumido.
**Natureza:** diagnóstico, não uma demanda de implementação. Não
substitui `docs/project/ROADMAP.md` nem `docs/HANDOFF_CLAUDE.md` como
fonte de verdade — organiza o que já está registrado neles e nos demais
documentos, aponta lacunas e recomenda ordem de ataque.

⸻

## 1. Resumo executivo

O projeto tem **governança documental recém-formalizada** (toda a
estrutura atual de `docs/` nasceu hoje, 09/09) mas **conteúdo de
requisitos vivos ainda vazio** — o que existe de especificação real está
todo em registro histórico de Sprint (`docs/sprints/`), não em regra
vigente (`docs/requirements/`). Tecnicamente, o roadmap oficial (S1–S16)
está em **S8 "em andamento"**, com **S3 concluída como primeira versão**
e **S4 bloqueada** atrás de uma auditoria de prontidão (S3.2.7) que já
está especificada e com status `PRONTO PARA IMPLEMENTAÇÃO`, mas **nunca
foi executada**. A auditoria de código vs. spec mais recente
(`BRDATA_Auditoria_v1.0.md`, 08/09) achou 1 item **P0** e vários **P1** —
parte do P0 parece ter avançado no dia seguinte (Transfer AI), mas isso
não foi confirmado nem fechado formalmente contra o achado original.

⸻

## 2. Estado do roadmap oficial

| Sprint | Entrega | Status |
|---|---|---|
| S1 | Auditoria do jogo atual | 🟢 Concluída |
| S2 | Arquitetura + GDD | 🟢 Concluída |
| S3 | BRDATA DS 2.0 | 🟢 Concluída *(como 1ª versão — não congelada)* |
| **S4** | **Redesign Mobile** | 🔴 **Pendente — bloqueada pela S3.2.7 Readiness Review** |
| S5–S7 | Carreira / Match Engine 2.0 / Jogadores | 🔴 Pendentes |
| **S8** | **Mercado + contratos** | 🟡 **Em andamento** (fora de ordem, decisão consciente) |
| S9–S16 | Economia → Lançamento | ⏳ Não iniciadas |

`ROADMAP.md` e `PROJECT_CONTEXT.md` concordam ponto a ponto (bom sinal),
mas são **duas tabelas redundantes do mesmo roadmap** em arquivos
diferentes — risco de manutenção: se uma for atualizada e a outra não,
passam a divergir sem nenhum mecanismo automático de detecção.

**Achado de processo:** S8 avançou antes de S4 por decisão deliberada
("estava perto de fechar"). Isso é documentado e justificado, mas gera
uma dívida de coordenação: quando S4 começar, a S3 precisa ser
**revisitada** com aprendizado mobile real (ícones, acessibilidade,
densidade) — ou seja, S4 não é só "aplicar o DS", é também "corrigir o DS
depois de usar". Ainda não há critério documentado de quando essa revisão
da S3 é considerada satisfeita.

⸻

## 3. O bloqueio real para o próximo marco de produto (S4)

Existe uma demanda **já especificada e pronta**, parada:

- **`S3-DS20-S4-READINESS-001`** (`docs/HANDOFF_CLAUDE.md` /
  `docs/sprints/S3/S3_2_7_READINESS.md`, 881 linhas de escopo) — auditar
  se o BRDATA DS 2.0 tem maturidade real (fundação, componentes,
  contratos, responsividade, acessibilidade, cobertura das 19 telas de
  `S3_S4_MATRIZ_TELAS_MOBILE.md`, regressão) para liberar S4.
- Status: `PRONTO PARA IMPLEMENTAÇÃO`. Histórico: **"nenhuma demanda
  concluída sob este fluxo ainda"** — o fluxo formal PM↔Claude nasceu
  hoje e essa é a primeira demanda dele, ainda não rodada.
- **Isto é, hoje, o item de maior prioridade de produto**: é o que
  desbloqueia S4, e S4 é o próximo marco oficial do roadmap depois de S8
  fechar.

⸻

## 4. Achados técnicos herdados (`BRDATA_Auditoria_v1.0.md`, 08/09)

Auditoria código-vs-spec sólida e ainda a mais recente. Destaques por
prioridade:

| Prioridade | Achado | Situação conhecida hoje |
|---|---|---|
| **P0** | IA de transferências (`simulateAiTransfers`/`findInterestedBuyer`) 100% aleatória, sem lógica de necessidade/orçamento/contexto | **Possivelmente em correção** — CHANGELOG 08–09/09 registra "Transfer AI" Fases 1.1–1.5 (seleção, ofertas, valuation, balance check, negociação, market dynamics), e `PROJECT_CONTEXT.md` confirma 1.1–1.4 concluídas e 1.5 "em implementação/validação". **Mas nenhum documento fecha explicitamente o achado P0 da auditoria contra esse trabalho** — não dá pra afirmar que está resolvido sem reabrir a auditoria e comparar. |
| P1 | Match engine não determinístico (`Math.random` cru, sem seed) | Sem evidência documental de correção. |
| P1 | Ausência de `schemaVersion`/migração formal de save | Sem evidência documental de correção. |
| P1 | Ausência de Event Engine formal (lógica de evento inline/duplicada) | Sem evidência documental de correção. |
| P1 | `careers.json` como blob único (custo O(n) por escrita) | Sem evidência documental de correção. |
| P1 | Estado global espalhado em `carreira.js` | Estrutural, não muda sem refactor deliberado. |

**Risco de diagnóstico**: esta auditoria tem **um dia de defasagem
estrutural** — o próprio arquivo dela mudou de lugar duas vezes (raiz →
`docs/reqs/` → `docs/sprints/S2/`) e o trabalho de Transfer AI do dia
seguinte pode ter mexido no achado mais crítico dela sem que isso tenha
voltado pro documento. Ela precisa de uma rodada de confirmação, não de
um novo full-audit do zero.

⸻

## 5. Estado da documentação em si (a pasta `docs/` como produto)

**Pontos fortes:**
- Governança nova (`README.md`, `README_HANDOFF.md`, `HANDOFF_CLAUDE.md`)
  é bem estruturada: papéis, fluxo, estados de demanda, critérios de
  aprovação, tudo explícito e com uma exceção de segurança clara
  (aprovação final sempre do Murilo, nunca de quem implementou).
- Separação `sprints/` (histórico, imutável) vs. `requirements/` (regra
  vigente) é uma decisão de arquitetura documental sólida — evita
  reescrever o passado.
- `CHANGELOG.md` é derivado de `git log` real (hash por linha), não de
  memória — alta rastreabilidade.

**Lacunas e inconsistências encontradas:**

1. **`docs/requirements/` está 100% vazio** (`functional/`, `technical/`,
   `game-design/`, `ui-ux/` — todos só README placeholder). Isso
   significa que, hoje, **não existe nenhuma "regra de negócio vigente"
   centralizada** — tudo que é regra de produto está espalhado em
   `docs/sprints/S2/` e `S3/` (histórico) e no código. Funciona hoje
   porque o projeto é pequeno, mas é o maior risco de escala documental:
   sem migração deliberada de conteúdo de `sprints/` pra cá, o "vigente
   vs. histórico" depende de alguém lembrar onde cada regra mora.
2. **`docs/library/` vazia** — sem impacto imediato, só um registro de
   que nenhum material de referência (pesquisa, benchmark, mockup) foi
   versionado ainda.
3. **`ESTRUTURA_DE_PASTAS.md` está desatualizado em relação ao próprio
   `docs/` que descreve**: ainda referencia `docs/reqs/` (nome antigo) em
   vez de `docs/requirements/`, lista `ROADMAP.md`/`PROJECT_CONTEXT.md`
   como "(pendentes)" quando ambos já existem, e não menciona
   `docs/sprints/`, `docs/HANDOFF_CLAUDE.md` nem `docs/README_HANDOFF.md`
   — todos criados depois dela. É o próprio exemplo do que a regra 4 de
   `docs/README.md` pede pra evitar (doc desatualizada tratada como
   atual).
4. **`CHANGELOG.md` (v7.1.0) não cobre os commits mais recentes da
   reorganização de `docs/`** (a movimentação para `sprints/`/
   `requirements/` que aconteceu depois dele ser escrito hoje). Não é
   grave, mas quebra a promessa do próprio changelog de ser "completo,
   nível de commit".

⸻

## 6. Risco de processo (governança)

O fluxo PM↔Claude é novo e ainda não tem nenhum ciclo completo
(`histórico: nenhuma demanda concluída`). A adaptação atual — Claude
acumulando chapéu de PM + Dev, com Murilo como único portão de aprovação
— é uma mitigação razoável do risco de "quem implementa também se
aprova", mas depende inteiramente de aprovação humana disciplinada em
**toda** demanda; não há checagem automática. Vale monitorar se esse
padrão se sustenta quando o volume de demandas aumentar.

⸻

## 7. Recomendação priorizada (próximos passos)

1. **Executar a S3.2.7 Readiness Review** (`S3-DS20-S4-READINESS-001`) —
   é a única demanda formalmente pronta e é o que desbloqueia S4. Chapéu
   implementador, com relatório em `HANDOFF_CLAUDE.md` ao final, status
   `REVISÃO DO PM NECESSÁRIA`.
2. **Fechar o ciclo do achado P0 da auditoria** (IA de mercado) —
   confirmar no código se `simulateAiTransfers`/`findInterestedBuyer` já
   refletem o `TransferScore` implementado nas Fases 1.1–1.5, e atualizar
   `BRDATA_Auditoria_v1.0.md` (ou um adendo) com o resultado — hoje
   ninguém consegue responder "isso foi resolvido?" só lendo `docs/`.
3. **Atualizar `ESTRUTURA_DE_PASTAS.md`** para refletir a árvore real de
   `docs/` pós-reorganização de hoje.
4. **Começar a povoar `docs/requirements/`** com pelo menos as regras
   mais estáveis e menos propensas a mudar (ex.: regras de Contratos,
   Match Engine) migradas de `docs/sprints/S2/`, para reduzir a
   dependência de "regra vigente = procurar na Sprint certa".
5. Quando S8 fechar: rodar o **checkpoint formal** que `PROJECT_CONTEXT.md`
   exige antes de voltar a S4, e nesse checkpoint decidir explicitamente
   os critérios de "S3 revisitada o suficiente" antes de declarar S4
   pronta pra iniciar de fato.
