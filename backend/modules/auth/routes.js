const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../../db');

// REGISTER (One-time setup for users)
router.post('/register', async (req, res) => {
    const { fullName, email, password, role } = req.body;
    if (!fullName || !email || !password) return res.status(400).json({ error: "Missing fields" });

    try {
        // 1. Check if user exists
        const userCheck = await db.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userCheck.rows.length > 0) return res.status(400).json({ error: "Email already exists" });

        // 2. Hash Password
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        // 3. Insert User (Default role MEMBER if not specified)
        const result = await db.query(
            "INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, email, role",
            [fullName, email, hash, role || 'MEMBER']
        );

        res.json({ message: "User created", user: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Registration failed" });
    }
});

// LOGIN (Generate Token)
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // 1. Find User
        const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
        if (result.rows.length === 0) return res.status(400).json({ error: "Invalid credentials" });

        const user = result.rows[0];

        // 2. Compare Password
        const validPass = await bcrypt.compare(password, user.password_hash);
        if (!validPass) return res.status(400).json({ error: "Invalid credentials" });

        // 3. Sign Token (Expires in 1 Hour)
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