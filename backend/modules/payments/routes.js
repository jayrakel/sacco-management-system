const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateUser, requireRole } = require('../auth/middleware');
const { validate, paymentSchema, repaymentSchema } = require('../common/validation');
const { getSetting } = require('../settings/routes'); 
const Joi = require('joi');

// Validation for Manual Recording
const recordTransactionSchema = Joi.object({
    userId: Joi.number().required(),
    // Added LOAN_FORM_FEE and FEE_PAYMENT to validation
    type: Joi.string().valid('REGISTRATION_FEE', 'FINE', 'PENALTY', 'DEPOSIT', 'LOAN_FORM_FEE', 'FEE_PAYMENT').required(),
    amount: Joi.number().positive().required(),
    description: Joi.string().optional().allow(''),
    reference: Joi.string().optional().allow('', null) 
});

// 1. PAY LOAN FORM FEE (User initiated via Button)
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

        const feeVal = await getSetting('loan_processing_fee');
        const feeAmount = parseFloat(feeVal) || 500;

        await client.query(
            `INSERT INTO transactions (user_id, type, amount, reference_code) 
             VALUES ($1, 'LOAN_FORM_FEE', $2, $3)`,
            [req.user.id, feeAmount, mpesaRef]
        );

        await client.query(
            `UPDATE loan_applications 
             SET status='FEE_PAID', fee_transaction_ref=$1, fee_amount=$2
             WHERE id=$3`,
            [mpesaRef, feeAmount, loanAppId]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: `Fee of KES ${feeAmount} paid.` });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        if (err.code === '23505') return res.status(400).json({ error: "Reference used." });
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
        if (loan.status !== 'ACTIVE') return res.status(400).json({ error: "Loan not active" });

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
        if (err.code === '23505') return res.status(400).json({ error: "Reference code used." });
        res.status(500).json({ error: "Repayment Failed" });
    } finally {
        client.release();
    }
});

// 3. RECORD MANUAL TRANSACTION (Chairperson/Admin)
router.post('/admin/record', authenticateUser, validate(recordTransactionSchema), async (req, res) => {
    if (!['ADMIN', 'CHAIRPERSON', 'TREASURER'].includes(req.user.role)) {
        return res.status(403).json({ error: "Access Denied" });
    }

    let { userId, type, amount, reference, description } = req.body;
    
    // Auto-generate reference if not provided
    if (!reference || reference.trim() === '') {
        reference = `AUTO-${type}-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 1000)}`;
    }

    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // A. Record the Transaction (Ledger)
        const result = await client.query(
            `INSERT INTO transactions (user_id, type, amount, reference_code, description) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [userId, type, amount, reference, description]
        );

        // B. Handle Savings Logic
        if (type === 'DEPOSIT') {
            await client.query(
                `INSERT INTO deposits (user_id, amount, type, transaction_ref, status) 
                 VALUES ($1, $2, 'DEPOSIT', $3, 'COMPLETED')`,
                [userId, amount, reference]
            );
        } 
        else if (type === 'FINE' || type === 'PENALTY') {
            // Auto-Deduct from savings (Store as negative number)
            const savingsRes = await client.query("SELECT SUM(amount) as total FROM deposits WHERE user_id = $1", [userId]);
            const currentSavings = parseFloat(savingsRes.rows[0].total || 0);

            if (currentSavings > 0) {
                const deductionAmount = -Math.abs(amount); 
                const deductRef = `DEDUCT-${reference}`;
                
                await client.query(
                    `INSERT INTO deposits (user_id, amount, type, transaction_ref, status) 
                     VALUES ($1, $2, 'DEDUCTION', $3, 'COMPLETED')`,
                    [userId, deductionAmount, deductRef]
                );
            }
        }

        // --- C. SMART LINKING FOR LOAN FEES ---
        // FIX: Now checking for 'FEE_PENDING' specifically
        if (type === 'LOAN_FORM_FEE' || type === 'FEE_PAYMENT') {
            const recentLoan = await client.query(
                `SELECT id FROM loan_applications 
                 WHERE user_id = $1 AND status = 'FEE_PENDING' 
                 ORDER BY created_at DESC LIMIT 1`,
                [userId]
            );

            if (recentLoan.rows.length > 0) {
                const loanId = recentLoan.rows[0].id;
                
                // Update status AND save transaction reference
                await client.query(
                    `UPDATE loan_applications 
                     SET status='FEE_PAID', fee_transaction_ref=$1, fee_amount=$2
                     WHERE id=$3`,
                    [reference, amount, loanId]
                );
            }
        }
        // ---------------------------------------------

        await client.query('COMMIT');
        res.json({ success: true, transaction: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        if (err.code === '23505') return res.status(400).json({ error: "Reference code already exists" });
        res.status(500).json({ error: "Failed to record transaction" });
    } finally {
        client.release();
    }
});

// 4. AUTOMATED WEEKLY COMPLIANCE CHECK
router.post('/admin/run-weekly-compliance', authenticateUser, async (req, res) => {
    if (!['ADMIN', 'CHAIRPERSON'].includes(req.user.role)) return res.status(403).json({ error: "Access Denied" });

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // A. Get Settings
        const minDepositVal = await getSetting('min_weekly_deposit');
        const penaltyVal = await getSetting('penalty_missed_savings');
        const minDeposit = parseFloat(minDepositVal) || 250;
        const penaltyAmount = parseFloat(penaltyVal) || 50;

        // B. Find Non-Compliant Users for THIS WEEK
        const complianceQuery = `
            SELECT u.id 
            FROM users u
            WHERE u.role = 'MEMBER'
            AND u.id NOT IN (
                SELECT user_id FROM transactions 
                WHERE type = 'DEPOSIT' 
                AND created_at >= date_trunc('week', CURRENT_DATE)
                GROUP BY user_id
                HAVING SUM(amount) >= $1
            )
            AND u.id NOT IN (
                SELECT user_id FROM transactions 
                WHERE type = 'FINE' 
                AND description LIKE 'Missed Weekly Deposit%'
                AND created_at >= date_trunc('week', CURRENT_DATE)
            )
        `;

        const nonCompliant = await client.query(complianceQuery, [minDeposit]);
        
        if (nonCompliant.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.json({ message: "Compliance Check Complete. Everyone is up to date!", count: 0 });
        }

        // C. Apply Fines & Auto-Deduct
        const weekStr = new Date().toLocaleDateString('en-GB', { week: 'numeric', year: 'numeric' });
        let deductedCount = 0;

        for (const user of nonCompliant.rows) {
            const ref = `AUTO-FINE-${user.id}-${Date.now().toString().slice(-6)}`;
            
            // 1. Record Fine
            await client.query(
                `INSERT INTO transactions (user_id, type, amount, reference_code, description) 
                 VALUES ($1, 'FINE', $2, $3, $4)`,
                [user.id, penaltyAmount, ref, `Missed Weekly Deposit (Week ${weekStr})`]
            );

            // 2. Deduct from Savings (If they have ANY money)
            const savingsRes = await client.query("SELECT SUM(amount) as total FROM deposits WHERE user_id = $1", [user.id]);
            const currentSavings = parseFloat(savingsRes.rows[0].total || 0);

            if (currentSavings > 0) {
                await client.query(
                    `INSERT INTO deposits (user_id, amount, type, transaction_ref, status) 
                     VALUES ($1, $2, 'DEDUCTION', $3, 'COMPLETED')`,
                    [user.id, -penaltyAmount, `DEDUCT-${ref}`]
                );
                deductedCount++;
            }
        }

        await client.query('COMMIT');

        res.json({ 
            success: true, 
            message: `Compliance Check: Fined ${nonCompliant.rows.length} members. Deducted from ${deductedCount} accounts.`, 
            count: nonCompliant.rows.length 
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Compliance Error", err);
        res.status(500).json({ error: "Compliance check failed" });
    } finally {
        client.release();
    }
});

// GET ALL TRANSACTIONS
router.get('/admin/all', authenticateUser, (req, res, next) => {
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
        res.status(500).json({ error: "Could not fetch transactions" });
    }
});

module.exports = router;