import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        configure: (proxy: any) => {
          proxy.on('error', (err: any) => {
            if (err?.code === 'ECONNREFUSED' || err?.code === 'ECONNABORTED') return;
          });
        },
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
        configure: (proxy: any) => {
          proxy.on('error', (err: any) => {
            if (err?.code === 'ECONNREFUSED' || err?.code === 'ECONNABORTED') return;
          });
          proxy.on('proxyReqWsError', (err: any) => {
            if (err?.code === 'ECONNREFUSED' || err?.code === 'ECONNABORTED') return;
          });
        },
      },
    },
  },
})
