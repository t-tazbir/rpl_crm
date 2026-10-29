const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/authMiddleware');

// Public Route
router.post('/login', authController.login);

// Bug #6 fix: logout must be a real endpoint now — the frontend can no longer
// just delete a localStorage key, since the browser (not JS) holds the cookie.
router.post('/logout', authController.logout);

// Protected Route (Requires token middleware) — for a LOGGED IN user changing
// their password knowing the old one.
router.post('/reset-password', auth, authController.resetPassword);

// ── Forgot-password flow — all public, since by definition the user is NOT
// logged in when they need these (that's the whole problem being solved). ──
router.post('/forgot-password', authController.forgotPassword);
router.get('/forgot-password/verify', authController.verifyResetToken);
router.post('/forgot-password/confirm', authController.confirmPasswordReset);

module.exports = router;
