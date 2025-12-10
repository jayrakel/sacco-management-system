// backend/index.js
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet'); 
const cookieParser = require('cookie-parser'); 
const bcrypt = require('bcrypt');
const db = require('./db');
const path = require('path');
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

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
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
const historyRoutes = require('./modules/management/history.routes');
const routes = require('./modules/management/routes');
const cmsRoutes = require('./modules/cms/routes');

// --- NEW ASSET & EXPENSE ROUTES ---
const router = express.Router();
const { authenticateUser } = require('./modules/auth/middleware');

// Assets Route
router.get('/assets', authenticateUser, async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM fixed_assets WHERE status = 'ACTIVE' ORDER BY created_at DESC");
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/assets', authenticateUser, async (req, res) => {
    try {
        const { name, type, value, location, description } = req.body;
        await db.query(
            "INSERT INTO fixed_assets (name, type, value, location, description, added_by) VALUES ($1, $2, $3, $4, $5, $6)",
            [name, type, value, location, description, req.user.id]
        );
        res.json({ message: "Asset added" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Expenses Route
router.get('/expenses', authenticateUser, async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM operational_expenses ORDER BY expense_date DESC");
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/expenses', authenticateUser, async (req, res) => {
    try {
        const { title, category, amount, description, receipt_ref } = req.body;
        await db.query(
            "INSERT INTO operational_expenses (title, category, amount, description, receipt_ref, incurred_by) VALUES ($1, $2, $3, $4, $5, $6)",
            [title, category, amount, description, receipt_ref, req.user.id]
        );
        res.json({ message: "Expense recorded" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.use('/api/auth', loginLimiter, authRoutes); 
app.use('/api/loan', apiLimiter, loanRoutes); 
app.use('/api/payments', apiLimiter, paymentRoutes); 
app.use('/api/deposits', apiLimiter, depositRoutes);
app.use('/api/settings', settingsModule.router); 
app.use('/api/reports', apiLimiter, reportRoutes);
app.use('/api/dividends', apiLimiter, dividendRoutes);
app.use('/api/advanced-reports', apiLimiter, advancedReportRoutes);
app.use('/api/management', apiLimiter, router); // Mount new routes under /management
app.use('/api/management', apiLimiter, routes);
app.use('/api/management/history', apiLimiter, historyRoutes);
app.use('/api/cms', apiLimiter, cmsRoutes);
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Internal System Error" });
});

// --- SYSTEM INITIALIZATION ---
const initializeSystem = async () => {
    try {
        await db.query('SELECT NOW()');
        console.log("✅ Database Connected");
        // Ensure Admin exists
        const result = await db.query("SELECT COUNT(*) FROM users");
        if (parseInt(result.rows[0].count) === 0) {
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