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

// Quantas sessões ainda válidas (não expiradas) existem agora — só
// usado pelo endpoint de admin protegido por ADMIN_SECRET (ver
// server.js), como um número rápido de "quantos logins ativos".
function countActive() {
  const now = Date.now();
  let n = 0;
  for (const s of store.values()) if (s.expiresAt > now) n++;
  return n;
}

module.exports = { createSession, getSession, destroySession, countActive, SESSION_TTL_MS };
