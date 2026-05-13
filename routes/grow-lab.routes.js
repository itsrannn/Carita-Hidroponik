const express = require('express');
const controller = require('../controllers/grow-lab.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(requireAuth);

router.get('/my-products', controller.myProducts);
router.post('/activate', controller.activate);
router.post('/activate-by-code', controller.activateByCode);
router.get('/secret/:productId', controller.secret);

module.exports = router;
