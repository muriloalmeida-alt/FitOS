/* Cliente fino para a Sportmonks Football API v3.
   Documentação: https://docs.sportmonks.com/football
   Autenticação: query param api_token
   Base URL: https://api.sportmonks.com/v3/football
   Mesmo espírito zero-dependência do apiSports.js — fetch nativo, sem
   SDK/wrapper de terceiro (o pacote oficial em JS não é usado aqui de
   propósito, pra não trazer dependência nenhuma pro projeto). */

const BASE_URL = "https://api.sportmonks.com/v3/football";

let lastQuota = { limit: null, remaining: null };

function getQuota() { return lastQuota; }

// path + params (sem o token) de toda chamada que deu erro — pra dar
// pra achar nos logs do Railway exatamente qual endpoint/include
// causou aquele erro específico (esse client fica isolado demais do
// resto do app pra só a mensagem de erro sozinha bastar pra debugar
// à distância, ver histórico de ajuste em providers/sportmonks.js).
function logFailure(path, params, msg) {
  console.error(`[sportmonks] ${path}?${new URLSearchParams(params).toString()} -> ${msg}`);
}

// Métricas de tráfego (pedido pelo usuário: acompanhar tráfego/
// sucesso/falha da Sportmonks na área administrativa, ver GET
// /api/adminpanel/integrations em server.js) — só em memória, ZERA a
// cada restart/deploy (não é um histórico persistido tipo
// paymentsLedger; é "o que está acontecendo agora/desde o último
// boot", suficiente pro objetivo de diagnosticar tráfego ao vivo).
let stats = {
  totalRequests: 0, totalSuccess: 0, totalFailures: 0,
  lastRequestAt: null, lastSuccessAt: null,
  lastFailureAt: null, lastFailureMessage: null,
  recent: [], // últimas RECENT_LIMIT chamadas: { path, ok, status, ms, at, error }
};
const RECENT_LIMIT = 30;
function trackCall({ path, ok, status, ms, error }) {
  stats.totalRequests++;
  stats.lastRequestAt = Date.now();
  if (ok) { stats.totalSuccess++; stats.lastSuccessAt = Date.now(); }
  else { stats.totalFailures++; stats.lastFailureAt = Date.now(); stats.lastFailureMessage = error || null; }
  stats.recent.unshift({ path, ok, status: status ?? null, ms, at: Date.now(), error: ok ? null : (error || null) });
  if (stats.recent.length > RECENT_LIMIT) stats.recent.length = RECENT_LIMIT;
}
// Cópia defensiva (recent é um array mutável) — quem consome isso não
// deve acidentalmente segurar/alterar o array interno de verdade.
function getStats() { return { ...stats, recent: [...stats.recent] }; }

// Chamada crua — devolve o corpo INTEIRO já decodificado (data +
// pagination + rate_limit etc.), não só o campo "data". Uso interno;
// sportmonksGet/sportmonksGetAll abaixo são o que o resto do provider
// deveria chamar.
async function sportmonksRequest(path, params = {}) {
  const token = process.env.SPORTMONKS_API_TOKEN;
  if (!token) {
    const err = new Error("SPORTMONKS_API_TOKEN não configurado no .env");
    err.code = "NO_API_KEY";
    throw err; // nem chegou a tentar chamar a API -- não é tráfego de verdade, não entra nas métricas
  }
  const url = new URL(BASE_URL + path);
  url.searchParams.set("api_token", token);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });

  const startedAt = Date.now();
  let res, json;
  try {
    res = await fetch(url);
    json = await res.json().catch(() => null);
  } catch (networkErr) {
    // Falha ANTES de qualquer resposta chegar (DNS, timeout, conexão
    // recusada) — ainda assim é uma tentativa de tráfego de verdade,
    // diferente do caso "sem token" acima.
    trackCall({ path, ok: false, status: null, ms: Date.now() - startedAt, error: networkErr.message });
    logFailure(path, params, `falha de rede: ${networkErr.message}`);
    throw networkErr;
  }
  const ms = Date.now() - startedAt;

  if (!res.ok) {
    const msg = json?.message || `Sportmonks respondeu ${res.status}`;
    logFailure(path, params, `HTTP ${res.status}: ${msg}`);
    trackCall({ path, ok: false, status: res.status, ms, error: msg });
    const err = new Error(`Sportmonks: ${msg}`);
    err.status = res.status;
    throw err;
  }

  // A Sportmonks devolve cota de uso no próprio corpo da resposta (não
  // em header), num campo rate_limit — best-effort: só atualiza se
  // vier, nunca quebra se o formato mudar.
  if (json?.rate_limit) {
    lastQuota = {
      limit: json.rate_limit.requests_per_hour ?? null,
      remaining: json.rate_limit.remaining ?? null,
    };
  }

  if (json?.message && !json?.data) {
    // Erro "de negócio" (ex.: token sem acesso àquela liga) que ainda
    // assim vem com status 200 em alguns endpoints da Sportmonks.
    logFailure(path, params, `200 com erro no corpo: ${json.message}`);
    trackCall({ path, ok: false, status: res.status, ms, error: json.message });
    const err = new Error(`Sportmonks: ${json.message}`);
    throw err;
  }

  trackCall({ path, ok: true, status: res.status, ms });
  return json;
}

// path já sem a base (ex.: "/teams/seasons/123"). params vira query
// string; "include" (lista de relações a embutir na resposta, sintaxe
// "a;b;c" da própria Sportmonks) é só mais um parâmetro normal. Uso
// pros endpoints cujo total de itens já nasce pequeno (ex.: tabela/
// elenco de 1 liga, ~20 times — bem abaixo do per_page padrão da
// Sportmonks, então 1 página sempre basta).
async function sportmonksGet(path, params = {}) {
  const json = await sportmonksRequest(path, params);
  return json?.data;
}

// pagination.next_cursor na prática NÃO vem como um token curto
// isolado — confirmado com log real do Railway, vem como a URL
// COMPLETA da próxima página (com filters/include repetidos e um
// "cursor=<token de verdade>" já embutido nela). Anexar esse valor
// inteiro como query param "cursor" (por cima da URL original) gera
// uma URL sem sentido nenhum. Esta função extrai só o token de dentro
// dessa URL (ou usa o valor direto, se um dia vier como token puro
// mesmo — tolera os dois formatos).
function extractCursorToken(raw) {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) {
    try { return new URL(raw).searchParams.get("cursor") || raw; }
    catch { return raw; }
  }
  return raw;
}

// Igual sportmonksGet, mas pagina automaticamente (cursor-based, ver
// json.pagination.has_more/next_cursor na doc da Sportmonks) até
// esgotar has_more — usar em qualquer listagem que possa passar do
// per_page padrão (25): calendário de temporada inteira (~380 jogos),
// elenco de time (pode passar de 25 com reservas) e artilharia (pode
// ter mais de 25 jogadores com gol na temporada). Teto de segurança de
// 20 páginas (1000 itens com per_page=50) pra nunca entrar em loop
// infinito por um "has_more" que nunca desliga.
//
// per_page só vai na 1ª página — a Sportmonks rejeita explicitamente
// ("per_page parameter cannot be used together with cursor") mandar os
// dois juntos numa página seguinte; o tamanho de página já fica
// implícito no cursor a partir da 2ª chamada.
async function sportmonksGetAll(path, params = {}) {
  let all = [];
  let cursor = null;
  let page = 0;
  do {
    const p = { ...params };
    if (cursor) {
      p.cursor = cursor;
      delete p.per_page;
    } else {
      p.per_page = params.per_page || 50;
    }
    const json = await sportmonksRequest(path, p);
    const data = json?.data;
    all = all.concat(Array.isArray(data) ? data : (data ? [data] : []));
    cursor = json?.pagination?.has_more ? extractCursorToken(json.pagination.next_cursor) : null;
    page++;
  } while (cursor && page < 20);
  return all;
}

module.exports = { sportmonksGet, sportmonksGetAll, getQuota, getStats, BASE_URL };
