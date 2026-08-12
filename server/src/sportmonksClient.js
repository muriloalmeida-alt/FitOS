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

// path já sem a base (ex.: "/teams/seasons/123"). params vira query
// string; "include" (lista de relações a embutir na resposta, sintaxe
// "a;b;c" da própria Sportmonks) é só mais um parâmetro normal.
async function sportmonksGet(path, params = {}) {
  const token = process.env.SPORTMONKS_API_TOKEN;
  if (!token) {
    const err = new Error("SPORTMONKS_API_TOKEN não configurado no .env");
    err.code = "NO_API_KEY";
    throw err;
  }
  const url = new URL(BASE_URL + path);
  url.searchParams.set("api_token", token);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });

  const res = await fetch(url);
  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = json?.message || `Sportmonks respondeu ${res.status}`;
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
    const err = new Error(`Sportmonks: ${json.message}`);
    throw err;
  }

  return json?.data;
}

module.exports = { sportmonksGet, getQuota, BASE_URL };
