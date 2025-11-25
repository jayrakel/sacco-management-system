const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateUser, requireRole } = require('../auth/middleware');
const { validate, loanSubmitSchema, tableLoanSchema, disburseSchema } = require('../common/validation');

// Protect ALL routes in this file
router.use(authenticateUser);

// GET STATUS (Updated to include amount_repaid)
router.get('/status', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, status, fee_amount, amount_requested, amount_repaid, purpose, repayment_weeks, fee_transaction_ref
             FROM loan_applications 
             WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
            [req.user.id]
        );
        if (result.rows.length === 0) return res.json({ status: 'NO_APP' });
        
        // Ensure numbers are formatted
        const loan = result.rows[0];
        loan.amount_requested = parseFloat(loan.amount_requested || 0);
        loan.amount_repaid = parseFloat(loan.amount_repaid || 0);
        
        res.json(loan);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server Error" });
    }
});

// INIT
router.post('/init', async (req, res) => {
    try {
        const activeCheck = await db.query(
            "SELECT id FROM loan_applications WHERE user_id = $1 AND status NOT IN ('REJECTED', 'COMPLETED') LIMIT 1",
            [req.user.id]
        );
        if(activeCheck.rows.length > 0) return res.status(400).json({ error: "Active application exists" });

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
router.post('/submit', validate(loanSubmitSchema), async (req, res) => {
    const { loanAppId, amount, purpose, repaymentWeeks } = req.body;
    
    try {
        const check = await db.query("SELECT user_id, status FROM loan_applications WHERE id=$1", [loanAppId]);
        
        if (check.rows.length === 0) return res.status(404).json({ error: "Not found" });
        if (check.rows[0].user_id !== req.user.id) return res.status(403).json({ error: "Unauthorized" });
        if (check.rows[0].status !== 'FEE_PAID') return res.status(400).json({ error: "Fee not paid" });

        await db.query(
            `UPDATE loan_applications 
             SET amount_requested=$1, purpose=$2, repayment_weeks=$3, status='SUBMITTED' 
             WHERE id=$4`,
            [amount, purpose, repaymentWeeks, loanAppId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Submission Error" });
    }
});

// SECRETARY: Agenda
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

// SECRETARY: Table Motion
router.post('/table', requireRole('SECRETARY'), validate(tableLoanSchema), async (req, res) => {
    const { loanId } = req.body;
    try {
        await db.query("UPDATE loan_applications SET status='TABLED' WHERE id=$1", [loanId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to table loan" });
    }
});

// TREASURER: Queue
router.get('/treasury/queue', requireRole('TREASURER'), async (req, res) => {
    try {
        const result = await db.query(
            `SELECT l.id, l.amount_requested, l.repayment_weeks, l.purpose, u.full_name, u.phone_number
             FROM loan_applications l
             JOIN users u ON l.user_id = u.id
             WHERE l.status = 'TABLED'
             ORDER BY l.created_at ASC`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Queue Error" });
    }
});

// TREASURER: Stats
router.get('/treasury/stats', requireRole('TREASURER'), async (req, res) => {
    try {
        const incomeRes = await db.query("SELECT COUNT(*) * 500 as total_fees FROM loan_applications WHERE status != 'FEE_PENDING'");
        const loanRes = await db.query("SELECT SUM(amount_requested) as total_loans FROM loan_applications WHERE status = 'ACTIVE'");
        res.json({
            totalFees: parseInt(incomeRes.rows[0].total_fees) || 0,
            totalDisbursed: parseInt(loanRes.rows[0].total_loans) || 0
        });
    } catch (err) {
        res.status(500).json({ error: "Stats Error" });
    }
});

// TREASURER: Disburse
router.post('/treasury/disburse', requireRole('TREASURER'), validate(disburseSchema), async (req, res) => {
    const { loanId } = req.body;
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');
        const check = await client.query("SELECT status, amount_requested FROM loan_applications WHERE id=$1", [loanId]);
        
        if (check.rows.length === 0) throw new Error("Loan not found");
        if (check.rows[0].status !== 'TABLED') throw new Error("Loan not approved for disbursement");

        // Set to ACTIVE so member can start repaying
        await client.query("UPDATE loan_applications SET status='ACTIVE', updated_at=NOW() WHERE id=$1", [loanId]);
        
        // Record transaction
        await client.query(
            `INSERT INTO transactions (user_id, type, amount, reference_code) 
             VALUES ($1, 'LOAN_DISBURSEMENT', $2, $3)`,
            [req.user.id, check.rows[0].amount_requested, `DISB-${loanId}-${Date.now()}`]
        );

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

module.exports = router;