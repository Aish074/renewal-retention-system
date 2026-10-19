const request = require('supertest');
const app = require('../src/app');
const { prisma, resetDatabase } = require('./helpers/db');
const { createUser, loginAs, bearer } = require('./helpers/auth');
const { createCustomerFor } = require('./helpers/data');

const forCustomer = (customerId) => `/api/v1/customers/${customerId}/subscriptions`;
const direct = (id) => `/api/v1/subscriptions/${id}`;

const subscriptionBody = (overrides = {}) => ({
  planName: 'Annual AMC',
  value: 120000,
  startDate: '2026-01-01',
  termMonths: 12,
  ...overrides,
});

async function setup() {
  const admin = await createUser({ role: 'ADMIN' });
  const manager = await createUser();
  const other = await createUser();
  const customer = await createCustomerFor(manager);
  return {
    admin,
    manager,
    other,
    customer,
    adminToken: await loginAs(admin),
    managerToken: await loginAs(manager),
    otherToken: await loginAs(other),
  };
}

const invalidBodies = [
  ['a zero value', { value: 0 }],
  ['a negative value', { value: -5 }],
  ['a value with three decimals', { value: '10.999' }],
  ['a non-numeric value', { value: 'abc' }],
  ['an unsupported currency', { currency: 'USD' }],
  ['a zero-month term', { termMonths: 0 }],
  ['a term over 120 months', { termMonths: 121 }],
  ['a fractional term', { termMonths: 1.5 }],
  ['an impossible date', { startDate: '2026-02-30' }],
  ['a wrongly formatted date', { startDate: '01/01/2026' }],
  ['an empty plan name', { planName: '' }],
  ['an unknown field', { status: 'CANCELLED' }],
];

describe('subscriptions', () => {
  beforeEach(resetDatabase);
  afterAll(() => prisma.$disconnect());

  describe('POST /customers/:customerId/subscriptions', () => {
    it('creates the subscription, its first renewal and an audit event', async () => {
      const { manager, customer, managerToken } = await setup();

      const res = await request(app)
        .post(forCustomer(customer.id))
        .set(bearer(managerToken))
        .send(subscriptionBody());

      expect(res.status).toBe(201);
      const sub = res.body.subscription;
      expect(sub.value).toBe('120000.00');
      expect(sub.currency).toBe('INR');
      expect(sub.startDate).toBe('2026-01-01');
      expect(sub.status).toBe('ACTIVE');
      expect(sub.openRenewal).toMatchObject({
        cycleNumber: 1,
        dueDate: '2026-12-31',
        currentValue: '120000.00',
        status: 'PENDING',
      });

      const renewals = await prisma.renewal.findMany({ where: { subscriptionId: sub.id } });
      const events = await prisma.renewalEvent.findMany({
        where: { renewal: { subscriptionId: sub.id } },
      });
      expect(renewals).toHaveLength(1);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ type: 'CREATED', actorId: manager.id });
    });

    it('accepts a money string and a start date in the past', async () => {
      const { customer, managerToken } = await setup();

      const res = await request(app)
        .post(forCustomer(customer.id))
        .set(bearer(managerToken))
        .send(subscriptionBody({ value: '99.5', startDate: '2024-01-01' }));

      expect(res.status).toBe(201);
      expect(res.body.subscription.value).toBe('99.50');
      expect(res.body.subscription.openRenewal.dueDate).toBe('2024-12-31');
    });

    it.each(invalidBodies)('rejects %s', async (label, overrides) => {
      const { customer, managerToken } = await setup();

      const res = await request(app)
        .post(forCustomer(customer.id))
        .set(bearer(managerToken))
        .send(subscriptionBody(overrides));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it("returns 404 for another manager's customer, and lets an admin through", async () => {
      const { customer, adminToken, otherToken } = await setup();

      const denied = await request(app)
        .post(forCustomer(customer.id))
        .set(bearer(otherToken))
        .send(subscriptionBody());
      const allowed = await request(app)
        .post(forCustomer(customer.id))
        .set(bearer(adminToken))
        .send(subscriptionBody());

      expect(denied.status).toBe(404);
      expect(allowed.status).toBe(201);
    });

    it('refuses to add a subscription to an archived customer', async () => {
      const { customer, managerToken } = await setup();
      await prisma.customer.update({
        where: { id: customer.id },
        data: { archivedAt: new Date() },
      });

      const res = await request(app)
        .post(forCustomer(customer.id))
        .set(bearer(managerToken))
        .send(subscriptionBody());

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CUSTOMER_ARCHIVED');
    });
  });

  describe('GET', () => {
    it("lists a customer's subscriptions with their open renewal", async () => {
      const { customer, managerToken } = await setup();
      await request(app)
        .post(forCustomer(customer.id))
        .set(bearer(managerToken))
        .send(subscriptionBody());
      await request(app)
        .post(forCustomer(customer.id))
        .set(bearer(managerToken))
        .send(subscriptionBody({ planName: 'Premium AMC' }));

      const res = await request(app).get(forCustomer(customer.id)).set(bearer(managerToken));

      expect(res.status).toBe(200);
      expect(res.body.subscriptions).toHaveLength(2);
      res.body.subscriptions.forEach((sub) => expect(sub.openRenewal).not.toBeNull());
    });

    it('gets one subscription for its owner and admins, 404 for others', async () => {
      const { customer, adminToken, managerToken, otherToken } = await setup();
      const created = await request(app)
        .post(forCustomer(customer.id))
        .set(bearer(managerToken))
        .send(subscriptionBody());
      const id = created.body.subscription.id;

      const owner = await request(app).get(direct(id)).set(bearer(managerToken));
      const admin = await request(app).get(direct(id)).set(bearer(adminToken));
      const stranger = await request(app).get(direct(id)).set(bearer(otherToken));
      const unknown = await request(app)
        .get(direct('00000000-0000-4000-8000-000000000000'))
        .set(bearer(managerToken));
      const malformed = await request(app).get(direct('nope')).set(bearer(managerToken));

      expect(owner.status).toBe(200);
      expect(admin.status).toBe(200);
      expect(stranger.status).toBe(404);
      expect(unknown.status).toBe(404);
      expect(malformed.status).toBe(400);
    });
  });

  describe('PATCH /subscriptions/:id', () => {
    async function createOne(customer, token) {
      const res = await request(app)
        .post(forCustomer(customer.id))
        .set(bearer(token))
        .send(subscriptionBody());
      return res.body.subscription;
    }

    it("updates the plan and value, and the open renewal's current value", async () => {
      const { customer, managerToken } = await setup();
      const sub = await createOne(customer, managerToken);

      const res = await request(app)
        .patch(direct(sub.id))
        .set(bearer(managerToken))
        .send({ planName: 'Premium AMC', value: '150000.50' });

      expect(res.status).toBe(200);
      expect(res.body.subscription.planName).toBe('Premium AMC');
      expect(res.body.subscription.value).toBe('150000.50');
      expect(res.body.subscription.openRenewal.currentValue).toBe('150000.50');

      const renewal = await prisma.renewal.findFirst({ where: { subscriptionId: sub.id } });
      expect(renewal.currentValue.toFixed(2)).toBe('150000.50');
    });

    it('does not allow the term or start date to be changed', async () => {
      const { customer, managerToken } = await setup();
      const sub = await createOne(customer, managerToken);

      const term = await request(app)
        .patch(direct(sub.id))
        .set(bearer(managerToken))
        .send({ termMonths: 6 });
      const start = await request(app)
        .patch(direct(sub.id))
        .set(bearer(managerToken))
        .send({ startDate: '2026-06-01' });

      expect(term.status).toBe(400);
      expect(start.status).toBe(400);
    });

    it("returns 404 for another manager's subscription", async () => {
      const { customer, managerToken, otherToken } = await setup();
      const sub = await createOne(customer, managerToken);

      const res = await request(app)
        .patch(direct(sub.id))
        .set(bearer(otherToken))
        .send({ planName: 'Hijacked' });

      expect(res.status).toBe(404);
    });

    it('refuses to edit a subscription that is no longer active', async () => {
      const { customer, managerToken } = await setup();
      const sub = await createOne(customer, managerToken);
      await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'CANCELLED' } });

      const res = await request(app)
        .patch(direct(sub.id))
        .set(bearer(managerToken))
        .send({ value: '1000' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SUBSCRIPTION_NOT_ACTIVE');
    });
  });
});