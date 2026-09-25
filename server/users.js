// Admin accounts: who may sign in to /admin, the role they hold and what that
// role lets them do.
//
// The master admin is special. It is seeded from .env (ADMIN_USER /
// ADMIN_PASSWORD, see auth.js) and its password keeps coming from there on every
// boot, so the VPS owner can always rotate it by editing .env and restarting —
// even if they lock themselves out of the UI. Everyone else is a database row
// with its own scrypt hash, created and managed from the Users section.
//
// There is always exactly one master: it cannot be deleted, demoted, or
// disabled, because doing so would leave nobody able to manage accounts.

import { db } from './db.js';
import { hashPassword, verifyPassword, initAdminConfig } from './auth.js';

export const ROLES = ['master', 'developer', 'telemarketer'];

// Every capability the admin API checks. Keep these coarse — a permission that
// maps to "a section of the dashboard plus the routes behind it" stays
// understandable; one permission per endpoint does not.
export const PERMISSIONS = [
  'clients:read',
  'clients:write',
  'users:manage',
  'audit:read',
];

// What each role gets by default when the account is created. Permissions are
// stored per user after that, so an individual can be granted more or less
// without inventing a new role.
export const ROLE_PERMISSIONS = {
  master: [...PERMISSIONS],
  developer: ['clients:read', 'clients:write'],
  telemarketer: ['clients:read'],
};

db.exec(`
  CREATE TABLE IF NOT EXISTS admin_users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    email         TEXT    NOT NULL DEFAULT '',
    name          TEXT,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'telemarketer',
    permissions   TEXT    NOT NULL DEFAULT '[]',
    is_master     INTEGER NOT NULL DEFAULT 0,
    status        TEXT    NOT NULL DEFAULT 'active',
    created_at    TEXT    NOT NULL,
    last_login_at TEXT
  );
`);

// A hash to check against when the username doesn't exist, so a wrong username
// costs the same time as a wrong password and can't be told apart by timing.
const DUMMY_HASH = hashPassword('no-such-user');

function parsePermissions(raw) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p) => PERMISSIONS.includes(p)) : [];
  } catch {
    return [];
  }
}

/** The shape sent to the browser — never includes the password hash. */
export function publicUser(row) {
  if (!row) return null;
  const isMaster = row.is_master === 1;
  return {
    id: row.id,
    username: row.username,
    email: row.email || '',
    name: row.name || '',
    role: row.role,
    // The master's permissions are implicit: it always holds all of them, so the
    // UI can't show it as missing one and a bad row can't lock the owner out.
    permissions: isMaster ? [...PERMISSIONS] : parsePermissions(row.permissions),
    isMaster,
    status: row.status,
    created_at: row.created_at,
    last_login_at: row.last_login_at,
  };
}

export function can(user, permission) {
  if (!user || user.status !== 'active') return false;
  if (user.isMaster) return true;
  return user.permissions.includes(permission);
}

let seeded = false;

/**
 * Creates the master account on first run and re-applies the .env password to it
 * on every boot. Idempotent; safe to call from anywhere.
 */
export function initUsers() {
  if (seeded) return;
  seeded = true;

  const { user: masterName, passwordHash } = initAdminConfig();
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT * FROM admin_users WHERE is_master = 1').get();

  if (!existing) {
    db.prepare(
      `INSERT INTO admin_users
         (username, email, name, password_hash, role, permissions, is_master, status, created_at)
       VALUES (?, '', 'Master admin', ?, 'master', ?, 1, 'active', ?)`
    ).run(masterName, passwordHash, JSON.stringify(ROLE_PERMISSIONS.master), now);
    console.log(`[admin] created the master account "${masterName}"`);
    return;
  }

  // .env stays the source of truth for the master's name and password.
  db.prepare(
    `UPDATE admin_users SET username = ?, password_hash = ?, role = 'master',
       permissions = ?, status = 'active' WHERE id = ?`
  ).run(masterName, passwordHash, JSON.stringify(ROLE_PERMISSIONS.master), existing.id);
}

export function listUsers() {
  initUsers();
  return db
    .prepare('SELECT * FROM admin_users ORDER BY is_master DESC, username COLLATE NOCASE')
    .all()
    .map(publicUser);
}

export function getUserById(id) {
  initUsers();
  return publicUser(db.prepare('SELECT * FROM admin_users WHERE id = ?').get(id));
}

/**
 * Checks a username/password pair.
 * Returns the public user on success, or null — never a reason, so the caller
 * can't accidentally tell an attacker which half was wrong.
 */
export function verifyCredentials(username, password) {
  initUsers();
  const row = db
    .prepare('SELECT * FROM admin_users WHERE username = ? COLLATE NOCASE')
    .get(String(username || '').trim());

  // Always hash, even with no row, so both paths take the same time.
  const ok = verifyPassword(String(password || ''), row ? row.password_hash : DUMMY_HASH);
  if (!row || !ok || row.status !== 'active') return null;
  return publicUser(row);
}

export function recordLogin(id) {
  db.prepare('UPDATE admin_users SET last_login_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    id
  );
}

function normalisePermissions(role, permissions) {
  if (Array.isArray(permissions)) {
    return permissions.filter((p) => PERMISSIONS.includes(p));
  }
  return ROLE_PERMISSIONS[role] || [];
}

export function createUser({ username, email, name, role, permissions, password }) {
  initUsers();

  const cleanName = String(username || '').trim();
  if (cleanName.length < 3) throw new Error('Username must be at least 3 characters');
  if (String(password || '').length < 10) {
    throw new Error('Password must be at least 10 characters');
  }
  // 'master' is not assignable: the one master comes from .env.
  if (!['developer', 'telemarketer'].includes(role)) {
    throw new Error('Role must be developer or telemarketer');
  }
  if (db.prepare('SELECT 1 FROM admin_users WHERE username = ? COLLATE NOCASE').get(cleanName)) {
    throw new Error('That username is taken');
  }

  const result = db
    .prepare(
      `INSERT INTO admin_users
         (username, email, name, password_hash, role, permissions, is_master, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 'active', ?)`
    )
    .run(
      cleanName,
      String(email || '').trim(),
      String(name || '').trim() || null,
      hashPassword(password),
      role,
      JSON.stringify(normalisePermissions(role, permissions)),
      new Date().toISOString()
    );

  return getUserById(Number(result.lastInsertRowid));
}

const EDITABLE = new Set(['email', 'name', 'role', 'permissions', 'status']);

export function updateUser(id, patch) {
  initUsers();
  const row = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(id);
  if (!row) return null;

  const fields = [];
  const values = [];
  const changed = [];

  for (const key of Object.keys(patch)) {
    if (!EDITABLE.has(key)) continue;

    // The master's role, permissions and status are fixed — see the file header.
    if (row.is_master === 1 && key !== 'email' && key !== 'name') continue;

    let value = patch[key];
    if (key === 'role') {
      if (!['developer', 'telemarketer'].includes(value)) continue;
      // Moving someone to a new role resets them to that role's defaults unless
      // the same request also sets permissions explicitly.
      if (patch.permissions === undefined) {
        fields.push('permissions = ?');
        values.push(JSON.stringify(ROLE_PERMISSIONS[value]));
        changed.push('permissions');
      }
    }
    if (key === 'permissions') value = JSON.stringify(normalisePermissions(row.role, value));
    if (key === 'status' && !['active', 'disabled'].includes(value)) continue;
    if (key === 'email' || key === 'name') value = String(value ?? '').trim();

    fields.push(`${key} = ?`);
    values.push(value);
    changed.push(key);
  }

  if (patch.password) {
    if (String(patch.password).length < 10) {
      throw new Error('Password must be at least 10 characters');
    }
    if (row.is_master === 1) {
      throw new Error("The master password is set in .env, not here");
    }
    fields.push('password_hash = ?');
    values.push(hashPassword(patch.password));
    changed.push('password');
  }

  if (!fields.length) return { user: getUserById(id), changed: [] };

  db.prepare(`UPDATE admin_users SET ${fields.join(', ')} WHERE id = ?`).run(...values, id);
  return { user: getUserById(id), changed };
}

export function deleteUser(id) {
  initUsers();
  const row = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(id);
  if (!row) return null;
  if (row.is_master === 1) throw new Error('The master account cannot be deleted');

  db.prepare('DELETE FROM admin_users WHERE id = ?').run(id);
  return publicUser(row);
}
