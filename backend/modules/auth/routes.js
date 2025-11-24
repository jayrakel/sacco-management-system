const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../../db');
const { authenticateUser, requireRole } = require('./middleware'); // Import Middleware

// REGISTER: PROTECTED (ADMIN ONLY)
// We added authenticateUser and requireRole('ADMIN')
router.post('/register', authenticateUser, requireRole('ADMIN'), async (req, res) => {
    const { fullName, email, password, role, phoneNumber } = req.body;
    
    if (!fullName || !email || !password || !role) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        // 1. Check if user exists
        const userCheck = await db.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userCheck.rows.length > 0) return res.status(400).json({ error: "Email already exists" });

        // 2. Hash Password
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        // 3. Insert User
        const result = await db.query(
            `INSERT INTO users (full_name, email, password_hash, role, phone_number) 
             VALUES ($1, $2, $3, $4, $5) RETURNING id, email, role`,
            [fullName, email, hash, role, phoneNumber || '000']
        );

        res.json({ message: "User registered successfully", user: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Registration failed" });
    }
});

// LOGIN (Public)
router.post('/login', async (req, res) => {
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

        res.json({ 
            success: true,
            token,
            user: { id: user.id, name: user.full_name, role: user.role }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Login failed" });
    }
});

module.exports = router;