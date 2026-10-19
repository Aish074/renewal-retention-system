const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const env = require('../src/config/env');
const { prisma, resetDatabase } = require('./helpers/db');
const { createUser, loginAs, bearer } = require('./helpers/auth');

describe('authentication', () => {
  beforeEach(resetDatabase);
  afterAll(() => prisma.$disconnect());

  describe('POST /auth/login', () => {
    it('returns a token and the user without the password hash', async () => {
      const user = await createUser();

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: user.password });

      expect(res.status).toBe(200);
      expect(typeof res.body.token).toBe('string');
      expect(res.body.user.email).toBe(user.email);
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('treats the email as case-insensitive', async () => {
      const user = await createUser({ email: 'mixed@example.com' });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: '  MIXED@Example.com ', password: user.password });

      expect(res.status).toBe(200);
    });

    it('rejects a wrong password', async () => {
      const user = await createUser();

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'wrong-password-123' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('gives the same error for an unknown email', async () => {
      const user = await createUser();

      const wrongPassword = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'wrong-password-123' });
      const unknownEmail = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'wrong-password-123' });

      expect(unknownEmail.status).toBe(401);
      expect(unknownEmail.body).toEqual(wrongPassword.body);
    });

    it('rejects a deactivated user even with the right password', async () => {
      const user = await createUser({ isActive: false });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: user.password });

      expect(res.status).toBe(401);
    });

    it('rejects a request with a missing password', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({ email: 'a@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /auth/me', () => {
    it('requires a token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('rejects a malformed token', async () => {
      const res = await request(app).get('/api/v1/auth/me').set(bearer('not-a-token'));
      expect(res.status).toBe(401);
    });

    it('rejects a token signed with another secret', async () => {
      const user = await createUser();
      const forged = jwt.sign({}, 'x'.repeat(40), { subject: user.id });

      const res = await request(app).get('/api/v1/auth/me').set(bearer(forged));
      expect(res.status).toBe(401);
    });

    it('rejects an expired token', async () => {
      const user = await createUser();
      const expired = jwt.sign({}, env.JWT_SECRET, { subject: user.id, expiresIn: -10 });

      const res = await request(app).get('/api/v1/auth/me').set(bearer(expired));
      expect(res.status).toBe(401);
    });

    it('returns the current user for a valid token', async () => {
      const user = await createUser({ role: 'ADMIN' });
      const token = await loginAs(user);

      const res = await request(app).get('/api/v1/auth/me').set(bearer(token));

      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(user.id);
      expect(res.body.user.role).toBe('ADMIN');
    });

    it('stops working as soon as the user is deactivated', async () => {
      const user = await createUser();
      const token = await loginAs(user);

      await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

      const res = await request(app).get('/api/v1/auth/me').set(bearer(token));
      expect(res.status).toBe(401);
    });
  });
});