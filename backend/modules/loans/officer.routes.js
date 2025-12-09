const express = require('express');
const router = express.Router();
const db = require('../../db');
const { requireRole } = require('../auth/middleware');
const { notifyUser } = require('../common/notify');

// VERIFY APPLICATION (Loan Officer Action)

router.get('/officer/applications', requireRole('LOAN_OFFICER'), async (req, res) => {
    try {
        const result = await db.query(
            `SELECT l.*, u.full_name 
             FROM loan_applications l 
             JOIN users u ON l.user_id = u.id 
             WHERE l.status IN ('SUBMITTED', 'PENDING_GUARANTORS', 'ACTIVE', 'VERIFIED')
             ORDER BY l.created_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Fetch error" });
    }
});
// Moves status from 'SUBMITTED' -> 'VERIFIED'
router.post('/officer/verify', requireRole('LOAN_OFFICER'), async (req, res) => {
    const { loanId } = req.body;
    try {
        // 1. Check current status
        const check = await db.query("SELECT user_id, status FROM loan_applications WHERE id=$1", [loanId]);
        if (check.rows.length === 0) return res.status(404).json({ error: "Loan not found" });
        
        if (check.rows[0].status !== 'SUBMITTED') {
            return res.status(400).json({ error: "Loan must be in SUBMITTED state to verify." });
        }

        // 2. Update Status
        await db.query("UPDATE loan_applications SET status='VERIFIED' WHERE id=$1", [loanId]);

        // 3. Notify Member
        await notifyUser(check.rows[0].user_id, `Your application #${loanId} has been verified by the Credit Officer and forwarded to the Secretary.`);

        res.json({ success: true, message: "Application verified successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Verification failed" });
    }
});

module.exports = router;