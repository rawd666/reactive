// Admin accounts: who may sign in to /admin, the role they hold and what that
// role lets them do.
//
// The master admin is special. It is seeded from .env (ADMIN_USER /
// ADMIN_PASSWORD, see auth.ts) and its password keeps coming from there on every
// boot, so the VPS owner can always rotate it by editing .env and restarting —
// even if they lock themselves out of the UI. Everyone else is a database row
// with its own scrypt hash, created and managed from the Users section.
//
// There is always exactly one master: it cannot be deleted, demoted, or
// disabled, because doing so would leave nobody able to manage accounts.

import { db } from './db.ts';
import { hashPassword, verifyPassword, initAdminConfig } from './auth.ts';

export const ROLES = ['master', 'developer', 'telemarketer'] as const;
export type Role = (typeof ROLES)[number];

// The roles an account can be given from the UI — 'master' comes from .env only.
type AssignableRole = Exclude<Role, 'master'>;

function isAssignableRole(role: unknown): role is AssignableRole {
  return role === 'developer' || role === 'telemarketer';
}

// Every capability the admin API checks. Keep these coarse — a permission that
// maps to "a section of the dashboard plus the routes behind it" stays
// understandable; one permission per endpoint does not.
export const PERMISSIONS = [
  'clients:read',
  'clients:write',
  'users:manage',
  'audit:read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

function isPermission(p: unknown): p is Permission {
  return PERMISSIONS.includes(p as Permission);
}

// What each role gets by default when the account is created. Permissions are
// stored per user after that, so an individual can be granted more or less
// without inventing a new role.
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
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

type UserRow = {
  id: number;
  username: string;
  email: string;
  name: string | null;
  password_hash: string;
  role: Role;
  permissions: string;
  is_master: number;
  status: string;
  created_at: string;
  last_login_at: string | null;
};

/** The shape sent to the browser — never includes the password hash. */
export interface PublicUser {
  id: number;
  username: string;
  email: string;
  name: string;
  role: Role;
  permissions: Permission[];
  isMaster: boolean;
  status: string;
  created_at: string;
  last_login_at: string | null;
}

// Fields as they arrive in a JSON request body, before validation.
export interface NewUserInput {
  username?: unknown;
  email?: unknown;
  name?: unknown;
  role?: unknown;
  permissions?: unknown;
  password?: unknown;
}

export type UserPatch = Record<string, unknown>;

// A hash to check against when the username doesn't exist, so a wrong username
// costs the same time as a wrong password and can't be told apart by timing.
const DUMMY_HASH = hashPassword('no-such-user');

function parsePermissions(raw: string): Permission[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isPermission) : [];
  } catch {
    return [];
  }
}

export function publicUser(row: UserRow): PublicUser;
export function publicUser(row: UserRow | undefined): PublicUser | null;
export function publicUser(row: UserRow | undefined): PublicUser | null {
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

export function can(user: PublicUser | null, permission: Permission): boolean {
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
  const existing = db.prepare('SELECT * FROM admin_users WHERE is_master = 1').get() as
    | UserRow
    | undefined;

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

export function listUsers(): PublicUser[] {
  initUsers();
  return db
    .prepare('SELECT * FROM admin_users ORDER BY is_master DESC, username COLLATE NOCASE')
    .all()
    .map((row) => publicUser(row as UserRow));
}

export function getUserById(id: number): PublicUser | null {
  initUsers();
  return publicUser(db.prepare('SELECT * FROM admin_users WHERE id = ?').get(id) as UserRow | undefined);
}

/**
 * Checks a username/password pair.
 * Returns the public user on success, or null — never a reason, so the caller
 * can't accidentally tell an attacker which half was wrong.
 */
export function verifyCredentials(username: unknown, password: unknown): PublicUser | null {
  initUsers();
  const row = db
    .prepare('SELECT * FROM admin_users WHERE username = ? COLLATE NOCASE')
    .get(String(username || '').trim()) as UserRow | undefined;

  // Always hash, even with no row, so both paths take the same time.
  const ok = verifyPassword(String(password || ''), row ? row.password_hash : DUMMY_HASH);
  if (!row || !ok || row.status !== 'active') return null;
  return publicUser(row);
}

export function recordLogin(id: number) {
  db.prepare('UPDATE admin_users SET last_login_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    id
  );
}

function normalisePermissions(role: Role, permissions: unknown): Permission[] {
  if (Array.isArray(permissions)) {
    return permissions.filter(isPermission);
  }
  return ROLE_PERMISSIONS[role] || [];
}

export function createUser({ username, email, name, role, permissions, password }: NewUserInput): PublicUser {
  initUsers();

  const cleanName = String(username || '').trim();
  if (cleanName.length < 3) throw new Error('Username must be at least 3 characters');
  if (String(password || '').length < 10) {
    throw new Error('Password must be at least 10 characters');
  }
  // 'master' is not assignable: the one master comes from .env.
  if (!isAssignableRole(role)) {
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
      hashPassword(String(password)),
      role,
      JSON.stringify(normalisePermissions(role, permissions)),
      new Date().toISOString()
    );

  return getUserById(Number(result.lastInsertRowid)) as PublicUser;
}

const EDITABLE = new Set(['email', 'name', 'role', 'permissions', 'status']);

export function updateUser(
  id: number,
  patch: UserPatch
): { user: PublicUser | null; changed: string[] } | null {
  initUsers();
  const row = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(id) as UserRow | undefined;
  if (!row) return null;

  const fields: string[] = [];
  const values: string[] = [];
  const changed: string[] = [];

  for (const key of Object.keys(patch)) {
    if (!EDITABLE.has(key)) continue;

    // The master's role, permissions and status are fixed — see the file header.
    if (row.is_master === 1 && key !== 'email' && key !== 'name') continue;

    const raw = patch[key];
    let value: string;
    if (key === 'role') {
      if (!isAssignableRole(raw)) continue;
      // Moving someone to a new role resets them to that role's defaults unless
      // the same request also sets permissions explicitly.
      if (patch.permissions === undefined) {
        fields.push('permissions = ?');
        values.push(JSON.stringify(ROLE_PERMISSIONS[raw]));
        changed.push('permissions');
      }
      value = raw;
    } else if (key === 'permissions') {
      value = JSON.stringify(normalisePermissions(row.role, raw));
    } else if (key === 'status') {
      if (raw !== 'active' && raw !== 'disabled') continue;
      value = raw;
    } else {
      // email, name
      value = String(raw ?? '').trim();
    }

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
    values.push(hashPassword(String(patch.password)));
    changed.push('password');
  }

  if (!fields.length) return { user: getUserById(id), changed: [] };

  db.prepare(`UPDATE admin_users SET ${fields.join(', ')} WHERE id = ?`).run(...values, id);
  return { user: getUserById(id), changed };
}

export function deleteUser(id: number): PublicUser | null {
  initUsers();
  const row = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(id) as UserRow | undefined;
  if (!row) return null;
  if (row.is_master === 1) throw new Error('The master account cannot be deleted');

  db.prepare('DELETE FROM admin_users WHERE id = ?').run(id);
  return publicUser(row);
}
