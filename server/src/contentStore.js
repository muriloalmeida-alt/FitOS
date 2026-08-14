/* Overrides de CONTEÚDO estático editável pelo admin (/admin > Conteúdo)
   — pedido do usuário: ter liberdade pra trocar título/texto/imagem de
   partes do site sem precisar mexer em código nem esperar redeploy.

   Escopo desta 1ª versão: só os cards de plano da página "Assine o BR
   Data" (título, tagline, lista de recursos e uma imagem opcional por
   plano) — é o conteúdo que mais muda na prática (preço e recurso de
   plano evoluem com frequência) e já vivia centralizado num arquivo só
   (server/src/supportPlans.js), então dava pra sobrepor sem espalhar a
   lógica pelo resto do app. O plano também tem um campo "description"
   no código, mas ele não é editável aqui de propósito: hoje nenhuma
   tela do app mostra esse texto pra ninguém, então editá-lo não teria
   efeito visível nenhum -- só confundiria quem tá editando.

   IMPORTANTE — preço NUNCA entra aqui. supportPlans.js já documenta que
   o valor cobrado de verdade sempre vem do próprio código/variável de
   ambiente, nunca de algo editável por fora — esse arquivo só sobrepõe
   texto/imagem, e supportPlans.applyOverride() (ver lá) garante isso
   explicitamente no merge, nunca troca id/price.

   Cada campo é opcional e independente: campo vazio/ausente no override
   = usa o padrão do código (ver PLANS em supportPlans.js). É assim que
   dá pra editar só a tagline de um plano sem precisar preencher os
   outros 4 campos — e também como o site volta sozinho pro texto de
   sempre se o admin limpar um campo e salvar de novo.

   MESMO AVISO de paymentsLedger.js/analytics.js: em host com sistema de
   arquivos efêmero (Railway sem Volume anexado), esse arquivo é apagado
   a cada novo deploy — a edição de conteúdo se perde e o site volta
   pros textos padrão do código. Diferente das métricas (onde isso é
   inofensivo), aqui pode surpreender quem editou um texto e esperava
   que continuasse — vale reforçar pro usuário que persistência de
   verdade depende de Volume configurado no Railway. */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const FILE = path.join(DATA_DIR, "content.json");

let store = { plans: {} };

function load() {
  try {
    if (fs.existsSync(FILE)) {
      const parsed = JSON.parse(fs.readFileSync(FILE, "utf8"));
      store = { plans: parsed.plans || {} };
    }
  } catch (err) {
    console.error("[contentStore] falha ao carregar arquivo local:", err.message);
  }
}

function persist() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(store, null, 2));
  } catch (err) {
    console.error("[contentStore] falha ao salvar arquivo local:", err.message);
  }
}

load();

// Limites bem generosos só pra impedir um cole acidental gigante de
// travar o layout do card — não é validação de conteúdo em si (é uma
// conta de admin de verdade editando, mesmo nível de confiança de quem
// mexe no código).
const MAX_LEN = { title: 40, tagline: 120, feature: 140, imageUrl: 500 };
const MAX_FEATURES = 8;

function cleanText(v, max) {
  const s = String(v || "").trim();
  return s ? s.slice(0, max) : "";
}

function cleanImageUrl(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  // só aceita link http(s) de verdade -- evita "javascript:" ou outro
  // esquema esquisito acabar salvo e executado no lugar de uma imagem.
  if (!/^https?:\/\//i.test(s)) return "";
  return s.slice(0, MAX_LEN.imageUrl);
}

function getPlanOverride(planId) {
  return store.plans[planId] || null;
}

function getAllPlanOverrides() {
  return store.plans;
}

// Substitui o override INTEIRO do plano pelo que foi enviado agora --
// o formulário do admin sempre manda os 4 campos (mesmo vazios), então
// "campo vazio" aqui já significa "sem override nesse campo", não
// precisa de um endpoint de reset separado pra cada campo.
function setPlanOverride(planId, patch) {
  const clean = {};
  const title = cleanText(patch.title, MAX_LEN.title);
  const tagline = cleanText(patch.tagline, MAX_LEN.tagline);
  const features = Array.isArray(patch.features)
    ? patch.features.map((f) => cleanText(f, MAX_LEN.feature)).filter(Boolean).slice(0, MAX_FEATURES)
    : [];
  const imageUrl = cleanImageUrl(patch.imageUrl);

  if (title) clean.title = title;
  if (tagline) clean.tagline = tagline;
  if (features.length) clean.features = features;
  if (imageUrl) clean.imageUrl = imageUrl;

  if (Object.keys(clean).length) store.plans[planId] = clean;
  else delete store.plans[planId]; // nada preenchido = sem override nenhum, volta 100% pro padrão do código

  persist();
  return store.plans[planId] || null;
}

module.exports = { getPlanOverride, getAllPlanOverrides, setPlanOverride };
