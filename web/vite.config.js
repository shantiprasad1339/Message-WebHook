import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const apiUrl = process.env.API_URL || 'http://localhost:3000'
const proxy = {
  '/api': apiUrl,
  '/health': apiUrl
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5180, strictPort: true, proxy },
  preview: { port: 4180, strictPort: true, proxy }
})
