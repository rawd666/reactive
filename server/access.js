// Express middleware that turns a session cookie into a user, and gates routes
// on what that user is allowed to do.
//
// The user is re-read from the database on every request rather than trusted
// from the cookie, so disabling or deleting an account takes effect at once
// instead of when its 12-hour session happens to expire.

import { sessionUserId } from './auth.js';
import { getUserById, can } from './users.js';

/** Resolves the signed-in user for a request, or null. */
export function currentUser(req) {
  if (req.adminUser !== undefined) return req.adminUser;

  const id = sessionUserId(req);
  const user = id === null ? null : getUserById(id);
  // A disabled account keeps a valid cookie but stops counting as signed in.
  req.adminUser = user && user.status === 'active' ? user : null;
  return req.adminUser;
}

export function requireAuth(req, res, next) {
  if (!currentUser(req)) return res.status(401).json({ error: 'Not signed in' });
  next();
}

/** Route guard for one capability, e.g. requirePermission('clients:write'). */
export function requirePermission(permission) {
  return (req, res, next) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ error: 'Not signed in' });
    if (!can(user, permission)) {
      return res.status(403).json({ error: 'You do not have access to that' });
    }
    next();
  };
}

/** Master-only routes: managing accounts and reading the audit log. */
export function requireMaster(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Not signed in' });
  if (!user.isMaster) return res.status(403).json({ error: 'Master admin only' });
  next();
}
