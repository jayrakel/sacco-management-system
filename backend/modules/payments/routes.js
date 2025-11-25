const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateUser } = require('../auth/middleware');
const { validate, paymentSchema, repaymentSchema } = require('../common/validation');

// 1. PAY APPLICATION FEE
router.post('/pay-fee', authenticateUser, validate(paymentSchema), async (req, res) => {
    const { loanAppId, mpesaRef } = req.body;
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');
        
        const loanCheck = await client.query("SELECT user_id FROM loan_applications WHERE id=$1", [loanAppId]);
        if (loanCheck.rows.length === 0) return res.status(404).json({ error: "Loan not found" });
        
        if (loanCheck.rows[0].user_id !== req.user.id) {
            return res.status(403).json({ error: "Unauthorized payment" });
        }

        await client.query(
            `INSERT INTO transactions (user_id, type, amount, reference_code) 
             VALUES ($1, 'FEE_PAYMENT', 500, $2)`,
            [req.user.id, mpesaRef]
        );

        await client.query(
            `UPDATE loan_applications 
             SET status='FEE_PAID', fee_transaction_ref=$1 
             WHERE id=$2`,
            [mpesaRef, loanAppId]
        );

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: "Payment Failed" });
    } finally {
        client.release();
    }
});

// 2. REPAY LOAN
router.post('/repay-loan', authenticateUser, validate(repaymentSchema), async (req, res) => {
    const { loanAppId, amount, mpesaRef } = req.body;
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // Check loan status
        const loanRes = await client.query(
            "SELECT user_id, amount_requested, amount_repaid, status FROM loan_applications WHERE id=$1", 
            [loanAppId]
        );

        if (loanRes.rows.length === 0) return res.status(404).json({ error: "Loan not found" });
        const loan = loanRes.rows[0];

        // Security Checks
        if (loan.user_id !== req.user.id) return res.status(403).json({ error: "Unauthorized" });
        if (loan.status !== 'ACTIVE') return res.status(400).json({ error: "Loan is not active" });

        // Calculate new total paid
        const currentPaid = parseFloat(loan.amount_repaid || 0);
        const newPaid = currentPaid + parseInt(amount);
        const totalOwed = parseFloat(loan.amount_requested);

        // 1. Record Transaction
        await client.query(
            `INSERT INTO transactions (user_id, type, amount, reference_code) 
             VALUES ($1, 'LOAN_REPAYMENT', $2, $3)`,
            [req.user.id, amount, mpesaRef]
        );

        // 2. Update Loan Balance
        let newStatus = 'ACTIVE';
        if (newPaid >= totalOwed) {
            newStatus = 'COMPLETED'; // Loan fully paid!
        }

        await client.query(
            `UPDATE loan_applications 
             SET amount_repaid = $1, status = $2, updated_at = NOW()
             WHERE id = $3`,
            [newPaid, newStatus, loanAppId]
        );

        await client.query('COMMIT');
        
        res.json({ 
            success: true, 
            message: newStatus === 'COMPLETED' ? "Congratulations! Loan fully repaid." : "Repayment received.",
            balance: Math.max(0, totalOwed - newPaid)
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: "Repayment Failed" });
    } finally {
        client.release();
    }
});

module.exports = router;