import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/**/__tests__/**/*.test.ts',
      'automation-hub/engine/__tests__/**/*.test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      'automation-hub/projects/**',
      '.next/**',
      'database/**',
    ],
    // Risk-based coverage gate: only files with dedicated test suites are
    // measured and thresholded. Add a file here when it gains tests; floors
    // sit slightly below measured coverage and must only move up (ratchet).
    coverage: {
      provider: 'v8' as const,
      include: [
        'src/lib/permissions.ts',
        'src/lib/settings.ts',
        'src/lib/auth.ts',
        'src/lib/utils.ts',
        'src/lib/ai.ts',
        'src/lib/secret-crypto.ts',
        'src/lib/rate-limit.ts',
        'automation-hub/engine/codegen.ts',
      ],
      reporter: ['text', 'html'],
      // Floors set just below measured coverage (2026-07-16 baseline).
      // Raise when tests are added; never lower.
      thresholds: {
        'src/lib/permissions.ts': { lines: 95, functions: 95, statements: 95, branches: 90 },
        'src/lib/utils.ts': { lines: 85, functions: 80, statements: 85, branches: 95 },
        'src/lib/auth.ts': { lines: 70, functions: 75, statements: 70, branches: 70 },
        'automation-hub/engine/codegen.ts': { lines: 40, functions: 25, statements: 40, branches: 40 },
        'src/lib/settings.ts': { lines: 55, functions: 65, statements: 55, branches: 55 },
        'src/lib/secret-crypto.ts': { lines: 95, functions: 95, statements: 95, branches: 90 },
        'src/lib/rate-limit.ts': { lines: 80, functions: 95, statements: 80, branches: 75 },
        'src/lib/ai.ts': { lines: 10, functions: 10, statements: 10, branches: 8 },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@automation-hub': path.resolve(__dirname, 'automation-hub'),
    },
  },
})
