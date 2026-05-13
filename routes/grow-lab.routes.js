const express = require('express');
const controller = require('../controllers/grow-lab.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(requireAuth);

router.get('/dashboard', controller.dashboard);
router.get('/my-seeds', controller.mySeeds);
router.get('/timeline/:activationId', controller.timeline);
router.get('/secret/:productId', controller.secret);
router.post('/activate', controller.activate);
router.post('/task/complete', controller.completeTask);

module.exports = router;
