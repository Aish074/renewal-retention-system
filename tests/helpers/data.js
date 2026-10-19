const { prisma } = require('./db');

let counter = 0;

async function createCustomerFor(owner, overrides = {}) {
  counter += 1;
  return prisma.customer.create({
    data: {
      name: `Customer ${counter}`,
      email: `customer${counter}@example.com`,
      ownerId: owner.id,
      ...overrides,
    },
  });
}

module.exports = { createCustomerFor };