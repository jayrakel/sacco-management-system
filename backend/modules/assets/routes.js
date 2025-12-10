const express = require('express');
const { authenticateUser, authorizeRoles } = require('../auth/middleware');
const db = require('../../db');
const router = express.Router();

// Get All Assets
router.get('/', authenticateUser, async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM fixed_assets WHERE status = 'ACTIVE' ORDER BY purchase_date DESC");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add New Asset
router.post('/', authenticateUser, authorizeRoles('ADMIN', 'TREASURER'), async (req, res) => {
    try {
        const { asset_name, asset_type, purchase_date, purchase_cost, current_valuation, location, description } = req.body;
        
        const result = await db.query(
            `INSERT INTO fixed_assets (asset_name, asset_type, purchase_date, purchase_cost, current_valuation, location, description)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [asset_name, asset_type, purchase_date, purchase_cost, current_valuation, location, description]
        );
        
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Asset Valuation (Revaluation)
router.put('/:id/revalue', authenticateUser, authorizeRoles('ADMIN', 'TREASURER'), async (req, res) => {
    try {
        const { id } = req.params;
        const { new_value, notes } = req.body;

        // 1. Update main table
        await db.query("UPDATE fixed_assets SET current_valuation = $1, updated_at = NOW() WHERE id = $2", [new_value, id]);

        // 2. Keep history
        await db.query(
            "INSERT INTO asset_valuations (asset_id, amount, valued_by, notes) VALUES ($1, $2, $3, $4)",
            [id, new_value, req.user.full_name || req.user.email, notes]
        );

        res.json({ message: "Asset revalued successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;