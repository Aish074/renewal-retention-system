const request = require('supertest');
const app = require('../src/app');
const { prisma, resetDatabase } = require('./helpers/db');
const { createUser, loginAs, bearer } = require('./helpers/auth');
const { createCustomerFor } = require('./helpers/data');

const API = '/api/v1/customers';
const body = (overrides = {}) => ({
  name: 'Acme Facilities',
  email: 'billing@acme.com',
  ...overrides,
});

async function setup() {
  const admin = await createUser({ role: 'ADMIN' });
  const manager = await createUser();
  const other = await createUser();
  return {
    admin,
    manager,
    other,
    adminToken: await loginAs(admin),
    managerToken: await loginAs(manager),
    otherToken: await loginAs(other),
  };
}

describe('customers', () => {
  beforeEach(resetDatabase);
  afterAll(() => prisma.$disconnect());

  describe('creating', () => {
    it('requires authentication', async () => {
      const res = await request(app).get(API);
      expect(res.status).toBe(401);
    });

    it('makes the creator the owner and lowercases the email', async () => {
      const { manager, managerToken } = await setup();

      const res = await request(app)
        .post(API)
        .set(bearer(managerToken))
        .send(body({ email: 'Billing@ACME.com' }));

      expect(res.status).toBe(201);
      expect(res.body.customer.ownerId).toBe(manager.id);
      expect(res.body.customer.email).toBe('billing@acme.com');
    });

    it('stops a manager assigning another owner', async () => {
      const { other, managerToken } = await setup();

      const res = await request(app)
        .post(API)
        .set(bearer(managerToken))
        .send(body({ ownerId: other.id }));

      expect(res.status).toBe(403);
    });

    it('lets an admin create for another user, but only a valid active one', async () => {
      const { manager, adminToken } = await setup();
      const inactive = await createUser({ isActive: false });

      const ok = await request(app)
        .post(API)
        .set(bearer(adminToken))
        .send(body({ ownerId: manager.id }));
      const unknown = await request(app)
        .post(API)
        .set(bearer(adminToken))
        .send(body({ email: 'a@acme.com', ownerId: '00000000-0000-4000-8000-000000000000' }));
      const deactivated = await request(app)
        .post(API)
        .set(bearer(adminToken))
        .send(body({ email: 'b@acme.com', ownerId: inactive.id }));

      expect(ok.status).toBe(201);
      expect(ok.body.customer.ownerId).toBe(manager.id);
      expect(unknown.status).toBe(400);
      expect(unknown.body.error.code).toBe('INVALID_OWNER');
      expect(deactivated.status).toBe(400);
    });

    it('rejects a second active customer with the same email, for any owner', async () => {
      const { managerToken, otherToken } = await setup();

      await request(app).post(API).set(bearer(managerToken)).send(body());

      const sameOwner = await request(app)
        .post(API)
        .set(bearer(managerToken))
        .send(body({ email: 'BILLING@acme.com' }));
      const otherOwner = await request(app).post(API).set(bearer(otherToken)).send(body());

      expect(sameOwner.status).toBe(409);
      expect(sameOwner.body.error.code).toBe('CUSTOMER_EMAIL_TAKEN');
      expect(otherOwner.status).toBe(409);
    });

    it('allows the email again once the first customer is archived', async () => {
      const { managerToken } = await setup();

      const first = await request(app).post(API).set(bearer(managerToken)).send(body());
      await request(app).delete(`${API}/${first.body.customer.id}`).set(bearer(managerToken));

      const second = await request(app).post(API).set(bearer(managerToken)).send(body());
      expect(second.status).toBe(201);
    });

    it('rejects an invalid email and unknown fields', async () => {
      const { managerToken } = await setup();

      const badEmail = await request(app)
        .post(API)
        .set(bearer(managerToken))
        .send(body({ email: 'not-an-email' }));
      const extra = await request(app)
        .post(API)
        .set(bearer(managerToken))
        .send(body({ archivedAt: '2026-01-01' }));

      expect(badEmail.status).toBe(400);
      expect(extra.status).toBe(400);
    });
  });

  describe('visibility', () => {
    it("hides one manager's customer from another with a 404", async () => {
      const { manager, adminToken, otherToken } = await setup();
      const customer = await createCustomerFor(manager);

      const get = await request(app).get(`${API}/${customer.id}`).set(bearer(otherToken));
      const patch = await request(app)
        .patch(`${API}/${customer.id}`)
        .set(bearer(otherToken))
        .send({ name: 'Hijacked' });
      const del = await request(app).delete(`${API}/${customer.id}`).set(bearer(otherToken));
      const admin = await request(app).get(`${API}/${customer.id}`).set(bearer(adminToken));

      expect(get.status).toBe(404);
      expect(patch.status).toBe(404);
      expect(del.status).toBe(404);
      expect(admin.status).toBe(200);
    });
  });

  describe('listing', () => {
    it('shows managers only their own customers and admins everything', async () => {
      const { admin, manager, other, adminToken, managerToken } = await setup();
      await createCustomerFor(manager);
      await createCustomerFor(manager);
      await createCustomerFor(other);

      const mine = await request(app).get(API).set(bearer(managerToken));
      const all = await request(app).get(API).set(bearer(adminToken));
      const filtered = await request(app)
        .get(`${API}?ownerId=${other.id}`)
        .set(bearer(adminToken));
      const forbidden = await request(app)
        .get(`${API}?ownerId=${other.id}`)
        .set(bearer(managerToken));

      expect(mine.body.meta.total).toBe(2);
      expect(all.body.meta.total).toBe(3);
      expect(filtered.body.meta.total).toBe(1);
      expect(forbidden.status).toBe(403);
      expect(admin.id).toBeDefined();
    });

    it('paginates, searches and validates paging parameters', async () => {
      const { manager, managerToken } = await setup();
      await createCustomerFor(manager, { name: 'Alpha Corp', email: 'a@example.com' });
      await createCustomerFor(manager, { name: 'Beta Corp', email: 'b@example.com' });
      await createCustomerFor(manager, { name: 'Gamma Corp', email: 'g@example.com' });

      const page2 = await request(app).get(`${API}?page=2&limit=2`).set(bearer(managerToken));
      const search = await request(app).get(`${API}?q=ALP`).set(bearer(managerToken));
      const tooBig = await request(app).get(`${API}?limit=101`).set(bearer(managerToken));

      expect(page2.status).toBe(200);
      expect(page2.body.data).toHaveLength(1);
      expect(page2.body.meta).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
      expect(search.body.data).toHaveLength(1);
      expect(search.body.data[0].name).toBe('Alpha Corp');
      expect(tooBig.status).toBe(400);
    });
  });

  describe('updating', () => {
    it('updates fields and clears optional ones with null', async () => {
      const { manager, managerToken } = await setup();
      const customer = await createCustomerFor(manager, { phone: '9876543210' });

      const res = await request(app)
        .patch(`${API}/${customer.id}`)
        .set(bearer(managerToken))
        .send({ name: 'Renamed Ltd', phone: null });

      expect(res.status).toBe(200);
      expect(res.body.customer.name).toBe('Renamed Ltd');
      expect(res.body.customer.phone).toBeNull();
    });

    it('lets only admins reassign the owner', async () => {
      const { manager, other, adminToken, managerToken, otherToken } = await setup();
      const customer = await createCustomerFor(manager);

      const byManager = await request(app)
        .patch(`${API}/${customer.id}`)
        .set(bearer(managerToken))
        .send({ ownerId: other.id });
      const byAdmin = await request(app)
        .patch(`${API}/${customer.id}`)
        .set(bearer(adminToken))
        .send({ ownerId: other.id });
      const oldOwner = await request(app).get(`${API}/${customer.id}`).set(bearer(managerToken));
      const newOwner = await request(app).get(`${API}/${customer.id}`).set(bearer(otherToken));

      expect(byManager.status).toBe(403);
      expect(byAdmin.status).toBe(200);
      expect(byAdmin.body.customer.ownerId).toBe(other.id);
      expect(oldOwner.status).toBe(404);
      expect(newOwner.status).toBe(200);
    });

    it("rejects changing an email to one that's already in use", async () => {
      const { manager, managerToken } = await setup();
      const first = await createCustomerFor(manager);
      const second = await createCustomerFor(manager);

      const res = await request(app)
        .patch(`${API}/${second.id}`)
        .set(bearer(managerToken))
        .send({ email: first.email });

      expect(res.status).toBe(409);
    });
  });

  describe('archiving and restoring', () => {
    it('refuses to archive a customer with an active subscription', async () => {
      const { manager, managerToken } = await setup();
      const customer = await createCustomerFor(manager);
      await prisma.subscription.create({
        data: {
          customerId: customer.id,
          planName: 'AMC',
          value: '100.00',
          startDate: new Date('2026-01-01'),
          termMonths: 12,
        },
      });

      const res = await request(app).delete(`${API}/${customer.id}`).set(bearer(managerToken));

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CUSTOMER_HAS_ACTIVE_SUBSCRIPTIONS');
    });

    it('archives, hides from the default list, and makes the record read-only', async () => {
      const { manager, managerToken } = await setup();
      const customer = await createCustomerFor(manager);

      const archived = await request(app)
        .delete(`${API}/${customer.id}`)
        .set(bearer(managerToken));
      const again = await request(app).delete(`${API}/${customer.id}`).set(bearer(managerToken));
      const list = await request(app).get(API).set(bearer(managerToken));
      const withArchived = await request(app)
        .get(`${API}?includeArchived=true`)
        .set(bearer(managerToken));
      const edit = await request(app)
        .patch(`${API}/${customer.id}`)
        .set(bearer(managerToken))
        .send({ name: 'Nope' });

      expect(archived.status).toBe(200);
      expect(archived.body.customer.archivedAt).not.toBeNull();
      expect(again.status).toBe(409);
      expect(list.body.data).toHaveLength(0);
      expect(withArchived.body.data).toHaveLength(1);
      expect(edit.status).toBe(409);
    });

    it('restores an archived customer', async () => {
      const { manager, managerToken } = await setup();
      const customer = await createCustomerFor(manager);

      const notArchived = await request(app)
        .post(`${API}/${customer.id}/restore`)
        .set(bearer(managerToken));
      await request(app).delete(`${API}/${customer.id}`).set(bearer(managerToken));
      const restored = await request(app)
        .post(`${API}/${customer.id}/restore`)
        .set(bearer(managerToken));

      expect(notArchived.status).toBe(409);
      expect(notArchived.body.error.code).toBe('NOT_ARCHIVED');
      expect(restored.status).toBe(200);
      expect(restored.body.customer.archivedAt).toBeNull();
    });

    it('refuses to restore when another active customer took the email', async () => {
      const { manager, managerToken } = await setup();
      const first = await createCustomerFor(manager, { email: 'same@example.com' });
      await request(app).delete(`${API}/${first.id}`).set(bearer(managerToken));
      await createCustomerFor(manager, { email: 'same@example.com' });

      const res = await request(app)
        .post(`${API}/${first.id}/restore`)
        .set(bearer(managerToken));

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CUSTOMER_EMAIL_TAKEN');
    });
  });
});