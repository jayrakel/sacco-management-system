const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt'); // Import bcrypt
const db = require('./db'); // Import DB connection
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require('./modules/auth/routes');
const loanRoutes = require('./modules/loans/routes');
const paymentRoutes = require('./modules/payments/routes');

app.use('/auth', authRoutes);
app.use('/api/loan', loanRoutes);
app.use('/api/payment', paymentRoutes);

app.get('/', (req, res) => res.send("Secure Sacco Backend Online"));

// --- INITIALIZATION LOGIC ---
const initializeSystem = async () => {
    try {
        const result = await db.query("SELECT COUNT(*) FROM users");
        const userCount = parseInt(result.rows[0].count);

        if (userCount === 0) {
            console.log("⚠️ No users found. Initializing System...");
            
            // Create Default Admin
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash("admin123", salt); // DEFAULT PASSWORD: admin123

            await db.query(
                `INSERT INTO users (full_name, email, password_hash, role, phone_number) 
                 VALUES ($1, $2, $3, $4, $5)`,
                ['System Administrator', 'admin@sacco.com', hash, 'ADMIN', '0000000000']
            );

            console.log("✅ DEFAULT ADMIN CREATED:");
            console.log("   📧 Email: admin@sacco.com");
            console.log("   🔑 Pass:  admin123");
            console.log("   (Please change this password immediately in production)");
        }
    } catch (err) {
        console.error("❌ System Initialization Failed:", err.message);
    }
};

app.listen(PORT, async () => {
    await initializeSystem(); // Run the check before starting
    console.log(`🚀 Server running securely on port ${PORT}`);
});