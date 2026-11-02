import { loadEnv } from '../lib/env';
import { closeDb } from '../lib/db/client';
import { runMigrations } from '../lib/db/migrate';

/**
 * Vitest global setup.
 *
 * Applies the migrations to the isolated test database before any suite runs, so
 * `npm test` works from a clean checkout without a manual migration step.
 */
export default async function setup(): Promise<void> {
  loadEnv();

  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? 'postgres://ajaia:ajaia_dev_pw@localhost:15432/ajaia_test';

  await runMigrations();
  await closeDb();
}
