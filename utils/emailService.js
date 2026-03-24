const nodemailer = require('nodemailer');

const getSmtpConfig = () => {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM;
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    if (!host || !port || !user || !pass || !from) {
        throw new Error('SMTP configuration missing. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM');
    }

    return { host, port, user, pass, from, secure };
};

const createTransporter = () => {
    const { host, port, user, pass, secure } = getSmtpConfig();
    return nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass }
    });
};

const sendVerificationOtp = async (email, otp) => {
    const { from } = getSmtpConfig();
    const transporter = createTransporter();
    const subject = 'Campus Bazaar Email Verification OTP';
    const text = `Your Campus Bazaar verification OTP is ${otp}. It expires in 10 minutes.`;
    const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <h2>Verify your Campus Bazaar account</h2>
            <p>Your OTP is:</p>
            <p style="font-size: 22px; font-weight: bold;">${otp}</p>
            <p>This code expires in 10 minutes.</p>
        </div>
    `;

    await transporter.sendMail({
        from,
        to: email,
        subject,
        text,
        html
    });
};

module.exports = { sendVerificationOtp };
