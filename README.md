# Reactive

A minimalist website built with React + Vite, with a black/white/pink design system built around React.

This website is for a full-stack web-developer's website building business, specifically geared towards supporting up-and-coming businesses around the world.

## Tech Stack

- **TypeScript** throughout — frontend, API server and scripts
- **React 19** + **Vite** — frontend
- **react-router-dom** — client-side routing
- **lucide-react** — icons
- **Express** + **node:sqlite** — API server and client database
- **Nodemailer** — receipts and contact form email
- **PayPal** — subscription checkout

## Project Structure
```bash
src/                     # the React app, bundled by Vite
├── components/
│   ├── layout/          # Nav, Footer, Logo
│   └── common/          # CodeWindow, PriceCard, ContactForm, Seo, ...
├── data/                # content as data: pages, plans, terms, reasons, features, process, notes
├── pages/               # Home, Packages, Contact, Checkout, ThankYou, Terms, Privacy, Admin
├── types/               # shapes of the admin API responses
├── App.tsx
├── main.tsx
└── index.css            # global theme (CSS custom properties) + component styles
server.ts                # Express API: contact form, PayPal activation, serves dist/
server/                  # admin API, auth, client database, audit log, plan limits
scripts/                 # dev runner, admin-password, contract PDF generator
```

## Setup

Requires **Node 24 or newer**.

```bash
npm install
npm run dev
```
Visit `http://localhost:5173`.

`npm run dev` starts both halves: Vite on 5173 and the API on 5174 (Vite proxies
`/api` to it). Run them separately with `npm run dev:web` / `npm run dev:api`.

No `.env` is needed to try it out — the PayPal and email routes stay inert
without their keys, everything else works.

## TypeScript

The frontend and the Node side are type-checked as two projects:

- `tsconfig.app.json` — `src/`, bundled by Vite
- `tsconfig.node.json` — `server.ts`, `server/`, `scripts/` and `vite.config.ts`

There is no compile step for the server or scripts: Node 24+ runs `.ts` files
directly by stripping the types. That means the Node side has to stick to
syntax that can simply be erased — no `enum`, `namespace` or constructor
parameter properties — and relative imports keep their `.ts` extension
(`import { db } from './server/db.ts'`). `tsc` enforces both, so a mistake
shows up as a type error rather than at runtime.

```bash
npm run typecheck   # tsc -b, both projects
npm run lint        # eslint with typescript-eslint
```

`npm run build` type-checks first and only bundles if that passes.

## Admin

`/admin` is an owner-only dashboard for client records. The server seeds a login
on first boot and prints it when you run `npm run dev`:

```
username   admin
password   change-me-in-env
```

These are public on purpose, so a fresh clone can actually open the dashboard.
To use your own, set them in `.env` and restart:

```bash
ADMIN_USER=you
ADMIN_PASSWORD=something-long
```

Prefer to keep the password itself off disk? `npm run admin-password "your-password" you`
prints an `ADMIN_PASSWORD_HASH` (and a `SESSION_SECRET`) to paste into `.env` instead.
A session secret is generated into `DATA_DIR/session-secret` if you don't set one,
so sign-ins survive a restart.

**Change the seeded login before putting the site on a public host** — it's in
this README.

## Build for production

```bash
npm run build
npm start
```
`npm run build` type-checks the whole project and bundles the site into `dist/`.
`npm start` runs `server.ts`, which serves `dist/` alongside the API — the site
needs the server for the contact form, checkout and `/admin`, so it can't go on a
static host on its own.

In production it runs in Docker (`dockerfile`, `docker-compose.yaml`): the build
stage runs `npm run build`, and the final image ships `server.ts`, `server/` and
`dist/` and starts with `node server.ts`.

Preview just the frontend bundle locally with:
```bash
npm run preview
```

## Design system

Global theme values (colors, fonts, radii, spacing) live as CSS custom properties in `index.css`, scoped under the `.reactive-root` wrapper in `App.tsx`. Update a value once there and it cascades through every component — no hardcoded colors or fonts elsewhere in the codebase.