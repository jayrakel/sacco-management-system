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

// 1. Security Middleware
app.use(helmet()); 
app.use(cors({ 
    origin: 'http://localhost:5173', // Ensure this matches your Frontend URL
    credentials: true 
}));
app.use(express.json());
app.use(cookieParser()); 

// 2. Rate Limiting
const loginLimiter = rateLimit({
    windowMs: 30 * 60 * 1000, 
    max: 5, 
    message: { error: "Too many login attempts, please try again later." }
});

const apiLimiter = rateLimit({
    windowMs: 30 * 60 * 1000, 
    max: 100, 
    standardHeaders: true,
    legacyHeaders: false,
});

// --- MODULES ---
const authRoutes = require('./modules/auth/routes');
const loanRoutes = require('./modules/loans/routes');
const paymentRoutes = require('./modules/payments/routes');
const depositRoutes = require('./modules/deposits/routes');

// --- ROUTES ---
// FIX: Changed '/auth' to '/api/auth' to be consistent with AdminDashboard and other API routes
app.use('/api/auth', loginLimiter, authRoutes); 
app.use('/api/loan', apiLimiter, loanRoutes); 
app.use('/api/payment', apiLimiter, paymentRoutes); 
app.use('/api/deposits', apiLimiter, depositRoutes); 

// --- ERROR HANDLING ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Internal System Error" });
});

// --- INITIALIZATION LOGIC ---
const initializeSystem = async () => {
    try {
        // Test DB connection
        await db.query('SELECT NOW()');
        console.log("✅ Database Connected");

        const result = await db.query("SELECT COUNT(*) FROM users");
        const userCount = parseInt(result.rows[0].count);

        if (userCount === 0) {
            console.log("⚠️ No users found. Initializing System...");
            
            const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
            
            if (!adminPassword) {
                console.error("❌ ERROR: Set INITIAL_ADMIN_PASSWORD in .env to create default admin.");
            } else {
                const salt = await bcrypt.genSalt(10);
                const hash = await bcrypt.hash(adminPassword, salt);

                await db.query(
                    `INSERT INTO users (full_name, email, password_hash, role, phone_number) 
                     VALUES ($1, $2, $3, $4, $5)`,
                    ['System Administrator', 'admin@sacco.com', hash, 'ADMIN', '0700000000']
                );
                console.log("✅ DEFAULT ADMIN CREATED: admin@sacco.com");
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