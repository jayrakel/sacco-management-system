const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateUser, requireRole } = require('../auth/middleware');

// GET ALL SETTINGS (Accessible by ALL Authenticated Users)
// Removed requireRole('ADMIN') so members can see the multiplier
router.get('/', authenticateUser, async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM system_settings");
        // Convert array to object for easier lookup { key: value }
        const settings = {};
        result.rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });
        res.json(settings);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch settings" });
    }
});

// UPDATE SETTING (Restricted to ADMIN only)
router.post('/update', authenticateUser, requireRole('ADMIN'), async (req, res) => {
    const { key, value } = req.body;
    try {
        await db.query("UPDATE system_settings SET setting_value = $1 WHERE setting_key = $2", [value, key]);
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