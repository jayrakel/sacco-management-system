const express = require('express');
const router = express.Router();
const db = require('../../db');
const { requireRole } = require('../auth/middleware');
const { notifyAll } = require('../common/notify');

// Get Agenda (Tabled Loans)
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
    } catch (err) { res.status(500).json({ error: "Fetch error" }); }
});

// Open Voting
router.post('/chair/open-voting', requireRole('CHAIRPERSON'), async (req, res) => {
    const { loanId } = req.body;
    try {
        // Ensure loan is actually tabled before opening voting
        const check = await db.query("SELECT status FROM loan_applications WHERE id=$1", [loanId]);
        if(check.rows[0].status !== 'TABLED') return res.status(400).json({ error: "Loan is not in tabled status" });

        await db.query("UPDATE loan_applications SET status='VOTING' WHERE id=$1", [loanId]);
        await notifyAll(`📢 VOTING OPEN: The Chairperson has opened the floor for Loan #${loanId}. Log in to vote.`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed to open voting" }); }
});

module.exports = router;