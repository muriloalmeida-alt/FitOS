// Máquina de estados da conversa do InterviewLab.
//
// Cada sessão (uma preparação pra uma vaga específica) caminha por:
// collecting_job -> collecting_resume -> ready_to_start -> interviewing
//   -> awaiting_interview_date -> reminder_scheduled -> awaiting_followup_response -> done
//
// Esse módulo só orquestra: baixa mídia, chama a IA, formata e manda
// mensagens, e persiste o estado a cada passo — assim uma reinicialização
// do processo no meio de uma conversa não perde o lugar do usuário.

const crypto = require('crypto');
const store = require('../db/store');
const whatsapp = require('../services/whatsapp');
const ai = require('../ai/interviewAI');
const { extractResumeText } = require('../services/resumeParser');
const { fetchJobText } = require('../services/jobScraper');
const { transcribeAudio } = require('../services/transcription');
const { synthesizeSpeech } = require('../services/tts');
const { config } = require('../config');
const { parseBrDate, addDays } = require('./dates');
const { formatDiagnosis, formatAnswerFeedback, formatFinalFeedback, formatHelp } = require('./format');

const URL_RE = /https?:\/\/\S+/i;
const QUESTIONS_PER_SIMULATION = 5;

async function handleIncomingMessage(msg) {
  const user = store.getUser(msg.waId) || store.upsertUser(msg.waId, { name: msg.name });
  if (msg.name && msg.name !== user.name) store.upsertUser(msg.waId, { name: msg.name });

  const rawText = (msg.text || '').trim();
  const normalized = rawText.toLowerCase();

  try {
    if (['ajuda', 'help', 'menu'].includes(normalized)) {
      await whatsapp.sendText(msg.waId, formatHelp());
      return;
    }

    if (['nova simulação', 'nova simulacao', 'novo', 'reiniciar'].includes(normalized)) {
      await startNewSession(user);
      return;
    }

    const session = store.getActiveSession(msg.waId);

    if (!session || session.status === 'done') {
      await startNewSession(user, msg);
      return;
    }

    switch (session.status) {
      case 'collecting_job':
        return await handleJobLink(msg, session);
      case 'collecting_resume':
        return await handleResume(msg, session);
      case 'ready_to_start':
        return await handleReadyToStart(msg, session);
      case 'interviewing':
        return await handleInterviewAnswer(msg, session);
      case 'awaiting_interview_date':
        return await handleInterviewDate(msg, session);
      case 'reminder_scheduled':
        await whatsapp.sendText(
          msg.waId,
          'Seu lembrete pra entrevista já tá agendado ✅. Se quiser treinar outra vaga, manda *"nova simulação"*.'
        );
        return;
      case 'awaiting_followup_response':
        return await handleFollowupResponse(msg, session);
      default:
        await startNewSession(user, msg);
    }
  } catch (err) {
    console.error(`Erro processando mensagem de ${msg.waId}:`, err);
    await whatsapp
      .sendText(
        msg.waId,
        'Ih, deu um erro aqui do meu lado processando isso 😕. Pode tentar de novo? Se persistir, manda *"nova simulação"* pra recomeçar.'
      )
      .catch(() => {});
  }
}

// ── Passo 1: boas-vindas + link da vaga ─────────────────────────────────

async function startNewSession(user, msg) {
  store.createSession(user.waId);
  await whatsapp.sendText(
    user.waId,
    `Oi${user.name ? `, ${user.name.split(' ')[0]}` : ''}! 👋 Aqui é o *InterviewLab*.\n\n` +
      'Eu te ajudo a treinar pra uma entrevista de emprego (foco em vagas de Product Manager por enquanto): simulo a entrevista, dou feedback por resposta e no final te digo o que destacar e o que estudar.\n\n' +
      'Pra começar, me manda o *link da vaga* (LinkedIn, Gupy, site da empresa etc). Se o link não abrir direito pra mim, também pode colar a descrição da vaga em texto.'
  );
}

async function handleJobLink(msg, session) {
  const text = msg.text || '';
  const urlMatch = text.match(URL_RE);

  let jobText;
  let jobUrl = null;

  if (urlMatch) {
    jobUrl = urlMatch[0];
    await whatsapp.sendText(session.waId, '🔎 Dando uma olhada na vaga...');
    try {
      jobText = await fetchJobText(jobUrl);
    } catch (err) {
      await whatsapp.sendText(
        session.waId,
        `Não consegui ler esse link automaticamente (${err.message}). Pode colar aqui a descrição da vaga em texto (cargo, empresa, requisitos)?`
      );
      return;
    }
  } else if (text.length > 80) {
    // Sem link reconhecido, mas texto longo o suficiente pra ser a própria descrição colada.
    jobText = text;
  } else {
    await whatsapp.sendText(
      session.waId,
      'Não achei um link válido aí. Manda o link da vaga, ou cola a descrição completa da vaga em texto.'
    );
    return;
  }

  let jobMeta = { company: null, role: null };
  try {
    jobMeta = await ai.extractJobMeta(jobText);
  } catch (err) {
    console.warn('Falha extraindo metadata da vaga (seguindo sem isso):', err.message);
  }

  store.updateSession(session.id, { jobUrl, jobText, jobMeta, status: 'collecting_resume' });

  await whatsapp.sendText(
    session.waId,
    `Beleza${jobMeta.role ? `, vaga de *${jobMeta.role}*` : ''}${jobMeta.company ? ` na *${jobMeta.company}*` : ''} anotada ✅\n\n` +
      'Agora me manda o seu *currículo em PDF*, direto aqui no chat.'
  );
}

// ── Passo 2: currículo ───────────────────────────────────────────────────

async function handleResume(msg, session) {
  if (msg.type !== 'document' || msg.document?.mimeType !== 'application/pdf') {
    await whatsapp.sendText(
      session.waId,
      'Preciso do seu currículo em *PDF* — manda o arquivo aqui no chat (como documento, não como foto).'
    );
    return;
  }

  await whatsapp.sendText(session.waId, '📄 Lendo seu currículo...');

  let resumeText;
  try {
    const { buffer } = await whatsapp.downloadMedia(msg.document.id);
    resumeText = await extractResumeText(buffer);
  } catch (err) {
    await whatsapp.sendText(
      session.waId,
      `Não consegui extrair o texto desse PDF (${err.message}). Pode tentar mandar outro arquivo?`
    );
    return;
  }

  await whatsapp.sendText(session.waId, '🧠 Comparando seu currículo com a vaga, um minuto...');

  const diagnosis = await ai.generateDiagnosis({ resumeText, jobText: session.jobText });
  store.updateSession(session.id, { resumeText, diagnosis, status: 'ready_to_start' });

  await whatsapp.sendText(session.waId, formatDiagnosis(diagnosis));
}

// ── Passo 3: início da simulação ─────────────────────────────────────────

async function handleReadyToStart(msg, session) {
  const normalized = (msg.text || '').trim().toLowerCase();
  if (!['começar', 'comecar', 'start', 'vamos', 'bora'].includes(normalized)) {
    await whatsapp.sendText(
      session.waId,
      'Quando quiser começar a simulação de entrevista, é só mandar *"começar"*.'
    );
    return;
  }

  const bankQuestions = store.getQuestionsFromBank(session.jobMeta?.company, session.jobMeta?.role, 8);
  const questionTexts = await ai.generateQuestions({
    resumeText: session.resumeText,
    jobText: session.jobText,
    bankQuestions,
    count: QUESTIONS_PER_SIMULATION,
  });

  const questions = questionTexts.map((text) => ({ id: crypto.randomUUID(), text }));
  store.updateSession(session.id, {
    questions,
    currentQuestionIndex: 0,
    answers: [],
    status: 'interviewing',
  });

  await whatsapp.sendText(
    session.waId,
    `Vamos lá! São ${questions.length} perguntas, uma de cada vez. Pode responder em *texto ou áudio*.\n\n` +
      'Pergunta 1:'
  );
  await sendQuestion(session.waId, questions[0]);
}

async function sendQuestion(waId, question) {
  await whatsapp.sendText(waId, question.text);
  if (config.tts.enabled) {
    try {
      const { buffer, mimeType } = await synthesizeSpeech(question.text);
      await whatsapp.sendAudioBuffer(waId, buffer, mimeType);
    } catch (err) {
      console.warn('TTS falhou (seguindo só com texto):', err.message);
    }
  }
}

// ── Passo 4: respostas da simulação ──────────────────────────────────────

async function handleInterviewAnswer(msg, session) {
  let answerText;

  if (msg.type === 'audio') {
    await whatsapp.sendText(session.waId, '🎧 Ouvindo sua resposta...');
    try {
      const { buffer, mimeType } = await whatsapp.downloadMedia(msg.audio.id);
      answerText = await transcribeAudio(buffer, mimeType);
    } catch (err) {
      await whatsapp.sendText(
        session.waId,
        `Não consegui processar esse áudio (${err.message}). Pode responder em texto?`
      );
      return;
    }
  } else if (msg.type === 'text' && msg.text) {
    answerText = msg.text;
  } else {
    await whatsapp.sendText(session.waId, 'Responde em texto ou áudio pra eu continuar 🙂');
    return;
  }

  const question = session.questions[session.currentQuestionIndex];
  const feedback = await ai.generateAnswerFeedback({
    question: question.text,
    answerText,
    resumeText: session.resumeText,
    jobText: session.jobText,
  });

  const answers = [...session.answers, { questionId: question.id, text: answerText, feedback }];
  const nextIndex = session.currentQuestionIndex + 1;

  await whatsapp.sendText(
    session.waId,
    formatAnswerFeedback(feedback, session.currentQuestionIndex + 1, session.questions.length)
  );

  if (nextIndex < session.questions.length) {
    store.updateSession(session.id, { answers, currentQuestionIndex: nextIndex });
    await whatsapp.sendText(session.waId, `Pergunta ${nextIndex + 1}:`);
    await sendQuestion(session.waId, session.questions[nextIndex]);
    return;
  }

  store.updateSession(session.id, { answers, currentQuestionIndex: nextIndex });
  await finishInterview({ ...session, answers });
}

async function finishInterview(session) {
  await whatsapp.sendText(session.waId, '✅ Últimas perguntas! Calculando seu feedback final...');

  const finalFeedback = await ai.generateFinalFeedback({
    resumeText: session.resumeText,
    jobText: session.jobText,
    questions: session.questions,
    answers: session.answers,
  });

  await whatsapp.sendText(session.waId, formatFinalFeedback(finalFeedback));

  try {
    const salaryInsight = await ai.generateSalaryInsight({ jobText: session.jobText });
    await whatsapp.sendText(session.waId, `💰 *Sobre a pretensão salarial:*\n\n${salaryInsight}`);
  } catch (err) {
    console.warn('Falha gerando insight salarial (seguindo sem isso):', err.message);
  }

  store.updateSession(session.id, { finalFeedback, status: 'awaiting_interview_date' });

  await whatsapp.sendText(
    session.waId,
    'Você já tem a *data da entrevista real* marcada? Me manda no formato dd/mm (ex: 20/08) que eu te mando um lembrete com os pontos-chave antes de você entrar.\n\n' +
      'Se ainda não tiver data, manda *"pular"*.'
  );
}

// ── Passo 5: agendar lembrete do dia da entrevista ───────────────────────

async function handleInterviewDate(msg, session) {
  const normalized = (msg.text || '').trim().toLowerCase();
  if (['pular', 'skip', 'não', 'nao', 'ainda não', 'ainda nao'].includes(normalized)) {
    store.updateSession(session.id, { status: 'done' });
    await whatsapp.sendText(
      session.waId,
      'Sem problema! Boa sorte na busca 🍀. Quando quiser treinar de novo (essa vaga ou outra), manda *"nova simulação"*.'
    );
    return;
  }

  const interviewDate = parseBrDate(msg.text || '');
  if (!interviewDate) {
    await whatsapp.sendText(
      session.waId,
      'Não entendi a data. Manda no formato dd/mm (ex: 20/08), ou *"pular"* se ainda não tiver marcada.'
    );
    return;
  }

  const followupDate = addDays(interviewDate, 1);

  store.scheduleReminder({
    sessionId: session.id,
    waId: session.waId,
    type: 'day-of',
    dueAt: interviewDate.toISOString(),
  });
  store.scheduleReminder({
    sessionId: session.id,
    waId: session.waId,
    type: 'followup-24h',
    dueAt: followupDate.toISOString(),
  });

  store.updateSession(session.id, {
    interviewDate: interviewDate.toISOString(),
    status: 'reminder_scheduled',
  });

  await whatsapp.sendText(
    session.waId,
    `Combinado! No dia ${interviewDate.toLocaleDateString('pt-BR')} eu te mando uma mensagem de boa sorte relembrando seus pontos-chave. Bora com tudo! 💪`
  );
}

// ── Passo 6: follow-up 24h depois (alimenta o banco de perguntas) ───────

async function handleFollowupResponse(msg, session) {
  let answerText;
  if (msg.type === 'audio') {
    try {
      const { buffer, mimeType } = await whatsapp.downloadMedia(msg.audio.id);
      answerText = await transcribeAudio(buffer, mimeType);
    } catch (err) {
      await whatsapp.sendText(session.waId, `Não consegui ouvir esse áudio (${err.message}). Pode escrever?`);
      return;
    }
  } else {
    answerText = msg.text || '';
  }

  // Extração simples: qualquer linha/frase terminando em "?" vira candidata
  // pro banco de perguntas — sem chamada extra de IA pra manter isso barato.
  const extractedQuestions = answerText
    .split(/\n|(?<=\?)\s+/)
    .map((s) => s.trim())
    .filter((s) => s.endsWith('?') && s.length > 10);

  if (extractedQuestions.length) {
    store.addQuestionsToBank(session.jobMeta?.company, session.jobMeta?.role, extractedQuestions, 'user-feedback');
  }

  store.updateSession(session.id, { status: 'done' });

  await whatsapp.sendText(
    session.waId,
    'Muito obrigado por contar! Isso ajuda a gente a preparar melhor os próximos candidatos pra essa vaga/empresa 🙏\n\n' +
      'Quando quiser treinar pra próxima entrevista, é só mandar *"nova simulação"*.'
  );
}

module.exports = { handleIncomingMessage };
