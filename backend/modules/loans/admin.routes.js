const express = require('express');
const router = express.Router();
const db = require('../../db');
const { requireRole } = require('../auth/middleware');
const { notifyAll } = require('../common/notify');

router.get('/admin/all', requireRole('ADMIN'), async (req, res) => {
    try {
        const result = await db.query(
            `SELECT l.*, u.full_name 
             FROM loan_applications l 
             JOIN users u ON l.user_id = u.id 
             ORDER BY l.created_at DESC`
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Fetch error" }); }
});

router.get('/admin/agenda', requireRole('ADMIN'), async (req, res) => {
    try {
        const result = await db.query(
            `SELECT l.id, l.amount_requested, u.full_name, l.purpose 
             FROM loan_applications l
             JOIN users u ON l.user_id = u.id
             WHERE l.status = 'TABLED' ORDER BY l.created_at ASC`
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Fetch error" }); }
});

router.post('/admin/open-voting', requireRole('ADMIN'), async (req, res) => {
    const { loanId } = req.body;
    try {
        await db.query("UPDATE loan_applications SET status='VOTING' WHERE id=$1", [loanId]);
        await notifyAll(`📢 VOTING OPEN: The Chair has opened the floor for Loan #${loanId}.`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed to open voting" }); }
});

module.exports = router;