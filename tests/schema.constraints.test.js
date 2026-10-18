const { prisma, resetDatabase } = require('./helpers/db');

async function seedSubscription() {
  const user = await prisma.user.create({
    data: { email: 'am@example.com', passwordHash: 'x', name: 'Account Manager' },
  });
  const customer = await prisma.customer.create({
    data: { name: 'Acme Facilities', email: 'client@example.com', ownerId: user.id },
  });
  const subscription = await prisma.subscription.create({
    data: {
      customerId: customer.id,
      planName: 'Annual AMC',
      value: '120000.00',
      startDate: new Date('2026-01-01'),
      termMonths: 12,
    },
  });
  return { user, customer, subscription };
}

function renewalData(subscriptionId, cycleNumber = 1) {
  return {
    subscriptionId,
    cycleNumber,
    dueDate: new Date('2026-12-31'),
    currentValue: '120000.00',
  };
}

describe('database constraints', () => {
  beforeEach(resetDatabase);
  afterAll(() => prisma.$disconnect());

  it('rejects two users with the same email', async () => {
    const data = { email: 'dup@example.com', passwordHash: 'x', name: 'A' };
    await prisma.user.create({ data });
    await expect(prisma.user.create({ data })).rejects.toThrow();
  });

  it('allows only one open renewal per subscription', async () => {
    const { subscription } = await seedSubscription();
    await prisma.renewal.create({ data: renewalData(subscription.id, 1) });

    await expect(
      prisma.renewal.create({ data: renewalData(subscription.id, 2) })
    ).rejects.toThrow();

    await prisma.renewal.updateMany({
      where: { subscriptionId: subscription.id, cycleNumber: 1 },
      data: { status: 'RENEWED', closedAt: new Date() },
    });

    await expect(
      prisma.renewal.create({ data: renewalData(subscription.id, 2) })
    ).resolves.toBeDefined();
  });

  it('does not allow the same cycle number twice', async () => {
    const { subscription } = await seedSubscription();
    const first = await prisma.renewal.create({ data: renewalData(subscription.id, 1) });
    await prisma.renewal.update({
      where: { id: first.id },
      data: { status: 'RENEWED', closedAt: new Date() },
    });

    await expect(
      prisma.renewal.create({ data: renewalData(subscription.id, 1) })
    ).rejects.toThrow();
  });

  it('rejects RENEWED without a closedAt date', async () => {
    const { subscription } = await seedSubscription();
    const renewal = await prisma.renewal.create({ data: renewalData(subscription.id) });

    await expect(
      prisma.renewal.update({ where: { id: renewal.id }, data: { status: 'RENEWED' } })
    ).rejects.toThrow();
  });

  it('rejects a lost reason on a renewal that is not LOST', async () => {
    const { subscription } = await seedSubscription();
    const renewal = await prisma.renewal.create({ data: renewalData(subscription.id) });

    await expect(
      prisma.renewal.update({ where: { id: renewal.id }, data: { lostReason: 'PRICE' } })
    ).rejects.toThrow();
  });

  it('rejects a negative subscription value', async () => {
    const { customer } = await seedSubscription();

    await expect(
      prisma.subscription.create({
        data: {
          customerId: customer.id,
          planName: 'Bad plan',
          value: '-1.00',
          startDate: new Date('2026-01-01'),
          termMonths: 12,
        },
      })
    ).rejects.toThrow();
  });

  it('allows one reminder per type per renewal', async () => {
    const { subscription } = await seedSubscription();
    const renewal = await prisma.renewal.create({ data: renewalData(subscription.id) });
    const base = { renewalId: renewal.id, recipientEmail: 'client@example.com' };

    await prisma.reminder.create({ data: { ...base, type: 'DAYS_30' } });

    await expect(
      prisma.reminder.create({ data: { ...base, type: 'DAYS_30' } })
    ).rejects.toThrow();

    await expect(
      prisma.reminder.create({ data: { ...base, type: 'DAYS_7' } })
    ).resolves.toBeDefined();
  });

  it('blocks deleting a customer that still has subscriptions', async () => {
    const { customer } = await seedSubscription();

    await expect(prisma.customer.delete({ where: { id: customer.id } })).rejects.toThrow();
  });

  it('stores money exactly and due dates without a time part', async () => {
    const { subscription } = await seedSubscription();
    const renewal = await prisma.renewal.create({
      data: { ...renewalData(subscription.id), currentValue: '1234.50' },
    });

    expect(renewal.currentValue.toFixed(2)).toBe('1234.50');
    expect(renewal.dueDate.toISOString()).toBe('2026-12-31T00:00:00.000Z');
  });
});