const bcrypt = require('bcryptjs');

const OTP_LENGTH = 6;
const OTP_TTL_MS = 10 * 60 * 1000;

const generateOtp = () => {
    const min = 10 ** (OTP_LENGTH - 1);
    const max = 10 ** OTP_LENGTH - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
};

const hashOtp = async (otp) => {
    return await bcrypt.hash(otp, 10);
};

const compareOtp = async (otp, hash) => {
    if (!hash) return false;
    return await bcrypt.compare(otp, hash);
};

const getOtpExpiry = () => {
    return new Date(Date.now() + OTP_TTL_MS);
};

module.exports = { OTP_LENGTH, OTP_TTL_MS, generateOtp, hashOtp, compareOtp, getOtpExpiry };
