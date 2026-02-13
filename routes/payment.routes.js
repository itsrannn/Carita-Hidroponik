const express = require('express');
const paymentController = require('../controllers/payment.controller');

const router = express.Router();

router.post('/create-snap-token', paymentController.createSnapToken);
router.post('/webhook', paymentController.webhook);
router.get('/admin/orders', paymentController.getPaidOrdersForAdmin);

module.exports = router;
