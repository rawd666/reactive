// `npm run dev` — runs Vite and the API side by side, so a fresh clone gets a
// working site *and* a working /admin without any setup.
//
// Vite owns 5173 and proxies /api to the API on 5174 (see vite.config.ts).
// Run just one half with `npm run dev:web` / `npm run dev:api` — going through
// this script rather than calling vite/node directly is what keeps the two
// ports agreed on without a shell-specific `PORT=5174 ...` prefix.

import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { SEEDED_LOGIN, usesSeededLogin, adminUser } from '../server/auth.js';

// Read .env here too, so the banner can tell whether the seeded login is still
// the one in effect. The API process loads it again for itself.
dotenv.config({ quiet: true });

const WEB_PORT = process.env.WEB_PORT || 5173;
const API_PORT = process.env.PORT || 5174;

const only = process.argv.includes('--web') ? 'web'
  : process.argv.includes('--api') ? 'api'
  : null;

function banner() {
  const rule = '─'.repeat(58);
  const lines = ['', rule, '  Reactive — development', ''];

  if (only !== 'api') lines.push(`  site     http://localhost:${WEB_PORT}`);
  if (only !== 'web') lines.push(`  api      http://localhost:${API_PORT}  (proxied at /api)`);
  lines.push(`  admin    http://localhost:${WEB_PORT}/admin`, '');

  if (only === 'web') {
    lines.push('  The API is not running — /admin and the forms need it:', '', '      npm run dev:api', '', rule, '');
    console.log(lines.join('\n'));
    return;
  }

  if (usesSeededLogin()) {
    lines.push(
      '  Seeded admin login — no setup needed:',
      '',
      `      username   ${adminUser()}`,
      `      password   ${SEEDED_LOGIN.password}`,
      '',
      '  To use your own, put ADMIN_USER and ADMIN_PASSWORD in .env',
      '  (or run: npm run admin-password "your-password") and restart.'
    );
  } else {
    lines.push(
      `  Admin login: user "${adminUser()}", password from .env.`,
      '  Delete ADMIN_PASSWORD / ADMIN_PASSWORD_HASH there to fall back',
      '  to the seeded login.'
    );
  }

  lines.push(rule, '');
  console.log(lines.join('\n'));
}

banner();

// Spawns with this same node binary and an explicit script path — no shell, no
// reliance on node_modules/.bin being on PATH, and paths with spaces are safe.
function run(name, args, env) {
  const child = spawn(process.execPath, args, {
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  child.on('exit', (code, signal) => {
    if (signal) return; // Ctrl-C: the other child is going down too.
    console.log(`\n[dev] ${name} exited (${code}) — stopping.`);
    shutdown(code ?? 0);
  });
  return child;
}

const children = [];
let stopping = false;

function shutdown(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exit(code);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(0));
}

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

if (only !== 'web') {
  children.push(run('api', [path.join(root, 'server.js')], { PORT: String(API_PORT) }));
}
if (only !== 'api') {
  children.push(
    run('vite', [path.join(root, 'node_modules/vite/bin/vite.js'), '--port', String(WEB_PORT)], {
      // vite.config.ts points its /api proxy at this.
      API_PORT: String(API_PORT),
    })
  );
}
