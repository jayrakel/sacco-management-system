const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../../db');
const { authenticateUser, requireRole } = require('./middleware');
const { validate, registerSchema, loginSchema } = require('../common/validation');

// REGISTER (Protected: Admin Only)
router.post('/register', authenticateUser, requireRole('ADMIN'), validate(registerSchema), async (req, res) => {
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
})

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

// GET ALL USERS (Admin Only)
router.get('/users', authenticateUser, requireRole('ADMIN'), async (req, res) => {
    try {
        const result = await db.query(
            "SELECT id, full_name, email, role, phone_number, created_at FROM users ORDER BY created_at DESC"
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

module.exports = router;