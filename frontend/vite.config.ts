import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: false, // Automatically use next available port if 5174 is taken
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        timeout: 300000,        // 5 min — allow time for PDF embedding
        proxyTimeout: 300000,   // 5 min — server-side proxy timeout
      },
    },
  },
})
