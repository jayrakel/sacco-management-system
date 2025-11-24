const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateUser } = require('../auth/middleware');

// 1. Add the Gatekeeper (authenticateUser)
router.post('/pay-fee', authenticateUser, async (req, res) => {
    const { loanAppId, mpesaRef } = req.body;
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');
        
        // 2. Security Check: Ensure the loan belongs to the user paying
        const loanCheck = await client.query("SELECT user_id FROM loan_applications WHERE id=$1", [loanAppId]);
        if (loanCheck.rows.length === 0) return res.status(404).json({ error: "Loan not found" });
        
        if (loanCheck.rows[0].user_id !== req.user.id) {
            throw new Error("Unauthorized: You can only pay for your own loan.");
        }

        // 3. Record Transaction
        await client.query(
            `INSERT INTO transactions (user_id, type, amount, reference_code) 
             VALUES ($1, 'FEE_PAYMENT', 500, $2)`,
            [req.user.id, mpesaRef]
        );

        // 4. Update Loan Status
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
        res.status(500).json({ error: err.message || "Payment Failed" });
    } finally {
        client.release();
    }
});

module.exports = router;