const { z } = require('zod');
const bcrypt = require('bcrypt');
const env = require('../src/config/env'); 
const prisma = require('../src/lib/prisma');
const { emailSchema, passwordSchema } = require('../src/utils/fields');

const seedSchema = z.object({
  SEED_ADMIN_EMAIL: emailSchema,
  SEED_ADMIN_PASSWORD: passwordSchema,
  SEED_ADMIN_NAME: z.string().trim().min(1).default('Admin'),
});

async function main() {
  const parsed = seedSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Seed settings in .env are invalid:');
    console.error(z.prettifyError(parsed.error));
    process.exitCode = 1;
    return;
  }

  const {
    SEED_ADMIN_EMAIL: email,
    SEED_ADMIN_PASSWORD: password,
    SEED_ADMIN_NAME: name,
  } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`User ${email} already exists. Nothing to do.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  await prisma.user.create({ data: { email, name, passwordHash, role: 'ADMIN' } });
  console.log(`Admin created: ${email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());