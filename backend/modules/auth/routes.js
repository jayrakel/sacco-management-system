const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../../db');
const { authenticateUser, requireRole } = require('./middleware');
const { validate, registerSchema, loginSchema } = require('../common/validation');

// --- NEW: SETUP WIZARD ROUTES ---

// 1. Check System Setup Status
router.get('/setup-status', authenticateUser, requireRole('ADMIN'), async (req, res) => {
    try {
        const result = await db.query(`
            SELECT role, COUNT(*) as count 
            FROM users 
            WHERE role IN ('CHAIRPERSON', 'SECRETARY', 'TREASURER', 'LOAN_OFFICER')
            GROUP BY role
        `);

        const counts = {};
        result.rows.forEach(row => { counts[row.role] = parseInt(row.count); });

        const required = ['CHAIRPERSON', 'SECRETARY', 'TREASURER', 'LOAN_OFFICER'];
        const missing = required.filter(role => !counts[role] || counts[role] === 0);

        res.json({ isComplete: missing.length === 0, missingRoles: missing });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Status check failed" });
    }
});

// 2. Create Key User (For Wizard Only - No Fee Logic)
router.post('/create-key-user', authenticateUser, requireRole('ADMIN'), validate(registerSchema), async (req, res) => {
    const { fullName, email, password, role, phoneNumber } = req.body;
    const KEY_ROLES = ['CHAIRPERSON', 'SECRETARY', 'TREASURER', 'LOAN_OFFICER', 'ASSISTANT_CHAIRPERSON', 'ASSISTANT_SECRETARY'];
    
    if (!KEY_ROLES.includes(role)) {
        return res.status(400).json({ error: "This endpoint is for Key Users only." });
    }

    try {
        const userCheck = await db.query("SELECT id FROM users WHERE email = $1", [email]);
        if (userCheck.rows.length > 0) return res.status(400).json({ error: "Email already exists" });

        // Enforce Single Responsibility for primary roles
        if (['CHAIRPERSON', 'SECRETARY', 'TREASURER'].includes(role)) {
             const roleCheck = await db.query("SELECT id FROM users WHERE role = $1", [role]);
             if (roleCheck.rows.length > 0) return res.status(400).json({ error: `A ${role} already exists.` });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        const result = await db.query(
            `INSERT INTO users (full_name, email, password_hash, role, phone_number, must_change_password) 
             VALUES ($1, $2, $3, $4, $5, TRUE) RETURNING id, role`,
            [fullName, email, hash, role, phoneNumber]
        );

        res.json({ message: `${role} created successfully`, user: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Creation failed" });
    }
});

// 3. Change Password (Self)
router.post('/change-password', authenticateUser, async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(newPassword, salt);
        await db.query("UPDATE users SET password_hash = $1, must_change_password = FALSE WHERE id = $2", [hash, req.user.id]);
        res.json({ success: true, message: "Password updated successfully." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update password" });
    }
});

// --- EXISTING ROUTES (MAINTAINED) ---

// REGISTER (Shared: Admin & Chairperson - Includes Fee Logic)
router.post('/register', authenticateUser, (req, res, next) => {
    const allowedRoles = ['ADMIN', 'CHAIRPERSON'];
    if (allowedRoles.includes(req.user.role)) next();
    else res.status(403).json({ error: "Access Denied: Only Admin or Chairperson can register members." });
}, validate(registerSchema), async (req, res) => {
    const { fullName, email, password, role, phoneNumber, paymentRef } = req.body;
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const userCheck = await client.query("SELECT id FROM users WHERE email = $1", [email]);
        if (userCheck.rows.length > 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: "Email already exists" }); }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        const result = await client.query(
            `INSERT INTO users (full_name, email, password_hash, role, phone_number) 
             VALUES ($1, $2, $3, $4, $5) RETURNING id, email, role, full_name`,
            [fullName, email, hash, role, phoneNumber]
        );
        const newUser = result.rows[0];

        if (role === 'MEMBER' && paymentRef) {
            const refCheck = await client.query("SELECT id FROM transactions WHERE reference_code = $1", [paymentRef]);
            if (refCheck.rows.length > 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: "Payment reference code already used." }); }
            
            const settingRes = await client.query("SELECT setting_value FROM system_settings WHERE setting_key = 'registration_fee'");
            const feeAmount = settingRes.rows.length > 0 ? parseFloat(settingRes.rows[0].setting_value) : 1500.00;

            await client.query(
                `INSERT INTO transactions (user_id, type, amount, reference_code, description) 
                 VALUES ($1, 'REGISTRATION_FEE', $2, $3, 'New Member Registration Fee')`,
                [newUser.id, feeAmount, paymentRef]
            );
        }
        await client.query('COMMIT');
        res.json({ message: "User registered successfully", user: newUser });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: "Registration failed." });
    } finally {
        client.release();
    }
});

// LOGIN (Modified to return mustChangePassword)
router.post('/login', validate(loginSchema), async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
        if (result.rows.length === 0) return res.status(400).json({ error: "Invalid credentials" });

        const user = result.rows[0];
        const validPass = await bcrypt.compare(password, user.password_hash);
        if (!validPass) return res.status(400).json({ error: "Invalid credentials" });

        const token = jwt.sign({ id: user.id, role: user.role, name: user.full_name }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 3600000 
        });

        res.json({ 
            success: true,
            user: { 
                id: user.id, 
                name: user.full_name, 
                role: user.role, 
                email: user.email,
                mustChangePassword: user.must_change_password // <--- ADDED THIS
            }
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
        const result = await db.query("SELECT id, full_name, email, role, phone_number, created_at FROM users ORDER BY created_at DESC");
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
        await db.query("UPDATE users SET password_hash = $1, must_change_password = TRUE WHERE id = $2", [hash, req.params.id]);
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