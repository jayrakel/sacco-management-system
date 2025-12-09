const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateUser } = require('../auth/middleware');

// --- NEW: Public Branding Route (No Auth Required) ---
router.get('/branding', async (req, res) => {
    try {
        const result = await db.query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('sacco_logo', 'sacco_favicon', 'sacco_name')");
        res.json(result.rows);
    } catch (err) {
        console.error("Branding fetch failed", err);
        res.status(500).json({ error: "Failed to fetch branding" });
    }
});

// GET ALL SETTINGS (Authenticated)
router.get('/', authenticateUser, async (req, res) => {
    try {
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
        const check = await db.query("SELECT category FROM system_settings WHERE setting_key = $1", [key]);
        if (check.rows.length === 0) return res.status(404).json({ error: "Setting not found" });

        const category = check.rows[0].category;
        const role = req.user.role;

        let authorized = false;
        if (role === 'ADMIN' && category === 'SYSTEM') authorized = true;
        if (role === 'CHAIRPERSON' && category === 'SACCO') authorized = true;

        if (!authorized) {
            return res.status(403).json({ 
                error: `Access Denied: Only ${category === 'SYSTEM' ? 'System Admins' : 'the Chairperson'} can change this setting.` 
            });
        }

        await db.query("UPDATE system_settings SET setting_value = $1 WHERE setting_key = $2", [value, key]);
        res.json({ success: true });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Update failed" });
    }
});

// --- NEW: Custom Contribution Categories ---

// Get Categories (For Dropdowns)
router.get('/categories', authenticateUser, async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM contribution_categories WHERE is_active = TRUE ORDER BY name ASC");
        res.json(result.rows);
    } catch (err) {
        console.error("Failed to fetch categories:", err);
        res.status(500).json({ error: "Failed to fetch categories" });
    }
});

// Create Category (Chairperson/Treasurer)
router.post('/categories', authenticateUser, async (req, res) => {
    if (!['ADMIN', 'CHAIRPERSON', 'TREASURER'].includes(req.user.role)) return res.status(403).json({ error: "Access Denied" });
    
    const { name, description, amount } = req.body;
    try {
        // Uppercase, underscore format for consistency (e.g., "Buying Plot" -> "BUYING_PLOT")
        const code = name.toUpperCase().replace(/\s+/g, '_');
        const categoryAmount = parseFloat(amount) || 0;
        
        await db.query(
            "INSERT INTO contribution_categories (name, description, amount) VALUES ($1, $2, $3)",
            [code, description || name, categoryAmount]
        );
        res.json({ success: true, message: "Category created" });
    } catch (err) {
        console.error("Failed to create category:", err);
        if(err.code === '23505') return res.status(400).json({ error: "Category already exists" });
        res.status(500).json({ error: "Creation failed: " + err.message });
    }
});

// Delete Category
router.delete('/categories/:id', authenticateUser, async (req, res) => {
    if (!['ADMIN', 'CHAIRPERSON', 'TREASURER'].includes(req.user.role)) return res.status(403).json({ error: "Access Denied" });
    
    try {
        await db.query("UPDATE contribution_categories SET is_active = FALSE WHERE id = $1", [req.params.id]);
        res.json({ success: true, message: "Category removed" });
    } catch (err) {
        console.error("Failed to delete category:", err);
        res.status(500).json({ error: "Delete failed" });
    }
});

// Helper
const getSetting = async (key) => {
    const res = await db.query("SELECT setting_value FROM system_settings WHERE setting_key = $1", [key]);
    return res.rows.length > 0 ? res.rows[0].setting_value : null;
};

module.exports = { router, getSetting };