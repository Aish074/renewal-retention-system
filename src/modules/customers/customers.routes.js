const express = require('express');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const {
  createCustomerSchema,
  updateCustomerSchema,
  listCustomersQuerySchema,
  idParamsSchema,
} = require('./customers.schemas');
const controller = require('./customers.controller');

const router = express.Router();

router.use(authenticate);

router.post('/', validate(createCustomerSchema), controller.create);
router.get('/', validate(listCustomersQuerySchema, 'query'), controller.list);
router.get('/:id', validate(idParamsSchema, 'params'), controller.getOne);
router.patch(
  '/:id',
  validate(idParamsSchema, 'params'),
  validate(updateCustomerSchema),
  controller.update
);
router.delete('/:id', validate(idParamsSchema, 'params'), controller.archive);
router.post('/:id/restore', validate(idParamsSchema, 'params'), controller.restore);

module.exports = router;