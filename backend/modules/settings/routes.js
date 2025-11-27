const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateUser, requireRole } = require('../auth/middleware');

// GET ALL SETTINGS
router.get('/', authenticateUser, async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM system_settings ORDER BY setting_key ASC");
        res.json(result.rows); 
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch settings" });
    }
});

// UPDATE SETTING (Upsert Logic)
router.post('/update', authenticateUser, requireRole('ADMIN'), async (req, res) => {
    const { key, value } = req.body;
    try {
        // UPSERT: Try to insert, if key exists, update the value
        await db.query(
            `INSERT INTO system_settings (setting_key, setting_value) 
             VALUES ($1, $2) 
             ON CONFLICT (setting_key) 
             DO UPDATE SET setting_value = EXCLUDED.setting_value`, 
            [key, String(value)]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Update failed" });
    }
});

// Helper for internal backend use
const getSetting = async (key) => {
    const res = await db.query("SELECT setting_value FROM system_settings WHERE setting_key = $1", [key]);
    return res.rows.length > 0 ? res.rows[0].setting_value : null;
};

module.exports = { router, getSetting };