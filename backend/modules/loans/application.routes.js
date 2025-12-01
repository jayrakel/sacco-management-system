const express = require('express');
const router = express.Router();
const db = require('../../db');
const { validate, loanSubmitSchema } = require('../common/validation');
const { getSetting } = require('../settings/routes'); // Import getSetting
const { notifyUser, notifyAll } = require('../common/notify');

// GET MY LOAN STATUS (With Grace Period & Weekly Schedule Logic)
router.get('/status', async (req, res) => {
    try {
        // 1. Fetch Loan Data
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

        // 2. Parse Numbers
        loan.amount_requested = parseFloat(loan.amount_requested || 0);
        loan.amount_repaid = parseFloat(loan.amount_repaid || 0);
        loan.total_due = parseFloat(loan.total_due || 0);
        loan.interest_amount = parseFloat(loan.interest_amount || 0);
        loan.repayment_weeks = parseInt(loan.repayment_weeks || 0);

        // 3. Calculate Weekly Schedule (If Active)
        loan.schedule = {
            weekly_installment: 0,
            weeks_passed: 0,
            installments_due: 0,
            expected_paid: 0,
            running_balance: 0,
            status_text: 'On Track'
        };

        if (loan.status === 'ACTIVE' && loan.disbursed_at && loan.total_due > 0) {
            // --- GRACE PERIOD CONFIGURATION ---
            const graceSetting = await getSetting('grace_period_weeks');
            const graceWeeks = parseInt(graceSetting) || 0;

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
            // If grace is 2 weeks, and rawWeeks is 1, effective is -1 (Still in grace).
            // If rawWeeks is 2, effective is 0 (Week 1 just started/due).
            const effectiveWeeksPassed = rawWeeksPassed - graceWeeks;

            let installmentsDue = 0;
            let statusText = 'ON TRACK';

            if (effectiveWeeksPassed < 0) {
                // We are IN the grace period
                installmentsDue = 0;
                statusText = 'GRACE PERIOD';
            } else {
                // Grace period over, schedule is active
                // "effectiveWeeksPassed + 1" means we count the current week as Due immediately (Start-of-week logic)
                installmentsDue = Math.min(effectiveWeeksPassed + 1, loan.repayment_weeks);
            }
            
            const amountExpectedSoFar = installmentsDue * weeklyAmount;
            
            // Running Balance: 
            // If in grace period, expected is 0, so any Repaid amount is positive (Pre-payment).
            const runningBalance = loan.amount_repaid - amountExpectedSoFar;

            if (statusText !== 'GRACE PERIOD') {
                statusText = runningBalance < 0 ? 'IN ARREARS' : 'AHEAD OF SCHEDULE';
            }

            loan.schedule = {
                weekly_installment: weeklyAmount,
                // Display 0/10 if in grace, otherwise 1/10, 2/10 etc.
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

// ... (Keep the rest of the existing routes: /init, /submit, /final-submit unchanged)
// START APPLICATION (With Fee Pending)
router.post('/init', async (req, res) => {
    try {
        const activeCheck = await db.query("SELECT id FROM loan_applications WHERE user_id = $1 AND status NOT IN ('REJECTED', 'COMPLETED') LIMIT 1", [req.user.id]);
        if(activeCheck.rows.length > 0) return res.status(400).json({ error: "Active application exists" });
        
        const result = await db.query("INSERT INTO loan_applications (user_id, status, fee_amount) VALUES ($1, 'FEE_PENDING', 500) RETURNING *", [req.user.id]);
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: "Init failed" }); }
});

// SUBMIT DETAILS
router.post('/submit', validate(loanSubmitSchema), async (req, res) => {
    const { loanAppId, amount, purpose, repaymentWeeks } = req.body;
    try {
        const check = await db.query("SELECT user_id FROM loan_applications WHERE id=$1", [loanAppId]);
        if (check.rows.length === 0) return res.status(404).json({ error: "Not found" });
        if (check.rows[0].user_id !== req.user.id) return res.status(403).json({ error: "Unauthorized" });
        
        const savingsRes = await db.query("SELECT SUM(amount) as total FROM deposits WHERE user_id = $1 AND status = 'COMPLETED'", [req.user.id]);
        
        const multiplierVal = await getSetting('loan_multiplier');
        const multiplier = parseFloat(multiplierVal) || 3;
        const maxLimit = (parseFloat(savingsRes.rows[0].total || 0)) * multiplier;
        
        if (parseInt(amount) > maxLimit) return res.status(400).json({ error: `Limit exceeded (Max ${multiplier}x Savings)` });

        await db.query("UPDATE loan_applications SET amount_requested=$1, purpose=$2, repayment_weeks=$3, status='PENDING_GUARANTORS' WHERE id=$4", [amount, purpose, repaymentWeeks, loanAppId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Submission error" }); }
});

// FINAL SUBMIT
router.post('/final-submit', async (req, res) => {
    const { loanAppId } = req.body;
    try {
        const settingVal = await getSetting('min_guarantors');
        const minGuarantors = parseInt(settingVal) || 2;

        const guarantors = await db.query("SELECT COUNT(*) FROM loan_guarantors WHERE loan_application_id=$1 AND status='ACCEPTED'", [loanAppId]);
        const acceptedCount = parseInt(guarantors.rows[0].count);

        if (acceptedCount < minGuarantors) return res.status(400).json({ error: `Need ${minGuarantors} accepted guarantors.` });

        await db.query("UPDATE loan_applications SET status='SUBMITTED' WHERE id=$1", [loanAppId]);
        
        // Notify Secretaries
        const secretaries = await db.query("SELECT id FROM users WHERE role='SECRETARY'");
        await Promise.all(secretaries.rows.map(s => notifyUser(s.id, `📝 Loan #${loanAppId} ready for review.`)));
        
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Final submit failed" }); }
});

module.exports = router;