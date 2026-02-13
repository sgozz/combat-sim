/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['codevm', 'codevm.fritz.box'],
    proxy: {
      '/ws': {
        target: 'http://127.0.0.1:8080',
        ws: true,
        rewriteWsOrigin: true,
      },
    },
  },
  // @ts-expect-error vitest config extends vite config
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './src/test/setup.ts',
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
