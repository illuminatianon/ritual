import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL must be set before starting Ritual.');
}

const pool = new Pool({ connectionString });

export const db = drizzle({ client: pool, schema });
export { pool };
