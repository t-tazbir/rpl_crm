const pool = require('../config/db');

// @route   GET /api/todos
exports.getTodos = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT t.*, l.lead_name FROM todos t
             LEFT JOIN leads l ON l.id = t.lead_id
             WHERE t.sales_rep_id = ?
             ORDER BY t.is_done ASC, (t.due_date IS NULL), t.due_date ASC, t.id DESC`,
            [req.user.id]
        );
        res.status(200).json({ success: true, data: rows });
    } catch (error) {
        console.error('Get Todos Error:', error);
        res.status(500).json({ message: 'Error fetching to-dos' });
    }
};

// @route   POST /api/todos   { title, due_date?, lead_id? }
exports.createTodo = async (req, res) => {
    try {
        const { title, due_date, lead_id } = req.body;
        if (!title) return res.status(400).json({ message: 'Title is required' });

        const [result] = await pool.query(
            'INSERT INTO todos (sales_rep_id, lead_id, title, due_date) VALUES (?, ?, ?, ?)',
            [req.user.id, lead_id || null, title, due_date || null]
        );
        res.status(201).json({ message: 'To-do created', id: result.insertId });
    } catch (error) {
        console.error('Create Todo Error:', error);
        res.status(500).json({ message: 'Error creating to-do' });
    }
};

// @route   PUT /api/todos/:id   { title?, due_date?, is_done? }
exports.updateTodo = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT sales_rep_id FROM todos WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'To-do khuje pawa jayni.' });
        if (rows[0].sales_rep_id !== req.user.id) return res.status(403).json({ message: 'Access Denied' });

        const allowed = ['title', 'due_date', 'is_done'];
        const fields = [];
        const params = [];
        allowed.forEach((f) => {
            if (req.body[f] !== undefined) { fields.push(`${f} = ?`); params.push(req.body[f]); }
        });
        if (fields.length === 0) return res.status(400).json({ message: 'Kono valid field pawa jayni.' });

        params.push(req.params.id);
        await pool.query(`UPDATE todos SET ${fields.join(', ')} WHERE id = ?`, params);
        res.status(200).json({ message: 'To-do updated' });
    } catch (error) {
        console.error('Update Todo Error:', error);
        res.status(500).json({ message: 'Error updating to-do' });
    }
};

// @route   DELETE /api/todos/:id
exports.deleteTodo = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT sales_rep_id FROM todos WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'To-do khuje pawa jayni.' });
        if (rows[0].sales_rep_id !== req.user.id) return res.status(403).json({ message: 'Access Denied' });

        await pool.query('DELETE FROM todos WHERE id = ?', [req.params.id]);
        res.status(200).json({ message: 'To-do removed' });
    } catch (error) {
        console.error('Delete Todo Error:', error);
        res.status(500).json({ message: 'Error removing to-do' });
    }
};
