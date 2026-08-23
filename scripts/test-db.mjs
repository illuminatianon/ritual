import { spawnSync } from 'node:child_process';

if (!process.env.RITUAL_TEST_DATABASE_URL) {
  console.error('RITUAL_TEST_DATABASE_URL is required. Start Docker PostgreSQL, run pnpm db:migrate, then set the test database URL.');
  process.exit(1);
}

const result = spawnSync('pnpm', ['exec', 'vitest', 'run', 'server/db/repositories/ownership.test.ts'], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
