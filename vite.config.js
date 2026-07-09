import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Altere 'repedmunicipal' para o nome exato do seu repositório GitHub
const REPO_NAME = 'repositorio'

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? `/${REPO_NAME}/` : '/',
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
