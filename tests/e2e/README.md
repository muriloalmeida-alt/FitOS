# Suíte de regressão E2E (Modo Técnico)

104 scripts Playwright independentes (`test_*.js`) que cobrem o Modo Técnico
de ponta a ponta — cada um cria sua própria conta/carreira contra um
servidor local já rodando, então não há setup compartilhado nem ordem de
execução obrigatória entre eles.

Migrados pra dentro do repositório em 2026-09 porque viviam só em
`/tmp/pw-scratch/` (diretório efêmero do sandbox de desenvolvimento) — sem
isso, a suíte inteira seria perdida a cada reset de ambiente. 4 scripts
obsoletos (que testavam funções/atributos já removidos do app —
`buyPlayer()`, `data-sell`, `#marketBuyTable`) foram descartados na
curadoria e não fazem parte deste diretório.

## Pré-requisitos

1. **Node.js** ≥ 18.
2. **Servidor do jogo rodando localmente** em `http://localhost:8787`
   (`node server/server.js` a partir da raiz do repo — outra porta exige
   editar a constante `base` no topo de cada script).
3. **`playwright-core`** instalado nesta pasta:
   ```
   cd tests/e2e
   npm install
   ```
4. **Um binário do Chromium** compatível com a versão de `playwright-core`
   instalada. Duas opções:
   - Rodar `npx playwright install chromium` (baixa um build gerenciado
     pelo próprio Playwright) — nesse caso NÃO defina `PW_CHROMIUM_PATH`,
     o Playwright acha o binário sozinho.
   - Ou apontar pra um Chromium/Chrome já existente na máquina via
     variável de ambiente:
     ```
     export PW_CHROMIUM_PATH=/caminho/para/chrome
     ```

## Uso

Direto (um script específico):
```
node test_mercado2.js
```

Suíte inteira, em paralelo (recomendado — motivo: ver comentário no topo
de `run_parallel.js`):
```
node run_parallel.js
```

Só um subconjunto (substring do nome do arquivo) e/ou ajustando
concorrência/timeout:
```
node run_parallel.js test_mercado --concurrency=8 --timeout=60000
```

Cada script imprime um checklist numerado (`1) ... true/false`) e sai com
código 0 (tudo passou) ou 1 (alguma asserção falhou/exceção). O runner
paralelo agrega isso num resumo final e grava `_last_parallel_run.json`
(gitignored) com o detalhe de cada execução.

## Convenções destes scripts

- Cada teste faz seu próprio signup (`/api/auth/signup` + `/api/auth/login`
  via `fetch` direto no `page.evaluate`, e-mail único com `Date.now()`) —
  contas de teste não interferem entre si, mesmo rodando em paralelo,
  porque o estado por conta vive isolado no servidor.
- Viewport padrão `390×844`/`390×900` (mobile) — o Modo Técnico é
  desenhado mobile-first.
- Screenshots (quando o script tira algum) são salvos como `*.png` neste
  mesmo diretório — gitignored, servem só de inspeção manual local.
- Diálogos nativos do navegador (`window.confirm`/`alert`) são
  auto-dispensados via `page.on("dialog", ...)` na maioria dos scripts —
  o app usa modais próprias (`confirmModal()`) pra confirmação desde antes
  desta suíte existir; alguns scripts mais antigos ainda esperam diálogo
  nativo num fluxo específico e podem falhar por isso (falha catalogada,
  não uma regressão real do app).

## Achados conhecidos, não-regressivos

Alguns scripts têm falhas pré-existentes catalogadas ao longo do
desenvolvimento (não indicam bug no app):
- Fluxo de confirmação pré-jogo: `#btnSimulate`/`#btnAdvanceSeason` abrem
  uma confirmação (`#preMatchOverlay`/`confirmModal()`) antes de simular —
  scripts escritos antes dessa mudança que não clicam em
  `#btnPreMatchGo`/`#confirmOkBtn` primeiro travam esperando a tela
  seguinte.
- `test_frozen_provider.js` precisa de `DATA_PROVIDER=frozen` configurado
  no servidor (usa o catálogo real congelado) — sem isso, falha por
  design.
- Timing de partida ao vivo em velocidade natural (`test_training_evolution.js`,
  `test_play_by_play_v1.js`/`v2.js`) pode ser sensível a CPU disponível
  sob alta concorrência — rode com `--concurrency` menor ou `--timeout`
  maior se aparecerem timeouts isolados nesses arquivos.
- Flakiness de rede/proxy em ambientes com acesso restrito a
  `fonts.googleapis.com`/`fonts.gstatic.com` — a maioria dos scripts já
  bloqueia isso via `--host-resolver-rules`, mas nem todos.
