const express = require('express');
const router = express.Router();
const db = require('../../db');
const { validate, loanSubmitSchema } = require('../common/validation');
const { getSetting } = require('../settings/routes'); // Import the settings helper
const { notifyUser, notifyAll } = require('../common/notify');

// 1. GET MY LOAN STATUS (With Dynamic Grace Period & Weekly Schedule Logic)
router.get('/status', async (req, res) => {
    try {
        // Fetch Loan Data
        const result = await db.query(
            `SELECT id, status, fee_amount, amount_requested, amount_repaid, 
                    purpose, repayment_weeks, total_due, interest_amount, disbursed_at 
             FROM loan_applications 
             WHERE user_id = $1 
             ORDER BY created_at DESC LIMIT 1`,
            [req.user.id]
        );

        if (result.rows.length === 0) return res.json({ status: 'NO_APP' });
        
        const loan = result.rows[0];

        // --- SMART FIX: AUTO-RECONCILE PAYMENTS ---
        // If status is 'FEE_PENDING', check if a manual payment exists but wasn't linked.
        if (loan.status === 'FEE_PENDING') {
            const paymentCheck = await db.query(
                `SELECT reference_code, amount 
                 FROM transactions 
                 WHERE user_id = $1 AND type = 'LOAN_FORM_FEE' 
                 ORDER BY created_at DESC LIMIT 1`,
                [req.user.id]
            );

            if (paymentCheck.rows.length > 0) {
                const tx = paymentCheck.rows[0];
                
                // Verify this transaction hasn't been used by another application
                const usageCheck = await db.query(
                    "SELECT id FROM loan_applications WHERE fee_transaction_ref = $1", 
                    [tx.reference_code]
                );

                if (usageCheck.rows.length === 0) {
                    console.log(`[Auto-Fix] Linking orphan payment ${tx.reference_code} to Loan #${loan.id}`);
                    
                    // 1. Update the database
                    await db.query(
                        `UPDATE loan_applications 
                         SET status='FEE_PAID', fee_transaction_ref=$1, fee_amount=$2 
                         WHERE id=$3`,
                        [tx.reference_code, tx.amount, loan.id]
                    );

                    // 2. Update the local object so the User sees the fix immediately
                    loan.status = 'FEE_PAID';
                    loan.fee_transaction_ref = tx.reference_code;
                    loan.fee_amount = parseFloat(tx.amount);
                }
            }
        }
        // -------------------------------------------

        // Parse Numbers to ensure math works
        loan.amount_requested = parseFloat(loan.amount_requested || 0);
        loan.amount_repaid = parseFloat(loan.amount_repaid || 0);
        loan.total_due = parseFloat(loan.total_due || 0);
        loan.interest_amount = parseFloat(loan.interest_amount || 0);
        loan.repayment_weeks = parseInt(loan.repayment_weeks || 0);

        // Calculate Weekly Schedule (Only if Active)
        loan.schedule = {
            weekly_installment: 0,
            weeks_passed: 0,
            installments_due: 0,
            expected_paid: 0,
            running_balance: 0,
            status_text: 'On Track'
        };

        if (loan.status === 'ACTIVE' && loan.disbursed_at && loan.total_due > 0) {
            // --- DYNAMIC SETTING: GRACE PERIOD ---
            const graceVal = await getSetting('loan_grace_period_weeks');
            const graceWeeks = parseInt(graceVal) || 4; // Default to 4 weeks if setting missing

            const now = new Date();
            const start = new Date(loan.disbursed_at);
            const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
            
            // Calculate Weekly Installment Amount
            const weeklyAmount = loan.total_due / loan.repayment_weeks;

            // Calculate Raw Time Passed (Total weeks since money entered account)
            const diffMs = now - start;
            const rawWeeksPassed = Math.floor(diffMs / oneWeekMs);
            
            // --- CORE LOGIC: EFFECTIVE WEEKS ---
            // We subtract the grace period from the raw weeks.
            const effectiveWeeksPassed = rawWeeksPassed - graceWeeks;

            let installmentsDue = 0;
            let statusText = 'ON TRACK';

            if (effectiveWeeksPassed < 0) {
                // We are IN the grace period
                installmentsDue = 0;
                statusText = 'GRACE PERIOD';
            } else {
                // Grace period over, schedule is active
                installmentsDue = Math.min(effectiveWeeksPassed + 1, loan.repayment_weeks);
            }
            
            const amountExpectedSoFar = installmentsDue * weeklyAmount;
            
            // Running Balance (Negative means arrears)
            const runningBalance = loan.amount_repaid - amountExpectedSoFar;

            if (statusText !== 'GRACE PERIOD') {
                statusText = runningBalance < 0 ? 'IN ARREARS' : 'AHEAD OF SCHEDULE';
            }

            loan.schedule = {
                weekly_installment: weeklyAmount,
                weeks_passed: Math.max(0, effectiveWeeksPassed + 1),
                weeks_remaining: Math.max(0, loan.repayment_weeks - (effectiveWeeksPassed + 1)),
                expected_to_date: amountExpectedSoFar,
                running_balance: runningBalance,
                status_text: statusText
            };
        }

        res.json(loan);
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: "Server Error" }); 
    }
});

// 2. START APPLICATION (With Dynamic Processing Fee)
router.post('/init', async (req, res) => {
    try {
        const activeCheck = await db.query("SELECT id FROM loan_applications WHERE user_id = $1 AND status NOT IN ('REJECTED', 'COMPLETED') LIMIT 1", [req.user.id]);
        if(activeCheck.rows.length > 0) return res.status(400).json({ error: "Active application exists" });
        
        // --- DYNAMIC SETTING: PROCESSING FEE ---
        const feeVal = await getSetting('loan_processing_fee');
        const processingFee = parseFloat(feeVal) || 500; // Default fallback

        const result = await db.query("INSERT INTO loan_applications (user_id, status, fee_amount) VALUES ($1, 'FEE_PENDING', $2) RETURNING *", [req.user.id, processingFee]);
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: "Init failed" }); }
});

// 3. SUBMIT DETAILS (With Dynamic Savings Multiplier)
router.post('/submit', validate(loanSubmitSchema), async (req, res) => {
    const { loanAppId, amount, purpose, repaymentWeeks } = req.body;
    try {
        const check = await db.query("SELECT user_id FROM loan_applications WHERE id=$1", [loanAppId]);
        if (check.rows.length === 0) return res.status(404).json({ error: "Not found" });
        if (check.rows[0].user_id !== req.user.id) return res.status(403).json({ error: "Unauthorized" });
        
        const savingsRes = await db.query("SELECT SUM(amount) as total FROM deposits WHERE user_id = $1 AND status = 'COMPLETED'", [req.user.id]);
        
        // --- DYNAMIC SETTING: LOAN MULTIPLIER ---
        const multiplierVal = await getSetting('loan_multiplier');
        const multiplier = parseFloat(multiplierVal) || 3; // Default 3x
        
        const totalSavings = parseFloat(savingsRes.rows[0].total || 0);
        const maxLimit = totalSavings * multiplier;
        
        if (parseInt(amount) > maxLimit) {
            return res.status(400).json({ 
                error: `Limit exceeded. Your savings: ${totalSavings.toLocaleString()}. Max Loan (${multiplier}x): ${maxLimit.toLocaleString()}` 
            });
        }

        await db.query("UPDATE loan_applications SET amount_requested=$1, purpose=$2, repayment_weeks=$3, status='PENDING_GUARANTORS' WHERE id=$4", [amount, purpose, repaymentWeeks, loanAppId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Submission error" }); }
});

// 4. FINAL SUBMIT (With Dynamic Min Guarantors)
router.post('/final-submit', async (req, res) => {
    const { loanAppId } = req.body;
    try {
        // --- DYNAMIC SETTING: MIN GUARANTORS ---
        const settingVal = await getSetting('min_guarantors');
        const minGuarantors = parseInt(settingVal) || 2; // Default 2

        const guarantors = await db.query("SELECT COUNT(*) FROM loan_guarantors WHERE loan_application_id=$1 AND status='ACCEPTED'", [loanAppId]);
        const acceptedCount = parseInt(guarantors.rows[0].count);

        if (acceptedCount < minGuarantors) {
            return res.status(400).json({ 
                error: `Insufficient Guarantors. Policy requires at least ${minGuarantors} accepted guarantors.` 
            });
        }

        await db.query("UPDATE loan_applications SET status='SUBMITTED' WHERE id=$1", [loanAppId]);
        
        // Notify Secretaries
        const secretaries = await db.query("SELECT id FROM users WHERE role='SECRETARY'");
        await Promise.all(secretaries.rows.map(s => notifyUser(s.id, `📝 Loan #${loanAppId} ready for review.`)));
        
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Final submit failed" }); }
});

module.exports = router;