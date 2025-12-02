const express = require('express');
const router = express.Router();
const db = require('../../db');
const { notifyUser } = require('../common/notify');

router.get('/members/search', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.json([]);
    try {
        const result = await db.query(`SELECT id, full_name, phone_number FROM users WHERE id != $1 AND (full_name ILIKE $2 OR phone_number ILIKE $2) LIMIT 5`, [req.user.id, `%${q}%`]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Search failed" }); }
});

router.get('/guarantors', async (req, res) => {
    try {
        const loan = await db.query("SELECT id FROM loan_applications WHERE user_id = $1 AND status IN ('PENDING_GUARANTORS')", [req.user.id]);
        if (loan.rows.length === 0) return res.json([]);
        const result = await db.query(`SELECT g.id, u.full_name, g.status FROM loan_guarantors g JOIN users u ON g.guarantor_id = u.id WHERE g.loan_application_id = $1`, [loan.rows[0].id]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Fetch failed" }); }
});

router.post('/guarantors/add', async (req, res) => {
    const { guarantorId, loanId } = req.body;
    try {
        await db.query("INSERT INTO loan_guarantors (loan_application_id, guarantor_id) VALUES ($1, $2)", [loanId, guarantorId]);
        // Update main table array
        await db.query(`UPDATE loan_applications SET guarantor_ids = ARRAY(SELECT guarantor_id FROM loan_guarantors WHERE loan_application_id = $1) WHERE id = $1`, [loanId]);
        
        const app = await db.query("SELECT full_name FROM users WHERE id=$1", [req.user.id]);
        await notifyUser(guarantorId, `🤝 Request: ${app.rows[0].full_name} needs a guarantor (Loan #${loanId}).`);
        res.json({ success: true });
    } catch (err) { 
        if(err.code === '23505') return res.status(400).json({ error: "Already added" });
        res.status(500).json({ error: "Failed" }); 
    }
});

router.get('/guarantors/requests', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT g.id, u.full_name as applicant_name, l.amount_requested FROM loan_guarantors g
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
        // Sync main table
        const loanId = check.rows[0].loan_application_id;
        await db.query(`UPDATE loan_applications SET guarantor_ids = ARRAY(SELECT guarantor_id FROM loan_guarantors WHERE loan_application_id = $1) WHERE id = $1`, [loanId]);

        const loan = await db.query("SELECT user_id FROM loan_applications WHERE id=$1", [loanId]);
        await notifyUser(loan.rows[0].user_id, `Guarantor request ${decision} for Loan #${loanId}.`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Action failed" }); }
});

module.exports = router;