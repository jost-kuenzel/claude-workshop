import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.jsdom.ts'],
    globals: true,
  },
  plugins: [react(), tsconfigPaths()],
})