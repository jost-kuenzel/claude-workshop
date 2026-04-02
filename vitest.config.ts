import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test/setup.node.ts'],
    globals: true,
  },
  plugins: [tsconfigPaths()],
})