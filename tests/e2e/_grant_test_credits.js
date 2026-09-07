// Script de apoio SÓ para test_loja_pagamento_real.js — roda como
// processo separado do servidor (nunca em produção), cria uma conta de
// teste e credita Créditos BR chamando addCredits() diretamente (mesma
// função que o webhook do Mercado Pago chamaria), depois força a
// escrita síncrona no disco (flushAllSync) — sem isso, o timer debounced
// de users.js (unref'd) nunca dispararia antes deste processo curto
// terminar, e a conta/crédito se perderiam silenciosamente. Como este
// script roda num processo Node separado do servidor já em execução
// (que mantém seu próprio Map em memória, carregado uma vez no boot), o
// servidor precisa ser REINICIADO depois disso pra enxergar a conta nova
// — feito pelo teste antes de logar com essa conta.
const path = require("path");
const users = require(path.join(__dirname, "..", "..", "server", "src", "users.js"));
const { flushAllSync } = require(path.join(__dirname, "..", "..", "server", "src", "debouncedPersist.js"));

(async () => {
  const email = process.argv[2];
  const password = process.argv[3];
  const credits = Number(process.argv[4] || 5000);
  const u = await users.createUser({ name: "Loja Boost", email, password, phone: "11999999999", plan: "freemium", planStatus: "active" });
  users.addCredits(u.id, credits, `test_grant_${Date.now()}`);
  flushAllSync();
  console.log(JSON.stringify({ id: u.id, email, credits }));
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
