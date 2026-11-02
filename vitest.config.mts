import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Load `.env.local` / `.env` for TEST_DATABASE_URL. Kept inline so the config has no
// project imports (avoids a CommonJS/ESM interop warning from Vite's config loader).
for (const name of ['.env.local', '.env']) {
  const envPath = resolve(process.cwd(), name);
  if (!existsSync(envPath)) continue;
  try {
    process.loadEnvFile(envPath);
    break;
  } catch {
    // ignore and try the next candidate
  }
}

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    globalSetup: ['tests/global-setup.ts'],
    // The suites share one PostgreSQL database, so they must not run concurrently.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        'postgres://ajaia:ajaia_dev_pw@localhost:15432/ajaia_test',
    },
  },
  resolve: {
    alias: [{ find: /^@\//, replacement: rootDir }],
  },
});
