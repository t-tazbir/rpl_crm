const pool = require('../config/db');

// SALES_MAN can only touch their own leads, TEAM_LEAD only leads belonging to
// sales reps currently under them, CLUSTER_HEAD only leads currently in their
// team (Team Lead or not — cluster_head_id is set on every lead regardless of
// whether the rep also has a team_lead_id), DD_ED can touch any lead. An
// unassigned lead (sales_rep_id NULL) has no current owner, so only DD_ED can
// act on it.
async function assertLeadAccess(leadId, user) {
    const [rows] = await pool.query(
        `SELECT l.id, l.sales_rep_id, l.cluster_head_id, u.team_lead_id AS rep_team_lead_id
         FROM leads l
         LEFT JOIN users u ON u.id = l.sales_rep_id
         WHERE l.id = ?`,
        [leadId]
    );
    if (rows.length === 0) return { ok: false, code: 404, message: 'Lead khuje pawa jayni.' };

    const lead = rows[0];

    if (user.role === 'SALES_MAN' && lead.sales_rep_id !== user.id) {
        return { ok: false, code: 403, message: 'Access Denied: Apni onno karo lead dekhte/edit korte parben na.' };
    }

    // TEAM_LEAD: the lead's rep must currently report to this Team Lead. This is
    // checked LIVE via a join, not a cached/snapshotted value — so if a Cluster
    // Head reassigns a rep away from this Team Lead mid-day, access to that
    // rep's leads (old ones included) is revoked immediately on the next request,
    // with no stale-permission window.
    if (user.role === 'TEAM_LEAD' && lead.rep_team_lead_id !== user.id) {
        return { ok: false, code: 403, message: 'Access Denied: Ei lead ti apnar team er under e nei.' };
    }

    if (user.role === 'CLUSTER_HEAD' && lead.cluster_head_id !== user.id) {
        return { ok: false, code: 403, message: 'Access Denied: Ei lead ti apnar team er under e nei.' };
    }

    return { ok: true, lead };
}

module.exports = { assertLeadAccess };
