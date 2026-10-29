const pool = require('../config/db');
const { assertLeadAccess } = require('../services/leadAccessService');

const MAX_LEAD_PHONES = 4;
const MAX_SPOUSE_PHONES = 2;

// Both a lead's own numbers AND spouse numbers live in ONE table
// (lead_contact_phones) with a single UNIQUE(phone_number) constraint —
// so "ABC's spouse number" and "some other lead's own number" can never
// be the same value anywhere in the system. This is enforced by the
// database itself (ER_DUP_ENTRY on insert), not just an app-level check.

// @route   GET /api/leads/:id/phones
exports.getPhones = async (req, res) => {
    try {
        const access = await assertLeadAccess(req.params.id, req.user);
        if (!access.ok) return res.status(access.code).json({ message: access.message });

        const [phones] = await pool.query(
            "SELECT id, phone_number, is_primary, created_at FROM lead_contact_phones WHERE lead_id = ? AND contact_type = 'lead' ORDER BY is_primary DESC, id ASC",
            [req.params.id]
        );
        const [spouse] = await pool.query(
            "SELECT id, phone_number, created_at FROM lead_contact_phones WHERE lead_id = ? AND contact_type = 'spouse' ORDER BY id ASC",
            [req.params.id]
        );
        res.status(200).json({ success: true, phones, spouse_phones: spouse });
    } catch (error) {
        console.error('Get Lead Phones Error:', error);
        res.status(500).json({ message: 'Error fetching phone numbers' });
    }
};

// @route   POST /api/leads/:id/phones   { phone_number, is_primary? }
exports.addPhone = async (req, res) => {
    const leadId = req.params.id;
    const { phone_number, is_primary } = req.body;

    if (!phone_number) return res.status(400).json({ message: 'Phone number required' });

    try {
        const access = await assertLeadAccess(leadId, req.user);
        if (!access.ok) return res.status(access.code).json({ message: access.message });

        const [existing] = await pool.query(
            "SELECT id FROM lead_contact_phones WHERE lead_id = ? AND contact_type = 'lead'",
            [leadId]
        );
        if (existing.length >= MAX_LEAD_PHONES) {
            return res.status(400).json({ message: `Ekta lead-e max ${MAX_LEAD_PHONES} ta number rakha jay.` });
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const makePrimary = is_primary === true || existing.length === 0; // first number is auto-primary
            if (makePrimary) {
                await conn.query("UPDATE lead_contact_phones SET is_primary = 0 WHERE lead_id = ? AND contact_type = 'lead'", [leadId]);
            }

            const [result] = await conn.query(
                "INSERT INTO lead_contact_phones (lead_id, phone_number, contact_type, is_primary) VALUES (?, ?, 'lead', ?)",
                [leadId, phone_number, makePrimary ? 1 : 0]
            );

            if (makePrimary) {
                await conn.query('UPDATE leads SET lead_phone = ? WHERE id = ?', [phone_number, leadId]);
            }

            await conn.commit();
            res.status(201).json({ message: 'Phone number added', id: result.insertId, is_primary: makePrimary });
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Ei number ta already system-e onno kothao (kono lead ba spouse hisebe) registered ache.' });
        }
        console.error('Add Lead Phone Error:', error);
        res.status(500).json({ message: 'Error adding phone number' });
    }
};

// @route   PUT /api/leads/:id/phones/:phoneId/primary
exports.setPrimaryPhone = async (req, res) => {
    const { id: leadId, phoneId } = req.params;
    try {
        const access = await assertLeadAccess(leadId, req.user);
        if (!access.ok) return res.status(access.code).json({ message: access.message });

        const [rows] = await pool.query(
            "SELECT phone_number FROM lead_contact_phones WHERE id = ? AND lead_id = ? AND contact_type = 'lead'",
            [phoneId, leadId]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Phone number khuje pawa jayni.' });

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            await conn.query("UPDATE lead_contact_phones SET is_primary = 0 WHERE lead_id = ? AND contact_type = 'lead'", [leadId]);
            await conn.query('UPDATE lead_contact_phones SET is_primary = 1 WHERE id = ?', [phoneId]);
            await conn.query('UPDATE leads SET lead_phone = ? WHERE id = ?', [rows[0].phone_number, leadId]);
            await conn.commit();
            res.status(200).json({ message: 'Primary number updated' });
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Set Primary Phone Error:', error);
        res.status(500).json({ message: 'Error setting primary number' });
    }
};

// @route   DELETE /api/leads/:id/phones/:phoneId
exports.deletePhone = async (req, res) => {
    const { id: leadId, phoneId } = req.params;
    try {
        const access = await assertLeadAccess(leadId, req.user);
        if (!access.ok) return res.status(access.code).json({ message: access.message });

        const [rows] = await pool.query(
            "SELECT is_primary FROM lead_contact_phones WHERE id = ? AND lead_id = ? AND contact_type = 'lead'",
            [phoneId, leadId]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Phone number khuje pawa jayni.' });

        const [countRows] = await pool.query(
            "SELECT COUNT(*) as c FROM lead_contact_phones WHERE lead_id = ? AND contact_type = 'lead'",
            [leadId]
        );
        if (countRows[0].c <= 1) {
            return res.status(400).json({ message: 'Lead-er kompokkhe ekta phone number thakte hobe.' });
        }

        await pool.query('DELETE FROM lead_contact_phones WHERE id = ?', [phoneId]);

        // If we deleted the primary, promote the next remaining number automatically.
        if (rows[0].is_primary) {
            const [remaining] = await pool.query(
                "SELECT id, phone_number FROM lead_contact_phones WHERE lead_id = ? AND contact_type = 'lead' ORDER BY id ASC LIMIT 1",
                [leadId]
            );
            if (remaining.length > 0) {
                await pool.query('UPDATE lead_contact_phones SET is_primary = 1 WHERE id = ?', [remaining[0].id]);
                await pool.query('UPDATE leads SET lead_phone = ? WHERE id = ?', [remaining[0].phone_number, leadId]);
            }
        }

        res.status(200).json({ message: 'Phone number removed' });
    } catch (error) {
        console.error('Delete Lead Phone Error:', error);
        res.status(500).json({ message: 'Error removing phone number' });
    }
};

// @route   PUT /api/leads/:id/spouse   { spouse_name }
exports.updateSpouseName = async (req, res) => {
    const leadId = req.params.id;
    try {
        const access = await assertLeadAccess(leadId, req.user);
        if (!access.ok) return res.status(access.code).json({ message: access.message });

        await pool.query('UPDATE leads SET spouse_name = ? WHERE id = ?', [req.body.spouse_name || null, leadId]);
        res.status(200).json({ message: 'Spouse name updated' });
    } catch (error) {
        console.error('Update Spouse Name Error:', error);
        res.status(500).json({ message: 'Error updating spouse name' });
    }
};

// @route   POST /api/leads/:id/spouse-phones   { phone_number }
exports.addSpousePhone = async (req, res) => {
    const leadId = req.params.id;
    const { phone_number } = req.body;
    if (!phone_number) return res.status(400).json({ message: 'Phone number required' });

    try {
        const access = await assertLeadAccess(leadId, req.user);
        if (!access.ok) return res.status(access.code).json({ message: access.message });

        const [existing] = await pool.query(
            "SELECT id FROM lead_contact_phones WHERE lead_id = ? AND contact_type = 'spouse'",
            [leadId]
        );
        if (existing.length >= MAX_SPOUSE_PHONES) {
            return res.status(400).json({ message: `Spouse-er max ${MAX_SPOUSE_PHONES} ta number rakha jay.` });
        }

        const [result] = await pool.query(
            "INSERT INTO lead_contact_phones (lead_id, phone_number, contact_type, is_primary) VALUES (?, ?, 'spouse', 0)",
            [leadId, phone_number]
        );
        res.status(201).json({ message: 'Spouse phone added', id: result.insertId });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Ei number ta already system-e onno kothao (kono lead ba spouse hisebe) registered ache.' });
        }
        console.error('Add Spouse Phone Error:', error);
        res.status(500).json({ message: 'Error adding spouse phone number' });
    }
};

// @route   DELETE /api/leads/:id/spouse-phones/:phoneId
exports.deleteSpousePhone = async (req, res) => {
    const { id: leadId, phoneId } = req.params;
    try {
        const access = await assertLeadAccess(leadId, req.user);
        if (!access.ok) return res.status(access.code).json({ message: access.message });

        await pool.query(
            "DELETE FROM lead_contact_phones WHERE id = ? AND lead_id = ? AND contact_type = 'spouse'",
            [phoneId, leadId]
        );
        res.status(200).json({ message: 'Spouse phone removed' });
    } catch (error) {
        console.error('Delete Spouse Phone Error:', error);
        res.status(500).json({ message: 'Error removing spouse phone number' });
    }
};
