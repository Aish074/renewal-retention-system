const express = require('express');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const { loginSchema } = require('./auth.schemas');
const controller = require('./auth.controller');

const router = express.Router();

router.post('/login', validate(loginSchema), controller.login);
router.get('/me', authenticate, controller.me);

module.exports = router;