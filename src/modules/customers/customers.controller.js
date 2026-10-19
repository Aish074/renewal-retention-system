const service = require('./customers.service');

async function create(req, res) {
  const customer = await service.createCustomer(req.user, req.validated.body);
  res.status(201).json({ customer });
}

async function list(req, res) {
  const result = await service.listCustomers(req.user, req.validated.query);
  res.json(result);
}

async function getOne(req, res) {
  const customer = await service.findAccessibleCustomer(req.user, req.validated.params.id);
  res.json({ customer });
}

async function update(req, res) {
  const customer = await service.updateCustomer(
    req.user,
    req.validated.params.id,
    req.validated.body
  );
  res.json({ customer });
}

async function archive(req, res) {
  const customer = await service.archiveCustomer(req.user, req.validated.params.id);
  res.json({ customer });
}

async function restore(req, res) {
  const customer = await service.restoreCustomer(req.user, req.validated.params.id);
  res.json({ customer });
}

module.exports = { create, list, getOne, update, archive, restore };