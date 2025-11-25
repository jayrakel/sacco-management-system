const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet'); // New Security Package
const cookieParser = require('cookie-parser'); // New Security Package
const bcrypt = require('bcrypt');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Security Middleware
app.use(helmet()); // Protects against common attacks (XSS, Sniffing, etc.)
app.use(cors({ 
    origin: 'http://localhost:5173',
    credentials: true // Allow cookies to be sent from frontend
}));
app.use(express.json());
app.use(cookieParser()); // Parse secure cookies

// 2. Rate Limiting
// Stricter limit for logins (Brute Force Protection)
const loginLimiter = rateLimit({
    windowMs: 30 * 60 * 1000, // 30 minutes
    max: 5, 
    message: { error: "Too many login attempts, please try again later." }
});

// General limit for API calls (DoS Protection)
const apiLimiter = rateLimit({
    windowMs: 30 * 60 * 1000,
    max: 100, // 100 requests per 30 mins per IP
    standardHeaders: true,
    legacyHeaders: false,
});

// --- MODULES ---
const authRoutes = require('./modules/auth/routes');
const loanRoutes = require('./modules/loans/routes');
const paymentRoutes = require('./modules/payments/routes');

// Apply Routes
app.use('/auth', loginLimiter, authRoutes);
app.use('/api/loan', apiLimiter, loanRoutes); // Apply general limiter
app.use('/api/payment', apiLimiter, paymentRoutes); // Apply general limiter

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
            
            // CRITICAL FIX: Do not hardcode password
            const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
            
            if (!adminPassword) {
                console.error("❌ ERROR: Set INITIAL_ADMIN_PASSWORD in your .env file to create the default admin.");
                process.exit(1); // Stop server if secure config is missing
            }

            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(adminPassword, salt);

            await db.query(
                `INSERT INTO users (full_name, email, password_hash, role, phone_number) 
                 VALUES ($1, $2, $3, $4, $5)`,
                ['System Administrator', 'admin@sacco.com', hash, 'ADMIN', '0000000000']
            );

            console.log("✅ DEFAULT ADMIN CREATED: admin@sacco.com");
        }
    } catch (err) {
        console.error("❌ System Init Failed:", err.message);
    }
};

app.listen(PORT, async () => {
    await initializeSystem();
    console.log(`🚀 Server running securely on port ${PORT}`);
});