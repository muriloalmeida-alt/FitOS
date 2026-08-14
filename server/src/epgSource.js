/* Busca (best-effort) a emissora de TV de uma partida via um feed
   XMLTV público (open-epg.com, agregador comunitário de grade de
   programação — mesmo espírito do broadcastSource.js: fonte
   independente, gratuita, não é registro oficial de direitos de
   transmissão, pode vir vazia/desatualizada/imprecisa).

   HISTÓRICO (útil se trocar de fonte de novo):
   1ª versão usava epgshare01.online (epg_ripper_BR1.xml.gz,
   comprimido). Trocado pra open-epg.com/files/brazil1.xml (indicado
   pelo usuário, que confirmou ter os canais que precisamos — Premiere,
   SporTV etc.) — mas esse arquivo NÃO é comprimido (.xml puro, não
   .xml.gz). Por isso refreshCache() abaixo detecta gzip pelos BYTES
   MÁGICOS do arquivo (0x1f 0x8b no início) em vez de confiar na
   extensão da URL — funciona com as duas fontes (comprimida ou não)
   sem precisar saber de antemão qual é qual.

   AVISO da fonte atual (open-epg.com, conferido via pesquisa pública):
   arquivo cobre só ~2 DIAS de grade (bem mais curto que o epgshare01),
   atualiza 1x/dia (~20h CET), limite de 20 downloads/dia por IP — o
   refresh a cada 12h daqui fica bem dentro desse limite (2x/dia). Jogo
   marcado pra mais de 2 dias no futuro ainda não vai aparecer na grade
   até chegar mais perto da data — isso é esperado, não é bug (a
   própria emissora também só define/publica a programação perto do
   jogo, então nem uma fonte "oficial" teria isso com muita
   antecedência).

   AVISO IMPORTANTE (pedido pelo usuário, avaliado antes de implementar
   epgshare01 — ver histórico da conversa; mesma ressalva vale pra
   qualquer EPG comunitário, incluindo esse): não é registro oficial de
   direitos de transmissão — pode vir vazio, desatualizado ou
   impreciso. Se na prática vier sempre vazio, o /api/broadcast já cai
   pro broadcastSource.js (TheSportsDB) sozinho, sem quebrar nada.
   (Sportmonks tvStations foi tentada como fonte nativa/paga antes
   dessa, mas foi removida — devolvia lista genérica de emissoras
   possíveis, não o canal daquele jogo específico, ver server.js.)

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

const EPG_URL = process.env.EPG_URL || "https://www.open-epg.com/files/brazil1.xml";
const REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12h — bem dentro do limite de 20 downloads/dia do open-epg.com

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

// Métricas de tráfego (pedido pelo usuário: acompanhar tráfego/
// sucesso/falha do EPG na área administrativa, ver GET
// /api/adminpanel/integrations em server.js) — só em memória, zera a
// cada restart/deploy, mesmo espírito de sportmonksClient.js. 2
// camadas separadas de propósito: "downloads" é a busca do arquivo em
// si (1x a cada REFRESH_INTERVAL_MS, ou quando falha e tenta nas
// próximas), "lookups" é cada CONSULTA (fetchBroadcastFromEPG, 1 por
// jogo pendente que alguém abriu na tela) — dá pra ter download
// sempre com sucesso mas taxa de "achou" baixa (fonte comunitária sem
// aquele canal específico), então separar os 2 importa pra entender
// onde está o problema.
let stats = {
  downloads: { total: 0, success: 0, failures: 0, lastAt: null, lastSuccessAt: null, lastFailureAt: null, lastFailureMessage: null },
  lookups: { total: 0, found: 0, notFound: 0, lastAt: null },
};
function trackDownload(ok, errMsg) {
  stats.downloads.total++;
  stats.downloads.lastAt = Date.now();
  if (ok) { stats.downloads.success++; stats.downloads.lastSuccessAt = Date.now(); }
  else { stats.downloads.failures++; stats.downloads.lastFailureAt = Date.now(); stats.downloads.lastFailureMessage = errMsg || null; }
}
function trackLookup(found) {
  stats.lookups.total++;
  stats.lookups.lastAt = Date.now();
  if (found) stats.lookups.found++; else stats.lookups.notFound++;
}
function getStats() { return JSON.parse(JSON.stringify(stats)); } // cópia defensiva, mesmo espírito de sportmonksClient.getStats()

async function refreshCache() {
  const res = await fetch(EPG_URL);
  if (!res.ok) throw new Error(`EPG (${EPG_URL}) respondeu ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // Detecta gzip pelos 2 primeiros bytes do arquivo (assinatura padrão
  // 0x1f 0x8b), não pela extensão da URL nem pelo header Content-Type
  // (nenhum dos dois é totalmente confiável) — funciona tanto com um
  // .xml.gz quanto com um .xml puro sem precisar configurar nada
  // diferente por fonte.
  const isGzip = buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b;
  const xml = (isGzip ? zlib.gunzipSync(buf) : buf).toString("utf8");
  const parsed = parseXMLTV(xml);
  cache = { ...parsed, fetchedAt: Date.now() };
  console.log(`[epg] atualizado (${isGzip ? "gzip" : "texto puro"}) — ${parsed.channels.size} canais esportivos reconhecidos, ${parsed.programmes.length} programas na grade.`);
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
      .then(() => trackDownload(true))
      .catch((err) => { trackDownload(false, err.message); console.error("[epg] falha ao atualizar o feed:", err.message); })
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
  if (!day || !homeName || !awayName) return null; // parâmetro faltando -- não é uma tentativa de busca de verdade, não conta como lookup

  await ensureFreshCache();
  if (!cache.programmes.length) { trackLookup(false); return null; }

  const hn = normalizeName(homeName);
  const an = normalizeName(awayName);
  const match = cache.programmes.find((p) => {
    if (p.start.toISOString().slice(0, 10) !== day) return false;
    const t = normalizeName(p.title);
    return t.includes(hn) && t.includes(an);
  });
  trackLookup(!!match);
  if (!match) return null;
  return cache.channels.get(match.channelId) || null;
}

module.exports = { fetchBroadcastFromEPG, getStats };
