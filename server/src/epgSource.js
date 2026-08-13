/* Busca (best-effort) a emissora de TV de uma partida via um feed
   XMLTV público (epgshare01.online, agregador comunitário de grade de
   programação — mesmo espírito do broadcastSource.js: fonte
   independente, gratuita, não é registro oficial de direitos de
   transmissão, pode vir vazia/desatualizada/imprecisa).

   AVISO IMPORTANTE (pedido pelo usuário, avaliado antes de implementar
   — ver histórico da conversa): não foi possível confirmar de antemão
   se os canais PAGOS que realmente transmitem o Brasileirão
   (Premiere, SporTV, Globo, Amazon Prime Video...) aparecem com jogo
   por jogo nesse feed — agregadores comunitários de EPG costumam ser
   fortes em TV aberta/regional e fracos em canais pagos, já que o
   emissor não publica isso abertamente. Implementado mesmo assim, por
   decisão explícita do usuário, com essa incerteza documentada. Se na
   prática vier sempre vazio, é sinal de que o feed realmente não cobre
   esses canais — nesse caso o /api/broadcast já cai pro
   broadcastSource.js (TheSportsDB) sozinho, sem quebrar nada.

   Arquivo usado: epg_ripper_BR1.xml.gz (só Brasil) — NÃO o
   ALL_SOURCES1.xml.gz que foi sugerido originalmente, que é a grade
   combinada de TODOS os países do catálogo (centenas de MB mesmo
   comprimido, quase tudo irrelevante pro Brasileirão). BR1 é a mesma
   fonte, só que já filtrada pelo próprio epgshare01 pro país que
   interessa — muito mais leve pra baixar/processar num host Railway.

   Parser XMLTV feito na mão (regex), não uma lib de verdade — o
   projeto é zero-dependência de propósito (ver header de server.js;
   foi até revertida uma dependência única que chegou a entrar, ver
   histórico da conversa). XMLTV tem estrutura simples/repetitiva o
   bastante (sem aninhamento profundo) pra isso funcionar bem contra
   dado real; qualquer bloco que não bater no padrão esperado é só
   ignorado — degradação graciosa importa mais aqui do que parsing
   perfeito de um formato que a gente só lê 2 campos (title, channel). */

const zlib = require("zlib");
const { normalizeName } = require("./broadcastSource");

const EPG_URL = process.env.EPG_URL || "https://epgshare01.online/epgshare01/epg_ripper_BR1.xml.gz";
const REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12h — mesma cadência típica desses agregadores

// Filtro de canal — sem isso, guardaríamos em memória milhares de
// entradas de canais de TV aberta/regional que nunca vão bater com um
// jogo do Brasileirão (a grande maioria do feed BR1). Lista curta e
// explícita: emissoras conhecidas do futebol brasileiro. Ajustar aqui
// se descobrir que falta alguma (ex.: um canal regional que também
// transmite).
const SPORTS_CHANNEL_KEYWORDS = [
  "premiere", "sportv", "espn", "band sports", "bandsports", "globo",
  "tnt sports", "caze", "cazetv", "amazon prime", "star+", "star plus",
];

function isSportsChannel(name) {
  const n = (name || "").toLowerCase();
  return SPORTS_CHANNEL_KEYWORDS.some((kw) => n.includes(kw));
}

function decodeEntities(s) {
  return String(s || "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .trim();
}

// Formato de data do XMLTV: "20260813200000 +0000" (ou variações sem
// espaço/offset — tolerante aos dois). Devolve Date, ou null se não
// bater no padrão esperado (nunca lança).
function parseXMLTVDate(raw) {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*(?:([+-]\d{2})(\d{2}))?/.exec(String(raw || "").trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s, offH, offM] = m;
  const offset = offH ? `${offH}:${offM}` : "Z";
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}${offset}`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Extrai só o que interessa (canais esportivos + título/horário de
// cada programa neles) de um XMLTV inteiro já descomprimido. channels:
// Map(id -> nome de exibição). programmes: [{ start: Date, channelId, title }].
function parseXMLTV(xml) {
  const channels = new Map();
  const channelBlockRe = /<channel id="([^"]*)"[^>]*>([\s\S]*?)<\/channel>/g;
  let m;
  while ((m = channelBlockRe.exec(xml))) {
    const id = m[1];
    const nameMatch = /<display-name[^>]*>([^<]*)<\/display-name>/.exec(m[2]);
    const name = decodeEntities(nameMatch ? nameMatch[1] : id);
    if (isSportsChannel(name)) channels.set(id, name);
  }

  const programmes = [];
  if (channels.size) {
    const progBlockRe = /<programme start="([^"]*)"[^>]*channel="([^"]*)"[^>]*>([\s\S]*?)<\/programme>/g;
    while ((m = progBlockRe.exec(xml))) {
      const [, startRaw, channelId, body] = m;
      if (!channels.has(channelId)) continue; // já filtra cedo — só guarda canal esportivo
      const titleMatch = /<title[^>]*>([^<]*)<\/title>/.exec(body);
      if (!titleMatch) continue;
      const start = parseXMLTVDate(startRaw);
      if (!start) continue;
      programmes.push({ start, channelId, title: decodeEntities(titleMatch[1]) });
    }
  }

  return { channels, programmes };
}

let cache = { channels: new Map(), programmes: [], fetchedAt: null };
let refreshPromise = null;

async function refreshCache() {
  const res = await fetch(EPG_URL);
  if (!res.ok) throw new Error(`EPG (epgshare01) respondeu ${res.status}`);
  const gz = Buffer.from(await res.arrayBuffer());
  const xml = zlib.gunzipSync(gz).toString("utf8");
  const parsed = parseXMLTV(xml);
  cache = { ...parsed, fetchedAt: Date.now() };
  console.log(`[epg] atualizado — ${parsed.channels.size} canais esportivos reconhecidos, ${parsed.programmes.length} programas na grade.`);
}

// Busca sob demanda, só quando alguém pedir — não bloqueia o boot do
// servidor. Reusa a mesma promise em chamadas concorrentes (evita
// baixar o feed 2x se 2 requisições chegarem juntas com o cache
// vencido). Nunca lança — falha vira cache vazio/antigo, tratado como
// "não achou nada" por fetchBroadcastFromEPG.
function ensureFreshCache() {
  const stale = !cache.fetchedAt || (Date.now() - cache.fetchedAt) > REFRESH_INTERVAL_MS;
  if (!stale) return Promise.resolve();
  if (!refreshPromise) {
    refreshPromise = refreshCache()
      .catch((err) => console.error("[epg] falha ao atualizar o feed:", err.message))
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

// dateISO: data do jogo (mesmo parâmetro que fetchBroadcastStation em
// broadcastSource.js — qualquer formato que comece com YYYY-MM-DD).
// homeName/awayName: nomes dos times como a gente já conhece.
// Casa por dia (mesmo dia calendário do horário de início gravado no
// XMLTV) + os 2 nomes de time aparecendo no TÍTULO do programa (texto
// livre, ex.: "Brasileirão: Flamengo x Palmeiras ao vivo") — mais
// solto que o casamento estruturado (time-a-time) do
// broadcastSource.js, porque aqui só existe o título como string.
// Retorna o nome do canal (string) ou null se não achou nada.
async function fetchBroadcastFromEPG(dateISO, homeName, awayName) {
  const day = String(dateISO || "").slice(0, 10);
  if (!day || !homeName || !awayName) return null;

  await ensureFreshCache();
  if (!cache.programmes.length) return null;

  const hn = normalizeName(homeName);
  const an = normalizeName(awayName);
  const match = cache.programmes.find((p) => {
    if (p.start.toISOString().slice(0, 10) !== day) return false;
    const t = normalizeName(p.title);
    return t.includes(hn) && t.includes(an);
  });
  if (!match) return null;
  return cache.channels.get(match.channelId) || null;
}

module.exports = { fetchBroadcastFromEPG };
