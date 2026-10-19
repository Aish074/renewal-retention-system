const express = require('express');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const {
  createSubscriptionSchema,
  updateSubscriptionSchema,
  customerIdParamsSchema,
  idParamsSchema,
} = require('./subscriptions.schemas');
const controller = require('./subscriptions.controller');

// Mounted - /customers/:customerId/subscriptions
const nested = express.Router({ mergeParams: true });
nested.use(authenticate);
nested.post(
  '/',
  validate(customerIdParamsSchema, 'params'),
  validate(createSubscriptionSchema),
  controller.create
);
nested.get('/', validate(customerIdParamsSchema, 'params'), controller.listForCustomer);

// Mounted - /subscriptions
const direct = express.Router();
direct.use(authenticate);
direct.get('/:id', validate(idParamsSchema, 'params'), controller.getOne);
direct.patch(
  '/:id',
  validate(idParamsSchema, 'params'),
  validate(updateSubscriptionSchema),
  controller.update
);

module.exports = { nested, direct };