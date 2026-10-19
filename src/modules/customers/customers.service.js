const prisma = require('../../lib/prisma');
const AppError = require('../../utils/AppError');
const { isAdmin } = require('../../utils/access');

const customerInclude = { owner: { select: { id: true, name: true } } };

const notFound = () => new AppError('Customer not found', 404, 'CUSTOMER_NOT_FOUND');
const emailTaken = () =>
  new AppError('An active customer with this email already exists', 409, 'CUSTOMER_EMAIL_TAKEN');
const archivedError = () =>
  new AppError('Archived customers are read-only. Restore the customer first', 409, 'CUSTOMER_ARCHIVED');

async function assertValidOwner(ownerId) {
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { isActive: true },
  });
  if (!owner || !owner.isActive) {
    throw new AppError('Owner must be an existing active user', 400, 'INVALID_OWNER');
  }
}

function assertCanChooseOwner(actor, ownerId) {
  if (ownerId !== undefined && ownerId !== actor.id && !isAdmin(actor)) {
    throw new AppError('Only admins can assign a customer to another user', 403, 'FORBIDDEN');
  }
}

async function assertEmailFree(email, excludeId) {
  const clash = await prisma.customer.findFirst({
    where: { email, archivedAt: null, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { id: true },
  });
  if (clash) throw emailTaken();
}

async function findAccessibleCustomer(actor, id) {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: customerInclude,
  });

  if (!customer || (!isAdmin(actor) && customer.ownerId !== actor.id)) {
    throw notFound();
  }
  return customer;
}

async function createCustomer(actor, data) {
  assertCanChooseOwner(actor, data.ownerId);
  const ownerId = data.ownerId ?? actor.id;
  if (ownerId !== actor.id) await assertValidOwner(ownerId);

  await assertEmailFree(data.email);

  try {
    return await prisma.customer.create({
      data: { ...data, ownerId },
      include: customerInclude,
    });
  } catch (err) {
    // Two simultaneous requests can both pass the check; the database index decides
    if (err.code === 'P2002') throw emailTaken();
    throw err;
  }
}

async function listCustomers(actor, { page, limit, q, ownerId, includeArchived }) {
  if (!isAdmin(actor) && ownerId !== undefined && ownerId !== actor.id) {
    throw new AppError('Only admins can filter by another owner', 403, 'FORBIDDEN');
  }

  const where = {
    ...(isAdmin(actor) ? (ownerId ? { ownerId} : {}) : { ownerId: actor.id }),
    ...(includeArchived ? {} : { archivedAt: null }),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [data, total] = await prisma.$transaction([
    prisma.customer.findMany({
      where,
      include: customerInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.customer.count({ where }),
  ]);

  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function updateCustomer(actor, id, changes) {
  const customer = await findAccessibleCustomer(actor, id);
  if (customer.archivedAt) throw archivedError();

  assertCanChooseOwner(actor, changes.ownerId);
  if (changes.ownerId && changes.ownerId !== customer.ownerId) {
    await assertValidOwner(changes.ownerId);
  }
  if (changes.email && changes.email !== customer.email) {
    await assertEmailFree(changes.email, id);
  }

  try {
    return await prisma.customer.update({
      where: { id },
      data: changes,
      include: customerInclude,
    });
  } catch (err) {
    if (err.code === 'P2002') throw emailTaken();
    throw err;
  }
}

async function archiveCustomer(actor, id) {
  const customer = await findAccessibleCustomer(actor, id);
  if (customer.archivedAt) {
    throw new AppError('Customer is already archived', 409, 'ALREADY_ARCHIVED');
  }

  const activeSubscriptions = await prisma.subscription.count({
    where: { customerId: id, status: 'ACTIVE' },
  });
  if (activeSubscriptions > 0) {
    throw new AppError(
      'Cancel or end all active subscriptions before archiving this customer',
      409,
      'CUSTOMER_HAS_ACTIVE_SUBSCRIPTIONS'
    );
  }

  return prisma.customer.update({
    where: { id },
    data: { archivedAt: new Date() },
    include: customerInclude,
  });
}

async function restoreCustomer(actor, id) {
  const customer = await findAccessibleCustomer(actor, id);
  if (!customer.archivedAt) {
    throw new AppError('Customer is not archived', 409, 'NOT_ARCHIVED');
  }

  await assertEmailFree(customer.email, id);

  try {
    return await prisma.customer.update({
      where: { id },
      data: { archivedAt: null },
      include: customerInclude,
    });
  } catch (err) {
    if (err.code === 'P2002') throw emailTaken();
    throw err;
  }
}

module.exports = {
  findAccessibleCustomer,
  createCustomer,
  listCustomers,
  updateCustomer,
  archiveCustomer,
  restoreCustomer,
};