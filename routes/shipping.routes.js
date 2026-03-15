const express = require('express');
const shippingController = require('../controllers/shipping.controller');

const router = express.Router();

router.get('/provinces', shippingController.getProvinces);
router.get('/cities/:provinceId', shippingController.getCities);
router.post('/cost', shippingController.calculateCost);

module.exports = router;
