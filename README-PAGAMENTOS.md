# Planos e pagamento (Mercado Pago)

Pagamento por **cartão ou PIX** via [Mercado Pago](https://www.mercadopago.com.br/)
dos planos pagos (Lite, Pro, Enterprise) — pagamento único, sem
cobrança recorrente.

> Desde a versão com login obrigatório, o pagamento faz parte do fluxo
> de **cadastro** (`POST /api/auth/signup`) e de **upgrade de plano**
> pra quem já tem conta (`POST /api/support/checkout`, autenticado). O
> passo a passo completo do fluxo de conta/login está em
> **`README-LOGIN.md`** — este arquivo foca só na parte de pagamento em
> si (como ativar o Mercado Pago, como os preços são decididos, os
> endpoints envolvidos).

---

## Como funciona (visão geral)

1. No cadastro (`POST /api/auth/signup`) ou no upgrade de plano já
   logado (`POST /api/support/checkout`), o backend **decide o preço a
   partir do arquivo `server/src/supportPlans.js`** (nunca confia em
   preço vindo do navegador) e cria uma *preference* no Mercado Pago.
2. O usuário é redirecionado pra uma página **hospedada pelo Mercado
   Pago** (Checkout Pro), onde escolhe cartão ou PIX. Os dados do
   cartão nunca passam pelo nosso servidor — fora do escopo de
   PCI-DSS.
3. O Mercado Pago chama nosso `POST /api/support/webhook` quando o
   pagamento muda de status, e traz o usuário de volta pro site.
4. O status mostrado ao usuário sempre vem de uma consulta nossa à API
   do Mercado Pago (nunca do conteúdo bruto do webhook, que poderia
   ser forjado) — ver `GET /api/support/status?ref=...`.
5. Só depois disso o usuário faz login — ver `README-LOGIN.md`.

## 1. Como ativar

1. Crie uma conta em **mercadopago.com.br** (ou já use a que você tem).
2. Crie uma aplicação no [painel de
   desenvolvedores](https://www.mercadopago.com.br/developers/panel).
3. Copie o **Access Token de produção** (não o de teste — teste não
   processa pagamento de verdade) pra `MERCADOPAGO_ACCESS_TOKEN` no
   `.env` (local) ou nas variáveis de ambiente do seu host (Railway
   etc.).
4. (Opcional, recomendado) Configure um webhook em Webhooks → URL:
   `https://SEU-DOMINIO/api/support/webhook`, evento `payment`. Não é
   estritamente necessário — sem webhook, o status só é confirmado
   quando a página de retorno consulta `GET /api/support/status` — mas
   deixa a confirmação mais rápida, especialmente pro PIX.
5. Reinicie/faça o deploy do servidor.

Sem `MERCADOPAGO_ACCESS_TOKEN`, o cadastro com plano **Freemium**
continua funcionando normalmente (é grátis, não passa pelo Mercado
Pago). Cadastro com plano pago cria a conta, mas fica com o pagamento
pendente — o usuário consegue tentar de novo depois de fazer login.

## 2. Os planos

Título, descrição e lista de recursos ficam em
`server/src/supportPlans.js` — é a **única fonte de verdade do
preço** (o front-end só exibe o que vem de `GET /api/support/plans`).

O **preço** de cada plano pago dá pra ajustar sem editar código: defina
`PLAN_LITE_PRICE`, `PLAN_PRO_PRICE` e/ou `PLAN_ENTERPRISE_PRICE` no
Railway/host (ver `server/.env.example`) e reinicie o serviço. Sem
essas variáveis, usa os valores padrão abaixo.

| Plano | Preço (padrão) | Descrição |
|---|---|---|
| Freemium | Grátis | Mesmo acesso do Lite (sem anúncios ainda — planejado) |
| Lite | R$ 5,99 | Acesso aos campeonatos atuais |
| Pro | R$ 14,99 | Acesso a todo o histórico de campeonatos |
| Enterprise | R$ 29,99 | Histórico completo + análise de odds ao vivo |

> O gating técnico de recursos por plano (ex.: só Pro/Enterprise verem
> histórico de temporadas) ainda não está implementado — ver
> `README-LOGIN.md`, seção "O que NÃO está implementado".

## 3. Endpoints

| Rota | O que faz |
|---|---|
| `GET /api/support/plans` | lista os planos (preço vem do backend) — pública, usada na tela de cadastro |
| `POST /api/auth/signup` | cria a conta; se o plano escolhido for pago, já devolve `checkoutUrl` do Mercado Pago (ver `README-LOGIN.md`) |
| `POST /api/support/checkout` | **autenticado** — retoma um pagamento pendente do próprio cadastro, ou inicia upgrade de plano |
| `POST /api/support/webhook` | recebido pelo Mercado Pago quando um pagamento muda de status |
| `GET /api/support/status?ref=` | status atual de um pagamento (usado pela tela de retorno do checkout, ainda sem sessão) |

## 4. Próximos passos (não implementado ainda)

- **Assinatura recorrente**: os planos hoje são pagamento único. Se no
  futuro quiser cobrança mensal automática, o Mercado Pago tem uma API
  de assinaturas (`preapproval`) diferente da usada aqui (Checkout
  Pro) — é uma integração à parte.
- **E-mail de confirmação**: hoje a confirmação só aparece na tela de
  retorno do checkout. Enviar um e-mail (recibo/boas-vindas) exigiria
  configurar um provedor de e-mail (SMTP, Resend, etc.) — o mesmo que
  resolveria o "esqueci minha senha" do login, ver `README-LOGIN.md`.
- **Assinatura do webhook**: `/api/support/webhook` aceita a
  notificação e usa o `id` do pagamento nela pra ir buscar o status
  real na API do Mercado Pago (autenticado com nosso token) — isso já
  evita que alguém forje um "pagamento aprovado" fake, porque o status
  usado é sempre o que o Mercado Pago responde pra aquele id, nunca o
  conteúdo bruto da notificação. O que **não** está implementado é a
  verificação da assinatura HMAC do cabeçalho `x-signature` (uma
  camada extra que evitaria até chamadas de teste/spam nesse
  endpoint) — ver documentação do Mercado Pago sobre "Validar origem
  das notificações" se quiser adicionar isso depois.
