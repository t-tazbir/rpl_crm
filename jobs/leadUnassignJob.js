const cron = require('node-cron');
const pool = require('../config/db');
const { logActivity } = require('../services/activityLogService');

// 1 month (30 days) is just a WARNING shown to the rep ("Stale Leads").
// 120 days of the same inactivity is the hard threshold where the lead
// gets pulled away entirely, since at that point it's effectively dead
// in that rep's hands and Management should redistribute it.
const UNASSIGN_THRESHOLD_DAYS = 120;

async function unassignStaleLeads() {
    // Same "no upcoming follow-up AND no edit of any kind" definition as the
    // 30-day Stale Leads warning, just at a longer threshold. Using
    // updated_at (not created_at) means a rep who's actively writing call
    // notes, ticking meeting checkboxes, etc. never gets a lead pulled out
    // from under them just because they didn't also move the follow-up date.
    const [stale] = await pool.query(
        `SELECT id FROM leads
         WHERE status = 'Active' AND sales_rep_id IS NOT NULL
           AND (next_follow_up IS NULL OR next_follow_up <= NOW())
           AND updated_at <= NOW() - INTERVAL ? DAY`,
        [UNASSIGN_THRESHOLD_DAYS]
    );

    for (const lead of stale) {
        // Move to the unassigned pool: keep a record of who had it
        // (previous_sales_rep_id) and when it was released, clear the
        // now-meaningless follow-up date, and drop the cluster head link
        // too since it only ever existed via the sales rep.
        await pool.query(
            `UPDATE leads
             SET previous_sales_rep_id = sales_rep_id,
                 sales_rep_id = NULL,
                 cluster_head_id = NULL,
                 next_follow_up = NULL,
                 unassigned_at = NOW()
             WHERE id = ?`,
            [lead.id]
        );

        // No one owns this lead right now — cancel any pending WhatsApp
        // follow-up reminder cycle for it.
        await pool.query(
            "UPDATE followup_reminders SET status = 'cancelled' WHERE lead_id = ? AND status = 'active'",
            [lead.id]
        );

        await logActivity(
            lead.id,
            null, // system-generated, no human actor
            'unassigned',
            `Automatically unassigned after ${UNASSIGN_THRESHOLD_DAYS} days with no nursing activity`
        );
    }

    if (stale.length > 0) {
        console.log(`Auto-unassigned ${stale.length} lead(s) after ${UNASSIGN_THRESHOLD_DAYS} days with no nursing.`);
    }
    return stale.length;
}

function startLeadUnassignJob() {
    // Once a day is plenty for a 120-day threshold — no need for finer granularity.
    cron.schedule('0 2 * * *', async () => {
        try {
            await unassignStaleLeads();
        } catch (err) {
            console.error('Lead auto-unassign job failed:', err);
        }
    });
    console.log(`Lead auto-unassign job scheduled (daily, ${UNASSIGN_THRESHOLD_DAYS}-day inactivity threshold).`);
}

module.exports = { startLeadUnassignJob, unassignStaleLeads };
