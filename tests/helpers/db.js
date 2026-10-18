const prisma = require('../../src/lib/prisma');
const env = require('../../src/config/env');

function assertTestDatabase() {
  const dbName = new URL(env.DATABASE_URL).pathname.replace('/', '');
  if (env.NODE_ENV !== 'test' || !dbName.toLowerCase().includes('test')) {
    throw new Error(`Refusing to run: "${dbName}" is not a test database`);
  }
}

async function resetDatabase() {
  assertTestDatabase();
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "RenewalEvent", "FollowUp", "Reminder", "Renewal", "Subscription", "Customer", "User" CASCADE'
  );
}

module.exports = { prisma, assertTestDatabase, resetDatabase };