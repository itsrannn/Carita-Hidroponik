const express = require('express');
const shippingController = require('../controllers/shipping.controller');

const router = express.Router();

function shippingCors(req, res, next) {
  const origin = req.headers.origin || 'https://itsrannn.github.io';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, key');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  return next();
}

router.options('/cost', shippingCors);
router.use('/cost', shippingCors);
router.post('/cost', shippingController.calculateCost);

module.exports = router;
