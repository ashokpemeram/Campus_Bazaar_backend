const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { addToCart, getCart, updateCartQuantity, removeFromCart } = require('../controllers/cartController');

const router = express.Router();

router.use(authMiddleware);

router.post('/add', addToCart);
router.get('/', getCart);
router.patch('/update', updateCartQuantity);
router.delete('/remove/:productId', removeFromCart);

module.exports = router;
