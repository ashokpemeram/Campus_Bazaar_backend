const { register, login, verifyOtp, resendOtp, updateProfile, changePassword } = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { validateRegister, validateProfileUpdate, validateChangePassword, handleValidationErrors } = require('../middleware/validators');
const express = require('express');
const { avatarUpload } = require('../middleware/upload');

const router = express.Router();

router.post('/register', validateRegister, handleValidationErrors, register);
router.post('/login', login);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.put('/update-profile', authMiddleware, avatarUpload.single('avatar'), validateProfileUpdate, handleValidationErrors, updateProfile);
router.post('/change-password', authMiddleware, validateChangePassword, handleValidationErrors, changePassword);

module.exports = router;
