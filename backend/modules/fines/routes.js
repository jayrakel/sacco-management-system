const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateUser, authorizeRoles } = require('../auth/middleware');

// --- HELPER: APPLY INTEREST RULES ---
const applyInterestRules = async (fine) => {
    if (fine.status === 'CLEARED') return fine;

    const now = new Date();
    const created = new Date(fine.date_created);
    const daysSinceCreation = Math.floor((now - created) / (1000 * 60 * 60 * 24));
    
    let updated = false;
    let newBalance = parseFloat(fine.current_balance);
    let newStage = fine.interest_stage;
    let dateStage1 = fine.date_stage_1_applied;
    let dateStage2 = fine.date_stage_2_applied;

    // RULE 1: Stage 1 (After 30 Days) - 20% Interest
    if (fine.interest_stage === 'NONE' && daysSinceCreation > 30) {
        // Apply 20% on ORIGINAL amount
        const interest = parseFloat(fine.original_amount) * 0.20;
        newBalance += interest;
        newStage = 'STAGE_1_20';
        dateStage1 = now.toISOString();
        updated = true;
    }

    // RULE 2: Stage 2 (1 Year after Stage 1) - 50% Interest
    if (newStage === 'STAGE_1_20' && dateStage1) {
        const stage1Date = new Date(dateStage1);
        const daysSinceStage1 = Math.floor((now - stage1Date) / (1000 * 60 * 60 * 24));

        if (daysSinceStage1 > 365) {
            // Apply 50% on CURRENT balance (Compound)
            const interest = newBalance * 0.50;
            newBalance += interest;
            newStage = 'STAGE_2_50';
            dateStage2 = now.toISOString();
            updated = true;
        }
    }

    // Update DB if changes occurred
    if (updated) {
        await db.query(
            `UPDATE member_fines 
             SET current_balance = $1, interest_stage = $2, date_stage_1_applied = $3, date_stage_2_applied = $4 
             WHERE id = $5`,
            [newBalance, newStage, dateStage1, dateStage2, fine.id]
        );
        fine.current_balance = newBalance;
        fine.interest_stage = newStage;
    }

    return fine;
};

// GET MY FINES (Auto-updates interest)
router.get('/my-fines', authenticateUser, async (req, res) => {
    try {
        const result = await db.query(
            "SELECT * FROM member_fines WHERE user_id = $1 AND status != 'CLEARED' ORDER BY date_created ASC",
            [req.user.id]
        );
        
        // Process rules for each fine
        const processedFines = await Promise.all(result.rows.map(f => applyInterestRules(f)));
        
        res.json(processedFines);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch fines" });
    }
});

// ADMIN: IMPOSE FINE
router.post('/impose', authenticateUser, authorizeRoles('ADMIN', 'SECRETARY', 'CHAIRPERSON'), async (req, res) => {
    const { userId, title, amount, description } = req.body;
    try {
        await db.query(
            `INSERT INTO member_fines (user_id, title, original_amount, current_balance, description)
             VALUES ($1, $2, $3, $3, $4)`,
            [userId, title, amount, description]
        );
        res.json({ message: "Fine imposed successfully" });
    } catch (err) {
        res.status(500).json({ error: "Failed to impose fine" });
    }
});

module.exports = router;