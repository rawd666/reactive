// Client database. Uses node:sqlite, which is built into Node 24 — no native
// module to compile and no extra service to run.
//
// The file lives in DATA_DIR (a mounted volume in production, see
// docker-compose.yaml). If that volume is ever removed, the client records go
// with it, so treat it as real data and back it up.

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'reactive.db'));

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS clients (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    client_code        TEXT    NOT NULL UNIQUE,
    business_name      TEXT,
    contact_name       TEXT,
    email              TEXT    NOT NULL,
    plan_id            TEXT    NOT NULL,
    subscription_id    TEXT    NOT NULL UNIQUE,
    terms_version      TEXT,
    privacy_version    TEXT,
    started_at         TEXT    NOT NULL,
    support_ends_at    TEXT,
    revisions_included INTEGER,
    revisions_used     INTEGER NOT NULL DEFAULT 0,
    status             TEXT    NOT NULL DEFAULT 'active',
    contract_file      TEXT,
    contract_agreed    INTEGER NOT NULL DEFAULT 0,
    notes              TEXT,
    created_at         TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id  INTEGER NOT NULL,
    kind       TEXT    NOT NULL,
    detail     TEXT,
    created_at TEXT    NOT NULL,
    FOREIGN KEY (client_id) REFERENCES clients(id)
  );
`);

// CREATE TABLE IF NOT EXISTS does nothing to a table that already exists, so new
// columns need an explicit additive migration for databases created earlier.
function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`[db] added column ${table}.${column}`);
  }
}

ensureColumn('clients', 'contract_agreed', 'INTEGER NOT NULL DEFAULT 0');

// Unambiguous alphabet: no O/0, I/1, so a code read off an email can't be mistyped.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(len = 6) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

export function generateClientCode(planId) {
  const exists = db.prepare('SELECT 1 FROM clients WHERE client_code = ?');
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = `RX-${planId.toUpperCase()}-${randomCode()}`;
    if (!exists.get(code)) return code;
  }
  throw new Error('Could not generate a unique client code');
}

export function logEvent(clientId, kind, detail = null) {
  db.prepare(
    'INSERT INTO events (client_id, kind, detail, created_at) VALUES (?, ?, ?, ?)'
  ).run(clientId, kind, detail, new Date().toISOString());
}

/**
 * Registers a paid subscription as a client.
 * Returns { client, created }. `created` is false when this subscription was
 * already registered, which is what makes a replayed activation request safe.
 */
export function registerClient({
  subscriptionId,
  email,
  contactName,
  businessName,
  planId,
  termsVersion,
  privacyVersion,
  revisionsIncluded,
  supportDays,
  contractAgreed = false,
}) {
  const existing = db
    .prepare('SELECT * FROM clients WHERE subscription_id = ?')
    .get(subscriptionId);
  if (existing) return { client: existing, created: false };

  const now = new Date();
  const supportEnds = supportDays
    ? new Date(now.getTime() + supportDays * 86400000).toISOString()
    : null;

  const code = generateClientCode(planId);

  db.prepare(
    `INSERT INTO clients
       (client_code, business_name, contact_name, email, plan_id, subscription_id,
        terms_version, privacy_version, started_at, support_ends_at,
        revisions_included, revisions_used, status, contract_agreed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'active', ?, ?)`
  ).run(
    code,
    businessName || null,
    contactName || null,
    email,
    planId,
    subscriptionId,
    termsVersion || null,
    privacyVersion || null,
    now.toISOString(),
    supportEnds,
    revisionsIncluded ?? null,
    contractAgreed ? 1 : 0,
    now.toISOString()
  );

  const client = db.prepare('SELECT * FROM clients WHERE client_code = ?').get(code);
  logEvent(client.id, 'registered', `plan=${planId} subscription=${subscriptionId}`);
  return { client, created: true };
}

export function listClients() {
  return db.prepare('SELECT * FROM clients ORDER BY started_at DESC').all();
}

export function getClient(code) {
  return db.prepare('SELECT * FROM clients WHERE client_code = ?').get(code);
}

export function getEvents(clientId) {
  return db
    .prepare('SELECT * FROM events WHERE client_id = ? ORDER BY created_at DESC')
    .all(clientId);
}

const EDITABLE = new Set([
  'business_name',
  'contact_name',
  'email',
  'status',
  'notes',
  'contract_file',
  'contract_agreed',
  'revisions_used',
  'revisions_included',
  'support_ends_at',
]);

export function updateClient(code, patch) {
  const client = getClient(code);
  if (!client) return null;

  const fields = Object.keys(patch).filter((k) => EDITABLE.has(k));
  if (fields.length === 0) return client;

  const setSql = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => patch[f]);
  db.prepare(`UPDATE clients SET ${setSql} WHERE client_code = ?`).run(...values, code);

  logEvent(client.id, 'updated', fields.join(', '));
  return getClient(code);
}

export function addRevision(code, detail) {
  const client = getClient(code);
  if (!client) return null;
  db.prepare('UPDATE clients SET revisions_used = revisions_used + 1 WHERE client_code = ?').run(code);
  logEvent(client.id, 'revision', detail || null);
  return getClient(code);
}
