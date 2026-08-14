/* Log de eventos de analytics de PRODUTO (funil de login + páginas
   mais navegadas) — pedido do usuário: entender comportamento do
   cliente, % que passa do login, páginas mais navegadas. Alimenta
   /admin > Comportamento (GET /api/adminpanel/analytics). Ver POST
   /api/track em server.js pra como cada evento chega aqui, e
   trackEvent() em public/js/app.js pro lado do cliente que dispara.

   Tipos de evento aceitos (whitelist — qualquer outro é ignorado
   silenciosamente, ver recordEvent):
     gate_shown    — visitante SEM sessão válida viu a tela de
       login/cadastro (startAuthFlow em app.js). É o denominador do
       funil "% que passa do login".
     login_success — login concluído com sucesso, entrou no app de
       verdade (mesmo se a conta acabou de ser criada segundos antes
       — cadastro sozinho não solta na aplicação, sempre passa por
       login depois, ver submitGateLogin em app.js). Numerador do
       funil.
     page_view     — troca de página dentro do app (setActivePage em
       app.js), toda vez, incluindo a 1ª renderização (dashboard)
       depois do login/boot.

   MESMO AVISO de paymentsLedger.js: em host com sistema de arquivos
   efêmero (Railway sem Volume anexado), esse arquivo é apagado a
   cada novo deploy — perde o HISTÓRICO de comportamento (nada mais
   se perde, é só esse log). Tamanho limitado (EVENT_CAP) pra nunca
   crescer sem limite num site com bastante tráfego — quando estoura,
   descarta os eventos MAIS ANTIGOS primeiro (fila, não amostra
   aleatória), então "páginas mais navegadas" sempre reflete o
   período mais recente disponível, nunca uma mistura aleatória de
   datas diferentes. */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const FILE = path.join(DATA_DIR, "analytics.json");
const EVENT_CAP = 20000;

let events = [];

function load() {
  try {
    if (fs.existsSync(FILE)) events = JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch (err) {
    console.error("[analytics] falha ao carregar arquivo local:", err.message);
  }
}

function persist() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(events));
  } catch (err) {
    console.error("[analytics] falha ao salvar arquivo local:", err.message);
  }
}

load();

const VALID_TYPES = new Set(["gate_shown", "login_success", "page_view"]);
// Mesma lista de PAGES do front-end (ver app.js) — mantida em duplicata
// de propósito (esse módulo não importa nada do front-end); qualquer
// página nova precisa ser adicionada aqui também, senão os eventos
// dela são descartados silenciosamente.
const VALID_PAGES = new Set([
  "dashboard", "jogos", "tabela", "estatisticas", "simulador",
  "favoritos", "noticias", "apoie", "time", "jogador", "mais",
]);

// Nunca lança — evento inválido/malformado só é ignorado (é um
// beacon best-effort disparado pelo cliente, não tem quem tratar erro
// do outro lado).
function recordEvent({ type, page, userId }) {
  if (!VALID_TYPES.has(type)) return false;
  if (type === "page_view" && !VALID_PAGES.has(page)) return false;
  events.push({ type, page: type === "page_view" ? page : null, userId: userId || null, at: Date.now() });
  if (events.length > EVENT_CAP) events.splice(0, events.length - EVENT_CAP);
  persist();
  return true;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function countSince(type, sinceMs) {
  const cutoff = sinceMs ? Date.now() - sinceMs : 0;
  let n = 0;
  for (const e of events) if (e.type === type && e.at >= cutoff) n++;
  return n;
}

// Funil "% que passa do login" em 3 janelas (últimos 7 dias, últimos
// 30 dias, desde sempre — desde que esse recurso entrou no ar, sem
// histórico anterior). conversionPct null quando gateShown é 0 (sem
// base pra calcular % nenhuma, melhor não mostrar 0% que parece "todo
// mundo desistiu" quando na real é só "sem visita nenhuma ainda").
function funnel() {
  const windows = { last7d: 7 * DAY_MS, last30d: 30 * DAY_MS, allTime: null };
  const out = {};
  Object.entries(windows).forEach(([key, ms]) => {
    const gateShown = countSince("gate_shown", ms);
    const loginSuccess = countSince("login_success", ms);
    out[key] = {
      gateShown, loginSuccess,
      conversionPct: gateShown ? Math.round((loginSuccess / gateShown) * 1000) / 10 : null,
    };
  });
  return out;
}

// Páginas mais navegadas, ordenado desc — sinceMs null = desde sempre.
function pageViews(sinceMs) {
  const cutoff = sinceMs ? Date.now() - sinceMs : 0;
  const counts = {};
  events.forEach((e) => {
    if (e.type !== "page_view" || e.at < cutoff) return;
    counts[e.page] = (counts[e.page] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([page, count]) => ({ page, count }));
}

module.exports = { recordEvent, funnel, pageViews };
