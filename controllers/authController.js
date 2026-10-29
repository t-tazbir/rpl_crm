const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');
const { sendPasswordResetEmail } = require('../services/emailService');

// ── Bug #6 fix: HttpOnly cookie instead of token-in-JSON-body ──────────────
const COOKIE_NAME = 'token';
const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/'
};

// ── Password reset config ───────────────────────────────────────────────────
// Token lives for 30 minutes — long enough for someone to check their email,
// short enough that a leaked/old link stops being useful quickly.
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

// @route   POST /api/auth/login
exports.login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Please provide email and password' });
    }

    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);

        if (rows.length === 0) {
            return res.status(401).json({ message: 'Invalid Email or Password' });
        }

        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid Email or Password' });
        }

        const payload = {
            user: {
                id: user.id,
                role: user.role,
                cluster_head_id: user.cluster_head_id
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '8h' },
            (err, token) => {
                if (err) throw err;

                res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

                res.json({
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        role: user.role
                    }
                });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @route   POST /api/auth/logout
exports.logout = (req, res) => {
    res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
    res.json({ message: 'Logged out' });
};

// @route   POST /api/auth/reset-password
// @desc    Change password for the CURRENTLY LOGGED IN user (knows their old password).
//          This is different from the forgot-password flow below, which is for someone
//          who can't log in at all because they forgot the password.
exports.resetPassword = async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;

    try {
        const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [userId]);
        const user = rows[0];

        const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ message: 'Incorrect old password' });
        }

        const salt = await bcrypt.genSalt(10);
        const newHashedPassword = await bcrypt.hash(newPassword, salt);

        await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHashedPassword, userId]);

        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server Error' });
    }
};

// ════════════════════════════════════════════════════════════════════════════
// FORGOT PASSWORD FLOW — for someone who is logged OUT and can't remember
// their password at all. Three steps, three endpoints:
//   1. POST /forgot-password           — user submits their email
//   2. GET  /forgot-password/verify    — reset-password.html checks the link is still valid
//   3. POST /forgot-password/confirm   — user submits a new password + the token
// ════════════════════════════════════════════════════════════════════════════

// @route   POST /api/auth/forgot-password   { email }
// @desc    Generate a one-time reset token and email a reset link.
//          SECURITY: always returns the same generic success message whether or
//          not the email exists in our system — a different message for
//          "email not found" vs "email sent" lets an attacker enumerate every
//          registered email address on the platform one guess at a time.
exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const GENERIC_MESSAGE = 'If an account exists for that email, a password reset link has been sent.';

    try {
        const [rows] = await pool.query('SELECT id, name, email FROM users WHERE email = ?', [email.trim().toLowerCase()]);

        // Deliberately do NOT reveal whether the email exists — same response either way.
        if (rows.length === 0) {
            return res.json({ message: GENERIC_MESSAGE });
        }

        const user = rows[0];

        // Generate a random token. We store only its HASH in the database — exactly
        // like a password — so that even someone with read access to the database
        // (a backup leak, an SQL injection elsewhere, a careless query log) cannot
        // reconstruct a working reset link. Only the raw token (sent via email,
        // never stored) can complete a reset.
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

        // Overwriting any previous token here automatically invalidates an older,
        // still-unused reset link if the user requests a new one — only the latest
        // link is ever valid.
        await pool.query(
            'UPDATE users SET reset_token_hash = ?, reset_token_expires = ? WHERE id = ?',
            [tokenHash, expiresAt, user.id]
        );

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
        const resetLink = `${frontendUrl}/reset-password.html?token=${rawToken}`;

        await sendPasswordResetEmail(user.email, user.name, resetLink);

        res.json({ message: GENERIC_MESSAGE });
    } catch (err) {
        console.error('Forgot Password Error:', err.message);
        // Still return the generic message — don't leak server errors to a
        // pre-auth endpoint, and don't let a DB hiccup reveal account existence.
        res.json({ message: GENERIC_MESSAGE });
    }
};

// @route   GET /api/auth/forgot-password/verify?token=...
// @desc    Lets reset-password.html check the link is still valid BEFORE showing
//          the new-password form, so the user doesn't fill out a form only to
//          be told at the end that their 30-minute-old link expired.
exports.verifyResetToken = async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).json({ valid: false, message: 'No token provided' });

    try {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const [rows] = await pool.query(
            'SELECT id FROM users WHERE reset_token_hash = ? AND reset_token_expires > NOW()',
            [tokenHash]
        );

        if (rows.length === 0) {
            return res.status(400).json({ valid: false, message: 'This reset link is invalid or has expired.' });
        }

        res.json({ valid: true });
    } catch (err) {
        console.error('Verify Reset Token Error:', err.message);
        res.status(500).json({ valid: false, message: 'Server Error' });
    }
};

// @route   POST /api/auth/forgot-password/confirm   { token, newPassword }
// @desc    Actually sets the new password, IF the token is valid and unexpired.
exports.confirmPasswordReset = async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token and new password are required' });
    }
    if (newPassword.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    try {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const [rows] = await pool.query(
            'SELECT id FROM users WHERE reset_token_hash = ? AND reset_token_expires > NOW()',
            [tokenHash]
        );

        if (rows.length === 0) {
            return res.status(400).json({ message: 'This reset link is invalid or has expired. Please request a new one.' });
        }

        const userId = rows[0].id;
        const salt = await bcrypt.genSalt(10);
        const newHashedPassword = await bcrypt.hash(newPassword, salt);

        // Clear the token in the SAME query as the password update — this makes the
        // token single-use. Without this, the same email link could reset the
        // password again and again until it naturally expired.
        await pool.query(
            'UPDATE users SET password_hash = ?, reset_token_hash = NULL, reset_token_expires = NULL WHERE id = ?',
            [newHashedPassword, userId]
        );

        // NOTE (known limitation, flagging honestly): this does not invalidate any
        // OTHER session the user might already be logged into elsewhere (e.g. their
        // phone). Because auth uses stateless JWTs (see authMiddleware.js), a cookie
        // issued before the reset remains valid until it naturally expires (8h) —
        // there's no server-side session table to revoke against. Properly fixing
        // this needs a token-versioning or session-blacklist system, which is a
        // bigger change than this feature; happy to build that separately if it
        // matters for your threat model (e.g. "reset because my device was stolen").

        res.json({ message: 'Password reset successfully. You can now log in with your new password.' });
    } catch (err) {
        console.error('Confirm Password Reset Error:', err.message);
        res.status(500).json({ message: 'Server Error' });
    }
};
