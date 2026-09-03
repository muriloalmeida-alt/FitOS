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

// Código curto de convite pro sistema de amigos (Especificação de
// Retenção/Engajamento, item "Ranking assíncrono" — escopo "friends").
// 6 caracteres (36^6 ≈ 2 bilhões de combinações — colisão improvável,
// mas confere e sorteia de novo mesmo assim, mesmo espírito de
// newUserId acima) sem 0/O/1/I (fáceis de confundir lendo em voz alta
// ou copiando de tela pequena).
const FRIEND_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
function generateFriendCode() {
  let code;
  do {
    code = Array.from({ length: 6 }, () => FRIEND_CODE_ALPHABET[crypto.randomInt(FRIEND_CODE_ALPHABET.length)]).join("");
  } while (Array.from(store.values()).some((u) => u.friendCode === code));
  return code;
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
    // ---- Retenção/Engajamento (BRDataRetencaoEspecificacao) — ligado
    // à CONTA, não à carreira, de propósito: sequência de login e
    // lista de amigos precisam sobreviver a "Reiniciar carreira"/
    // "Escolher outro clube" (ver migrateCareerDefaults em
    // carreira.js, que NUNCA toca nesses 3 campos). ----
    friendCode: generateFriendCode(),
    friends: [], // ids de outras contas (relação sempre bidirecional, ver addFriendByCode)
    dailyLogin: { currentStreakDay: 0, lastClaimDate: null }, // ver claimDailyLogin
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  store.set(rec.id, rec);
  persist();
  return rec;
}

// Ciclo de recompensas (só o VALOR/TIPO abstrato — o que cada tipo
// vira de verdade no jogo, ex.: "coins" -> CAREER.finances.cash, é
// decisão do CLIENTE, ver DAILY_LOGIN_REWARD_TYPES em carreira.js; o
// servidor só sabe o formato genérico do documento de especificação,
// igual TRAINING_SCHEMES não conhece jogador nenhum de verdade).
const DAILY_LOGIN_CYCLE = [
  { day: 1, reward: { type: "coins", amount: 500 } },
  { day: 2, reward: { type: "coins", amount: 800 } },
  { day: 3, reward: { type: "boost", id: "moral_boost_small" } },
  { day: 4, reward: { type: "coins", amount: 1200 } },
  { day: 5, reward: { type: "scout_token", amount: 1 } },
  { day: 6, reward: { type: "coins", amount: 1800 } },
  { day: 7, reward: { type: "premium_pack", id: "weekly_elite" } },
];

// "YYYY-MM-DD" -> nº de dias desde uma época qualquer (só pra
// SUBTRAIR duas datas com segurança, sem lidar com fuso/DST — meio-dia
// UTC evita qualquer ambiguidade de borda de dia).
function dateStringToDayNumber(s) {
  return Math.round(Date.parse(`${s}T12:00:00Z`) / 86400000);
}

// Login diário com streak (Especificação de Retenção/Engajamento, item
// 2). AJUSTE DE CONFIANÇA (mesmo espírito de careerStore.js: o
// cliente já é "dono da verdade" do resto do jogo) — `localDate`
// ("YYYY-MM-DD") vem do relógio LOCAL do dispositivo do usuário, não
// do servidor: a regra do documento é "reseta à meia-noite LOCAL", e o
// servidor não tem como saber o fuso horário de quem está jogando.
// Sem validação cruzada contra hora real nenhuma — mesmo trade-off já
// aceito pro resto do save, sem risco financeiro real aqui (só
// recompensa dentro do próprio jogo).
function claimDailyLogin(id, localDate) {
  const u = store.get(id);
  if (!u) return null;
  if (!u.dailyLogin) u.dailyLogin = { currentStreakDay: 0, lastClaimDate: null };
  const dl = u.dailyLogin;
  if (dl.lastClaimDate === localDate) {
    const err = new Error("Recompensa de hoje já foi coletada.");
    err.status = 409;
    throw err;
  }
  const todayNum = dateStringToDayNumber(localDate);
  const lastNum = dl.lastClaimDate ? dateStringToDayNumber(dl.lastClaimDate) : null;
  // Sequência continua só se a última coleta foi ONTEM (diff === 1) —
  // qualquer outro caso (nunca coletou, ou pulou 1+ dias) reseta pro
  // dia 1, exatamente a regra do documento ("reseta se o usuário não
  // abrir o app em um dia").
  dl.currentStreakDay = lastNum != null && todayNum - lastNum === 1
    ? (dl.currentStreakDay % 7) + 1
    : 1;
  dl.lastClaimDate = localDate;
  u.updatedAt = Date.now();
  persist();
  const entry = DAILY_LOGIN_CYCLE.find((c) => c.day === dl.currentStreakDay);
  return { currentStreakDay: dl.currentStreakDay, reward: entry.reward };
}

// Adiciona amigo por código (SEMPRE bidirecional — mais simples que um
// fluxo de convite pendente/aceite, e suficiente pro v1 do ranking
// "friends" pedido na especificação). Recusa auto-adição e código
// inexistente; idempotente (adicionar de novo o mesmo amigo não
// duplica, só devolve sucesso).
function addFriendByCode(id, code) {
  const u = store.get(id);
  if (!u) return null;
  const normalizedCode = String(code || "").trim().toUpperCase();
  const target = Array.from(store.values()).find((x) => x.friendCode === normalizedCode);
  if (!target) { const err = new Error("Código de amigo não encontrado."); err.status = 404; throw err; }
  if (target.id === id) { const err = new Error("Você não pode adicionar a si mesmo."); err.status = 400; throw err; }
  if (!u.friends) u.friends = [];
  if (!target.friends) target.friends = [];
  if (!u.friends.includes(target.id)) u.friends.push(target.id);
  if (!target.friends.includes(id)) target.friends.push(id);
  u.updatedAt = Date.now();
  target.updatedAt = Date.now();
  persist();
  return listFriends(id);
}

// Lista de amigos com só o necessário pro Ranking (id + nome do
// técnico) — nunca e-mail/telefone/dado de plano de outra conta.
function listFriends(id) {
  const u = store.get(id);
  if (!u || !u.friends) return [];
  return u.friends.map((fid) => store.get(fid)).filter(Boolean).map((f) => ({ id: f.id, name: f.name }));
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
  // Conta criada ANTES do bloco de retenção/engajamento existir não
  // tem friendCode nenhum gravado — gera e persiste na primeira leitura
  // (idempotente: só roda essa vez, próxima leitura já acha o campo
  // preenchido), senão a conta fica pra sempre sem código pra
  // compartilhar no Ranking "amigos".
  if (!u.friendCode) { u.friendCode = generateFriendCode(); persist(); }
  return {
    id: u.id, name: u.name, email: u.email, plan: u.plan, planStatus: u.planStatus, pendingPlan: u.pendingPlan || null,
    favoriteClubs: u.favoriteClubs || {},
    // role: "admin" | null — quem pode entrar em /admin (ver
    // server.js, POST /api/adminpanel/promote e o guard de
    // /api/adminpanel/*). Não existe por padrão em conta nenhuma —
    // precisa ser promovida explicitamente depois de já cadastrada.
    role: u.role || null,
    // createdAt exposto pro achievement "Veterano" (1 ano de conta
    // ativa) — ver checkAchievements em carreira.js. friendCode/friends
    // pro Ranking assíncrono (escopo "amigos"); dailyLogin pro modal de
    // login diário — os 3 novos campos de
    // BRDataRetencaoEspecificacao.docx.
    createdAt: u.createdAt,
    friendCode: u.friendCode,
    friends: listFriends(u.id),
    dailyLogin: u.dailyLogin || { currentStreakDay: 0, lastClaimDate: null },
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
  claimDailyLogin, addFriendByCode, listFriends,
};
