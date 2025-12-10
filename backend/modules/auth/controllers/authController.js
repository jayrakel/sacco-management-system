const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('../../../db');

// Email Transporter Configuration
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

exports.register = async (req, res) => {
    const { fullName, email, password, phoneNumber, role, paymentRef, idNumber, kraPin, nextOfKinName, nextOfKinPhone, nextOfKinRelation } = req.body;
    
    try {
        const userCheck = await db.query("SELECT * FROM users WHERE email = $1 OR phone_number = $2", [email, phoneNumber]);
        if (userCheck.rows.length > 0) return res.status(400).json({ error: "User already exists" });

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        const verifyToken = crypto.randomBytes(32).toString('hex');

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            const newUser = await client.query(
                `INSERT INTO users (full_name, email, password_hash, phone_number, role, id_number, kra_pin, next_of_kin_name, next_of_kin_phone, next_of_kin_relation, is_email_verified, verification_token, must_change_password) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, FALSE, $11, TRUE) RETURNING id, full_name, email`,
                [fullName, email, hash, phoneNumber, role || 'MEMBER', idNumber, kraPin, nextOfKinName, nextOfKinPhone, nextOfKinRelation, verifyToken]
            );

            if ((role === 'MEMBER' || !role) && paymentRef) {
                await client.query("INSERT INTO transactions (user_id, type, amount, status, reference_code, description) VALUES ($1, 'REGISTRATION_FEE', 1500, 'COMPLETED', $2, 'Initial Registration Fee')", [newUser.rows[0].id, paymentRef]);
            }

            // Send Email Logic
            const link = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${verifyToken}`;
            await transporter.sendMail({
                from: process.env.EMAIL_FROM, to: email, subject: "Welcome - Verify Account",
                html: `<p>Welcome ${fullName}! <a href="${link}">Verify Email</a></p>`
            });

            await client.query('COMMIT');
            res.json({ message: "Registered. Verification email sent.", user: newUser.rows[0] });
        } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    } catch (err) { res.status(500).json({ error: "Registration failed" }); }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
        if (result.rows.length === 0) return res.status(400).json({ error: "Invalid Credentials" });
        
        const user = result.rows[0];
        if (!user.is_email_verified) return res.status(400).json({ error: "Verify email first" });
        if (!user.is_active) return res.status(403).json({ error: "Account deactivated" });

        if (!await bcrypt.compare(password, user.password_hash)) return res.status(400).json({ error: "Invalid Credentials" });

        const token = jwt.sign({ id: user.id, role: user.role, name: user.full_name }, process.env.JWT_SECRET, { expiresIn: '8h' });
        
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', maxAge: 8 * 3600000 });
        res.json({ message: "Login successful", user: { id: user.id, name: user.full_name, email: user.email, role: user.role } });
    } catch (err) { res.status(500).json({ error: "Server Error" }); }
};

exports.verifyEmail = async (req, res) => {
    /* ... logic from routes.js ... */
    res.json({ success: true });
};

exports.logout = (req, res) => {
    res.clearCookie('token');
    res.json({ message: "Logged out" });
};