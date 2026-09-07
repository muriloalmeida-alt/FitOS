/* Notificações push (Web Push) do Modo Técnico — pedido do usuário:
   sugeri como melhoria ("o maior buraco de retenção que ainda existe"
   — o lembrete de streak de login diário só funcionava com o app
   ABERTO) e ele confirmou implementar. Escopo desta 1ª entrega
   (AskUserQuestion): só o lembrete de streak — a infra abaixo
   (assinar/desinscrever/enviar) fica pronta pra outros gatilhos
   futuros (rodada parada, objetivo quase completo etc.) sem
   retrabalho nenhum, só chamar sendNotification() de outro lugar.

   DECISÃO DE ARQUITETURA (AskUserQuestion) — 1ª dependência externa
   de verdade do servidor: o resto do backend é "Node puro" de
   propósito (ver comentário no topo de users.js/careerStore.js), mas
   o protocolo Web Push exige assinar um JWT (VAPID, RFC 8292) E
   criptografar o payload (aes128gcm, RFC 8291) — reimplementar isso
   só com o módulo crypto nativo era a alternativa "zero dependências"
   oferecida, só que council optou pela lib "web-push" (testada em
   produção por milhares de apps) em vez de reinventar essa parte
   criptográfica à mão. Isso mudou o Dockerfile (agora roda
   `npm install` no build — antes não rodava nada) e
   server/package.json ganhou seu primeiro "dependencies" de verdade. */
const webpush = require("web-push");
const users = require("./users");

let configured = false;

// Lido 1x no boot (ver require deste módulo em server.js) — igual ao
// padrão já usado por mercadoPago.js/sportmonks.js: sem as 3 variáveis
// de ambiente, a feature fica sempre DESLIGADA (nunca quebra o resto
// do app, só não oferece a função), nunca lança nem loga erro alto.
function configure() {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(
    VAPID_SUBJECT || "mailto:contato@example.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  configured = true;
  return true;
}
configure();

function isEnabled() {
  return configured;
}

// Chave pública — não é segredo (o navegador precisa dela pra
// assinar via pushManager.subscribe), mas só faz sentido devolver
// quando a feature está de fato configurada.
function publicKey() {
  return configured ? process.env.VAPID_PUBLIC_KEY : null;
}

// Envia 1 notificação. Devolve:
//   { ok: true }
//   { ok: false, expired: true }  — assinatura morta (410 Gone/404 Not
//     Found: navegador desinstalou o app, limpou dados do site, ou
//     trocou de assinatura sozinho) — quem chamou deve apagar essa
//     assinatura salva (ver setPushSubscription em users.js), senão
//     ficaria tentando pra sempre.
//   { ok: false, error }          — qualquer outro erro (rede, payload
//     grande demais etc.) — assinatura continua válida, só não deu
//     certo ESSA tentativa.
async function sendNotification(subscription, payload) {
  if (!configured) return { ok: false, error: "push não configurado (faltam as variáveis VAPID)" };
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { ok: true };
  } catch (err) {
    const expired = err.statusCode === 404 || err.statusCode === 410;
    return { ok: false, expired, error: err.message };
  }
}

// ================= Lembrete de streak (gatilho único desta 1ª
// entrega, ver AskUserQuestion) =================
// Sem lib de cron nenhuma (setInterval simples já resolve — não faz
// sentido somar uma 2ª dependência externa só pra agendar isso, a
// 1ª foi o próprio webpush acima). "Horário de Brasília" é uma
// subtração fixa de 3h do UTC (America/Sao_Paulo não tem horário de
// verão desde 2019) — evita precisar de qualquer lib de fuso horário
// só pra essa checagem.
function brtNow() {
  return new Date(Date.now() - 3 * 3600 * 1000);
}

// Exportada separada do agendador pra dar pra chamar direto (testes,
// ou um gatilho manual futuro) sem esperar o relógio de verdade.
async function sendStreakReminders(now = brtNow()) {
  if (!configured) return { sent: 0, cleared: 0 };
  const todayLocal = now.toISOString().slice(0, 10);
  const pending = users.listPushSubscriptionsPendingStreak(todayLocal);
  let sent = 0, cleared = 0;
  for (const { id, subscription, streakDay } of pending) {
    const result = await sendNotification(subscription, {
      title: streakDay > 0
        ? `🔥 Sua sequência de ${streakDay} dia${streakDay > 1 ? "s" : ""} está em risco!`
        : "⚽ Seu time sente sua falta!",
      body: streakDay > 0
        ? "Volte hoje pro Modo Técnico e colete o login diário antes da meia-noite."
        : "Entre no Modo Técnico e comece (ou continue) sua sequência de login diário.",
      url: "/carreira.html",
    });
    if (result.ok) sent++;
    else if (result.expired) { users.setPushSubscription(id, null); cleared++; }
  }
  return { sent, cleared };
}

// Roda a cada 10min; só DISPARA de fato 1x por dia, quando o relógio
// (BRT) cruza as 20h (horário confirmado com o usuário via
// AskUserQuestion) — reminderSentOnDate evita reenviar a cada 10min
// dentro da mesma janela do mesmo dia.
let reminderSentOnDate = null;
let schedulerHandle = null;
async function checkAndSendReminders() {
  if (!configured) return;
  const now = brtNow();
  const todayLocal = now.toISOString().slice(0, 10);
  if (now.getUTCHours() < 20 || reminderSentOnDate === todayLocal) return;
  reminderSentOnDate = todayLocal;
  await sendStreakReminders(now);
}
// Idempotente — chamado 1x no boot do servidor (ver server.js); uma
// 2ª chamada (ex.: em teste) não duplica o setInterval.
function startStreakReminderScheduler() {
  if (schedulerHandle) return;
  schedulerHandle = setInterval(checkAndSendReminders, 10 * 60 * 1000);
}

module.exports = {
  configure, isEnabled, publicKey, sendNotification,
  sendStreakReminders, startStreakReminderScheduler,
};
