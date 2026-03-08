const express = require('express');
const paymentRoutes = require('./routes/payment.routes');

const app = express();

const allowedOrigins = [
  'https://itsrannn.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
].filter(Boolean);

function resolveAllowedOrigin(origin) {
  if (!origin) return allowedOrigins[0];
  if (allowedOrigins.includes(origin)) return origin;
  return allowedOrigins[0];
}

app.use(express.json());

// CORS Middleware
app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;
  const allowOrigin = resolveAllowedOrigin(requestOrigin);

  res.header('Access-Control-Allow-Origin', allowOrigin);
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');

  // Handle Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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
