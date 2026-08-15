// Transcrição de áudio (respostas faladas do candidato na simulação).
//
// Claude ainda não recebe áudio nativamente, então transcrevemos antes de
// mandar pra IA. Implementado com a API Whisper da OpenAI por ser a opção
// mais simples de plugar — a interface (transcribeAudio) foi isolada aqui
// de propósito pra trocar de provedor (Deepgram, Google STT, AssemblyAI...)
// sem tocar no resto do app.

const { config } = require('../config');

async function transcribeAudio(buffer, mimeType = 'audio/ogg', filename = 'audio.ogg') {
  if (!config.openai.apiKey) {
    throw new Error(
      'OPENAI_API_KEY não configurada — necessária para transcrever respostas em áudio (ver .env.example).'
    );
  }

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType }), filename);
  form.append('model', 'whisper-1');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.openai.apiKey}` },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Falha transcrevendo áudio (${res.status}): ${await res.text()}`);
  }

  const { text } = await res.json();
  return text.trim();
}

module.exports = { transcribeAudio };
