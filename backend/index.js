const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet'); 
const cookieParser = require('cookie-parser'); 
const bcrypt = require('bcrypt');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// --- CONFIG: Trust Proxy & CORS ---
app.set('trust proxy', 1); 

const rawOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
const ALLOWED_ORIGIN = rawOrigin.endsWith('/') ? rawOrigin.slice(0, -1) : rawOrigin;

console.log(`🔒 CORS Policy Enabled for Origin: ${ALLOWED_ORIGIN}`);

app.use(helmet()); 
app.use(cors({ 
    origin: ALLOWED_ORIGIN, 
    credentials: true, 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser()); 

// --- RATE LIMITING ---
const loginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes (Reduced from 30)
    max: 20, // Increased limit for testing
    message: { error: "Too many login attempts, please try again later." }
});

const apiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, 
    max: 200, 
    standardHeaders: true,
    legacyHeaders: false,
});

// --- MODULES ---
const authRoutes = require('./modules/auth/routes');
const loanRoutes = require('./modules/loans'); 
const paymentRoutes = require('./modules/payments/routes');
const depositRoutes = require('./modules/deposits/routes');
const settingsModule = require('./modules/settings/routes');
const reportRoutes = require('./modules/reports/routes'); 

app.use('/api/auth', loginLimiter, authRoutes); 
app.use('/api/loan', apiLimiter, loanRoutes); 
app.use('/api/payments', apiLimiter, paymentRoutes); 
app.use('/api/deposits', apiLimiter, depositRoutes);
app.use('/api/settings', settingsModule.router); 
app.use('/api/reports', apiLimiter, reportRoutes);

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Internal System Error" });
});

// --- SYSTEM INITIALIZATION & AUTO-MIGRATION ---
const initializeSystem = async () => {
    try {
        await db.query('SELECT NOW()');
        console.log("✅ Database Connected");

        // 1. AUTO-FIX: Add missing columns to 'transactions' table if they don't exist
        console.log("⚙️  Checking Database Schema...");
        await db.query(`
            DO $$ 
            BEGIN 
                BEGIN
                    ALTER TABLE transactions ADD COLUMN status VARCHAR(50) DEFAULT 'COMPLETED';
                EXCEPTION
                    WHEN duplicate_column THEN NULL;
                END;
                BEGIN
                    ALTER TABLE transactions ADD COLUMN merchant_request_id VARCHAR(100);
                EXCEPTION
                    WHEN duplicate_column THEN NULL;
                END;
                BEGIN
                    ALTER TABLE transactions ADD COLUMN checkout_request_id VARCHAR(100);
                EXCEPTION
                    WHEN duplicate_column THEN NULL;
                END;
                BEGIN
                    ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT FALSE;
                EXCEPTION
                    WHEN duplicate_column THEN NULL;
                END;
            END $$;
        `);
        console.log("✅ Schema Verified (Missing columns added automatically)");

        // 2. Check for Admin
        const result = await db.query("SELECT COUNT(*) FROM users");
        if (parseInt(result.rows[0].count) === 0) {
            console.log("⚠️ No users found. Creating Default Admin...");
            const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
            if (adminPassword) {
                const hash = await bcrypt.hash(adminPassword, 10);
                await db.query(
                    `INSERT INTO users (full_name, email, password_hash, role, phone_number, must_change_password) 
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    ['System Administrator', 'admin@sacco.com', hash, 'ADMIN', '0700000000', true]
                );
                console.log("✅ DEFAULT ADMIN CREATED");
            }
        }
    } catch (err) {
        console.error("❌ System Init Failed:", err.message);
    }
};

app.listen(PORT, async () => {
    await initializeSystem();
    console.log(`🚀 Server running securely on port ${PORT}`);
});

module.exports = app;