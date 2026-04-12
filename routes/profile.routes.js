const express = require('express');
const { updateProfile } = require('../controllers/profile.controller');

const router = express.Router();

router.post('/update-profile', updateProfile);

module.exports = router;
