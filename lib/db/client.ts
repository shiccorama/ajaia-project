import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

/**
 * DeepSeek-owned database client.
 *
 * A single lazily-created pool per process. Next.js dev hot-reload can re-evaluate
 * this module, so the pool is cached on `globalThis` to avoid exhausting Postgres
 * connections during development.
 */

const globalForDb = globalThis as unknown as {
  ajaiaPool?: Pool;
  ajaiaDb?: NodePgDatabase<typeof schema>;
};

export function getPool(): Pool {
  if (!globalForDb.ajaiaPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL is not set. Copy .env.example to .env.local and point it at your PostgreSQL instance.',
      );
    }
    globalForDb.ajaiaPool = new Pool({
      connectionString,
      max: 10,
      // Fail fast instead of hanging a request when the database is unreachable.
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
    });
  }
  return globalForDb.ajaiaPool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!globalForDb.ajaiaDb) {
    globalForDb.ajaiaDb = drizzle(getPool(), { schema });
  }
  return globalForDb.ajaiaDb;
}

/** Closes the pool. Used by scripts and test teardown. */
export async function closeDb(): Promise<void> {
  if (globalForDb.ajaiaPool) {
    await globalForDb.ajaiaPool.end();
    globalForDb.ajaiaPool = undefined;
    globalForDb.ajaiaDb = undefined;
  }
}

export { schema };
