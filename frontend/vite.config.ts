
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@trajectory/shared': fileURLToPath(
        new URL('../shared/index.ts', import.meta.url)
      )
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (id.includes('/@supabase/')) {
            return 'supabase'
          }

          if (
            id.includes('/react-dom/') ||
            id.includes('/node_modules/react/') ||
            id.includes('/scheduler/')
          ) {
            return 'react-vendor'
          }

          if (id.includes('/lucide-react/')) {
            return 'icons'
          }

          if (id.includes('/recharts/')) {
            return 'charts'
          }

          if (id.includes('/framer-motion/')) {
            return 'motion'
          }

          return undefined
        }
      }
    }
  }
})
