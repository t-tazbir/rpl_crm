const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'profile-pictures');
fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        // req.user is set by authMiddleware, which must run BEFORE this
        // middleware in the route chain (see userRoutes.js).
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `user_${req.user.id}_${Date.now()}${ext}`);
    }
});

function fileFilter(req, file, cb) {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
        return cb(new Error('Only JPG, PNG, or WEBP images are allowed.'));
    }
    cb(null, true);
}

const uploader = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE } }).single('profile_picture');

// Wrap multer so upload errors (bad type, too large, etc.) come back as a
// normal JSON error response instead of an unhandled exception.
module.exports = function uploadProfilePictureMiddleware(req, res, next) {
    uploader(req, res, (err) => {
        if (err) {
            const message = err.code === 'LIMIT_FILE_SIZE'
                ? 'Image must be under 2MB.'
                : (err.message || 'Upload failed.');
            return res.status(400).json({ message });
        }
        next();
    });
};
