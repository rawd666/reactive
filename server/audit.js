// Audit trail: one row per thing anyone did in the admin panel — every read,
// every write, every sign-in attempt.
//
// The username is stored on the row rather than only the id, so the record of
// what somebody did survives their account being deleted.
//
// Nothing here is allowed to break a request: an audit write that fails is
// logged to the console and swallowed, because losing a log line is better than
// failing the action the operator was performing.

import { db } from './db.js';

export const AUDIT_ACTIONS = [
  'read',
  'create',
  'edit',
  'delete',
  'login',
  'login_failed',
  'logout',
];

db.exec(`
  CREATE TABLE IF NOT EXISTS audit_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER,
    username    TEXT    NOT NULL,
    action      TEXT    NOT NULL,
    resource    TEXT    NOT NULL,
    resource_id TEXT,
    detail      TEXT,
    ip          TEXT,
    created_at  TEXT    NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_audit_created  ON audit_log (created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_audit_username ON audit_log (username);
`);

const insert = db.prepare(
  `INSERT INTO audit_log (user_id, username, action, resource, resource_id, detail, ip, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);

/**
 * Writes one audit row. `req` supplies the signed-in user and the client IP;
 * pass `username` explicitly for events with no session yet (a failed sign-in).
 */
export function recordAudit(req, { action, resource, resourceId = null, detail = null, username }) {
  try {
    const user = req?.adminUser || null;
    insert.run(
      user?.id ?? null,
      username ?? user?.username ?? 'anonymous',
      action,
      resource,
      resourceId === null || resourceId === undefined ? null : String(resourceId),
      detail,
      req?.ip ?? null,
      new Date().toISOString()
    );
  } catch (err) {
    console.error('[audit] could not record entry:', err.message);
  }
}

/**
 * Most recent entries first, with optional filters. Returns one row more than
 * asked for internally to work out `hasMore` without a second COUNT query.
 */
export function listAudit({ limit = 100, offset = 0, username, action, resource } = {}) {
  const where = [];
  const values = [];

  if (username) {
    where.push('username = ? COLLATE NOCASE');
    values.push(username);
  }
  if (action) {
    where.push('action = ?');
    values.push(action);
  }
  if (resource) {
    where.push('resource = ?');
    values.push(resource);
  }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const capped = Math.min(Math.max(Number(limit) || 100, 1), 500);

  const rows = db
    .prepare(
      `SELECT * FROM audit_log ${clause} ORDER BY id DESC LIMIT ? OFFSET ?`
    )
    .all(...values, capped + 1, Math.max(Number(offset) || 0, 0));

  const hasMore = rows.length > capped;
  return { entries: hasMore ? rows.slice(0, capped) : rows, hasMore };
}

/** Distinct usernames that appear in the log, for the filter dropdown. */
export function auditUsernames() {
  return db
    .prepare('SELECT DISTINCT username FROM audit_log ORDER BY username COLLATE NOCASE')
    .all()
    .map((r) => r.username);
}
