# Reactive

A minimalist website built with React + Vite, with a black/white/pink design system built around React.

This website is for a full-stack web-developer's website building business, specifically geared towards supporting up-and-coming businesses around the world.

## Tech Stack

- **React 18** + **Vite** — frontend
- **react-router-dom** — client-side routing (`/`, `/packages`, `/contact`)
- **lucide-react** — icons

## Project Structure
```bash
src/
├── assets/              # images, static files
├── components/
│   ├── layout/          # Nav, Footer, Logo
│   └── common/          # CodeWindow, PriceCard, ContactForm
├── data/                # content as data: pages, plans, reasons, features, process, notes
├── pages/               # Home, Packages, Contact
├── App.jsx
├── main.jsx
└── index.css            # global theme (CSS custom properties) + component styles
```

## Setup

```bash
npm install
npm run dev
```
Visit `http://localhost:5173`.

`npm run dev` starts both halves: Vite on 5173 and the API on 5174 (Vite proxies
`/api` to it). Run them separately with `npm run dev:web` / `npm run dev:api`.

No `.env` is needed to try it out — the PayPal and email routes stay inert
without their keys, everything else works.

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
```
Outputs static files to `dist/`, ready to deploy to any static host (Netlify, Vercel, GitHub Pages, etc.).

Preview the production build locally before deploying:
```bash
npm run preview
```

## Design system

Global theme values (colors, fonts, radii, spacing) live as CSS custom properties in `index.css`, scoped under the `.reactive-root` wrapper in `App.jsx`. Update a value once there and it cascades through every component — no hardcoded colors or fonts elsewhere in the codebase.