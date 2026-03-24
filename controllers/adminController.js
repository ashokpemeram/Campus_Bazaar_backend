const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Report = require('../models/Report');

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
        const totalUsers = await User.countDocuments();
        const totalProducts = await Product.countDocuments();
        const totalOrders = await Order.countDocuments();
        const stats = { totalUsers, totalProducts, totalOrders };
        res.json(stats);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    getAllUsers, blockUser, deleteUser,
    getAllProducts, approveProduct, rejectProduct,
    getAllOrders, updateOrderStatus,
    getAllReports, getStats
};
