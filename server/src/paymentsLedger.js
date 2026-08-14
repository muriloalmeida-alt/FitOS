/* Histórico (append-only) de pagamentos APROVADOS via Mercado Pago —
   só existe pra alimentar a seção "Receita" da área administrativa
   (/admin). Guardado à parte de users.js de propósito: um usuário só
   guarda o ESTADO atual do plano dele (plan/planStatus/paymentId mais
   recente) — sem um registro separado por pagamento não dava pra
   responder "quanto entrou esse mês" nem listar os pagamentos um a
   um, só o status "ativo" de cada conta.

   Preenchido de dentro do webhook do Mercado Pago (POST
   /api/support/webhook, ver server.js), sempre que um pagamento vem
   com status "approved" — nunca por nenhuma outra rota, pro mesmo
   motivo de sempre: a verdade sobre pagamento só vem de uma consulta
   nossa autenticada pra API do Mercado Pago, nunca do que o front-end
   manda.

   MESMO AVISO de users.js/sessions.js: em host com sistema de
   arquivos efêmero (Railway sem Volume anexado), esse arquivo é
   apagado a cada novo deploy — perde o HISTÓRICO de receita (o estado
   atual de cada conta em si não se perde, esse é o users.json). Anexe
   um Volume no Railway apontando pra pasta `server/data` antes de
   usar isso pra acompanhar receita de verdade — ver README-LOGIN.md. */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const FILE = path.join(DATA_DIR, "payments.json");

let entries = [];

function load() {
  try {
    if (fs.existsSync(FILE)) entries = JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch (err) {
    console.error("[paymentsLedger] falha ao carregar arquivo local:", err.message);
  }
}

function persist() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(entries, null, 2));
  } catch (err) {
    console.error("[paymentsLedger] falha ao salvar arquivo local:", err.message);
  }
}

load();

// Idempotente por paymentId — o Mercado Pago pode chamar o webhook
// mais de uma vez pro MESMO pagamento (reenvio por timeout de
// resposta, notificação duplicada etc.); sem essa checagem a receita
// contaria em dobro (ou mais) toda vez que isso acontecesse.
function recordIfNew({ paymentId, userId, email, plan, amount, currency, method, approvedAt }) {
  const idStr = String(paymentId);
  if (entries.some((e) => e.paymentId === idStr)) return false;
  entries.push({
    paymentId: idStr,
    userId, email, plan,
    amount: Number(amount) || 0,
    currency: currency || "BRL",
    method: method || null,
    approvedAt: approvedAt || Date.now(),
    recordedAt: Date.now(),
  });
  persist();
  return true;
}

function listAll() {
  return [...entries].sort((a, b) => b.approvedAt - a.approvedAt);
}

// Resumo pro topo da seção "Receita" — total histórico + total do mês
// corrente (calendário, não "últimos 30 dias") + soma por plano.
function summary() {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  let totalAllTime = 0, countAllTime = 0, totalThisMonth = 0, countThisMonth = 0;
  const byPlan = {};
  entries.forEach((e) => {
    totalAllTime += e.amount;
    countAllTime++;
    byPlan[e.plan] = (byPlan[e.plan] || 0) + e.amount;
    const d = new Date(e.approvedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (key === monthKey) { totalThisMonth += e.amount; countThisMonth++; }
  });
  return { totalAllTime, countAllTime, totalThisMonth, countThisMonth, byPlan, currency: "BRL" };
}

module.exports = { recordIfNew, listAll, summary };
