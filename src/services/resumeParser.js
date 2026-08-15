// Extrai texto de um currículo em PDF enviado pelo candidato no chat.

const pdfParse = require('pdf-parse');

async function extractResumeText(buffer) {
  const { text } = await pdfParse(buffer);
  const cleaned = text.replace(/\n{3,}/g, '\n\n').trim();
  if (cleaned.length < 30) {
    throw new Error(
      'Não consegui ler texto suficiente desse PDF (pode ser um currículo escaneado/imagem).'
    );
  }
  return cleaned;
}

module.exports = { extractResumeText };
