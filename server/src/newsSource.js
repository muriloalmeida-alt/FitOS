/* Busca e faz parse de um feed RSS de notícias sobre futebol
   brasileiro. Fonte padrão: busca do Google Notícias (formato
   confirmado em funcionamento, mas NÃO documentado oficialmente pelo
   Google — pode mudar sem aviso). Agrega notícias de vários veículos
   brasileiros de verdade, filtradas por "Brasileirão"/"futebol
   brasileiro".

   Dá pra trocar por qualquer outro feed RSS (de um veículo
   específico, por exemplo) via a variável de ambiente NEWS_RSS_URL —
   não precisa mexer no código, só apontar pra outra URL .xml/.rss.
   Sem dependências externas: parse feito com regex mesmo (RSS 2.0 é
   simples o bastante pra isso), igual ao resto do backend. */
const DEFAULT_NEWS_RSS_URL =
  "https://news.google.com/rss/search?q=Brasileir%C3%A3o%20OR%20%22futebol%20brasileiro%22&hl=pt-BR&gl=BR&ceid=BR:pt-419";

function decodeEntities(str) {
  return String(str || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&") // por último, pra não decodificar "&amp;amp;" errado
    .trim();
}

function extractTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? decodeEntities(m[1]) : "";
}

// <source url="https://ge.globo.com">ge.globo.com</source>
function extractSource(block) {
  const m = block.match(/<source\b[^>]*url="([^"]*)"[^>]*>([\s\S]*?)<\/source>/i);
  if (!m) return null;
  return { url: m[1], name: decodeEntities(m[2]) };
}

function parseRssItems(xml, limit) {
  const items = [];
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml)) && items.length < limit) {
    const block = m[1];
    let title = extractTag(block, "title");
    const link = extractTag(block, "link");
    const pubDate = extractTag(block, "pubDate");
    const source = extractSource(block);
    // O Google Notícias já bota " - Nome do Veículo" no fim do
    // título — tira daí, já que a gente mostra a fonte separada.
    if (source && source.name && title.endsWith(` - ${source.name}`)) {
      title = title.slice(0, title.length - source.name.length - 3).trim();
    }
    if (!title || !link) continue;
    items.push({ title, link, pubDate: pubDate || null, source: source ? source.name : null });
  }
  return items;
}

// Quando teamName é passado (ver "Clube Favorito" no Dashboard), busca
// notícias daquele time específico em vez do feed genérico de
// Brasileirão — mesmo mecanismo do Google Notícias, só troca o "q=" da
// busca. Ignora NEWS_RSS_URL nesse caso (aquela variável é pra trocar o
// feed padrão inteiro, não faz sentido pra uma busca por time).
function newsUrlFor(teamName) {
  if (teamName) {
    const q = encodeURIComponent(`"${teamName}" futebol`);
    return `https://news.google.com/rss/search?q=${q}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
  }
  return process.env.NEWS_RSS_URL || DEFAULT_NEWS_RSS_URL;
}

async function fetchNews(limit = 20, teamName = null) {
  const url = newsUrlFor(teamName);
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; BRDATA/1.0; +https://github.com)" },
  });
  if (!res.ok) throw new Error(`RSS respondeu ${res.status}`);
  const xml = await res.text();
  return parseRssItems(xml, limit);
}

module.exports = { fetchNews, parseRssItems, DEFAULT_NEWS_RSS_URL };
