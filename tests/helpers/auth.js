const bcrypt = require('bcrypt');
const request = require('supertest');
const app = require('../../src/app');
const { prisma } = require('./db');

let counter = 0;

async function createUser({
  role = 'ACCOUNT_MANAGER',
  isActive = true,
  password = 'correct-horse-battery',
  email,
} = {}) {
  counter += 1;
  const passwordHash = await bcrypt.hash(password, 4);
  const user = await prisma.user.create({
    data: {
      email: email || `user${counter}@example.com`,
      name: `User ${counter}`,
      passwordHash,
      role,
      isActive,
    },
  });
  return { ...user, password };
}

async function loginAs(user) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: user.password });

  if (!res.body.token) {
    throw new Error(`Login failed in test helper: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.token;
}

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = { createUser, loginAs, bearer };