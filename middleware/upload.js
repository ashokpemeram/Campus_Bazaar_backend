const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { initCloudinary, shouldUseCloudinary } = require('../utils/cloudinary');

const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const getMaxFileSize = () => {
    const parsed = Number(process.env.UPLOAD_MAX_FILE_SIZE_BYTES);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_FILE_SIZE_BYTES;
};

const imageOnlyFilter = (req, file, cb) => {
    if (file?.mimetype?.startsWith('image/')) return cb(null, true);
    return cb(new Error('Only image uploads are allowed'));
};

const ensureUploadsDir = (dirPath) => {
    try {
        fs.mkdirSync(dirPath, { recursive: true });
    } catch (err) {
        // Let multer surface the error if it still can't write.
    }
};

const makeDiskStorage = ({ prefix }) => {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    ensureUploadsDir(uploadDir);

    return multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadDir),
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname || '').toLowerCase();
            const id = crypto.randomUUID();
            cb(null, `${prefix}${id}${ext}`);
        }
    });
};

const createMulter = ({ prefix }) => {
    const useCloudinary = shouldUseCloudinary();

    if (useCloudinary) {
        const { cloudinaryReady, reason } = initCloudinary();
        if (!cloudinaryReady) {
            const explicit = (process.env.USE_CLOUDINARY || '').toLowerCase() === 'true';
            if (explicit) {
                throw new Error(
                    reason === 'cloudinary_package_missing'
                        ? 'USE_CLOUDINARY=true but the cloudinary package is not installed'
                        : 'USE_CLOUDINARY=true but Cloudinary environment variables are missing'
                );
            }

            if (reason === 'cloudinary_package_missing') {
                console.warn('[Uploads] Cloudinary env detected but `cloudinary` package is missing. Falling back to local uploads.');
            } else if (reason === 'cloudinary_env_missing') {
                console.warn('[Uploads] Cloudinary is enabled but env vars are missing. Falling back to local uploads.');
            }
            // Auto-fallback for dev when Cloudinary isn't fully ready.
            return multer({
                storage: makeDiskStorage({ prefix }),
                limits: { fileSize: getMaxFileSize() },
                fileFilter: imageOnlyFilter
            });
        }

        return multer({
            storage: multer.memoryStorage(),
            limits: { fileSize: getMaxFileSize() },
            fileFilter: imageOnlyFilter
        });
    }

    return multer({
        storage: makeDiskStorage({ prefix }),
        limits: { fileSize: getMaxFileSize() },
        fileFilter: imageOnlyFilter
    });
};

const avatarUpload = createMulter({ prefix: 'avatar-' });
const productImageUpload = createMulter({ prefix: 'product-' });

module.exports = {
    avatarUpload,
    productImageUpload
};
