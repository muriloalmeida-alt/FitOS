// Carrega e valida as variáveis de ambiente usadas pelo InterviewLab.
// Mantém tudo num só lugar pra facilitar auditoria do que o app precisa
// pra rodar (ver .env.example).

require('dotenv').config();

function bool(value, fallback = false) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

const config = {
  port: Number(process.env.PORT) || 8787,
  dataDir: process.env.DATA_DIR || './data',

  whatsapp: {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
    appSecret: process.env.WHATSAPP_APP_SECRET || '',
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v20.0',
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },

  tts: {
    enabled: bool(process.env.TTS_ENABLED, false),
    voice: process.env.TTS_VOICE || 'alloy',
  },
};

// Falhas de configuração que impedem o app de funcionar de verdade —
// avisamos no boot em vez de deixar o primeiro webhook explodir sem contexto.
function warnMissingConfig() {
  const missing = [];
  if (!config.whatsapp.accessToken) missing.push('WHATSAPP_ACCESS_TOKEN');
  if (!config.whatsapp.phoneNumberId) missing.push('WHATSAPP_PHONE_NUMBER_ID');
  if (!config.whatsapp.verifyToken) missing.push('WHATSAPP_VERIFY_TOKEN');
  if (!config.anthropic.apiKey) missing.push('ANTHROPIC_API_KEY');

  if (missing.length) {
    console.warn(
      `⚠️  Faltam variáveis de ambiente: ${missing.join(', ')}. ` +
        'O servidor sobe, mas essas funcionalidades vão falhar até você configurá-las (ver .env.example).'
    );
  }
  if (!config.openai.apiKey) {
    console.warn(
      '⚠️  OPENAI_API_KEY não configurada — transcrição de áudio (respostas faladas) e TTS ficam indisponíveis.'
    );
  }
}

module.exports = { config, warnMissingConfig };
