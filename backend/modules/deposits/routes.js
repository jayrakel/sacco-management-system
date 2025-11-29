const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateUser, requireRole } = require('../auth/middleware');
const Joi = require('joi');

// Validation Schema for Deposit
const depositSchema = Joi.object({
    amount: Joi.number().integer().min(50).required(),
    phoneNumber: Joi.string().pattern(/^[0-9]{10,15}$/).required()
});

// --- NEW ROUTE START ---
// GET ALL DEPOSITS (Admin & Chairperson)
router.get('/admin/all', authenticateUser, (req, res, next) => {
    if (['ADMIN', 'CHAIRPERSON'].includes(req.user.role)) next(); // <--- MUST INCLUDE CHAIRPERSON
    else res.status(403).json({ error: "Access Denied" });
}, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT d.id, d.amount, d.transaction_ref, d.created_at, u.full_name 
             FROM deposits d 
             JOIN users u ON d.user_id = u.id 
             ORDER BY d.created_at DESC`
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Fetch failed" }); }
});
// --- NEW ROUTE END ---

// 1. GET MY SAVINGS BALANCE
router.get('/balance', authenticateUser, async (req, res) => {
    try {
        const result = await db.query(
            "SELECT SUM(amount) as total FROM deposits WHERE user_id = $1 AND status = 'COMPLETED'",
            [req.user.id]
        );
        const balance = result.rows[0].total || 0;
        res.json({ balance: parseFloat(balance) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not fetch balance" });
    }
});

// 2. MAKE A DEPOSIT
router.post('/', authenticateUser, async (req, res) => {
    const { error } = depositSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { amount, transactionRef } = req.body; // Assuming mocked ref or from body
    const ref = transactionRef || 'TRX-' + Math.random().toString(36).substr(2, 9).toUpperCase();

    try {
        const result = await db.query(
            `INSERT INTO deposits (user_id, amount, transaction_ref, status) 
             VALUES ($1, $2, $3, 'COMPLETED') RETURNING *`,
            [req.user.id, amount, ref]
        );

        res.json({ 
            message: "Deposit successful", 
            deposit: result.rows[0],
            newBalance: result.rows[0].amount 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Deposit failed" });
    }
});

// 3. GET MY TRANSACTION HISTORY
router.get('/history', authenticateUser, async (req, res) => {
    try {
        const result = await db.query(
            "SELECT * FROM deposits WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10",
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not fetch history" });
    }
});

module.exports = router;