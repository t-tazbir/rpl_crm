const pool = require('../config/db');

/**
 * Log one activity entry for a lead, and count it as nursing by bumping
 * the lead's updated_at — this is what the stale/unassign checks key off,
 * so logging a call/note/meeting here always resets that clock, even for
 * activity types that don't otherwise change any column on the lead itself.
 *
 * @param {number} leadId
 * @param {number|null} userId - null for system-generated entries (e.g. auto-unassign job)
 * @param {string} activityType - see the ENUM in migration_v6.sql
 * @param {string} description - human-readable summary shown in the timeline
 */
async function logActivity(leadId, userId, activityType, description) {
    await pool.query(
        'INSERT INTO lead_activities (lead_id, user_id, activity_type, description) VALUES (?, ?, ?, ?)',
        [leadId, userId, activityType, description]
    );
    await pool.query('UPDATE leads SET updated_at = NOW() WHERE id = ?', [leadId]);
}

module.exports = { logActivity };
