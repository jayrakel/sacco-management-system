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

// 2. REPAY LOAN
router.post('/repay-loan', authenticateUser, validate(repaymentSchema), async (req, res) => {
    const { loanAppId, amount, mpesaRef } = req.body;
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Fetch Loan Data
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

        // 2. Process Payment Math
        const targetAmount = parseFloat(loan.total_due || loan.amount_requested);
        const currentPaid = parseFloat(loan.amount_repaid || 0);
        const repaymentAmt = parseFloat(amount);
        const newPaid = currentPaid + repaymentAmt;

        // 3. Determine if Loan is Completed
        let newStatus = 'ACTIVE';
        if (newPaid >= targetAmount - 1) { 
            newStatus = 'COMPLETED';
        }

        // 4. Calculate New Running Balance (Using the new paid amount)
        // We create a temporary loan object with the new values to pass to our utility
        const tempLoanState = { ...loan, amount_repaid: newPaid, status: newStatus };
        const schedule = calculateLoanSchedule(tempLoanState);

        // 5. Update Database (Including the new running_balance)
        await client.query(
            `UPDATE loan_applications 
             SET amount_repaid = $1, 
                 status = $2, 
                 running_balance = $3,
                 updated_at = NOW()
             WHERE id = $4`,
            [newPaid, newStatus, schedule.running_balance, loanAppId]
        );

        // 6. Record Transaction
        await client.query(
            `INSERT INTO transactions (user_id, type, amount, reference_code) 
             VALUES ($1, 'LOAN_REPAYMENT', $2, $3)`,
            [req.user.id, repaymentAmt, mpesaRef]
        );

        await client.query('COMMIT');
        
        // 7. Feedback Message
        let message = "Repayment received.";
        if (newStatus === 'COMPLETED') {
            message = "Congratulations! Your loan has been fully repaid.";
        } else if (schedule.arrears > 0) {
            message = `Payment accepted. You still have arrears of ${schedule.arrears.toFixed(2)}.`;
        } else if (schedule.pre_payment > 0) {
            const weeksCovered = Math.floor(schedule.pre_payment / schedule.weekly_installment);
            if (weeksCovered >= 1) {
                message = `Payment accepted. You are ${weeksCovered} weeks ahead of schedule!`;
            } else {
                message = "Payment accepted. You have a small pre-payment balance.";
            }
        } else {
            message = "Payment accepted. You are perfectly on track.";
        }

        res.json({ 
            success: true, 
            message: message,
            balance_due: Math.max(0, targetAmount - newPaid),
            schedule_status: schedule.status_text,
            running_balance: schedule.running_balance
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Repayment Error:", err);
        res.status(500).json({ error: "Repayment processing failed." });
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