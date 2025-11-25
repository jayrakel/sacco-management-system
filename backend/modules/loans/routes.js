const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateUser, requireRole } = require('../auth/middleware');
const { validate, loanSubmitSchema, tableLoanSchema, disburseSchema } = require('../common/validation');
const { notifyUser, notifyAll } = require('../common/notify');

router.use(authenticateUser);

// --- 1. COMMON ROUTES ---

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

router.post('/init', async (req, res) => {
    try {
        const activeCheck = await db.query("SELECT id FROM loan_applications WHERE user_id = $1 AND status NOT IN ('REJECTED', 'COMPLETED') LIMIT 1", [req.user.id]);
        if(activeCheck.rows.length > 0) return res.status(400).json({ error: "Active application exists" });
        const result = await db.query("INSERT INTO loan_applications (user_id, status, fee_amount) VALUES ($1, 'FEE_PENDING', 500) RETURNING *", [req.user.id]);
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: "Init failed" }); }
});

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

router.post('/admin/open-voting', requireRole('ADMIN'), async (req, res) => {
    const { loanId } = req.body;
    try {
        await db.query("UPDATE loan_applications SET status='VOTING' WHERE id=$1", [loanId]);
        await notifyAll(`📢 VOTING OPEN: The Chair has opened the floor. Please cast your vote for Loan #${loanId} now.`);
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

// GET PENDING (SUBMITTED) LOANS FOR TABLING
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

// ACTION 1: TABLE MOTION (Immediate Notification)
router.post('/table', requireRole('SECRETARY'), validate(tableLoanSchema), async (req, res) => {
    const { loanId } = req.body;
    try {
        // 1. Get Loan & Applicant Details
        const loanQuery = await db.query(
            `SELECT l.id, l.amount_requested, u.full_name as applicant_name 
             FROM loan_applications l
             JOIN users u ON l.user_id = u.id 
             WHERE l.id = $1`, 
            [loanId]
        );

        if (loanQuery.rows.length === 0) return res.status(404).json({ error: "Loan not found" });
        const loan = loanQuery.rows[0];

        // 2. Update Status
        await db.query("UPDATE loan_applications SET status='TABLED' WHERE id=$1", [loanId]);
        
        // 3. SEND IMMEDIATE NOTIFICATION (Text-based with newlines)
        await notifyAll((recipient) => {
            return `📢 MEETING NOTICE

Dear ${recipient.full_name},

A loan application number ${loan.id} has been submitted by ${loan.applicant_name} for review by the committee. It is now pending review and shall be discussed in our next scheduled meeting.

Thank you,
Secretary`;
        });
        
        res.json({ success: true, message: "Loan tabled and members notified." });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: "Failed to table loan" }); 
    }
});

// ACTION 2: CALL MEETING (Later Notification)
router.post('/secretary/announce-meeting', requireRole('SECRETARY'), async (req, res) => {
    const { meetingDate, extraAgendas } = req.body; 

    try {
        // 1. Get all tabled loans to include in the agenda automatically
        const tabledLoans = await db.query(
            `SELECT l.id, u.full_name 
             FROM loan_applications l 
             JOIN users u ON l.user_id = u.id 
             WHERE l.status = 'TABLED'`
        );

        // Build the Loan Agenda list
        let loanAgenda = "None";
        if (tabledLoans.rows.length > 0) {
            loanAgenda = tabledLoans.rows.map(l => `- Review Loan #${l.id} (Applicant: ${l.full_name})`).join('\n');
        }

        // 2. SEND DETAILED MEETING NOTICE (Dynamic)
        await notifyAll((recipient) => {
            const fName = recipient.full_name.split(' ')[0]; // Get first name

            return `📅 MEETING CALL
Dear ${fName},

The Secretary has scheduled the bi-weekly meeting.

🗓 Date: ${meetingDate || "Next Thursday"}
📍 Venue: Main Hall (or Online)

AGENDA:
1. ${extraAgendas || "General Housekeeping"}
2. LOAN APPLICATIONS:
${loanAgenda}

Please log in to the portal to review documents before the vote.`;
        });

        res.json({ success: true, message: "Meeting agenda sent to all members." });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to send meeting notice" });
    }
});

// GET LIVE TALLY
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

// FINALIZE VOTE
router.post('/secretary/finalize', requireRole('SECRETARY'), async (req, res) => {
    const { loanId, decision } = req.body;
    try {
        const loan = await db.query("SELECT user_id, amount_requested FROM loan_applications WHERE id=$1", [loanId]);
        if (loan.rows.length === 0) return res.status(404).json({ error: "Not found" });
        
        const newStatus = decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
        await db.query("UPDATE loan_applications SET status=$1 WHERE id=$2", [newStatus, loanId]);
        
        const msg = decision === 'APPROVED' 
            ? `✅ VOTE RESULT: Loan #${loanId} APPROVED by membership.` 
            : `❌ VOTE RESULT: Loan #${loanId} REJECTED by membership.`;
        
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