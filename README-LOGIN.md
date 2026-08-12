# Login obrigatório (cadastro + planos + Mercado Pago)

Desde essa versão, **o site inteiro fica atrás de login**. Quem entra
pela primeira vez cai numa tela de cadastro obrigatória — escolhe um
plano (Freemium, Lite, Pro ou Enterprise), preenche nome/telefone/
e-mail/senha e, se o plano for pago, paga por cartão ou PIX (Mercado
Pago) antes de conseguir fazer login e usar o app.

---

## ⚠️ Leia isto antes de colocar em produção

As contas (nome, e-mail, senha com hash, plano, status do pagamento) e
as sessões de login ficam salvas em **arquivos JSON locais**
(`server/data/users.json` e `server/data/sessions.json`) — mesmo
esquema "zero banco de dados" já usado pelo resto do backend.

**Isso só funciona de verdade se você anexar um [Volume do
Railway](https://docs.railway.com/reference/volumes) apontando pra
pasta `server/data` do serviço.** Sem isso, o Railway usa um
filesystem efêmero — toda vez que você fizer um novo deploy (inclusive
deploys automáticos por push no GitHub), **esse arquivo é apagado e
todo mundo perde a conta** (login para de funcionar pra todos os
usuários cadastrados até ali).

Passo a passo no Railway: Settings do serviço → **Volumes** → Add
Volume → monte em `/app/server/data` (ajuste o caminho conforme onde o
serviço roda o `node server.js`).

## Como funciona o fluxo

1. **Visitante novo** → tela de cadastro (`#authGate`, sempre em cima
   de tudo até logar). Escolhe um plano:
   - **Freemium** (grátis, mesmo acesso do Lite — sem anúncios ainda,
     é um recurso planejado pra depois): conta já fica ativa na hora,
     só falta fazer login.
   - **Lite / Pro / Enterprise** (pago, R$ 5,99 / 14,99 / 29,99,
     pagamento único): a conta é criada com status "pagamento
     pendente" e o navegador é redirecionado pro checkout hospedado do
     Mercado Pago (cartão ou PIX). Volta pro site depois, com o
     resultado do pagamento.
2. Em qualquer um dos casos, o próximo passo é sempre **fazer login**
   (e-mail + senha) — o cadastro nunca loga automaticamente.
3. Se o login funcionar mas o plano ainda não estiver ativo (pagamento
   pendente, ainda não confirmado, ou deu erro ao criar o checkout), a
   tela mostra "Falta pouco!" com um botão pra retomar o pagamento.
4. Com o plano ativo, a sessão vira um cookie (`brdata_session`,
   httpOnly, 30 dias) e o app libera normalmente.
5. **Upgrade de plano**: usuário já logado pode ir em "Apoie o BR
   Data" (menu/sidebar) e trocar de plano a qualquer momento. O plano
   atual só é substituído quando o pagamento do upgrade é confirmado —
   ninguém perde acesso no meio de uma troca.

## Login padrão de homologação (admin/admin)

Em qualquer host cujo nome comece com **`hml`** (ex.: `hml.seudominio.com`,
`hml-brdata.up.railway.app`), o login aceita usuário `admin` e senha
`admin` — a conta (plano **Enterprise**, sempre ativo, com todas as
permissões liberadas — Comparador/Probabilidades/Simulador, os 3
campeonatos etc.) é criada automaticamente na primeira vez que alguém
usa esse login naquele ambiente. Se a conta já existia com outro plano
(de antes dela virar Enterprise por padrão), o login já corrige
sozinho na hora, sem precisar apagar nada do Volume.

- **Nunca funciona em nenhum outro host** — a checagem é literal, no
  início do hostname da requisição (`isHomologHost()` em
  `server/server.js`). Só existe risco se o domínio de **produção**
  também começar com "hml" — mantenha o domínio de produção sem esse
  prefixo (ex.: use `hml` só no ambiente de homologação do Railway).
- É uma credencial fixa e pública (está neste arquivo!) — só faz
  sentido porque fica restrita a um ambiente de teste sem dado real de
  cliente. Não reutilize esse padrão em produção.
- No campo de login, o campo de "e-mail" aceita texto livre (não é mais
  `type="email"` no HTML) exatamente pra permitir digitar "admin" sem
  formato de e-mail — login normal (com e-mail de verdade) continua
  funcionando igual, o backend não valida formato nessa rota.

## Segurança

- Senha nunca é guardada em texto puro — hash com `scrypt` (módulo
  nativo do Node, sem dependência externa) + salt aleatório por
  usuário.
- Comparação de senha usa `crypto.timingSafeEqual`, e roda mesmo
  quando o e-mail não existe (contra um hash fixo) — evita que o tempo
  de resposta do login revele se aquele e-mail está cadastrado.
- Sessão é um token aleatório de 32 bytes (cookie httpOnly,
  `SameSite=Lax`, `Secure` quando servido por HTTPS) — nunca acessível
  via JavaScript no navegador.
- O status de pagamento mostrado ao usuário **sempre** vem de uma
  consulta nossa à API do Mercado Pago (com nosso próprio access
  token), nunca do conteúdo bruto do webhook — não dá pra forjar
  "pagamento aprovado" adulterando a notificação.

## Endpoints

| Rota | O que faz |
|---|---|
| `POST /api/auth/signup` | `{name, phone, email, password, plan}` → cria a conta; se o plano for pago, já devolve `checkoutUrl` do Mercado Pago |
| `POST /api/auth/login` | `{email, password}` → valida e seta o cookie de sessão |
| `POST /api/auth/logout` | encerra a sessão atual |
| `GET /api/auth/me` | `{authenticated, user}` — usado no boot do front-end e depois de qualquer ação sensível |
| `POST /api/support/checkout` | **autenticado** — cria um novo checkout: retoma um pagamento pendente do próprio cadastro, ou inicia um upgrade de plano |

Todas as outras rotas `/api/*` (tabela, jogos, elenco, etc.) agora
exigem sessão válida **e** `planStatus: "active"` — sem isso, voltam
`401` (sem login) ou `402` (login ok, pagamento pendente). Só ficam de
fora dessa exigência: `/api/health`, as próprias rotas de `/api/auth/*`,
`/api/support/plans`, `/api/support/webhook` e `/api/support/status`
(precisam funcionar antes/sem sessão).

## O que NÃO está implementado (próximos passos)

- **"Esqueci minha senha"**: exigiria enviar e-mail (provedor SMTP/
  Resend/etc. — nenhum está configurado hoje). Por enquanto, recuperar
  o acesso de uma conta cuja senha foi perdida exigiria intervenção
  manual (mexer direto em `server/data/users.json`).
- **Verificação de e-mail**: qualquer e-mail é aceito no cadastro sem
  confirmação.
- **Anúncios no plano Freemium**: hoje o Freemium libera exatamente o
  mesmo que o Lite, sem anúncio nenhum — é um recurso planejado, não
  implementado ainda.
- **Gating de recursos por plano**: Lite/Pro/Enterprise têm descrições
  diferentes (histórico de temporadas, odds ao vivo), mas o backend
  ainda não trava tecnicamente esses recursos por plano — todo usuário
  logado com plano ativo, seja qual for, tem acesso a tudo que a API
  já expõe hoje. Fazer o gating por recurso é um próximo passo natural
  quando quiser cobrar de verdade pela diferença entre os planos.
