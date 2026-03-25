const { body, validationResult } = require('express-validator');
const { CATEGORIES } = require('../config/categories');

const validateRegister = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Name is required')
        .matches(/^[A-Za-z\s]+$/)
        .withMessage('Name must contain only letters'),
    body('email')
        .trim()
        .isEmail()
        .withMessage('Invalid email'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters')
        .matches(/[A-Z]/)
        .withMessage('Must contain uppercase letter')
        .matches(/[a-z]/)
        .withMessage('Must contain lowercase letter')
        .matches(/[0-9]/)
        .withMessage('Must contain number')
        .matches(/[@$!%*?&]/)
        .withMessage('Must contain special character')
];

const validateProfileUpdate = [
    body('name')
        .if((value, { req }) => req.body?.name !== undefined)
        .trim()
        .notEmpty()
        .withMessage('Name is required')
        .matches(/^[A-Za-z\s]+$/)
        .withMessage('Name must contain only letters'),
    body('password')
        .optional({ checkFalsy: true })
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters')
        .matches(/[A-Z]/)
        .withMessage('Must contain uppercase letter')
        .matches(/[a-z]/)
        .withMessage('Must contain lowercase letter')
        .matches(/[0-9]/)
        .withMessage('Must contain number')
        .matches(/[@$!%*?&]/)
        .withMessage('Must contain special character')
];

const validateProduct = [
    body('price')
        .isNumeric()
        .withMessage('Price must be a number'),
    body('category')
        .isIn(CATEGORIES)
        .withMessage('Invalid category')
];

const validateChangePassword = [
    body('oldPassword')
        .notEmpty()
        .withMessage('Old password is required'),
    body('newPassword')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters')
        .matches(/[A-Z]/)
        .withMessage('Must contain uppercase letter')
        .matches(/[a-z]/)
        .withMessage('Must contain lowercase letter')
        .matches(/[0-9]/)
        .withMessage('Must contain number')
        .matches(/[@$!%*?&]/)
        .withMessage('Must contain special character')
];

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    return next();
};

module.exports = {
    validateRegister,
    validateProfileUpdate,
    validateProduct,
    validateChangePassword,
    handleValidationErrors
};
