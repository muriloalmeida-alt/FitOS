// Cliente fino da Claude API (Anthropic Messages API).
// Sem SDK — só fetch nativo do Node 18+, pra manter as dependências do
// projeto no mínimo. Docs: https://docs.anthropic.com/en/api/messages

const { config } = require('../config');

const API_URL = 'https://api.anthropic.com/v1/messages';

async function askClaude({ system, prompt, maxTokens = 1024 }) {
  if (!config.anthropic.apiKey) {
    throw new Error('ANTHROPIC_API_KEY não configurada — ver .env.example');
  }
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.anthropic.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.anthropic.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude API falhou (${res.status}): ${body}`);
  }

  const data = await res.json();
  return (data.content || []).map((block) => block.text || '').join('').trim();
}

// Pede uma resposta em JSON e faz o parse, tolerando o modelo envolver o
// JSON em ```json ... ``` (comum mesmo quando instruído a não fazer isso).
async function askClaudeJSON({ system, prompt, maxTokens = 1024 }) {
  const text = await askClaude({
    system: `${system}\n\nResponda SOMENTE com um JSON válido, sem texto antes ou depois, sem markdown.`,
    prompt,
    maxTokens,
  });
  const cleaned = text.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Claude não retornou JSON válido: ${err.message}\nResposta bruta: ${text}`);
  }
}

module.exports = { askClaude, askClaudeJSON };
