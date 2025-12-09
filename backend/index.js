// backend/index.js
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

app.set('trust proxy', 1); 

// Allow multiple origins
const allowedOrigins = [
  'http://localhost:5173',
  'https://sacco-management-system-azure.vercel.app',
  process.env.FRONTEND_URL
].filter(Boolean).map(url => url.replace(/\/$/, ""));

app.use(helmet()); 
app.use(cors({ 
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log(`🚫 Blocked CORS from: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    }, 
    credentials: true, 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser()); 

// Rate Limits
const loginLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 20, message: { error: "Too many login attempts." } });
const apiLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });

// Routes
const authRoutes = require('./modules/auth/routes');
const loanRoutes = require('./modules/loans'); 
const paymentRoutes = require('./modules/payments/routes');
const depositRoutes = require('./modules/deposits/routes');
const settingsModule = require('./modules/settings/routes');
const reportRoutes = require('./modules/reports/routes');
const dividendRoutes = require('./modules/dividends/routes');
const advancedReportRoutes = require('./modules/reports/advanced.routes');

app.use('/api/auth', loginLimiter, authRoutes); 
app.use('/api/loan', apiLimiter, loanRoutes); 
app.use('/api/payments', apiLimiter, paymentRoutes); 
app.use('/api/deposits', apiLimiter, depositRoutes);
app.use('/api/settings', settingsModule.router); 
app.use('/api/reports', apiLimiter, reportRoutes);
app.use('/api/dividends', apiLimiter, dividendRoutes);
app.use('/api/advanced-reports', apiLimiter, advancedReportRoutes);

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Internal System Error" });
});

// --- SYSTEM INITIALIZATION & AUTO-MIGRATION ---
const initializeSystem = async () => {
    try {
        await db.query('SELECT NOW()');
        console.log("✅ Database Connected");

        console.log("⚙️  Checking Database Schema...");
        // Auto-fix missing columns safely
        await db.query(`
            DO $$ 
            BEGIN 
                -- 1. Fix Transactions Table
                BEGIN
                    ALTER TABLE transactions ADD COLUMN status VARCHAR(50) DEFAULT 'COMPLETED';
                EXCEPTION WHEN duplicate_column THEN NULL; END;
                BEGIN
                    ALTER TABLE transactions ADD COLUMN merchant_request_id VARCHAR(100);
                EXCEPTION WHEN duplicate_column THEN NULL; END;
                BEGIN
                    ALTER TABLE transactions ADD COLUMN checkout_request_id VARCHAR(100);
                EXCEPTION WHEN duplicate_column THEN NULL; END;

                -- 2. Fix Users Table (Security & KYC)
                BEGIN
                    ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT FALSE;
                EXCEPTION WHEN duplicate_column THEN NULL; END;
                BEGIN
                    ALTER TABLE users ADD COLUMN is_email_verified BOOLEAN DEFAULT FALSE;
                EXCEPTION WHEN duplicate_column THEN NULL; END;
                BEGIN
                    ALTER TABLE users ADD COLUMN verification_token VARCHAR(255);
                EXCEPTION WHEN duplicate_column THEN NULL; END;
                BEGIN
                    ALTER TABLE users ADD COLUMN id_number VARCHAR(20);
                EXCEPTION WHEN duplicate_column THEN NULL; END;
                BEGIN
                    ALTER TABLE users ADD COLUMN kra_pin VARCHAR(20);
                EXCEPTION WHEN duplicate_column THEN NULL; END;
                BEGIN
                    ALTER TABLE users ADD COLUMN next_of_kin_name VARCHAR(100);
                EXCEPTION WHEN duplicate_column THEN NULL; END;
                BEGIN
                    ALTER TABLE users ADD COLUMN next_of_kin_phone VARCHAR(20);
                EXCEPTION WHEN duplicate_column THEN NULL; END;
                BEGIN
                    ALTER TABLE users ADD COLUMN next_of_kin_relation VARCHAR(50);
                EXCEPTION WHEN duplicate_column THEN NULL; END;
                BEGIN
                    ALTER TABLE users ADD COLUMN profile_image TEXT;
                EXCEPTION WHEN duplicate_column THEN NULL; END;

                -- 3. Fix Deposits Table (The cause of your error)
                BEGIN
                    ALTER TABLE deposits ADD COLUMN category VARCHAR(50) DEFAULT 'DEPOSIT';
                EXCEPTION WHEN duplicate_column THEN NULL; END;
            END $$;
        `);

        // Create Custom Contribution Categories Table if missing
        await db.query(`
            CREATE TABLE IF NOT EXISTS contribution_categories (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                description TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("✅ Schema Verified (Columns synced automatically)");

        // Create Default Admin if no users exist
        const result = await db.query("SELECT COUNT(*) FROM users");
        if (parseInt(result.rows[0].count) === 0) {
            console.log("⚠️ No users found. Creating Default Admin...");
            const hash = await bcrypt.hash('S@cc0_.Adm!n123', 10);
            await db.query(
                `INSERT INTO users (full_name, email, password_hash, role, phone_number, must_change_password, is_email_verified) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                ['System Administrator', 'admin@sacco.com', hash, 'ADMIN', '0700000000', true, true]
            );
            console.log("✅ DEFAULT ADMIN CREATED");
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