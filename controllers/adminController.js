const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Report = require('../models/Report');
const Notification = require('../models/Notification');

// User Management
const getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const blockUser = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, { isBlocked: true }, { new: true });
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const unblockUser = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, { isBlocked: false }, { new: true });
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const deleteUser = async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ message: 'User deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Product Management
const getAllProducts = async (req, res) => {
    try {
        const products = await Product.find().populate('sellerId', 'name email');
        res.json(products);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const approveProduct = async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(req.params.id, { status: 'approved' }, { new: true });
        res.json(product);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const rejectProduct = async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(req.params.id, { status: 'rejected' }, { new: true });
        res.json(product);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });

        const owner = await User.findById(product.sellerId);
        await Product.findByIdAndDelete(req.params.id);

        if (owner) {
            await Notification.create({
                userId: owner._id,
                message: `Your product "${product.title}" was removed by admin`
            });
        }

        res.json({ message: 'Product deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Order Management
const getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find().populate('buyerId', 'name email').populate('products.productId');
        res.json(orders);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        const order = await Order.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
        res.json(order);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Reports
const getAllReports = async (req, res) => {
    try {
        const reports = await Report.find().populate('reportedBy', 'name email');
        res.json(reports);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Stats
const getStats = async (req, res) => {
    try {
        const now = new Date();
        const endUtc = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
            23, 59, 59, 999
        ));
        const startUtc = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate() - 6,
            0, 0, 0, 0
        ));
        const prevStartUtc = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate() - 13,
            0, 0, 0, 0
        ));
        const prevEndUtc = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate() - 7,
            23, 59, 59, 999
        ));

        const revenueMatch = {
            $or: [
                { status: { $in: ['completed', 'delivered'] } },
                { paymentStatus: 'success' }
            ]
        };

        const [
            totalUsers,
            activeUsers,
            blockedUsers,
            totalProducts,
            totalOrders,
            revenueAgg,
            revenue7dAgg,
            revenuePrev7dAgg,
            salesAgg
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ isBlocked: false }),
            User.countDocuments({ isBlocked: true }),
            Product.countDocuments({ status: 'approved', isAvailable: true }),
            Order.countDocuments(),
            Order.aggregate([
                { $match: revenueMatch },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]),
            Order.aggregate([
                { $match: { ...revenueMatch, createdAt: { $gte: startUtc, $lte: endUtc } } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]),
            Order.aggregate([
                { $match: { ...revenueMatch, createdAt: { $gte: prevStartUtc, $lte: prevEndUtc } } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]),
            Order.aggregate([
                { $match: { ...revenueMatch, createdAt: { $gte: startUtc, $lte: endUtc } } },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' }
                        },
                        total: { $sum: '$totalAmount' }
                    }
                },
                { $sort: { _id: 1 } }
            ])
        ]);

        const revenue = revenueAgg[0]?.total || 0;
        const revenue7d = revenue7dAgg[0]?.total || 0;
        const revenuePrev7d = revenuePrev7dAgg[0]?.total || 0;
        const growthPercent = revenuePrev7d > 0
            ? Number((((revenue7d - revenuePrev7d) / revenuePrev7d) * 100).toFixed(1))
            : 0;

        const salesMap = new Map(salesAgg.map((entry) => [entry._id, entry.total]));
        const labels = [];
        const data = [];
        for (let i = 0; i < 7; i += 1) {
            const day = new Date(startUtc.getTime() + (i * 24 * 60 * 60 * 1000));
            const key = day.toISOString().slice(0, 10);
            labels.push(day.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }));
            data.push(Number(salesMap.get(key) || 0));
        }

        res.json({
            totalUsers,
            totalProducts,
            totalOrders,
            revenue,
            activeUsers,
            blockedUsers,
            salesByDay: { labels, data },
            growthPercent
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    getAllUsers, blockUser, unblockUser, deleteUser,
    getAllProducts, approveProduct, rejectProduct, deleteProduct,
    getAllOrders, updateOrderStatus,
    getAllReports, getStats
};
