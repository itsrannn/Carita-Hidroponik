const express = require('express');
const cors = require('cors');

const app = express();

const paymentRoutes = require('../routes/payment.routes');
const shippingRoutes = require('../routes/shipping.routes');
const profileRoutes = require('../routes/profile.routes');

app.use(cors({
  origin: "https://itsrannn.github.io",
  credentials: true
}));

app.use(express.json());

app.use('/api/payment', paymentRoutes);
app.use('/api/order', paymentRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api', profileRoutes);

app.get('/', (req, res) => {
  res.json({ status: "online" });
});

app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint not found.' });
});

app.use((err, req, res, _next) => {
  console.error('[API] Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error.' });
});

module.exports = app;
