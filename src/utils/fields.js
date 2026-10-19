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

const moneySchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .pipe(
    z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Amount must have at most 10 digits and 2 decimals')
  )
  .refine((value) => Number(value) > 0, 'Amount must be greater than zero');

//  real calendar day written as "YYYY-MM-DD", turned into a Date at UTC midnight
const isoDateSchema = z.iso
  .date('Date must be in YYYY-MM-DD format')
  .refine((value) => {
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Not a real calendar date')
  .transform((value) => new Date(value));

module.exports = { emailSchema, passwordSchema, uuidSchema, moneySchema, isoDateSchema };