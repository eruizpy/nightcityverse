import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:4321',
      '/ws': {
        target: 'ws://localhost:4321',
        ws: true,
        rewriteWsOrigin: true,
      },
    },
  },
})
