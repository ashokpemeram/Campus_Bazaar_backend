const Order = require('../models/Order');
const Cart = require('../models/Cart');

const Product = require('../models/Product');

const createOrder = async (req, res) => {
    let lockedProductIds = [];
    let orderSaved = false;
    try {
        const { products, totalAmount, shippingAddress, paymentMethod } = req.body;
        
        // For each product, try to lock it atomically
        // As per requirements: "Fix the system so that each product represents a single physical item"
        // "MUST use single atomic query"
        
        const orderProducts = [];
        for (const item of products) {
            const lockedProduct = await Product.findOneAndUpdate(
                { _id: item.productId, isAvailable: true, status: 'approved' },
                { isAvailable: false, status: 'pending' },
                { new: true }
            );
            
            if (!lockedProduct) {
                if (lockedProductIds.length > 0) {
                    await Product.updateMany(
                        { _id: { $in: lockedProductIds } },
                        { status: 'approved', isAvailable: true }
                    );
                }
                return res.status(400).json({ 
                    message: 'Product already reserved'
                });
            }
            lockedProductIds.push(lockedProduct._id);
            orderProducts.push({
                productId: lockedProduct._id,
                quantity: 1, // Force quantity 1 for single items
                price: lockedProduct.price
            });
        }

        const order = new Order({
            buyerId: req.user.id,
            products: orderProducts,
            totalAmount,
            shippingAddress,
            paymentMethod: paymentMethod || 'COD',
            paymentStatus: 'pending',
            status: 'pending'
        });
        
        await order.save();
        orderSaved = true;
        
        // Clear User's Cart
        await Cart.findOneAndDelete({ userId: req.user.id });
        
        res.status(201).json(order);
    } catch (err) {
        if (!orderSaved && lockedProductIds.length > 0) {
            try {
                await Product.updateMany(
                    { _id: { $in: lockedProductIds } },
                    { status: 'approved', isAvailable: true }
                );
            } catch (rollbackError) {
                console.error('Failed to rollback product locks:', rollbackError);
            }
        }
        res.status(500).json({ message: err.message });
    }
};

const getMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({ buyerId: req.user.id }).populate('products.productId');
        res.json(orders);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const getSellerOrders = async (req, res) => {
    try {
        const orders = await Order.find().populate({
            path: 'products.productId',
            match: { sellerId: req.user.id }
        }).populate('buyerId', 'name email college');
        
        // Filter orders that contain at least one product from this seller
        const sellerOrders = orders.filter(order => 
            order.products.some(p => p.productId && p.productId.sellerId.toString() === req.user.id)
        );
        
        res.json(sellerOrders);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Sales are essentially completed seller orders
const getSales = async (req, res) => {
    try {
        const orders = await Order.find({ paymentStatus: 'success' }).populate({
            path: 'products.productId',
            match: { sellerId: req.user.id }
        }).populate('buyerId', 'name email college');
        
        const sales = orders.filter(order => 
            order.products.some(p => p.productId && p.productId.sellerId.toString() === req.user.id)
        );
        
        res.json(sales);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const setOrderStatusAndProducts = async (order, status) => {
    const normalizedStatus = status === 'accepted' ? 'confirmed' : status;
    const productIds = order.products
        .map((item) => item.productId?._id || item.productId)
        .filter(Boolean);

    if (normalizedStatus === 'confirmed') {
        await Product.updateMany(
            { _id: { $in: productIds } },
            { status: 'reserved', isAvailable: false }
        );
    }

    if (normalizedStatus === 'completed') {
        await Product.updateMany(
            { _id: { $in: productIds } },
            { status: 'sold', isAvailable: false }
        );
    }

    if (normalizedStatus === 'rejected' || normalizedStatus === 'cancelled') {
        await Product.updateMany(
            { _id: { $in: productIds } },
            { status: 'approved', isAvailable: true }
        );
    }

    order.status = normalizedStatus;

    if (normalizedStatus === 'confirmed') {
        order.paymentStatus = 'pending';
    }

    await order.save();
};

const acceptOrder = async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await Order.findById(orderId).populate('products.productId');
        if (!order) return res.status(404).json({ message: 'Order not found' });

        const isSeller = order.products.some(
            (p) => p.productId && p.productId.sellerId.toString() === req.user.id
        );
        if (!isSeller) return res.status(403).json({ message: 'Not authorized to update this order' });

        if (order.status !== 'pending') {
            return res.status(400).json({ message: 'Order is not pending' });
        }

        await setOrderStatusAndProducts(order, 'confirmed');
        res.json(order);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const rejectOrder = async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await Order.findById(orderId).populate('products.productId');
        if (!order) return res.status(404).json({ message: 'Order not found' });

        const isSeller = order.products.some(
            (p) => p.productId && p.productId.sellerId.toString() === req.user.id
        );
        if (!isSeller) return res.status(403).json({ message: 'Not authorized to update this order' });

        if (order.status !== 'pending') {
            return res.status(400).json({ message: 'Order is not pending' });
        }

        await setOrderStatusAndProducts(order, 'rejected');
        res.json(order);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const completeOrder = async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await Order.findById(orderId).populate('products.productId');
        if (!order) return res.status(404).json({ message: 'Order not found' });

        const isSeller = order.products.some(
            (p) => p.productId && p.productId.sellerId.toString() === req.user.id
        );
        if (!isSeller) return res.status(403).json({ message: 'Not authorized to update this order' });

        if (!['confirmed', 'accepted'].includes(order.status)) {
            return res.status(400).json({ message: 'Order is not confirmed' });
        }

        await setOrderStatusAndProducts(order, 'completed');
        res.json(order);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await Order.findById(orderId).populate('products.productId');
        if (!order) return res.status(404).json({ message: 'Order not found' });

        const isSeller = order.products.some(
            (p) => p.productId && p.productId.sellerId.toString() === req.user.id
        );
        if (!isSeller) return res.status(403).json({ message: 'Not authorized to update this order' });

        if (!['confirmed', 'accepted'].includes(order.status)) {
            return res.status(400).json({ message: 'Order is not confirmed' });
        }

        await setOrderStatusAndProducts(order, 'cancelled');
        res.json(order);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const normalizedStatus = status === 'accepted' ? 'confirmed' : status;
        
        if (!['confirmed', 'completed', 'cancelled', 'rejected', 'delivered'].includes(normalizedStatus)) {
            return res.status(400).json({ message: 'Invalid status' });
        }
        
        const order = await Order.findById(id).populate('products.productId');
        if (!order) return res.status(404).json({ message: 'Order not found' });
        
        // Security: Ensure the user is the seller of at least one product in this order
        const isSeller = order.products.some(p => p.productId && p.productId.sellerId.toString() === req.user.id);
        if (!isSeller) return res.status(403).json({ message: 'Not authorized to update this order' });
        
        if (['confirmed', 'completed', 'cancelled', 'rejected'].includes(normalizedStatus)) {
            await setOrderStatusAndProducts(order, normalizedStatus);
            return res.json(order);
        }

        order.status = normalizedStatus;
        
        await order.save();
        res.json(order);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { createOrder, getMyOrders, getSellerOrders, getSales, acceptOrder, rejectOrder, completeOrder, cancelOrder, updateOrderStatus };
