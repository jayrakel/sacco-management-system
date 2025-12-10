const express = require('express');
const router = express.Router();
const db = require('../../db');

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

module.exports = router;