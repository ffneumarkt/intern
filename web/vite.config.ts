import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

const outDir = resolve(import.meta.dirname, '../backend/ui/dist')

// The Go embed needs ui/dist to exist in a fresh clone, so the build restores the tracked .gitkeep.
const keepDist: Plugin = {
  name: 'keep-dist',
  closeBundle() {
    writeFileSync(resolve(outDir, '.gitkeep'), '')
  },
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'FF Intern',
        short_name: 'FF Intern',
        lang: 'de',
        start_url: '/',
        display: 'standalone',
        theme_color: '#b71c1c',
        background_color: '#ffffff',
        icons: [
          { src: '/icons/intern-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/intern-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/intern-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/intern-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/_\//],
      },
    }),
    keepDist,
  ],
  build: {
    outDir,
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8090',
      '/_': 'http://127.0.0.1:8090',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: 'src/test/setup.ts',
  },
})
