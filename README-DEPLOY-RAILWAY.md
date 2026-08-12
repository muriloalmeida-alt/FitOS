# Deploy no Railway — dois ambientes (HML + PRD)

Este projeto roda em dois ambientes Railway dentro do mesmo projeto:

| Ambiente | Papel | Deploy |
|---|---|---|
| **HML** (homologação) | Ambiente de teste — branch `claude/subir-projeto-q6vj0z` | **Automático** a cada push |
| **PRD** (produção) | Ambiente real, usado pelos clientes | **Manual** — só atualiza quando alguém manda explicitamente |

---

## Checklist depois de criar os ambientes

Com HML e PRD já criados, confirme os itens abaixo — são a parte que **não** dá pra ver de fora (eu não tenho acesso à sua conta Railway):

- [ ] **Domínio do HML começa com `hml`** (ex.: `hml-brdata.up.railway.app`, ou um domínio customizado tipo `hml.seusite.com`). Isso é o que ativa o [login padrão admin/admin em homologação](README-LOGIN.md#login-padrão-de-homologação-adminadmin) — sem esse prefixo, aquele login não funciona.
- [ ] **Domínio do PRD NÃO começa com `hml`** — pelo mesmo motivo acima, ao contrário: garante que o login admin/admin nunca fica disponível em produção.
- [x] **Volume anexado nos DOIS ambientes** (Settings do serviço → Volumes → mount path `/app/server/data`). Cada ambiente é uma instância separada — o Volume não é compartilhado nem copiado automaticamente ao criar o PRD a partir do HML. Sem isso, contas de login e cadastros de pagamento somem a cada deploy. Ver [README-LOGIN.md](README-LOGIN.md).
- [ ] **Auto Deploy desligado no PRD** (Settings do serviço → Source → desconectar o branch / desativar Auto Deploy). No HML, deixe ligado normalmente.
- [ ] **Variáveis de ambiente revisadas em cada um** — o fork copia as variáveis do HML pro PRD, mas vale conferir se algo deveria ser diferente entre os dois:
  - `APP_MODE`: HML pode ficar em `demo` (não gasta cota da API-Sports testando); PRD em `auto` ou `live`.
  - `MERCADOPAGO_ACCESS_TOKEN`: mesmo token real nos dois, ou um token de teste no HML se quiser evitar pagamentos de verdade durante testes — ver [README-PAGAMENTOS.md](README-PAGAMENTOS.md).
  - `LIVE_SEASON`, `PLAN_*_PRICE`: normalmente iguais nos dois, ajuste se fizer sentido pro seu teste.

## Como atualizar produção (deploy manual)

1. Teste as mudanças no ambiente **HML** primeiro (já atualiza sozinho a cada push)
2. Quando estiver pronto, entre no ambiente **PRD** no painel do Railway
3. `Cmd/Ctrl + K` → **"Deploy Latest Commit"** (ou o botão **Deploy** na tela do serviço)

## Verificação rápida (rodar de fora, sem precisar entrar no Railway)

Depois de configurar, dá pra conferir que os dois ambientes estão respondendo certo:

```bash
curl https://SEU-DOMINIO-HML/api/health
curl https://SEU-DOMINIO-PRD/api/health
```

Ambos devem responder `{"ok":true, ...}`. Se quiser, me manda as duas URLs que eu confiro isso pra você.
