const express = require('express');
const router = express.Router();
const db = require('../../db');
const { requireRole } = require('../auth/middleware');
const { validate, disburseSchema, penaltySchema } = require('../common/validation'); // added penaltySchema
const { getSetting } = require('../settings/routes'); 

// ... [Previous Routes for Queue and Stats remain unchanged] ...

// --- NEW: AUTOMATED PENALTY RUNNER ---
// Usage: Curl this endpoint daily via Cron
router.post('/admin/run-penalties', async (req, res) => {
    // Basic API Key protection for external cron
    const { secretKey } = req.body;
    if (secretKey !== process.env.CRON_SECRET) {
        // Also allow authenticated Admins to run it manually
        // If no secret key, check auth middleware manually (simplified here)
        // For now, require the secret key defined in .env
        if(!req.user || req.user.role !== 'ADMIN') {
             return res.status(403).json({ error: "Unauthorized" });
        }
    }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Get Penalty Settings
        const rateRes = await client.query("SELECT setting_value FROM system_settings WHERE setting_key = 'penalty_rate_percent'");
        const graceRes = await client.query("SELECT setting_value FROM system_settings WHERE setting_key = 'penalty_grace_period_days'");
        
        const penaltyRate = parseFloat(rateRes.rows[0]?.setting_value || 5); // 5% default
        const graceDays = parseInt(graceRes.rows[0]?.setting_value || 7);

        // 2. Find Overdue Loans
        // Logic: Active loans where last payment > 30 days ago OR (disbursed > 30 days ago AND no payments)
        // Simplified: Check if 'next_payment_date' is passed (if you had that column)
        // Here we use a robust check: Loan Active AND (Total Due > Repaid)
        
        const overdueLoans = await client.query(
            `SELECT id, user_id, (total_due - amount_repaid) as balance, updated_at 
             FROM loan_applications 
             WHERE status = 'ACTIVE' 
             AND updated_at < NOW() - INTERVAL '${graceDays} days'` 
        );

        let count = 0;
        for (const loan of overdueLoans.rows) {
            const penalty = loan.balance * (penaltyRate / 100);
            if (penalty > 0) {
                // Apply Penalty: Increase Total Due
                await client.query(
                    "UPDATE loan_applications SET total_due = total_due + $1, updated_at = NOW() WHERE id = $2",
                    [penalty, loan.id]
                );

                // Log Transaction
                await client.query(
                    "INSERT INTO transactions (user_id, type, amount, reference_code, description) VALUES ($1, 'PENALTY', $2, $3, $4)",
                    [loan.user_id, penalty, `PEN-${loan.id}-${Date.now()}`, `Late Payment Penalty (${penaltyRate}%)`]
                );
                count++;
            }
        }

        await client.query('COMMIT');
        res.json({ success: true, message: `Applied penalties to ${count} loans.` });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Penalty Run Error:", err);
        res.status(500).json({ error: "Failed to run penalties" });
    } finally {
        client.release();
    }
});

// --- UPDATED: PROCESS DISBURSEMENT (With Amortization Choice) ---
router.post('/treasury/disburse', requireRole('TREASURER'), validate(disburseSchema), async (req, res) => {
    const { loanId } = req.body;
    const client = await db.pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // 1. Fetch Loan & System Settings
        const check = await client.query("SELECT status, amount_requested, repayment_weeks, user_id FROM loan_applications WHERE id=$1", [loanId]);
        if (check.rows.length === 0 || check.rows[0].status !== 'APPROVED') throw new Error("Invalid loan status");
        
        const loan = check.rows[0];
        const principal = parseFloat(loan.amount_requested);
        const weeks = parseInt(loan.repayment_weeks);

        // Settings
        const rateVal = await getSetting('interest_rate'); 
        const typeVal = await getSetting('loan_interest_type');
        
        const rateInput = parseFloat(rateVal || 10);
        const interestType = typeVal || 'FLAT'; 

        let totalInterest = 0;
        let totalDue = 0;

        // 2. Calculate Based on Type
        if (interestType === 'REDUCING') {
            const weeklyRate = (rateInput / 100) / 52;
            const factor = Math.pow(1 + weeklyRate, weeks);
            const weeklyInstallment = principal * ((weeklyRate * factor) / (factor - 1));
            
            totalDue = weeklyInstallment * weeks;
            totalInterest = totalDue - principal;
        } else {
            totalInterest = principal * (rateInput / 100);
            totalDue = principal + totalInterest;
        }

        // 3. Update Loan Status
        await client.query(
            `UPDATE loan_applications 
             SET status='ACTIVE', 
                 interest_amount=$1, 
                 total_due=$2, 
                 updated_at=NOW(), 
                 disbursed_at=NOW() 
             WHERE id=$3`, 
            [totalInterest, totalDue, loanId]
        );

        // 4. Create Transaction Record
        await client.query(
            "INSERT INTO transactions (user_id, type, amount, reference_code, description) VALUES ($1, 'LOAN_DISBURSEMENT', $2, $3, $4)", 
            [loan.user_id, principal, `DISB-${loanId}`, `Disbursement (${interestType} Interest)`]
        );

        await client.query('COMMIT');
        
        res.json({ 
            success: true, 
            message: `Loan disbursed successfully.`,
            details: {
                type: interestType,
                principal: principal,
                interest: totalInterest.toFixed(2),
                total_due: totalDue.toFixed(2)
            }
        });

    } catch (err) { 
        await client.query('ROLLBACK'); 
        console.error("Disbursement Failed:", err);
        res.status(500).json({ error: err.message }); 
    } finally { 
        client.release(); 
    }
});

module.exports = router;