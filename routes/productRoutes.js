const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { optionalAuth } = require('../middleware/optionalAuth');
const {
    getAllProducts,
    getProductById,
    getSimilarProducts,
    getUserRecommendations,
    getTrendingProducts,
    getNewArrivals,
    addProduct,
    deleteProduct,
    getUserProducts
} = require('../controllers/productController');
const { validateProduct, handleValidationErrors } = require('../middleware/validators');
const { productImageUpload } = require('../middleware/upload');

const router = express.Router();

router.get('/', optionalAuth, getAllProducts);
router.get('/recommend/user/:userId', authMiddleware, getUserRecommendations);
router.get('/recommend/:productId', getSimilarProducts);
router.get('/trending', getTrendingProducts);
router.get('/new', getNewArrivals);
router.get('/user/:userId', authMiddleware, getUserProducts);
router.get('/my', authMiddleware, getUserProducts); // Shorthand for logged in user
router.get('/:id', optionalAuth, getProductById);
router.post('/', authMiddleware, productImageUpload.array('images', 5), validateProduct, handleValidationErrors, addProduct);
router.delete('/:id', authMiddleware, deleteProduct);

module.exports = router;
