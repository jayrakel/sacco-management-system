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

// --- FIX: Trust Proxy for Render/Heroku Deployment ---
// This resolves the "X-Forwarded-For" error with express-rate-limit
app.set('trust proxy', 1); 

// --- FIX: Normalize Origin (Remove trailing slash if present) ---
const rawOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
const ALLOWED_ORIGIN = rawOrigin.endsWith('/') ? rawOrigin.slice(0, -1) : rawOrigin;

console.log(`🔒 CORS Policy Enabled for Origin: ${ALLOWED_ORIGIN}`);

// 1. Security Middleware
app.use(helmet()); 
app.use(cors({ 
    origin: ALLOWED_ORIGIN, 
    credentials: true, 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// UPDATED: Increase body limit for image uploads (10MB)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use(cookieParser()); 

// 2. Rate Limiting
const loginLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, 
    max: 100,
    message: { error: "Too many login attempts, please try again later." }
});

const apiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, 
    max: 100, 
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

// --- ROUTES ---
app.use('/api/auth', loginLimiter, authRoutes); 
app.use('/api/loan', apiLimiter, loanRoutes); 
app.use('/api/payments', apiLimiter, paymentRoutes); 
app.use('/api/deposits', apiLimiter, depositRoutes);
app.use('/api/settings', settingsModule.router); 
app.use('/api/reports', apiLimiter, reportRoutes);

// --- ERROR HANDLING ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Internal System Error" });
});

// --- INITIALIZATION LOGIC ---
const initializeSystem = async () => {
    try {
        await db.query('SELECT NOW()');
        console.log("✅ Database Connected");

        const result = await db.query("SELECT COUNT(*) FROM users");
        if (parseInt(result.rows[0].count) === 0) {
            console.log("⚠️ No users found. Initializing System...");
            const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
            if (adminPassword) {
                const hash = await bcrypt.hash(adminPassword, 10);
                
                // UPDATED: Set 'must_change_password' to true for the first admin
                await db.query(
                    `INSERT INTO users (full_name, email, password_hash, role, phone_number, must_change_password) 
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    ['System Administrator', 'admin@sacco.com', hash, 'ADMIN', '0700000000', true]
                );
                console.log("✅ DEFAULT ADMIN CREATED (Password Change Required)");
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