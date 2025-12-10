const express = require('express');
const router = express.Router();
const db = require('../../db');
const { notifyUser } = require('../common/notify');

// 1. SEARCH MEMBERS (For Applicant to find Guarantors)
router.get('/members/search', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.json([]);
    try {
        const result = await db.query(`SELECT id, full_name, phone_number FROM users WHERE id != $1 AND (full_name ILIKE $2 OR phone_number ILIKE $2) LIMIT 5`, [req.user.id, `%${q}%`]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Search failed" }); }
});

// 2. GET CURRENT GUARANTORS (For Applicant)
router.get('/guarantors', async (req, res) => {
    try {
        const loan = await db.query("SELECT id FROM loan_applications WHERE user_id = $1 AND status IN ('PENDING_GUARANTORS')", [req.user.id]);
        if (loan.rows.length === 0) return res.json([]);
        const result = await db.query(`SELECT g.id, u.full_name, g.status FROM loan_guarantors g JOIN users u ON g.guarantor_id = u.id WHERE g.loan_application_id = $1`, [loan.rows[0].id]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Fetch failed" }); }
});

// 3. ADD GUARANTOR (For Applicant)
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

// 4. GET REQUESTS (For Potential Guarantor)
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

// 5. RESPOND TO REQUEST (With Financial Liability Check)
router.post('/guarantors/respond', async (req, res) => {
    const { requestId, decision } = req.body; 
    
    // Only proceed with checks if they are accepting
    if (decision !== 'ACCEPTED' && decision !== 'REJECTED') {
        return res.status(400).json({ error: "Invalid decision" });
    }

    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Fetch Request & Loan Details
        const requestCheck = await client.query(
            `SELECT g.id, g.loan_application_id, g.guarantor_id, l.amount_requested, l.status as loan_status 
             FROM loan_guarantors g
             JOIN loan_applications l ON g.loan_application_id = l.id
             WHERE g.id = $1 AND g.guarantor_id = $2`,
            [requestId, req.user.id]
        );

        if (requestCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: "Request not found or unauthorized" });
        }

        const request = requestCheck.rows[0];
        const loanAmount = parseFloat(request.amount_requested);

        // 2. SAFETY CHECK: If Accepting, Check "Free Deposits"
        if (decision === 'ACCEPTED') {
            
            // A. Calculate My Total Savings
            const savingsRes = await client.query(
                "SELECT SUM(amount) as total FROM deposits WHERE user_id = $1 AND status = 'COMPLETED'",
                [req.user.id]
            );
            const totalSavings = parseFloat(savingsRes.rows[0].total || 0);

            // B. Calculate My Currently Locked Liability (Active Guarantees)
            // We sum amounts from OTHER loans where I am a guarantor AND the loan is Active/Approved
            const liabilityRes = await client.query(
                `SELECT SUM(g.amount_guaranteed) as locked
                 FROM loan_guarantors g
                 JOIN loan_applications l ON g.loan_application_id = l.id
                 WHERE g.guarantor_id = $1 
                 AND g.status = 'ACCEPTED' 
                 AND l.status IN ('ACTIVE', 'APPROVED', 'DISBURSED', 'IN_ARREARS')`,
                [req.user.id]
            );
            const currentLiability = parseFloat(liabilityRes.rows[0].locked || 0);

            // C. The Math
            const freeSavings = totalSavings - currentLiability;

            console.log(`[Risk Check] User: ${req.user.id} | Savings: ${totalSavings} | Locked: ${currentLiability} | Free: ${freeSavings} | Required: ${loanAmount}`);

            if (freeSavings < loanAmount) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    error: `Financial Risk: You cannot guarantee this loan.`,
                    details: `Your free savings (KES ${freeSavings.toLocaleString()}) are less than the loan amount (KES ${loanAmount.toLocaleString()}).`
                });
            }

            // D. Lock the Amount (Update amount_guaranteed)
            // We set the liability to the FULL loan amount for safety (Joint Liability)
            await client.query(
                "UPDATE loan_guarantors SET status=$1, amount_guaranteed=$2 WHERE id=$3", 
                [decision, loanAmount, requestId]
            );

        } else {
            // If rejecting, just update status
            await client.query(
                "UPDATE loan_guarantors SET status=$1 WHERE id=$2", 
                [decision, requestId]
            );
        }

        // 3. Sync Main Table (Update Array of Guarantors)
        // This keeps the array column in sync for quick lookups
        await client.query(
            `UPDATE loan_applications 
             SET guarantor_ids = ARRAY(
                 SELECT guarantor_id FROM loan_guarantors 
                 WHERE loan_application_id = $1 AND status = 'ACCEPTED'
             ) 
             WHERE id = $1`, 
            [request.loan_application_id]
        );

        // 4. Notify Applicant
        const loanRes = await client.query("SELECT user_id FROM loan_applications WHERE id=$1", [request.loan_application_id]);
        const applicantId = loanRes.rows[0].user_id;
        
        await notifyUser(applicantId, `Guarantor request ${decision} for Loan #${request.loan_application_id}.`);

        await client.query('COMMIT');
        res.json({ success: true, message: `Request ${decision}` });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Guarantor Response Error:", err);
        res.status(500).json({ error: "Action failed due to server error." });
    } finally {
        client.release();
    }
});

module.exports = router;