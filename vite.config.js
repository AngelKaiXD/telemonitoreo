import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // En desarrollo, /api/invite-doctor lo sirve `vercel dev` (puerto 3000).
      // En producción es una Vercel Function del mismo dominio.
      '/api': 'http://localhost:3000',
    },
  },
})
