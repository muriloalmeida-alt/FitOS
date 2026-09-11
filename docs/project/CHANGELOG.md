# BRDATA — CHANGELOG
**Gerado em:** 09/09/2026 (atualizado em 11/09/2026)
**Cobertura:** 2026-08-14 até 2026-09-11 (237 commits em 18 dias, branch `main`)
**Versão atual:** v8.0.1

## Metodologia

Este changelog é derivado diretamente de `git log`, não de memória de
conversa — cada entrada tem o hash curto do commit real para conferência
(`git show <hash>`).

- **De 30/08/2026 em diante**, o projeto adotou o fluxo
  branch→implementar→testar→commit→merge `--no-ff` descrito no `CLAUDE.md`.
  Nesse período, cada linha da lista é um **commit de merge** — cada merge
  representa uma unidade de trabalho testada e revisada antes de entrar
  em `main`. Merges puramente de sincronização entre branches
  (`Merge pull request #N`, sincronizações de sessão) foram omitidos por
  não carregarem conteúdo de produto.
- **Antes disso** (14–29/08/2026), não havia esse fluxo — os commits eram
  diretos. Nesse período, cada linha é um **commit direto** (raiz do
  histórico do repositório).
- Datas são as do commit (`%ad`, formato `YYYY-MM-DD`), não de um
  changelog editado manualmente — por isso a ordem é estritamente
  cronológica e verificável.
- Este documento é **técnico e completo** (nível de commit). Para a
  versão resumida e em linguagem de usuário final, ver `public/historico.html`
  (versões v1.0 em diante, a partir do redesign visual de 31/08 — **numeração
  independente** da usada aqui; não confundir os dois esquemas).

## Esquema de versionamento (1 versão por dia de trabalho)

A pedido do usuário, a versão é atribuída **por dia** (o conjunto de
commits feitos naquela data), não por commit individual — cada dia de
trabalho é um bump só, calculado pelo item de **maior complexidade**
daquele dia:

| Nível | Quando bumpa | Critério aplicado |
|---|---|---|
| **PATCH** (x.y.**Z**) | 3º dígito | O dia inteiro só teve ajustes pontuais, correções de bug, texto/cor/espaçamento — nenhum item novo de peso. |
| **MINOR** (x.**Y**.0) | 2º dígito, zera o 3º | O dia teve ao menos uma feature completa e testável (um item de "Fase", um "Bloco" numerado, uma tela inteira refeita, uma nova página) — mesmo que também tenha tido ajustes menores junto. |
| **MAJOR** (**X**.0.0) | 1º dígito, zera os outros dois | O dia entregou ao menos um pilar novo do produto ou uma reconstrução completa de um já existente: um módulo de negócio novo (Loja, Engajamento), uma mudança de arquitetura (multi-divisão, catálogo congelado), o fechamento de uma "Fase" inteira da simulação, um redesign completo do design system, ou uma fundação de governança/IA nova. **Mantido deliberadamente raro** (7 dos 16 dias) — dias marcados MAJOR trazem uma linha "Bump MAJOR porque:" citando o item exato que justificou. |

O primeiro dia com commit (14/08) é o **baseline v1.0.0** — não é o
"começo do projeto" (o site já existia antes disso), é só o ponto em que
este changelog passa a existir e a numerar.

**Isso é uma classificação minha (Claude), não uma medição objetiva** — a
linha entre PATCH/MINOR/MAJOR em vários dias é uma chamada de julgamento
(por isso os dias MAJOR vêm com a justificativa explícita). Se algum bump
parecer errado pra você, é só apontar qual dia e eu ajusto — a ordem
cronológica e os hashes continuam verdadeiros de qualquer forma.

**Daqui pra frente**: ao fechar um dia de trabalho novo, aplique a mesma
tabela acima sobre o conjunto de commits daquele dia antes de decidir o
bump.

## Visão geral por era

| Dia | Versão | Era |
|---|---|---|
| 14/08 | v1.0.0 | Site principal: Freemium sem login (fases 1-2), parceiros de apostas, correções de Estatísticas |
| 15/08 | v1.1.0 | Site principal: Plano de Indexação (SEO) completo, páginas de time/jogador/partida/tabela, cores reais de clube |
| 16/08 | v1.1.1 | Bump de cache do Service Worker (1º deploy automático) |
| 26/08 | v1.1.2 | Placar ao vivo (Sportmonks livescores) |
| 29/08 | **v2.0.0** | **Nasce o Modo Técnico** (carreira estilo Elifoot) + elenco/mercado/contratos reais + diretoria/ingressos/multitemporada |
| 30/08 | **v3.0.0** | Fecham as Fases 1 (lesões reais), 2 (olheiro/potencial) e 4 (coletiva de imprensa) da simulação de carreira, no mesmo dia |
| 31/08 | v3.1.0 | Refatoração visual tela-a-tela seguindo o material do designer (Login → Escolha do Clube → ... → 19 telas) |
| 01/09 | v3.2.0 | Polish pós-lançamento do redesign (rodapé fixo, toasts, modais) |
| 02/09 | **v4.0.0** | **Série B/C real dentro do Modo Técnico** (multi-divisão) + Play-by-Play v1/v2 + Histórico de Atualizações |
| 03/09 | **v5.0.0** | **Engajamento/retenção, Loja (monetização) e catálogo real congelado** — 3 subsistemas novos no mesmo dia |
| 04/09 | **v6.0.0** | **Redesign completo do design system (Material 3, 9 blocos)** + Comissão Técnica + início do Bloco 3 (Mercado) |
| 05/09 | v6.1.0 | Conclusão do Bloco 3, Bloco 5 (treino/fadiga), performance de save, Módulo de Estatísticas |
| 06/09 | v6.2.0 | Transições suaves, suíte de regressão E2E no repositório, filtros de Mercado |
| 07/09 | v6.3.0 | Notificações push, onboarding, efeitos sonoros, compartilhar imagem, convite de amigo, histórico do jogador |
| 08/09 | **v7.0.0** | **Documentação formal de governança (CLAUDE.md/GDD/Game Engine Spec) + nasce o Transfer AI** |
| 09/09 | v7.1.0 | Transfer AI Fases 1.4/1.5 + reorganização de documentação em `docs/` + este CHANGELOG.md |

---

## Histórico completo (mais recente primeiro)

### 2026-09-11 — v8.0.1  (1 commit de merge)

> **Bump PATCH porque:** trabalho só de documentação (reorganização/
> extração de conteúdo já existente), nenhum código de produção
> alterado, nenhuma feature nova testável.

- `a493286` `DOCS-REQ-001` (issue #23) — povoa as 4 subpastas de
  `docs/requirements/` (antes vazias) com o que ainda é regra vigente
  de `docs/sprints/S2/` e `S3/` (que permanecem intocados como
  histórico): visão de produto/loop, arquitetura/motores, mecânicas/
  economia, e Design System — este último reconciliado com o estado
  real de execução da S4 até a data, não uma cópia da especificação
  original.

### 2026-09-10 — v8.0.0  (10 commits de merge)

> **Bump MAJOR porque:** fecha o Batch 2 (Core) do redesign mobile S4
> por completo (8/8 telas) e o Batch 3 (Transactional) por completo
> (4/4 mescladas, exceto a migração de "Resumo da rodada" em si, sem
> demanda própria) — governança PM↔Claude (`docs/HANDOFF_CLAUDE.md`),
> issues #12, #13, #15, #16, #17, #18, #19, #21 aprovadas pelo Murilo
> no mesmo lote, `S4-B2-003` (#14) aprovada em seguida depois de
> resolvidas 2 divergências de design, e `S4-B3-004` (#20) — tela
> Contratos criada do zero por decisão do PM — aprovada por último.

- `e894c78` S4-B2-001 — Loading/Bootstrap migrada pro Design System `--m3-*`
- `1ea5bd1` S4-B2-002 — Login/Entrada: achado de inspeção (já estava
  migrada, mudança puramente documental)
- `83dc57e` S4-B2-003 — Tática/Formação migrada (parcial): 2 tokens de
  cor legados; 2 divergências de design decididas pelo PM
  (`.mt-bench-row` mantido como padrão próprio; tipografia `Rajdhani`
  classificada como BRDATA Extension)
- `fc84582` S4-B2-004 — Treino migrada pro Design System `--m3-*`
- `0002afc` S4-B2-005 — Perfil do jogador migrado pro Design System
  `--m3-*`
- `3aeb1e0` S4-B3-001 — Cria os componentes TransferCard e ContractCard
  (BRDATA Product Patterns novos)
- `26c6331` S4-B3-002 — Mercado migrado pro TransferCard/Design System
  novo
- `f956e43` S4-B3-003 — Negociação/Proposta migrada pro
  TransferCard+Dialog; **achado e corrigido bug crítico pré-existente**
  de CSS que deixava todo Dialog/Bottom Sheet sem `position:fixed`/
  `z-index` de verdade desde `S3-DS20-S4-PREP-001`
- `70ac576` S4-B3-005 — Cria MatchCard e formaliza FinancialSummary
  (retroativo, mesmo caminho de PlayerCard)
- `31917dc` S4-B3-004 — Cria a tela Contratos do zero (redefinida de
  "migrar", já que a tela não existia): visão consolidada do elenco
  usando ContractCard, ações "Renovar"/"Dispensar" 100% reaproveitadas
  dos fluxos já existentes do Perfil do jogador, nenhuma regra de
  contrato nova

### 2026-09-09 — v7.1.0  (4 commits catalogados + 2 adicionados depois, ver nota)

- `c11e61f` Adiciona CHANGELOG.md com histórico completo do projeto
- `de928ec` Reorganiza documentação em docs/ (project/reqs/library/ops)
- `472217a` Fase 1.5 — Transfer AI: Market Dynamics
- `19d0ce2` Transfer AI Fase 1.4 (Negotiation AI)
- `8dcff10` S3-DS20-S4-PREP-001 — Dialog/Bottom Sheet/Skeleton (`--m3-*`) +
  convergência de nomenclatura de tokens (governança PM↔Claude,
  `docs/HANDOFF_CLAUDE.md`): 3 componentes P0 novos, isolados dos
  sistemas legados (`.ct-modal-*`/`.mt-sheet-overlay` intocados),
  Dialog integrado em `openPlayerCard()`; 12/12 testes automatizados
  (`tests/e2e/test_m3_dialog_sheet_skeleton.js`)
- `95fc77e` S3-DS20-S4-PREP-002 — Formaliza `playerRow()` como o BRDATA
  Product Pattern PlayerCard (governança PM↔Claude,
  `docs/HANDOFF_CLAUDE.md`): comentário de contrato completo (10
  campos), zero mudança de comportamento; divergência encontrada e
  registrada entre a especificação original e os 3 pontos de uso reais
  (`Elenco`/`Treino`/`openClubRoster()` — não "ajuste de escalação"
  como a spec citava); verificado contra `test_treinos.js` (12/12) e
  `test_ux_nomes_clicaveis.js`

**Nota (adicionada depois, mesmo dia):** o resto do trabalho de
09/09/2026 além destes 6 commits — a governança PM↔Claude em si
(`docs/HANDOFF_CLAUDE.md`/`README_HANDOFF.md`), a S3.2.7 Readiness
Review, o checkpoint de conclusão da S8, e as demais reorganizações de
`docs/` — não está catalogado commit a commit nesta entrada ainda
(ficou registrado em `docs/HANDOFF_CLAUDE.md` e nos documentos de
`docs/project/`/`docs/requirements/`, não aqui). Adicionar só os
commits `8dcff10`/`95fc77e` (não uma re-tabulação completa do dia) foi
uma escolha deliberada: eram os itens que motivaram esta atualização
(conclusão formal de demandas aprovadas), catalogar o resto é um
trabalho à parte.

### 2026-09-08 — v7.0.0  (3 commits)

> **Bump MAJOR porque:** Assistente de início + documentação (CLAUDE.md/GDB/GDB Técnico/Game Engine Spec); Transfer AI (Fases 1.1, 1.2, 1.3)

- `202fc99` Transfer AI Fase 1.3.2 (Balanceamento estrutural)
- `5145b7d` Transfer AI (Fases 1.1, 1.2, 1.3)
- `9c83e4b` Assistente de início + documentação (CLAUDE.md/GDB/GDB Técnico/Game Engine Spec)

### 2026-09-07 — v6.3.0  (6 commits)

- `b163340` Histórico individual do jogador
- `2666a8a` Convite de amigo por link + bug fix de login
- `6110c93` Compartilhar resultado/título/conquista como imagem
- `5149db9` Efeitos sonoros leves (apito/gol/torcida)
- `3c69f52` Onboarding: tutorial de boas-vindas
- `2babe65` Notificações push (lembrete de streak)

### 2026-09-06 — v6.2.0  (4 commits)

- `cd8d401` Mensagens de rodapé no visual placar de LED
- `3a9e8a7` Filtros ampliados no Mercado
- `82260b5` Suíte de regressão E2E no repositório
- `22f9591` Transições suaves ao trocar de aba e abrir modal

### 2026-09-05 — v6.1.0  (9 commits)

- `f4e774b` Corrige respiro no topo das modais em tela cheia
- `76c8e4e` Corrige respiro no topo + Módulo de Estatísticas completo
- `da9650e` Checklist de UX: zoom, foco, nomes clicáveis, fechar+Início, M3 (Login/Loading/Treino)
- `fac8211` Histórico de Atualizações: registra v1.9 a v2.8
- `4f180a0` Bloco 7/8/9 pendentes: Editar perfil, Configurações, Central de notificações, Histórico de compras, Central de ajuda, Sistema
- `9356abe` Performance: escrita de save assíncrona e debounced
- `b9619b8` Bloco 5: Treino (foco Tático, duração, resumo/aviso de risco) + Histórico de fadiga
- `79701ae` Bloco 3 (4/4): Histórico de negociações, fecha o Bloco 3
- `00b6356` Bloco 3 (3/4): Colocar à venda + Indicações dos olheiros

### 2026-09-04 — v6.0.0  (18 commits)

> **Bump MAJOR porque:** Redesign M3: Blocos 1-9 completos

- `272dd31` Comissão Técnica: sugestão de Mercado abre proposta real
- `340541c` evolução de atributos mais realista, acesso/rebaixamento A/B/C + Série D, Comissão Técnica no lugar do elenco em destaque
- `748ad44` tela de loading, Menu em submenus, card da Comissão Técnica no Início e Bloco 3 (1/4 e 2/4) do Mercado
- `da028a1` Comissão Técnica
- `f6e1b38` Instruções por setor (fecha Bloco 2)
- `63be887` Marcação individual
- `033e725` Meus esquemas
- `f41bdc6` Bloco 2: eixos táticos + reskin
- `f53b63d` remove card + contraste acessível dos escudos
- `988cb83` Comparar jogadores lado a lado
- `5f91366` Resumo da rodada
- `87c64bc` Histórico de confrontos (H2H)
- `271f674` Bloco 1: reorganiza Onboarding/Elenco/Perfil + carrossel de destaque
- `c04135d` toast/snackbar 100% M3
- `94f2352` header sem quadrado atrás da logo
- `b21074f` escudo real sem fundo colorido
- `c8191c9` elimina o diamante atrás das logos dos clubes
- `62f8419` Redesign M3: Blocos 1-9 completos

### 2026-09-03 — v5.0.0  (8 commits)

> **Bump MAJOR porque:** login diário, objetivos, conquistas, ranking; Loja: catálogo (pacotes + boosts), sem pagamento real ainda; catálogo real congelado + fornecedor "frozen"

- `d96e740` catálogo real congelado + fornecedor "frozen"
- `6810677` Loja: catálogo (pacotes + boosts), sem pagamento real ainda
- `a8ddb32` registra v1.7 no Histórico
- `83a50cf` login diário, objetivos, conquistas, ranking
- `b6a11c1` captura por divisão
- `39e0b79` captura via GET (navegador)
- `1521ce3` captura de elenco real via HTTP
- `2bb5dcc` Módulo de Treinos + nav de 6 itens

### 2026-09-02 — v4.0.0  (14 commits)

> **Bump MAJOR porque:** Série B/C no Modo Técnico

- `2c32fbd` script de captura de elenco real
- `7665cfe` registra Mercado com as 3 divisões
- `f095066` mercado de 60 times
- `8a83ea5` filtra times placeholder da Sportmonks
- `fe2bf17` corrige "Time #xxx" ao ligar dado real
- `dcc57b5` escudos reais na Série B
- `e7aff3f` Série B/C no Modo Técnico
- `a32a900` Nova página pública: Histórico de Atualizações (versionamento do produto, clicável por versão)
- `66a898a` Logo do header sem moldura de fundo (ícone isolado no lugar do hexágono navy+dourado)
- `32e9e0b` Play-by-Play v2: lesão narrada, pênalti (marcado/perdido), VAR check, barra de posse de bola ao vivo
- `399e93d` Play-by-Play v1: banco de comentários por tipo de evento, estatísticas agregadas (posse/finalizações), controles de velocidade, destaque de gol em tela cheia, "Rever lances"
- `ffde664` Label do botão de avançar temporada simplificado para "Próxima Temporada"
- `a7c01b0` Botões "Avançar temporada" e "Salvar escalação e táticas" no padrão dourado dos demais botões primários
- `d93a86f` Escudo dos clubes: monograma como fallback (sigla no hexágono) + Opção B no card "Próximo jogo" (escudo ampliado com halo de cor)

### 2026-09-01 — v3.2.0  (14 commits)

- `89bc0d7` Toast de rodapé: fundo cor gelo (marfim) em vez de navy escuro, pra se destacar do resto da tela
- `42fbf40` Toast de rodapé: largura fixa igual ao botão "Ir para o jogo" (Opção B) + revisão de todos os ~48 textos do app
- `4f220d3` Merge: toast se reposiciona sozinho durante transições de tela
- `1f38750` Merge: "BR Treinador" no Adicionar à tela de início do Modo Técnico
- `4972aa5` Merge: toast flutua acima do rodapé fixo em qualquer situação
- `82f3ccd` Merge: pequena margem entre o botão da barra de ação e a nav
- `48b3044` Merge: botão da barra de ação cola na nav fixa
- `8198359` Merge: remove texto de disclaimer da modal de Tabela
- `ff755ab` Merge: cabeçalho da modal de Tabela alinhado ao novo layout
- `9bde4a4` Merge: "Ir para o jogo" na Central + resumo financeiro nas Notícias
- `76a9b62` Merge: modal de Tabela alinhada ao novo layout
- `3266bd8` Merge: modal de "Ajustar escalação" no pré-jogo
- `0c1025c` Merge: revisão das modais de pós-jogo
- `a960dc4` Merge: botões de ação principal travados no rodapé

### 2026-08-31 — v3.1.0  (32 commits)

- `2b2ae19` Merge: Notícias redesenhada pra "capa de jornal" (Opção B)
- `ae36ea6` Merge: Banco de reservas da escalação automática sempre em 1-4-3-3
- `dc2deb5` Merge: Corrige placar quebrando em 2 linhas (Tela 14/Ao Vivo)
- `fd5d206` Merge: Botões do Mercado no canto, discretos (feedback do usuário)
- `82ee5d0` Merge: Ajustes de modais no rodapé, botões discretos e ícones no Mercado
- `21dd157` Merge: Refatoração completa de Premiações (Tela 11c)
- `7ea512b` Merge: Refatoração completa de Perfil do Técnico (Tela 11b)
- `e2cc2f1` Merge: Refatoração completa de Coletiva de imprensa (Tela 14b)
- `6b4b4b2` Merge: Refatoração completa de Notícias (Telas 11d/15)
- `f0ab2e8` Merge: Refatoração completa de Resultados da rodada (Tela 16)
- `f071b95` Merge: Refatoração completa de Resultado do jogo (Tela 14)
- `ed20073` Merge: Refatoração completa de Confirmar escalação (Tela 12f)
- `c29a74e` Merge: Refatoração completa de Propostas de patrocínio (Tela 12b)
- `b475c7b` Merge: Refatoração completa de Detalhe da proposta (Tela 12d)
- `58d757b` Merge: Refatoração completa de Proposta em destaque, Nova temporada e Demissão (Telas 16b, 18, 19)
- `023ab48` Merge: Refatoração completa da tela Ao Vivo (Tela 13b)
- `ba1c38c` Merge: Refatoração completa do modal de confirmação genérico (Tela 10b)
- `940f6d7` Merge: Refatoração completa das Telas 8, 9 e 10 (Tabela, Estatísticas, Mercado)
- `c4e487f` Merge: refatoração completa das Telas 5, 6 e 7
- `7bbf3b6` Merge: refatoração completa da Tela 4 (Elenco) — idêntica ao mockup
- `a6d7a5d` Merge: corrige cor de fundo do Atlético-MG e do Coritiba
- `658948e` Merge: cabeçalho maior, cores de clube mais robustas, meta na Elenco
- `d857406` Merge: refatoração completa da Tela 3 (Central) + navegação global
- `3c031d9` Merge: clubes em ordem alfabética + remove texto decorativo das telas 1 e 2
- `66f631e` Merge: refatoração completa da tela 2 (Escolha do Clube) — idêntica ao material do designer
- `9132ca5` Merge: aumenta o logo dentro do badge da tela de Login
- `87466b4` Merge: ajusta espaçamento da tela de Login pra caber na primeira dobra
- `1090d64` Merge: refatoração completa da tela 1 (Login) — idêntica ao material do designer
- `a9b28b3` Merge: reverte redesign visual do Modo Técnico (fase 1)
- `1a8909d` Merge: redesign visual do Modo Técnico — fase 1 (fundação + Login/Central/navegação)
- `acf3837` Merge: corrige link de cadastro do Modo Técnico que mandava pra home
- `ae948b6` Merge: intervalo pausável, notícias por rodada, destaque a propostas e clube destino

### 2026-08-30 — v3.0.0  (33 commits)

> **Bump MAJOR porque:** Fase 1 item 4 (lesões reais) — fecha a Fase 1; Fase 2 item (olheiro/potencial na base) — fecha a Fase 2; Merge feature/fase4-coletiva-imprensa: coletiva de imprensa pós-jogo (Fase 4 item 2 — fecha a Fase 4 inteira)

- `974d177` Merge feature/emprestimos-idade-confirmar-escalacao: empréstimos realistas, idade real da API, confirmação de escalação
- `5476f9b` Merge feature/noticias-fullscreen-pre-resultados: notícias em tela cheia antes dos resultados
- `057a109` Merge feature/fase4-coletiva-imprensa: coletiva de imprensa pós-jogo (Fase 4 item 2 — fecha a Fase 4 inteira)
- `d9bba4f` Merge feature/portal-noticias-premiacoes-design: tela de notícias estilo portal + redesign das premiações
- `3ac78c6` Merge feature/fase4-reputacao-propostas: reputação do técnico → propostas de outros clubes (Fase 4 item 4)
- `871d346` Merge feature/fase4-moral-relacionamento: moral/relacionamento jogador-técnico (Fase 4 item 1)
- `2590b67` Merge feature/fase4-premiacoes: premiações de final de temporada (Fase 4 item 6)
- `3882429` Merge feature/fase4-noticias-rodada: notícias da rodada (Fase 4 item 3)
- `d944a8a` Merge feature/fase4-patrocinio: patrocínio e material esportivo (Fase 4 item 5)
- `efc43b7` Merge feature/condicao-nota-e-ajuda: condição em nota 1-5 e textos explicativos em '?'
- `ebade8c` Merge feature/elenco-status-icones: status do jogador em ícone + semáforo
- `d729f9c` Merge feature/tabela-modal: tabela atualizada abre em modal tela cheia
- `a194ee5` Merge feature/ui-fullscreen-modais: botão auto-escalar como ícone, toggle de base e modais em tela cheia
- `a005a75` Merge feature/escalacao-avancada: escalação automática, mais formações e troca simples
- `99faf0d` Merge feature/ao-vivo-substituicao-tatica: tela Ao Vivo com substituição e tática (Fase 3 itens 1 e 2)
- `15b2499` Merge feature/evolucao-atributos-treino: evolução de atributos por treino (Fase 3 item 4)
- `fe9a975` Merge feature/emprestimo-avancado: evolução do empréstimo (Fase 3 item 3)
- `fb1d884` Fase 2 item (olheiro/potencial na base) — fecha a Fase 2
- `beb79bb` Fase 2 item (empréstimo de jogadores)
- `28e9164` Fase 2 item (moral do elenco)
- `d5146d0` Fase 2 item (Copa do Brasil)
- `e99ded1` Fase 1 item 4 (lesões reais) — fecha a Fase 1
- `b977515` Fase 1 item 3 (metas da diretoria)
- `10edca2` Fase 1 item 1 (renovação de contrato)
- `ad915be` toast contido na tela
- `4a7f051` venda exige comprador interessado
- `09ed38b` texto do aviso de janela encerrada
- `f473701` layout do aviso de janela fechada
- `6e7d811` Fase 1 item 2 (janela de transferências)
- `e54b163` botão Simular rodada maior
- `ddceb77` botões do detalhe do jogador em coluna cheia
- `ed7bf7f` componentes seguindo o design system
- `42c929a` refatoração visual do Modo Carreira

### 2026-08-29 — v2.0.0  (32 commits)

> **Bump MAJOR porque:** NOVA FEATURE: Modo Técnico — carreira estilo Elifoot no Brasileirão

- `0ca3c23` AJUSTE: confirm() nativo virou modal + botão da diretoria centralizado
- `9d6c9bb` AJUSTE: renderização isolada por aba + erro visível (relato: Elenco em branco)
- `806da08` BUG CORRIGIDO: 'não deu pra carregar o Modo Técnico' em carreira antiga
- `0ad66fd` FASE 3 (c): multitemporadas — envelhecimento, contrato vencendo, renovação da liga inteira
- `1a74030` FASE 3 (b): renda de ingressos, público reflete a fase recente
- `aae9c4f` FASE 3 (a): diretoria — pedir mais orçamento avaliando risco/disputa de título
- `31816b0` AJUSTE: tira a tag 'gerado' dos jogadores da base
- `739a6fb` AJUSTE: Mercado em cards de 2 linhas + salário/valor em linhas separadas
- `ee7afbf` FASE 2 (c): mercado de transferências com os 19 times negociando entre si
- `42e4f1d` FASE 2 (b): contrato, salário, valor de mercado e orçamento real
- `c9e7f6a` FASE 2 (a): elenco individual pra todos os 20 times + estatísticas reais da liga
- `83292bd` AJUSTE: header minimalista (logo + Modo Carreira + menu hambúrguer)
- `235785f` AJUSTE: X pra fechar em todas as modais, header com escudo do clube, rodada ao lado de Próximo jogo
- `9c3ff23` AJUSTE: cabeçalho do Modo Técnico redesenhado
- `13e4527` BUG CORRIGIDO: gols do adversário sumiam do detalhe do jogo (placar não batia)
- `f913013` BUG CORRIGIDO: erro 400 'Formato de save inválido' ao salvar (dados reais)
- `fa62522` BUG CORRIGIDO: header/JS/CSS do Modo Técnico não atualizava a cada deploy
- `8f622fa` AJUSTE: mensagem de erro ao salvar mostra o código/motivo real
- `0eb4589` BUG CORRIGIDO: não dava pra salvar o progresso ao simular rodada
- `7c13c1a` AJUSTE: layout e header novos pras modais do Modo Técnico
- `fba561b` NOVA FEATURE: nomes abreviados, detalhe de jogo, aba Estatísticas e modais de rodada
- `0d694e4` BUG CORRIGIDO: linha de 5 no campinho quebrava em 2 (3-5-2, 4-2-3-1, 4-5-1, 5-3-2)
- `fce5abd` AJUSTE: README-DEPLOY-RAILWAY.md atualizado pra branch main
- `b55b620` AJUSTE: banco de reservas em tabela (Nome/Posição/Overall) e até 11 reservas
- `fb1e853` BUG CORRIGIDO: elenco do Sportmonks sem posição real (goleiro sumindo/posição errada)
- `777f7ef` BUG CORRIGIDO: goleiro reserva sem estatística sumia do elenco (API-Sports)
- `a2cb5d4` BUG CORRIGIDO: elenco gerando jogador de mentira mesmo com real completo, e posição fabricada
- `9f0d0ed` BUG CORRIGIDO: cache do navegador travando em versão antiga a cada deploy
- `2fbc7b7` AJUSTE: tela de "login necessário" do Modo Técnico agora é a de login de verdade
- `cdfc82a` AJUSTE: banco de reservas ordenado por posição (pedido do usuário)
- `e45cda0` AJUSTE: 4 melhorias no Modo Técnico (pedido do usuário)
- `adb2225` NOVA FEATURE: Modo Técnico — carreira estilo Elifoot no Brasileirão

### 2026-08-26 — v1.1.2  (1 commit)

- `cb96062` Placar ao vivo na aba Jogos (Sportmonks livescores/inplay)

### 2026-08-16 — v1.1.1  (1 commit)

- `f984b0a` AJUSTE: bump do cache do Service Worker — gatilho do 1º deploy automático em produção

### 2026-08-15 — v1.1.0  (36 commits)

- `8aed45d` AJUSTE: /apoie renomeada pra /seja-premium
- `a865243` NOVA FEATURE: conclui o plano de SEO — /estatisticas, /noticias e /apoie indexáveis
- `9bcddec` NOVA FEATURE: página própria da Tabela — "tabela do brasileirão" indexável
- `500ed8e` AJUSTE: revisão do funil de páginas — 3 páginas sem link interno de volta
- `39874d0` BUG CORRIGIDO: página de Jogador (e outras) quebrando por cache do Service Worker desatualizado
- `041fb37` NOVA FEATURE: página própria da Partida com hero nas cores dos 2 times
- `a821048` NOVA FEATURE: página própria por partida — "onde assistir" e horário indexáveis no Google
- `1f9d291` AJUSTE: página de Jogos abria numa rodada já passada por padrão
- `4600806` BUG CORRIGIDO: card do Athletico aparecia VERDE em modo ao vivo
- `440d4aa` AJUSTE: vermelho do Athletico/Flamengo ficava escurecido demais no hero
- `035eb51` BUG CORRIGIDO: Posse média em branco na página inicial (Dashboard)
- `41ecd43` AJUSTE: Athletico Paranaense com as mesmas cores do Flamengo
- `8f9a7f4` NOVA FEATURE: degradê de 3 cores pros 5 times tricolores
- `aa96a2c` BUG CORRIGIDO: cor do Cuiabá estava errada (azul em vez de verde/dourado)
- `190e3c8` BUG CORRIGIDO: heros não usavam a cor real do clube em modo ao vivo
- `14268a1` AJUSTE: mais espaçamento no botão Voltar (header e hero)
- `cc19c40` AJUSTE: heros do Time e do Jogador mais compactos (foto/escudo lado a lado com o conteúdo)
- `8d67871` AJUSTE: botão 'Voltar' mais bonito + logo sem desalinhamento
- `5780d50` NOVA FEATURE: religa link de jogador + refatora página do Time (hero + remove aviso de 'sem jogos decididos')
- `0683e51` AJUSTE: nota do jogador não aparece mais duplicada
- `8f8b0bb` NOVA FEATURE: página de jogador reconstruída (hero + estatísticas em destaque)
- `c108776` AJUSTE: URL de jogador aninhada em time (/times/:slug/jogadores/:id)
- `c4bf516` AJUSTE: melhorias no tagueamento de SEO (og:image por entidade, imagem 1200x630, sitemap com jogadores)
- `9f5c43e` AJUSTE: logo horizontal com a imagem final do usuário + fundo transparente
- `6498660` AJUSTE: logo horizontalizada no cabeçalho (ícone + "BR DATA" lado a lado)
- `6115b86` AJUSTE: logo com mais destaque no cabeçalho (sidebar desktop + topbar mobile)
- `f0bbfe2` BUG CORRIGIDO: raiz do site sem conteúdo pré-renderizado (achado numa simulação de crawl do Googlebot)
- `d804e54` NOVA FEATURE: domínio de produção definitivo (brdata.online) + homologação bloqueada pra robô
- `57766ae` NOVA FEATURE: Fase B continuação — página do Jogador (/jogadores/:id[-slug]) também ganha URL própria
- `7c27bda` NOVA FEATURE: Fase B + C do "Plano de Indexação" — cada time do Brasileirão ganha URL própria e indexável
- `bfcba60` NOVA FEATURE: Fase A do "Plano de Indexação" (SEO) — robots.txt, sitemap.xml, meta tags e dados estruturados
- `632be60` NOVA FEATURE: Fase 5 do plano "Freemium sem login" — funil do admin agora mede "visitante → cadastrou"
- `3fd52e0` NOVA FEATURE: Fase 3 do plano "Freemium sem login" — anúncio roda igual pra visitante
- `87a49ea` BUG CORRIGIDO: elenco (e outros dados) sumindo sem motivo + cache do PWA menos "desgastante" pra atualizar
- `bd5cfd7` BUG CORRIGIDO: tela em branco pós-deploy — cache do Service Worker desatualizado
- `360ec60` BUG CORRIGIDO: visitante via dado de EXEMPLO em vez de AO VIVO + flash da tela de login no boot

### 2026-08-14 — v1.0.0  (12 commits)

- `0756fd0` NOVA FEATURE: Fase 4 do plano "Freemium sem login" — clube favorito por navegador pra visitante
- `11cf76c` AJUSTE: renomeia "Apoie o BR Data" pra "Assine o BR Data"
- `9ce22e0` NOVA FEATURE: Fase 2 do "Freemium sem login" — app funciona pra visitante
- `c225d46` NOVA FEATURE: Fase 1 do "Freemium sem login" — rotas públicas com rate-limit
- `ebbdc42` NOVA FEATURE: remove o bloqueio de desktop, vira faixa dispensável
- `5d70109` AJUSTE: Elenco ordenado por gols, busca por nome, card reposicionado
- `5ac08f2` BUG CORRIGIDO: número de cartão por time ficava ERRADO em Estatísticas
- `03d6eb0` BUG CORRIGIDO: cartões zerados e "Desempenho ofensivo" quebrado em Estatísticas
- `d298072` AJUSTE: tira Superbet por enquanto, centraliza os 3 restantes
- `ea0fa09` AJUSTE: chip de parceiro com tamanho padronizado + borda em relevo
- `20c5544` AJUSTE: logos reais dos 4 parceiros (bet365, Betano, KTO, Superbet)
- `355fbf9` AJUSTE: link direto pras casas de apostas + logo no lugar do nome
---

## Notas de governança

- Este arquivo cobre até o commit `c11e61f` (09/09/2026, este próprio
  arquivo) — o mais recente na branch `claude/elifoot-brasileirao-game-epw0sz`
  no momento em que este changelog foi gerado.
- Segundo a regra fixada em `docs/README.md`, mudanças relevantes de
  produto/arquitetura daqui pra frente devem ser adicionadas no topo deste
  arquivo (mais recente primeiro), com a versão do dia calculada pela
  tabela de bump acima — não é regerado automaticamente do zero a cada
  vez, para não perder as anotações manuais das entradas antigas (como as
  expansões de `[feature/...]` e as justificativas de bump MAJOR feitas
  nesta primeira versão).
- Para o status/sequência de Sprints (diferente de "o que já foi feito"),
  a fonte de verdade é `docs/project/ROADMAP.md` (pendente).
