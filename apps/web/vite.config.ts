import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// VITE_BASE is set by the Pages deploy to "/<repo>/"; local dev and preview serve from "/".
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss()],
  server: { fs: { allow: ['../..'] } },
  test: { include: ['test/**/*.test.ts'], environment: 'node' },
})
