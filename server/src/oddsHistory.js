/* Guarda uma série temporal simples de odds por partida, em memória.
   Toda vez que /api/fixtures/:id/odds é consultado, registramos um
   ponto aqui (se o valor mudou ou já faz >30min do último ponto).
   Isso não é um histórico "oficial" da casa de apostas — é só o que
   a própria aplicação foi observando desde que está no ar. Reinicia
   quando o processo reinicia. */

const MAX_POINTS_PER_FIXTURE = 500;
const MIN_INTERVAL_MS = 30 * 60 * 1000; // não grava mais de 1 ponto por 30min, a menos que o valor mude

const store = new Map(); // fixtureId -> [{t, v}]

function record(fixtureId, value) {
  if (value === null || value === undefined) return;
  const list = store.get(fixtureId) || [];
  const last = list[list.length - 1];
  const now = Date.now();
  if (last && last.v === value && (now - last.t) < MIN_INTERVAL_MS) return;
  list.push({ t: now, v: value });
  if (list.length > MAX_POINTS_PER_FIXTURE) list.shift();
  store.set(fixtureId, list);
}

function getHistory(fixtureId, sinceMs) {
  const list = store.get(fixtureId) || [];
  return list.filter(p => p.t >= sinceMs);
}

module.exports = { record, getHistory };
