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