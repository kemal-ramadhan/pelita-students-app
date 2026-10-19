import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools(), tailwindcss()],
  // Port tetap agar cocok dengan CORS_ALLOW_ORIGINS & STUDENT_FRONTEND_URL di layanan (API_CONTRACT §10.2).
  server: { port: 5175, strictPort: true },
  preview: { port: 5175, strictPort: true },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
