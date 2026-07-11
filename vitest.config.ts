/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Node environment (not jsdom) since we're testing server-side business logic
    environment: 'node',
    globals: true,
    // Isolate modules between tests so env vars and module state don't bleed
    isolate: true,
    // Run tests sequentially within each file to avoid env var conflicts
    sequence: {
      concurrent: false,
    },
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts', 'src/actions/**/*.ts'],
      exclude: [
        'src/lib/mock-data.ts',
        'src/lib/mock-store.ts',
        'src/__tests__/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
