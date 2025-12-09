# 🔧 IMPLEMENTATION GUIDE: From Sandbox to Production

## 1. M-PESA STK PUSH - SANDBOX TO PRODUCTION

### Change #1: Update API Endpoint

**File:** `backend/modules/payments/routes.js` (Line 253)

**Current (Sandbox):**
```javascript
const stkRes = await axios.post(
    'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    ...
);
```

**Production:**
```javascript
const baseUrl = process.env.NODE_ENV === 'production' 
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

const stkRes = await axios.post(
    `${baseUrl}/mpesa/stkpush/v1/processrequest`,
    ...
);
```

### Change #2: Update OAuth Token URL

**File:** `backend/modules/payments/routes.js` (Line 148)

**Current:**
```javascript
const response = await axios.get(
    'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    ...
);
```

**Production:**
```javascript
const baseUrl = process.env.NODE_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

const response = await axios.get(
    `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    ...
);
```

### Change #3: Add Callback Verification

**File:** `backend/modules/payments/routes.js` (Line 292)

**Add signature verification:**
```javascript
const crypto = require('crypto');

const verifyCallbackSignature = (body, signature) => {
    // Safaricom includes a signature header for verification
    // X-Safaricom-Signature or similar
    const expectedSignature = crypto
        .createHmac('sha256', process.env.MPESA_CALLBACK_SECRET)
        .update(JSON.stringify(body))
        .digest('base64');
    
    return signature === expectedSignature;
};

router.post('/mpesa/callback', async (req, res) => {
    // Add signature verification
    const signature = req.headers['x-safaricom-signature'];
    if (!verifyCallbackSignature(req.body, signature)) {
        console.warn("Callback signature verification failed");
        return res.status(401).json({ error: "Unauthorized" });
    }
    
    // ... rest of callback code
});
```

---

## 2. SMS INTEGRATION - FROM SIMULATION TO TWILIO

### Step 1: Install Twilio

```bash
npm install twilio
```

### Step 2: Add to .env

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

### Step 3: Replace SMS Simulation

**File:** `backend/modules/auth/routes.js`

**Replace this (Lines 15-20):**
```javascript
/*
const sendSMS = async (phone, message) => {
    console.log(`📱 [SMS SIMULATION]`);
};
*/
```

**With this:**
```javascript
const twilio = require('twilio');

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

const sendSMS = async (phone, message) => {
    try {
        const result = await client.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phone // Should be in format +254712345678
        });
        console.log(`✅ SMS sent to ${phone}: ${result.sid}`);
        return result;
    } catch (err) {
        console.error(`❌ SMS failed to ${phone}:`, err.message);
        throw err;
    }
};
```

### Step 4: Enable OTP Sending (Currently Commented Out)

**File:** `backend/modules/auth/routes.js` (Line 47)

Uncomment and use the SMS function:
```javascript
// Generate OTP
const smsOtp = Math.floor(100000 + Math.random() * 900000).toString();
const otpExpiry = new Date(Date.now() + 10 * 60000);

// Send SMS
await sendSMS(phoneNumber, `Your Sacco verification code: ${smsOtp}`);
```

---

## 3. LOAN DISBURSEMENT - FROM MANUAL TO AUTOMATED

### New Endpoint: Disburse via M-Pesa B2C

**File:** `backend/modules/loans/treasury.routes.js` (Add new route)

```javascript
// New route to disburse loan via M-Pesa
router.post('/disburse-to-mpesa/:loanId', authenticateUser, requireRole('TREASURER'), async (req, res) => {
    const { loanId } = req.params;
    
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        
        // Get loan details
        const loanRes = await client.query(
            "SELECT * FROM loan_applications WHERE id = $1 AND status = 'APPROVED'",
            [loanId]
        );
        
        if (loanRes.rows.length === 0) {
            return res.status(404).json({ error: "Loan not found or not approved" });
        }
        
        const loan = loanRes.rows[0];
        
        // Get member's phone
        const memberRes = await client.query(
            "SELECT phone_number FROM users WHERE id = $1",
            [loan.user_id]
        );
        
        if (memberRes.rows.length === 0 || !memberRes.rows[0].phone_number) {
            return res.status(400).json({ error: "Member phone number not found" });
        }
        
        const phoneNumber = memberRes.rows[0].phone_number;
        const amount = Math.ceil(loan.amount_requested);
        
        // Get M-Pesa token for B2C
        const tokenRes = await axios.get(
            `${process.env.NODE_ENV === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke'}/oauth/v1/generate?grant_type=client_credentials`,
            {
                headers: {
                    Authorization: `Basic ${Buffer.from(
                        `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
                    ).toString('base64')}`
                }
            }
        );
        
        const token = tokenRes.data.access_token;
        
        // Prepare phone format
        let formattedPhone = phoneNumber.startsWith('0') 
            ? '254' + phoneNumber.slice(1) 
            : phoneNumber;
        if (!formattedPhone.startsWith('254')) {
            formattedPhone = '254' + formattedPhone;
        }
        
        // Send via B2C API
        const b2cRes = await axios.post(
            `${process.env.NODE_ENV === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke'}/mpesa/b2c/v1/paymentrequest`,
            {
                CommandID: "BusinessPayment",
                Amount: amount,
                PartyA: process.env.MPESA_SHORTCODE,
                PartyB: formattedPhone,
                Remarks: `Loan Disbursement - ${loanId}`,
                QueueTimeOutURL: `${process.env.BACKEND_URL}/api/payments/b2c-callback`,
                ResultURL: `${process.env.BACKEND_URL}/api/payments/b2c-result`,
                Description: "Loan Disbursement"
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );
        
        const conversationId = b2cRes.data.ConversationID;
        
        // Record disbursement transaction
        await client.query(
            `INSERT INTO transactions 
            (user_id, type, amount, status, reference_code, description) 
            VALUES ($1, 'LOAN_DISBURSEMENT', $2, 'PENDING', $3, $4)`,
            [loan.user_id, amount, conversationId, `B2C Disbursement: ${loanId}`]
        );
        
        // Update loan status
        await client.query(
            "UPDATE loan_applications SET status = 'ACTIVE', disbursed_at = NOW() WHERE id = $1",
            [loanId]
        );
        
        await client.query('COMMIT');
        
        res.json({
            success: true,
            message: `Loan disbursement initiated. Funds being sent to ${formattedPhone}`,
            conversationId
        });
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("B2C Disbursement Error:", err);
        res.status(500).json({ 
            error: "Disbursement failed", 
            details: err.response?.data || err.message 
        });
    } finally {
        client.release();
    }
});
```

### Add B2C Callback Handler

**File:** `backend/modules/payments/routes.js` (Add new route)

```javascript
// B2C Result Callback
router.post('/b2c-result', async (req, res) => {
    try {
        const { Result } = req.body || {};
        if (!Result) return res.sendStatus(200);
        
        const { ConversationID, ResultCode, ResultDesc } = Result;
        
        if (ResultCode === 0) {
            // Success
            const txRes = await db.query(
                "SELECT * FROM transactions WHERE reference_code = $1",
                [ConversationID]
            );
            
            if (txRes.rows.length > 0) {
                await db.query(
                    "UPDATE transactions SET status = 'COMPLETED', description = $1 WHERE reference_code = $2",
                    [`Disbursed: ${ResultDesc}`, ConversationID]
                );
            }
        } else {
            // Failed
            await db.query(
                "UPDATE transactions SET status = 'FAILED', description = $1 WHERE reference_code = $2",
                [`B2C Failed: ${ResultDesc}`, ConversationID]
            );
        }
        
        res.sendStatus(200);
    } catch (err) {
        console.error("B2C Result Error:", err);
        res.sendStatus(200);
    }
});
```

---

## 4. PAYMENT REMINDERS - ADD CRON JOB

### Install node-cron

```bash
npm install node-cron
```

### Create Reminder Job

**File:** `backend/jobs/paymentReminders.js` (New file)

```javascript
const cron = require('node-cron');
const db = require('../db');
const { sendSMS } = require('../modules/auth/routes');

const schedulePaymentReminders = () => {
    // Run every Monday at 8:00 AM
    cron.schedule('0 8 * * 1', async () => {
        console.log('🔔 Running payment reminder job...');
        
        try {
            // Find all active loans
            const loansRes = await db.query(
                `SELECT l.*, u.phone_number, u.full_name 
                 FROM loan_applications l
                 JOIN users u ON l.user_id = u.id
                 WHERE l.status = 'ACTIVE' AND l.next_payment_due <= NOW()`,
            );
            
            for (const loan of loansRes.rows) {
                const amount = Math.ceil(loan.weekly_installment || 0);
                const message = `Hi ${loan.full_name}, your loan payment of KES ${amount} is due this week. Pay now at ${process.env.FRONTEND_URL}`;
                
                try {
                    await sendSMS(loan.phone_number, message);
                    console.log(`✅ Reminder sent to ${loan.phone_number}`);
                } catch (err) {
                    console.error(`❌ Failed to send reminder to ${loan.phone_number}:`, err);
                }
            }
        } catch (err) {
            console.error('Payment reminder job error:', err);
        }
    });
};

module.exports = { schedulePaymentReminders };
```

### Initialize in Server

**File:** `backend/index.js`

```javascript
const { schedulePaymentReminders } = require('./jobs/paymentReminders');

// Start server...

// Schedule jobs
schedulePaymentReminders();

console.log('🚀 Payment reminder job scheduled');
```

---

## 5. ENVIRONMENT VARIABLES - COMPLETE CHECKLIST

### Create `.env.production`

```env
# Node
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:password@prod-db-host:5432/sacco_prod
DB_POOL_SIZE=20

# M-Pesa Production (Get from Safaricom)
MPESA_CONSUMER_KEY=production_consumer_key_from_safaricom
MPESA_CONSUMER_SECRET=production_consumer_secret_from_safaricom
MPESA_SHORTCODE=your_actual_business_shortcode
MPESA_PASSKEY=production_passkey_from_safaricom
MPESA_CALLBACK_URL=https://yourdomain.com/api/payments/mpesa/callback
MPESA_B2C_CALLBACK_URL=https://yourdomain.com/api/payments/b2c-result
MPESA_CALLBACK_SECRET=your_webhook_secret_from_safaricom

# Twilio (Get from twilio.com)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Email
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_USER=noreply@sacco.com
SMTP_PASS=your_email_password
EMAIL_FROM=Sacco <noreply@sacco.com>

# URLs
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://api.yourdomain.com

# Security
JWT_SECRET=your_very_long_random_secret_key_min_32_chars
SESSION_SECRET=another_random_secret

# Server
PORT=5000
```

---

## 6. DEPLOYMENT CHECKLIST

### Before Deploy
- [ ] All credentials in `.env.production`
- [ ] Database backed up
- [ ] SSL certificate installed
- [ ] Callback URL is HTTPS
- [ ] Safaricom has approved B2C API
- [ ] SMS provider account active
- [ ] CORS configured for production domain

### After Deploy
- [ ] Test STK push with real amount
- [ ] Test SMS delivery
- [ ] Test loan disbursement
- [ ] Check callback receipt in logs
- [ ] Verify all transactions in database
- [ ] Test role-based access
- [ ] Load test with multiple users

---

## 7. ROLLBACK PLAN

If production issues occur:

```bash
# Rollback to previous version
git revert HEAD

# Keep database transactions
# (they will be in PENDING status)

# Handle manually
# 1. Check failed transactions
# 2. Contact members
# 3. Re-attempt after fix
```

---

**Ready to deploy? Check all boxes above ✅**
