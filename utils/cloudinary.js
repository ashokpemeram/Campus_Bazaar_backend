let cloudinary = null;

const hasCloudinaryEnv = () => {
    return Boolean(
        process.env.CLOUDINARY_URL ||
            (process.env.CLOUDINARY_CLOUD_NAME &&
                process.env.CLOUDINARY_API_KEY &&
                process.env.CLOUDINARY_API_SECRET)
    );
};

const initCloudinary = () => {
    if (cloudinary) return { cloudinary, cloudinaryReady: true };

    let sdk;
    try {
        sdk = require('cloudinary').v2;
    } catch (err) {
        return { cloudinary: null, cloudinaryReady: false, reason: 'cloudinary_package_missing' };
    }

    if (!hasCloudinaryEnv()) {
        return { cloudinary: null, cloudinaryReady: false, reason: 'cloudinary_env_missing' };
    }

    if (process.env.CLOUDINARY_URL) {
        try {
            const parsed = new URL(process.env.CLOUDINARY_URL);
            const cloudName = parsed.hostname;
            const apiKey = decodeURIComponent(parsed.username || '');
            const apiSecret = decodeURIComponent(parsed.password || '');

            if (!cloudName || !apiKey || !apiSecret) {
                return { cloudinary: null, cloudinaryReady: false, reason: 'cloudinary_env_missing' };
            }

            sdk.config({
                cloud_name: cloudName,
                api_key: apiKey,
                api_secret: apiSecret,
                secure: true
            });
        } catch (err) {
            return { cloudinary: null, cloudinaryReady: false, reason: 'cloudinary_env_missing' };
        }
    } else {
        sdk.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
            secure: true
        });
    }

    cloudinary = sdk;
    return { cloudinary, cloudinaryReady: true };
};

const shouldUseCloudinary = () => {
    const flag = (process.env.USE_CLOUDINARY || '').toLowerCase();
    if (flag === 'true') return true;
    if (flag === 'false') return false;
    return hasCloudinaryEnv();
};

module.exports = {
    initCloudinary,
    shouldUseCloudinary
};
