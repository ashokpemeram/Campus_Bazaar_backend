const express = require('express');
const { optionalAuth } = require('../middleware/optionalAuth');
const { chatRateLimit } = require('../middleware/chatRateLimit');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const { handleChat, getChatQueries } = require('../controllers/chatController');

const router = express.Router();

router.post('/', optionalAuth, chatRateLimit, handleChat);
router.get('/admin/queries', authMiddleware, adminMiddleware, getChatQueries);

module.exports = router;
