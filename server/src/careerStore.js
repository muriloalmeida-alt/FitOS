/* Save de carreira do "Modo Técnico" (Elifoot-like) — 1 carreira ativa
   por conta (ver decisão do usuário: "1 clube escolhido, resto é
   CPU"). Diferente de users.js/contentStore.js, este módulo NÃO
   entende nada de futebol: guarda o blob JSON inteiro que o front-end
   (public/js/carreira.js) monta e recalcula sozinho (elenco gerado,
   escalação, tabela da carreira, notícias...) — o "estado do jogo"
   inteiro vive no cliente, o backend só persiste pra sobreviver a
   troca de aba/dispositivo, com o mesmo espírito zero-dependência do
   resto do backend.

   Isso é seguro porque é um jogo SOLO sem placar competitivo entre
   contas (cada um só pode ler/escrever a própria carreira, ver guard
   de login em server.js) — não tem problema nenhum o cliente ser
   "dono da verdade" do save aqui, ao contrário de dado financeiro
   (users.js) ou de conteúdo público (contentStore.js).

   MESMO AVISO de users.js/sessions.js: em host com sistema de
   arquivos efêmero (Railway sem Volume anexado), esse arquivo é
   apagado a cada novo deploy — quem estiver com uma carreira em
   andamento perde o progresso. */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const FILE = path.join(DATA_DIR, "careers.json");

// Generoso o bastante pra um elenco de ~50 jogadores (principal + base)
// com histórico de rodadas e notícias, mas impede que uma conta
// comprometida (ou um bug no cliente) escreva um blob gigante sem
// limite nenhum.
const MAX_BYTES = 400 * 1024;

let store = new Map(); // userId -> save object (opaco)

function load() {
  try {
    if (fs.existsSync(FILE)) {
      const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
      store = new Map(Object.entries(raw));
    }
  } catch (err) {
    console.error("[careerStore] falha ao carregar arquivo local:", err.message);
  }
}

function persist() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(Object.fromEntries(store), null, 2));
  } catch (err) {
    console.error("[careerStore] falha ao salvar arquivo local:", err.message);
  }
}

load();

function getCareer(userId) {
  return store.get(userId) || null;
}

// Validação BEM rasa de propósito (ver aviso no topo: o cliente é dono
// da verdade do formato) — só confere que "parece" um save de carreira
// de verdade (clubId + elenco como array) antes de aceitar, pra um
// bug no front-end não conseguir apagar um save bom com lixo/`null`
// por engano, e o limite de tamanho acima.
function isValidCareerShape(data) {
  return !!data && typeof data === "object"
    && typeof data.clubId === "string" && data.clubId
    && Array.isArray(data.squad);
}

function saveCareer(userId, data) {
  const json = JSON.stringify(data);
  if (Buffer.byteLength(json, "utf8") > MAX_BYTES) {
    const err = new Error("Save da carreira grande demais.");
    err.status = 413;
    throw err;
  }
  if (!isValidCareerShape(data)) {
    const err = new Error("Formato de save inválido.");
    err.status = 400;
    throw err;
  }
  store.set(userId, data);
  persist();
  return data;
}

function deleteCareer(userId) {
  const existed = store.delete(userId);
  if (existed) persist();
  return existed;
}

module.exports = { getCareer, saveCareer, deleteCareer };
