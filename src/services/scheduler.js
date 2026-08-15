// Dispara os dois momentos assíncronos do fluxo: o lembrete no dia da
// entrevista real e o follow-up 24h depois. Como é um único processo
// sempre no ar (deploy tipo Railway/Docker), um setInterval simples
// checando lembretes pendentes é suficiente pro MVP — sem precisar de
// fila/job runner externo.

const store = require('../db/store');
const whatsapp = require('./whatsapp');

const CHECK_INTERVAL_MS = 60 * 1000; // checa a cada minuto

const REMINDER_MESSAGE =
  '🍀 Hoje é o dia! Respira fundo, você se preparou pra isso.\n\n' +
  'Lembra: destaque suas forças, seja específico com números/exemplos, e faça as perguntas que combinamos pra empresa.\n\n' +
  'Boa entrevista! Depois me conta como foi 🙌';

const FOLLOWUP_MESSAGE =
  'E aí, como foi a entrevista? 👀\n\n' +
  'Me conta como se sentiu e, se lembrar, quais perguntas caíram — isso ajuda a gente a deixar as próximas simulações ainda mais parecidas com a entrevista real.';

async function processDueReminders() {
  const due = store.listDueReminders(new Date());
  for (const reminder of due) {
    try {
      if (reminder.type === 'day-of') {
        await whatsapp.sendText(reminder.waId, REMINDER_MESSAGE);
        store.updateSession(reminder.sessionId, { reminderSent: true });
      } else if (reminder.type === 'followup-24h') {
        await whatsapp.sendText(reminder.waId, FOLLOWUP_MESSAGE);
        // Move a sessão pro estado que espera a resposta do follow-up,
        // pra próxima mensagem do usuário ser tratada como relato da entrevista.
        store.updateSession(reminder.sessionId, { status: 'awaiting_followup_response' });
      }
      store.markReminderSent(reminder.id);
    } catch (err) {
      console.error(`Falha processando lembrete ${reminder.id} (${reminder.type}):`, err.message);
      // Não marca como enviado — tenta de novo no próximo ciclo.
    }
  }
}

function startScheduler() {
  const timer = setInterval(() => {
    processDueReminders().catch((err) => console.error('Erro no scheduler:', err));
  }, CHECK_INTERVAL_MS);
  timer.unref?.(); // não impede o processo de encerrar em testes/scripts
  return timer;
}

module.exports = { startScheduler, processDueReminders };
