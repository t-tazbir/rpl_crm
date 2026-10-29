const nodemailer = require('nodemailer');

// ============================================================
// IMPORTANT — read before relying on this in production:
//
// This needs a real SMTP provider to actually deliver email (e.g. Gmail SMTP for
// testing, or a transactional service like SendGrid/Mailgun/Amazon SES for
// production — Gmail's own SMTP has low sending limits and providers routinely
// mark it as spam-risk for anything automated). Put these in your .env:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM
//
// Until those are set, this function does NOT throw — it just logs the reset
// link to the console instead (see the else-branch below). This mirrors
// whatsappService.js's dry-run behavior: the password-reset FLOW still works
// end-to-end for local development and testing (you just read the link from
// the server console instead of an inbox), and nothing crashes just because
// email isn't configured yet.
// ============================================================

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const MAIL_FROM = process.env.MAIL_FROM || 'Rangs Properties <no-reply@rangsproperties.com>';

let transporter = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: Number(SMTP_PORT) === 465, // true for port 465, false for 587/25 (STARTTLS)
        auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
}

/**
 * Send a password-reset email containing a one-time link.
 * @param {string} toEmail
 * @param {string} userName
 * @param {string} resetLink - full URL including the raw (unhashed) token
 */
async function sendPasswordResetEmail(toEmail, userName, resetLink) {
    if (!transporter) {
        console.warn(`[Email:DRY-RUN] Password reset for ${toEmail} (${userName}) — SMTP not configured.`);
        console.warn(`[Email:DRY-RUN] Reset link: ${resetLink}`);
        return { simulated: true };
    }

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #0F172A;">Reset your password</h2>
            <p>Hi ${userName || 'there'},</p>
            <p>We received a request to reset the password for your Rangs Properties account. Click the button below to choose a new password. This link expires in 30 minutes.</p>
            <p style="text-align: center; margin: 32px 0;">
                <a href="${resetLink}" style="background: #0F172A; color: #F4C542; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Reset Password</a>
            </p>
            <p style="color: #64748B; font-size: 13px;">If you didn't request this, you can safely ignore this email — your password will not be changed.</p>
            <p style="color: #94A3B8; font-size: 12px;">If the button doesn't work, copy and paste this link into your browser:<br>${resetLink}</p>
        </div>
    `;

    try {
        return await transporter.sendMail({
            from: MAIL_FROM,
            to: toEmail,
            subject: 'Reset your Rangs Properties password',
            html
        });
    } catch (err) {
        // Don't let an email-provider outage surface a stack trace to the pre-auth
        // endpoint that called this — forgotPassword() already returns a generic
        // success message regardless, so this failure is logged for an admin to
        // notice, not shown to the requester.
        console.error('Password reset email failed:', err.message);
        throw err;
    }
}

module.exports = { sendPasswordResetEmail };
