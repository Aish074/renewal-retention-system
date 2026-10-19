const { z } = require('zod');
const { moneySchema, isoDateSchema, uuidSchema } = require('../../utils/fields');

const planNameSchema = z.string().trim().min(1, 'Plan name is required').max(150);
const currencySchema = z.literal('INR', 'Only INR is supported right now');

const startDateSchema = isoDateSchema.refine((date) => {
  const year = date.getUTCFullYear();
  return year >= 2000 && year <= 2100;
}, 'Start date must be between the years 2000 and 2100');

const createSubscriptionSchema = z.strictObject({
  planName: planNameSchema,
  value: moneySchema,
  currency: currencySchema.default('INR'),
  startDate: startDateSchema,
  termMonths: z.number().int().min(1).max(120),
});


const updateSubscriptionSchema = z
  .strictObject({
    planName: planNameSchema.optional(),
    value: moneySchema.optional(),
    currency: currencySchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, 'Provide at least one field to update');

const customerIdParamsSchema = z.strictObject({ customerId: uuidSchema });
const idParamsSchema = z.strictObject({ id: uuidSchema });

module.exports = {
  createSubscriptionSchema,
  updateSubscriptionSchema,
  customerIdParamsSchema,
  idParamsSchema,
};