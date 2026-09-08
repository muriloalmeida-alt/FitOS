// Testa o filtro de "times" placeholder da Sportmonks (AJUSTE 8 em
// server/src/providers/sportmonks.js) -- não dá pra testar getTeams()
// de ponta a ponta aqui (exigiria credencial real da Sportmonks, que
// este ambiente não tem acesso), então este script extrai a mesma
// regex usada em produção direto do arquivo fonte (garantindo que o
// teste nunca diverge do código real) e confere contra nomes reais
// de clube (não pode filtrar) e o padrão de placeholder reportado
// pelo usuário (deve filtrar).
const fs = require("fs");
const src = fs.readFileSync("/home/user/FitOS/server/src/providers/sportmonks.js", "utf8");
const m = src.match(/const PLACEHOLDER_TEAM_NAME = (\/.*\/i);/);
if (!m) { console.error("FATAL: não achou PLACEHOLDER_TEAM_NAME no arquivo fonte"); process.exit(1); }
const PLACEHOLDER_TEAM_NAME = eval(m[1]); // regex literal extraída do próprio arquivo

const casesQueDevemFiltrar = ["1st ranked", "2nd Ranked", "3rd ranked", "8th Ranked", "10th ranked", "21st ranked"];
const casesQueNaoDevemFiltrar = [
  "Anápolis", "Amazonas", "Operário Ferroviário", "Athletico Paranaense",
  "Vila Nova", "CRB", "Náutico", "São Bernardo", "1º de Maio", // nome de estádio real com número, não pode confundir
  "Ranking FC", // nome hipotético de clube que contém "rank" mas não bate o padrão exato
];

let ok = true;
for (const name of casesQueDevemFiltrar) {
  const filtered = PLACEHOLDER_TEAM_NAME.test(name);
  console.log(`filtra "${name}":`, filtered);
  if (!filtered) ok = false;
}
for (const name of casesQueNaoDevemFiltrar) {
  const filtered = PLACEHOLDER_TEAM_NAME.test(name);
  console.log(`NÃO filtra "${name}":`, !filtered);
  if (filtered) ok = false;
}
console.log(ok ? "TUDO OK" : "FALHOU");
process.exit(ok ? 0 : 1);
