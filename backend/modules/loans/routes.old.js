const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateUser, requireRole } = require('../auth/middleware');
const { validate, loanSubmitSchema, tableLoanSchema, disburseSchema } = require('../common/validation');
const { notifyUser, notifyAll } = require('../common/notify');
const { getSetting } = require('../settings/routes');

router.use(authenticateUser);

// --- 1. COMMON ROUTES ---

// GET MY LOAN STATUS
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

// START APPLICATION (Restored Fee Logic)
router.post('/init', async (req, res) => {
    try {
        const activeCheck = await db.query("SELECT id FROM loan_applications WHERE user_id = $1 AND status NOT IN ('REJECTED', 'COMPLETED') LIMIT 1", [req.user.id]);
        if(activeCheck.rows.length > 0) return res.status(400).json({ error: "Active application exists" });
        
        // UPDATE: Changed status to 'FEE_PENDING' and amount to 500
        const result = await db.query(
            "INSERT INTO loan_applications (user_id, status, fee_amount) VALUES ($1, 'FEE_PENDING', 500) RETURNING *", 
            [req.user.id]
        );
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: "Init failed" }); }
});

// SUBMIT DETAILS (Dynamic Limit Check)
router.post('/submit', validate(loanSubmitSchema), async (req, res) => {
    const { loanAppId, amount, purpose, repaymentWeeks } = req.body;
    try {
        const check = await db.query("SELECT user_id, status FROM loan_applications WHERE id=$1", [loanAppId]);
        if (check.rows.length === 0) return res.status(404).json({ error: "Not found" });
        if (check.rows[0].user_id !== req.user.id) return res.status(403).json({ error: "Unauthorized" });
        
        const savingsRes = await db.query("SELECT SUM(amount) as total FROM deposits WHERE user_id = $1 AND status = 'COMPLETED'", [req.user.id]);
        
        // DYNAMIC: Get multiplier from settings (default 3)
        const multiplierVal = await getSetting('loan_multiplier');
        const multiplier = parseFloat(multiplierVal) || 3;
        
        const maxLimit = (parseFloat(savingsRes.rows[0].total || 0)) * multiplier;
        
        if (parseInt(amount) > maxLimit) return res.status(400).json({ error: `Loan limit exceeded (Max ${multiplier}x Savings)` });

        await db.query("UPDATE loan_applications SET amount_requested=$1, purpose=$2, repayment_weeks=$3, status='PENDING_GUARANTORS' WHERE id=$4", [amount, purpose, repaymentWeeks, loanAppId]);
        res.json({ success: true });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: "Error submitting loan details" }); 
    }
});

// FINAL SUBMISSION (Dynamic Guarantor Check)
router.post('/final-submit', async (req, res) => {
    const { loanAppId } = req.body;
    try {
        // 1. Fetch dynamic setting (default 2)
        const settingVal = await getSetting('min_guarantors');
        const minGuarantors = parseInt(settingVal) || 2;

        // 2. Count accepted guarantors
        const guarantors = await db.query(
            "SELECT COUNT(*) FROM loan_guarantors WHERE loan_application_id=$1 AND status='ACCEPTED'", 
            [loanAppId]
        );
        
        const acceptedCount = parseInt(guarantors.rows[0].count);

        if (acceptedCount < minGuarantors) {
            return res.status(400).json({ 
                error: `You need at least ${minGuarantors} accepted guarantors to submit (Current: ${acceptedCount}).` 
            });
        }

        await db.query("UPDATE loan_applications SET status='SUBMITTED' WHERE id=$1", [loanAppId]);
        
        // Notify secretaries
        const secretaries = await db.query("SELECT id FROM users WHERE role='SECRETARY'");
        const notifications = secretaries.rows.map(s => 
            db.query("INSERT INTO notifications (user_id, message) VALUES ($1, $2)", [s.id, `📝 ACTION REQUIRED: New Loan Application #${loanAppId} is ready for tabling.`])
        );
        await Promise.all(notifications);
        
        res.json({ success: true });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: "Final submit failed" }); 
    }
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

// ADD GUARANTOR (Updated to Sync Database)
router.post('/guarantors/add', async (req, res) => {
    const { guarantorId, loanId } = req.body;
    try {
        // 1. Insert into the relational table (The Source of Truth)
        await db.query(
            "INSERT INTO loan_guarantors (loan_application_id, guarantor_id) VALUES ($1, $2)", 
            [loanId, guarantorId]
        );

        // 2. SYNC: Update the parent 'loan_applications' table
        // This subquery pulls all guarantor IDs for this loan and saves them into the array column
        await db.query(
            `UPDATE loan_applications 
             SET guarantor_ids = ARRAY(
                 SELECT guarantor_id FROM loan_guarantors 
                 WHERE loan_application_id = $1
             )
             WHERE id = $1`,
            [loanId]
        );

        // 3. Notify the guarantor
        const app = await db.query("SELECT full_name FROM users WHERE id=$1", [req.user.id]);
        await notifyUser(guarantorId, `🤝 GUARANTOR REQUEST: ${app.rows[0].full_name} has requested you to guarantee their loan #${loanId}.`);

        res.json({ success: true });
    } catch (err) { 
        if(err.code === '23505') return res.status(400).json({ error: "Guarantor already added" });
        console.error(err);
        res.status(500).json({ error: "Failed to add guarantor" }); 
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
        
        const loanId = check.rows[0].loan_application_id;
        const loan = await db.query("SELECT user_id FROM loan_applications WHERE id=$1", [loanId]);
        const msg = decision === 'ACCEPTED' ? `✅ A guarantor accepted your request for Loan #${loanId}.` : `❌ A guarantor declined your request for Loan #${loanId}.`;
        await notifyUser(loan.rows[0].user_id, msg);

        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Action failed" }); }
});



// --- ADMIN ROUTES ---

// NEW: Get All Loans (Registry)
router.get('/admin/all', requireRole('ADMIN'), async (req, res) => {
    try {
        const result = await db.query(
            `SELECT l.*, u.full_name 
             FROM loan_applications l 
             JOIN users u ON l.user_id = u.id 
             ORDER BY l.created_at DESC`
        );
        res.json(result.rows);
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: "Fetch error" }); 
    }
});

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
        await notifyAll(`📢 VOTING OPEN: The Chair has opened the floor for Loan #${loanId}.`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed to open voting" }); }
});

// --- VOTING ROUTES ---

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

// --- SECRETARY ROUTES ---

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
        const loanQuery = await db.query(`SELECT id FROM loan_applications WHERE id = $1`, [loanId]);
        if (loanQuery.rows.length === 0) return res.status(404).json({ error: "Loan not found" });
        
        await db.query("UPDATE loan_applications SET status='TABLED' WHERE id=$1", [loanId]);
        // Notify Admin/Chair
        const admins = await db.query("SELECT id FROM users WHERE role='ADMIN'");
        const notifications = admins.rows.map(a => 
             db.query("INSERT INTO notifications (user_id, message) VALUES ($1, $2)", [a.id, `⚖️ AGENDA: Loan #${loanId} has been tabled. Ready for voting floor.`])
        );
        await Promise.all(notifications);
        
        res.json({ success: true, message: "Loan tabled successfully." });
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
            return `📅 MEETING CALL\nDear ${fName},\n\nThe Secretary has scheduled the bi-weekly meeting.\n\n🗓 Date: ${meetingDate || "Next Thursday"}\n📍 Venue: Main Hall\n\nAGENDA:\n1. ${extraAgendas || "General Housekeeping"}\n2. LOAN APPLICATIONS:\n${loanAgenda}\n\nPlease log in to vote.`;
        });
        res.json({ success: true, message: "Meeting agenda sent." });
    } catch (err) { res.status(500).json({ error: "Failed to send notice" }); }
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
        const loan = await db.query("SELECT user_id FROM loan_applications WHERE id=$1", [loanId]);
        if (loan.rows.length === 0) return res.status(404).json({ error: "Not found" });
        const newStatus = decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
        await db.query("UPDATE loan_applications SET status=$1 WHERE id=$2", [newStatus, loanId]);
        const msg = decision === 'APPROVED' ? `✅ VOTE RESULT: Loan #${loanId} APPROVED.` : `❌ VOTE RESULT: Loan #${loanId} REJECTED.`;
        await notifyAll(msg);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Finalize Error" }); }
});

// --- TREASURER ROUTES ---

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

// --- NOTIFICATIONS ---

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