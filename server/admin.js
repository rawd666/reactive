// Admin API. Every route except /login is behind requireAdmin, so the data is
// protected server-side — hiding the /admin link in the UI is cosmetic, this is
// what actually keeps clients' details private.

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
  verifyCredentials,
  issueSession,
  clearSession,
  isAuthed,
  requireAdmin,
  initAdminConfig,
} from './auth.js';

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

  // One message for both failures: it tells an attacker nothing about which half was wrong.
  if (!verifyCredentials(username, password)) {
    return res.status(401).json({ error: 'Incorrect username or password' });
  }

  issueSession(res);
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

router.get('/session', (req, res) => {
  // `seeded` lets the sign-in page show the default credentials while testing.
  // Never outside development — in production the hint is just an invitation.
  const seeded =
    process.env.NODE_ENV !== 'production' && initAdminConfig().seeded;
  res.json({ signedIn: isAuthed(req), seeded });
});

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

router.get('/clients', requireAdmin, (req, res) => {
  res.json({ clients: listClients().map(decorate) });
});

router.get('/clients/:code', requireAdmin, (req, res) => {
  const client = getClient(req.params.code);
  if (!client) return res.status(404).json({ error: 'Not found' });
  res.json({ client: decorate(client), events: getEvents(client.id) });
});

router.patch('/clients/:code', requireAdmin, (req, res) => {
  const updated = updateClient(req.params.code, req.body || {});
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json({ client: decorate(updated) });
});

router.post('/clients/:code/revision', requireAdmin, (req, res) => {
  const updated = addRevision(req.params.code, req.body?.detail);
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json({ client: decorate(updated) });
});

export default router;
