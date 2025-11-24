const express = require('express');
const router = express.Router();
const db = require('../../db'); // Import shared DB

// GET STATUS
router.get('/status', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, status, fee_amount FROM loan_applications 
             WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
            [req.user.id]
        );
        if (result.rows.length === 0) return res.json({ status: 'NO_APP' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Loan Module Error" });
    }
});

// START APPLICATION
router.post('/init', async (req, res) => {
    try {
        // Ensure user exists (Mock setup)
        await db.query(`INSERT INTO users (id, full_name, email, phone_number, password_hash) 
            VALUES (1, 'Test User', 't@t.com', '000', 'hash') ON CONFLICT (id) DO NOTHING`);

        const result = await db.query(
            `INSERT INTO loan_applications (user_id, status) 
             VALUES ($1, 'FEE_PENDING') RETURNING *`,
            [req.user.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to init loan" });
    }
});

// SUBMIT FORM
router.post('/submit', async (req, res) => {
    const { loanAppId, amount, purpose, duration } = req.body;
    try {
        const check = await db.query("SELECT status FROM loan_applications WHERE id=$1", [loanAppId]);
        
        if (check.rows.length === 0) return res.status(404).send("Not found");
        if (check.rows[0].status !== 'FEE_PAID') return res.status(400).send("Fee not paid");

        await db.query(
            `UPDATE loan_applications 
             SET amount_requested=$1, purpose=$2, repayment_months=$3, status='SUBMITTED' 
             WHERE id=$4`,
            [amount, purpose, duration, loanAppId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).send("Error submitting form");
    }
});

module.exports = router;