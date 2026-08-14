/* Contas de usuário da área "Assine o BR Data" — cadastro, senha
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
    favoriteClubs: {},      // clube favorito (card em destaque no Dashboard), por competição — { [competitionId]: teamId | null } — ver setFavoriteClub
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

// Clube favorito é vinculado à CONTA (não ao navegador) — grava sempre
// uma entrada explícita pra essa competição, mesmo quando o usuário
// remove o favorito (teamId null), em vez de apagar a chave. Isso
// importa pro front-end: ele usa "a competição já tem uma entrada
// aqui, mesmo que null" pra decidir se ainda vale migrar um valor
// antigo salvo no localStorage (de antes dessa mudança) — ver
// loadFavoriteClub() em app.js. Contas criadas antes desse campo
// existir não têm favoriteClubs no arquivo em disco; tratamos como
// {} nesse caso (sem checagem de undefined) em vez de exigir migração
// de esquema no arquivo.
function setFavoriteClub(id, competitionId, teamId) {
  const u = store.get(id);
  if (!u) return null;
  if (!u.favoriteClubs) u.favoriteClubs = {};
  u.favoriteClubs[competitionId] = teamId || null;
  u.updatedAt = Date.now();
  persist();
  return u;
}

// Campos seguros pra devolver ao front-end — nunca o passwordHash.
function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id, name: u.name, email: u.email, plan: u.plan, planStatus: u.planStatus, pendingPlan: u.pendingPlan || null,
    favoriteClubs: u.favoriteClubs || {},
    // role: "admin" | null — quem pode entrar em /admin (ver
    // server.js, POST /api/adminpanel/promote e o guard de
    // /api/adminpanel/*). Não existe por padrão em conta nenhuma —
    // precisa ser promovida explicitamente depois de já cadastrada.
    role: u.role || null,
  };
}

function isAdmin(u) {
  return !!u && u.role === "admin";
}

// Lista todos os usuários cadastrados (sem passwordHash) — usado pelo
// endpoint de admin antigo protegido por ADMIN_SECRET (GET
// /api/admin/users, ver server.js) e pela área administrativa nova
// (GET /api/adminpanel/users, protegida por login + role "admin").
function listUsers() {
  return Array.from(store.values())
    .map((u) => ({
      id: u.id, name: u.name, email: u.email, phone: u.phone,
      plan: u.plan, planStatus: u.planStatus, pendingPlan: u.pendingPlan || null,
      role: u.role || null,
      // paymentId/lastPaymentStatus só existem depois do 1º evento de
      // pagamento (ver webhook em server.js); preferenceId existe
      // desde que o checkout foi criado (cadastro pago, ou upgrade),
      // mesmo que a pessoa nunca tenha chegado a tentar pagar de
      // verdade — é exatamente esse cruzamento (tem preference, nunca
      // teve payment) que identifica abandono de checkout, ver GET
      // /api/adminpanel/revenue.
      preferenceId: u.preferenceId || null,
      paymentId: u.paymentId || null,
      lastPaymentStatus: u.lastPaymentStatus || null,
      createdAt: u.createdAt, updatedAt: u.updatedAt,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

module.exports = {
  createUser, updateUser, setFavoriteClub, findByEmail, findById, publicUser, listUsers, isAdmin,
  hashPassword, verifyPassword, normalizeEmail,
};
