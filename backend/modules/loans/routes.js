const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateUser, requireRole } = require('../auth/middleware');

// Protected: All routes require login
router.use(authenticateUser);

// GET STATUS (Specific to logged-in user)
router.get('/status', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, status, fee_amount, amount_requested, purpose, repayment_weeks 
             FROM loan_applications 
             WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
            [req.user.id] 
        );
        
        if (result.rows.length === 0) return res.json({ status: 'NO_APP' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server Error" });
    }
});

// INIT LOAN
router.post('/init', async (req, res) => {
    try {
        // Ensure user doesn't already have an active application
        const activeCheck = await db.query(
            "SELECT id FROM loan_applications WHERE user_id = $1 AND status NOT IN ('REJECTED', 'COMPLETED') LIMIT 1",
            [req.user.id]
        );
        if(activeCheck.rows.length > 0) return res.status(400).json({ error: "You have an active application." });

        const result = await db.query(
            "INSERT INTO loan_applications (user_id, status, fee_amount) VALUES ($1, 'FEE_PENDING', 500) RETURNING *",
            [req.user.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Init failed" });
    }
});

// SUBMIT FORM
router.post('/submit', async (req, res) => {
    const { loanAppId, amount, purpose, repaymentWeeks } = req.body;
    
    try {
        // Security Check: Ensure the loan belongs to the user trying to submit it
        const check = await db.query("SELECT user_id, status FROM loan_applications WHERE id=$1", [loanAppId]);
        
        if (check.rows.length === 0) return res.status(404).json({ error: "Not found" });
        if (check.rows[0].user_id !== req.user.id) return res.status(403).json({ error: "Unauthorized" }); // Prevent IDOR attack
        if (check.rows[0].status !== 'FEE_PAID') return res.status(400).json({ error: "Fee not paid" });

        await db.query(
            `UPDATE loan_applications 
             SET amount_requested=$1, purpose=$2, repayment_weeks=$3, status='SUBMITTED' 
             WHERE id=$4`,
            [amount, purpose, repaymentWeeks, loanAppId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Submission Error" });
    }
});

// SECRETARY ONLY: Get Agenda
router.get('/agenda', requireRole('SECRETARY'), async (req, res) => {
    try {
        const result = await db.query(
            `SELECT l.id, l.amount_requested, l.purpose, l.repayment_weeks, u.full_name 
             FROM loan_applications l
             JOIN users u ON l.user_id = u.id
             WHERE l.status = 'SUBMITTED'
             ORDER BY l.created_at ASC`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Could not fetch agenda" });
    }
});

// SECRETARY ONLY: Table Motion
router.post('/table', requireRole('SECRETARY'), async (req, res) => {
    const { loanId } = req.body;
    try {
        await db.query("UPDATE loan_applications SET status='TABLED' WHERE id=$1", [loanId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to table loan" });
    }
});

module.exports = router;