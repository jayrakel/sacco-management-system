const express = require('express');
const router = express.Router();
const db = require('../../db');
const { requireRole } = require('../auth/middleware');
const { validate, tableLoanSchema } = require('../common/validation');
const { notifyAll, notifyUser } = require('../common/notify');

router.get('/agenda', requireRole('SECRETARY'), async (req, res) => {
    try {
        const result = await db.query(
            `SELECT l.id, l.amount_requested, l.purpose, l.repayment_weeks, u.full_name 
             FROM loan_applications l
             JOIN users u ON l.user_id = u.id
             WHERE l.status = 'VERIFIED'
             ORDER BY l.created_at ASC`
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Agenda Error" }); }
});

router.post('/table', requireRole('SECRETARY'), validate(tableLoanSchema), async (req, res) => {
    const { loanId } = req.body;
    try {
        const check = await db.query("SELECT status FROM loan_applications WHERE id=$1", [loanId]);
        if(check.rows[0].status !== 'VERIFIED') return res.status(400).json({ error: "Loan must be Verified first" });

        await db.query("UPDATE loan_applications SET status='TABLED' WHERE id=$1", [loanId]);
        const admins = await db.query("SELECT id FROM users WHERE role='ADMIN'");
        await Promise.all(admins.rows.map(a => notifyUser(a.id, `⚖️ AGENDA: Loan #${loanId} tabled for voting.`)));
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed to table loan" }); }
});

router.post('/secretary/announce-meeting', requireRole('SECRETARY'), async (req, res) => {
    const { meetingDate, extraAgendas } = req.body; 
    try {
        await notifyAll(`📅 MEETING CALL: ${meetingDate || "Next Thursday"}. Agenda: ${extraAgendas}`);
        res.json({ success: true });
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
        const newStatus = decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
        await db.query("UPDATE loan_applications SET status=$1 WHERE id=$2", [newStatus, loanId]);
        await notifyAll(`📢 RESULT: Loan #${loanId} has been ${newStatus}.`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Finalize Error" }); }
});

// NEW: Full Loan Registry for Minutes/Reporting
router.get('/secretary/registry', requireRole('SECRETARY'), async (req, res) => {
    try {
        const result = await db.query(
            `SELECT l.id, l.amount_requested, l.purpose, l.status, l.created_at, l.disbursed_at,
                    u.full_name 
             FROM loan_applications l
             JOIN users u ON l.user_id = u.id
             ORDER BY l.created_at DESC`
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Registry Error" }); }
});

module.exports = router;