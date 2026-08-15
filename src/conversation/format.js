// Formata as respostas da IA em mensagens de WhatsApp (texto corrido,
// sem markdown pesado — WhatsApp só renderiza *negrito*, _itálico_ e
// bullets simples com "-").

function formatDiagnosis(diagnosis) {
  const { matchScore, strengths = [], gaps = [], highlight, summary } = diagnosis;
  const lines = [
    `📋 *Diagnóstico de compatibilidade*`,
    ``,
    `Match com a vaga: *${matchScore}/100*`,
    ``,
    summary || '',
    ``,
    `✅ *Seus pontos fortes pra essa vaga:*`,
    ...strengths.map((s) => `- ${s}`),
    ``,
    `⚠️ *Fique de olho:*`,
    ...gaps.map((g) => `- ${g}`),
  ];
  if (highlight) {
    lines.push('', `💡 ${highlight}`);
  }
  lines.push(
    '',
    'Vamos simular a entrevista? Faço algumas perguntas, uma de cada vez — pode responder em texto ou áudio (recomendo áudio, fica mais parecido com a entrevista real).',
    '',
    'Quando estiver pronto(a), manda *"começar"*.'
  );
  return lines.join('\n');
}

function formatAnswerFeedback(feedback, questionNumber, totalQuestions) {
  const { score, whatWorked, whatToAdjust, tip } = feedback;
  return [
    `Nota da resposta ${questionNumber}/${totalQuestions}: *${score}/10*`,
    ``,
    `👍 O que funcionou: ${whatWorked}`,
    `🔧 O que ajustar: ${whatToAdjust}`,
    `💡 Dica: ${tip}`,
  ].join('\n');
}

function formatFinalFeedback(finalFeedback) {
  const { overallScore, comparisonNote, topStrengths = [], topImprovements = [], questionsToAsk = [] } =
    finalFeedback;
  return [
    `🏁 *Feedback final da simulação*`,
    ``,
    `Nota geral: *${overallScore}/10*`,
    comparisonNote ? `_${comparisonNote}_` : '',
    ``,
    `🌟 *Top 3 forças:*`,
    ...topStrengths.map((s, i) => `${i + 1}. ${s}`),
    ``,
    `📚 *Top 3 melhorias pra estudar:*`,
    ...topImprovements.map((s, i) => `${i + 1}. ${s}`),
    ``,
    `❓ *Perguntas inteligentes pra você fazer à empresa:*`,
    ...questionsToAsk.map((s, i) => `${i + 1}. ${s}`),
  ]
    .filter(Boolean)
    .join('\n');
}

function formatHelp() {
  return [
    'Aqui é o *InterviewLab* 🎯 — treino entrevistas de emprego (foco em vagas de Product Manager).',
    '',
    'Comandos:',
    '- *nova simulação* — começa uma preparação do zero (nova vaga + currículo)',
    '- *começar* — inicia a simulação depois do diagnóstico',
    '- *pular* — pula uma etapa opcional (ex: não marcar lembrete)',
    '- *ajuda* — mostra essa mensagem',
  ].join('\n');
}

module.exports = { formatDiagnosis, formatAnswerFeedback, formatFinalFeedback, formatHelp };
