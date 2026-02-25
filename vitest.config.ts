import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    globals: true
  },
  resolve: {
    alias: {
      '@core': resolve(__dirname, 'src/core')
    }
  }
})
