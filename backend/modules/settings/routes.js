const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateUser, requireRole } = require('../auth/middleware');

// GET ALL SETTINGS
// Authenticated users can read settings (Admin needs list, Member needs values)
router.get('/', authenticateUser, async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM system_settings ORDER BY setting_key ASC");
        // FIX: Return the raw array (rows) so Admin Dashboard can map() over it
        // and access the 'description' field.
        res.json(result.rows); 
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