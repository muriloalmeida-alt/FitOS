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
// BUG CORRIGIDO (15/08/2026): 60/min "generoso pra navegação normal" na
// prática não era — relatado pelo usuário como "elenco não disponível"
// (silencioso: loadTeamRoster/etc. tratam 429 igual qualquer outra
// falha e caem pra lista vazia, sem aparecer erro nenhum na tela, só o
// dado sumindo). Causa: SÓ abrir a aba "Jogos" já dispara até 40
// chamadas de estatística de jogo em segundo plano (ver
// ensureLeagueCardStats/LEAGUE_STATS_FILL_CAP em app.js, preenche o
// total de cartões aos poucos), MAIS as 4 do carregamento inicial do
// dashboard (times/tabela/jogos/artilheiros) — já perto do teto antigo
// só com isso, antes de visitar time nenhum. Subiu 4x: ainda trava
// scraper insistindo (250+ requisições/min sustentado é bem acima de
// qualquer uso humano real), mas dá folga de sobra pra uma sessão
// normal explorando várias páginas/times sem cair em 429 à toa.
const MAX_REQUESTS = 240; // por IP, por janela

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
