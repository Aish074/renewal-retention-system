const bcrypt = require('bcrypt');
const env = require('../../config/env');
const prisma = require('../../lib/prisma');
const AppError = require('../../utils/AppError');

const publicSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

const emailTaken = () =>
  new AppError('A user with this email already exists', 409, 'EMAIL_TAKEN');

async function createUser({ name, email, password, role }) {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw emailTaken();

  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

  try {
    return await prisma.user.create({
      data: { name, email, passwordHash, role },
      select: publicSelect,
    });
  } catch (err) {
    // Two requests can pass the check above at once; the database unique rule decides
    if (err.code === 'P2002') throw emailTaken();
    throw err;
  }
}

function listUsers() {
  return prisma.user.findMany({ select: publicSelect, orderBy: { createdAt: 'asc' } });
}

async function updateUser(actor, id, changes) {
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!target) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

  const losesOwnAccess =
    changes.isActive === false || (changes.role !== undefined && changes.role !== 'ADMIN');

  if (actor.id === id && losesOwnAccess) {
    throw new AppError(
      'You cannot deactivate or demote your own account',
      409,
      'CANNOT_MODIFY_OWN_ACCESS'
    );
  }

  return prisma.user.update({ where: { id }, data: changes, select: publicSelect });
}

module.exports = { createUser, listUsers, updateUser };