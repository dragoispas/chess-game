import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// SharedArrayBuffer (Fairy-Stockfish threads) needs COOP/COEP.
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['fairy-stockfish-nnue.wasm'],
  },
  server: {
    headers: crossOriginIsolation,
    proxy: {
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
        rewrite: () => '/',
      },
    },
  },
  preview: {
    headers: crossOriginIsolation,
  },
})
