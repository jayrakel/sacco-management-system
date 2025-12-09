const express = require('express');
const router = express.Router();
const db = require('../../db');
const { requireRole } = require('../auth/middleware');
const { notifyAll } = require('../common/notify');

// 1. GET AGENDA (Motions tabled by Secretary)
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

// 2. OPEN VOTING (Moves status from 'TABLED' -> 'VOTING')
router.post('/chair/open-voting', requireRole('CHAIRPERSON'), async (req, res) => {
    const { loanId } = req.body;
    try {
        const check = await db.query("SELECT status FROM loan_applications WHERE id=$1", [loanId]);
        if(check.rows.length === 0) return res.status(404).json({ error: "Loan not found" });
        if(check.rows[0].status !== 'TABLED') return res.status(400).json({ error: "Loan is not tabled" });

        await db.query("UPDATE loan_applications SET status='VOTING' WHERE id=$1", [loanId]);
        
        await notifyAll(`📢 VOTING OPEN: The Chairperson has opened the floor for Loan #${loanId}. Log in to vote now.`);
        
        res.json({ success: true });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: "Failed to open voting" }); 
    }
});

// 3. GET PORTFOLIO (Active Loans Oversight)
router.get('/chair/portfolio', requireRole('CHAIRPERSON'), async (req, res) => {
    try {
        const result = await db.query(
            `SELECT l.*, u.full_name 
             FROM loan_applications l 
             JOIN users u ON l.user_id = u.id
             WHERE l.status IN ('ACTIVE', 'IN_ARREARS', 'OVERDUE')
             ORDER BY l.amount_requested DESC`
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Fetch error" }); }
});

module.exports = router;