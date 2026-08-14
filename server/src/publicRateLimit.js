/* Rate-limit simples por IP pras rotas de LEITURA pública (sem sessão)
   — ver PUBLIC_READ_EXACT/PUBLIC_READ_PATTERNS em server.js. Faz parte
   da mudança de produto "Freemium sem login" (visitante sem conta lê
   dado esportivo básico à vontade) — sem ISSO, ficaria aberto pra
   bot/scraper sem limite nenhum batendo na cota da Sportmonks, já que
   a identificação "por conta" que a sessão dava de graça deixa de
   existir nessas rotas.

   Só em memória (zera a cada restart/deploy) — mesmo espírito de
   sportmonksClient.js/epgSource.js: não precisa sobreviver reinício,
   só protege o servidor "vivo" agora. Janela FIXA (não sliding) —
   simples de implementar sem dependência nenhuma (zero-dependência é
   escolha deliberada deste projeto), suficiente pra travar abuso
   óbvio sem virar um projeto de rate-limiter à parte. Se um dia isso
   não bastar (site com tráfego alto, atrás de vários processos), a
   solução real é rate-limit no proxy/CDN na frente (ex.: Cloudflare),
   não reescrever isto. */

const WINDOW_MS = 60 * 1000; // 1 minuto
const MAX_REQUESTS = 60; // por IP, por janela — generoso pra navegação normal (várias chamadas a cada troca de página), baixo o bastante pra travar scraper repetitivo

let windowStart = Date.now();
let counts = new Map();

// true = dentro do limite (segue normal), false = estourou (429).
function checkLimit(ip) {
  const now = Date.now();
  if (now - windowStart > WINDOW_MS) {
    windowStart = now;
    counts = new Map();
  }
  const n = (counts.get(ip) || 0) + 1;
  counts.set(ip, n);
  return n <= MAX_REQUESTS;
}

module.exports = { checkLimit };
