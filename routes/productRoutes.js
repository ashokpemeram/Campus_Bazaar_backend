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
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

const router = express.Router();

router.get('/', optionalAuth, getAllProducts);
router.get('/recommend/user/:userId', authMiddleware, getUserRecommendations);
router.get('/recommend/:productId', getSimilarProducts);
router.get('/trending', getTrendingProducts);
router.get('/new', getNewArrivals);
router.get('/user/:userId', authMiddleware, getUserProducts);
router.get('/my', authMiddleware, getUserProducts); // Shorthand for logged in user
router.get('/:id', optionalAuth, getProductById);
router.post('/', authMiddleware, upload.array('images', 5), validateProduct, handleValidationErrors, addProduct);
router.delete('/:id', authMiddleware, deleteProduct);

module.exports = router;
