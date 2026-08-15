// Cliente da WhatsApp Cloud API (Meta) — envio/recebimento de mensagens.
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api

const crypto = require('crypto');
const { config } = require('../config');

const BASE_URL = `https://graph.facebook.com/${config.whatsapp.apiVersion}`;

function authHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${config.whatsapp.accessToken}`,
    ...extra,
  };
}

// ── Verificação do webhook (handshake inicial da Meta) ─────────────────

function verifyWebhookChallenge(query) {
  const mode = query['hub.mode'];
  const token = query['hub.verify_token'];
  const challenge = query['hub.challenge'];
  if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
    return challenge;
  }
  return null;
}

// Valida a assinatura X-Hub-Signature-256 do corpo bruto da requisição.
// Protege contra alguém forjar eventos de webhook sem conhecer o app secret.
function isValidSignature(rawBody, signatureHeader) {
  if (!config.whatsapp.appSecret) return true; // não configurado: pula (avisado no boot)
  if (!signatureHeader) return false;
  const expected =
    'sha256=' +
    crypto.createHmac('sha256', config.whatsapp.appSecret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── Parsing do payload recebido ─────────────────────────────────────────
// Normaliza o formato verboso da Meta pra algo simples de rotear.

function parseIncomingMessages(body) {
  const messages = [];
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const contacts = value.contacts || [];
      for (const raw of value.messages || []) {
        const contact = contacts.find((c) => c.wa_id === raw.from);
        messages.push({
          waId: raw.from,
          name: contact?.profile?.name || null,
          messageId: raw.id,
          timestamp: raw.timestamp,
          type: raw.type, // text | audio | document | image | interactive | button
          text: raw.text?.body || raw.button?.text || null,
          buttonReplyId: raw.interactive?.button_reply?.id || null,
          document: raw.document ? { id: raw.document.id, filename: raw.document.filename, mimeType: raw.document.mime_type } : null,
          audio: raw.audio ? { id: raw.audio.id, mimeType: raw.audio.mime_type } : null,
        });
      }
    }
  }
  return messages;
}

// ── Envio de mensagens ───────────────────────────────────────────────────

async function callSendApi(payload) {
  const res = await fetch(`${BASE_URL}/${config.whatsapp.phoneNumberId}/messages`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ messaging_product: 'whatsapp', to: payload.to, ...payload }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`WhatsApp send falhou (${res.status}): ${errBody}`);
  }
  return res.json();
}

function sendText(to, body) {
  return callSendApi({ to, type: 'text', text: { body, preview_url: false } });
}

function sendAudioById(to, mediaId) {
  return callSendApi({ to, type: 'audio', audio: { id: mediaId } });
}

// ── Mídia: download (currículo, áudio da resposta) e upload (TTS gerado) ─

async function getMediaUrl(mediaId) {
  const res = await fetch(`${BASE_URL}/${mediaId}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Falha buscando metadata da mídia ${mediaId}: ${res.status}`);
  return res.json(); // { url, mime_type, ... }
}

async function downloadMedia(mediaId) {
  const { url, mime_type: mimeType } = await getMediaUrl(mediaId);
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Falha baixando mídia ${mediaId}: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, mimeType };
}

async function uploadMedia(buffer, mimeType, filename = 'audio.mp3') {
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('file', new Blob([buffer], { type: mimeType }), filename);
  const res = await fetch(`${BASE_URL}/${config.whatsapp.phoneNumberId}/media`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) throw new Error(`Falha subindo mídia: ${res.status} ${await res.text()}`);
  const { id: mediaId } = await res.json();
  return mediaId;
}

async function sendAudioBuffer(to, buffer, mimeType = 'audio/mpeg') {
  const mediaId = await uploadMedia(buffer, mimeType);
  return sendAudioById(to, mediaId);
}

module.exports = {
  verifyWebhookChallenge,
  isValidSignature,
  parseIncomingMessages,
  sendText,
  sendAudioBuffer,
  downloadMedia,
};
