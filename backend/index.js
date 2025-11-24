const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Security Middleware
app.use(cors({ origin: 'http://localhost:5173' })); // Lock to frontend
app.use(express.json());

// 2. Rate Limiting (Stop Brute Force)
const loginLimiter = rateLimit({
    windowMs: 30 * 60 * 1000, // 15 minutes
    max: 5, 
    message: { error: "Too many login attempts, please try again later." }
});

// --- MODULES ---
const authRoutes = require('./modules/auth/routes');
const loanRoutes = require('./modules/loans/routes');
const paymentRoutes = require('./modules/payments/routes');

// Apply Routes (Limiter only on Auth)
app.use('/auth', loginLimiter, authRoutes);
app.use('/api/loan', loanRoutes);
app.use('/api/payment', paymentRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Internal System Error" });
});

// --- INITIALIZATION LOGIC ---
const initializeSystem = async () => {
    try {
        const result = await db.query("SELECT COUNT(*) FROM users");
        const userCount = parseInt(result.rows[0].count);

        if (userCount === 0) {
            console.log("⚠️ No users found. Initializing System...");
            
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash("admin123", salt);

            await db.query(
                `INSERT INTO users (full_name, email, password_hash, role, phone_number) 
                 VALUES ($1, $2, $3, $4, $5)`,
                ['System Administrator', 'admin@sacco.com', hash, 'ADMIN', '0000000000']
            );

            console.log("✅ DEFAULT ADMIN CREATED: admin@sacco.com / admin123");
        }
    } catch (err) {
        console.error("❌ System Init Failed:", err.message);
    }
};

app.listen(PORT, async () => {
    await initializeSystem();
    console.log(`🚀 Server running securely on port ${PORT}`);
});