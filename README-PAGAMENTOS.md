# "Apoie o BR Data" — planos e pagamento (Mercado Pago)

Área de apoio/monetização do site: 3 planos (Lite, Pro, Enterprise),
cadastro simples (nome/telefone/e-mail) e pagamento por **cartão ou
PIX** via [Mercado Pago](https://www.mercadopago.com.br/) — pagamento
único (sem cobrança recorrente).

Botão de entrada: "★ Seja Premium" (sidebar, card do Dashboard e menu
"Mais" no mobile) → página **Apoie o BR Data**.

---

## Como funciona (visão geral)

1. Usuário escolhe um plano e preenche o formulário na página **Apoie
   o BR Data**.
2. O front-end chama `POST /api/support/checkout` no nosso backend.
3. O backend valida os dados, **decide o preço a partir do arquivo
   `server/src/supportPlans.js`** (nunca confia em preço vindo do
   navegador) e cria uma *preference* no Mercado Pago.
4. O usuário é redirecionado pra uma página **hospedada pelo Mercado
   Pago** (Checkout Pro), onde escolhe cartão ou PIX. Os dados do
   cartão nunca passam pelo nosso servidor — fora do escopo de
   PCI-DSS.
5. O Mercado Pago chama nosso `POST /api/support/webhook` quando o
   pagamento muda de status, e traz o usuário de volta pro site.
6. O status mostrado ao usuário sempre vem de uma consulta nossa à API
   do Mercado Pago (nunca do conteúdo bruto do webhook, que poderia
   ser forjado) — ver `GET /api/support/status?ref=...`.

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

Sem `MERCADOPAGO_ACCESS_TOKEN`, a página continua abrindo normal (planos
aparecem), mas o botão de pagamento retorna erro — o resto do site
não é afetado.

## 2. Os planos

Título, descrição e lista de recursos ficam em
`server/src/supportPlans.js` — é a **única fonte de verdade do
preço** (o front-end só exibe o que vem de `GET /api/support/plans`).

O **preço** de cada plano dá pra ajustar sem editar código: defina
`PLAN_LITE_PRICE`, `PLAN_PRO_PRICE` e/ou `PLAN_ENTERPRISE_PRICE` no
Railway/host (ver `server/.env.example`) e reinicie o serviço. Sem
essas variáveis, usa os valores padrão abaixo.

| Plano | Preço (padrão) | Descrição |
|---|---|---|
| Lite | R$ 5,99 | Acesso aos campeonatos atuais |
| Pro | R$ 14,99 | Acesso a todo o histórico de campeonatos |
| Enterprise | R$ 29,99 | Histórico completo + análise de odds ao vivo |

> Hoje os planos **não liberam automaticamente** nenhum recurso
> exclusivo no site — o pagamento é registrado e confirmado, mas
> ainda não existe um sistema de contas/login pra sujeitar features a
> um plano pago. Ver seção 5 (Próximos passos).

## 3. Onde ficam os cadastros

Cada cadastro (nome, telefone, e-mail, plano, status do pagamento) é
salvo em `server/data/support-leads.json`.

**Atenção — armazenamento local, não é um banco de verdade:** em hosts
com sistema de arquivos efêmero (Railway, por padrão, sem um Volume
anexado ao serviço), esse arquivo **é apagado a cada novo deploy**. Pra
não perder cadastros de pagamentos reais:

- Anexe um [Volume no
  Railway](https://docs.railway.com/reference/volumes) apontando pra
  pasta `server/data` do serviço, **ou**
- Evolua `server/src/supportLeads.js` pra gravar em algum lugar
  persistente (planilha, banco de dados, e-mail de notificação) —
  ele já centraliza toda a leitura/escrita, então dá pra trocar só
  esse arquivo.

O arquivo nunca é commitado (está no `.gitignore` — tem dado pessoal).

## 4. Endpoints

| Rota | O que faz |
|---|---|
| `GET /api/support/plans` | lista os 3 planos (preço vem do backend) |
| `POST /api/support/checkout` | `{name, phone, email, plan}` → cria o cadastro + a preference no Mercado Pago, devolve `{checkoutUrl, ref}` |
| `POST /api/support/webhook` | recebido pelo Mercado Pago quando um pagamento muda de status |
| `GET /api/support/status?ref=` | status atual de um cadastro (usado pela página de retorno do checkout) |

## 5. Próximos passos (não implementado ainda)

- **Liberar acesso de verdade por plano**: hoje não existe login de
  usuário no site — o pagamento fica registrado, mas nada no site
  verifica "esse visitante pagou o plano Pro" antes de mostrar
  histórico/odds ao vivo. Pra isso valer a pena de verdade, precisa de
  autenticação (mesmo que simples, por e-mail/link mágico) ligada ao
  registro do pagamento.
- **Assinatura recorrente**: os planos hoje são pagamento único. Se no
  futuro quiser cobrança mensal automática, o Mercado Pago tem uma API
  de assinaturas (`preapproval`) diferente da usada aqui (Checkout
  Pro) — é uma integração à parte.
- **E-mail de confirmação**: hoje a confirmação só aparece na tela de
  retorno do checkout. Enviar um e-mail (recibo/boas-vindas) exigiria
  configurar um provedor de e-mail (SMTP, Resend, etc.).
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
