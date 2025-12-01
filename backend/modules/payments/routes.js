const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateUser, requireRole } = require('../auth/middleware');
const { validate, paymentSchema, repaymentSchema } = require('../common/validation');
const Joi = require('joi');

// Validation for Manual Recording
const recordTransactionSchema = Joi.object({
    userId: Joi.number().required(),
    type: Joi.string().valid('REGISTRATION_FEE', 'FINE', 'PENALTY', 'DEPOSIT').required(),
    amount: Joi.number().positive().required(),
    description: Joi.string().optional().allow(''),
    reference: Joi.string().required()
});

// ... (Keep existing /pay-fee and /repay-loan routes exactly as they were) ...
// 1. PAY LOAN FORM FEE (User pays to access loan)
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
             VALUES ($1, 'LOAN_FORM_FEE', 500, $2)`,
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
        const loanRes = await client.query(
            `SELECT user_id, amount_requested, amount_repaid, status, total_due 
             FROM loan_applications WHERE id=$1`, 
            [loanAppId]
        );

        if (loanRes.rows.length === 0) return res.status(404).json({ error: "Loan not found" });
        const loan = loanRes.rows[0];

        if (loan.user_id !== req.user.id) return res.status(403).json({ error: "Unauthorized" });
        if (loan.status !== 'ACTIVE') return res.status(400).json({ error: "Loan is not active" });

        const targetAmount = parseFloat(loan.total_due || loan.amount_requested);
        const currentPaid = parseFloat(loan.amount_repaid || 0);
        const repaymentAmt = parseFloat(amount);
        const newPaid = currentPaid + repaymentAmt;

        await client.query(
            `INSERT INTO transactions (user_id, type, amount, reference_code) 
             VALUES ($1, 'LOAN_REPAYMENT', $2, $3)`,
            [req.user.id, repaymentAmt, mpesaRef]
        );

        let newStatus = 'ACTIVE';
        if (newPaid >= targetAmount - 1) {
            newStatus = 'COMPLETED';
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
            message: newStatus === 'COMPLETED' ? "Loan fully repaid!" : "Repayment received.",
            balance: Math.max(0, targetAmount - newPaid)
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: "Repayment Failed" });
    } finally {
        client.release();
    }
});

// 3. RECORD MANUAL TRANSACTION
router.post('/admin/record', authenticateUser, validate(recordTransactionSchema), async (req, res) => {
    // Allow Treasurer to record specific manual transactions if needed, or keep to Chair/Admin
    if (!['ADMIN', 'CHAIRPERSON', 'TREASURER'].includes(req.user.role)) {
        return res.status(403).json({ error: "Access Denied" });
    }

    const { userId, type, amount, reference, description } = req.body;

    try {
        const result = await db.query(
            `INSERT INTO transactions (user_id, type, amount, reference_code, description) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [userId, type, amount, reference, description]
        );

        if (type === 'DEPOSIT') {
            await db.query(
                `INSERT INTO deposits (user_id, amount, transaction_ref, status) 
                 VALUES ($1, $2, $3, 'COMPLETED')`,
                [userId, amount, reference]
            );
        }

        res.json({ success: true, transaction: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to record transaction" });
    }
});

// GET ALL TRANSACTIONS (Updated to include TREASURER)
router.get('/admin/all', authenticateUser, (req, res, next) => {
    // Added TREASURER to the list
    if (['ADMIN', 'CHAIRPERSON', 'TREASURER'].includes(req.user.role)) next();
    else res.status(403).json({ error: "Access Denied" });
}, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT t.*, u.full_name 
             FROM transactions t 
             JOIN users u ON t.user_id = u.id 
             ORDER BY t.created_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not fetch transactions" });
    }
});

module.exports = router;