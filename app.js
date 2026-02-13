const express = require('express');
const paymentRoutes = require('./routes/payment.routes');

const app = express();

app.use(express.json());
app.use('/api/payment', paymentRoutes);

app.use((err, _req, res, _next) => {
  res.status(500).json({ message: 'Internal server error.' });
});

module.exports = app;
