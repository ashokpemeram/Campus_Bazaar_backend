const express = require('express');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const {
    getAllUsers, blockUser, deleteUser,
    getAllProducts, approveProduct, rejectProduct,
    getAllOrders, updateOrderStatus,
    getAllReports, getStats
} = require('../controllers/adminController');

const router = express.Router();

router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/users', getAllUsers);
router.patch('/users/:id/block', blockUser);
router.delete('/users/:id', deleteUser);

router.get('/products', getAllProducts);
router.patch('/products/:id/approve', approveProduct);
router.patch('/products/:id/reject', rejectProduct);

router.get('/orders', getAllOrders);
router.patch('/orders/:id/status', updateOrderStatus);

router.get('/reports', getAllReports);
router.get('/stats', getStats);

module.exports = router;
