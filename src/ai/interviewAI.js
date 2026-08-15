// Lógica de IA do InterviewLab: cada função aqui é um passo da jornada
// descrita no case (diagnóstico, perguntas personalizadas, feedback por
// resposta, feedback final, faixa salarial). Mantidos separados do
// transporte (services/claude.js) pra deixar os prompts fáceis de achar e
// ajustar sem mexer em código de infraestrutura.

const { askClaude, askClaudeJSON } = require('../services/claude');

const SYSTEM_BASE =
  'Você é o InterviewLab, um treinador de entrevistas de emprego especializado ' +
  'em vagas de Product Management. Seu tom é direto, encorajador e prático — ' +
  'como um mentor experiente que já contratou muitos PMs. Responda sempre em ' +
  'português do Brasil, em texto pronto para ser enviado no WhatsApp (frases ' +
  'curtas, sem markdown pesado, pode usar emojis com moderação).';

async function extractJobMeta(jobText) {
  return askClaudeJSON({
    system: SYSTEM_BASE,
    prompt:
      `Leia a descrição de vaga abaixo e extraia a empresa e o cargo.\n\n` +
      `Formato: {"company": string, "role": string}. Se não conseguir identificar algum campo, use null.\n\n` +
      `DESCRIÇÃO DA VAGA:\n"""\n${jobText}\n"""`,
    maxTokens: 200,
  });
}

async function generateDiagnosis({ resumeText, jobText }) {
  return askClaudeJSON({
    system: SYSTEM_BASE,
    prompt:
      `Compare o currículo do candidato com a vaga abaixo e gere um diagnóstico de compatibilidade.\n\n` +
      `Formato JSON:\n` +
      `{\n` +
      `  "matchScore": number (0 a 100),\n` +
      `  "strengths": string[] (3 a 5 pontos fortes do candidato para ESSA vaga específica),\n` +
      `  "gaps": string[] (2 a 4 lacunas ou riscos que podem pegar mal na entrevista),\n` +
      `  "highlight": string (UMA frase sobre o que o candidato deve destacar mais na entrevista),\n` +
      `  "summary": string (2-3 frases, tom de mensagem de WhatsApp, resumindo o diagnóstico pro candidato)\n` +
      `}\n\n` +
      `CURRÍCULO:\n"""\n${resumeText}\n"""\n\n` +
      `VAGA:\n"""\n${jobText}\n"""`,
    maxTokens: 900,
  });
}

async function generateQuestions({ resumeText, jobText, bankQuestions = [], count = 5 }) {
  const bankHint = bankQuestions.length
    ? `Perguntas que já sabemos que essa empresa/vagas parecidas costumam fazer (priorize adaptar algumas destas ao currículo do candidato):\n` +
      bankQuestions.map((q) => `- ${q.text}`).join('\n') + '\n\n'
    : '';

  const result = await askClaudeJSON({
    system: SYSTEM_BASE,
    prompt:
      `Gere ${count} perguntas de entrevista personalizadas para esse candidato e essa vaga de Product Manager. ` +
      `Misture perguntas comportamentais (storytelling, métricas, cases reais do currículo) com perguntas técnicas ` +
      `de produto (priorização, discovery, métricas de sucesso). Não seja genérico — cite contexto do currículo ou da vaga nas perguntas quando fizer sentido.\n\n` +
      bankHint +
      `Formato: {"questions": string[]}\n\n` +
      `CURRÍCULO:\n"""\n${resumeText}\n"""\n\n` +
      `VAGA:\n"""\n${jobText}\n"""`,
    maxTokens: 900,
  });
  return result.questions || [];
}

async function generateAnswerFeedback({ question, answerText, resumeText, jobText }) {
  return askClaudeJSON({
    system: SYSTEM_BASE,
    prompt:
      `O candidato respondeu a pergunta de entrevista abaixo. Dê um feedback estruturado e acionável, curto o suficiente para caber numa mensagem de WhatsApp.\n\n` +
      `Formato JSON:\n` +
      `{\n` +
      `  "score": number (0 a 10),\n` +
      `  "whatWorked": string (o que funcionou bem na resposta),\n` +
      `  "whatToAdjust": string (o que ajustar — seja específico, não genérico),\n` +
      `  "tip": string (uma dica prática e curta pra próxima resposta)\n` +
      `}\n\n` +
      `PERGUNTA: "${question}"\n\n` +
      `RESPOSTA DO CANDIDATO: "${answerText}"\n\n` +
      `CONTEXTO (currículo, resumido): """${resumeText.slice(0, 1500)}"""\n` +
      `CONTEXTO (vaga, resumido): """${jobText.slice(0, 1500)}"""`,
    maxTokens: 500,
  });
}

async function generateFinalFeedback({ resumeText, jobText, questions, answers }) {
  const transcript = questions
    .map((q, i) => `P${i + 1}: ${q.text}\nR${i + 1}: ${answers[i]?.text || '(sem resposta)'}`)
    .join('\n\n');

  return askClaudeJSON({
    system: SYSTEM_BASE,
    prompt:
      `A simulação de entrevista terminou. Com base na transcrição completa abaixo, gere o feedback final.\n\n` +
      `Formato JSON:\n` +
      `{\n` +
      `  "overallScore": number (0 a 10),\n` +
      `  "comparisonNote": string (frase curta comparando com o desempenho típico de outros candidatos nessa vaga/função — estimativa qualitativa, deixe claro que é uma estimativa),\n` +
      `  "topStrengths": string[] (exatamente 3, pontos de destaque na entrevista/currículo),\n` +
      `  "topImprovements": string[] (exatamente 3, itens pra estudar/melhorar antes da entrevista real),\n` +
      `  "questionsToAsk": string[] (exatamente 3 perguntas inteligentes pro candidato fazer à empresa)\n` +
      `}\n\n` +
      `CURRÍCULO:\n"""\n${resumeText}\n"""\n\n` +
      `VAGA:\n"""\n${jobText}\n"""\n\n` +
      `TRANSCRIÇÃO DA SIMULAÇÃO:\n"""\n${transcript}\n"""`,
    maxTokens: 1200,
  });
}

async function generateSalaryInsight({ jobText }) {
  return askClaude({
    system: SYSTEM_BASE,
    prompt:
      `Com base na vaga abaixo (empresa, senioridade, localização se houver), escreva uma mensagem curta de WhatsApp com:\n` +
      `1) uma estimativa de faixa salarial de mercado para essa posição no Brasil (deixe claro que é uma estimativa, não um dado exato),\n` +
      `2) 1-2 dicas práticas de como negociar essa pretensão salarial na entrevista.\n\n` +
      `VAGA:\n"""\n${jobText}\n"""`,
    maxTokens: 400,
  });
}

module.exports = {
  extractJobMeta,
  generateDiagnosis,
  generateQuestions,
  generateAnswerFeedback,
  generateFinalFeedback,
  generateSalaryInsight,
};
