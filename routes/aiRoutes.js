const express = require('express');
const { suggestPrice } = require('../controllers/aiController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { aiRateLimit } = require('../middleware/aiRateLimit');

const router = express.Router();

router.post('/suggest-price', authMiddleware, aiRateLimit, suggestPrice);

module.exports = router;
