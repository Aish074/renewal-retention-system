const { z } = require('zod');
const { emailSchema } = require('../../utils/fields');

// No strength rules at login: only check that something was sent
const loginSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(200),
});

module.exports = { loginSchema };