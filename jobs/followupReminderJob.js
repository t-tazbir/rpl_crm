const cron = require('node-cron');
const pool = require('../config/db');
const { sendWhatsAppMessage } = require('../services/whatsappService');

// Assumption (flagging this clearly): once a follow-up's scheduled time has
// actually passed, we stop reminding and mark the cycle 'done' — otherwise
// an ignored reminder would ping every 10 minutes forever. If you'd rather
// it keep nagging past the deadline too, remove the expireOverdue() call below.
async function expireOverdue() {
    await pool.query(
        "UPDATE followup_reminders SET status = 'done' WHERE status = 'active' AND follow_up_at <= NOW()"
    );
}

async function sendDueReminders() {
    const [rows] = await pool.query(`
        SELECT fr.id as reminder_id, fr.follow_up_at, fr.send_count,
               l.lead_name, l.project,
               u.name as rep_name, u.phone as rep_phone
        FROM followup_reminders fr
        JOIN leads l ON l.id = fr.lead_id
        JOIN users u ON u.id = l.sales_rep_id
        WHERE fr.status = 'active'
          AND fr.follow_up_at > NOW()
          AND fr.follow_up_at <= NOW() + INTERVAL 4 HOUR
          AND (fr.last_sent_at IS NULL OR fr.last_sent_at <= NOW() - INTERVAL 10 MINUTE)
    `);

    for (const row of rows) {
        if (!row.rep_phone) {
            console.warn(`Skipping reminder #${row.reminder_id} — sales rep "${row.rep_name}" has no phone number on file.`);
            continue;
        }

        const timeLabel = new Date(row.follow_up_at).toLocaleString('en-GB', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        });

        try {
            await sendWhatsAppMessage(row.rep_phone, [row.rep_name, row.lead_name, timeLabel]);
            await pool.query(
                'UPDATE followup_reminders SET last_sent_at = NOW(), send_count = send_count + 1 WHERE id = ?',
                [row.reminder_id]
            );
        } catch (err) {
            // Don't let one failed send break the loop or the cron cycle.
            console.error(`Failed to send reminder #${row.reminder_id}:`, err.message);
        }
    }
}

function startFollowupReminderJob() {
    // Runs every 10 minutes — matches the "10 min por por" repeat cadence.
    cron.schedule('*/10 * * * *', async () => {
        try {
            await expireOverdue();
            await sendDueReminders();
        } catch (err) {
            console.error('Followup reminder job failed:', err);
        }
    });
    console.log('Follow-up WhatsApp reminder job scheduled (every 10 minutes).');
}

module.exports = { startFollowupReminderJob };
