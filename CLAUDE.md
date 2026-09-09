# CLAUDE.md — BRDATA/FitOS

Antes de tratar qualquer pedido funcional (nova feature, mudança de
comportamento, priorização, ajuste de escopo), aplique a skill `pm`
(`.claude/skills/pm/SKILL.md`) e leia `docs/GOVERNANCA_PM_CLAUDE.md`.

Resumo essencial:

* Não há GPT dedicado ao papel de PM no momento — Claude absorve as
  tarefas funcionais de PM (especificação, roadmap, critérios de aceite),
  além de continuar implementando.
* Exceção: a aprovação formal antes do commit continua sendo do Murilo —
  nunca commitar uma demanda sem o `APROVADO` dele registrado em
  `docs/HANDOFF_CLAUDE.md`.
* Estado das demandas em andamento: `docs/HANDOFF_CLAUDE.md`. Histórico de
  implementação: `docs/CHANGELOG.md`. Não trate como documentos
  duplicados.
* Preservar funcionalidades existentes é regra dura: mudança mínima
  necessária, sem refatoração oportunista nem reconstrução de sistemas sem
  autorização explícita.
* Material Design 3 é a autoridade visual do projeto.
* Documentação do projeto em PT-BR.
