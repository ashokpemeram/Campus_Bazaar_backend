const jwt = require('jsonwebtoken');
const User = require('../models/User');

const optionalAuth = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return next();

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        const user = await User.findById(decoded.id).select('-password');
        if (!user || user.isBlocked) return next();
        req.user = user;
        return next();
    } catch (err) {
        return next();
    }
};

module.exports = { optionalAuth };
