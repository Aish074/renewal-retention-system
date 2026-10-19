const { z } = require('zod');
const { emailSchema, uuidSchema } = require('../../utils/fields');

const nameSchema = z.string().trim().min(1, 'Name is required').max(200);
const contactNameSchema = z.string().trim().min(1).max(100);
const phoneSchema = z
  .string()
  .trim()
  .min(7)
  .max(20)
  .regex(/^[0-9+()\-\s]+$/, 'Phone may contain digits, spaces, + - ( )');
const notesSchema = z.string().trim().max(2000);

const createCustomerSchema = z.strictObject({
  name: nameSchema,
  email: emailSchema,
  contactName: contactNameSchema.optional(),
  phone: phoneSchema.optional(),
  notes: notesSchema.optional(),
  ownerId: uuidSchema.optional(),
});

const updateCustomerSchema = z
  .strictObject({
    name: nameSchema.optional(),
    email: emailSchema.optional(),
    contactName: contactNameSchema.nullable().optional(),
    phone: phoneSchema.nullable().optional(),
    notes: notesSchema.nullable().optional(),
    ownerId: uuidSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, 'Provide at least one field to update');

const listCustomersQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().min(1).max(100).optional(),
  ownerId: uuidSchema.optional(),
  includeArchived: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .default(false),
});

const idParamsSchema = z.strictObject({ id: uuidSchema });

module.exports = {
  createCustomerSchema,
  updateCustomerSchema,
  listCustomersQuerySchema,
  idParamsSchema,
};