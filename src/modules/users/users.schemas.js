const { z } = require('zod');
const { emailSchema, passwordSchema, uuidSchema } = require('../../utils/fields');

const roleSchema = z.enum(['ADMIN', 'ACCOUNT_MANAGER']);
const nameSchema = z.string().trim().min(1, 'Name is required').max(100);

const createUserSchema = z.strictObject({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  role: roleSchema.default('ACCOUNT_MANAGER'),
});

const updateUserSchema = z
  .strictObject({
    name: nameSchema.optional(),
    role: roleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, 'Provide at least one field to update');

const idParamsSchema = z.strictObject({ id: uuidSchema });

module.exports = { createUserSchema, updateUserSchema, idParamsSchema };