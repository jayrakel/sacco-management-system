const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../../db');
const { authenticateUser } = require('./middleware');

// ... (Existing Login/Register routes remain unchanged) ...

// REGISTER
router.post('/register', async (req, res) => {
    const { fullName, email, password, phoneNumber, role, paymentRef } = req.body;
    
    // 1. Validation
    if (!fullName || !email || !password || !phoneNumber) {
        return res.status(400).json({ error: "All fields are required" });
    }

    try {
        // 2. Check if user exists
        const userCheck = await db.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ error: "User already exists" });
        }

        // 3. Hash Password
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        // 4. Insert User
        // Note: We default 'is_active' to true for now. In a real app, you might want email verification.
        // We also handle the optional paymentRef for MEMBERS
        const newUser = await db.query(
            "INSERT INTO users (full_name, email, password_hash, phone_number, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, email, role",
            [fullName, email, hash, phoneNumber, role || 'MEMBER']
        );

        // 5. If it's a MEMBER and they provided a payment ref, log the Registration Fee
        if ((role === 'MEMBER' || !role) && paymentRef) {
            await db.query(
                "INSERT INTO transactions (user_id, type, amount, status, reference_code, description) VALUES ($1, 'REGISTRATION_FEE', 1500, 'COMPLETED', $2, 'Initial Registration Fee')",
                [newUser.rows[0].id, paymentRef]
            );
        }

        res.json({ message: "User registered successfully", user: newUser.rows[0] });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

// LOGIN
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
        if (result.rows.length === 0) return res.status(400).json({ error: "Invalid Credentials" });

        const user = result.rows[0];
        const validPass = await bcrypt.compare(password, user.password_hash);
        if (!validPass) return res.status(400).json({ error: "Invalid Credentials" });

        // Generate Token
        const token = jwt.sign(
            { id: user.id, role: user.role, name: user.full_name }, 
            process.env.JWT_SECRET, 
            { expiresIn: '8h' } // Token lasts 8 hours
        );

        // Send Token as HTTP-only cookie (More secure than localStorage)
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
            sameSite: 'strict',
            maxAge: 8 * 60 * 60 * 1000 // 8 hours
        });

        res.json({ 
            message: "Login successful", 
            user: { 
                id: user.id, 
                name: user.full_name, 
                email: user.email, 
                role: user.role,
                mustChangePassword: user.must_change_password 
            } 
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server Error" });
    }
});

// LOGOUT
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: "Logged out" });
});

// GET ALL USERS (Protected: Admin/Chair/Sec/Treas only)
router.get('/users', authenticateUser, async (req, res) => {
    if (!['ADMIN', 'CHAIRPERSON', 'SECRETARY', 'TREASURER'].includes(req.user.role)) {
        return res.status(403).json({ error: "Access Denied" });
    }
    try {
        const users = await db.query("SELECT id, full_name, email, phone_number, role, created_at, is_active FROM users ORDER BY created_at DESC");
        res.json(users.rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// GET SETUP STATUS (Check if Admin exists)
router.get('/setup-status', async (req, res) => {
    try {
        const result = await db.query("SELECT COUNT(*) FROM users WHERE role = 'ADMIN'");
        const count = parseInt(result.rows[0].count);
        
        // Also check if the default admin still has the default password flag
        let defaultAdminUnsafe = false;
        if (count > 0) {
            const adminRes = await db.query("SELECT must_change_password FROM users WHERE role = 'ADMIN' LIMIT 1");
            if (adminRes.rows[0].must_change_password) defaultAdminUnsafe = true;
        }

        res.json({ 
            isComplete: count > 0 && !defaultAdminUnsafe, 
            hasAdmin: count > 0 
        });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// CHANGE PASSWORD (Authenticated User)
router.post('/change-password', authenticateUser, async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;

    try {
        // 1. Verify Old Password
        const userRes = await db.query("SELECT password_hash FROM users WHERE id = $1", [userId]);
        const user = userRes.rows[0];
        
        const validPass = await bcrypt.compare(oldPassword, user.password_hash);
        if (!validPass) return res.status(400).json({ error: "Incorrect current password" });

        // 2. Update Password
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(newPassword, salt);

        await db.query("UPDATE users SET password_hash = $1, must_change_password = FALSE WHERE id = $2", [hash, userId]);
        
        res.json({ message: "Password updated successfully" });

    } catch (err) {
        res.status(500).json({ error: "Update failed" });
    }
});

// --- NEW: ADMIN UPDATE MEMBER ---
router.put('/admin/update/:userId', authenticateUser, async (req, res) => {
    // 1. Only Admin can perform this
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: "Access Denied" });
    }

    const targetId = req.params.userId;
    const { fullName, email, phoneNumber, role, password } = req.body;

    try {
        // 2. Check if updating password
        if (password && password.trim() !== "") {
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(password, salt);
            
            await db.query(
                `UPDATE users SET full_name = $1, email = $2, phone_number = $3, role = $4, password_hash = $5 WHERE id = $6`,
                [fullName, email, phoneNumber, role, hash, targetId]
            );
        } else {
            // Update details without password
            await db.query(
                `UPDATE users SET full_name = $1, email = $2, phone_number = $3, role = $4 WHERE id = $5`,
                [fullName, email, phoneNumber, role, targetId]
            );
        }

        res.json({ message: "User updated successfully" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update user" });
    }
});

module.exports = router;