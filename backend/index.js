const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Global Middleware (Runs for every request)
app.use(cors());
app.use(express.json());

// 2. Mock Authentication Middleware
// Since we are debugging modules, we hardcode User ID 1.
// In production, this would be: app.use(verifyJwtToken);
const attachMockUser = (req, res, next) => {
    req.user = { id: 1, role: 'MEMBER' }; 
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - User: ${req.user.id}`);
    next();
};
app.use(attachMockUser);

// --- MODULE REGISTRATION ---

// A. Auth Module
// Routes: POST /auth/login
const authRoutes = require('./modules/auth/routes');
app.use('/auth', authRoutes);

// B. Loan Module
// Routes: GET /api/loan/status, POST /api/loan/init, POST /api/loan/submit
const loanRoutes = require('./modules/loans/routes');
app.use('/api/loan', loanRoutes);

// C. Payment Module
// Routes: POST /api/payment/pay-fee
const paymentRoutes = require('./modules/payments/routes');
app.use('/api/payment', paymentRoutes);

// --- SYSTEM HEALTH & ERRORS ---

// Health Check
app.get('/', (req, res) => {
    res.send("Sacco System Backend: Online & Modular");
});

// Global Error Handler (Catches crashes in any module)
app.use((err, req, res, next) => {
    console.error("CRITICAL SYSTEM ERROR:", err.stack);
    res.status(500).json({ 
        error: "Internal System Error", 
        message: err.message 
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`\n🚀 MAIN SERVER STARTED ON PORT ${PORT}`);
    console.log(`   ---------------------------------`);
    console.log(`   ✅ Auth Module    : /auth`);
    console.log(`   ✅ Loan Module    : /api/loan`);
    console.log(`   ✅ Payment Module : /api/payment`);
    console.log(`   ---------------------------------\n`);
});