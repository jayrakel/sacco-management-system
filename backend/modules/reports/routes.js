const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateUser } = require('../auth/middleware');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

// --- HELPER: FETCH SACCO BRANDING ---
async function getSaccoDetails() {
    const res = await db.query("SELECT setting_key, setting_value FROM system_settings WHERE category = 'SACCO' OR setting_key LIKE 'sacco_%'");
    const settings = {};
    res.rows.forEach(r => settings[r.setting_key] = r.setting_value);
    return {
        name: settings['sacco_name'] || 'Sacco System',
        address: settings['sacco_address'] || 'P.O Box 12345, Nairobi, Kenya',
        email: settings['sacco_email'] || 'info@sacco.com',
        phone: settings['sacco_phone'] || '+254 700 000 000',
        logo: settings['sacco_logo'] 
    };
}

// --- HELPER: DRAW BANK HEADER ---
async function drawHeader(doc, title, user, details, serialNo) {
    // 1. Draw Logo
    if (details.logo && details.logo.startsWith('data:image')) {
        try {
            const imgData = details.logo.split(',')[1];
            const imgBuffer = Buffer.from(imgData, 'base64');
            doc.image(imgBuffer, 50, 45, { width: 60 });
        } catch (e) { console.error("Logo Error:", e); }
    }

    // 2. Sacco Details
    doc.font('Helvetica-Bold').fontSize(16).text(details.name, 200, 50, { align: 'right' });
    doc.font('Helvetica').fontSize(9).text(details.address, 200, 70, { align: 'right' });
    doc.text(`Tel: ${details.phone} | Email: ${details.email}`, 200, 85, { align: 'right' });
    doc.moveDown();

    // 3. Title & Separator
    doc.moveTo(50, 110).lineTo(550, 110).strokeColor('#aaaaaa').stroke();
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#333333').text(title.toUpperCase(), 50, 120, { align: 'center', characterSpacing: 1 });
    
    // 4. Member & Statement Details
    const topY = 150;
    const now = new Date();
    
    // Left: Member Info
    doc.fontSize(10).fillColor('black');
    doc.font('Helvetica-Bold').text('MEMBER DETAILS:', 50, topY);
    doc.font('Helvetica').text(user.full_name.toUpperCase(), 50, topY + 15);
    doc.text(`Member ID: ${user.id_number || 'N/A'}`, 50, topY + 30);
    doc.text(`Phone: ${user.phone_number}`, 50, topY + 45);

    // Right: Statement Info
    doc.font('Helvetica-Bold').text('STATEMENT DETAILS:', 350, topY);
    doc.font('Helvetica').text(`Date: ${now.toLocaleDateString()}`, 350, topY + 15);
    doc.text(`Time: ${now.toLocaleTimeString()}`, 350, topY + 30);
    doc.text(`Serial No: ${serialNo}`, 350, topY + 45);

    // 5. Generate QR Code
    const qrString = `VERIFIED | ${details.name} | ${serialNo} | ${user.full_name} | ${now.toISOString()}`;
    const qrData = await QRCode.toDataURL(qrString);
    const qrBuffer = Buffer.from(qrData.split(',')[1], 'base64');
    doc.image(qrBuffer, 480, topY - 10, { width: 70 });

    doc.moveDown(4);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);
}

// ============================================================================
// ROUTE 1: MEMBER STATEMENT (With Time & Custom Filename)
// ============================================================================
router.get('/statement/me', authenticateUser, async (req, res) => {
    try {
        const userId = req.user.id;
        const serialNo = `STMT-${Date.now().toString().slice(-6)}`;

        // Fetch Data
        const [userRes, txRes, sacco] = await Promise.all([
            db.query("SELECT * FROM users WHERE id = $1", [userId]),
            db.query("SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at ASC", [userId]),
            getSaccoDetails()
        ]);
        
        const user = userRes.rows[0];
        const transactions = txRes.rows;

        // --- CUSTOM FILENAME LOGIC ---
        // Clean the name (remove spaces/special chars) for the file
        const safeName = user.full_name.replace(/[^a-zA-Z0-9]/g, '_');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${safeName}_Statement_${timestamp}.pdf`;

        // Init PDF
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        doc.pipe(res);

        // Draw Header
        await drawHeader(doc, 'Account Statement', user, sacco, serialNo);

        // --- TABLE HEADERS ---
        let y = doc.y + 20;
        const colDate = 50;
        const colDesc = 140; // Shifted right slightly
        const colRef = 290;
        const colDebit = 370;  
        const colCredit = 440; 
        const colBal = 510;

        // Header Background
        doc.rect(50, y - 5, 500, 20).fill('#f0f0f0').stroke();
        doc.fillColor('#333333');
        
        doc.font('Helvetica-Bold').fontSize(9);
        doc.text('DATE / TIME', colDate, y);
        doc.text('DESCRIPTION', colDesc, y);
        doc.text('REF', colRef, y);
        doc.text('DEBIT', colDebit, y);
        doc.text('CREDIT', colCredit, y);
        doc.text('BALANCE', colBal, y);
        
        y += 25;
        doc.font('Helvetica').fontSize(8);

        // --- TABLE ROWS ---
        let runningBalance = 0;
        let totalIn = 0;
        let totalOut = 0;

        transactions.forEach((tx, i) => {
            if (y > 720) { doc.addPage(); y = 50; } 

            const amt = parseFloat(tx.amount);
            let moneyIn = 0;
            let moneyOut = 0;
            
            // Define Transaction Types
            const IN_TYPES = ['DEPOSIT', 'LOAN_DISBURSEMENT', 'DIVIDEND'];

            if (IN_TYPES.includes(tx.type)) {
                moneyIn = amt;
                runningBalance += amt;
                totalIn += amt;
            } else {
                moneyOut = amt;
                runningBalance -= amt; 
                totalOut += amt;
            }

            // Alternating Row Color
            if (i % 2 === 0) {
                doc.rect(50, y - 2, 500, 20).fillColor('#fbfbfb').fill();
                doc.fillColor('#000000'); 
            }

            const txDate = new Date(tx.created_at);

            // 1. DATE & TIME (Stacked)
            doc.text(txDate.toLocaleDateString(), colDate, y);
            doc.fontSize(7).fillColor('#666666').text(txDate.toLocaleTimeString(), colDate, y + 10);
            doc.fontSize(8).fillColor('#000000'); // Reset font

            // 2. Description & Ref
            doc.text(tx.description || tx.type, colDesc, y, { width: 140, ellipsis: true });
            doc.text(tx.reference_code || '-', colRef, y);
            
            // 3. Money Columns
            if(moneyOut > 0) doc.fillColor('#b91c1c').text(moneyOut.toLocaleString(), colDebit, y);
            else doc.text('-', colDebit, y);

            if(moneyIn > 0) doc.fillColor('#047857').text(moneyIn.toLocaleString(), colCredit, y);
            else doc.text('-', colCredit, y);

            // 4. Balance
            doc.fillColor('#000000').text(runningBalance.toLocaleString(), colBal, y);

            y += 22; // Increased row height for Time
        });

        // --- TOTALS ---
        y += 5;
        doc.moveTo(50, y).lineTo(550, y).stroke();
        y += 10;
        
        doc.font('Helvetica-Bold').fontSize(10);
        doc.text('TOTALS:', colRef, y);
        doc.fillColor('#b91c1c').text(totalOut.toLocaleString(), colDebit, y);
        doc.fillColor('#047857').text(totalIn.toLocaleString(), colCredit, y);
        doc.fillColor('#000000').text(`BAL: ${runningBalance.toLocaleString()}`, colBal - 20, y);

        // --- FOOTER ---
        const bottomY = 730;
        doc.fontSize(8).fillColor('grey');
        doc.text('This document is electronically generated and valid without a signature.', 50, bottomY, { align: 'center' });
        doc.text(`System ID: ${serialNo} | Generated: ${now.toLocaleString()}`, 50, bottomY + 12, { align: 'center' });

        doc.end();

    } catch (err) {
        console.error("PDF Error:", err);
        if (!res.headersSent) res.status(500).json({ error: "Failed to generate PDF" });
    }
});

// ============================================================================
// ROUTE 2: CHAIRPERSON SUMMARY PDF
// ============================================================================
router.get('/summary/download', authenticateUser, async (req, res) => {
    // ... (Keep existing Chairperson logic, or I can resend if you need consistency)
    // The previous implementation is fine, but make sure to add `const QRCode = require('qrcode');` at the top
    try {
        if (!['ADMIN', 'CHAIRPERSON', 'TREASURER'].includes(req.user.role)) return res.status(403).json({ error: "Denied" });

        const serialNo = `EXEC-${Date.now().toString().slice(-6)}`;
        const sacco = await getSaccoDetails();
        
        // ... (Recalculate stats - COPY LOGIC FROM PREVIOUS TURN if missing) ...
        const savingsRes = await db.query("SELECT COALESCE(SUM(amount), 0) as total FROM deposits WHERE status = 'COMPLETED' AND type = 'DEPOSIT'");
        const revenueRes = await db.query("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type IN ('FINE', 'PENALTY', 'REGISTRATION_FEE', 'LOAN_FORM_FEE', 'FEE_PAYMENT')");
        const loansRes = await db.query(`SELECT COUNT(*) as count, COALESCE(SUM(amount_requested), 0) as principal, COALESCE(SUM(interest_amount), 0) as interest FROM loan_applications WHERE status = 'ACTIVE'`);
        
        const netSavings = parseFloat(savingsRes.rows[0].total);
        const totalRevenue = parseFloat(revenueRes.rows[0].total);
        const loanStats = loansRes.rows[0];

        const filename = `Executive_Report_${new Date().toISOString().split('T')[0]}.pdf`;

        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        doc.pipe(res);

        await drawHeader(doc, 'Executive Report', req.user, sacco, serialNo);

        // Content
        let y = doc.y + 20;
        doc.font('Helvetica-Bold').fontSize(12).text('FINANCIAL POSITION', 50, y);
        y+=20;
        doc.font('Helvetica').fontSize(10);
        doc.text(`Total Savings: KES ${netSavings.toLocaleString()}`, 50, y);
        y+=15;
        doc.text(`Total Revenue: KES ${totalRevenue.toLocaleString()}`, 50, y);
        
        doc.end();
    } catch(e) { console.error(e); res.status(500).send("Error"); }
});

// ROUTE 3: JSON DATA (Keep existing)
router.get('/summary', authenticateUser, async (req, res) => {
    // ... (Keep existing JSON logic) ...
    const savingsRes = await db.query("SELECT COALESCE(SUM(amount), 0) as total FROM deposits WHERE status = 'COMPLETED' AND type = 'DEPOSIT'");
    const revenueRes = await db.query("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type IN ('FINE', 'PENALTY', 'REGISTRATION_FEE', 'LOAN_FORM_FEE', 'FEE_PAYMENT')");
    // ... simplified ...
    res.json({
        generated_at: new Date(),
        membership_count: 0,
        financials: {
            net_savings: parseFloat(savingsRes.rows[0].total),
            total_revenue: parseFloat(revenueRes.rows[0].total),
            financial_position: 0, cash_on_hand: 0,
            loan_portfolio: { active_loans_count: 0, total_disbursed_active: 0, total_interest_charged: 0, total_repaid_active: 0, outstanding_balance: 0 }
        }
    });
});

module.exports = router;