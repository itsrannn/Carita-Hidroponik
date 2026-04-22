const express = require('express');
const cors = require('cors');

const app = express();

const paymentRoutes = require('../routes/payment.routes');
const profileRoutes = require('../routes/profile.routes');

const corsOptions = {
  origin: 'https://itsrannn.github.io',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json());

app.use('/api/payment', paymentRoutes);
app.use('/api/order', paymentRoutes);
app.use('/api', profileRoutes);

app.get('/', (req, res) => {
  res.json({ status: 'online' });
});

app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint not found.' });
});

app.use((err, req, res, _next) => {
  console.error('[API] Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error.' });
});

module.exports = app;
