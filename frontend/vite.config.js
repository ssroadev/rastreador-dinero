import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          'echarts':   ['echarts', 'echarts-for-react'],
          'leaflet':   ['leaflet', 'react-leaflet'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'socket':    ['socket.io-client'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Durante desarrollo, proxea llamadas /api al backend
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Socket.IO también
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
