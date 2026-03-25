const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { normalizeEmail, getEmailDomain, isAllowedCollegeEmail } = require('../utils/emailValidation');
const { generateOtp, hashOtp, compareOtp, getOtpExpiry } = require('../utils/otp');
const { sendVerificationOtp } = require('../utils/emailService');
const { resolveCollegeName, normalizeCollegeName, upsertCollegeDomain } = require('../utils/collegeResolver');

const syncCollegeFields = async (user) => {
    if (user.collegeDomain && user.collegeName) return;
    const domain = user.collegeDomain || getEmailDomain(user.email);
    if (!domain) return;
    const info = await resolveCollegeName(domain);
    user.collegeDomain = domain;
    user.collegeName = info.collegeName;
    if (!user.college) user.college = info.collegeName;
};

const register = async (req, res) => {
    try {
        const { name, email, password, collegeName, collegeConfirmed } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Name, email, and password are required' });
        }

        const normalizedEmail = normalizeEmail(email);
        const emailDomain = getEmailDomain(normalizedEmail);
        if (!emailDomain) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        if (!isAllowedCollegeEmail(normalizedEmail)) {
            return res.status(400).json({ message: 'Only college email IDs are allowed' });
        }

        let user = await User.findOne({ email: normalizedEmail });
        if (user) return res.status(400).json({ message: 'User already exists' });

        const collegeInfo = await resolveCollegeName(emailDomain);
        let finalCollegeName = collegeInfo.collegeName;
        const isFallback = collegeInfo.isFallback;
        const confirmed = collegeConfirmed === true || collegeConfirmed === 'true';

        if (isFallback) {
            if (!confirmed) {
                return res.status(400).json({ message: 'Please confirm your college name' });
            }

            const normalizedOverride = normalizeCollegeName(collegeName);
            if (normalizedOverride) {
                finalCollegeName = normalizedOverride;
            }

            await upsertCollegeDomain(emailDomain, finalCollegeName);
        }

        const otp = generateOtp();
        const otpHash = await hashOtp(otp);
        const otpExpires = getOtpExpiry();

        user = new User({
            name,
            email: normalizedEmail,
            password,
            college: finalCollegeName,
            collegeName: finalCollegeName,
            collegeDomain: emailDomain,
            verificationOtpHash: otpHash,
            verificationOtpExpires: otpExpires
        });

        await user.save();

        try {
            sendVerificationOtp(normalizedEmail, otp)
                .then(() => res.status(201).json({ message: 'Verification OTP sent to your college email' }))
                .catch(err => console.error("Email error:", err));
        } catch (mailErr) {
            return res.status(201).json({
                message: "User registered. OTP will be sent shortly."
            });
            // await User.deleteOne({ _id: user._id });
            // return res.status(500).json({ message: mailErr.message || 'Failed to send verification email' });
        }

        
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = normalizeEmail(email);
        const user = await User.findOne({ email: normalizedEmail });
        if (!user || user.isBlocked) return res.status(400).json({ message: 'Invalid credentials or user blocked' });

        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        if (user.role !== 'admin' && !isAllowedCollegeEmail(user.email)) {
            return res.status(403).json({ message: 'Only college email IDs are allowed' });
        }

        if (user.role !== 'admin' && !user.isVerified) {
            return res.status(403).json({ message: 'Please verify your college email first' });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
        res.json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                college: user.college,
                collegeName: user.collegeName || user.college,
                collegeDomain: user.collegeDomain || getEmailDomain(user.email),
                avatar: user.avatar
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const sanitizedOtp = otp ? otp.toString().trim() : '';
        if (!email || !sanitizedOtp) {
            return res.status(400).json({ message: 'Email and OTP are required' });
        }

        const normalizedEmail = normalizeEmail(email);
        const emailDomain = getEmailDomain(normalizedEmail);
        if (!emailDomain) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        if (!isAllowedCollegeEmail(normalizedEmail)) {
            return res.status(400).json({ message: 'Only college email IDs are allowed' });
        }
        const user = await User.findOne({ email: normalizedEmail });
        if (!user) return res.status(400).json({ message: 'Invalid email or OTP' });
        if (user.isVerified) return res.status(400).json({ message: 'Email is already verified' });

        if (!user.verificationOtpHash || !user.verificationOtpExpires) {
            return res.status(400).json({ message: 'OTP not found. Please resend OTP.' });
        }

        if (user.verificationOtpExpires.getTime() < Date.now()) {
            return res.status(400).json({ message: 'OTP expired. Please resend OTP.' });
        }

        const isMatch = await compareOtp(sanitizedOtp, user.verificationOtpHash);
        if (!isMatch) return res.status(400).json({ message: 'Invalid email or OTP' });

        user.isVerified = true;
        user.verificationOtpHash = undefined;
        user.verificationOtpExpires = undefined;
        await syncCollegeFields(user);
        await user.save();

        res.json({ message: 'Email verified successfully. You can now log in.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const resendOtp = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: 'Email is required' });

        const normalizedEmail = normalizeEmail(email);
        const emailDomain = getEmailDomain(normalizedEmail);
        if (!emailDomain) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        if (!isAllowedCollegeEmail(normalizedEmail)) {
            return res.status(400).json({ message: 'Only college email IDs are allowed' });
        }
        const user = await User.findOne({ email: normalizedEmail });
        if (!user) return res.status(400).json({ message: 'User not found' });
        if (user.isVerified) return res.status(400).json({ message: 'Email is already verified' });

        const otp = generateOtp();
        user.verificationOtpHash = await hashOtp(otp);
        user.verificationOtpExpires = getOtpExpiry();
        await syncCollegeFields(user);
        await user.save();

        try {
            await sendVerificationOtp(normalizedEmail, otp);
        } catch (mailErr) {
            user.verificationOtpHash = undefined;
            user.verificationOtpExpires = undefined;
            await user.save();
            return res.status(500).json({ message: mailErr.message || 'Failed to send verification email' });
        }

        res.json({ message: 'OTP resent to your college email' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const updateProfile = async (req, res) => {
    try {
        const { name, password } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (name) user.name = name;
        if (password) user.password = password;
        if (req.file) user.avatar = req.file.filename;

        await user.save();
        res.json({
            message: 'Profile updated',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                college: user.college,
                collegeName: user.collegeName || user.college,
                collegeDomain: user.collegeDomain || getEmailDomain(user.email),
                avatar: user.avatar
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { register, login, verifyOtp, resendOtp, updateProfile };
