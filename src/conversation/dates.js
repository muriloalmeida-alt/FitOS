// Parsing simples de data no formato brasileiro (dd/mm ou dd/mm/aaaa),
// usado só pra agendar o lembrete do dia da entrevista. Sem lib de datas —
// o caso de uso é estreito o suficiente pra não justificar a dependência.

function parseBrDate(text) {
  const match = text.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!match) return null;

  const [, dayStr, monthStr, yearStr] = match;
  const day = Number(dayStr);
  const month = Number(monthStr);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;

  const now = new Date();
  let year = yearStr ? Number(yearStr) : now.getFullYear();
  if (yearStr && yearStr.length === 2) year += 2000;

  let date = new Date(year, month - 1, day, 9, 0, 0); // 9h como horário padrão do lembrete
  if (!yearStr && date < now) {
    // Sem ano informado e a data já passou nesse ano — assume o próximo ano.
    date = new Date(year + 1, month - 1, day, 9, 0, 0);
  }
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

module.exports = { parseBrDate, addDays };
