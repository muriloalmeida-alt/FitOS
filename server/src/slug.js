/* Slug pra URL a partir do nome de um time (ou qualquer texto) —
   "Atlético-MG" -> "atletico-mg", "São Paulo" -> "sao-paulo".

   IMPORTANTE: essa MESMA função existe duplicada em public/js/app.js
   (slugifyTeamName) — o cliente precisa gerar o slug de forma
   IDÊNTICA ao servidor pra empurrar a URL certa no pushState (ver
   goToTeam) e pra resolver a URL de volta pro time certo ao abrir um
   link direto (ver applyInitialRoute). Se um dia isso mudar aqui,
   muda lá também — são só ~5 linhas, não vale a pena um pacote
   compartilhado só por causa disso (mesmo espírito zero-dependência
   do resto do projeto, servidor não importa nada do front-end e
   vice-versa). */
function slugify(name) {
  return String(name || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // remove acento (é -> e, ã -> a, ç -> c)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Slug de PARTIDA (pedido do usuário, 15/08/2026: "onde assistir e
// que horas é o jogo" como página própria indexável) — junta os 2
// times + a data (horário de Brasília, pra bater com o que qualquer
// visitante vê em qualquer parte do app) num slug só, ex.:
// "flamengo-x-palmeiras-15-08-2026". Usado só como parte COSMÉTICA da
// URL (/jogos/:fixtureId-slug) -- quem resolve a partida de verdade é
// sempre o fixtureId antes do primeiro "-", igual o mesmo padrão já
// usado em /times/:slug/jogadores/:id-slug (ver handlePlayerRoute em
// server.js). Sem data válida, cai só no "time-x-time" (2 times podem
// se enfrentar 2x na mesma temporada -- turno/returno -- mas como o
// fixtureId já garante unicidade sozinho, a data aqui é só pra
// leitura/SEO, não pra desambiguar de verdade).
//
// IMPORTANTE: essa MESMA função existe duplicada em public/js/app.js
// (matchSlug) — mesmo motivo/mesmo espírito do aviso de slugify()
// acima (cliente precisa gerar o slug de forma idêntica ao servidor).
function matchSlug(homeName, awayName, dateIso) {
  const d = dateIso ? new Date(dateIso) : null;
  const dateStr = d && !isNaN(d)
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" })
        .format(d).replace(/\//g, "-")
    : "";
  return [slugify(homeName), "x", slugify(awayName), dateStr].filter(Boolean).join("-");
}

module.exports = { slugify, matchSlug };
