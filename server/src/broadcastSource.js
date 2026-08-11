/* Busca (best-effort) a emissora de TV de uma partida via TheSportsDB
   — banco de dados esportivo comunitário e gratuito. Usa a chave de
   teste pública "123", documentada pela própria TheSportsDB para uso
   de baixo volume (não precisa de cadastro/segredo).

   Isso é uma fonte INDEPENDENTE da API-Sports — não tem relação com
   API_SPORTS_KEY e funciona mesmo sem ela configurada. Só faz
   sentido em modo ao vivo (datas/nomes de times reais); não é
   chamado em modo de exemplo.

   Importante: é um banco mantido por voluntários, não é fonte oficial
   de direitos de transmissão — o dado pode vir vazio, desatualizado
   ou impreciso. O front-end sempre mostra isso como informação da
   comunidade a confirmar, nunca como fato garantido. */
const BASE_URL = "https://www.thesportsdb.com/api/v1/json/123";
const BRASILEIRAO_LEAGUE_ID = "4351"; // Brazilian Serie A no catálogo da TheSportsDB

const DIACRITICS_RE = new RegExp("[" + "\\u0300" + "-" + "\\u036f" + "]", "g");

function normalizeName(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(DIACRITICS_RE, "") // remove acentos
    .replace(/[^a-z0-9]/g, ""); // remove espaços/pontuação
}

// dateISO: data do jogo (qualquer formato que comece com YYYY-MM-DD).
// homeName/awayName: nomes dos times como a gente já conhece (API-Sports).
// Retorna o nome da emissora (string) ou null se não achou nada.
async function fetchBroadcastStation(dateISO, homeName, awayName) {
  const day = String(dateISO || "").slice(0, 10);
  if (!day || !homeName || !awayName) return null;

  const url = `${BASE_URL}/eventsday.php?d=${encodeURIComponent(day)}&l=${BRASILEIRAO_LEAGUE_ID}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const events = json && json.events;
  if (!Array.isArray(events)) return null;

  const hn = normalizeName(homeName);
  const an = normalizeName(awayName);
  const match = events.find(ev => {
    const ehn = normalizeName(ev.strHomeTeam);
    const ean = normalizeName(ev.strAwayTeam);
    // includes() nos dois sentidos: nomes têm formatações diferentes
    // entre as duas fontes (ex: "Flamengo" vs "CR Flamengo").
    return (ehn.includes(hn) || hn.includes(ehn)) && (ean.includes(an) || an.includes(ean));
  });
  const station = match && match.strTVStation ? String(match.strTVStation).trim() : "";
  return station || null;
}

module.exports = { fetchBroadcastStation, normalizeName };
