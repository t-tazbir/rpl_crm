const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

exports.getTeamMembers = async (req, res) => {
    try {
        if (!['CLUSTER_HEAD', 'DD_ED', 'ADMIN', 'TEAM_LEAD'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        let query = 'SELECT id, name, email FROM users WHERE cluster_head_id = ? AND role = "SALES_MAN"';
        let params = [req.user.id];

        if (req.user.role === 'DD_ED' || req.user.role === 'ADMIN') {
            query = 'SELECT id, name, email, role FROM users WHERE role = "SALES_MAN"';
            params = [];
        }

        // TEAM_LEAD: their own direct reports only — NOT the whole cluster.
        // This powers the "Filter by team member" dropdown in leads.html, so a
        // Team Lead can jump straight to one report's leads to guide them.
        if (req.user.role === 'TEAM_LEAD') {
            query = 'SELECT id, name, email FROM users WHERE team_lead_id = ? AND role = "SALES_MAN"';
            params = [req.user.id];
        }

        const [rows] = await pool.query(query, params);
        res.status(200).json({ success: true, data: rows });
    } catch (error) {
        console.error("Get Team Error:", error);
        res.status(500).json({ message: 'Error fetching team members' });
    }
};

exports.getClusterHeads = async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, name, email FROM users WHERE role = "CLUSTER_HEAD" ORDER BY name ASC'
        );
        res.status(200).json({ success: true, data: rows });
    } catch (error) {
        console.error("Get Cluster Heads Error:", error);
        res.status(500).json({ message: 'Error fetching cluster heads' });
    }
};

// ════════════════════════════════════════════════════════════════════════════
// TEAM LEAD MANAGEMENT — Cluster Head's control panel (cluster-portal.html).
// Every endpoint below scopes to `cluster_head_id = req.user.id` so a Cluster
// Head can only ever touch people in THEIR OWN cluster — never another
// cluster's Sales Man or Team Lead, as you specified.
// ════════════════════════════════════════════════════════════════════════════

// @route   GET /api/users/my-cluster-members
// @desc    Everyone in the caller's cluster (Team Leads + Sales Men), with each
//          Sales Man's current team_lead_id so the frontend can render the
//          "who reports to whom" tree and build the reassignment dropdowns.
exports.getMyClusterMembers = async (req, res) => {
    if (req.user.role !== 'CLUSTER_HEAD') return res.status(403).json({ message: 'Access Denied' });

    try {
        const [teamLeads] = await pool.query(
            `SELECT id, name, email, designation FROM users
             WHERE cluster_head_id = ? AND role = 'TEAM_LEAD' ORDER BY name ASC`,
            [req.user.id]
        );
        const [salesMen] = await pool.query(
            `SELECT id, name, email, designation, team_lead_id FROM users
             WHERE cluster_head_id = ? AND role = 'SALES_MAN' ORDER BY name ASC`,
            [req.user.id]
        );
        res.status(200).json({ success: true, team_leads: teamLeads, sales_men: salesMen });
    } catch (error) {
        console.error('Get My Cluster Members Error:', error);
        res.status(500).json({ message: 'Error fetching cluster members' });
    }
};

// @route   POST /api/users/:id/make-team-lead
// @desc    Promote a Sales Man (who must belong to THIS Cluster Head's team)
//          to Team Lead. They start with no reports — assign reps to them
//          separately via assign-team-lead.
exports.makeTeamLead = async (req, res) => {
    if (req.user.role !== 'CLUSTER_HEAD') return res.status(403).json({ message: 'Access Denied' });
    const targetId = req.params.id;

    try {
        // The WHERE clause is the actual security boundary here: it only matches
        // a row that is BOTH a SALES_MAN AND already in this cluster head's own
        // cluster. If the target belongs to a different cluster (or is already a
        // Team Lead / Cluster Head / DD_ED), affectedRows comes back 0 and we
        // correctly report "not found" rather than silently succeeding on the
        // wrong person or leaking whether that id exists at all.
        const [result] = await pool.query(
            `UPDATE users SET role = 'TEAM_LEAD'
             WHERE id = ? AND cluster_head_id = ? AND role = 'SALES_MAN'`,
            [targetId, req.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Sales Man khuje pawa jayni apnar team-e, ba se already Team Lead.' });
        }

        res.status(200).json({ message: 'Promoted to Team Lead.' });
    } catch (error) {
        console.error('Make Team Lead Error:', error);
        res.status(500).json({ message: 'Error promoting to Team Lead' });
    }
};

// @route   POST /api/users/:id/remove-team-lead
// @desc    Demote a Team Lead back to Sales Man. Every Sales Man who was
//          reporting to them automatically falls back to reporting directly
//          to the Cluster Head (team_lead_id -> NULL) — done in the SAME
//          transaction as the demotion so there's never a moment where a
//          Sales Man's team_lead_id points at someone who is no longer a
//          Team Lead.
exports.removeTeamLead = async (req, res) => {
    if (req.user.role !== 'CLUSTER_HEAD') return res.status(403).json({ message: 'Access Denied' });
    const targetId = req.params.id;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [result] = await conn.query(
            `UPDATE users SET role = 'SALES_MAN'
             WHERE id = ? AND cluster_head_id = ? AND role = 'TEAM_LEAD'`,
            [targetId, req.user.id]
        );

        if (result.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Team Lead khuje pawa jayni apnar team-e.' });
        }

        await conn.query(
            `UPDATE users SET team_lead_id = NULL WHERE team_lead_id = ? AND cluster_head_id = ?`,
            [targetId, req.user.id]
        );

        await conn.commit();
        res.status(200).json({ message: 'Team Lead removed. Their reports now report directly to you.' });
    } catch (error) {
        await conn.rollback();
        console.error('Remove Team Lead Error:', error);
        res.status(500).json({ message: 'Error removing Team Lead' });
    } finally {
        conn.release();
    }
};

// @route   PUT /api/users/:id/assign-team-lead   { team_lead_id: number|null }
// @desc    Move ONE Sales Man under a Team Lead, or back to reporting directly
//          to the Cluster Head (team_lead_id: null). Both the Sales Man AND
//          the target Team Lead must belong to THIS Cluster Head's cluster —
//          this is what stops a Cluster Head from assigning their rep to a
//          Team Lead in a different cluster (or vice versa).
exports.assignTeamLead = async (req, res) => {
    if (req.user.role !== 'CLUSTER_HEAD') return res.status(403).json({ message: 'Access Denied' });
    const targetId = req.params.id;
    const { team_lead_id } = req.body; // number, or null/undefined to un-assign

    try {
        const [salesManRows] = await pool.query(
            `SELECT id FROM users WHERE id = ? AND cluster_head_id = ? AND role = 'SALES_MAN'`,
            [targetId, req.user.id]
        );
        if (salesManRows.length === 0) {
            return res.status(404).json({ message: 'Sales Man khuje pawa jayni apnar team-e.' });
        }

        let newTeamLeadId = null;
        if (team_lead_id) {
            const [tlRows] = await pool.query(
                `SELECT id FROM users WHERE id = ? AND cluster_head_id = ? AND role = 'TEAM_LEAD'`,
                [team_lead_id, req.user.id]
            );
            if (tlRows.length === 0) {
                return res.status(400).json({ message: 'Ei Team Lead ti apnar team-e nei.' });
            }
            newTeamLeadId = team_lead_id;
        }

        await pool.query('UPDATE users SET team_lead_id = ? WHERE id = ?', [newTeamLeadId, targetId]);

        res.status(200).json({
            message: newTeamLeadId ? 'Sales Man assigned to Team Lead.' : 'Sales Man now reports directly to you.'
        });
    } catch (error) {
        console.error('Assign Team Lead Error:', error);
        res.status(500).json({ message: 'Error assigning Team Lead' });
    }
};

// ════════════════════════════════════════════════════════════════════════════
// Self-service profile — unchanged.
// ════════════════════════════════════════════════════════════════════════════

exports.getMyProfile = async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, name, email, phone, designation, role, profile_picture FROM users WHERE id = ?',
            [req.user.id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
        res.status(200).json({ success: true, data: rows[0] });
    } catch (error) {
        console.error('Get My Profile Error:', error);
        res.status(500).json({ message: 'Error fetching profile' });
    }
};

exports.updateMyProfile = async (req, res) => {
    try {
        const { name, phone, designation } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ message: 'Name is required' });

        await pool.query(
            'UPDATE users SET name = ?, phone = ?, designation = ? WHERE id = ?',
            [name.trim(), phone || null, designation || null, req.user.id]
        );
        res.status(200).json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Update My Profile Error:', error);
        res.status(500).json({ message: 'Error updating profile' });
    }
};

exports.updateMyEmail = async (req, res) => {
    try {
        const { new_email, current_password } = req.body;
        if (!new_email || !current_password) {
            return res.status(400).json({ message: 'New email and current password are required' });
        }

        const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'User not found' });

        const isMatch = await bcrypt.compare(current_password, rows[0].password_hash);
        if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });

        await pool.query('UPDATE users SET email = ? WHERE id = ?', [new_email.trim().toLowerCase(), req.user.id]);
        res.status(200).json({ message: 'Email updated successfully' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Ei email ta already onno account e use hocche.' });
        }
        console.error('Update My Email Error:', error);
        res.status(500).json({ message: 'Error updating email' });
    }
};

exports.uploadProfilePicture = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No image uploaded' });

        const relativePath = `/uploads/profile-pictures/${req.file.filename}`;

        const [rows] = await pool.query('SELECT profile_picture FROM users WHERE id = ?', [req.user.id]);
        const oldPicture = rows.length > 0 ? rows[0].profile_picture : null;

        await pool.query('UPDATE users SET profile_picture = ? WHERE id = ?', [relativePath, req.user.id]);

        if (oldPicture) {
            fs.unlink(path.join(__dirname, '..', 'public', oldPicture), () => {});
        }

        res.status(200).json({ message: 'Profile picture updated', profile_picture: relativePath });
    } catch (error) {
        console.error('Upload Profile Picture Error:', error);
        res.status(500).json({ message: 'Error uploading profile picture' });
    }
};
