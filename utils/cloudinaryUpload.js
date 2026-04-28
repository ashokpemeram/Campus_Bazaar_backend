const { initCloudinary } = require('./cloudinary');

const uploadBuffer = (buffer, options = {}) => {
    const { cloudinary, cloudinaryReady } = initCloudinary();
    if (!cloudinaryReady || !cloudinary) {
        const err = new Error('Cloudinary is not configured');
        err.code = 'CLOUDINARY_NOT_CONFIGURED';
        throw err;
    }

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
            if (error) return reject(error);
            return resolve(result);
        });
        stream.end(buffer);
    });
};

module.exports = { uploadBuffer };

