/* Cliente fino para a API do Mercado Pago (Checkout Pro).
   Documentação: https://www.mercadopago.com.br/developers/pt/reference

   Fluxo usado aqui (Checkout Pro — pagamento único, sem assinatura):
   1) Criamos uma "preference" (server -> Mercado Pago) com o item
      (plano escolhido) e os dados do pagador.
   2) Redirecionamos o usuário pro "init_point" da preference — uma
      página hospedada PELO MERCADO PAGO, que já mostra as opções de
      cartão e PIX. O número do cartão nunca passa pelo nosso servidor
      (fora do escopo de PCI-DSS).
   3) O Mercado Pago chama nosso webhook (notification_url) quando o
      status do pagamento muda, e redireciona o navegador do usuário
      de volta pro site (back_urls).

   Autenticação: header "Authorization: Bearer {ACCESS_TOKEN}". */

const BASE_URL = "https://api.mercadopago.com";

function getAccessToken() {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    const err = new Error("MERCADOPAGO_ACCESS_TOKEN não configurada no servidor");
    err.code = "NO_MP_TOKEN";
    throw err;
  }
  return token;
}

async function mpFetch(path, options = {}) {
  const token = getAccessToken();
  const res = await fetch(BASE_URL + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = body?.message || body?.error || `Mercado Pago respondeu ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.mpBody = body;
    throw err;
  }
  return body;
}

// Quebra um telefone brasileiro digitado livremente (com ou sem DDD,
// parênteses, espaços, traço) em { area_code, number } — best-effort,
// o Mercado Pago não valida rigidamente esse campo.
function splitPhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length >= 10) {
    return { area_code: digits.slice(0, 2), number: digits.slice(2) };
  }
  return { area_code: "", number: digits };
}

// Cria uma preference (pagamento único) e devolve { id, init_point }.
// `plan` = { id, title, price } — preço SEMPRE decidido pelo backend
// (server/src/supportPlans.js), nunca confiar em valor vindo do
// front-end.
async function createPreference({ plan, name, email, phone, externalReference, backUrl, notificationUrl }) {
  const payload = {
    items: [
      {
        id: plan.id,
        title: `BR Data — Plano ${plan.title}`,
        description: plan.description,
        quantity: 1,
        currency_id: "BRL",
        unit_price: plan.price,
      },
    ],
    payer: {
      name,
      email,
      phone: splitPhone(phone),
    },
    external_reference: externalReference,
    back_urls: {
      success: backUrl,
      failure: backUrl,
      pending: backUrl,
    },
    auto_return: "approved",
    notification_url: notificationUrl,
    statement_descriptor: "BRDATA",
  };
  return mpFetch("/checkout/preferences", { method: "POST", body: JSON.stringify(payload) });
}

// Busca um pagamento pelo id — é essa chamada (autenticada com nosso
// próprio access token) que decide o status de verdade, nunca o
// conteúdo bruto da notificação do webhook (que pode ser forjado).
async function getPayment(paymentId) {
  return mpFetch(`/v1/payments/${paymentId}`, { method: "GET" });
}

module.exports = { createPreference, getPayment };
