const { register, login, verifyOtp, resendOtp, updateProfile, changePassword } = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { validateRegister, validateProfileUpdate, validateChangePassword, handleValidationErrors } = require('../middleware/validators');
const multer = require('multer');
const path = require('path');
const express = require('express');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, 'avatar-' + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

const router = express.Router();

router.post('/register', validateRegister, handleValidationErrors, register);
router.post('/login', login);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.put('/update-profile', authMiddleware, upload.single('avatar'), validateProfileUpdate, handleValidationErrors, updateProfile);
router.post('/change-password', authMiddleware, validateChangePassword, handleValidationErrors, changePassword);

module.exports = router;
