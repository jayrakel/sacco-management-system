const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../../db');
const { authenticateUser, requireRole } = require('./middleware');
const { validate, registerSchema, loginSchema, VALID_ROLES } = require('../common/validation');

// 1. CHECK SYSTEM SETUP STATUS (Used to force wizard)
router.get('/setup-status', authenticateUser, requireRole('ADMIN'), async (req, res) => {
    try {
        // Count existing users by role
        const result = await db.query(`
            SELECT role, COUNT(*) as count 
            FROM users 
            WHERE role IN ('CHAIRPERSON', 'SECRETARY', 'TREASURER', 'LOAN_OFFICER')
            GROUP BY role
        `);

        const counts = {};
        result.rows.forEach(row => {
            counts[row.role] = parseInt(row.count);
        });

        // Define strict requirements
        const required = ['CHAIRPERSON', 'SECRETARY', 'TREASURER', 'LOAN_OFFICER'];
        const missing = required.filter(role => !counts[role] || counts[role] === 0);

        res.json({
            isComplete: missing.length === 0,
            missingRoles: missing,
            counts: counts
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Status check failed" });
    }
});

// 2. CREATE KEY USER (Wizard Endpoint)
router.post('/create-key-user', authenticateUser, requireRole('ADMIN'), validate(registerSchema), async (req, res) => {
    const { fullName, email, password, role, phoneNumber } = req.body;

    const KEY_ROLES = ['CHAIRPERSON', 'ASSISTANT_CHAIRPERSON', 'SECRETARY', 'ASSISTANT_SECRETARY', 'TREASURER', 'LOAN_OFFICER'];
    
    if (!KEY_ROLES.includes(role)) {
        return res.status(400).json({ error: "This endpoint is for Key Users only. Use standard registration for Members." });
    }

    try {
        // Check email dupes
        const userCheck = await db.query("SELECT id FROM users WHERE email = $1", [email]);
        if (userCheck.rows.length > 0) return res.status(400).json({ error: "Email already exists" });

        // Enforce Single Responsibility for primary roles
        if (['CHAIRPERSON', 'SECRETARY', 'TREASURER'].includes(role)) {
             const roleCheck = await db.query("SELECT id FROM users WHERE role = $1", [role]);
             if (roleCheck.rows.length > 0) {
                 return res.status(400).json({ error: `A ${role} already exists. Only one is allowed.` });
             }
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        // Create user - set must_change_password to TRUE for security
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

// 3. STANDARD REGISTER (Admin creating Members)
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
            [fullName, email, hash, role || 'MEMBER', phoneNumber]
        );

        res.json({ message: "User registered successfully", user: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Registration failed" });
    }
});

// 4. LOGIN
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
            user: { 
                id: user.id, 
                name: user.full_name, 
                role: user.role, 
                email: user.email,
                mustChangePassword: user.must_change_password 
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Login failed" });
    }
});

// 5. CHANGE PASSWORD
router.post('/change-password', authenticateUser, async (req, res) => {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(newPassword, salt);

        await db.query(
            `UPDATE users 
             SET password_hash = $1, must_change_password = FALSE 
             WHERE id = $2`,
            [hash, req.user.id]
        );

        res.json({ success: true, message: "Password updated successfully." });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update password." });
    }
});

// 6. LOGOUT
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: "Logged out successfully" });
});

// 7. GET ALL USERS
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