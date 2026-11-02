import { loadEnv } from '../lib/env';

loadEnv();

// The test database is isolated from the development database.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://ajaia:ajaia_dev_pw@localhost:15432/ajaia_test';
