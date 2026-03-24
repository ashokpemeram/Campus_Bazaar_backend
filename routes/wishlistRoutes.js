const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { addToWishlist, getWishlist, removeFromWishlist } = require('../controllers/wishlistController');

const router = express.Router();

router.use(authMiddleware);

router.post('/add', addToWishlist);
router.get('/', getWishlist);
router.delete('/remove/:id', removeFromWishlist);

module.exports = router;
