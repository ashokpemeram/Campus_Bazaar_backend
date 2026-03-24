const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { getMessages, getConversations } = require('../controllers/messageController');

const router = express.Router();

router.get('/conversations', authMiddleware, getConversations);
router.get('/:productId/:userId', authMiddleware, getMessages);

module.exports = router;
