const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../../db');
const { authenticateUser } = require('./middleware');

// REGISTER
router.post('/register', async (req, res) => {
    const { fullName, email, password, phoneNumber, role, paymentRef } = req.body;
    
    if (!fullName || !email || !password || !phoneNumber) {
        return res.status(400).json({ error: "All fields are required" });
    }

    try {
        const userCheck = await db.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ error: "User already exists" });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        const newUser = await db.query(
            "INSERT INTO users (full_name, email, password_hash, phone_number, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, email, role",
            [fullName, email, hash, phoneNumber, role || 'MEMBER']
        );

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

        const token = jwt.sign(
            { id: user.id, role: user.role, name: user.full_name }, 
            process.env.JWT_SECRET, 
            { expiresIn: '8h' } 
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: true,       
            sameSite: 'none',   
            maxAge: 8 * 60 * 60 * 1000 
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
    res.clearCookie('token', {
        httpOnly: true,
        secure: true,
        sameSite: 'none'
    });
    res.json({ message: "Logged out" });
});

// GET ALL USERS (Protected)
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

// --- FIX: UPDATED SETUP STATUS ---
router.get('/setup-status', async (req, res) => {
    try {
        // 1. Get all roles currently in the system
        const result = await db.query("SELECT DISTINCT role FROM users");
        const existingRoles = result.rows.map(r => r.role);

        // 2. Define required roles
        const requiredRoles = ['CHAIRPERSON', 'SECRETARY', 'TREASURER', 'LOAN_OFFICER'];
        
        // 3. Find which ones are missing
        const missingRoles = requiredRoles.filter(role => !existingRoles.includes(role));

        // 4. Check Admin Status
        const hasAdmin = existingRoles.includes('ADMIN');
        let defaultAdminUnsafe = false;
        
        if (hasAdmin) {
            const adminRes = await db.query("SELECT must_change_password FROM users WHERE role = 'ADMIN' LIMIT 1");
            if (adminRes.rows[0] && adminRes.rows[0].must_change_password) defaultAdminUnsafe = true;
        }

        res.json({ 
            isComplete: missingRoles.length === 0 && hasAdmin && !defaultAdminUnsafe, 
            hasAdmin,
            missingRoles // Frontend needs this array
        });
    } catch (err) {
        console.error("Setup Status Error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// --- FIX: NEW ROUTE FOR SETUP USERS PAGE ---
router.post('/create-key-user', authenticateUser, async (req, res) => {
    // Only Admin can create key officers
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: "Access Denied" });
    }

    const { fullName, email, password, phoneNumber, role } = req.body;

    if (!fullName || !email || !password || !phoneNumber || !role) {
        return res.status(400).json({ error: "All fields are required" });
    }

    try {
        // Check if user exists
        const userCheck = await db.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ error: "User already exists" });
        }

        // Hash & Insert
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        // Force password change for these new officers for security
        await db.query(
            "INSERT INTO users (full_name, email, password_hash, phone_number, role, must_change_password) VALUES ($1, $2, $3, $4, $5, TRUE)",
            [fullName, email, hash, phoneNumber, role]
        );

        res.json({ message: `${role} created successfully` });

    } catch (err) {
        console.error("Create Key User Error:", err);
        res.status(500).json({ error: "Failed to create user" });
    }
});

// CHANGE PASSWORD (Authenticated User)
router.post('/change-password', authenticateUser, async (req, res) => {
    const { newPassword } = req.body; 
    const userId = req.user.id;

    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(newPassword, salt);

        await db.query("UPDATE users SET password_hash = $1, must_change_password = FALSE WHERE id = $2", [hash, userId]);
        
        res.json({ message: "Password updated successfully" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Update failed" });
    }
});

// ADMIN UPDATE MEMBER
router.put('/admin/update/:userId', authenticateUser, async (req, res) => {
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: "Access Denied" });
    }

    const targetId = req.params.userId;
    const { fullName, email, phoneNumber, role, password } = req.body;

    try {
        if (password && password.trim() !== "") {
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(password, salt);
            
            await db.query(
                `UPDATE users SET full_name = $1, email = $2, phone_number = $3, role = $4, password_hash = $5 WHERE id = $6`,
                [fullName, email, phoneNumber, role, hash, targetId]
            );
        } else {
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