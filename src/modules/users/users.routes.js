const express = require('express');
const validate = require('../../middleware/validate');
const { authenticate, authorize } = require('../../middleware/auth');
const { createUserSchema, updateUserSchema, idParamsSchema } = require('./users.schemas');
const controller = require('./users.controller');

const router = express.Router();

// Everything under /users is admin-only
router.use(authenticate, authorize('ADMIN'));

router.post('/', validate(createUserSchema), controller.create);
router.get('/', controller.list);
router.patch(
  '/:id',
  validate(idParamsSchema, 'params'),
  validate(updateUserSchema),
  controller.update
);

module.exports = router;