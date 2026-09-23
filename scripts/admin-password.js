// Generates the admin credentials for .env. The server seeds a default login on
// its own, so this is only needed to replace it with a real one:
//
//   node scripts/admin-password.js "your-password" [username]
//
// then paste the printed lines into .env (which is gitignored).
//
// ADMIN_PASSWORD=<plaintext> in .env works too — the hash just keeps the
// password itself off the disk.

import crypto from 'node:crypto';
import { hashPassword } from '../server/auth.js';

const password = process.argv[2];
const username = process.argv[3] || 'admin';
if (!password) {
  console.error('usage: node scripts/admin-password.js "your-password" [username]');
  process.exit(1);
}
if (password.length < 12) {
  console.error('Use at least 12 characters — this is the only thing guarding client data.');
  process.exit(1);
}

console.log('\nAdd these to .env:\n');
console.log(`ADMIN_USER=${username}`);
console.log(`ADMIN_PASSWORD_HASH=${hashPassword(password)}`);
console.log(`SESSION_SECRET=${crypto.randomBytes(32).toString('hex')}`);
console.log('\nRestart the server afterwards.\n');
