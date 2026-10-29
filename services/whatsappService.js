const axios = require('axios');

// ============================================================
// IMPORTANT — read before enabling this in production:
//
// WhatsApp does NOT allow a business to freely message a user
// outside a 24-hour window that the user themselves opened
// (by messaging you first). A scheduled reminder like this one
// is a business-initiated message, so Meta requires it to use a
// pre-approved MESSAGE TEMPLATE, not free-form text. You'll need to:
//   1. Create a WhatsApp Business Platform account (business.facebook.com)
//   2. Get a Phone Number ID + permanent access token
//   3. Submit a template (e.g. "followup_reminder") for approval —
//      something like: "Reminder: follow-up with {{1}} at {{2}}."
//   4. Put WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, and
//      WHATSAPP_TEMPLATE_NAME in your .env
//
// Until that's set up, this function will just log to the console
// (see the catch block) instead of throwing — so the reminder engine
// still runs/tracks state correctly, you just won't get real messages.
// ============================================================

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_TEMPLATE_NAME = process.env.WHATSAPP_TEMPLATE_NAME || 'followup_reminder';
const WHATSAPP_API_VERSION = 'v20.0';

/**
 * Send a WhatsApp template message.
 * @param {string} toPhone - E.164-ish number, e.g. '8801711000001' (no leading +)
 * @param {string[]} templateParams - values to fill the approved template's {{1}}, {{2}}, ... placeholders
 */
async function sendWhatsAppMessage(toPhone, templateParams = []) {
    if (!toPhone) throw new Error('No destination phone number provided');

    if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
        console.warn(`[WhatsApp:DRY-RUN] Would send to ${toPhone} — params: ${JSON.stringify(templateParams)} (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID not configured)`);
        return { simulated: true };
    }

    const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

    const payload = {
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'template',
        template: {
            name: WHATSAPP_TEMPLATE_NAME,
            language: { code: 'en' },
            components: [
                {
                    type: 'body',
                    parameters: templateParams.map((p) => ({ type: 'text', text: String(p) }))
                }
            ]
        }
    };

    try {
        const res = await axios.post(url, payload, {
            headers: {
                Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        return res.data;
    } catch (err) {
        console.error('WhatsApp send failed:', err.response?.data || err.message);
        throw err;
    }
}

module.exports = { sendWhatsAppMessage };
