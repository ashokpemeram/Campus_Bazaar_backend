const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { createOrder, getMyOrders, getSellerOrders, getSales, acceptOrder, rejectOrder, completeOrder, cancelOrder, updateOrderStatus } = require('../controllers/orderController');
const router = express.Router();

router.use(authMiddleware);
router.post('/', createOrder);
router.get('/my', getMyOrders);
router.get('/seller', getSellerOrders);
router.get('/sales/user', getSales);
router.post('/:orderId/accept', acceptOrder);
router.post('/:orderId/reject', rejectOrder);
router.post('/:orderId/complete', completeOrder);
router.post('/:orderId/cancel', cancelOrder);
router.patch('/:id/status', updateOrderStatus);

module.exports = router;
