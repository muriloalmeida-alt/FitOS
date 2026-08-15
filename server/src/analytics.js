/* Log de eventos de analytics de PRODUTO (funil de cadastro + páginas
   mais navegadas) — pedido do usuário: entender comportamento do
   cliente, % que vira cliente, páginas mais navegadas. Alimenta
   /admin > Comportamento (GET /api/adminpanel/analytics). Ver POST
   /api/track em server.js pra como cada evento chega aqui, e
   trackEvent() em public/js/app.js pro lado do cliente que dispara.

   AJUSTE (Fase 5, "Freemium sem login", 15/08/2026): antes da mudança
   de produto que abriu o app pra visitante sem conta, gate_shown
   disparava pra TODO visitante sem sessão, sempre — era literalmente
   "quantas visitas o site teve". Hoje (ver requireLogin/
   requireLoginWithPlan em app.js) o gate só aparece SOB DEMANDA,
   quando o próprio visitante tenta algo que precisa de conta
   (favoritar time só até a Fase 4 — hoje funciona sem conta —,
   assinar um plano, etc.). Ou seja, gate_shown deixou de ser
   "visitou o site" e virou "topou fazer alguma coisa que pede conta"
   — sinal de intenção, não de alcance. Por isso o funil abaixo mudou
   de "% que passa do login" (login_success, que mistura cadastro novo
   com gente só voltando a entrar) pra "% que vira CADASTRO NOVO"
   (signup_success) — é a pergunta de crescimento de verdade por trás
   da mudança "Freemium sem login": visitante virou cliente, ou não?
   login_success continua registrado (é útil saber quantos logins
   acontecem no total, novos + retornando), só não é mais o numerador
   do funil de conversão.

   Tipos de evento aceitos (whitelist — qualquer outro é ignorado
   silenciosamente, ver recordEvent):
     gate_shown     — visitante viu a tela de login/cadastro depois de
       tentar algo que precisa de conta (SOB DEMANDA — ver AJUSTE
       acima). Denominador do funil "visitante → cadastrou".
     signup_success — conta criada com sucesso (POST /api/auth/signup
       respondeu ok — ver submitGateSignup em app.js), independente de
       o plano escolhido ter pagamento pendente ou não. Numerador do
       funil "visitante → cadastrou" — é o sinal de crescimento real.
     login_success  — login concluído com sucesso, entrou no app de
       verdade (inclui login logo depois de um cadastro novo — todo
       cadastro sempre passa por login em seguida, ver submitGateLogin
       em app.js — e também quem só está voltando numa conta já
       existente). Reportado à parte, não é mais o numerador do funil
       (ver AJUSTE acima).
     page_view      — troca de página dentro do app (setActivePage em
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

const VALID_TYPES = new Set(["gate_shown", "signup_success", "login_success", "page_view"]);
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

// Funil "visitante → cadastrou" em 3 janelas (últimos 7 dias, últimos
// 30 dias, desde sempre — desde que esse recurso entrou no ar, sem
// histórico anterior). conversionPct null quando gateShown é 0 (sem
// base pra calcular % nenhuma, melhor não mostrar 0% que parece "todo
// mundo desistiu" quando na real é só "sem ninguém precisando de
// conta ainda"). Ver AJUSTE (Fase 5) no topo do arquivo: numerador
// passou de loginSuccess (mistura cadastro novo com quem só voltou a
// entrar) pra signupSuccess (cadastro novo de verdade) — loginSuccess
// continua no retorno, só não entra mais na conta do %.
function funnel() {
  const windows = { last7d: 7 * DAY_MS, last30d: 30 * DAY_MS, allTime: null };
  const out = {};
  Object.entries(windows).forEach(([key, ms]) => {
    const gateShown = countSince("gate_shown", ms);
    const signupSuccess = countSince("signup_success", ms);
    const loginSuccess = countSince("login_success", ms);
    out[key] = {
      gateShown, signupSuccess, loginSuccess,
      conversionPct: gateShown ? Math.round((signupSuccess / gateShown) * 1000) / 10 : null,
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
