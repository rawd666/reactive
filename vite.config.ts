import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Vite owns 5173 in dev and the API runs alongside it on 5174.
    // `npm run dev` starts both and sets API_PORT; see scripts/dev.js.
    proxy: {
      '/api': `http://localhost:${process.env.API_PORT || 5174}`,
    },
  },
})
