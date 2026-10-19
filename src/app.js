const express = require('express');
const authRoutes = require('./modules/auth/auth.routes');
const usersRoutes = require('./modules/users/users.routes');
const customersRoutes = require('./modules/customers/customers.routes');
const subscriptionRoutes = require('./modules/subscriptions/subscriptions.routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(express.json({ limit: '100kb' }));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

const API_PREFIX = '/api/v1';

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/users`, usersRoutes);

app.use(`${API_PREFIX}/customers/:customerId/subscriptions`, subscriptionRoutes.nested);
app.use(`${API_PREFIX}/customers`, customersRoutes);
app.use(`${API_PREFIX}/subscriptions`, subscriptionRoutes.direct);


app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;