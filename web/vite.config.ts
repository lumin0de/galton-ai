import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Monorepo: VITE_* vem do .env na raiz do repo (junto com SUPABASE_*, etc.)
  envDir: path.resolve(__dirname, '..'),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  // Só usado se VITE_SUPABASE_URL e VITE_API_URL estiverem vazios (API Node local).
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
