// Single-admin authentication. No database table and no auth library: there is
// exactly one operator, so the credentials live in the environment and the
// session is a signed, httpOnly cookie.
//
// Nothing has to be configured to sign in — the server seeds a default admin on
// first boot so the dashboard is usable straight away. Override any of these in
// .env (and do, before the site is public):
//
//   ADMIN_USER=you
//   ADMIN_PASSWORD=a-long-password          # hashed at boot, never stored
//   ADMIN_PASSWORD_HASH=<salt>:<hash>       # takes precedence; see scripts/admin-password.js
//   SESSION_SECRET=<64 hex chars>           # otherwise generated into DATA_DIR
//
// The generated session secret is written to DATA_DIR/session-secret so that
// restarts don't sign everyone out. Deleting that file invalidates all sessions.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const COOKIE_NAME = 'rx_admin';
const SESSION_HOURS = 12;

// Seeded so a fresh checkout (or a fresh VPS) has a working sign-in. These are
// public by design — the repo is public, and a cloner needs to be able to open
// /admin without configuring anything. Real credentials live only in .env.
export const SEEDED_LOGIN = Object.freeze({
  user: 'admin',
  password: 'change-me-in-env',
});

/** True when no password is configured, so the seeded one is in effect. */
export function usesSeededLogin() {
  return !process.env.ADMIN_PASSWORD_HASH && !process.env.ADMIN_PASSWORD;
}

/** The username in effect, seeded or not. Never reveals a configured password. */
export function adminUser() {
  return process.env.ADMIN_USER || SEEDED_LOGIN.user;
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, expected] = stored.split(':');
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(actual, 'hex');
  const b = Buffer.from(expected, 'hex');
  // timingSafeEqual throws on length mismatch, so guard first.
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Compares two strings without leaking their length through timing, by hashing
// both to a fixed size first.
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// --- configuration -------------------------------------------------------

let config = null;

function dataDir() {
  return process.env.DATA_DIR || path.join(process.cwd(), 'data');
}

// Reuses the secret across restarts so an existing session cookie stays valid.
function loadOrCreateSessionSecret() {
  const file = path.join(dataDir(), 'session-secret');
  try {
    const existing = fs.readFileSync(file, 'utf8').trim();
    if (existing.length >= 32) return { secret: existing, created: false };
  } catch {
    // No file yet (or unreadable) — fall through and make one.
  }
  const secret = crypto.randomBytes(32).toString('hex');
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(file, secret, { mode: 0o600 });
    return { secret, created: true };
  } catch (err) {
    console.warn(`[admin] could not persist session secret (${err.message}); ` +
      'using an in-memory one — sessions will end on restart.');
    return { secret, created: true, ephemeral: true };
  }
}

/**
 * Resolves the admin credentials, seeding anything .env doesn't provide.
 * Safe to call repeatedly; the work happens once.
 */
export function initAdminConfig() {
  if (config) return config;

  const user = adminUser();
  const seeded = usesSeededLogin();

  let passwordHash = process.env.ADMIN_PASSWORD_HASH;
  let passwordSource = 'ADMIN_PASSWORD_HASH';
  if (!passwordHash) {
    passwordSource = seeded ? 'seeded default' : 'ADMIN_PASSWORD';
    passwordHash = hashPassword(process.env.ADMIN_PASSWORD || SEEDED_LOGIN.password);
  }

  let sessionSecret = process.env.SESSION_SECRET;
  let secretSource = 'SESSION_SECRET';
  if (!sessionSecret) {
    const { secret, created } = loadOrCreateSessionSecret();
    sessionSecret = secret;
    secretSource = created ? 'generated' : 'DATA_DIR/session-secret';
  }

  config = { user, passwordHash, sessionSecret, seeded };

  if (seeded) {
    const rule = '='.repeat(60);
    console.warn(
      `\n${rule}\n[admin] Sign in at /admin with the SEEDED login:\n\n` +
        `          username   ${user}\n` +
        `          password   ${SEEDED_LOGIN.password}\n\n` +
        `        This is public — it is in the repo. Before the site goes live,\n` +
        `        set ADMIN_USER and ADMIN_PASSWORD in .env and restart.\n${rule}\n`
    );
  } else {
    console.log(
      `[admin] sign-in ready — user "${user}" ` +
        `(password from ${passwordSource}, session secret from ${secretSource})`
    );
  }

  return config;
}

function getConfig() {
  return config || initAdminConfig();
}

/** True when the given username/password match the configured admin. */
export function verifyCredentials(username, password) {
  const { user, passwordHash } = getConfig();
  // Both checks always run so a wrong username costs the same as a wrong password.
  const userOk = safeEqual(String(username || '').trim().toLowerCase(), user.toLowerCase());
  const passOk = verifyPassword(String(password || ''), passwordHash);
  return userOk && passOk;
}

// --- session cookie ------------------------------------------------------

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

function makeToken(secret) {
  const expiresAt = Date.now() + SESSION_HOURS * 3600 * 1000;
  const payload = String(expiresAt);
  return `${payload}.${sign(payload, secret)}`;
}

function readToken(token, secret) {
  if (!token || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  const expected = sign(payload, secret);
  const a = Buffer.from(signature, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Number(payload) < Date.now()) return null;
  return { expiresAt: Number(payload) };
}

// Small cookie reader so this needs no cookie-parser dependency.
function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export function issueSession(res) {
  const { sessionSecret } = getConfig();
  res.cookie(COOKIE_NAME, makeToken(sessionSecret), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_HOURS * 3600 * 1000,
    path: '/',
  });
}

export function clearSession(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

export function isAuthed(req) {
  const { sessionSecret } = getConfig();
  return readToken(readCookie(req, COOKIE_NAME), sessionSecret) !== null;
}

// Express middleware guarding every admin data route.
export function requireAdmin(req, res, next) {
  if (!isAuthed(req)) return res.status(401).json({ error: 'Not signed in' });
  next();
}
