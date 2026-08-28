import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['server/**/*.test.{js,ts}'],
    exclude: ['node_modules', 'client', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['server/**/*.js'],
      exclude: [
        'server/server.js',
        'server/scripts/**',
        'server/test/**',
        'server/**/*.test.js',
        'server/config/db.js'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80
      }
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    setupFiles: ['./server/test/setup.ts'],
    singleFork: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './server')
    }
  }
});