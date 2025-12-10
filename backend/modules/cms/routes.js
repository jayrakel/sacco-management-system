const express = require('express');
const router = express.Router();
const db = require('../../db');
const multer = require('multer');
const path = require('path');
const { authenticateUser, authorizeRoles } = require('../auth/middleware');

// --- FILE UPLOAD CONFIG ---
const storage = multer.diskStorage({
    destination: './uploads/minutes/',
    filename: (req, file, cb) => {
        cb(null, 'MINUTES-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// === PUBLIC ROUTES (For the Website) ===

// Get Content
router.get('/content', async (req, res) => {
    try {
        const history = await db.query("SELECT * FROM group_history ORDER BY event_date ASC");
        const minutes = await db.query("SELECT * FROM meeting_minutes ORDER BY meeting_date DESC");
        const text = await db.query("SELECT * FROM website_content");
        
        // Convert text array to object for easy frontend use
        const contentMap = {};
        text.rows.forEach(row => contentMap[row.section_key] = row.content_value);

        res.json({ history: history.rows, minutes: minutes.rows, text: contentMap });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// === ADMIN ROUTES (The "Feeder") ===

// 1. Update Text Content (About Us, etc.)
router.post('/text', authenticateUser, authorizeRoles('ADMIN', 'SECRETARY'), async (req, res) => {
    const { key, value } = req.body;
    try {
        await db.query(
            "INSERT INTO website_content (section_key, content_value, updated_by) VALUES ($1, $2, $3) ON CONFLICT (section_key) DO UPDATE SET content_value = $2, updated_by = $3",
            [key, value, req.user.id]
        );
        res.json({ message: "Content updated" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. Add History Event
router.post('/history', authenticateUser, authorizeRoles('ADMIN', 'SECRETARY'), async (req, res) => {
    const { title, date, description } = req.body;
    try {
        await db.query("INSERT INTO group_history (event_title, event_date, description) VALUES ($1, $2, $3)", [title, date, description]);
        res.json({ message: "History event added" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. Upload Minutes
router.post('/minutes', authenticateUser, authorizeRoles('ADMIN', 'SECRETARY'), upload.single('file'), async (req, res) => {
    try {
        const { title, date } = req.body;
        const filePath = `/uploads/minutes/${req.file.filename}`; // Store relative path
        await db.query("INSERT INTO meeting_minutes (title, meeting_date, file_path) VALUES ($1, $2, $3)", [title, date, filePath]);
        res.json({ message: "Minutes uploaded successfully" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;