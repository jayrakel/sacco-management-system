const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateUser, requireRole } = require('../auth/middleware');
const { validate, paymentSchema, repaymentSchema } = require('../common/validation');
const { getSetting } = require('../settings/routes'); 
const Joi = require('joi');
const axios = require('axios');

// Validation for Manual Recording (Admin)
const recordTransactionSchema = Joi.object({
    userId: Joi.number().required(),
    type: Joi.string().required(),
    amount: Joi.number().positive().required(),
    description: Joi.string().optional().allow(''),
    reference: Joi.string().optional().allow('', null) 
});

// ==========================================
//  HELPER: DEPOSIT ROUTING SYSTEM
//  Flow: Incoming -> General Savings -> Target Account
// ==========================================
const processCompletedTransaction = async (client, transaction) => {
    const { id, user_id, type, amount, reference_code } = transaction;
    
    // SAFEGUARDS
    const safeType = type || 'DEPOSIT'; // Handle null type
    const safeRef = reference_code.substring(0, 40); // Ensure ref fits in deposits table (50 chars max including prefix)
    
    console.log(`[Router] Processing: ${safeType} for User ${user_id} - KES ${amount}`);

    // STEP 1: ALWAYS CREDIT GENERAL DEPOSIT ACCOUNT FIRST
    const depositRef = `DEP-${safeRef}`;
    await client.query(
        `INSERT INTO deposits (user_id, amount, type, transaction_ref, status, description) 
         VALUES ($1, $2, 'DEPOSIT', $3, 'COMPLETED', $4)
         ON CONFLICT (transaction_ref) DO NOTHING`, 
        [user_id, amount, depositRef, `Incoming Funds: ${safeType}`]
    );

    // If purpose is purely Savings (DEPOSIT), stop here.
    if (safeType === 'DEPOSIT') {
        console.log(`[Router] Funds retained in General Savings.`);
        return;
    }

    // STEP 2: DEDUCT FROM GENERAL ACCOUNT (ROUTING)
    const transferRef = `TRF-${safeRef}`;
    // Use ON CONFLICT DO NOTHING to prevent crashes if run multiple times
    await client.query(
        `INSERT INTO deposits (user_id, amount, type, transaction_ref, status, description) 
         VALUES ($1, $2, 'DEPOSIT', $3, 'COMPLETED', $4)
         ON CONFLICT (transaction_ref) DO NOTHING`,
        [user_id, -amount, transferRef, `Transfer to: ${safeType.replace(/_/g, ' ')}`]
    );

    // STEP 3: CREDIT TARGET ACCOUNT (Logic Branch)
    console.log(`[Router] Routing funds to ${safeType}...`);

    if (safeType === 'SHARE_CAPITAL') {
        await client.query(
            `INSERT INTO deposits (user_id, amount, type, transaction_ref, status, description) 
             VALUES ($1, $2, 'SHARE_CAPITAL', $3, 'COMPLETED', 'Purchase of Shares')
             ON CONFLICT (transaction_ref) DO NOTHING`, // Prevent duplicate error
            [user_id, amount, safeRef]
        );
    } 
    else if (safeType === 'LOAN_REPAYMENT') {
        const loanRes = await client.query(
            "SELECT id, amount_repaid, total_due, amount_requested FROM loan_applications WHERE user_id = $1 AND status = 'ACTIVE' ORDER BY created_at ASC LIMIT 1",
            [user_id]
        );
        if (loanRes.rows.length > 0) {
            const loan = loanRes.rows[0];
            const newPaid = parseFloat(loan.amount_repaid) + parseFloat(amount);
            const total = parseFloat(loan.total_due || loan.amount_requested);
            let newStatus = 'ACTIVE';
            if (newPaid >= total - 5) newStatus = 'COMPLETED';

            await client.query(
                "UPDATE loan_applications SET amount_repaid = $1, status = $2, updated_at = NOW() WHERE id = $3",
                [newPaid, newStatus, loan.id]
            );
            console.log(`[Router] Loan #${loan.id} repayment processed.`);
        } else {
            console.log("[Router] No active loan found. Refunding to Savings.");
            await client.query(
                `INSERT INTO deposits (user_id, amount, type, transaction_ref, status, description) 
                 VALUES ($1, $2, 'DEPOSIT', $3, 'COMPLETED', 'Refund: No Active Loan Found')
                 ON CONFLICT (transaction_ref) DO NOTHING`,
                [user_id, amount, `RFD-${safeRef}`]
            );
        }
    }
    else if (safeType === 'LOAN_FORM_FEE' || safeType === 'FEE_PAYMENT') {
        const loanRes = await client.query(
            "SELECT id FROM loan_applications WHERE user_id = $1 AND status = 'FEE_PENDING' ORDER BY created_at DESC LIMIT 1",
            [user_id]
        );
        if (loanRes.rows.length > 0) {
            await client.query(
                "UPDATE loan_applications SET status = 'FEE_PAID', fee_transaction_ref = $1, fee_amount = $2 WHERE id = $3",
                [safeRef, amount, loanRes.rows[0].id]
            );
        } else {
             await client.query(
                `INSERT INTO deposits (user_id, amount, type, transaction_ref, status, description) 
                 VALUES ($1, $2, 'DEPOSIT', $3, 'COMPLETED', 'Refund: No Pending Fee Found')
                 ON CONFLICT (transaction_ref) DO NOTHING`,
                [user_id, amount, `RFD-${safeRef}`]
            );
        }
    }
    else if (safeType === 'PENALTY' || safeType === 'FINE') {
        console.log("[Router] Penalty payment absorbed.");
    }
    else {
        // --- DYNAMIC CATEGORY HANDLER ---
        // Check if this type exists in our custom categories table
        const catCheck = await client.query("SELECT name, description FROM contribution_categories WHERE name = $1 AND is_active = TRUE", [safeType]);
        
        if (catCheck.rows.length > 0) {
            const category = catCheck.rows[0];
            // Credit the custom bucket (stored in deposits with the custom TYPE)
            await client.query(
                `INSERT INTO deposits (user_id, amount, type, transaction_ref, status, description) 
                 VALUES ($1, $2, $3, $4, 'COMPLETED', $5)
                 ON CONFLICT (transaction_ref) DO NOTHING`,
                [user_id, amount, safeType, safeRef, `Contribution: ${category.description}`]
            );
            console.log(`[Router] Routed to Custom Category: ${category.name}`);
        } else {
            console.warn(`[Router] Unknown type ${safeType}. Refunding to General Savings.`);
            // Refund the debit we just made in Step 2
             await client.query(
                `INSERT INTO deposits (user_id, amount, type, transaction_ref, status, description) 
                 VALUES ($1, $2, 'DEPOSIT', $3, 'COMPLETED', 'Refund: Unknown Category')
                 ON CONFLICT (transaction_ref) DO NOTHING`,
                [user_id, amount, `RFD-${safeRef}`]
            );
        }
    }
};

// ==========================================
//  MPESA UTILITIES
// ==========================================
const getMpesaToken = async (req, res, next) => {
    try {
        const consumer = process.env.MPESA_CONSUMER_KEY;
        const secret = process.env.MPESA_CONSUMER_SECRET;
        if (!consumer || !secret) return res.status(500).json({ error: "Server Config Error: Missing MPESA Keys" });

        const auth = Buffer.from(`${consumer}:${secret}`).toString('base64');
        const response = await axios.get(
            'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
            { headers: { Authorization: `Basic ${auth}` } }
        );
        req.mpesaToken = response.data.access_token;
        next();
    } catch (err) {
        console.error("M-Pesa Token Error:", err.message);
        res.status(500).json({ error: "Payment Gateway Error" });
    }
};

const generatePassword = () => {
    const shortCode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    const date = new Date();
    const timestamp = date.getFullYear() +
        ("0" + (date.getMonth() + 1)).slice(-2) +
        ("0" + date.getDate()).slice(-2) +
        ("0" + date.getHours()).slice(-2) +
        ("0" + date.getMinutes()).slice(-2) +
        ("0" + date.getSeconds()).slice(-2);
    const password = Buffer.from(shortCode + passkey + timestamp).toString('base64');
    return { password, timestamp };
};

// ==========================================
//  1. EXTERNAL WEBHOOK
// ==========================================
router.post('/webhook/receive', async (req, res) => {
    const { reference, amount, method, sender } = req.body;
    if (!reference || !amount) return res.status(400).json({ error: "Missing data" });

    try {
        const check = await db.query("SELECT id FROM transactions WHERE reference_code = $1", [reference]);
        if (check.rows.length > 0) return res.json({ message: "Already recorded" });

        await db.query(
            `INSERT INTO transactions (type, amount, status, reference_code, description) 
             VALUES ('DEPOSIT', $1, 'UNCLAIMED', $2, $3)`,
            [amount, reference, `Incoming from ${method || 'External'} (${sender || 'Unknown'})`]
        );

        res.json({ success: true, message: "Transaction received" });
    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

// ==========================================
//  2. MEMBER CLAIMING (ROUTING TRIGGER)
// ==========================================
router.post('/mpesa/manual', authenticateUser, async (req, res) => {
    const { reference, purpose } = req.body; 
    if (!reference) return res.status(400).json({ error: "Reference Code is required." });

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const check = await client.query("SELECT * FROM transactions WHERE reference_code = $1", [reference]);
        if (check.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Transaction not found." });
        }

        const tx = check.rows[0];
        if (tx.status === 'COMPLETED') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "Already claimed." });
        }

        // Apply selected purpose or default
        const finalType = purpose || tx.type || 'DEPOSIT';

        await client.query(
            "UPDATE transactions SET user_id = $1, status = 'COMPLETED', type = $2, description = $3 WHERE id = $4",
            [req.user.id, finalType, `Manual Claim: ${reference}`, tx.id]
        );

        // RUN ROUTING LOGIC
        await processCompletedTransaction(client, { ...tx, user_id: req.user.id, type: finalType });

        await client.query('COMMIT');
        res.json({ success: true, message: `Payment claimed and routed.` });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Claim Error:", err);
        res.status(500).json({ error: "Verification failed." });
    } finally {
        client.release();
    }
});

// ==========================================
//  3. STK PUSH (AUTOMATED)
// ==========================================
router.post('/mpesa/stk-push', authenticateUser, getMpesaToken, async (req, res) => {
    const { amount, phoneNumber, type } = req.body; 
    let formattedPhone = phoneNumber.startsWith('0') ? '254' + phoneNumber.slice(1) : phoneNumber;
    
    if (!formattedPhone.startsWith('254')) return res.status(400).json({ error: "Invalid Phone. Use 254..." });

    const callbackUrl = process.env.MPESA_CALLBACK_URL || 'http://localhost:5000/api/payments/mpesa/callback';
    const { password, timestamp } = generatePassword();

    try {
        const stkRes = await axios.post(
            'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
            {
                BusinessShortCode: process.env.MPESA_SHORTCODE,
                Password: password,
                Timestamp: timestamp,
                TransactionType: "CustomerPayBillOnline",
                Amount: Math.ceil(amount),
                PartyA: formattedPhone,
                PartyB: process.env.MPESA_SHORTCODE,
                PhoneNumber: formattedPhone,
                CallBackURL: callbackUrl,
                AccountReference: "SaccoPayment",
                TransactionDesc: (type || "Payment").substring(0, 13) 
            },
            { headers: { Authorization: `Bearer ${req.mpesaToken}` } }
        );

        const checkoutReqId = stkRes.data.CheckoutRequestID;
        const merchantReqId = stkRes.data.MerchantRequestID;

        await db.query(
            `INSERT INTO transactions 
            (user_id, type, amount, status, reference_code, checkout_request_id, merchant_request_id, description) 
            VALUES ($1, $2, $3, 'PENDING', $4, $5, $6, $7)`,
            [req.user.id, type || 'DEPOSIT', amount, `PENDING-${checkoutReqId}`, checkoutReqId, merchantReqId, `M-Pesa STK: ${type}`]
        );

        res.json({ success: true, message: "STK Push sent.", checkoutReqId });

    } catch (err) {
        res.status(500).json({ error: "STK Push Failed", details: err.response?.data });
    }
});

// ==========================================
//  4. MPESA CALLBACK
// ==========================================
router.post('/mpesa/callback', async (req, res) => {
    try {
        const { Body } = req.body || {};
        if (!Body || !Body.stkCallback) return res.sendStatus(200);

        const { stkCallback } = Body;
        const checkoutReqId = stkCallback.CheckoutRequestID;
        const resultCode = stkCallback.ResultCode; 

        const txCheck = await db.query("SELECT * FROM transactions WHERE checkout_request_id = $1", [checkoutReqId]);
        if (txCheck.rows.length === 0) return res.sendStatus(200);
        
        const transaction = txCheck.rows[0];

        if (resultCode === 0) {
            const items = stkCallback.CallbackMetadata?.Item || [];
            const mpesaReceipt = items.find(i => i.Name === 'MpesaReceiptNumber')?.Value || `MPESA-${Date.now()}`;

            const client = await db.pool.connect();
            try {
                await client.query('BEGIN');
                await client.query(
                    "UPDATE transactions SET status = 'COMPLETED', reference_code = $1, description = $2 WHERE id = $3",
                    [mpesaReceipt, `STK Confirmed: ${transaction.type}`, transaction.id]
                );
                
                // EXECUTE ROUTING LOGIC
                await processCompletedTransaction(client, { ...transaction, reference_code: mpesaReceipt });
                
                await client.query('COMMIT');
            } catch (sqlErr) {
                await client.query('ROLLBACK');
                console.error("Callback SQL Error", sqlErr);
            } finally {
                client.release();
            }
        } else {
            await db.query("UPDATE transactions SET status = 'FAILED', description = $1 WHERE id = $2", [stkCallback.ResultDesc || 'User Cancelled', transaction.id]);
        }
        res.sendStatus(200);
    } catch (err) {
        res.sendStatus(200);
    }
});

// ==========================================
//  5. BANK & PAYPAL DEPOSITS (With Purpose)
// ==========================================
router.post('/bank/deposit', authenticateUser, async (req, res) => {
    const { amount, reference, bankName, type } = req.body;
    if (!amount || !reference) return res.status(400).json({ error: "Details required" });

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(
            `INSERT INTO transactions (user_id, type, amount, status, reference_code, description) 
             VALUES ($1, $2, $3, 'PENDING', $4, $5)`,
            [req.user.id, type || 'DEPOSIT', amount, reference, `Bank: ${bankName}`]
        );
        await client.query('COMMIT');
        res.json({ success: true, message: "Recorded. Waiting for Treasurer approval." });
    } catch (err) {
        await client.query('ROLLBACK');
        if(err.code === '23505') return res.status(400).json({error: "Ref Code used"});
        res.status(500).json({ error: "Failed to record." });
    } finally {
        client.release();
    }
});

router.post('/paypal/deposit', authenticateUser, async (req, res) => {
    const { amount, reference, type } = req.body;
    if (!amount || !reference) return res.status(400).json({ error: "Details required" });

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(
            `INSERT INTO transactions (user_id, type, amount, status, reference_code, description) 
             VALUES ($1, $2, $3, 'PENDING', $4, 'PayPal Transfer')`,
            [req.user.id, type || 'DEPOSIT', amount, reference]
        );
        await client.query('COMMIT');
        res.json({ success: true, message: "Recorded. Waiting for Treasurer approval." });
    } catch (err) {
        await client.query('ROLLBACK');
        if(err.code === '23505') return res.status(400).json({error: "Ref Code used"});
        res.status(500).json({ error: "Failed to record." });
    } finally {
        client.release();
    }
});

// ==========================================
//  6. ADMIN REVIEW (Executes Routing)
// ==========================================
router.get('/admin/deposits/pending', authenticateUser, async (req, res) => {
    if (!['ADMIN', 'CHAIRPERSON', 'TREASURER'].includes(req.user.role)) return res.status(403).json({ error: "Access Denied" });
    try {
        const result = await db.query(
            `SELECT t.id, t.amount, t.reference_code, t.type, t.created_at, u.full_name, t.description 
             FROM transactions t
             JOIN users u ON t.user_id = u.id
             WHERE t.status = 'PENDING'
             ORDER BY t.created_at ASC`
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Fetch failed" }); }
});

router.post('/admin/deposits/review', authenticateUser, async (req, res) => {
    if (!['ADMIN', 'CHAIRPERSON', 'TREASURER'].includes(req.user.role)) return res.status(403).json({ error: "Access Denied" });
    
    const { transactionId, decision } = req.body; 
    if (!['COMPLETED', 'REJECTED'].includes(decision)) return res.status(400).json({ error: "Invalid decision" });

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const txRes = await client.query("SELECT * FROM transactions WHERE id = $1", [transactionId]);
        if (txRes.rows.length === 0) throw new Error("Transaction not found");
        const tx = txRes.rows[0];

        await client.query("UPDATE transactions SET status = $1 WHERE id = $2", [decision, transactionId]);

        // IF APPROVED, RUN ROUTING
        if (decision === 'COMPLETED') {
            await processCompletedTransaction(client, tx);
        }

        await client.query('COMMIT');
        res.json({ success: true, message: `Transaction ${decision}` });
    } catch (err) {
        console.error("Review Error:", err); // Log the actual error to the console
        await client.query('ROLLBACK');
        res.status(500).json({ error: "Action failed: " + err.message }); // Return message to client for debugging
    } finally {
        client.release();
    }
});

// Legacy routes
router.post('/pay-fee', authenticateUser, async (req, res) => { res.status(400).json({error: "Use Deposit route with 'Fee' purpose"}); });
router.post('/repay-loan', authenticateUser, async (req, res) => { res.status(400).json({error: "Use Deposit route with 'Repayment' purpose"}); });

// Admin Manual Record (Updated for dynamic types)
router.post('/admin/record', authenticateUser, validate(recordTransactionSchema), async (req, res) => {
    if (!['ADMIN', 'CHAIRPERSON', 'TREASURER'].includes(req.user.role)) return res.status(403).json({ error: "Access Denied" });

    let { userId, type, amount, reference, description } = req.body;
    if (!reference || reference.trim() === '') reference = `AUTO-${Date.now()}`;

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query(
            `INSERT INTO transactions (user_id, type, amount, reference_code, description, status) 
             VALUES ($1, $2, $3, $4, $5, 'COMPLETED') RETURNING *`,
            [userId, type, amount, reference, description]
        );
        
        await processCompletedTransaction(client, result.rows[0]);

        await client.query('COMMIT');
        res.json({ success: true, transaction: result.rows[0] });
    } catch (err) {
        console.error("Admin Record Error:", err);
        await client.query('ROLLBACK');
        res.status(500).json({ error: "Failed to record" });
    } finally { client.release(); }
});

router.get('/admin/all', authenticateUser, async (req, res) => {
    try {
        const result = await db.query(`SELECT t.*, u.full_name FROM transactions t JOIN users u ON t.user_id = u.id ORDER BY t.created_at DESC`);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Error" }); }
});

module.exports = router;