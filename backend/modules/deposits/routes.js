const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateUser } = require('../auth/middleware');

// GET MY SAVINGS BALANCE & SHARES
router.get('/balance', authenticateUser, async (req, res) => {
    try {
        // Savings (Withdrawable)
        const savingsRes = await db.query(
            "SELECT COALESCE(SUM(amount), 0) as balance FROM deposits WHERE user_id = $1 AND status = 'COMPLETED' AND type = 'DEPOSIT'",
            [req.user.id]
        );
        
        // Share Capital (Non-Withdrawable)
        const sharesRes = await db.query(
            "SELECT COALESCE(SUM(amount), 0) as balance FROM deposits WHERE user_id = $1 AND status = 'COMPLETED' AND type = 'SHARE_CAPITAL'",
            [req.user.id]
        );

        res.json({ 
            balance: parseFloat(savingsRes.rows[0].balance),
            shares: parseFloat(sharesRes.rows[0].balance) 
        });
    } catch (err) {
        res.status(500).json({ error: "Error fetching balance" });
    }
});

// GET TRANSACTION HISTORY
router.get('/history', authenticateUser, async (req, res) => {
    try {
        const result = await db.query(
            "SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Error fetching history" });
    }
});

// ADMIN: GET ALL DEPOSITS
router.get('/admin/all', authenticateUser, async (req, res) => {
    if (!['ADMIN', 'TREASURER', 'CHAIRPERSON'].includes(req.user.role)) return res.status(403).json({ error: "Denied" });
    try {
        const result = await db.query(
            `SELECT d.*, u.full_name 
             FROM deposits d 
             JOIN users u ON d.user_id = u.id 
             ORDER BY d.created_at DESC LIMIT 100`
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Error" }); }
});

// REQUEST WITHDRAWAL (Enforce Share Capital Lock)
router.post('/withdraw', authenticateUser, async (req, res) => {
    const { amount, mpesaNumber } = req.body;
    const withdrawAmount = parseFloat(amount);

    if (withdrawAmount <= 0) return res.status(400).json({ error: "Invalid amount" });

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Check Savings Balance (Exclude Shares)
        const savingsRes = await client.query(
            "SELECT COALESCE(SUM(amount), 0) as total FROM deposits WHERE user_id = $1 AND status = 'COMPLETED' AND type = 'DEPOSIT'",
            [req.user.id]
        );
        const currentSavings = parseFloat(savingsRes.rows[0].total);

        if (currentSavings < withdrawAmount) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                error: "Insufficient withdrawable savings.",
                details: "Share Capital cannot be withdrawn." 
            });
        }

        // 2. Check for Active Loan Guarantees (Locked Savings)
        const liabilityRes = await client.query(
            `SELECT COALESCE(SUM(amount_guaranteed), 0) as locked 
             FROM loan_guarantors 
             WHERE guarantor_id = $1 AND status = 'ACCEPTED'`,
            [req.user.id]
        );
        const lockedAmount = parseFloat(liabilityRes.rows[0].locked);
        const freeSavings = currentSavings - lockedAmount;

        if (freeSavings < withdrawAmount) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                error: "Funds locked by guarantees.",
                details: `You have guaranteed KES ${lockedAmount.toLocaleString()} in active loans.`
            });
        }

        // 3. Process Withdrawal (Deduction)
        const ref = `WTH-${Date.now()}`;
        
        // Add negative deposit record
        await client.query(
            "INSERT INTO deposits (user_id, amount, type, transaction_ref, status) VALUES ($1, $2, 'WITHDRAWAL', $3, 'COMPLETED')",
            [req.user.id, -withdrawAmount, ref]
        );

        // Add Transaction Log
        await client.query(
            "INSERT INTO transactions (user_id, type, amount, reference_code, description) VALUES ($1, 'WITHDRAWAL', $2, $3, 'Withdrawal to M-Pesa')",
            [req.user.id, withdrawAmount, ref]
        );

        // TODO: Integrate M-Pesa B2C here

        await client.query('COMMIT');
        res.json({ success: true, message: "Withdrawal processed successfully", ref });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: "Withdrawal failed" });
    } finally {
        client.release();
    }
});

module.exports = router;