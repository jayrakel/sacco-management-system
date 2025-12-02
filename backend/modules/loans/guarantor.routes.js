const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateUser } = require('../auth/middleware');

// 1. GET INCOMING REQUESTS (People asking ME to be guarantor)
router.get('/requests', authenticateUser, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT g.id, l.amount_requested, u.full_name as applicant_name, g.status
            FROM loan_guarantors g
            JOIN loan_applications l ON g.loan_application_id = l.id
            JOIN users u ON l.user_id = u.id
            WHERE g.guarantor_id = $1 AND g.status = 'PENDING'
        `, [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch requests" });
    }
});

// 2. SEND REQUEST (I ask SOMEONE to be my guarantor)
router.post('/add', authenticateUser, async (req, res) => {
    const { loanId, guarantorId } = req.body;
    try {
        // Check self-guarantee
        if (parseInt(guarantorId) === req.user.id) return res.status(400).json({ error: "You cannot guarantee yourself" });

        // Check duplicate
        const exists = await db.query("SELECT * FROM loan_guarantors WHERE loan_application_id=$1 AND guarantor_id=$2", [loanId, guarantorId]);
        if (exists.rows.length > 0) return res.status(400).json({ error: "Already requested this member" });

        await db.query(
            "INSERT INTO loan_guarantors (loan_application_id, guarantor_id) VALUES ($1, $2)",
            [loanId, guarantorId]
        );
        res.json({ message: "Request sent" });
    } catch (err) {
        res.status(500).json({ error: "Failed to add guarantor" });
    }
});

// 3. RESPOND TO REQUEST (I Accept/Decline someone)
router.post('/respond', authenticateUser, async (req, res) => {
    const { requestId, decision } = req.body; // ACCEPTED or DECLINED
    try {
        await db.query(
            "UPDATE loan_guarantors SET status = $1 WHERE id = $2 AND guarantor_id = $3",
            [decision, requestId, req.user.id]
        );
        res.json({ message: "Response recorded" });
    } catch (err) {
        res.status(500).json({ error: "Failed to respond" });
    }
});

// 4. GET MY GUARANTORS (Who is guaranteeing ME?)
router.get('/', authenticateUser, async (req, res) => {
    try {
        // Finds the most recent active/pending application for this user
        const result = await db.query(`
            SELECT g.*, u.full_name 
            FROM loan_guarantors g
            JOIN users u ON g.guarantor_id = u.id
            JOIN loan_applications l ON g.loan_application_id = l.id
            WHERE l.user_id = $1 
            AND l.status IN ('PENDING_GUARANTORS', 'VERIFIED', 'APPROVED', 'ACTIVE')
            ORDER BY g.created_at DESC
        `, [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch your guarantors" });
    }
});

// 5. NEW: GET MY LIABILITIES (Loans I guaranteed for OTHERS)
router.get('/liabilities', authenticateUser, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                l.id as loan_id,
                l.amount_requested,
                l.amount_repaid,
                l.total_due,
                l.status as loan_status,
                u.full_name as borrower_name,
                g.status as my_decision
            FROM loan_guarantors g
            JOIN loan_applications l ON g.loan_application_id = l.id
            JOIN users u ON l.user_id = u.id
            WHERE g.guarantor_id = $1 AND g.status = 'ACCEPTED'
            ORDER BY l.created_at DESC
        `, [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch liabilities" });
    }
});

module.exports = router;