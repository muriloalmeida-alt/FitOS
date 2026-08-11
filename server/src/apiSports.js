/* Cliente fino para a API-Sports (api-football v3).
   Documentação: https://api-sports.io/documentation/football/v3
   Autenticação: header x-apisports-key
   Base URL: https://v3.football.api-sports.io */

const BASE_URL = "https://v3.football.api-sports.io";

let lastQuota = { limit: null, remaining: null };

function getQuota() { return lastQuota; }

async function apiSportsGet(path, params = {}) {
  const key = process.env.API_SPORTS_KEY;
  if (!key) {
    const err = new Error("API_SPORTS_KEY não configurada no .env");
    err.code = "NO_API_KEY";
    throw err;
  }
  const url = new URL(BASE_URL + path);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });

  const res = await fetch(url, { headers: { "x-apisports-key": key } });

  lastQuota = {
    limit: res.headers.get("x-ratelimit-requests-limit"),
    remaining: res.headers.get("x-ratelimit-requests-remaining"),
  };

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`API-Sports respondeu ${res.status}: ${body.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }

  const json = await res.json();
  if (json.errors && Array.isArray(json.errors) ? json.errors.length : Object.keys(json.errors || {}).length) {
    const err = new Error(`API-Sports retornou erro: ${JSON.stringify(json.errors)}`);
    err.code = "API_ERROR";
    throw err;
  }
  return json.response;
}

module.exports = { apiSportsGet, getQuota, BASE_URL };
