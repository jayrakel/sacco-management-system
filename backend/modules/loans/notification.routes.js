const express = require('express');
const router = express.Router();
const db = require('../../db');

router.get('/notifications', async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC", [req.user.id]);
        const twoWeeksAgo = new Date(); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        const unread = []; const history = []; const archive = [];
        result.rows.forEach(note => {
            const noteDate = new Date(note.created_at);
            if (!note.is_read) unread.push(note);
            else if (noteDate >= twoWeeksAgo) history.push(note);
            else archive.push(note);
        });
        res.json({ unread, history, archive });
    } catch (err) { res.status(500).json({ error: "Fetch failed" }); }
});

router.put('/notifications/:id/read', async (req, res) => {
    try { await db.query("UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]); res.json({ success: true }); } 
    catch (err) { res.status(500).json({ error: "Update failed" }); }
});

module.exports = router;