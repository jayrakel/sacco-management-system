const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateUser, requireRole } = require('../auth/middleware');
const { validate, loanSubmitSchema, tableLoanSchema, disburseSchema } = require('../common/validation');

// Protect ALL routes
router.use(authenticateUser);

// --- MEMBER LOAN MANAGEMENT ---

// 1. GET MY LOAN STATUS
router.get('/status', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, status, fee_amount, amount_requested, amount_repaid, purpose, repayment_weeks 
             FROM loan_applications 
             WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
            [req.user.id]
        );
        if (result.rows.length === 0) return res.json({ status: 'NO_APP' });
        
        const loan = result.rows[0];
        // Parse numbers for frontend math
        loan.amount_requested = parseFloat(loan.amount_requested || 0);
        loan.amount_repaid = parseFloat(loan.amount_repaid || 0);
        
        res.json(loan);
    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

// 2. INITIALIZE APPLICATION
router.post('/init', async (req, res) => {
    try {
        const activeCheck = await db.query(
            "SELECT id FROM loan_applications WHERE user_id = $1 AND status NOT IN ('REJECTED', 'COMPLETED') LIMIT 1",
            [req.user.id]
        );
        if(activeCheck.rows.length > 0) return res.status(400).json({ error: "Active application exists" });

        const result = await db.query(
            "INSERT INTO loan_applications (user_id, status, fee_amount) VALUES ($1, 'FEE_PENDING', 500) RETURNING *",
            [req.user.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Init failed" });
    }
});

// 3. SUBMIT LOAN FORM (With 3x Savings Rule)
router.post('/submit', validate(loanSubmitSchema), async (req, res) => {
    const { loanAppId, amount, purpose, repaymentWeeks } = req.body;
    
    try {
        const check = await db.query("SELECT user_id, status FROM loan_applications WHERE id=$1", [loanAppId]);
        if (check.rows.length === 0) return res.status(404).json({ error: "Not found" });
        if (check.rows[0].user_id !== req.user.id) return res.status(403).json({ error: "Unauthorized" });
        if (check.rows[0].status !== 'FEE_PAID') return res.status(400).json({ error: "Fee not paid" });

        // 3x SAVINGS RULE
        const savingsRes = await db.query(
            "SELECT SUM(amount) as total FROM deposits WHERE user_id = $1 AND status = 'COMPLETED'",
            [req.user.id]
        );
        const totalSavings = parseFloat(savingsRes.rows[0].total || 0);
        const maxLimit = totalSavings * 3;

        if (parseInt(amount) > maxLimit) {
            return res.status(400).json({ 
                error: `Loan limit exceeded. Savings: ${totalSavings}. Max Loan: ${maxLimit}` 
            });
        }

        await db.query(
            `UPDATE loan_applications 
             SET amount_requested=$1, purpose=$2, repayment_weeks=$3, status='SUBMITTED' 
             WHERE id=$4`,
            [amount, purpose, repaymentWeeks, loanAppId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Submission Error" });
    }
});

// --- VOTING SYSTEM (DEMOCRACY) ---

// 4. GET LOANS OPEN FOR VOTING (For Members)
router.get('/vote/open', async (req, res) => {
    try {
        // Get loans that are TABLED and I haven't voted on yet
        const result = await db.query(
            `SELECT l.id, l.amount_requested, u.full_name, l.purpose 
             FROM loan_applications l
             JOIN users u ON l.user_id = u.id
             WHERE l.status = 'TABLED' 
             AND l.user_id != $1 -- Cannot vote on own loan
             AND NOT EXISTS (SELECT 1 FROM votes v WHERE v.loan_application_id = l.id AND v.user_id = $1)`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Fetch error" });
    }
});

// 5. CAST VOTE
router.post('/vote', async (req, res) => {
    const { loanId, decision } = req.body; // decision = 'YES' or 'NO'
    try {
        const loan = await db.query("SELECT status, user_id FROM loan_applications WHERE id=$1", [loanId]);
        if (loan.rows.length === 0 || loan.rows[0].status !== 'TABLED') {
            return res.status(400).json({ error: "Voting closed or invalid loan" });
        }
        if (loan.rows[0].user_id === req.user.id) {
            return res.status(400).json({ error: "Cannot vote on your own loan" });
        }

        await db.query(
            "INSERT INTO votes (loan_application_id, user_id, vote) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
            [loanId, req.user.id, decision]
        );
        res.json({ message: "Vote cast successfully" });
    } catch (err) {
        res.status(500).json({ error: "Voting failed" });
    }
});

// --- SECRETARY ROUTES ---

// 6. GET AGENDA (Submitted Loans)
router.get('/agenda', requireRole('SECRETARY'), async (req, res) => {
    try {
        const result = await db.query(
            `SELECT l.id, l.amount_requested, l.purpose, l.repayment_weeks, u.full_name 
             FROM loan_applications l
             JOIN users u ON l.user_id = u.id
             WHERE l.status = 'SUBMITTED' ORDER BY l.created_at ASC`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Agenda Error" });
    }
});

// 7. TABLE A MOTION
router.post('/table', requireRole('SECRETARY'), validate(tableLoanSchema), async (req, res) => {
    try {
        await db.query("UPDATE loan_applications SET status='TABLED' WHERE id=$1", [req.body.loanId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to table" });
    }
});

// 8. APPROVE LOAN (After Voting)
router.post('/approve', requireRole('SECRETARY'), async (req, res) => {
    const { loanId } = req.body;
    try {
        // Count votes
        const voteRes = await db.query(
            "SELECT vote, COUNT(*) as count FROM votes WHERE loan_application_id = $1 GROUP BY vote",
            [loanId]
        );
        
        // Simple Logic: If YES > NO, approve. In production, check quorum.
        // For now, Secretary manually triggers this based on their view.
        await db.query("UPDATE loan_applications SET status='APPROVED' WHERE id=$1", [loanId]);
        res.json({ message: "Loan Approved! Sent to Treasurer." });
    } catch (err) {
        res.status(500).json({ error: "Approval Error" });
    }
});

// --- TREASURER ROUTES ---

// 9. GET DISBURSEMENT QUEUE (Now checks for APPROVED, not TABLED)
router.get('/treasury/queue', requireRole('TREASURER'), async (req, res) => {
    try {
        const result = await db.query(
            `SELECT l.id, l.amount_requested, l.repayment_weeks, l.purpose, u.full_name, u.phone_number,
             (SELECT COUNT(*) FROM votes v WHERE v.loan_application_id = l.id AND v.vote = 'YES') as yes_votes
             FROM loan_applications l
             JOIN users u ON l.user_id = u.id
             WHERE l.status = 'APPROVED' -- Critical Security Change
             ORDER BY l.created_at ASC`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Queue Error" });
    }
});

// 10. GET SACCO STATS (Correct Net Liquidity Logic)
router.get('/treasury/stats', requireRole('TREASURER'), async (req, res) => {
    try {
        const stats = await db.query(`
            SELECT 
                (SELECT COALESCE(SUM(amount), 0) FROM deposits WHERE status='COMPLETED') as savings,
                (SELECT COUNT(*) * 500 FROM loan_applications WHERE status != 'FEE_PENDING') as fees,
                (SELECT COALESCE(SUM(amount_repaid), 0) FROM loan_applications) as repaid,
                (SELECT COALESCE(SUM(amount_requested), 0) FROM loan_applications WHERE status IN ('ACTIVE', 'COMPLETED')) as disbursed
        `);
        
        const r = stats.rows[0];
        // Cash Available = (Income Sources) - (Cash Out)
        const liquidCapital = (parseFloat(r.savings) + parseFloat(r.fees) + parseFloat(r.repaid)) - parseFloat(r.disbursed);
        const totalAssets = parseFloat(r.disbursed); // Money currently out with members

        res.json({
            availableFunds: liquidCapital,
            totalDisbursed: totalAssets
        });
    } catch (err) {
        res.status(500).json({ error: "Stats Error" });
    }
});

// 11. DISBURSE FUNDS (With Liquidity Check)
router.post('/treasury/disburse', requireRole('TREASURER'), validate(disburseSchema), async (req, res) => {
    const { loanId } = req.body;
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');
        const check = await client.query("SELECT status, amount_requested FROM loan_applications WHERE id=$1", [loanId]);
        
        if (check.rows.length === 0) throw new Error("Loan not found");
        if (check.rows[0].status !== 'APPROVED') throw new Error("Loan not approved by members yet");

        const loanAmount = parseFloat(check.rows[0].amount_requested);

        // LIQUIDITY CHECK
        const stats = await client.query(`
            SELECT 
                (SELECT COALESCE(SUM(amount), 0) FROM deposits WHERE status='COMPLETED') as savings,
                (SELECT COUNT(*) * 500 FROM loan_applications WHERE status != 'FEE_PENDING') as fees,
                (SELECT COALESCE(SUM(amount_repaid), 0) FROM loan_applications) as repaid,
                (SELECT COALESCE(SUM(amount_requested), 0) FROM loan_applications WHERE status IN ('ACTIVE', 'COMPLETED')) as disbursed
        `);
        
        const r = stats.rows[0];
        const available = (parseFloat(r.savings) + parseFloat(r.fees) + parseFloat(r.repaid)) - parseFloat(r.disbursed);

        if (available < loanAmount) {
            throw new Error(`Insufficient Funds. Available: ${available}, Req: ${loanAmount}`);
        }

        // PROCESS
        await client.query("UPDATE loan_applications SET status='ACTIVE', updated_at=NOW() WHERE id=$1", [loanId]);
        await client.query(
            `INSERT INTO transactions (user_id, type, amount, reference_code) 
             VALUES ($1, 'LOAN_DISBURSEMENT', $2, $3)`,
            [req.user.id, loanAmount, `DISB-${loanId}-${Date.now()}`]
        );

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

module.exports = router;