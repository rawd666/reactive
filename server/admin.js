// Admin API. Every route except /login and /session is behind a permission
// check, so the data is protected server-side — hiding a section in the UI is
// cosmetic, this is what actually keeps clients' details private.
//
// Every route also writes an audit row. Reads included: the point of the audit
// log is to answer "who looked at this", not just "who changed it".

import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  listClients,
  getClient,
  getEvents,
  updateClient,
  addRevision,
} from './db.js';
import {
  issueSession,
  clearSession,
  initAdminConfig,
} from './auth.js';
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  verifyCredentials,
  recordLogin,
  initUsers,
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
} from './users.js';
import { recordAudit, listAudit, auditUsernames, AUDIT_ACTIONS } from './audit.js';
import { currentUser, requirePermission, requireMaster } from './access.js';

const router = express.Router();

// Deliberately strict: this is the one endpoint an attacker can reach unauthenticated.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Try again later.' },
});

router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = verifyCredentials(username, password);

  // One message for every failure: it tells an attacker nothing about which
  // half was wrong, or whether the account exists but is disabled.
  if (!user) {
    recordAudit(req, {
      action: 'login_failed',
      resource: 'session',
      username: String(username).trim().slice(0, 64),
      detail: 'bad username or password',
    });
    return res.status(401).json({ error: 'Incorrect username or password' });
  }

  recordLogin(user.id);
  issueSession(res, user.id);
  req.adminUser = user;
  recordAudit(req, { action: 'login', resource: 'session', detail: `role=${user.role}` });
  res.json({ ok: true, user });
});

router.post('/logout', (req, res) => {
  const user = currentUser(req);
  if (user) recordAudit(req, { action: 'logout', resource: 'session' });
  clearSession(res);
  res.json({ ok: true });
});

router.get('/session', (req, res) => {
  const user = currentUser(req);
  // `seeded` lets the sign-in page show the default credentials while testing.
  // Never outside development — in production the hint is just an invitation.
  const seeded =
    process.env.NODE_ENV !== 'production' && initAdminConfig().seeded;
  res.json({ signedIn: Boolean(user), seeded, user });
});

// --- clients -------------------------------------------------------------

function decorate(client) {
  const supportEnds = client.support_ends_at ? new Date(client.support_ends_at) : null;
  const daysLeft = supportEnds
    ? Math.ceil((supportEnds.getTime() - Date.now()) / 86400000)
    : null;
  return {
    ...client,
    support_days_left: daysLeft,
    support_active: daysLeft === null ? null : daysLeft > 0,
    revisions_left:
      client.revisions_included === null
        ? null
        : client.revisions_included - client.revisions_used,
  };
}

router.get('/clients', requirePermission('clients:read'), (req, res) => {
  const clients = listClients();
  recordAudit(req, { action: 'read', resource: 'clients', detail: `${clients.length} records` });
  res.json({ clients: clients.map(decorate) });
});

router.get('/clients/:code', requirePermission('clients:read'), (req, res) => {
  const client = getClient(req.params.code);
  if (!client) return res.status(404).json({ error: 'Not found' });
  recordAudit(req, { action: 'read', resource: 'clients', resourceId: client.client_code });
  res.json({ client: decorate(client), events: getEvents(client.id) });
});

router.patch('/clients/:code', requirePermission('clients:write'), (req, res) => {
  const patch = req.body || {};
  const updated = updateClient(req.params.code, patch);
  if (!updated) return res.status(404).json({ error: 'Not found' });
  recordAudit(req, {
    action: 'edit',
    resource: 'clients',
    resourceId: req.params.code,
    detail: Object.keys(patch).join(', ') || 'no fields',
  });
  res.json({ client: decorate(updated) });
});

router.post('/clients/:code/revision', requirePermission('clients:write'), (req, res) => {
  const updated = addRevision(req.params.code, req.body?.detail);
  if (!updated) return res.status(404).json({ error: 'Not found' });
  recordAudit(req, {
    action: 'create',
    resource: 'revision',
    resourceId: req.params.code,
    detail: req.body?.detail || null,
  });
  res.json({ client: decorate(updated) });
});

// --- users (master only) -------------------------------------------------

router.get('/users', requireMaster, (req, res) => {
  const users = listUsers();
  recordAudit(req, { action: 'read', resource: 'users', detail: `${users.length} accounts` });
  res.json({ users, roles: ROLES, permissions: PERMISSIONS, rolePermissions: ROLE_PERMISSIONS });
});

router.post('/users', requireMaster, (req, res) => {
  try {
    const user = createUser(req.body || {});
    recordAudit(req, {
      action: 'create',
      resource: 'users',
      resourceId: user.id,
      detail: `${user.username} as ${user.role}`,
    });
    res.status(201).json({ user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/users/:id', requireMaster, (req, res) => {
  try {
    const result = updateUser(Number(req.params.id), req.body || {});
    if (!result) return res.status(404).json({ error: 'Not found' });
    recordAudit(req, {
      action: 'edit',
      resource: 'users',
      resourceId: req.params.id,
      // Never the new value — a password would end up in the log.
      detail: `${result.user.username}: ${result.changed.join(', ') || 'no change'}`,
    });
    res.json({ user: result.user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/users/:id', requireMaster, (req, res) => {
  const id = Number(req.params.id);
  const self = currentUser(req);
  if (self.id === id) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }
  try {
    const removed = deleteUser(id);
    if (!removed) return res.status(404).json({ error: 'Not found' });
    recordAudit(req, {
      action: 'delete',
      resource: 'users',
      resourceId: id,
      detail: removed.username,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- audit log (master only) ---------------------------------------------

router.get('/audit', requireMaster, (req, res) => {
  const { limit, offset, username, action, resource } = req.query;
  const { entries, hasMore } = listAudit({ limit, offset, username, action, resource });

  // Reading the log is itself an action, so it is logged too — but only the
  // first page, or paging through history would bury the history.
  if (!Number(offset)) {
    recordAudit(req, { action: 'read', resource: 'audit', detail: `${entries.length} entries` });
  }

  res.json({
    entries,
    hasMore,
    usernames: auditUsernames(),
    actions: AUDIT_ACTIONS,
  });
});

// Makes sure the master account exists before any request arrives.
initUsers();

export default router;

