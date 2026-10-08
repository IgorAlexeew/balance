/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const apiTarget = process.env.API_URL ?? 'http://localhost:3001'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: {
    port: 5173,
    strictPort: true,
    // Фронтенд и API работают с одного origin: cookie сессии SameSite=Lax
    proxy: { '/api': { target: apiTarget } },
  },
  preview: {
    port: 4173,
    proxy: { '/api': { target: apiTarget } },
  },
  build: {
    sourcemap: true,
  },
  test: {
    environment: 'node',
  },
})
