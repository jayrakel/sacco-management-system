const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer'); 
const db = require('../../db');
const { authenticateUser } = require('./middleware');
const { validate, registerSchema } = require('../common/validation');

// --- EMAIL CONFIGURATION ---
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: true, 
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// REGISTER
router.post('/register', validate(registerSchema), async (req, res) => {
    const { 
        fullName, email, password, phoneNumber, role, paymentRef,
        idNumber, kraPin, nextOfKinName, nextOfKinPhone, nextOfKinRelation
    } = req.body;

    try {
        const userCheck = await db.query("SELECT * FROM users WHERE email = $1 OR phone_number = $2", [email, phoneNumber]);
        if (userCheck.rows.length > 0) return res.status(400).json({ error: "User, Phone, or Email already exists" });

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        const verifyToken = crypto.randomBytes(32).toString('hex');

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            const newUser = await client.query(
                `INSERT INTO users (
                    full_name, email, password_hash, phone_number, role,
                    id_number, kra_pin, next_of_kin_name, next_of_kin_phone, next_of_kin_relation,
                    is_email_verified, verification_token, must_change_password
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, FALSE, $11, TRUE) 
                RETURNING id, full_name, email, role`,
                [
                    fullName, email, hash, phoneNumber, role || 'MEMBER', 
                    idNumber, kraPin, nextOfKinName, nextOfKinPhone, nextOfKinRelation,
                    verifyToken
                ]
            );

            if ((role === 'MEMBER' || !role) && paymentRef) {
                await client.query(
                    "INSERT INTO transactions (user_id, type, amount, status, reference_code, description) VALUES ($1, 'REGISTRATION_FEE', 1500, 'COMPLETED', $2, 'Initial Registration Fee')",
                    [newUser.rows[0].id, paymentRef]
                );
            }

            await client.query('COMMIT');

            // --- SEND REAL EMAIL ---
            const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verifyToken}`;
            
            await transporter.sendMail({
                from: process.env.EMAIL_FROM,
                to: email,
                subject: "Welcome to Sacco - Verify Your Account",
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px;">
                        <h2>Welcome, ${fullName}!</h2>
                        <p>Your Sacco account has been created.</p>
                        <p><strong>Temporary Password:</strong> ${password}</p>
                        <p>Please click the button below to verify your email and activate your account:</p>
                        <a href="${verificationLink}" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email</a>
                        <p>Or verify using this link: ${verificationLink}</p>
                    </div>
                `
            });

            res.json({ message: "User registered. Verification email sent.", user: newUser.rows[0] });

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

    } catch (err) {
        console.error("Registration Error:", err);
        res.status(500).json({ error: "Server error during registration. Check logs." });
    }
});

// VERIFY EMAIL ROUTE
router.post('/verify-email', async (req, res) => {
    const { token } = req.body;
    try {
        const result = await db.query(
            "UPDATE users SET is_email_verified = TRUE, verification_token = NULL WHERE verification_token = $1 RETURNING id, email",
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: "Invalid or expired token." });
        }

        res.json({ success: true, message: "Email verified successfully!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Verification failed." });
    }
});

// LOGIN (Blocks Unverified)
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
        if (result.rows.length === 0) return res.status(400).json({ error: "Invalid Credentials" });

        const user = result.rows[0];
        
        // --- FIX: USE 400 INSTEAD OF 403 FOR UNVERIFIED USERS ---
        // This prevents the frontend interceptor from redirecting to /unauthorized
        if (!user.is_email_verified) {
            return res.status(400).json({ error: "Please verify your email first. Check your inbox." });
        }

        if (!user.is_active) return res.status(403).json({ error: "Account deactivated. Contact Admin." });

        const validPass = await bcrypt.compare(password, user.password_hash);
        if (!validPass) return res.status(400).json({ error: "Invalid Credentials" });

        const token = jwt.sign(
            { id: user.id, role: user.role, name: user.full_name }, 
            process.env.JWT_SECRET, 
            { expiresIn: '8h' } 
        );

        const isProduction = process.env.NODE_ENV === 'production';
        res.cookie('token', token, {
            httpOnly: true,
            secure: isProduction,       
            sameSite: isProduction ? 'none' : 'lax',   
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
    res.clearCookie('token');
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

module.exports = router;