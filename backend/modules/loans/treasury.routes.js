const express = require('express');
const router = express.Router();
const db = require('../../db');
const { requireRole } = require('../auth/middleware');
const { validate, disburseSchema } = require('../common/validation');

router.get('/treasury/queue', requireRole('TREASURER'), async (req, res) => {
    try {
        const result = await db.query(
            `SELECT l.id, l.amount_requested, l.repayment_weeks, l.purpose, u.full_name, u.phone_number
             FROM loan_applications l JOIN users u ON l.user_id = u.id
             WHERE l.status = 'APPROVED' ORDER BY l.created_at ASC`
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Queue Error" }); }
});

router.get('/treasury/stats', requireRole('TREASURER'), async (req, res) => {
    try {
        const stats = await db.query(`SELECT (SELECT COALESCE(SUM(amount), 0) FROM deposits WHERE status='COMPLETED') as savings, (SELECT COUNT(*) * 500 FROM loan_applications WHERE status != 'FEE_PENDING') as fees, (SELECT COALESCE(SUM(amount_repaid), 0) FROM loan_applications) as repaid, (SELECT COALESCE(SUM(amount_requested), 0) FROM loan_applications WHERE status IN ('ACTIVE', 'COMPLETED')) as disbursed`);
        const r = stats.rows[0];
        const liquid = (parseFloat(r.savings) + parseFloat(r.fees) + parseFloat(r.repaid)) - parseFloat(r.disbursed);
        res.json({ availableFunds: liquid, totalDisbursed: parseFloat(r.disbursed) });
    } catch (err) { res.status(500).json({ error: "Stats Error" }); }
});

// ... imports ...
// ADD THIS IMPORT
const { getSetting } = require('../settings/routes'); 

// ... previous routes ...

router.post('/treasury/disburse', requireRole('TREASURER'), validate(disburseSchema), async (req, res) => {
    const { loanId } = req.body;
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Fetch Loan Details
        const check = await client.query("SELECT status, amount_requested, user_id FROM loan_applications WHERE id=$1", [loanId]);
        if (check.rows.length === 0 || check.rows[0].status !== 'APPROVED') throw new Error("Invalid loan status");
        
        const loan = check.rows[0];
        const principal = parseFloat(loan.amount_requested);

        // 2. Fetch System Interest Rate (Default 10%)
        const rateVal = await getSetting('interest_rate'); // Ensure this key matches your DB settings ('interest_rate' or 'loan_interest_rate')
        const rate = parseFloat(rateVal || 10);

        // 3. Calculate Interest
        const interest = principal * (rate / 100);
        const totalDue = principal + interest;

        // 4. Check Liquidity (Existing Logic)
        const stats = await client.query(`SELECT (SELECT COALESCE(SUM(amount), 0) FROM deposits WHERE status='COMPLETED') as savings, (SELECT COUNT(*) * 500 FROM loan_applications WHERE status != 'FEE_PENDING') as fees, (SELECT COALESCE(SUM(amount_repaid), 0) FROM loan_applications) as repaid, (SELECT COALESCE(SUM(amount_requested), 0) FROM loan_applications WHERE status IN ('ACTIVE', 'COMPLETED')) as disbursed`);
        const r = stats.rows[0];
        const available = (parseFloat(r.savings) + parseFloat(r.fees) + parseFloat(r.repaid)) - parseFloat(r.disbursed);
        
        if (available < principal) throw new Error(`Insufficient Funds. Available: KES ${available.toLocaleString()}`);

        // 5. UPDATE LOAN (Apply Interest & Activate)
        await client.query(
            `UPDATE loan_applications 
             SET status='ACTIVE', 
                 interest_amount=$1, 
                 total_due=$2, 
                 updated_at=NOW() 
             WHERE id=$3`, 
            [interest, totalDue, loanId]
        );

        // 6. Create Transaction Record
        await client.query("INSERT INTO transactions (user_id, type, amount, reference_code) VALUES ($1, 'LOAN_DISBURSEMENT', $2, $3)", [loan.user_id, principal, `DISB-${loanId}`]);

        await client.query('COMMIT');
        res.json({ success: true, message: `Loan disbursed with ${rate}% interest applied.` });
    } catch (err) { 
        await client.query('ROLLBACK'); 
        res.status(500).json({ error: err.message }); 
    } finally { 
        client.release(); 
    }
});

module.exports = router;