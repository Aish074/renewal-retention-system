const authService = require('./auth.service');

async function login(req, res) {
  const { email, password } = req.validated.body;
  const result = await authService.login(email, password);
  res.json(result);
}

function me(req, res) {
  res.json({ user: req.user });
}

module.exports = { login, me };