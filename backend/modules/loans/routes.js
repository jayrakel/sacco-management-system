const express = require('express');
const router = express.Router();
const db = require('../../db');

// GET STATUS
router.get('/status', async (req, res) => {
    try {
        // Updated to select 'repayment_weeks'
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

// INIT
router.post('/init', async (req, res) => {
    try {
        await db.query(`INSERT INTO users (id, full_name, email, phone_number, password_hash, role) 
            VALUES (1, 'Test User', 't@t.com', '000', 'hash', 'MEMBER') ON CONFLICT (id) DO NOTHING`);
        const result = await db.query(
            "INSERT INTO loan_applications (user_id, status, fee_amount) VALUES ($1, 'FEE_PENDING', 500) RETURNING *",
            [req.user.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Init failed" });
    }
});

// SUBMIT FORM
router.post('/submit', async (req, res) => {
    // Receiving 'repaymentWeeks' from frontend
    const { loanAppId, amount, purpose, repaymentWeeks } = req.body;
    
    console.log("Submitting Loan:", { loanAppId, amount, purpose, repaymentWeeks });

    try {
        const check = await db.query("SELECT status FROM loan_applications WHERE id=$1", [loanAppId]);
        if (check.rows.length === 0) return res.status(404).json({ error: "Not found" });
        if (check.rows[0].status !== 'FEE_PAID') return res.status(400).json({ error: "Fee not paid" });

        // UPDATING 'repayment_weeks' COLUMN
        await db.query(
            `UPDATE loan_applications 
             SET amount_requested=$1, purpose=$2, repayment_weeks=$3, status='SUBMITTED' 
             WHERE id=$4`,
            [amount, purpose, repaymentWeeks, loanAppId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error("Submission Error:", err.message);
        // Send exact database error to frontend for easier debugging
        res.status(500).json({ error: err.message });
    }
});

// SECRETARY AGENDA
router.get('/agenda', async (req, res) => {
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
        console.error(err);
        res.status(500).json({ error: "Could not fetch agenda" });
    }
});

router.post('/table', async (req, res) => {
    const { loanId } = req.body;
    try {
        await db.query("UPDATE loan_applications SET status='TABLED' WHERE id=$1", [loanId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to table loan" });
    }
});

module.exports = router;