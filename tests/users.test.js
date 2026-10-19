const request = require('supertest');
const app = require('../src/app');
const { prisma, resetDatabase } = require('./helpers/db');
const { createUser, loginAs, bearer } = require('./helpers/auth');

const validBody = {
  name: 'Ravi Kumar',
  email: 'ravi@example.com',
  password: 'a-long-password-1',
};

describe('user management (admin only)', () => {
  beforeEach(resetDatabase);
  afterAll(() => prisma.$disconnect());

  describe('access control', () => {
    it('rejects requests without a token', async () => {
      const res = await request(app).get('/api/v1/users');
      expect(res.status).toBe(401);
    });

    it('forbids an account manager from listing or creating users', async () => {
      const manager = await createUser({ role: 'ACCOUNT_MANAGER' });
      const token = await loginAs(manager);

      const list = await request(app).get('/api/v1/users').set(bearer(token));
      const create = await request(app).post('/api/v1/users').set(bearer(token)).send(validBody);

      expect(list.status).toBe(403);
      expect(create.status).toBe(403);
    });
  });

  describe('POST /users', () => {
    it('creates a user, hashes the password and lets them log in', async () => {
      const admin = await createUser({ role: 'ADMIN' });
      const token = await loginAs(admin);

      const res = await request(app).post('/api/v1/users').set(bearer(token)).send(validBody);

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('ACCOUNT_MANAGER');
      expect(res.body.user.passwordHash).toBeUndefined();

      const stored = await prisma.user.findUnique({ where: { email: validBody.email } });
      expect(stored.passwordHash).not.toBe(validBody.password);
      expect(stored.passwordHash.startsWith('$2')).toBe(true);

      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: validBody.email, password: validBody.password });
      expect(login.status).toBe(200);
    });

    it('rejects a duplicate email regardless of letter case', async () => {
      const admin = await createUser({ role: 'ADMIN' });
      const token = await loginAs(admin);

      await request(app)
        .post('/api/v1/users')
        .set(bearer(token))
        .send({ ...validBody, email: 'New@Example.com' });

      const res = await request(app)
        .post('/api/v1/users')
        .set(bearer(token))
        .send({ ...validBody, email: 'NEW@example.com' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_TAKEN');
    });

    it('rejects a password shorter than 10 characters', async () => {
      const admin = await createUser({ role: 'ADMIN' });
      const token = await loginAs(admin);

      const res = await request(app)
        .post('/api/v1/users')
        .set(bearer(token))
        .send({ ...validBody, password: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects a password longer than 72 bytes', async () => {
      const admin = await createUser({ role: 'ADMIN' });
      const token = await loginAs(admin);

      const res = await request(app)
        .post('/api/v1/users')
        .set(bearer(token))
        .send({ ...validBody, password: 'é'.repeat(40) });

      expect(res.status).toBe(400);
    });

    it('rejects an invalid role and unknown fields', async () => {
      const admin = await createUser({ role: 'ADMIN' });
      const token = await loginAs(admin);

      const badRole = await request(app)
        .post('/api/v1/users')
        .set(bearer(token))
        .send({ ...validBody, role: 'SUPERUSER' });
      const extraField = await request(app)
        .post('/api/v1/users')
        .set(bearer(token))
        .send({ ...validBody, isActive: false });

      expect(badRole.status).toBe(400);
      expect(extraField.status).toBe(400);
    });
  });

  describe('GET /users', () => {
    it('lists users without password hashes', async () => {
      const admin = await createUser({ role: 'ADMIN' });
      await createUser();
      const token = await loginAs(admin);

      const res = await request(app).get('/api/v1/users').set(bearer(token));

      expect(res.status).toBe(200);
      expect(res.body.users).toHaveLength(2);
      res.body.users.forEach((user) => expect(user.passwordHash).toBeUndefined());
    });
  });

  describe('PATCH /users/:id', () => {
    it('deactivates another user, whose token then stops working', async () => {
      const admin = await createUser({ role: 'ADMIN' });
      const manager = await createUser();
      const adminToken = await loginAs(admin);
      const managerToken = await loginAs(manager);

      const res = await request(app)
        .patch(`/api/v1/users/${manager.id}`)
        .set(bearer(adminToken))
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.user.isActive).toBe(false);

      const after = await request(app).get('/api/v1/auth/me').set(bearer(managerToken));
      expect(after.status).toBe(401);
    });

    it('stops an admin from deactivating or demoting themselves', async () => {
      const admin = await createUser({ role: 'ADMIN' });
      const token = await loginAs(admin);

      const deactivate = await request(app)
        .patch(`/api/v1/users/${admin.id}`)
        .set(bearer(token))
        .send({ isActive: false });
      const demote = await request(app)
        .patch(`/api/v1/users/${admin.id}`)
        .set(bearer(token))
        .send({ role: 'ACCOUNT_MANAGER' });

      expect(deactivate.status).toBe(409);
      expect(deactivate.body.error.code).toBe('CANNOT_MODIFY_OWN_ACCESS');
      expect(demote.status).toBe(409);
    });

    it('returns 404 for an unknown id and 400 for a malformed one', async () => {
      const admin = await createUser({ role: 'ADMIN' });
      const token = await loginAs(admin);

      const unknown = await request(app)
        .patch('/api/v1/users/00000000-0000-4000-8000-000000000000')
        .set(bearer(token))
        .send({ name: 'Someone' });
      const malformed = await request(app)
        .patch('/api/v1/users/not-a-uuid')
        .set(bearer(token))
        .send({ name: 'Someone' });

      expect(unknown.status).toBe(404);
      expect(malformed.status).toBe(400);
    });

    it('rejects an empty update', async () => {
      const admin = await createUser({ role: 'ADMIN' });
      const manager = await createUser();
      const token = await loginAs(admin);

      const res = await request(app)
        .patch(`/api/v1/users/${manager.id}`)
        .set(bearer(token))
        .send({});

      expect(res.status).toBe(400);
    });
  });
});