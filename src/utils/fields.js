const { z } = require('zod');

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Invalid email address').max(254));

const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .refine(
    (value) => Buffer.byteLength(value, 'utf8') <= 72,
    'Password must be at most 72 bytes'
  );

const uuidSchema = z.uuid('Invalid id');

module.exports = { emailSchema, passwordSchema, uuidSchema };