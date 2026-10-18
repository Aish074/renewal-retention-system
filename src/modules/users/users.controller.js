const usersService = require('./users.service');

async function create(req, res) {
  const user = await usersService.createUser(req.validated.body);
  res.status(201).json({ user });
}

async function list(req, res) {
  const users = await usersService.listUsers();
  res.json({ users });
}

async function update(req, res) {
  const user = await usersService.updateUser(
    req.user,
    req.validated.params.id,
    req.validated.body
  );
  res.json({ user });
}

module.exports = { create, list, update };