const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateUser, requireRole } = require('../auth/middleware');

// 1. GET DASHBOARD STATS & LOAN LIST
router.get('/dashboard-data', authenticateUser, requireRole('LOAN_OFFICER'), async (req, res) => {
    try {
        // 1. Fetch high-level stats
        const statsQuery = await db.query(`
            SELECT 
                COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
                COUNT(*) FILTER (WHERE status = 'APPROVED') as approved,
                COUNT(*) FILTER (WHERE status = 'ACTIVE') as active,
                COUNT(*) FILTER (WHERE status = 'REJECTED') as rejected
            FROM loan_applications
        `);
        const stats = statsQuery.rows[0];

        // 2. Fetch Loans with User Details
        // We join with users to get names
        const loansQuery = await db.query(`
            SELECT 
                l.id, l.amount_requested, l.purpose, l.status, l.created_at, 
                l.repayment_weeks, l.total_due, l.guarantor_ids,
                u.full_name, u.email, u.phone_number
            FROM loan_applications l
            JOIN users u ON l.user_id = u.id
            ORDER BY 
                CASE WHEN l.status = 'PENDING' THEN 1 
                     WHEN l.status = 'APPROVED' THEN 2 
                     ELSE 3 END, 
                l.created_at DESC
        `);

        res.json({
            stats: stats,
            loans: loansQuery.rows
        });

    } catch (err) {
        console.error("Loan Officer Dashboard Error:", err);
        res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
});

// 2. APPROVE OR REJECT LOAN
router.post('/review-loan', authenticateUser, requireRole('LOAN_OFFICER'), async (req, res) => {
    const { loanId, decision, reason } = req.body; // decision = 'APPROVED' or 'REJECTED'

    if (!['APPROVED', 'REJECTED'].includes(decision)) {
        return res.status(400).json({ error: "Invalid decision status" });
    }

    try {
        // Check current status
        const check = await db.query("SELECT status FROM loan_applications WHERE id = $1", [loanId]);
        if (check.rows.length === 0) return res.status(404).json({ error: "Loan not found" });
        
        if (check.rows[0].status !== 'PENDING' && check.rows[0].status !== 'FEE_PAID') {
            return res.status(400).json({ error: "Loan is not in a pending state." });
        }

        // Update Status
        await db.query(
            "UPDATE loan_applications SET status = $1, updated_at = NOW() WHERE id = $2",
            [decision, loanId]
        );

        // Optional: Log this action in a separate 'audit_logs' table if you have one
        
        res.json({ success: true, message: `Loan marked as ${decision}` });

    } catch (err) {
        console.error("Review Error:", err);
        res.status(500).json({ error: "Failed to update loan status" });
    }
});

module.exports = router;