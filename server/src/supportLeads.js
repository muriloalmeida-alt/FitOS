/* Guarda os cadastros da área "Apoie o BR Data" (nome/telefone/email +
   plano escolhido) e o status do pagamento correspondente no Mercado
   Pago. Persistido num arquivo JSON simples em disco — sem depender de
   banco de dados, no mesmo espírito "zero dependências" do resto do
   backend.

   ATENÇÃO — armazenamento local, não é um banco de verdade:
   em hosts com sistema de arquivos efêmero (o que inclui o Railway
   por padrão, sem um Volume anexado ao serviço), esse arquivo é
   apagado a cada novo deploy/redeploy. Pra não perder cadastros de
   verdade, anexe um Volume no Railway apontando pra pasta `server/data`
   (Settings do serviço → Volumes), ou plugue aqui o envio pra um lugar
   persistente (planilha, banco, e-mail) quando quiser evoluir isso. */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const FILE = path.join(DATA_DIR, "support-leads.json");

let store = new Map(); // ref -> record

function load() {
  try {
    if (fs.existsSync(FILE)) {
      const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
      store = new Map(Object.entries(raw));
    }
  } catch (err) {
    console.error("[supportLeads] falha ao carregar arquivo local:", err.message);
  }
}

function persist() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(Object.fromEntries(store), null, 2));
  } catch (err) {
    console.error("[supportLeads] falha ao salvar arquivo local:", err.message);
  }
}

load();

function create(record) {
  store.set(record.ref, record);
  persist();
  return record;
}

function updateStatus(ref, status, extra = {}) {
  const rec = store.get(ref);
  if (!rec) return null;
  Object.assign(rec, extra, { status, updatedAt: Date.now() });
  persist();
  return rec;
}

function findByRef(ref) {
  return store.get(ref) || null;
}

function findByPreferenceId(preferenceId) {
  for (const rec of store.values()) {
    if (rec.preferenceId === preferenceId) return rec;
  }
  return null;
}

module.exports = { create, updateStatus, findByRef, findByPreferenceId };
