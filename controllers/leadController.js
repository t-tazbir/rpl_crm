const pool = require('../config/db');
const { syncReminderForLead } = require('../services/followupReminderService');
const { logActivity } = require('../services/activityLogService');

// Helper Function: Automatic Lead ID Generator (e.g., LD-260819-0001)
const generateLeadId = async () => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    const datePrefix = `LD-${year}${month}${day}-`;

    const [rows] = await pool.query(
        "SELECT lead_id FROM leads WHERE lead_id LIKE ? ORDER BY id DESC LIMIT 1",
        [`${datePrefix}%`]
    );

    let sequence = 1;
    if (rows.length > 0) {
        const lastId = rows[0].lead_id;
        const lastSequence = parseInt(lastId.split('-')[2]);
        sequence = lastSequence + 1;
    }

    return `${datePrefix}${('0000' + sequence).slice(-4)}`;
};

// @route   POST /api/leads
// @desc    Create a new lead
exports.createLead = async (req, res) => {
    try {
        const {
            source, lead_name, lead_phone, spouse_name, project, category,
            space_size_sqft, stage, client_meeting, site_visit,
            meeting_at_hq, status, unmet_demand_reason, next_follow_up, note
        } = req.body;

        if (!lead_name || !lead_phone) {
            return res.status(400).json({ message: 'Lead Name and Phone Number are required' });
        }

        const sales_rep_id = req.user.id;
        // TEAM_LEAD note: a Team Lead's JWT payload carries the same cluster_head_id
        // it had as a Sales Man (promoting someone doesn't touch cluster_head_id —
        // see userController.makeTeamLead), so this line needs no TEAM_LEAD branch:
        // it already resolves correctly via the existing else-case.
        const cluster_head_id = req.user.role === 'CLUSTER_HEAD' ? req.user.id : req.user.cluster_head_id;

        const lead_id = await generateLeadId();
        const finalStatus = status || 'Active';

        const insertQuery = `
            INSERT INTO leads (
                lead_id, source, sales_rep_id, cluster_head_id, lead_name, lead_phone, spouse_name,
                project, category, space_size_sqft, stage, client_meeting, site_visit,
                meeting_at_hq, status, unmet_demand_reason, next_follow_up, note
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            lead_id, source || null, sales_rep_id, cluster_head_id, lead_name, lead_phone, spouse_name || null,
            project || null, category || null, space_size_sqft || null, stage || 'Lead',
            client_meeting || 'No', site_visit || 'No', meeting_at_hq || 'No',
            finalStatus, unmet_demand_reason || null, next_follow_up || null, note || null
        ];

        const conn = await pool.getConnection();
        let newLeadId;
        try {
            await conn.beginTransaction();

            const [result] = await conn.query(insertQuery, values);
            newLeadId = result.insertId;

            await conn.query(
                "INSERT INTO lead_contact_phones (lead_id, phone_number, contact_type, is_primary) VALUES (?, ?, 'lead', 1)",
                [newLeadId, lead_phone]
            );

            await conn.commit();
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }

        if (next_follow_up) {
            await syncReminderForLead(newLeadId, next_follow_up, finalStatus);
        }

        await logActivity(newLeadId, req.user.id, 'created', 'Lead created');

        res.status(201).json({
            message: 'Lead created successfully',
            lead_id: lead_id
        });

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Ei phone number ta already system-e onno kothao (kono lead ba spouse hisebe) registered ache.' });
        }
        console.error("Lead Creation Error:", error);
        res.status(500).json({ message: 'Server Error during lead creation' });
    }
};

// @route   GET /api/leads
// @desc    Get leads based on user hierarchy
exports.getLeads = async (req, res) => {
    try {
        let { sales_rep_id, stage, status, search, follow_up_filter, cluster_head_id, unassigned } = req.query;
        let query = `
            SELECT l.*, u.name as sales_rep_name, pu.name as previous_sales_rep_name
            FROM leads l
            LEFT JOIN users u ON l.sales_rep_id = u.id
            LEFT JOIN users pu ON l.previous_sales_rep_id = pu.id
            WHERE 1=1
        `;
        let params = [];

        // If Cluster Head, restrict leads strictly to their team's sales reps
        // (an unassigned lead has no sales_rep_id, so it never matches IN(...)
        // here — Cluster Heads never see the unassigned pool, by design).
        // NOTE: this intentionally selects ALL of cluster_head_id = me, which
        // includes both Team Leads and plain Sales Men (their role doesn't
        // matter here — cluster_head_id is what scopes a Cluster Head's view,
        // same as before the Team Lead feature existed).
        if (req.user.role === 'CLUSTER_HEAD') {
            const [reps] = await pool.query('SELECT id FROM users WHERE cluster_head_id = ?', [req.user.id]);
            const repIds = reps.map(r => r.id);

            if (repIds.length === 0) {
                return res.status(200).json({ success: true, data: [] });
            }
            query += ` AND l.sales_rep_id IN (?)`;
            params.push(repIds);
        }

        // TEAM_LEAD: leads belonging to sales reps CURRENTLY reporting to this
        // Team Lead (live lookup via team_lead_id, not a cached list — if a
        // Cluster Head reassigns a rep away, this list updates on the very next
        // request). Also includes the Team Lead's OWN leads: a Team Lead is a
        // promoted Sales Man (see userController.makeTeamLead), so any leads
        // they personally owned before promotion — or create themselves after —
        // should not become invisible to them just because their role changed.
        //
        // The optional ?sales_rep_id= filter (leads.html's "Filter by team
        // member" dropdown) is honored HERE, not in the generic block below —
        // and only when it's a value already inside this Team Lead's own
        // repIds. This is the security boundary: it can only ever NARROW their
        // view to one of their own reports, never widen it to someone else's
        // leads by passing an arbitrary id.
        if (req.user.role === 'TEAM_LEAD') {
            const [reps] = await pool.query('SELECT id FROM users WHERE team_lead_id = ?', [req.user.id]);
            const repIds = reps.map(r => r.id);
            repIds.push(req.user.id);

            const requestedId = sales_rep_id ? Number(sales_rep_id) : null;
            if (requestedId && repIds.includes(requestedId)) {
                query += ` AND l.sales_rep_id = ?`;
                params.push(requestedId);
            } else {
                query += ` AND l.sales_rep_id IN (?)`;
                params.push(repIds);
            }
        }

        // Sales reps calling their own dashboard implicitly only ever see their own leads
        if (req.user.role === 'SALES_MAN') {
            query += ` AND l.sales_rep_id = ?`;
            params.push(req.user.id);
        }

        // Management's "All Leads" view: unassigned pool is opt-in via
        // ?unassigned=true, otherwise it's excluded from the normal list so
        // it doesn't clutter the regular company-wide browse view.
        if (req.user.role === 'DD_ED') {
            if (unassigned === 'true') {
                query += ` AND l.sales_rep_id IS NULL`;
            } else {
                query += ` AND l.sales_rep_id IS NOT NULL`;
            }
        }

        // Specific Sales Rep Filter from dropdown (Cluster Head / DD_ED use).
        // TEAM_LEAD is excluded here — their sales_rep_id handling lives in
        // their own branch above, where it's checked against repIds first.
        if (sales_rep_id && req.user.role !== 'SALES_MAN' && req.user.role !== 'TEAM_LEAD') {
            query += ` AND l.sales_rep_id = ?`;
            params.push(sales_rep_id);
        }

        // Collective "show me this whole Cluster Head's team" filter — DD_ED only
        if (cluster_head_id && req.user.role === 'DD_ED') {
            const [reps] = await pool.query('SELECT id FROM users WHERE cluster_head_id = ? AND role = "SALES_MAN"', [cluster_head_id]);
            const repIds = reps.map(r => r.id);
            if (repIds.length === 0) {
                return res.status(200).json({ success: true, data: [] });
            }
            query += ` AND l.sales_rep_id IN (?)`;
            params.push(repIds);
        }

        // Stage Filter
        if (stage) {
            query += ` AND l.stage = ?`;
            params.push(stage);
        }

        // Status Filter
        if (status) {
            query += ` AND l.status = ?`;
            params.push(status);
        }

        // Search Filter (Name, any phone number, or Lead ID)
        if (search) {
            query += ` AND (l.lead_name LIKE ? OR l.lead_phone LIKE ? OR l.lead_id LIKE ? OR l.id IN (SELECT lead_id FROM lead_contact_phones WHERE contact_type = 'lead' AND phone_number LIKE ?))`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        // Follow-up convenience filters (used by the Sales dashboard sections).
        if (follow_up_filter === 'today') {
            query += ` AND DATE(l.next_follow_up) = CURDATE() AND l.status = 'Active'`;
        } else if (follow_up_filter === 'stale') {
            query += ` AND l.status = 'Active' AND (l.next_follow_up IS NULL OR l.next_follow_up <= NOW()) AND l.updated_at <= NOW() - INTERVAL 30 DAY`;
        }

        query += ` ORDER BY l.id DESC`;

        const [rows] = await pool.query(query, params);
        res.status(200).json({ success: true, data: rows });
    } catch (error) {
        console.error("Get Leads Error:", error);
        res.status(500).json({ message: 'Error fetching leads' });
    }
};

// @route   PUT /api/leads/:id
// @desc    Update a lead (Salesman updates their own, Team Lead updates their
//          reports', Cluster Head updates their team's)
exports.updateLead = async (req, res) => {
    try {
        const leadId = req.params.id;

        const allowedUpdates = [
            'lead_name', 'project', 'category', 'space_size_sqft',
            'stage', 'client_meeting', 'site_visit', 'meeting_at_hq', 'status',
            'unmet_demand_reason', 'next_follow_up', 'note'
        ];

        let updateFields = [];
        let queryParams = [];

        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                updateFields.push(`${field} = ?`);
                queryParams.push(req.body[field]);
            }
        });

        if (updateFields.length === 0) {
            return res.status(400).json({ message: 'Kono valid field pawa jayni update korar jonno.' });
        }

        let authCheckQuery = `SELECT * FROM leads WHERE id = ?`;
        const [leadRows] = await pool.query(authCheckQuery, [leadId]);

        if (leadRows.length === 0) {
            return res.status(404).json({ message: 'Lead khuje pawa jayni.' });
        }

        const targetLead = leadRows[0];

        if (req.user.role === 'SALES_MAN' && targetLead.sales_rep_id !== req.user.id) {
            return res.status(403).json({ message: 'Access Denied: Apni onno karo lead edit korte parben na.' });
        }

        // TEAM_LEAD: same live-lookup rule as getLeads above — allowed if this
        // lead is their own, OR its rep currently reports to them.
        if (req.user.role === 'TEAM_LEAD') {
            let allowed = targetLead.sales_rep_id === req.user.id;
            if (!allowed && targetLead.sales_rep_id) {
                const [repRows] = await pool.query('SELECT team_lead_id FROM users WHERE id = ?', [targetLead.sales_rep_id]);
                allowed = repRows.length > 0 && repRows[0].team_lead_id === req.user.id;
            }
            if (!allowed) {
                return res.status(403).json({ message: 'Access Denied: Ei lead ti apnar team er under e nei.' });
            }
        }

        if (req.user.role === 'CLUSTER_HEAD' && targetLead.cluster_head_id !== req.user.id) {
            return res.status(403).json({ message: 'Access Denied: Ei lead ti apnar team er under e nei.' });
        }

        let updateQuery = `UPDATE leads SET ${updateFields.join(', ')} WHERE id = ?`;
        queryParams.push(leadId);

        await pool.query(updateQuery, queryParams);

        if (req.body.next_follow_up !== undefined || req.body.stage !== undefined || req.body.status !== undefined) {
            const [current] = await pool.query('SELECT next_follow_up, status FROM leads WHERE id = ?', [leadId]);
            if (current.length > 0) {
                await syncReminderForLead(leadId, current[0].next_follow_up, current[0].status);
            }
        }

        const normalizeDT = (v) => (v ? new Date(v).getTime() : null);
        const activities = [];

        if (req.body.stage !== undefined && req.body.stage !== targetLead.stage) {
            activities.push(['stage_change', `Stage changed from "${targetLead.stage}" to "${req.body.stage}"`]);
        }
        if (req.body.status !== undefined && req.body.status !== targetLead.status) {
            activities.push(['status_change', `Status changed from "${targetLead.status}" to "${req.body.status}"`]);
        }
        if (req.body.next_follow_up !== undefined && normalizeDT(req.body.next_follow_up) !== normalizeDT(targetLead.next_follow_up)) {
            activities.push(['follow_up_set', req.body.next_follow_up
                ? `Next follow-up set to ${new Date(req.body.next_follow_up).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                : 'Next follow-up cleared']);
        }
        const meetingFieldLabels = { client_meeting: 'Client meeting', site_visit: 'Site visit', meeting_at_hq: 'HQ visit' };
        Object.keys(meetingFieldLabels).forEach((field) => {
            if (req.body[field] !== undefined && req.body[field] !== targetLead[field]) {
                activities.push(['meeting_update', `${meetingFieldLabels[field]} marked as "${req.body[field]}"`]);
            }
        });
        if (req.body.note !== undefined && req.body.note && req.body.note !== targetLead.note) {
            const preview = req.body.note.length > 200 ? req.body.note.slice(0, 200) + '…' : req.body.note;
            activities.push(['note', `Note updated: "${preview}"`]);
        }

        for (const [type, description] of activities) {
            await logActivity(leadId, req.user.id, type, description);
        }

        res.status(200).json({ message: 'Lead successfully update kora hoyeche.' });

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Ei phone number diye already onno ekta lead ache.' });
        }
        console.error("Lead Update Error:", error);
        res.status(500).json({ message: 'Server Error during lead update' });
    }
};

// @route   PUT /api/leads/:leadId/transfer
// @desc    Reassign a lead to a different sales rep. CLUSTER_HEAD/DD_ED only —
//          unchanged, TEAM_LEAD deliberately NOT given transfer rights (you
//          asked for view/edit, not reassignment, for that role).
exports.transferLead = async (req, res) => {
    try {
        const { leadId } = req.params;
        const { new_sales_rep_id } = req.body;
        const clusterHeadId = req.user.id;
        const userRole = req.user.role;

        const [leadRows] = await pool.query(`
            SELECT l.*, u.cluster_head_id AS current_rep_cluster_head_id
            FROM leads l
            LEFT JOIN users u ON l.sales_rep_id = u.id
            WHERE l.id = ?
        `, [leadId]);

        if (leadRows.length === 0) return res.status(404).json({ message: 'Lead not found' });
        const lead = leadRows[0];

        if (userRole === 'CLUSTER_HEAD' && lead.current_rep_cluster_head_id !== clusterHeadId) {
            return res.status(403).json({ message: 'Unauthorized: Not your cluster lead' });
        }

        const [newRepRows] = await pool.query('SELECT * FROM users WHERE id = ? AND role = "SALES_MAN"', [new_sales_rep_id]);
        if (newRepRows.length === 0) return res.status(400).json({ message: 'Invalid sales rep target' });

        const newRep = newRepRows[0];
        if (userRole === 'CLUSTER_HEAD' && newRep.cluster_head_id !== clusterHeadId) {
            return res.status(403).json({ message: 'Can only transfer to your own team members' });
        }

        await pool.query(
            `UPDATE leads
             SET sales_rep_id = ?, cluster_head_id = ?, previous_sales_rep_id = NULL, unassigned_at = NULL
             WHERE id = ?`,
            [new_sales_rep_id, newRep.cluster_head_id, leadId]
        );

        const logDescription = lead.sales_rep_id
            ? `Transferred to ${newRep.name}`
            : `Assigned to ${newRep.name} (was unassigned)`;
        await logActivity(leadId, req.user.id, 'transfer', logDescription);

        res.status(200).json({ success: true, message: `Lead successfully transferred to ${newRep.name}` });

    } catch (error) {
        console.error("Transfer Error:", error);
        res.status(500).json({ message: 'Server error during transfer' });
    }
};
