const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateUser } = require('../auth/middleware');

// GET ALL SETTINGS
router.get('/', authenticateUser, async (req, res) => {
    try {
        // Now fetching 'category' column as well
        const result = await db.query("SELECT * FROM system_settings ORDER BY category, setting_key ASC");
        res.json(result.rows); 
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch settings" });
    }
});

// UPDATE SETTING (Dynamic Permission based on Category)
router.post('/update', authenticateUser, async (req, res) => {
    const { key, value } = req.body;
    
    try {
        // 1. Fetch the setting to check its category
        const check = await db.query("SELECT category FROM system_settings WHERE setting_key = $1", [key]);
        if (check.rows.length === 0) return res.status(404).json({ error: "Setting not found" });

        const category = check.rows[0].category;
        const role = req.user.role;

        // 2. Enforce Separation of Duties
        let authorized = false;

        if (role === 'ADMIN' && category === 'SYSTEM') authorized = true;
        if (role === 'CHAIRPERSON' && category === 'SACCO') authorized = true;

        if (!authorized) {
            return res.status(403).json({ 
                error: `Access Denied: Only ${category === 'SYSTEM' ? 'System Admins' : 'the Chairperson'} can change this setting.` 
            });
        }

        // 3. Update
        await db.query("UPDATE system_settings SET setting_value = $1 WHERE setting_key = $2", [value, key]);
        res.json({ success: true });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Update failed" });
    }
});

// Helper
const getSetting = async (key) => {
    const res = await db.query("SELECT setting_value FROM system_settings WHERE setting_key = $1", [key]);
    return res.rows.length > 0 ? res.rows[0].setting_value : null;
};

module.exports = { router, getSetting };