/* Histórico (append-only) de EVENTOS de pagamento via Mercado Pago —
   alimenta a seção "Receita" da área administrativa (/admin). Guardado
   à parte de users.js de propósito: um usuário só guarda o ESTADO
   ATUAL do plano dele (plan/planStatus/paymentId mais recente) — sem
   um registro separado por evento não dava pra responder "quanto
   entrou esse mês", nem entender recusa/cancelamento/abandono, só o
   status "ativo ou não" de cada conta.

   AJUSTE (14/08/2026): antes só gravava pagamento APROVADO — pedido
   do usuário pra entender também recusas, cancelamentos e abandonos
   fez isso virar um log de QUALQUER status que o Mercado Pago mandar
   (approved/rejected/cancelled/pending/in_process/refunded/
   charged_back...), com o motivo da recusa (status_detail) quando
   tiver. "Abandono" (quem nem chegou a tentar pagar — fechou a aba
   antes de preencher cartão/gerar PIX) não aparece aqui: o Mercado
   Pago nunca notifica isso, porque nenhum pagamento chegou a ser
   criado do lado deles. Esse caso é inferido direto de users.js (ver
   GET /api/adminpanel/revenue em server.js — conta não-freemium,
   planStatus != active, e paymentId nunca foi setado = teve link de
   checkout criado mas nunca tentou pagar).

   Entradas ANTIGAS (gravadas antes desse ajuste) não têm "status" nem
   "statusDetail" — sempre foram só pagamento aprovado (era o único
   caso gravado), então em todo lugar que lê o campo "status" daqui
   tratamos undefined/null como "approved" pra não perder/reclassificar
   dado histórico sem querer (ver EFFECTIVE_STATUS abaixo).

   Preenchido de dentro do webhook do Mercado Pago (POST
   /api/support/webhook, ver server.js) — nunca por nenhuma outra
   rota, pro mesmo motivo de sempre: a verdade sobre pagamento só vem
   de uma consulta nossa autenticada pra API do Mercado Pago, nunca do
   que o front-end manda.

   MESMO AVISO de users.js/sessions.js: em host com sistema de
   arquivos efêmero (Railway sem Volume anexado), esse arquivo é
   apagado a cada novo deploy — perde o HISTÓRICO de receita/funil (o
   estado atual de cada conta em si não se perde, esse é o
   users.json). Anexe um Volume no Railway apontando pra pasta
   `server/data` antes de usar isso pra acompanhar receita de verdade
   — ver README-LOGIN.md. */

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

function effectiveStatus(e) {
  return e.status || "approved"; // entrada antiga (pré-funil) -- ver AJUSTE no topo
}
function eventTime(e) {
  return e.eventAt || e.approvedAt || e.recordedAt; // approvedAt = nome antigo do campo, antes do AJUSTE
}

// Idempotente por (paymentId + status) — o Mercado Pago pode chamar o
// webhook mais de uma vez pro MESMO evento (reenvio por timeout de
// resposta, notificação duplicada etc.); sem essa checagem a receita
// (ou a contagem de recusas) contaria em dobro. Por outro lado, o
// MESMO paymentId pode passar por VÁRIOS status ao longo da vida dele
// (pending -> approved, ou pending -> rejected) — cada transição gera
// uma entrada nova de propósito, é exatamente o que dá pra entender o
// funil depois.
function recordIfNew({ paymentId, status, statusDetail, userId, email, plan, amount, currency, method, eventAt }) {
  const idStr = String(paymentId);
  const st = status || "approved";
  if (entries.some((e) => String(e.paymentId) === idStr && effectiveStatus(e) === st)) return false;
  entries.push({
    paymentId: idStr,
    status: st,
    statusDetail: statusDetail || null,
    userId, email, plan,
    amount: Number(amount) || 0,
    currency: currency || "BRL",
    method: method || null,
    eventAt: eventAt || Date.now(),
    recordedAt: Date.now(),
  });
  persist();
  return true;
}

function listAll() {
  return [...entries].sort((a, b) => eventTime(b) - eventTime(a));
}

function listByStatus(status) {
  return listAll().filter((e) => effectiveStatus(e) === status);
}

// Resumo pro topo da seção "Receita": total histórico + total do mês
// corrente (calendário, não "últimos 30 dias") + soma por plano — só
// de pagamento REALMENTE aprovado. "byStatus" e "rejectionReasons"
// cobrem o funil inteiro (todo status, todo motivo de recusa já visto).
function summary() {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  let totalAllTime = 0, countAllTime = 0, totalThisMonth = 0, countThisMonth = 0;
  const byPlan = {};
  const byStatus = {};
  const rejectionReasons = {};
  entries.forEach((e) => {
    const st = effectiveStatus(e);
    byStatus[st] = (byStatus[st] || 0) + 1;
    if (st === "rejected" && e.statusDetail) rejectionReasons[e.statusDetail] = (rejectionReasons[e.statusDetail] || 0) + 1;
    if (st !== "approved") return;
    totalAllTime += e.amount;
    countAllTime++;
    byPlan[e.plan] = (byPlan[e.plan] || 0) + e.amount;
    const d = new Date(eventTime(e));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (key === monthKey) { totalThisMonth += e.amount; countThisMonth++; }
  });
  return { totalAllTime, countAllTime, totalThisMonth, countThisMonth, byPlan, byStatus, rejectionReasons, currency: "BRL" };
}

module.exports = { recordIfNew, listAll, listByStatus, summary };
