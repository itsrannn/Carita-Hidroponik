const express = require('express');
const shippingController = require('../controllers/shipping.controller');

const router = express.Router();

router.post('/cost', shippingController.calculateCost);

module.exports = router;
