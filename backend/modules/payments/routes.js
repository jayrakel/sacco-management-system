const express = require('express');
const router = express.Router();
const db = require('../../db');

router.post('/pay-fee', async (req, res) => {
    const { loanAppId, mpesaRef } = req.body;
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');
        
        // 1. Record Transaction
        await client.query(
            `INSERT INTO transactions (user_id, type, amount, reference_code) 
             VALUES ($1, 'FEE_PAYMENT', 500, $2)`,
            [req.user.id, mpesaRef]
        );

        // 2. Notify Loan Table (Direct DB update since we are in the same server)
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

module.exports = router;