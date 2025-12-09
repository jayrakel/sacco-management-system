const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../../db');
const { authenticateUser } = require('./middleware');
const { validate, registerSchema } = require('../common/validation'); // Import validation

// REGISTER
router.post('/register', validate(registerSchema), async (req, res) => {
    const { 
        fullName, email, password, phoneNumber, role, paymentRef,
        idNumber, kraPin, nextOfKinName, nextOfKinPhone, nextOfKinRelation
    } = req.body;

    try {
        const userCheck = await db.query("SELECT * FROM users WHERE email = $1 OR phone_number = $2 OR id_number = $3", [email, phoneNumber, idNumber]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ error: "User, Phone, or ID already exists" });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        // Transaction to ensure user + fee match
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            const newUser = await client.query(
                `INSERT INTO users (
                    full_name, email, password_hash, phone_number, role,
                    id_number, kra_pin, next_of_kin_name, next_of_kin_phone, next_of_kin_relation
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
                RETURNING id, full_name, email, role`,
                [fullName, email, hash, phoneNumber, role || 'MEMBER', idNumber, kraPin, nextOfKinName, nextOfKinPhone, nextOfKinRelation]
            );

            if ((role === 'MEMBER' || !role) && paymentRef) {
                await client.query(
                    "INSERT INTO transactions (user_id, type, amount, status, reference_code, description) VALUES ($1, 'REGISTRATION_FEE', 1500, 'COMPLETED', $2, 'Initial Registration Fee')",
                    [newUser.rows[0].id, paymentRef]
                );
            }

            await client.query('COMMIT');
            res.json({ message: "User registered successfully", user: newUser.rows[0] });

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error during registration" });
    }
});

// LOGIN
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
        if (result.rows.length === 0) return res.status(400).json({ error: "Invalid Credentials" });

        const user = result.rows[0];
        if (!user.is_active) return res.status(403).json({ error: "Account deactivated. Contact Admin." });

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
        const result = await db.query("SELECT DISTINCT role FROM users");
        const existingRoles = result.rows.map(r => r.role);
        const requiredRoles = ['CHAIRPERSON', 'SECRETARY', 'TREASURER', 'LOAN_OFFICER'];
        const missingRoles = requiredRoles.filter(role => !existingRoles.includes(role));
        const hasAdmin = existingRoles.includes('ADMIN');
        
        let defaultAdminUnsafe = false;
        if (hasAdmin) {
            const adminRes = await db.query("SELECT must_change_password FROM users WHERE role = 'ADMIN' LIMIT 1");
            if (adminRes.rows[0] && adminRes.rows[0].must_change_password) defaultAdminUnsafe = true;
        }

        res.json({ 
            isComplete: missingRoles.length === 0 && hasAdmin && !defaultAdminUnsafe, 
            hasAdmin,
            missingRoles 
        });
    } catch (err) {
        console.error("Setup Status Error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

router.post('/create-key-user', authenticateUser, async (req, res) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: "Access Denied" });
    const { fullName, email, password, phoneNumber, role } = req.body;
    if (!fullName || !email || !password || !phoneNumber || !role) return res.status(400).json({ error: "All fields are required" });

    try {
        const userCheck = await db.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userCheck.rows.length > 0) return res.status(400).json({ error: "User already exists" });

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        await db.query(
            "INSERT INTO users (full_name, email, password_hash, phone_number, role, must_change_password) VALUES ($1, $2, $3, $4, $5, TRUE)",
            [fullName, email, hash, phoneNumber, role]
        );
        res.json({ message: `${role} created successfully` });
    } catch (err) {
        res.status(500).json({ error: "Failed to create user" });
    }
});

// CHANGE PASSWORD
router.post('/change-password', authenticateUser, async (req, res) => {
    const { newPassword } = req.body; 
    const userId = req.user.id;
    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(newPassword, salt);
        await db.query("UPDATE users SET password_hash = $1, must_change_password = FALSE WHERE id = $2", [hash, userId]);
        res.json({ message: "Password updated successfully" });
    } catch (err) {
        res.status(500).json({ error: "Update failed" });
    }
});

// ADMIN UPDATE MEMBER (Fixed for partial updates)
router.put('/admin/update/:userId', authenticateUser, async (req, res) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: "Access Denied" });
    const targetId = req.params.userId;
    const { fullName, email, phoneNumber, role, password } = req.body;

    try {
        let query = "UPDATE users SET full_name = $1, email = $2, phone_number = $3, role = $4";
        let params = [fullName, email, phoneNumber, role];
        
        if (password && password.trim() !== "") {
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(password, salt);
            query += ", password_hash = $5 WHERE id = $6";
            params.push(hash, targetId);
        } else {
            query += " WHERE id = $5";
            params.push(targetId);
        }

        await db.query(query, params);
        res.json({ message: "User updated successfully" });
    } catch (err) {
        res.status(500).json({ error: "Failed to update user" });
    }
});

// ADMIN DELETE MEMBER
router.delete('/admin/delete/:userId', authenticateUser, async (req, res) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: "Access Denied" });
    try {
        await db.query("DELETE FROM users WHERE id = $1", [req.params.userId]);
        res.json({ message: "User deleted successfully" });
    } catch (err) {
        if (err.code === '23503') return res.status(400).json({ error: "Cannot delete user with active history." });
        res.status(500).json({ error: "Failed to delete user" });
    }
});

module.exports = router;