// Persistência do InterviewLab.
//
// MVP: um arquivo JSON em disco. É suficiente pro volume de uma validação
// inicial (poucas centenas de sessões) e roda em qualquer lugar sem
// dependência nativa. Quando o volume crescer, trocar esse módulo por um
// adaptador Postgres é o caminho natural — a interface abaixo (getUser,
// createSession, etc.) foi pensada pra ficar estável nessa migração.
//
// IMPORTANTE (deploy): assim como qualquer app com estado em arquivo local,
// isso precisa de um volume persistente (ex: Volume no Railway) — sem isso
// os dados somem a cada deploy. Ver docs/DEPLOY.md.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { config } = require('../config');

const DB_FILE = path.join(config.dataDir, 'db.json');

const EMPTY_DB = {
  users: {},
  sessions: {},
  questionBank: {},
  reminders: [],
};

let db = null;

function ensureDataDir() {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

function load() {
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) {
    db = structuredClone(EMPTY_DB);
    save();
    return db;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    db = { ...structuredClone(EMPTY_DB), ...JSON.parse(raw) };
  } catch (err) {
    console.error(`Falha lendo ${DB_FILE}, iniciando banco vazio:`, err.message);
    db = structuredClone(EMPTY_DB);
  }
  return db;
}

function save() {
  ensureDataDir();
  // Escreve em arquivo temporário e renomeia — evita corromper o db.json
  // se o processo morrer no meio da escrita.
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2));
  fs.renameSync(tmpFile, DB_FILE);
}

function ensureLoaded() {
  if (!db) load();
  return db;
}

function id() {
  return crypto.randomUUID();
}

// ── Usuários ────────────────────────────────────────────────────────────

function getUser(waId) {
  ensureLoaded();
  return db.users[waId] || null;
}

function upsertUser(waId, patch = {}) {
  ensureLoaded();
  const now = new Date().toISOString();
  const existing = db.users[waId];
  db.users[waId] = {
    waId,
    name: null,
    state: 'START',
    currentSessionId: null,
    createdAt: now,
    ...existing,
    ...patch,
    updatedAt: now,
  };
  save();
  return db.users[waId];
}

// ── Sessões de simulação ───────────────────────────────────────────────

function createSession(waId, patch = {}) {
  ensureLoaded();
  const now = new Date().toISOString();
  const session = {
    id: id(),
    waId,
    status: 'collecting_job', // collecting_job -> collecting_resume -> diagnosing -> ready_to_start -> interviewing -> feedback_sent -> awaiting_interview_date -> reminder_scheduled -> awaiting_followup -> done
    jobUrl: null,
    jobText: null,
    jobMeta: { company: null, role: null },
    resumeText: null,
    diagnosis: null,
    questions: [],
    currentQuestionIndex: 0,
    answers: [],
    finalFeedback: null,
    interviewDate: null,
    reminderSent: false,
    followupSent: false,
    createdAt: now,
    updatedAt: now,
    ...patch,
  };
  db.sessions[session.id] = session;
  upsertUser(waId, { currentSessionId: session.id });
  save();
  return session;
}

function getSession(sessionId) {
  ensureLoaded();
  return db.sessions[sessionId] || null;
}

function getActiveSession(waId) {
  ensureLoaded();
  const user = getUser(waId);
  if (!user || !user.currentSessionId) return null;
  return getSession(user.currentSessionId);
}

function updateSession(sessionId, patch = {}) {
  ensureLoaded();
  const existing = db.sessions[sessionId];
  if (!existing) throw new Error(`Sessão não encontrada: ${sessionId}`);
  db.sessions[sessionId] = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  save();
  return db.sessions[sessionId];
}

// ── Banco de perguntas (loop de aprendizado) ──────────────────────────
// Alimentado por: (1) scraping de sites como Glassdoor, (2) feedback dos
// usuários 24h depois da entrevista real sobre quais perguntas caíram.

function bankKey(company, role) {
  return `${(company || 'geral').toLowerCase().trim()}::${(role || 'geral').toLowerCase().trim()}`;
}

function addQuestionsToBank(company, role, questions, source = 'ai') {
  ensureLoaded();
  const key = bankKey(company, role);
  const entry = db.questionBank[key] || { company, role, questions: [] };
  const now = new Date().toISOString();
  for (const text of questions) {
    const already = entry.questions.find((q) => q.text.trim().toLowerCase() === text.trim().toLowerCase());
    if (already) {
      already.upvotes += 1;
    } else {
      entry.questions.push({ id: id(), text, source, upvotes: 1, addedAt: now });
    }
  }
  db.questionBank[key] = entry;
  save();
  return entry;
}

function getQuestionsFromBank(company, role, limit = 10) {
  ensureLoaded();
  const key = bankKey(company, role);
  const entry = db.questionBank[key];
  if (!entry) return [];
  return [...entry.questions].sort((a, b) => b.upvotes - a.upvotes).slice(0, limit);
}

// ── Lembretes (dia da entrevista + follow-up 24h) ──────────────────────

function scheduleReminder(reminder) {
  ensureLoaded();
  const record = { id: id(), sent: false, ...reminder };
  db.reminders.push(record);
  save();
  return record;
}

function listDueReminders(now = new Date()) {
  ensureLoaded();
  return db.reminders.filter((r) => !r.sent && new Date(r.dueAt) <= now);
}

function markReminderSent(reminderId) {
  ensureLoaded();
  const reminder = db.reminders.find((r) => r.id === reminderId);
  if (reminder) {
    reminder.sent = true;
    save();
  }
  return reminder;
}

module.exports = {
  load,
  getUser,
  upsertUser,
  createSession,
  getSession,
  getActiveSession,
  updateSession,
  addQuestionsToBank,
  getQuestionsFromBank,
  scheduleReminder,
  listDueReminders,
  markReminderSent,
};
