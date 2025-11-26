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

// UPDATED: Moves to PENDING_GUARANTORS instead of SUBMITTED
router.post('/submit', validate(loanSubmitSchema), async (req, res) => {
    const { loanAppId, amount, purpose, repaymentWeeks } = req.body;
    try {
        const check = await db.query("SELECT user_id, status FROM loan_applications WHERE id=$1", [loanAppId]);
        if (check.rows.length === 0) return res.status(404).json({ error: "Not found" });
        if (check.rows[0].user_id !== req.user.id) return res.status(403).json({ error: "Unauthorized" });
        
        // 3x Savings Rule
        const savingsRes = await db.query("SELECT SUM(amount) as total FROM deposits WHERE user_id = $1 AND status = 'COMPLETED'", [req.user.id]);
        const maxLimit = (parseFloat(savingsRes.rows[0].total || 0)) * 3;
        if (parseInt(amount) > maxLimit) return res.status(400).json({ error: "Loan limit exceeded (Max 3x Savings)" });

        // Update to PENDING_GUARANTORS
        await db.query("UPDATE loan_applications SET amount_requested=$1, purpose=$2, repayment_weeks=$3, status='PENDING_GUARANTORS' WHERE id=$4", [amount, purpose, repaymentWeeks, loanAppId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Error" }); }
});

// NEW: Finalize after guarantors
router.post('/final-submit', async (req, res) => {
    const { loanAppId } = req.body;
    try {
        // Check if at least 1 guarantor accepted (You can increase this limit)
        const guarantors = await db.query("SELECT COUNT(*) FROM loan_guarantors WHERE loan_application_id=$1 AND status='ACCEPTED'", [loanAppId]);
        if (parseInt(guarantors.rows[0].count) < 1) return res.status(400).json({ error: "At least 1 guarantor must accept before submission." });

        await db.query("UPDATE loan_applications SET status='SUBMITTED' WHERE id=$1", [loanAppId]);
        
        // Notify Secretary
        // Ideally you'd notify specific users with role='SECRETARY', simplified here:
        // await notifyAll("New Loan Application Submitted for Review"); 
        
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Final submit failed" }); }
});

// --- GUARANTOR ROUTES ---

router.get('/members/search', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.json([]);
    try {
        const result = await db.query(
            `SELECT id, full_name, phone_number FROM users 
             WHERE id != $1 AND (full_name ILIKE $2 OR phone_number ILIKE $2) LIMIT 5`,
            [req.user.id, `%${q}%`]
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Search failed" }); }
});

router.get('/guarantors', async (req, res) => {
    try {
        const loan = await db.query("SELECT id FROM loan_applications WHERE user_id = $1 AND status IN ('PENDING_GUARANTORS')", [req.user.id]);
        if (loan.rows.length === 0) return res.json([]);
        const result = await db.query(
            `SELECT g.id, u.full_name, g.status FROM loan_guarantors g JOIN users u ON g.guarantor_id = u.id WHERE g.loan_application_id = $1`,
            [loan.rows[0].id]
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Fetch failed" }); }
});

router.post('/guarantors/add', async (req, res) => {
    const { guarantorId, loanId } = req.body;
    try {
        await db.query("INSERT INTO loan_guarantors (loan_application_id, guarantor_id) VALUES ($1, $2)", [loanId, guarantorId]);
        
        // Get applicant name
        const app = await db.query("SELECT full_name FROM users WHERE id=$1", [req.user.id]);
        const applicantName = app.rows[0].full_name;

        await notifyUser(guarantorId, `🤝 GUARANTOR REQUEST: ${applicantName} has requested you to guarantee their loan #${loanId}. Please check your requests in the dashboard header.`);
        res.json({ success: true });
    } catch (err) { 
        if(err.code === '23505') return res.status(400).json({ error: "Already added" });
        res.status(500).json({ error: "Failed" }); 
    }
});

router.get('/guarantors/requests', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT g.id, u.full_name as applicant_name, l.amount_requested 
             FROM loan_guarantors g
             JOIN loan_applications l ON g.loan_application_id = l.id
             JOIN users u ON l.user_id = u.id
             WHERE g.guarantor_id = $1 AND g.status = 'PENDING'`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Fetch failed" }); }
});

router.post('/guarantors/respond', async (req, res) => {
    const { requestId, decision } = req.body; 
    try {
        const check = await db.query("SELECT loan_application_id FROM loan_guarantors WHERE id=$1 AND guarantor_id=$2", [requestId, req.user.id]);
        if (check.rows.length === 0) return res.status(403).json({ error: "Unauthorized" });

        await db.query("UPDATE loan_guarantors SET status=$1 WHERE id=$2", [decision, requestId]);
        
        // Notify Applicant
        const loanId = check.rows[0].loan_application_id;
        const loan = await db.query("SELECT user_id FROM loan_applications WHERE id=$1", [loanId]);
        const msg = decision === 'ACCEPTED' ? `✅ A guarantor accepted your request for Loan #${loanId}.` : `❌ A guarantor declined your request for Loan #${loanId}.`;
        await notifyUser(loan.rows[0].user_id, msg);

        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Action failed" }); }
});

// --- EXISTING ADMIN/SECRETARY ROUTES ---

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
    const { loanId } = req.body;
    try {
        const loanQuery = await db.query(
            `SELECT l.id, l.amount_requested, u.full_name as applicant_name 
             FROM loan_applications l
             JOIN users u ON l.user_id = u.id 
             WHERE l.id = $1`, 
            [loanId]
        );
        if (loanQuery.rows.length === 0) return res.status(404).json({ error: "Loan not found" });
        const loan = loanQuery.rows[0];
        await db.query("UPDATE loan_applications SET status='TABLED' WHERE id=$1", [loanId]);
        await notifyAll((recipient) => {
            return `📢 MEETING NOTICE\n\nDear ${recipient.full_name},\n\nA loan application has been submitted by ${loan.applicant_name} for review by the committee. It is now pending review and shall be reviewed in our next scheduled meeting.\n\nThank you,\nSecretary`;
        });
        res.json({ success: true, message: "Loan tabled and members notified." });
    } catch (err) { res.status(500).json({ error: "Failed to table loan" }); }
});

router.post('/secretary/announce-meeting', requireRole('SECRETARY'), async (req, res) => {
    const { meetingDate, extraAgendas } = req.body; 
    try {
        const tabledLoans = await db.query("SELECT l.id, u.full_name FROM loan_applications l JOIN users u ON l.user_id = u.id WHERE l.status = 'TABLED'");
        let loanAgenda = "None";
        if (tabledLoans.rows.length > 0) {
            loanAgenda = tabledLoans.rows.map(l => `- Review Loan #${l.id} (Applicant: ${l.full_name})`).join('\n');
        }
        await notifyAll((recipient) => {
            const fName = recipient.full_name.split(' ')[0]; 
            return `📅 MEETING CALL\nDear ${fName},\n\nThe Secretary has scheduled the bi-weekly meeting.\n\n🗓 Date: ${meetingDate || "Next Thursday"}\n📍 Venue: Main Hall (or Online)\n\nAGENDA:\n1. ${extraAgendas || "General Housekeeping"}\n2. LOAN APPLICATIONS:\n${loanAgenda}\n\nPlease log in to the portal to review documents before the vote.`;
        });
        res.json({ success: true, message: "Meeting agenda sent to all members." });
    } catch (err) { res.status(500).json({ error: "Failed to send meeting notice" }); }
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
        const msg = decision === 'APPROVED' ? `✅ VOTE RESULT: Loan #${loanId} APPROVED by membership.` : `❌ VOTE RESULT: Loan #${loanId} REJECTED by membership.`;
        await notifyAll(msg);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Finalize Error" }); }
});

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
        const stats = await db.query(`SELECT (SELECT COALESCE(SUM(amount), 0) FROM deposits WHERE status='COMPLETED') as savings, (SELECT COUNT(*) * 500 FROM loan_applications WHERE status != 'FEE_PENDING') as fees, (SELECT COALESCE(SUM(amount_repaid), 0) FROM loan_applications) as repaid, (SELECT COALESCE(SUM(amount_requested), 0) FROM loan_applications WHERE status IN ('ACTIVE', 'COMPLETED')) as disbursed`);
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
        const stats = await client.query(`SELECT (SELECT COALESCE(SUM(amount), 0) FROM deposits WHERE status='COMPLETED') as savings, (SELECT COUNT(*) * 500 FROM loan_applications WHERE status != 'FEE_PENDING') as fees, (SELECT COALESCE(SUM(amount_repaid), 0) FROM loan_applications) as repaid, (SELECT COALESCE(SUM(amount_requested), 0) FROM loan_applications WHERE status IN ('ACTIVE', 'COMPLETED')) as disbursed`);
        const r = stats.rows[0];
        const available = (parseFloat(r.savings) + parseFloat(r.fees) + parseFloat(r.repaid)) - parseFloat(r.disbursed);
        if (available < amount) throw new Error(`Insufficient Funds. Available: ${available}`);
        await client.query("UPDATE loan_applications SET status='ACTIVE', updated_at=NOW() WHERE id=$1", [loanId]);
        await client.query("INSERT INTO transactions (user_id, type, amount, reference_code) VALUES ($1, 'LOAN_DISBURSEMENT', $2, $3)", [req.user.id, amount, `DISB-${loanId}`]);
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); } finally { client.release(); }
});

router.get('/notifications', async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC", [req.user.id]);
        const twoWeeksAgo = new Date(); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        const unread = []; const history = []; const archive = [];
        result.rows.forEach(note => {
            const noteDate = new Date(note.created_at);
            if (!note.is_read) unread.push(note);
            else if (noteDate >= twoWeeksAgo) history.push(note);
            else archive.push(note);
        });
        res.json({ unread, history, archive });
    } catch (err) { res.status(500).json({ error: "Fetch failed" }); }
});

router.put('/notifications/:id/read', async (req, res) => {
    try { await db.query("UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]); res.json({ success: true }); } 
    catch (err) { res.status(500).json({ error: "Update failed" }); }
});

module.exports = router;