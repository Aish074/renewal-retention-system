const service = require('./subscriptions.service');

async function create(req, res) {
  const subscription = await service.createSubscription(
    req.user,
    req.validated.params.customerId,
    req.validated.body
  );
  res.status(201).json({ subscription });
}

async function listForCustomer(req, res) {
  const subscriptions = await service.listForCustomer(
    req.user,
    req.validated.params.customerId
  );
  res.json({ subscriptions });
}

async function getOne(req, res) {
  const subscription = await service.getSubscription(req.user, req.validated.params.id);
  res.json({ subscription });
}

async function update(req, res) {
  const subscription = await service.updateSubscription(
    req.user,
    req.validated.params.id,
    req.validated.body
  );
  res.json({ subscription });
}

module.exports = { create, listForCustomer, getOne, update };