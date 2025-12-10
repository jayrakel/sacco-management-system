const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateUser, authorizeRoles } = require('../auth/middleware');

// --- MEETING MINUTES ---

// Get all minutes (Accessible to all members for transparency)
router.get('/minutes', authenticateUser, async (req, res) => {
    try {
        const result = await db.query(
            "SELECT * FROM meeting_minutes ORDER BY meeting_date DESC"
        );
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Add Minutes (Secretary/Chair/Admin only)
router.post('/minutes', authenticateUser, authorizeRoles('SECRETARY', 'CHAIRPERSON', 'ADMIN'), async (req, res) => {
    try {
        const { title, meeting_date, content, attendees_count } = req.body;
        await db.query(
            "INSERT INTO meeting_minutes (title, meeting_date, content, attendees_count, created_by) VALUES ($1, $2, $3, $4, $5)",
            [title, meeting_date, content, attendees_count, req.user.id]
        );
        res.json({ message: "Minutes archived successfully." });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- GROUP HISTORY ---

// Get Timeline
router.get('/history', authenticateUser, async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM group_history ORDER BY event_date ASC");
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Add Historical Event
router.post('/history', authenticateUser, authorizeRoles('ADMIN', 'CHAIRPERSON'), async (req, res) => {
    try {
        const { event_title, event_date, description, event_type } = req.body;
        await db.query(
            "INSERT INTO group_history (event_title, event_date, description, event_type) VALUES ($1, $2, $3, $4)",
            [event_title, event_date, description, event_type]
        );
        res.json({ message: "Historical event recorded." });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- MEMBER MOVEMENT ---

// Log a member leaving or changing status
router.post('/member-log', authenticateUser, authorizeRoles('SECRETARY', 'ADMIN'), async (req, res) => {
    try {
        const { user_id, action_type, reason } = req.body;
        
        // 1. Log the movement
        await db.query(
            "INSERT INTO member_movement_log (user_id, action_type, reason, recorded_by) VALUES ($1, $2, $3, $4)",
            [user_id, action_type, reason, req.user.id]
        );

        // 2. Automatically update the user's active status
        if (action_type === 'LEFT' || action_type === 'SUSPENDED') {
            await db.query("UPDATE users SET is_active = false WHERE id = $1", [user_id]);
        } else if (action_type === 'REINSTATED') {
            await db.query("UPDATE users SET is_active = true WHERE id = $1", [user_id]);
        }

        res.json({ message: "Member status updated and logged." });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;