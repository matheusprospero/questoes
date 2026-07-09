import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Nome exato do repositório GitHub (usado no deploy via gh-pages)
const REPO_NAME = 'questoes'

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? `/${REPO_NAME}/` : '/',
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
