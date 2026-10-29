const pool = require('../config/db');
const { assertLeadAccess } = require('../services/leadAccessService');
const { logActivity } = require('../services/activityLogService');

const MANUAL_ACTIVITY_TYPES = ['call', 'note', 'meeting'];

// @route   GET /api/leads/:id/activities
// @desc    Full timeline for a lead — who did what, when. Same
//          ownership rule as everything else: SALES_MAN their own leads,
//          CLUSTER_HEAD their team's, DD_ED any lead.
exports.getActivities = async (req, res) => {
    try {
        const access = await assertLeadAccess(req.params.id, req.user);
        if (!access.ok) return res.status(access.code).json({ message: access.message });

        const [rows] = await pool.query(
            `SELECT la.id, la.activity_type, la.description, la.created_at,
                    u.name AS actor_name, u.role AS actor_role
             FROM lead_activities la
             LEFT JOIN users u ON la.user_id = u.id
             WHERE la.lead_id = ?
             ORDER BY la.created_at DESC`,
            [req.params.id]
        );
        res.status(200).json({ success: true, data: rows });
    } catch (error) {
        console.error('Get Activities Error:', error);
        res.status(500).json({ message: 'Error fetching activity timeline' });
    }
};

// @route   POST /api/leads/:id/activities   { activity_type, description }
// @desc    Manually log a call / meeting / note against a lead — this is
//          how a phone call with no other field change still counts as
//          nursing (a note alone doesn't touch stage/status/follow-up,
//          but logging it here does bump the lead's updated_at).
exports.addActivity = async (req, res) => {
    const leadId = req.params.id;
    const { activity_type, description } = req.body;

    if (!description || !description.trim()) {
        return res.status(400).json({ message: 'Activity description is required.' });
    }

    try {
        const access = await assertLeadAccess(leadId, req.user);
        if (!access.ok) return res.status(access.code).json({ message: access.message });

        const type = MANUAL_ACTIVITY_TYPES.includes(activity_type) ? activity_type : 'note';
        await logActivity(leadId, req.user.id, type, description.trim());

        res.status(201).json({ message: 'Activity logged' });
    } catch (error) {
        console.error('Add Activity Error:', error);
        res.status(500).json({ message: 'Error logging activity' });
    }
};
