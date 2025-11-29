const express = require('express');
const router = express.Router();
const db = require('../../db');
const { requireRole, authenticateUser } = require('../auth/middleware');
const { notifyAll } = require('../common/notify');

// 1. GET ALL LOANS (Shared: Admin, Officer, Chairperson)
router.get('/admin/all', authenticateUser, (req, res, next) => {
    const allowed = ['ADMIN', 'LOAN_OFFICER', 'CHAIRPERSON'];
    if (allowed.includes(req.user.role)) next();
    else res.status(403).json({ error: "Forbidden" });
}, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT l.*, u.full_name 
             FROM loan_applications l 
             JOIN users u ON l.user_id = u.id 
             ORDER BY l.created_at DESC`
        );
        res.json(result.rows);
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: "Fetch error" }); 
    }
});

// 2. GET VOTING AGENDA (Chairperson Only)
// This was missing! That's why the list was empty.
router.get('/chair/agenda', requireRole('CHAIRPERSON'), async (req, res) => {
    try {
        const result = await db.query(
            `SELECT l.id, l.amount_requested, u.full_name, l.purpose 
             FROM loan_applications l
             JOIN users u ON l.user_id = u.id 
             WHERE l.status = 'TABLED' 
             ORDER BY l.created_at ASC`
        );
        res.json(result.rows);
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: "Fetch error" }); 
    }
});

// 3. OPEN VOTING (Chairperson Only)
router.post('/chair/open-voting', requireRole('CHAIRPERSON'), async (req, res) => {
    const { loanId } = req.body;
    try {
        await db.query("UPDATE loan_applications SET status='VOTING' WHERE id=$1", [loanId]);
        await notifyAll(`📢 VOTING OPEN: The Chair has opened the floor for Loan #${loanId}.`);
        res.json({ success: true });
    } catch (err) { 
        res.status(500).json({ error: "Failed to open voting" }); 
    }
});

module.exports = router;