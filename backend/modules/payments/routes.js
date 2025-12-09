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
    type: Joi.string().valid('REGISTRATION_FEE', 'FINE', 'PENALTY', 'DEPOSIT', 'SHARE_CAPITAL', 'LOAN_FORM_FEE', 'FEE_PAYMENT').required(),
    amount: Joi.number().positive().required(),
    description: Joi.string().optional().allow(''),
    reference: Joi.string().optional().allow('', null) 
});

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
//  1. EXTERNAL WEBHOOK (THE "REAL" LISTENER)
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

        console.log(`[Webhook] Received ${amount} with Ref ${reference}. Marked as UNCLAIMED.`);
        res.json({ success: true, message: "Transaction received" });

    } catch (err) {
        console.error("Webhook Error:", err);
        res.status(500).json({ error: "Server Error" });
    }
});

// ==========================================
//  2. MEMBER CLAIMING (DIRECT PAYBILL)
// ==========================================
router.post('/mpesa/manual', authenticateUser, async (req, res) => {
    const { reference } = req.body;
    
    if (!reference) return res.status(400).json({ error: "Reference Code is required." });

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const check = await client.query(
            "SELECT id, amount, status FROM transactions WHERE reference_code = $1", 
            [reference]
        );

        if (check.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Transaction not found. Please wait for the bank to process it or check the code." });
        }

        const tx = check.rows[0];

        if (tx.status === 'COMPLETED') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "This code has already been used." });
        }
        
        if (tx.status !== 'UNCLAIMED') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Cannot claim transaction. Current status: ${tx.status}` });
        }

        await client.query(
            "UPDATE transactions SET user_id = $1, status = 'COMPLETED', description = $2 WHERE id = $3",
            [req.user.id, `Direct Deposit Claimed: ${reference}`, tx.id]
        );

        await client.query(
            `INSERT INTO deposits (user_id, amount, type, transaction_ref, status) 
             VALUES ($1, $2, 'DEPOSIT', $3, 'COMPLETED')`,
            [req.user.id, tx.amount, reference]
        );

        await client.query('COMMIT');
        res.json({ 
            success: true, 
            message: `Success! KES ${parseFloat(tx.amount).toLocaleString()} added to your savings.` 
        });

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

    // RESTORED: No longer blocking localhost!
    const callbackUrl = process.env.MPESA_CALLBACK_URL || 'http://localhost:5000/api/payments/mpesa/callback';
    
    const { password, timestamp } = generatePassword();

    try {
        console.log(`[STK Push] Initiating... Phone: ${formattedPhone}, Amount: ${amount}, URL: ${callbackUrl}`);

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
                AccountReference: "SecureSacco",
                TransactionDesc: (type || "Payment").substring(0, 13) 
            },
            { headers: { Authorization: `Bearer ${req.mpesaToken}` } }
        );

        const checkoutReqId = stkRes.data.CheckoutRequestID;
        const merchantReqId = stkRes.data.MerchantRequestID;

        await db.query(
            `INSERT INTO transactions 
            (user_id, type, amount, status, reference_code, checkout_request_id, merchant_request_id, description) 
            VALUES ($1, $2, $3, 'PENDING', $4, $5, $6, 'M-Pesa STK Push Initiated')`,
            [req.user.id, type || 'DEPOSIT', amount, `PENDING-${checkoutReqId}`, checkoutReqId, merchantReqId]
        );

        res.json({ success: true, message: "STK Push sent to phone", checkoutReqId });

    } catch (err) {
        const errorData = err.response?.data || {};
        console.error("STK Push Failed Details:", errorData);
        
        let msg = "STK Push Failed.";
        
        // Even if Safaricom complains about the URL (500.001.1001), we can sometimes ignore it
        // BUT usually, 500.001.1001 means they REJECTED the request entirely.
        // If it worked before, your callback URL was likely valid format (http://...) even if unreachable.
        
        if (errorData.errorMessage) msg += ` ${errorData.errorMessage}`;
        res.status(500).json({ error: msg, details: errorData });
    }
});

// ==========================================
//  4. MPESA CALLBACK (Manual Trigger Compatible)
// ==========================================
router.post('/mpesa/callback', async (req, res) => {
    console.log("--- M-Pesa Callback Received ---");
    try {
        // Safe access to body
        const { Body } = req.body || {};
        if (!Body || !Body.stkCallback) {
            console.log("Invalid Body or Verification Ping. Responding 200 OK.");
            return res.sendStatus(200);
        }

        const { stkCallback } = Body;
        const checkoutReqId = stkCallback.CheckoutRequestID;
        const resultCode = stkCallback.ResultCode; 

        console.log(`Callback ID: ${checkoutReqId} | Result: ${resultCode}`);

        const txCheck = await db.query("SELECT * FROM transactions WHERE checkout_request_id = $1", [checkoutReqId]);
        if (txCheck.rows.length === 0) {
            console.log("Transaction not found locally.");
            return res.sendStatus(200);
        }
        const transaction = txCheck.rows[0];

        if (resultCode === 0) {
            // Success
            const items = stkCallback.CallbackMetadata?.Item || [];
            const mpesaReceipt = items.find(i => i.Name === 'MpesaReceiptNumber')?.Value || `MPESA-${Date.now()}`;

            const client = await db.pool.connect();
            try {
                await client.query('BEGIN');
                await client.query(
                    "UPDATE transactions SET status = 'COMPLETED', reference_code = $1, description = 'STK Confirmed' WHERE id = $2",
                    [mpesaReceipt, transaction.id]
                );
                
                // Only credit if it hasn't been credited yet
                const depCheck = await client.query("SELECT id FROM deposits WHERE transaction_ref = $1", [mpesaReceipt]);
                if (depCheck.rows.length === 0 && transaction.type === 'DEPOSIT') {
                    await client.query(
                        `INSERT INTO deposits (user_id, amount, type, transaction_ref, status) 
                         VALUES ($1, $2, 'DEPOSIT', $3, 'COMPLETED')`,
                        [transaction.user_id, transaction.amount, mpesaReceipt]
                    );
                }
                
                await client.query('COMMIT');
                console.log(`Transaction ${mpesaReceipt} confirmed.`);
            } catch (sqlErr) {
                await client.query('ROLLBACK');
                console.error("Callback SQL Error", sqlErr);
            } finally {
                client.release();
            }
        } else {
            // Failed/Cancelled
            await db.query("UPDATE transactions SET status = 'FAILED', description = $1 WHERE id = $2", [stkCallback.ResultDesc || 'User Cancelled', transaction.id]);
            console.log(`Transaction ${transaction.id} failed.`);
        }
        res.sendStatus(200);
    } catch (err) {
        console.error("Callback Error:", err);
        res.sendStatus(200);
    }
});

// ==========================================
//  5. BANK DEPOSIT (MANUAL REVIEW)
// ==========================================
router.post('/bank/deposit', authenticateUser, async (req, res) => {
    const { amount, reference, bankName } = req.body;
    if (!amount || !reference) return res.status(400).json({ error: "Details required" });

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const refCheck = await client.query("SELECT id FROM transactions WHERE reference_code = $1", [reference]);
        if (refCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "Reference Code already used." });
        }

        await client.query(
            `INSERT INTO transactions (user_id, type, amount, status, reference_code, description) 
             VALUES ($1, 'DEPOSIT', $2, 'PENDING', $3, $4)`,
            [req.user.id, amount, reference, `Bank: ${bankName}`]
        );

        await client.query(
            `INSERT INTO deposits (user_id, amount, type, transaction_ref, status) 
             VALUES ($1, $2, 'DEPOSIT', $3, 'PENDING')`,
            [req.user.id, amount, reference]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: "Bank deposit recorded. Waiting for Treasurer approval." });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Bank Deposit Error:", err);
        res.status(500).json({ error: "Failed to record bank deposit." });
    } finally {
        client.release();
    }
});

// ==========================================
//  6. PAYPAL DEPOSIT (MANUAL REVIEW)
// ==========================================
router.post('/paypal/deposit', authenticateUser, async (req, res) => {
    const { amount, reference } = req.body;
    if (!amount || !reference) return res.status(400).json({ error: "Details required" });

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const refCheck = await client.query("SELECT id FROM transactions WHERE reference_code = $1", [reference]);
        if (refCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "Transaction ID already used." });
        }

        await client.query(
            `INSERT INTO transactions (user_id, type, amount, status, reference_code, description) 
             VALUES ($1, 'DEPOSIT', $2, 'PENDING', $3, 'PayPal Transfer')`,
            [req.user.id, amount, reference]
        );

        await client.query(
            `INSERT INTO deposits (user_id, amount, type, transaction_ref, status) 
             VALUES ($1, $2, 'DEPOSIT', $3, 'PENDING')`,
            [req.user.id, amount, reference]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: "PayPal deposit recorded. Waiting for Treasurer approval." });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("PayPal Deposit Error:", err);
        res.status(500).json({ error: "Failed to record PayPal deposit." });
    } finally {
        client.release();
    }
});

// ==========================================
//  7. TREASURER VERIFICATION
// ==========================================
router.get('/admin/deposits/pending', authenticateUser, async (req, res) => {
    if (!['ADMIN', 'CHAIRPERSON', 'TREASURER'].includes(req.user.role)) return res.status(403).json({ error: "Access Denied" });
    try {
        const result = await db.query(
            `SELECT d.id, d.amount, d.transaction_ref, d.type, d.created_at, u.full_name, t.description 
             FROM deposits d
             JOIN users u ON d.user_id = u.id
             LEFT JOIN transactions t ON d.transaction_ref = t.reference_code
             WHERE d.status = 'PENDING'
             ORDER BY d.created_at ASC`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Fetch failed" });
    }
});

router.post('/admin/deposits/review', authenticateUser, async (req, res) => {
    if (!['ADMIN', 'CHAIRPERSON', 'TREASURER'].includes(req.user.role)) return res.status(403).json({ error: "Access Denied" });
    
    const { depositId, decision } = req.body; 
    if (!['COMPLETED', 'REJECTED'].includes(decision)) return res.status(400).json({ error: "Invalid decision" });

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const depRes = await client.query("SELECT transaction_ref FROM deposits WHERE id = $1", [depositId]);
        if (depRes.rows.length === 0) throw new Error("Deposit not found");
        const ref = depRes.rows[0].transaction_ref;

        await client.query("UPDATE deposits SET status = $1 WHERE id = $2", [decision, depositId]);
        await client.query("UPDATE transactions SET status = $1 WHERE reference_code = $2", [decision, ref]);

        await client.query('COMMIT');
        res.json({ success: true, message: `Deposit ${decision}` });

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: "Action failed" });
    } finally {
        client.release();
    }
});

// ==========================================
//  8. STANDARD PAYMENT ROUTES
// ==========================================
router.post('/pay-fee', authenticateUser, validate(paymentSchema), async (req, res) => {
    const { loanAppId, mpesaRef } = req.body;
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');
        
        const loanCheck = await client.query("SELECT user_id FROM loan_applications WHERE id=$1", [loanAppId]);
        if (loanCheck.rows.length === 0) return res.status(404).json({ error: "Loan not found" });
        if (loanCheck.rows[0].user_id !== req.user.id) return res.status(403).json({ error: "Unauthorized payment" });

        const feeVal = await getSetting('loan_processing_fee');
        const feeAmount = parseFloat(feeVal) || 500;

        await client.query(
            `INSERT INTO transactions (user_id, type, amount, reference_code) 
             VALUES ($1, 'LOAN_FORM_FEE', $2, $3)`,
            [req.user.id, feeAmount, mpesaRef]
        );

        await client.query(
            `UPDATE loan_applications 
             SET status='FEE_PAID', fee_transaction_ref=$1, fee_amount=$2
             WHERE id=$3`,
            [mpesaRef, feeAmount, loanAppId]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: `Fee of KES ${feeAmount} paid.` });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        if (err.code === '23505') return res.status(400).json({ error: "Reference used." });
        res.status(500).json({ error: "Payment Failed" });
    } finally {
        client.release();
    }
});

router.post('/repay-loan', authenticateUser, validate(repaymentSchema), async (req, res) => {
    const { loanAppId, amount, mpesaRef } = req.body;
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');
        const loanRes = await client.query(
            `SELECT user_id, amount_requested, amount_repaid, status, total_due 
             FROM loan_applications WHERE id=$1`, 
            [loanAppId]
        );

        if (loanRes.rows.length === 0) return res.status(404).json({ error: "Loan not found" });
        const loan = loanRes.rows[0];

        if (loan.user_id !== req.user.id) return res.status(403).json({ error: "Unauthorized" });
        if (loan.status !== 'ACTIVE') return res.status(400).json({ error: "Loan not active" });

        const targetAmount = parseFloat(loan.total_due || loan.amount_requested);
        const currentPaid = parseFloat(loan.amount_repaid || 0);
        const repaymentAmt = parseFloat(amount);
        const newPaid = currentPaid + repaymentAmt;

        await client.query(
            `INSERT INTO transactions (user_id, type, amount, reference_code) 
             VALUES ($1, 'LOAN_REPAYMENT', $2, $3)`,
            [req.user.id, repaymentAmt, mpesaRef]
        );

        let newStatus = 'ACTIVE';
        if (newPaid >= targetAmount - 1) {
            newStatus = 'COMPLETED';
        }

        await client.query(
            `UPDATE loan_applications 
             SET amount_repaid = $1, status = $2, updated_at = NOW()
             WHERE id = $3`,
            [newPaid, newStatus, loanAppId]
        );

        await client.query('COMMIT');
        res.json({ 
            success: true, 
            message: newStatus === 'COMPLETED' ? "Loan fully repaid!" : "Repayment received.",
            balance: Math.max(0, targetAmount - newPaid)
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        if (err.code === '23505') return res.status(400).json({ error: "Reference code used." });
        res.status(500).json({ error: "Repayment Failed" });
    } finally {
        client.release();
    }
});

router.post('/admin/record', authenticateUser, validate(recordTransactionSchema), async (req, res) => {
    if (!['ADMIN', 'CHAIRPERSON', 'TREASURER'].includes(req.user.role)) {
        return res.status(403).json({ error: "Access Denied" });
    }

    let { userId, type, amount, reference, description } = req.body;
    
    if (!reference || reference.trim() === '') {
        reference = `AUTO-${type}-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 1000)}`;
    }

    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        const result = await client.query(
            `INSERT INTO transactions (user_id, type, amount, reference_code, description) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [userId, type, amount, reference, description]
        );

        if (type === 'DEPOSIT' || type === 'SHARE_CAPITAL') {
            await client.query(
                `INSERT INTO deposits (user_id, amount, type, transaction_ref, status) 
                 VALUES ($1, $2, $3, $4, 'COMPLETED')`,
                [userId, amount, type, reference] 
            );
        } 
        else if (type === 'FINE' || type === 'PENALTY') {
            const savingsRes = await client.query("SELECT SUM(amount) as total FROM deposits WHERE user_id = $1 AND type='DEPOSIT'", [userId]);
            const currentSavings = parseFloat(savingsRes.rows[0].total || 0);

            if (currentSavings > 0) {
                const deductionAmount = -Math.abs(amount); 
                const deductRef = `DEDUCT-${reference}`;
                
                await client.query(
                    `INSERT INTO deposits (user_id, amount, type, transaction_ref, status) 
                     VALUES ($1, $2, 'DEPOSIT', $3, 'COMPLETED')`, 
                    [userId, deductionAmount, deductRef]
                );
            }
        }

        if (type === 'LOAN_FORM_FEE' || type === 'FEE_PAYMENT') {
            const recentLoan = await client.query(
                `SELECT id FROM loan_applications 
                 WHERE user_id = $1 AND status = 'FEE_PENDING' 
                 ORDER BY created_at DESC LIMIT 1`,
                [userId]
            );

            if (recentLoan.rows.length > 0) {
                const loanId = recentLoan.rows[0].id;
                await client.query(
                    `UPDATE loan_applications 
                     SET status='FEE_PAID', fee_transaction_ref=$1, fee_amount=$2
                     WHERE id=$3`,
                    [reference, amount, loanId]
                );
            }
        }

        await client.query('COMMIT');
        res.json({ success: true, transaction: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        if (err.code === '23505') return res.status(400).json({ error: "Reference code already exists" });
        res.status(500).json({ error: "Failed to record transaction" });
    } finally {
        client.release();
    }
});

router.post('/admin/run-weekly-compliance', authenticateUser, async (req, res) => {
    if (!['ADMIN', 'CHAIRPERSON'].includes(req.user.role)) return res.status(403).json({ error: "Access Denied" });

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const minDepositVal = await getSetting('min_weekly_deposit');
        const penaltyVal = await getSetting('penalty_missed_savings');
        const minDeposit = parseFloat(minDepositVal) || 250;
        const penaltyAmount = parseFloat(penaltyVal) || 50;

        const complianceQuery = `
            SELECT u.id 
            FROM users u
            WHERE u.role = 'MEMBER'
            AND u.id NOT IN (
                SELECT user_id FROM transactions 
                WHERE type = 'DEPOSIT' 
                AND created_at >= date_trunc('week', CURRENT_DATE)
                GROUP BY user_id
                HAVING SUM(amount) >= $1
            )
            AND u.id NOT IN (
                SELECT user_id FROM transactions 
                WHERE type = 'FINE' 
                AND description LIKE 'Missed Weekly Deposit%'
                AND created_at >= date_trunc('week', CURRENT_DATE)
            )
        `;

        const nonCompliant = await client.query(complianceQuery, [minDeposit]);
        
        if (nonCompliant.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.json({ message: "Compliance Check Complete. Everyone is up to date!", count: 0 });
        }

        const weekStr = new Date().toLocaleDateString('en-GB', { week: 'numeric', year: 'numeric' });
        let deductedCount = 0;

        for (const user of nonCompliant.rows) {
            const ref = `AUTO-FINE-${user.id}-${Date.now().toString().slice(-6)}`;
            
            await client.query(
                `INSERT INTO transactions (user_id, type, amount, reference_code, description) 
                 VALUES ($1, 'FINE', $2, $3, $4)`,
                [user.id, penaltyAmount, ref, `Missed Weekly Deposit (Week ${weekStr})`]
            );

            const savingsRes = await client.query("SELECT SUM(amount) as total FROM deposits WHERE user_id = $1", [user.id]);
            const currentSavings = parseFloat(savingsRes.rows[0].total || 0);

            if (currentSavings > 0) {
                await client.query(
                    `INSERT INTO deposits (user_id, amount, type, transaction_ref, status) 
                     VALUES ($1, $2, 'DEPOSIT', $3, 'COMPLETED')`,
                    [user.id, -penaltyAmount, `DEDUCT-${ref}`]
                );
                deductedCount++;
            }
        }

        await client.query('COMMIT');
        res.json({ 
            success: true, 
            message: `Compliance Check: Fined ${nonCompliant.rows.length} members. Deducted from ${deductedCount} accounts.`, 
            count: nonCompliant.rows.length 
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Compliance Error", err);
        res.status(500).json({ error: "Compliance check failed" });
    } finally {
        client.release();
    }
});

router.get('/admin/all', authenticateUser, (req, res, next) => {
    if (['ADMIN', 'CHAIRPERSON', 'TREASURER'].includes(req.user.role)) next();
    else res.status(403).json({ error: "Access Denied" });
}, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT t.*, u.full_name 
             FROM transactions t 
             JOIN users u ON t.user_id = u.id 
             ORDER BY t.created_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Could not fetch transactions" });
    }
});

module.exports = router;