const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { isAllowedCollegeEmail } = require('../utils/emailValidation');

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        req.user = await User.findById(decoded.id).select('-password');
        
        if (!req.user || req.user.isBlocked) {
            return res.status(403).json({ message: 'User not found or blocked' });
        }

        if (req.user.role !== 'admin' && !isAllowedCollegeEmail(req.user.email)) {
            return res.status(403).json({ message: 'Only college email IDs are allowed' });
        }

        if (req.user.role !== 'admin' && !req.user.isVerified) {
            return res.status(403).json({ message: 'Please verify your college email first' });
        }
        
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};

const adminMiddleware = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Only admin can access this route' });
    }
};

module.exports = { authMiddleware, adminMiddleware };
