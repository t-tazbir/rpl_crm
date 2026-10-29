const pool = require('../config/db');

// Call this any time a lead's next_follow_up OR stage/status changes.
// - If there's no follow-up time, or the lead is no longer Active, any
//   existing reminder cycle for this lead is cancelled.
// - If there IS a future follow-up time, the old cycle is cancelled and
//   a fresh one is started (so editing the time immediately resets the
//   "every 10 min" clock, and moving the lead to a new stage stops it).
async function syncReminderForLead(leadId, nextFollowUp, leadStatus) {
    await pool.query(
        "UPDATE followup_reminders SET status = 'cancelled' WHERE lead_id = ? AND status = 'active'",
        [leadId]
    );

    if (!nextFollowUp || leadStatus !== 'Active') return;

    const followUpDate = new Date(nextFollowUp);
    if (isNaN(followUpDate.getTime()) || followUpDate <= new Date()) return; // don't schedule reminders for past times

    await pool.query(
        'INSERT INTO followup_reminders (lead_id, follow_up_at, status) VALUES (?, ?, "active")',
        [leadId, nextFollowUp]
    );
}

module.exports = { syncReminderForLead };
