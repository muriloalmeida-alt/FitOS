/* Cache simples em memória, com expiração (TTL) por chave.
   Existe pra evitar bater no limite diário de requisições da API-Sports
   (o plano free libera só 100 chamadas/dia). */

const store = new Map();

function get(key) {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) { store.delete(key); return null; }
  return hit.value;
}

function set(key, value, ttlMs) {
  store.set(key, { value, expires: Date.now() + ttlMs });
}

function stats() {
  return { entries: store.size };
}

module.exports = { get, set, stats };
