const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer'); 
const db = require('../../db');
const { authenticateUser } = require('./middleware');
const { validate, registerSchema } = require('../common/validation');

/*
// --- [MUTED] HELPER: SMS SENDER ---
const sendSMS = async (phone, message) => {
    console.log(`
    📱 [SMS SIMULATION] 
    To: ${phone}
    Message: ${message}
    -------------------
    `);
    return true;
};
*/

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
        
        // [MUTED] Phone OTP Generation
        // const smsOtp = Math.floor(100000 + Math.random() * 900000).toString();
        // const otpExpiry = new Date(Date.now() + 10 * 60000); 

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            // [UPDATED] Insert User (Without Phone Verification fields)
            const newUser = await client.query(
                `INSERT INTO users (
                    full_name, email, password_hash, phone_number, role,
                    id_number, kra_pin, next_of_kin_name, next_of_kin_phone, next_of_kin_relation,
                    is_email_verified, verification_token, must_change_password
                    -- is_phone_verified, phone_otp, phone_otp_expires_at (REMOVED)
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, FALSE, $11, TRUE) 
                RETURNING id, full_name, email, role`,
                [
                    fullName, email, hash, phoneNumber, role || 'MEMBER', 
                    idNumber, kraPin, nextOfKinName, nextOfKinPhone, nextOfKinRelation,
                    verifyToken
                    // smsOtp, otpExpiry (REMOVED)
                ]
            );

            if ((role === 'MEMBER' || !role) && paymentRef) {
                await client.query(
                    "INSERT INTO transactions (user_id, type, amount, status, reference_code, description) VALUES ($1, 'REGISTRATION_FEE', 1500, 'COMPLETED', $2, 'Initial Registration Fee')",
                    [newUser.rows[0].id, paymentRef]
                );
            }

            // --- SEND EMAIL ---
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            const verificationLink = `${frontendUrl}/verify-email?token=${verifyToken}`;
            
            console.log("------------------------------------------------");
            console.log(`📧 Sending verification to: ${email}`);
            console.log(`🔗 Link: ${verificationLink}`);
            console.log("------------------------------------------------");

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

            // [MUTED] SMS Sending
            // await sendSMS(phoneNumber, `Your Sacco Verification Code is: ${smsOtp}`);

            await client.query('COMMIT');
            res.json({ message: "User registered. Verification email sent.", user: newUser.rows[0] });

        } catch (e) {
            await client.query('ROLLBACK');
            console.error("Registration Error:", e);
            throw e;
        } finally {
            client.release();
        }

    } catch (err) {
        console.error("Server Error:", err);
        res.status(500).json({ error: "Registration failed. Check server logs." });
    }
});

/*
// [MUTED] VERIFY PHONE OTP ROUTE
router.post('/verify-phone', authenticateUser, async (req, res) => {
    // ... code commented out ...
    res.status(503).json({ error: "Feature disabled" });
});
*/

// LOGIN
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
        if (result.rows.length === 0) return res.status(400).json({ error: "Invalid Credentials" });

        const user = result.rows[0];
        
        // --- CHECK EMAIL VERIFICATION ---
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
                mustChangePassword: user.must_change_password,
                // isPhoneVerified: user.is_phone_verified // [MUTED]
            } 
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server Error" });
    }
});

// VERIFY EMAIL ROUTE (Unchanged)
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

// LOGOUT
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: "Logged out" });
});

// --- NEW: PROFILE MANAGEMENT ROUTES ---

// GET CURRENT USER PROFILE
router.get('/profile', authenticateUser, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, full_name, email, phone_number, role, 
            id_number, kra_pin, next_of_kin_name, next_of_kin_phone, next_of_kin_relation, 
            profile_image,
            created_at, is_active 
            FROM users WHERE id = $1`,
            [req.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });
        res.json(result.rows[0]);
    } catch (err) {
        console.error("Profile fetch error:", err);
        res.status(500).json({ error: "Failed to fetch profile" });
    }
});

// UPDATE CURRENT USER PROFILE
router.put('/profile', authenticateUser, async (req, res) => {
    const { full_name, phone_number, next_of_kin_name, next_of_kin_phone, next_of_kin_relation, profile_image } = req.body;
    
    try {
        // Validation (Basic)
        if (!full_name || !phone_number) {
            return res.status(400).json({ error: "Name and Phone Number are required." });
        }

        await db.query(
            `UPDATE users SET 
                full_name = COALESCE($1, full_name),
                phone_number = COALESCE($2, phone_number),
                next_of_kin_name = COALESCE($3, next_of_kin_name),
                next_of_kin_phone = COALESCE($4, next_of_kin_phone),
                next_of_kin_relation = COALESCE($5, next_of_kin_relation),
                profile_image = COALESCE($6, profile_image)
            WHERE id = $7`,
            [full_name, phone_number, next_of_kin_name, next_of_kin_phone, next_of_kin_relation, profile_image, req.user.id]
        );
        
        res.json({ message: "Profile updated successfully" });
    } catch (err) {
        console.error("Profile update error:", err);
        if (err.code === '23505') { // Postgres Unique Violation
            return res.status(400).json({ error: "Phone number already in use by another member." });
        }
        res.status(500).json({ error: "Update failed" });
    }
});

// --------------------------------------

// GET ALL USERS (Admin/Officials only)
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