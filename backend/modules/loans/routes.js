const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateUser, requireRole } = require('../auth/middleware');
const { validate, loanSubmitSchema, tableLoanSchema, disburseSchema } = require('../common/validation');
const { notifyUser, notifyAll } = require('../common/notify'); // Ensure you created this helper in Step 2 of previous turn

router.use(authenticateUser);

// --- 1. COMMON ROUTES ---

// GET MY STATUS
router.get('/status', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, status, fee_amount, amount_requested, amount_repaid, purpose, repayment_weeks 
             FROM loan_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
            [req.user.id]
        );
        if (result.rows.length === 0) return res.json({ status: 'NO_APP' });
        
        const loan = result.rows[0];
        loan.amount_requested = parseFloat(loan.amount_requested || 0);
        loan.amount_repaid = parseFloat(loan.amount_repaid || 0);
        res.json(loan);
    } catch (err) { res.status(500).json({ error: "Server Error" }); }
});

// INIT APPLICATION
router.post('/init', async (req, res) => {
    try {
        const activeCheck = await db.query("SELECT id FROM loan_applications WHERE user_id = $1 AND status NOT IN ('REJECTED', 'COMPLETED') LIMIT 1", [req.user.id]);
        if(activeCheck.rows.length > 0) return res.status(400).json({ error: "Active application exists" });
        const result = await db.query("INSERT INTO loan_applications (user_id, status, fee_amount) VALUES ($1, 'FEE_PENDING', 500) RETURNING *", [req.user.id]);
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: "Init failed" }); }
});

// SUBMIT APPLICATION
router.post('/submit', validate(loanSubmitSchema), async (req, res) => {
    const { loanAppId, amount, purpose, repaymentWeeks } = req.body;
    try {
        const check = await db.query("SELECT user_id, status FROM loan_applications WHERE id=$1", [loanAppId]);
        if (check.rows.length === 0) return res.status(404).json({ error: "Not found" });
        if (check.rows[0].user_id !== req.user.id) return res.status(403).json({ error: "Unauthorized" });
        if (check.rows[0].status !== 'FEE_PAID') return res.status(400).json({ error: "Fee not paid" });
        
        // 3x Savings Rule
        const savingsRes = await db.query("SELECT SUM(amount) as total FROM deposits WHERE user_id = $1 AND status = 'COMPLETED'", [req.user.id]);
        const maxLimit = (parseFloat(savingsRes.rows[0].total || 0)) * 3;
        if (parseInt(amount) > maxLimit) return res.status(400).json({ error: "Loan limit exceeded (Max 3x Savings)" });

        await db.query("UPDATE loan_applications SET amount_requested=$1, purpose=$2, repayment_weeks=$3, status='SUBMITTED' WHERE id=$4", [amount, purpose, repaymentWeeks, loanAppId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Error" }); }
});

// --- 2. ADMIN ROUTES (The Chairperson) ---

// GET TABLED MOTIONS (For Admin to Open Voting)
router.get('/admin/agenda', requireRole('ADMIN'), async (req, res) => {
    try {
        const result = await db.query(
            `SELECT l.id, l.amount_requested, u.full_name, l.purpose 
             FROM loan_applications l
             JOIN users u ON l.user_id = u.id
             WHERE l.status = 'TABLED' ORDER BY l.created_at ASC`
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Fetch error" }); }
});

// OPEN VOTING
router.post('/admin/open-voting', requireRole('ADMIN'), async (req, res) => {
    const { loanId } = req.body;
    try {
        await db.query("UPDATE loan_applications SET status='VOTING' WHERE id=$1", [loanId]);
        await notifyAll(`📢 AGM NOTICE: Voting is now OPEN for Loan Application #${loanId}. Please cast your vote immediately.`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed to open voting" }); }
});

// --- 3. MEMBER VOTING ---

router.get('/vote/open', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT l.id, l.amount_requested, u.full_name, l.purpose 
             FROM loan_applications l
             JOIN users u ON l.user_id = u.id
             WHERE l.status = 'VOTING' AND l.user_id != $1
             AND NOT EXISTS (SELECT 1 FROM votes v WHERE v.loan_application_id = l.id AND v.user_id = $1)`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Fetch error" }); }
});

router.post('/vote', async (req, res) => {
    const { loanId, decision } = req.body;
    try {
        const loan = await db.query("SELECT status, user_id FROM loan_applications WHERE id=$1", [loanId]);
        if (loan.rows.length === 0 || loan.rows[0].status !== 'VOTING') return res.status(400).json({ error: "Voting closed" });
        if (loan.rows[0].user_id === req.user.id) return res.status(400).json({ error: "Cannot vote on own loan" });

        await db.query("INSERT INTO votes (loan_application_id, user_id, vote) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [loanId, req.user.id, decision]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Vote failed" }); }
});

// --- 4. SECRETARY ROUTES ---

router.get('/agenda', requireRole('SECRETARY'), async (req, res) => {
    try {
        const result = await db.query(
            `SELECT l.id, l.amount_requested, l.purpose, l.repayment_weeks, u.full_name 
             FROM loan_applications l
             JOIN users u ON l.user_id = u.id
             WHERE l.status = 'SUBMITTED' ORDER BY l.created_at ASC`
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Agenda Error" }); }
});

router.post('/table', requireRole('SECRETARY'), validate(tableLoanSchema), async (req, res) => {
    try {
        await db.query("UPDATE loan_applications SET status='TABLED' WHERE id=$1", [req.body.loanId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed to table" }); }
});

router.get('/secretary/live-tally', requireRole('SECRETARY'), async (req, res) => {
    try {
        const result = await db.query(
            `SELECT l.id, u.full_name, l.amount_requested, l.status,
             COUNT(CASE WHEN v.vote = 'YES' THEN 1 END) as yes_votes,
             COUNT(CASE WHEN v.vote = 'NO' THEN 1 END) as no_votes
             FROM loan_applications l
             JOIN users u ON l.user_id = u.id
             LEFT JOIN votes v ON l.id = v.loan_application_id
             WHERE l.status IN ('TABLED', 'VOTING')
             GROUP BY l.id, u.full_name, l.amount_requested, l.status`
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Tally Error" }); }
});

router.post('/secretary/finalize', requireRole('SECRETARY'), async (req, res) => {
    const { loanId, decision } = req.body;
    try {
        const loan = await db.query("SELECT user_id, amount_requested FROM loan_applications WHERE id=$1", [loanId]);
        if (loan.rows.length === 0) return res.status(404).json({ error: "Not found" });
        
        const newStatus = decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
        await db.query("UPDATE loan_applications SET status=$1 WHERE id=$2", [newStatus, loanId]);
        
        // Notifications
        const msg = decision === 'APPROVED' 
            ? `✅ RESULTS: Loan #${loanId} for KES ${loan.rows[0].amount_requested} was APPROVED.` 
            : `❌ RESULTS: Loan #${loanId} was REJECTED by members.`;
        
        await notifyAll(msg);
        
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Finalize Error" }); }
});

// --- 5. TREASURER ROUTES ---

router.get('/treasury/queue', requireRole('TREASURER'), async (req, res) => {
    try {
        const result = await db.query(
            `SELECT l.id, l.amount_requested, l.repayment_weeks, l.purpose, u.full_name, u.phone_number,
             (SELECT COUNT(*) FROM votes v WHERE v.loan_application_id = l.id AND v.vote = 'YES') as yes_votes
             FROM loan_applications l
             JOIN users u ON l.user_id = u.id
             WHERE l.status = 'APPROVED' ORDER BY l.created_at ASC`
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Queue Error" }); }
});

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
        const liquid = (parseFloat(r.savings) + parseFloat(r.fees) + parseFloat(r.repaid)) - parseFloat(r.disbursed);
        res.json({ availableFunds: liquid, totalDisbursed: parseFloat(r.disbursed) });
    } catch (err) { res.status(500).json({ error: "Stats Error" }); }
});

router.post('/treasury/disburse', requireRole('TREASURER'), validate(disburseSchema), async (req, res) => {
    const { loanId } = req.body;
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const check = await client.query("SELECT status, amount_requested FROM loan_applications WHERE id=$1", [loanId]);
        if (check.rows.length === 0 || check.rows[0].status !== 'APPROVED') throw new Error("Invalid loan");
        
        const amount = parseFloat(check.rows[0].amount_requested);
        
        // Liquidity Check
        const stats = await client.query(`
            SELECT 
                (SELECT COALESCE(SUM(amount), 0) FROM deposits WHERE status='COMPLETED') as savings,
                (SELECT COUNT(*) * 500 FROM loan_applications WHERE status != 'FEE_PENDING') as fees,
                (SELECT COALESCE(SUM(amount_repaid), 0) FROM loan_applications) as repaid,
                (SELECT COALESCE(SUM(amount_requested), 0) FROM loan_applications WHERE status IN ('ACTIVE', 'COMPLETED')) as disbursed
        `);
        const r = stats.rows[0];
        const available = (parseFloat(r.savings) + parseFloat(r.fees) + parseFloat(r.repaid)) - parseFloat(r.disbursed);
        
        if (available < amount) throw new Error(`Insufficient Funds. Available: ${available}`);

        await client.query("UPDATE loan_applications SET status='ACTIVE', updated_at=NOW() WHERE id=$1", [loanId]);
        await client.query("INSERT INTO transactions (user_id, type, amount, reference_code) VALUES ($1, 'LOAN_DISBURSEMENT', $2, $3)", [req.user.id, amount, `DISB-${loanId}`]);
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); } finally { client.release(); }
});

// --- 6. NOTIFICATIONS ---
router.get('/notifications', async (req, res) => {
    const result = await db.query("SELECT * FROM notifications WHERE user_id = $1 OR user_id IS NULL ORDER BY created_at DESC LIMIT 5", [req.user.id]);
    res.json(result.rows);
});

module.exports = router;