import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { getDb } from './client';

/**
 * Applies the SQL migrations in `drizzle/` to the database named by `DATABASE_URL`.
 *
 * Run with: `npm run db:migrate`
 */
export async function runMigrations(migrationsFolder = './drizzle'): Promise<void> {
  const db = getDb();
  await migrate(db, { migrationsFolder });
}
