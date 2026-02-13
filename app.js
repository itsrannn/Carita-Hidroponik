const express = require('express');
const paymentRoutes = require('./routes/payment.routes');

const app = express();

app.use(express.json());

// CORS Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  // Handle Preflight
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use('/api/payment', paymentRoutes);
app.use('/api/order', paymentRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Carita Hidroponik API is running.' });
});

app.use((err, _req, res, _next) => {
  res.status(500).json({ message: 'Internal server error.' });
});

module.exports = app;
