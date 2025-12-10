const express = require('express');
const router = express.Router();
const db = require('../../db');
const { requireRole } = require('../auth/middleware');
const { validate, disburseSchema } = require('../common/validation');
const { getSetting } = require('../settings/routes'); 

// GET DISBURSEMENT QUEUE
router.get('/treasury/queue', requireRole('TREASURER'), async (req, res) => {
    try {
        const result = await db.query(
            `SELECT l.id, l.amount_requested, l.repayment_weeks, l.purpose, 
                    l.created_at, l.updated_at,
                    u.full_name, u.phone_number
             FROM loan_applications l 
             JOIN users u ON l.user_id = u.id
             WHERE l.status = 'APPROVED' 
             ORDER BY l.created_at ASC`
        );
        res.json(result.rows);
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: "Queue Error" }); 
    }
});

// NEW: GET ACTIVE LOAN PORTFOLIO
router.get('/treasury/portfolio', requireRole('TREASURER'), async (req, res) => {
    try {
        const result = await db.query(
            `SELECT l.id, l.amount_requested, l.amount_repaid, l.total_due, l.interest_amount, 
                    l.status, l.disbursed_at, l.repayment_weeks,
                    u.full_name, u.phone_number
             FROM loan_applications l 
             JOIN users u ON l.user_id = u.id
             WHERE l.status IN ('ACTIVE', 'IN_ARREARS', 'OVERDUE', 'COMPLETED') 
             ORDER BY l.disbursed_at DESC`
        );
        res.json(result.rows);
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: "Portfolio Error" }); 
    }
});

// GET TREASURY STATS
router.get('/treasury/stats', requireRole('TREASURER'), async (req, res) => {
    try {
        const savingsRes = await db.query("SELECT COALESCE(SUM(amount), 0) as total FROM deposits WHERE status='COMPLETED'");
        const totalSavings = parseFloat(savingsRes.rows[0].total);

        const incomeRes = await db.query(
            `SELECT COALESCE(SUM(amount), 0) as total FROM transactions 
             WHERE type NOT IN ('LOAN_DISBURSEMENT', 'DEPOSIT', 'LOAN_REPAYMENT')`
        );
        const totalIncome = parseFloat(incomeRes.rows[0].total);

        const repayRes = await db.query("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'LOAN_REPAYMENT'");
        const totalRepaid = parseFloat(repayRes.rows[0].total);

        const disbursedRes = await db.query(
            `SELECT COALESCE(SUM(amount_requested), 0) as total 
             FROM loan_applications 
             WHERE status IN ('ACTIVE', 'COMPLETED', 'IN_ARREARS', 'OVERDUE')`
        );
        const totalDisbursed = parseFloat(disbursedRes.rows[0].total);

        const availableFunds = (totalSavings + totalIncome + totalRepaid) - totalDisbursed;

        res.json({ availableFunds, totalDisbursed });

    } catch (err) { 
        console.error("Stats calculation error:", err);
        res.status(500).json({ error: "Stats Error" }); 
    }
});

// PROCESS DISBURSEMENT
router.post('/treasury/disburse', requireRole('TREASURER'), validate(disburseSchema), async (req, res) => {
    const { loanId } = req.body;
    const client = await db.pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const check = await client.query("SELECT status, amount_requested, repayment_weeks, user_id FROM loan_applications WHERE id=$1", [loanId]);
        if (check.rows.length === 0 || check.rows[0].status !== 'APPROVED') throw new Error("Invalid loan status");
        
        const loan = check.rows[0];
        const principal = parseFloat(loan.amount_requested);
        const weeks = parseInt(loan.repayment_weeks);

        const rateVal = await getSetting('interest_rate'); 
        const typeVal = await getSetting('loan_interest_type');
        
        const rateInput = parseFloat(rateVal || 10);
        const interestType = typeVal || 'FLAT'; 

        let totalInterest = 0;
        let totalDue = 0;

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