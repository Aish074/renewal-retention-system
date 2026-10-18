const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const prisma = require('../../lib/prisma');
const AppError = require('../../utils/AppError');

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', env.BCRYPT_ROUNDS);

async function login(email, password) {
  const user = await prisma.user.findUnique({ where: { email } });

  const passwordMatches = await bcrypt.compare(
    password,
    user ? user.passwordHash : DUMMY_HASH
  );

  // One message for every failure: unknown email, wrong password, deactivated
  if (!user || !user.isActive || !passwordMatches) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  const token = jwt.sign({}, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: env.JWT_EXPIRES_IN,
    algorithm: 'HS256',
  });

  const { passwordHash, ...publicUser } = user;
  return { token, user: publicUser };
}

module.exports = { login };