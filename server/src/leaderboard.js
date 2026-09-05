/* Ranking assíncrono do Modo Técnico (BRDataRetencaoEspecificacao,
   item 5) — o ÚNICO dos 4 sistemas de retenção/engajamento que
   precisa de armazenamento no servidor: é o único dado que uma conta
   precisa LER de outra (objetivos/conquistas continuam 100% dentro do
   save opaco de careerStore.js, streak/amigos em users.js, ligados só
   à própria conta).

   Mesmo espírito "zero dependência" de sempre — arquivo JSON simples
   em disco. Mesmo AVISO de confiança de sempre (ver careerStore.js/
   claimDailyLogin em users.js): o placar é CALCULADO NO CLIENTE (ver
   computeLeaderboardScore em carreira.js — pontos de campeonato +
   conquistas + saldo de gols, fórmula sugerida no documento) e só
   publicado aqui, sem validação cruzada contra o save real. Aceitável
   porque não há nenhuma recompensa financeira/vantagem de jogo ligada
   à posição no ranking — é só vaidade/comparação social, mesma lógica
   de sempre desse projeto (o cliente já é dono da verdade do resto do
   jogo).

   "Atualizado em batch a cada 6h" (sugestão do documento) — em vez de
   um job/cron de verdade (infra que este projeto não tem em lugar
   nenhum), o cliente publica o placar sozinho em 2 pontos naturais:
   toda vez que a tela de Ranking é aberta, e depois de virar de
   temporada (ver renderRanking/advanceSeason em carreira.js) — na
   prática, atualiza "sob demanda" em vez de num relógio fixo, o que
   cumpre a mesma meta do documento ("não precisa ser em tempo real")
   com bem menos complexidade. */

const fs = require("fs");
const path = require("path");
const { scheduleWrite } = require("./debouncedPersist");

const DATA_DIR = path.join(__dirname, "..", "data");
const FILE = path.join(DATA_DIR, "leaderboard.json");

// Nenhum campo de texto livre vindo do cliente (managerName vem do
// nome REAL da conta, nunca do body — ver server.js) deveria passar
// disso; corta defensivamente mesmo assim.
const MAX_CLUB_NAME_LEN = 80;
// Teto de sanidade pro score — não é uma trava de segurança de
// verdade (o cliente já é "dono da verdade" aqui, ver aviso acima), só
// evita que um bug no cálculo do cliente (ex.: NaN virando Infinity)
// quebre a ORDENAÇÃO da lista pra todo mundo.
const MAX_SCORE = 999_999_999;

let store = new Map(); // userId -> { managerName, clubName, score, breakdown, updatedAt }

function load() {
  try {
    if (fs.existsSync(FILE)) {
      const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
      store = new Map(Object.entries(raw));
    }
  } catch (err) {
    console.error("[leaderboard] falha ao carregar arquivo local:", err.message);
  }
}

// Performance (pedido do usuário: "o jogo está lento") — ver
// debouncedPersist.js.
function persist() {
  scheduleWrite(FILE, DATA_DIR, () => JSON.stringify(Object.fromEntries(store)));
}

load();

function publishScore(userId, managerName, { clubName, score, breakdown }) {
  const entry = {
    managerName,
    clubName: String(clubName || "").slice(0, MAX_CLUB_NAME_LEN),
    score: Math.max(0, Math.min(MAX_SCORE, Math.round(Number(score) || 0))),
    breakdown: breakdown && typeof breakdown === "object" ? breakdown : null,
    updatedAt: Date.now(),
  };
  store.set(userId, entry);
  persist();
  return entry;
}

function getEntry(userId) {
  return store.get(userId) || null;
}

// Ranking "global" — top N por score. Quem chama (ver GET
// /api/leaderboard em server.js) sempre garante que a PRÓPRIA entrada
// do usuário logado também aparece (mesmo fora do top N), igual o
// mockup ("card fixo destacando a própria posição mesmo fora do
// ranking geral") — combinado ali, não aqui, pra esta função continuar
// simples/genérica.
function listGlobal(limit = 50) {
  return Array.from(store.entries())
    .map(([userId, e]) => ({ userId, ...e }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// Ranking "amigos" — só as entradas dos ids passados (self + lista de
// amigos, resolvida em users.js) que já publicaram algum score; quem
// nunca abriu a tela de Ranking simplesmente não aparece ainda.
function listForUsers(userIds) {
  return userIds
    .map((userId) => (store.has(userId) ? { userId, ...store.get(userId) } : null))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
}

module.exports = { publishScore, getEntry, listGlobal, listForUsers };
