const express = require('express');
const router = express.Router();
const db = require('../../db');

// Just a placeholder for now
router.post('/login', (req, res) => {
    res.json({ token: "fake-jwt-token", user: { id: 1 } });
});

module.exports = router;