import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Domínio próprio (matheusprospero.com.br) via arquivo public/CNAME:
// o site é servido na RAIZ do domínio, então a base é '/'.
export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
