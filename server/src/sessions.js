/* Sessões de login — token opaco (cookie httpOnly) -> id do usuário.
   Persistido em disco pelo mesmo motivo que users.js: sem isso, todo
   mundo seria deslogado a cada restart/deploy do servidor. */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "..", "data");
const FILE = path.join(DATA_DIR, "sessions.json");
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

let store = new Map(); // token -> { userId, createdAt, expiresAt }

function load() {
  try {
    if (fs.existsSync(FILE)) {
      const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
      store = new Map(Object.entries(raw));
    }
  } catch (err) {
    console.error("[sessions] falha ao carregar arquivo local:", err.message);
  }
}

function persist() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(Object.fromEntries(store), null, 2));
  } catch (err) {
    console.error("[sessions] falha ao salvar arquivo local:", err.message);
  }
}

load();

function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  store.set(token, { userId, createdAt: Date.now(), expiresAt: Date.now() + SESSION_TTL_MS });
  persist();
  return token;
}

function getSession(token) {
  if (!token) return null;
  const s = store.get(token);
  if (!s) return null;
  if (Date.now() > s.expiresAt) { store.delete(token); persist(); return null; }
  return s;
}

function destroySession(token) {
  if (token && store.delete(token)) persist();
}

// Derruba TODAS as sessões ativas de UM usuário — usado pela área
// administrativa (botão "Forçar logout" em /admin) pra kickar alguém
// na hora (ex.: suspeita de conta comprometida, ou só forçar um
// re-login depois de mudar o plano manualmente). O Map não tem índice
// por userId (só por token), então precisa varrer tudo — sem
// problema, o volume de sessões desse app não justifica um índice
// separado só pra isso.
function destroyAllForUser(userId) {
  let n = 0;
  for (const [token, s] of store.entries()) {
    if (s.userId === userId) { store.delete(token); n++; }
  }
  if (n) persist();
  return n;
}

// Quantas sessões ainda válidas (não expiradas) existem agora — só
// usado pelo endpoint de admin protegido por ADMIN_SECRET (ver
// server.js), como um número rápido de "quantos logins ativos".
function countActive() {
  const now = Date.now();
  let n = 0;
  for (const s of store.values()) if (s.expiresAt > now) n++;
  return n;
}

// Conta ativa por usuário (por linha na tabela de usuários em /admin)
// — mesma ideia de countActive, mas por userId em vez do total geral.
function countActiveByUser() {
  const now = Date.now();
  const out = {};
  for (const s of store.values()) {
    if (s.expiresAt > now) out[s.userId] = (out[s.userId] || 0) + 1;
  }
  return out;
}

module.exports = { createSession, getSession, destroySession, destroyAllForUser, countActive, countActiveByUser, SESSION_TTL_MS };
