// Text-to-speech opcional: envia as perguntas da entrevista também como
// nota de voz, pra deixar a simulação mais próxima de uma entrevista real
// ("Áudio = realismo" — case do produto). Desligado por padrão
// (TTS_ENABLED=false) porque adiciona custo por chamada; o fluxo de
// conversa funciona 100% em texto sem isso.

const { config } = require('../config');

async function synthesizeSpeech(text) {
  if (!config.openai.apiKey) {
    throw new Error('OPENAI_API_KEY não configurada — necessária para gerar áudio (TTS).');
  }
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openai.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      voice: config.tts.voice,
      input: text,
      response_format: 'mp3',
    }),
  });
  if (!res.ok) {
    throw new Error(`Falha gerando áudio (${res.status}): ${await res.text()}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, mimeType: 'audio/mpeg' };
}

module.exports = { synthesizeSpeech };
