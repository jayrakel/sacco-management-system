// backend/modules/management/routes.js
const express = require('express');
const { authenticateUser, authorizeRoles } = require('../auth/middleware');
const db = require('../../db');
const router = express.Router();

// --- ASSETS ---
router.get('/assets', authenticateUser, async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM fixed_assets WHERE status = 'ACTIVE' ORDER BY created_at DESC");
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/assets', authenticateUser, authorizeRoles('ADMIN', 'TREASURER', 'CHAIRPERSON'), async (req, res) => {
    try {
        const { name, type, value, location } = req.body;
        // Initial current_value equals purchase_value
        await db.query(
            "INSERT INTO fixed_assets (name, type, purchase_value, current_value, location) VALUES ($1, $2, $3, $3, $4)",
            [name, type, value, location]
        );
        res.json({ message: "Asset added" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- EXPENSES & DEPRECIATION ---
router.get('/expenses', authenticateUser, async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM operational_expenses ORDER BY expense_date DESC");
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/expenses', authenticateUser, authorizeRoles('ADMIN', 'TREASURER', 'CHAIRPERSON', 'SECRETARY'), async (req, res) => {
    try {
        const { title, category, amount, description } = req.body;
        await db.query(
            "INSERT INTO operational_expenses (title, category, amount, description, incurred_by) VALUES ($1, $2, $3, $4, $5)",
            [title, category, amount, description, req.user.id]
        );
        
        // Handle Depreciation Logic (Automatic Asset Value Reduction)
        if (category === 'DEPRECIATION' && req.body.assetId) {
            await db.query("UPDATE fixed_assets SET current_value = current_value - $1 WHERE id = $2", [amount, req.body.assetId]);
        }

        res.json({ message: "Expense recorded" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;