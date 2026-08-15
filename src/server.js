const express = require('express');
const { config, warnMissingConfig } = require('./config');
const whatsapp = require('./services/whatsapp');
const store = require('./db/store');
const { handleIncomingMessage } = require('./conversation/engine');
const { startScheduler } = require('./services/scheduler');

const app = express();

// Guarda o corpo bruto da requisição (necessário pra validar a assinatura
// X-Hub-Signature-256 da Meta, que é calculada sobre os bytes originais).
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.get('/health', (_req, res) => res.json({ ok: true, service: 'interview-lab' }));

// Handshake de verificação do webhook (chamado uma vez ao configurar na Meta).
app.get('/webhook', (req, res) => {
  const challenge = whatsapp.verifyWebhookChallenge(req.query);
  if (challenge !== null) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Eventos de mensagens recebidas.
app.post('/webhook', (req, res) => {
  const signature = req.get('X-Hub-Signature-256');
  if (!whatsapp.isValidSignature(req.rawBody, signature)) {
    console.warn('Webhook recebido com assinatura inválida — ignorado.');
    return res.sendStatus(401);
  }

  // Responde já (a Meta espera 200 rápido e reenvia o evento se demorar/falhar);
  // o processamento em si (que chama a IA e pode levar alguns segundos)
  // acontece depois, de forma assíncrona.
  res.sendStatus(200);

  const messages = whatsapp.parseIncomingMessages(req.body);
  for (const msg of messages) {
    handleIncomingMessage(msg).catch((err) =>
      console.error(`Erro não tratado processando mensagem de ${msg.waId}:`, err)
    );
  }
});

warnMissingConfig();
store.load();
app.listen(config.port, () => {
  console.log(`InterviewLab rodando em http://localhost:${config.port}`);
  startScheduler();
});
