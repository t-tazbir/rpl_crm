const pool = require('../config/db');

exports.getDashboardStats = async (req, res) => {
    try {
        let repCondition = '';
        let queryParams = [];
        let scopedClusterHead = null; // which Cluster Head's team we're scoped to, if any

        const zeroStats = () => ({
            success: true,
            scoped_cluster_head: scopedClusterHead,
            kpi: { total_leads: 0, prospects: 0, priority: 0, converted: 0, lost: 0, conversion_rate: '0.0', lost_rate: '0.0' },
            by_stage: [],
            by_category: [],
            by_status: [],
            by_source: [],
            by_unmet_demand: [],
            by_project: [],
            engagement: {
                total: 0,
                client_meeting: { done: 0, pct_done: 0 },
                site_visit: { done: 0, pct_done: 0 },
                hq_visit: { done: 0, pct_done: 0 }
            }
        });

        if (req.user.role === 'CLUSTER_HEAD') {
            // A Cluster Head is always locked to their own team. Any
            // cluster_head_id query param is deliberately ignored here —
            // otherwise a Cluster Head could pass someone else's id and see
            // a team that isn't theirs.
            const [reps] = await pool.query('SELECT id FROM users WHERE cluster_head_id = ?', [req.user.id]);
            const repIds = reps.map(r => r.id);

            if (repIds.length === 0) {
                // If cluster head has no sales reps under them, return zero data safely
                return res.status(200).json(zeroStats());
            }
            repCondition = 'WHERE sales_rep_id IN (?)';
            queryParams = [repIds];

        } else if (req.user.role === 'DD_ED' && req.query.cluster_head_id) {
            // Management can optionally drill into a single Cluster Head's
            // team instead of seeing company-wide numbers.
            const targetId = parseInt(req.query.cluster_head_id, 10);
            if (!targetId) {
                return res.status(400).json({ message: 'Invalid cluster_head_id' });
            }

            const [chRows] = await pool.query(
                'SELECT id, name FROM users WHERE id = ? AND role = "CLUSTER_HEAD"',
                [targetId]
            );
            if (chRows.length === 0) {
                return res.status(404).json({ message: 'Cluster Head not found' });
            }
            scopedClusterHead = chRows[0];

            const [reps] = await pool.query('SELECT id FROM users WHERE cluster_head_id = ?', [targetId]);
            const repIds = reps.map(r => r.id);

            if (repIds.length === 0) {
                return res.status(200).json(zeroStats());
            }
            repCondition = 'WHERE sales_rep_id IN (?)';
            queryParams = [repIds];
        }
        // else: DD_ED with no cluster_head_id -> repCondition stays '' -> full company-wide data

        // 1. KPI Counts with Cluster filtering
        const [totalRows] = await pool.query(`SELECT COUNT(*) as total FROM leads ${repCondition}`, queryParams);
        const [prospectsRows] = await pool.query(`SELECT COUNT(*) as count FROM leads ${repCondition ? repCondition + ' AND' : 'WHERE'} stage = "Prospect"`, queryParams);
        const [priorityRows] = await pool.query(`SELECT COUNT(*) as count FROM leads ${repCondition ? repCondition + ' AND' : 'WHERE'} stage = "Priority"`, queryParams);
        const [convertedRows] = await pool.query(`SELECT COUNT(*) as count FROM leads ${repCondition ? repCondition + ' AND' : 'WHERE'} status = "Converted"`, queryParams);
        const [lostRows] = await pool.query(`SELECT COUNT(*) as count FROM leads ${repCondition ? repCondition + ' AND' : 'WHERE'} status = "LOST"`, queryParams);

        const total_leads = totalRows[0].total || 0;
        const converted = convertedRows[0].count || 0;
        const lost = lostRows[0].count || 0;
        const conversion_rate = total_leads > 0 ? (converted / total_leads) * 100 : 0;
        const lost_rate = total_leads > 0 ? (lost / total_leads) * 100 : 0;

        // 2. Leads by Stage
        const [byStage] = await pool.query(`SELECT stage, COUNT(*) as count FROM leads ${repCondition} GROUP BY stage`, queryParams);
        
        // 3. Leads by Category (Residential / Commercial)
        const [byCategory] = await pool.query(`SELECT category, COUNT(*) as count FROM leads ${repCondition} GROUP BY category`, queryParams);

        // 4. Leads by Status
        const [byStatus] = await pool.query(`SELECT status, COUNT(*) as count FROM leads ${repCondition} GROUP BY status`, queryParams);

        // 4b. Leads by Source (DSI / Hotline / DM / Internal Ref)
        const [bySource] = await pool.query(`
            SELECT COALESCE(source, 'Unknown') as source, COUNT(*) as count
            FROM leads
            ${repCondition}
            GROUP BY source
        `, queryParams);

        // 5. Unmet Demand (Lost Reasons) filtered by cluster team
        const [byUnmetDemand] = await pool.query(`
            SELECT COALESCE(unmet_demand_reason, 'Not Specified') as reason, COUNT(*) as count 
            FROM leads 
            ${repCondition ? repCondition + ' AND' : 'WHERE'} status = 'LOST' 
            GROUP BY unmet_demand_reason
        `, queryParams);

        // 6. Conversion By Project Wise filtered by cluster team
        const [byProject] = await pool.query(`
            SELECT 
                COALESCE(project, 'General / Unassigned') as project,
                COUNT(*) as total_leads,
                SUM(CASE WHEN status = 'Converted' THEN 1 ELSE 0 END) as converted,
                SUM(CASE WHEN status = 'LOST' THEN 1 ELSE 0 END) as lost,
                (SUM(CASE WHEN status = 'Converted' THEN 1 ELSE 0 END) / COUNT(*)) * 100 as conversion_rate
            FROM leads
            ${repCondition}
            GROUP BY project
        `, queryParams);

        // 7. Engagement funnel — how many leads actually had a client meeting,
        // a site visit, or came in to HQ. This is what powers the
        // "X% site visit hoy nai / HQ te ashe nai" summary on the dashboard.
        const [engagementRows] = await pool.query(`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN client_meeting = 'Yes' THEN 1 ELSE 0 END) as client_meeting_yes,
                SUM(CASE WHEN site_visit = 'Yes' THEN 1 ELSE 0 END) as site_visit_yes,
                SUM(CASE WHEN meeting_at_hq = 'Yes' THEN 1 ELSE 0 END) as hq_visit_yes
            FROM leads
            ${repCondition}
        `, queryParams);

        const eng = engagementRows[0] || {};
        const engTotal = eng.total || 0;
        const pct = (n) => engTotal > 0 ? Number(((n / engTotal) * 100).toFixed(1)) : 0;

        const engagement = {
            total: engTotal,
            client_meeting: { done: eng.client_meeting_yes || 0, pct_done: pct(eng.client_meeting_yes || 0) },
            site_visit: { done: eng.site_visit_yes || 0, pct_done: pct(eng.site_visit_yes || 0) },
            hq_visit: { done: eng.hq_visit_yes || 0, pct_done: pct(eng.hq_visit_yes || 0) }
        };

        res.status(200).json({
            success: true,
            scoped_cluster_head: scopedClusterHead,
            kpi: {
                total_leads,
                prospects: prospectsRows[0].count,
                priority: priorityRows[0].count,
                converted,
                lost,
                conversion_rate: conversion_rate.toFixed(1),
                lost_rate: lost_rate.toFixed(1)
            },
            by_stage: byStage,
            by_category: byCategory,
            by_status: byStatus,
            by_source: bySource,
            by_unmet_demand: byUnmetDemand,
            by_project: byProject,
            engagement
        });

    } catch (error) {
        console.error("Dashboard Stats Error:", error);
        res.status(500).json({ message: 'Error fetching dashboard stats' });
    }
};

// @route   GET /api/dashboard/my-stats
// @desc    A Sales Rep's own dashboard: KPIs, stage/status chart data,
//          today's follow-ups, stale leads (no follow-up in 14+ days),
//          and recently converted leads.
exports.getSalesRepDashboard = async (req, res) => {
    try {
        const repId = req.user.id;

        const [totalRows] = await pool.query('SELECT COUNT(*) as total FROM leads WHERE sales_rep_id = ?', [repId]);
        const [convertedRows] = await pool.query("SELECT COUNT(*) as count FROM leads WHERE sales_rep_id = ? AND status = 'Converted'", [repId]);
        const [lostRows] = await pool.query("SELECT COUNT(*) as count FROM leads WHERE sales_rep_id = ? AND status = 'LOST'", [repId]);
        const [prospectsRows] = await pool.query("SELECT COUNT(*) as count FROM leads WHERE sales_rep_id = ? AND stage = 'Prospect'", [repId]);
        const [priorityRows] = await pool.query("SELECT COUNT(*) as count FROM leads WHERE sales_rep_id = ? AND stage = 'Priority'", [repId]);

        const total_leads = totalRows[0].total || 0;
        const converted = convertedRows[0].count || 0;
        const conversion_rate = total_leads > 0 ? ((converted / total_leads) * 100).toFixed(1) : '0.0';

        const [byStage] = await pool.query('SELECT stage, COUNT(*) as count FROM leads WHERE sales_rep_id = ? GROUP BY stage', [repId]);
        const [byStatus] = await pool.query('SELECT status, COUNT(*) as count FROM leads WHERE sales_rep_id = ? GROUP BY status', [repId]);

        // Today's follow-ups — grouped together so the rep sees everyone they need to call today
        const [todayFollowUps] = await pool.query(
            `SELECT id, lead_id, lead_name, lead_phone, project, stage, next_follow_up
             FROM leads
             WHERE sales_rep_id = ? AND status = 'Active' AND DATE(next_follow_up) = CURDATE()
             ORDER BY next_follow_up ASC`,
            [repId]
        );

        // Stale leads — Active, no UPCOMING follow-up, and no edit of any
        // kind (note, stage, meeting flags, etc.) in 30+ days (1 month).
        // updated_at bumps on ANY change to the lead, so a call note alone
        // counts as nursing even without touching next_follow_up.
        const [staleLeads] = await pool.query(
            `SELECT id, lead_id, lead_name, lead_phone, project, stage, next_follow_up, updated_at
             FROM leads
             WHERE sales_rep_id = ? AND status = 'Active'
               AND (next_follow_up IS NULL OR next_follow_up <= NOW())
               AND updated_at <= NOW() - INTERVAL 30 DAY
             ORDER BY updated_at ASC
             LIMIT 50`,
            [repId]
        );

        // Recently converted — a quick "wins" list
        const [recentlyConverted] = await pool.query(
            `SELECT id, lead_id, lead_name, project, updated_at
             FROM leads
             WHERE sales_rep_id = ? AND status = 'Converted'
             ORDER BY updated_at DESC
             LIMIT 10`,
            [repId]
        );

        res.status(200).json({
            success: true,
            kpi: {
                total_leads,
                prospects: prospectsRows[0].count,
                priority: priorityRows[0].count,
                converted,
                lost: lostRows[0].count,
                conversion_rate
            },
            by_stage: byStage,
            by_status: byStatus,
            today_follow_ups: todayFollowUps,
            stale_leads: staleLeads,
            recently_converted: recentlyConverted
        });
    } catch (error) {
        console.error("Sales Rep Dashboard Error:", error);
        res.status(500).json({ message: 'Error fetching your dashboard' });
    }
};

// @route   GET /api/dashboard/team-breakdown
// @desc    Per-sales-rep stats for a team — powers the Cluster Head
//          portal's organogram (quick stat chips) and Team Analysis tab.
//          CLUSTER_HEAD always sees their own team; DD_ED must pass
//          ?cluster_head_id= to pick a team (mirrors getDashboardStats).
exports.getTeamBreakdown = async (req, res) => {
    try {
        let repRows = [];
        let scopedClusterHead = null;

        if (req.user.role === 'CLUSTER_HEAD') {
            [repRows] = await pool.query(
                'SELECT id, name, email, phone, designation, profile_picture FROM users WHERE cluster_head_id = ? AND role = "SALES_MAN" ORDER BY name ASC',
                [req.user.id]
            );
        } else if (req.user.role === 'DD_ED' && req.query.cluster_head_id) {
            const targetId = parseInt(req.query.cluster_head_id, 10);
            if (!targetId) return res.status(400).json({ message: 'Invalid cluster_head_id' });

            const [chRows] = await pool.query('SELECT id, name FROM users WHERE id = ? AND role = "CLUSTER_HEAD"', [targetId]);
            if (chRows.length === 0) return res.status(404).json({ message: 'Cluster Head not found' });
            scopedClusterHead = chRows[0];

            [repRows] = await pool.query(
                'SELECT id, name, email, phone, designation, profile_picture FROM users WHERE cluster_head_id = ? AND role = "SALES_MAN" ORDER BY name ASC',
                [targetId]
            );
        } else {
            return res.status(400).json({ message: 'cluster_head_id is required for this role' });
        }

        // One small set of queries per rep — teams are small (a handful of
        // reps), so this stays fast without needing a heavier single-query
        // pivot. Easy to optimize later if team sizes grow a lot.
        const team = [];
        for (const rep of repRows) {
            const [totalRows] = await pool.query('SELECT COUNT(*) as c FROM leads WHERE sales_rep_id = ?', [rep.id]);
            const [convertedRows] = await pool.query("SELECT COUNT(*) as c FROM leads WHERE sales_rep_id = ? AND status = 'Converted'", [rep.id]);
            const [lostRows] = await pool.query("SELECT COUNT(*) as c FROM leads WHERE sales_rep_id = ? AND status = 'LOST'", [rep.id]);
            const [stageRows] = await pool.query('SELECT stage, COUNT(*) as count FROM leads WHERE sales_rep_id = ? GROUP BY stage', [rep.id]);

            const total = totalRows[0].c || 0;
            const converted = convertedRows[0].c || 0;

            team.push({
                id: rep.id,
                name: rep.name,
                email: rep.email,
                phone: rep.phone,
                designation: rep.designation,
                profile_picture: rep.profile_picture,
                total_leads: total,
                converted,
                lost: lostRows[0].c || 0,
                conversion_rate: total > 0 ? ((converted / total) * 100).toFixed(1) : '0.0',
                by_stage: stageRows
            });
        }

        res.status(200).json({ success: true, scoped_cluster_head: scopedClusterHead, team });
    } catch (error) {
        console.error('Team Breakdown Error:', error);
        res.status(500).json({ message: 'Error fetching team breakdown' });
    }
};

// @route   GET /api/dashboard/org-chart
// @desc    Company-wide 3-level organogram for Management: DD/ED (root) ->
//          every Cluster Head -> their Sales Men, with a quick lead-count
//          stat at every node. DD_ED only.
exports.getCompanyOrgChart = async (req, res) => {
    try {
        const [clusterHeads] = await pool.query(
            'SELECT id, name, designation, profile_picture FROM users WHERE role = "CLUSTER_HEAD" ORDER BY name ASC'
        );

        const clusters = [];
        for (const ch of clusterHeads) {
            const [reps] = await pool.query(
                'SELECT id, name, designation, profile_picture FROM users WHERE cluster_head_id = ? AND role = "SALES_MAN" ORDER BY name ASC',
                [ch.id]
            );

            const repList = [];
            for (const rep of reps) {
                const [totalRows] = await pool.query('SELECT COUNT(*) as c FROM leads WHERE sales_rep_id = ?', [rep.id]);
                const [convertedRows] = await pool.query("SELECT COUNT(*) as c FROM leads WHERE sales_rep_id = ? AND status = 'Converted'", [rep.id]);
                const total = totalRows[0].c || 0;
                const converted = convertedRows[0].c || 0;
                repList.push({
                    id: rep.id,
                    name: rep.name,
                    designation: rep.designation,
                    profile_picture: rep.profile_picture,
                    total_leads: total,
                    converted,
                    conversion_rate: total > 0 ? ((converted / total) * 100).toFixed(1) : '0.0'
                });
            }

            const clusterTotal = repList.reduce((s, r) => s + r.total_leads, 0);
            const clusterConverted = repList.reduce((s, r) => s + r.converted, 0);

            clusters.push({
                id: ch.id,
                name: ch.name,
                designation: ch.designation,
                profile_picture: ch.profile_picture,
                total_leads: clusterTotal,
                converted: clusterConverted,
                conversion_rate: clusterTotal > 0 ? ((clusterConverted / clusterTotal) * 100).toFixed(1) : '0.0',
                reps: repList
            });
        }

        res.status(200).json({ success: true, clusters });
    } catch (error) {
        console.error('Company Org Chart Error:', error);
        res.status(500).json({ message: 'Error fetching organogram' });
    }
};