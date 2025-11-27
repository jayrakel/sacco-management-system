const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateUser, requireRole } = require('../auth/middleware');
const { validate, paymentSchema, repaymentSchema } = require('../common/validation');
const { calculateLoanSchedule } = require('../loans/utils'); // Import Shared Logic

// 1. PAY APPLICATION FEE
// Note: Ensure 'paymentSchema' in validation.js allows the fields you are sending.
// It typically expects: { "loanAppId": 123, "mpesaRef": "XD..." }
router.post('/pay-fee', authenticateUser, validate(paymentSchema), async (req, res) => {
    const { loanAppId, mpesaRef } = req.body;
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');
        
        // 1. Verify Loan Ownership
        const loanCheck = await client.query("SELECT user_id, status FROM loan_applications WHERE id=$1", [loanAppId]);
        if (loanCheck.rows.length === 0) {
            return res.status(404).json({ error: "Loan not found" });
        }
        
        if (loanCheck.rows[0].user_id !== req.user.id) {
            return res.status(403).json({ error: "Unauthorized payment" });
        }

        // Optional: Prevent double payment
        if (loanCheck.rows[0].status === 'FEE_PAID') {
             return res.status(400).json({ error: "Fee already paid" });
        }

        // 2. Record Transaction
        await client.query(
            `INSERT INTO transactions (user_id, type, amount, reference_code) 
             VALUES ($1, 'FEE_PAYMENT', 500, $2)`,
            [req.user.id, mpesaRef]
        );

        // 3. Update Loan Status
        await client.query(
            `UPDATE loan_applications 
             SET status='FEE_PAID', fee_transaction_ref=$1, updated_at=NOW() 
             WHERE id=$2`,
            [mpesaRef, loanAppId]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: "Application fee paid successfully." });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Fee Payment Error:", err);
        res.status(500).json({ error: "Payment processing failed." });
    } finally {
        client.release();
    }
});

// 2. REPAY LOAN (Updated with Grace Period & Pre-payment Logic)
router.post('/repay-loan', authenticateUser, validate(repaymentSchema), async (req, res) => {
    const { loanAppId, amount, mpesaRef } = req.body;
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Fetch ALL data needed for Schedule Calculation
        // We grab columns needed for utils.calculateLoanSchedule
        const loanRes = await client.query(
            `SELECT id, user_id, amount_requested, amount_repaid, status, total_due,
                    disbursed_at, grace_period_weeks, repayment_weeks
             FROM loan_applications WHERE id=$1`, 
            [loanAppId]
        );

        if (loanRes.rows.length === 0) return res.status(404).json({ error: "Loan not found" });
        const loan = loanRes.rows[0];

        if (loan.user_id !== req.user.id) return res.status(403).json({ error: "Unauthorized" });
        if (loan.status !== 'ACTIVE') return res.status(400).json({ error: "Loan is not active" });

        // Calculate logic
        const targetAmount = parseFloat(loan.total_due || loan.amount_requested);
        const currentPaid = parseFloat(loan.amount_repaid || 0);
        const repaymentAmt = parseFloat(amount);
        const newPaid = currentPaid + repaymentAmt;

        // 2. Record Transaction
        await client.query(
            `INSERT INTO transactions (user_id, type, amount, reference_code) 
             VALUES ($1, 'LOAN_REPAYMENT', $2, $3)`,
            [req.user.id, repaymentAmt, mpesaRef]
        );

        // 3. Check Completion
        let newStatus = 'ACTIVE';
        if (newPaid >= targetAmount - 1) { // Allow small buffer for float math
            newStatus = 'COMPLETED';
        }

        // 4. Update Loan in DB
        await client.query(
            `UPDATE loan_applications 
             SET amount_repaid = $1, status = $2, updated_at = NOW()
             WHERE id = $3`,
            [newPaid, newStatus, loanAppId]
        );

        // 5. Generate Receipt Feedback using Shared Logic
        // We temporarily update the local loan object to run the calculation on the *new* state
        loan.amount_repaid = newPaid; 
        
        // Ensure numbers are parsed for the util function
        loan.total_due = parseFloat(loan.total_due);
        loan.repayment_weeks = parseInt(loan.repayment_weeks);
        loan.grace_period_weeks = parseInt(loan.grace_period_weeks);

        const schedule = calculateLoanSchedule(loan);
        
        let message = "Repayment received.";
        if (newStatus === 'COMPLETED') {
            message = "Congratulations! Loan fully repaid.";
        } else if (schedule.in_grace_period) {
            message = `Pre-payment Accepted! Grace period active (${schedule.grace_days_left} days left).`;
        } else if (schedule.running_balance > 0) {
            // User has paid MORE than what was expected by today
            const weeksCovered = Math.floor(schedule.running_balance / schedule.weekly_installment);
            if (weeksCovered > 0) {
                message = `Payment Accepted. You are now ${weeksCovered} weeks ahead of schedule!`;
            } else {
                message = "Payment Accepted. You are on track.";
            }
        } else if (schedule.running_balance < 0) {
            message = "Payment Accepted. You are still in arrears, please clear the balance.";
        }

        await client.query('COMMIT');
        
        res.json({ 
            success: true, 
            message: message,
            balance: Math.max(0, targetAmount - newPaid),
            schedule_status: schedule.status_text // 'ON TRACK', 'IN ARREARS', etc.
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: "Repayment Failed" });
    } finally {
        client.release();
    }
});

// GET ALL TRANSACTIONS (Admin)
router.get('/admin/all', authenticateUser, requireRole('ADMIN'), async (req, res) => {
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