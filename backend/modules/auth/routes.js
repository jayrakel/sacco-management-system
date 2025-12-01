const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../../db');
const { authenticateUser, requireRole } = require('./middleware');
const { validate, registerSchema, loginSchema } = require('../common/validation');

// REGISTER (Shared: Admin & Chairperson)
router.post('/register', authenticateUser, (req, res, next) => {
    const allowedRoles = ['ADMIN', 'CHAIRPERSON'];
    if (allowedRoles.includes(req.user.role)) {
        next();
    } else {
        res.status(403).json({ error: "Access Denied: Only Admin or Chairperson can register members." });
    }
}, validate(registerSchema), async (req, res) => {
    const { fullName, email, password, role, phoneNumber, paymentRef } = req.body;

    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Check Email
        const userCheck = await client.query("SELECT id FROM users WHERE email = $1", [email]);
        if (userCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "Email already exists" });
        }

        // 2. Hash Password
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        // 3. Create User
        const result = await client.query(
            `INSERT INTO users (full_name, email, password_hash, role, phone_number) 
             VALUES ($1, $2, $3, $4, $5) RETURNING id, email, role, full_name`,
            [fullName, email, hash, role, phoneNumber]
        );
        const newUser = result.rows[0];

        // 4. Record Registration Fee
        if (role === 'MEMBER' && paymentRef) {
            const refCheck = await client.query("SELECT id FROM transactions WHERE reference_code = $1", [paymentRef]);
            if (refCheck.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: "Payment reference code already used." });
            }

            // DYNAMIC FEE: Fetch from settings or default to 1500
            const settingRes = await client.query("SELECT setting_value FROM system_settings WHERE setting_key = 'registration_fee'");
            const feeAmount = settingRes.rows.length > 0 ? parseFloat(settingRes.rows[0].setting_value) : 1500.00;

            await client.query(
                `INSERT INTO transactions (user_id, type, amount, reference_code, description) 
                 VALUES ($1, 'REGISTRATION_FEE', $2, $3, 'New Member Registration Fee')`,
                [newUser.id, feeAmount, paymentRef]
            );
        }

        await client.query('COMMIT');
        res.json({ message: "User registered and fee recorded successfully", user: newUser });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: "Registration failed. Please check inputs." });
    } finally {
        client.release();
    }
});

// LOGIN
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

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 3600000 
        });

        res.json({ 
            success: true,
            user: { id: user.id, name: user.full_name, role: user.role, email: user.email }
        });

    } catch (err) {
        res.status(500).json({ error: "Login failed" });
    }
});

router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: "Logged out successfully" });
});

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

router.post('/users/:id/reset-password', authenticateUser, requireRole('ADMIN'), async (req, res) => {
    try {
        const defaultPass = "123456"; 
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(defaultPass, salt);
        await db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, req.params.id]);
        res.json({ success: true, message: `Password reset to '${defaultPass}'` });
    } catch (err) {
        res.status(500).json({ error: "Reset failed" });
    }
});

router.delete('/users/:id', authenticateUser, requireRole('ADMIN'), async (req, res) => {
    try {
        await db.query("DELETE FROM users WHERE id = $1", [req.params.id]);
        res.json({ success: true, message: "User deleted from system" });
    } catch (err) {
        res.status(500).json({ error: "Delete failed" });
    }
});

module.exports = router;