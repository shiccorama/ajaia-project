import { defineConfig } from 'drizzle-kit';
import { loadEnv } from './lib/env';

loadEnv();

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://ajaia:ajaia_dev_pw@localhost:15432/ajaia',
  },
  strict: true,
  verbose: true,
});
