# docs/requirements/

Requisitos e regras de negócio **vivos** do produto — a versão atual de
"o que o sistema deve fazer", organizada por tipo, em vez de por Sprint
(isso é `docs/sprints/`, o registro histórico de quando/como cada coisa
foi decidida ou auditada).

Criada em 09/09/2026. Povoada em 11/09/2026 (`DOCS-REQ-001`, issue #23)
com o que ainda é regra vigente dos documentos originais (GDD, GDD
Técnico, Game Engine Spec, specs da série S3/DS2.0), que continuam
registrados na íntegra, como histórico imutável, em `docs/sprints/`.
Novo material de requisito deve entrar aqui, na subpasta
correspondente:

* `functional/` — regras de negócio e comportamento esperado do produto
  (o que o usuário pode fazer, o que o sistema deve garantir).
* `technical/` — requisitos técnicos e de arquitetura (não é o mesmo que
  `docs/ops/`, que é operação/deploy; aqui é requisito, não como rodar).
* `game-design/` — game design (mecânicas, balanceamento, progressão,
  economia do jogo).
* `ui-ux/` — requisitos de interface e experiência (inclui aderência ao
  Material Design 3 e ao BRDATA Design System).

Se/quando um requisito específico de Sprint (ex.: algo hoje em
`docs/sprints/S3/`) se tornar regra permanente e não histórica, mover pra
cá é uma decisão de governança — registrar a mudança em
`docs/project/CHANGELOG.md`.
