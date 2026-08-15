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

module.exports = { slugify };
