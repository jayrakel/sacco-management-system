const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../../db');
const { authenticateUser, requireRole } = require('./middleware');
const { validate, registerSchema, loginSchema } = require('../common/validation');

// REGISTER (Shared: Admin & Chairperson)
// We use a custom middleware function here to check for either role
router.post('/register', authenticateUser, (req, res, next) => {
    const allowedRoles = ['ADMIN', 'CHAIRPERSON'];
    if (allowedRoles.includes(req.user.role)) {
        next();
    } else {
        res.status(403).json({ error: "Access Denied: Only Admin or Chairperson can register members." });
    }
}, validate(registerSchema), async (req, res) => {
    const { fullName, email, password, role, phoneNumber } = req.body;

    try {
        const userCheck = await db.query("SELECT id FROM users WHERE email = $1", [email]);
        if (userCheck.rows.length > 0) return res.status(400).json({ error: "Email already exists" });

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        const result = await db.query(
            `INSERT INTO users (full_name, email, password_hash, role, phone_number) 
             VALUES ($1, $2, $3, $4, $5) RETURNING id, email, role`,
            [fullName, email, hash, role, phoneNumber]
        );

        res.json({ message: "User registered successfully", user: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Registration failed" });
    }
});

// LOGIN (Public)
router.post('/login', validate(loginSchema), async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
        if (result.rows.length === 0) return res.status(400).json({ error: "Invalid credentials" });

        const user = result.rows[0];
        const validPass = await bcrypt.compare(password, user.password_hash);
        if (!validPass) return res.status(400).json({ error: "Invalid credentials" });

        const token = jwt.sign(
            { id: user.id, role: user.role, name: user.full_name }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1h' }
        );

        // SECURITY FIX: Send token as HTTP-Only Cookie
        res.cookie('token', token, {
            httpOnly: true, // JavaScript cannot access this (Blocks XSS)
            secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
            sameSite: 'strict', // Protects against CSRF
            maxAge: 3600000 // 1 hour
        });

        res.json({ 
            success: true,
            // Token is no longer in the body!
            user: { id: user.id, name: user.full_name, role: user.role, email: user.email }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Login failed" });
    }
});

// Logout Route (Optional but good practice)
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: "Logged out successfully" });
});

// 1. GET ALL USERS (Shared: Admin & Chairperson needs to see users)
router.get('/users', authenticateUser, (req, res, next) => {
    if (['ADMIN', 'CHAIRPERSON'].includes(req.user.role)) next();
    else res.status(403).json({ error: "Access Denied" });
}, async (req, res) => {
    try {
        const result = await db.query(
            "SELECT id, full_name, email, role, phone_number, created_at FROM users ORDER BY created_at DESC"
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// 2. [NEW] RESET USER PASSWORD (Admin Only - IT Task)
router.post('/users/:id/reset-password', authenticateUser, requireRole('ADMIN'), async (req, res) => {
    try {
        // Reset to default string, e.g., "123456"
        const defaultPass = "123456"; 
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(defaultPass, salt);
        
        await db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, req.params.id]);
        res.json({ success: true, message: `Password reset to '${defaultPass}'` });
    } catch (err) {
        res.status(500).json({ error: "Reset failed" });
    }
});

// 3. [NEW] DELETE USER (Admin Only - IT Task)
router.delete('/users/:id', authenticateUser, requireRole('ADMIN'), async (req, res) => {
    try {
        await db.query("DELETE FROM users WHERE id = $1", [req.params.id]);
        res.json({ success: true, message: "User deleted from system" });
    } catch (err) {
        res.status(500).json({ error: "Delete failed" });
    }
});

module.exports = router;