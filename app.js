const express = require('express');
const paymentRoutes = require('./routes/payment.routes');
const shippingRoutes = require('./routes/shipping.routes');

const app = express();

function applyCorsHeaders(req, res) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Max-Age', '86400');
}

app.use(express.json());

// CORS Middleware
app.use((req, res, next) => {
  applyCorsHeaders(req, res);

  // Handle Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }
  next();
});

app.use('/api/payment', paymentRoutes);
app.use('/api/order', paymentRoutes);
app.use('/api/shipping', shippingRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Carita Hidroponik API is running.' });
});

app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint not found.' });
});

app.use((err, req, res, _next) => {
  applyCorsHeaders(req, res);
  console.error('[API] Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error.' });
});

module.exports = app;
