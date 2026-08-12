/* Contas de usuário da área "Apoie o BR Data" — cadastro, senha
   (hash com scrypt nativo do Node, sem dependência externa) e o
   estado do plano de cada um. Persistido num arquivo JSON simples em
   disco, no mesmo espírito "zero dependências" do resto do backend.

   ATENÇÃO — igual ao antigo supportLeads.js: em host com sistema de
   arquivos efêmero (Railway sem Volume anexado), esse arquivo é
   apagado a cada novo deploy — e dessa vez isso significa PERDER
   CONTAS DE USUÁRIO (login parando de funcionar pra todo mundo), não
   só um lead. Anexe um Volume no Railway apontando pra pasta
   `server/data` antes de usar isso com usuários de verdade — ver
   README-LOGIN.md. */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { promisify } = require("util");

const scryptAsync = promisify(crypto.scrypt);

const DATA_DIR = path.join(__dirname, "..", "data");
const FILE = path.join(DATA_DIR, "users.json");

let store = new Map(); // id -> user record

function load() {
  try {
    if (fs.existsSync(FILE)) {
      const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
      store = new Map(Object.entries(raw));
    }
  } catch (err) {
    console.error("[users] falha ao carregar arquivo local:", err.message);
  }
}

function persist() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(Object.fromEntries(store), null, 2));
  } catch (err) {
    console.error("[users] falha ao salvar arquivo local:", err.message);
  }
}

load();

async function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scryptAsync(plain, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

// Hash fixo (nunca corresponde a senha nenhuma) usado só pra gastar o
// mesmo tempo de CPU quando o e-mail não existe — evita que o tempo de
// resposta do login denuncie "esse e-mail existe" / "não existe".
const DUMMY_HASH = "0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000:0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

async function verifyPassword(plain, stored) {
  const [salt, hashHex] = String(stored || DUMMY_HASH).split(":");
  if (!salt || !hashHex) return false;
  const derived = await scryptAsync(plain, salt, 64);
  const storedBuf = Buffer.from(hashHex, "hex");
  if (storedBuf.length !== derived.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function findByEmail(email) {
  const norm = normalizeEmail(email);
  for (const u of store.values()) if (u.email === norm) return u;
  return null;
}

function findById(id) {
  return store.get(id) || null;
}

// id imprevisível de propósito (usado como external_reference público
// do Mercado Pago e em GET /api/support/status, chamado ainda sem
// login) — nada de timestamp+contador sequencial aqui.
function newUserId() {
  return `usr_${crypto.randomBytes(12).toString("hex")}`;
}

async function createUser({ name, email, phone, password, plan, planStatus }) {
  const passwordHash = await hashPassword(password);
  const rec = {
    id: newUserId(),
    name, email: normalizeEmail(email), phone,
    passwordHash,
    plan, planStatus,       // planStatus: "active" | "pending_payment" | "checkout_error"
    pendingPlan: null,      // setado quando um usuário ATIVO troca de plano (upgrade) — só vira `plan` quando o pagamento confirma, pra não perder acesso no meio da troca
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  store.set(rec.id, rec);
  persist();
  return rec;
}

function updateUser(id, patch) {
  const u = store.get(id);
  if (!u) return null;
  Object.assign(u, patch, { updatedAt: Date.now() });
  persist();
  return u;
}

// Campos seguros pra devolver ao front-end — nunca o passwordHash.
function publicUser(u) {
  if (!u) return null;
  return { id: u.id, name: u.name, email: u.email, plan: u.plan, planStatus: u.planStatus, pendingPlan: u.pendingPlan || null };
}

module.exports = {
  createUser, updateUser, findByEmail, findById, publicUser,
  hashPassword, verifyPassword, normalizeEmail,
};
