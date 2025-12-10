const express = require('express');
const router = express.Router();
const db = require('../../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Import fs to delete files
const { authenticateUser, authorizeRoles } = require('../auth/middleware');

// --- FILE UPLOAD CONFIG ---
const storage = multer.diskStorage({
    destination: './uploads/minutes/',
    filename: (req, file, cb) => {
        cb(null, 'MINUTES-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// === PUBLIC ROUTES ===
router.get('/content', async (req, res) => {
    try {
        const history = await db.query("SELECT * FROM group_history ORDER BY event_date ASC");
        const minutes = await db.query("SELECT * FROM meeting_minutes ORDER BY meeting_date DESC");
        const text = await db.query("SELECT * FROM website_content");
        
        const contentMap = {};
        text.rows.forEach(row => contentMap[row.section_key] = row.content_value);

        res.json({ history: history.rows, minutes: minutes.rows, text: contentMap });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// === PROTECTED ROUTES (Admin & Secretary) ===

// 1. Text Content
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

// 2. History - Add
router.post('/history', authenticateUser, authorizeRoles('ADMIN', 'SECRETARY'), async (req, res) => {
    const { title, date, description } = req.body;
    try {
        await db.query("INSERT INTO group_history (event_title, event_date, description) VALUES ($1, $2, $3)", [title, date, description]);
        res.json({ message: "History added" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. History - Edit (NEW)
router.put('/history/:id', authenticateUser, authorizeRoles('ADMIN', 'SECRETARY'), async (req, res) => {
    const { title, date, description } = req.body;
    try {
        await db.query(
            "UPDATE group_history SET event_title=$1, event_date=$2, description=$3 WHERE id=$4", 
            [title, date, description, req.params.id]
        );
        res.json({ message: "History updated" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 4. History - Delete (NEW)
router.delete('/history/:id', authenticateUser, authorizeRoles('ADMIN', 'SECRETARY'), async (req, res) => {
    try {
        await db.query("DELETE FROM group_history WHERE id=$1", [req.params.id]);
        res.json({ message: "History deleted" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 5. Minutes - Upload
router.post('/minutes', authenticateUser, authorizeRoles('ADMIN', 'SECRETARY'), upload.single('file'), async (req, res) => {
    try {
        const { title, date } = req.body;
        const filePath = `/uploads/minutes/${req.file.filename}`;
        await db.query("INSERT INTO meeting_minutes (title, meeting_date, file_path) VALUES ($1, $2, $3)", [title, date, filePath]);
        res.json({ message: "Minutes uploaded" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 6. Minutes - Delete (NEW)
router.delete('/minutes/:id', authenticateUser, authorizeRoles('ADMIN', 'SECRETARY'), async (req, res) => {
    try {
        // First get file path to delete from disk
        const fileRes = await db.query("SELECT file_path FROM meeting_minutes WHERE id=$1", [req.params.id]);
        if (fileRes.rows.length > 0) {
            const filePath = path.join(__dirname, '../../..', fileRes.rows[0].file_path);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath); // Delete actual file
        }
        
        await db.query("DELETE FROM meeting_minutes WHERE id=$1", [req.params.id]);
        res.json({ message: "Document deleted" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;