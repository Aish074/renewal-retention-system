const prisma = require('../../lib/prisma');
const AppError = require('../../utils/AppError');
const { isAdmin } = require('../../utils/access');
const { renewalDueDate } = require('../../utils/dates');
const { formatDate, formatMoney } = require('../../utils/serialize');
const { findAccessibleCustomer } = require('../customers/customers.service');

const openRenewal = { where: { closedAt: null }, take: 1 };

function serialize(subscription) {
  const open = subscription.renewals && subscription.renewals[0];

  return {
    id: subscription.id,
    customerId: subscription.customerId,
    planName: subscription.planName,
    value: formatMoney(subscription.value),
    currency: subscription.currency,
    startDate: formatDate(subscription.startDate),
    termMonths: subscription.termMonths,
    status: subscription.status,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
    openRenewal: open
      ? {
          id: open.id,
          cycleNumber: open.cycleNumber,
          dueDate: formatDate(open.dueDate),
          currentValue: formatMoney(open.currentValue),
          status: open.status,
        }
      : null,
  };
}

async function findAccessibleSubscription(actor, id) {
  const subscription = await prisma.subscription.findUnique({
    where: { id },
    include: {
      renewals: openRenewal,
      customer: { select: { ownerId: true } },
    },
  });

  if (!subscription || (!isAdmin(actor) && subscription.customer.ownerId !== actor.id)) {
    throw new AppError('Subscription not found', 404, 'SUBSCRIPTION_NOT_FOUND');
  }
  return subscription;
}

async function createSubscription(actor, customerId, data) {
  const customer = await findAccessibleCustomer(actor, customerId);
  if (customer.archivedAt) {
    throw new AppError(
      'Cannot add subscriptions to an archived customer',
      409,
      'CUSTOMER_ARCHIVED'
    );
  }

  const dueDate = renewalDueDate(data.startDate, data.termMonths, 1);

  const created = await prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.create({
      data: {
        customerId,
        planName: data.planName,
        value: data.value,
        currency: data.currency,
        startDate: data.startDate,
        termMonths: data.termMonths,
      },
    });

    const renewal = await tx.renewal.create({
      data: {
        subscriptionId: subscription.id,
        cycleNumber: 1,
        dueDate,
        currentValue: data.value,
      },
    });

    await tx.renewalEvent.create({
      data: { renewalId: renewal.id, actorId: actor.id, type: 'CREATED' },
    });

    return { ...subscription, renewals: [renewal] };
  });

  return serialize(created);
}

async function listForCustomer(actor, customerId) {
  await findAccessibleCustomer(actor, customerId);

  const subscriptions = await prisma.subscription.findMany({
    where: { customerId },
    include: { renewals: openRenewal },
    orderBy: { createdAt: 'desc' },
  });

  return subscriptions.map(serialize);
}

async function getSubscription(actor, id) {
  return serialize(await findAccessibleSubscription(actor, id));
}

async function updateSubscription(actor, id, changes) {
  const subscription = await findAccessibleSubscription(actor, id);

  if (subscription.status !== 'ACTIVE') {
    throw new AppError(
      'Only active subscriptions can be edited',
      409,
      'SUBSCRIPTION_NOT_ACTIVE'
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.subscription.update({ where: { id }, data: changes });

    if (changes.value !== undefined) {
      await tx.renewal.updateMany({
        where: { subscriptionId: id, closedAt: null },
        data: { currentValue: changes.value },
      });
    }

    const renewals = await tx.renewal.findMany({
      where: { subscriptionId: id, closedAt: null },
      take: 1,
    });

    return { ...result, renewals };
  });

  return serialize(updated);
}

module.exports = { createSubscription, listForCustomer, getSubscription, updateSubscription };