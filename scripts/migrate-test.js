const path = require('path');
const { spawnSync } = require('child_process');
const dotenv = require('dotenv');

const loaded = dotenv.config({ path: path.resolve(process.cwd(), '.env.test'), quiet: true });
const url = loaded.parsed && loaded.parsed.DATABASE_URL;

if (!url) {
  console.error('DATABASE_URL is missing from .env.test');
  process.exit(1);
}

const dbName = new URL(url).pathname.replace('/', '');
if (!dbName.toLowerCase().includes('test')) {
  console.error(`Refusing to migrate "${dbName}": a test database name must contain "test".`);
  process.exit(1);
}

console.log(`Applying migrations to test database "${dbName}"...`);

const result = spawnSync('npx prisma migrate deploy', {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, DATABASE_URL: url },
});

process.exit(result.status ?? 1);