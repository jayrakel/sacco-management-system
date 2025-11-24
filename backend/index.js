const express = require('express');
const cors = require('cors');
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

app.listen(PORT, () => {
    console.log(`🚀 Server running securely on port ${PORT}`);
});