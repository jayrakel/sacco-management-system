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

// --- HELPER: DRAW BANK-GRADE HEADER ---
async function drawHeader(doc, title, user, details, serialNo) {
    const now = new Date();

    // 1. Draw Sacco Logo (Top Left)
    if (details.logo && details.logo.startsWith('data:image')) {
        try {
            const imgData = details.logo.split(',')[1];
            const imgBuffer = Buffer.from(imgData, 'base64');
            doc.image(imgBuffer, 50, 45, { width: 60 });
        } catch (e) { console.error("Logo Error:", e); }
    }

    // 2. Sacco Details (Top Right)
    doc.font('Helvetica-Bold').fontSize(16).text(details.name, 200, 50, { align: 'right' });
    doc.font('Helvetica').fontSize(9).text(details.address, 200, 70, { align: 'right' });
    doc.text(`Tel: ${details.phone} | Email: ${details.email}`, 200, 85, { align: 'right' });
    doc.moveDown();

    // 3. Title & Separator
    doc.moveTo(50, 110).lineTo(550, 110).strokeColor('#aaaaaa').stroke();
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#333333').text(title.toUpperCase(), 50, 120, { align: 'center', characterSpacing: 1 });
    
    // 4. Report Meta Data
    const topY = 150;
    
    // Left: Generated For
    doc.fontSize(10).fillColor('black');
    doc.font('Helvetica-Bold').text('GENERATED FOR:', 50, topY);
    doc.font('Helvetica').text(user.full_name.toUpperCase(), 50, topY + 15);
    doc.text(`Role: ${user.role}`, 50, topY + 30);
    doc.text(`ID: ${user.id_number || 'Internal'}`, 50, topY + 45);

    // 4b. Draw Member Photo (Next to details)
    if (user.profile_image && user.profile_image.startsWith('data:image')) {
        try {
            const imgData = user.profile_image.split(',')[1];
            const imgBuffer = Buffer.from(imgData, 'base64');
            // Place image at x=200, aligned with topY
            doc.image(imgBuffer, 220, topY - 5, { width: 60, height: 60, fit: [60, 60] });
            doc.rect(220, topY - 5, 60, 60).strokeColor('#cccccc').stroke(); // Border
        } catch (e) { console.error("Member Photo Error:", e); }
    }

    // Right: Document Info
    doc.fillColor('black');
    doc.font('Helvetica-Bold').text('DOCUMENT DETAILS:', 350, topY);
    doc.font('Helvetica').text(`Date: ${now.toLocaleDateString()}`, 350, topY + 15);
    doc.text(`Time: ${now.toLocaleTimeString()}`, 350, topY + 30);
    doc.text(`Ref: ${serialNo}`, 350, topY + 45);

    // 5. Generate QR Code
    const qrString = `SACCO AUTH | ${details.name} | ${serialNo} | ${user.full_name} | ${now.toISOString()}`;
    const qrData = await QRCode.toDataURL(qrString);
    const qrBuffer = Buffer.from(qrData.split(',')[1], 'base64');
    doc.image(qrBuffer, 480, topY - 10, { width: 70 });

    doc.moveDown(4);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);
}

// ============================================================================
// ROUTE 1: MEMBER STATEMENT (With Totals & REF Column)
// ============================================================================
router.get('/statement/me', authenticateUser, async (req, res) => {
    try {
        const userId = req.user.id;
        const serialNo = `STMT-${Date.now().toString().slice(-6)}`;
        const [userRes, txRes, sacco] = await Promise.all([
            db.query("SELECT * FROM users WHERE id = $1", [userId]),
            db.query("SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at ASC", [userId]),
            getSaccoDetails()
        ]);
        
        const user = userRes.rows[0];
        const transactions = txRes.rows;
        
        // Clean filename
        const safeName = user.full_name.replace(/[^a-zA-Z0-9]/g, '_');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `${safeName}_Statement_${timestamp}.pdf`;

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        doc.pipe(res);

        await drawHeader(doc, 'Account Statement', user, sacco, serialNo);

        // -- UPDATED TABLE LAYOUT --
        let y = doc.y + 20;
        doc.rect(50, y - 5, 500, 20).fill('#f0f0f0').stroke();
        doc.fillColor('#333').font('Helvetica-Bold').fontSize(8);
        
        // Columns: DATE (50), REF (120), DESC (190), DEBIT (350), CREDIT (420), BAL (490)
        doc.text('DATE', 50, y)
           .text('REF', 120, y)
           .text('DESCRIPTION', 190, y)
           .text('DEBIT', 360, y, { align: 'right', width: 50 })
           .text('CREDIT', 430, y, { align: 'right', width: 50 })
           .text('BALANCE', 500, y, { align: 'right', width: 50 });
        
        y += 25;
        doc.font('Helvetica').fontSize(8);
        let runningBalance = 0;
        let totalCredit = 0;
        let totalDebit = 0;

        transactions.forEach((tx, i) => {
            if (y > 720) { doc.addPage(); y = 50; }
            const amt = parseFloat(tx.amount);
            let moneyIn = 0, moneyOut = 0;
            
            // Logic: Inflows vs Outflows
            const IN_TYPES = ['DEPOSIT', 'LOAN_DISBURSEMENT', 'DIVIDEND'];
            
            if (IN_TYPES.includes(tx.type)) { 
                moneyIn = amt; 
                totalCredit += amt;
                runningBalance += amt; 
            } else { 
                moneyOut = amt; 
                totalDebit += amt;
                runningBalance -= amt; 
            }

            // Zebra Striping
            if (i % 2 === 0) doc.rect(50, y - 2, 500, 20).fillColor('#fbfbfb').fill();
            doc.fillColor('#000');

            const date = new Date(tx.created_at);
            
            // 1. Date
            doc.text(date.toLocaleDateString(), 50, y);
            
            // 2. Reference (NEW)
            doc.text(tx.reference_code || '-', 120, y, { width: 65, ellipsis: true });

            // 3. Description (Truncated)
            const desc = tx.description ? tx.description : tx.type.replace(/_/g, ' ');
            doc.text(desc, 190, y, { width: 160, ellipsis: true });
            
            // 4. Debit (Out)
            if(moneyOut > 0) doc.fillColor('#b91c1c').text(moneyOut.toLocaleString(), 360, y, { align: 'right', width: 50 }); 
            else doc.text('-', 360, y, { align: 'right', width: 50 });

            // 5. Credit (In)
            if(moneyIn > 0) doc.fillColor('#047857').text(moneyIn.toLocaleString(), 430, y, { align: 'right', width: 50 }); 
            else doc.text('-', 430, y, { align: 'right', width: 50 });

            // 6. Balance
            doc.fillColor('#000').text(runningBalance.toLocaleString(), 500, y, { align: 'right', width: 50 });
            
            y += 22;
        });

        // --- STATEMENT SUMMARY FOOTER ---
        if (y > 650) { doc.addPage(); y = 50; } 
        y += 10;
        
        doc.moveTo(50, y).lineTo(550, y).strokeColor('#333').stroke();
        y += 10;

        // Draw Summary Box
        doc.rect(300, y, 250, 65).fillColor('#f8fafc').fillAndStroke('#e2e8f0');
        doc.fillColor('#1e293b');
        
        let sumY = y + 10;
        doc.font('Helvetica-Bold').fontSize(9);
        
        doc.text('TOTAL INFLOW:', 310, sumY);
        doc.fillColor('#047857').text(`KES ${totalCredit.toLocaleString()}`, 310, sumY, { align: 'right', width: 230 });
        
        sumY += 15;
        doc.fillColor('#1e293b').text('TOTAL OUTFLOW:', 310, sumY);
        doc.fillColor('#b91c1c').text(`KES ${totalDebit.toLocaleString()}`, 310, sumY, { align: 'right', width: 230 });
        
        sumY += 20;
        doc.moveTo(310, sumY - 5).lineTo(540, sumY - 5).strokeColor('#cbd5e1').stroke();
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a');
        doc.text('CLOSING BALANCE:', 310, sumY);
        doc.text(`KES ${runningBalance.toLocaleString()}`, 310, sumY, { align: 'right', width: 230 });

        doc.end();
    } catch (err) { console.error(err); res.status(500).json({ error: "PDF Error" }); }
});

// ============================================================================
// ROUTE 2: CHAIRPERSON FULL FINANCIAL LEDGER
// ============================================================================
router.get('/summary/download', authenticateUser, async (req, res) => {
    try {
        if (!['ADMIN', 'CHAIRPERSON', 'TREASURER'].includes(req.user.role)) return res.status(403).json({ error: "Access Denied" });

        const serialNo = `LEDGER-${Date.now().toString().slice(-6)}`;
        const sacco = await getSaccoDetails();
        const now = new Date();

        // 1. Fetch High Level Stats
        const savingsRes = await db.query("SELECT COALESCE(SUM(amount), 0) as total FROM deposits WHERE status = 'COMPLETED' AND type = 'DEPOSIT'");
        const netSavings = parseFloat(savingsRes.rows[0].total);
        
        const revenueRes = await db.query("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type IN ('FINE', 'PENALTY', 'REGISTRATION_FEE', 'LOAN_FORM_FEE', 'FEE_PAYMENT')");
        const totalRevenue = parseFloat(revenueRes.rows[0].total);
        
        const loansRes = await db.query(`SELECT COUNT(*) as count, COALESCE(SUM(amount_requested), 0) as principal, COALESCE(SUM(interest_amount), 0) as interest, COALESCE(SUM(amount_repaid), 0) as repaid, COALESCE(SUM(total_due), 0) as total_due FROM loan_applications WHERE status = 'ACTIVE'`);
        const loanStats = loansRes.rows[0];
        const outstanding = parseFloat(loanStats.total_due) - parseFloat(loanStats.repaid);

        const liquidityRes = await db.query(`SELECT COALESCE(SUM(CASE WHEN type IN ('DEPOSIT', 'LOAN_REPAYMENT', 'FINE', 'PENALTY', 'REGISTRATION_FEE', 'FEE_PAYMENT') THEN amount ELSE 0 END), 0) as inflow, COALESCE(SUM(CASE WHEN type IN ('LOAN_DISBURSEMENT', 'WITHDRAWAL') THEN amount ELSE 0 END), 0) as outflow FROM transactions`);
        const cashOnHand = parseFloat(liquidityRes.rows[0].inflow) - parseFloat(liquidityRes.rows[0].outflow);

        // 2. Fetch FULL Transaction History
        const recentTx = await db.query(`
            SELECT t.*, u.full_name 
            FROM transactions t 
            JOIN users u ON t.user_id = u.id 
            ORDER BY t.created_at DESC
        `);

        // --- PDF GENERATION ---
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `${sacco.name.replace(/ /g,'_')}_Master_Ledger_${timestamp}.pdf`;

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        doc.pipe(res);

        await drawHeader(doc, 'Master Financial Ledger', req.user, sacco, serialNo);

        // --- SECTION 1: FINANCIAL HEALTH (Summary) ---
        let y = doc.y + 10;
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#1e293b').text('1. FINANCIAL POSITION SUMMARY', 50, y);
        doc.moveTo(50, y + 15).lineTo(250, y + 15).stroke();
        y += 30;

        const drawStatBox = (x, title, value, color) => {
            doc.rect(x, y, 150, 50).fill(color).stroke();
            doc.fillColor('white').fontSize(9).text(title, x + 10, y + 10);
            doc.fontSize(12).text(`KES ${value.toLocaleString()}`, x + 10, y + 25);
        };

        drawStatBox(50, 'Total Assets (Savings + Revenue)', (netSavings + totalRevenue), '#0f172a');
        drawStatBox(210, 'Liquid Cash Available', cashOnHand, '#059669'); // Green
        drawStatBox(370, 'Outstanding Loan Risk', outstanding, '#b91c1c'); // Red

        y += 70;

        // --- SECTION 2: SYSTEM LEDGER (Money In/Out) ---
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#1e293b').text('2. FULL SYSTEM LEDGER (Audit Trail)', 50, y);
        doc.moveTo(50, y + 15).lineTo(350, y + 15).stroke();
        
        y += 30;
        // Table Headers
        doc.rect(50, y - 5, 500, 20).fill('#e2e8f0').stroke();
        doc.fillColor('#333').fontSize(8);
        doc.text('DATE/TIME', 50, y);
        doc.text('MEMBER / DESC', 120, y);
        doc.text('REF', 280, y);
        doc.text('MONEY OUT', 350, y); // Debit
        doc.text('MONEY IN', 430, y);  // Credit
        
        y += 25;
        doc.font('Helvetica');

        // Track totals for the ledger
        let totalLedgerIn = 0;
        let totalLedgerOut = 0;

        recentTx.rows.forEach((tx, i) => {
            if (y > 720) { doc.addPage(); y = 50; }

            const amt = parseFloat(tx.amount);
            let moneyIn = 0, moneyOut = 0;
            // Logic for Sacco perspective: 
            // Deposit = Money IN to Sacco. Loan Disbursement = Money OUT from Sacco.
            const IN_TYPES = ['DEPOSIT', 'LOAN_REPAYMENT', 'FINE', 'REGISTRATION_FEE', 'FEE_PAYMENT', 'PENALTY', 'LOAN_FORM_FEE', 'SHARE_CAPITAL', 'DIVIDEND'];
            
            if (IN_TYPES.includes(tx.type)) { 
                moneyIn = amt;
                totalLedgerIn += amt;
            } else { 
                moneyOut = amt;
                totalLedgerOut += amt;
            }

            // Zebra Striping
            if (i % 2 === 0) doc.rect(50, y - 2, 500, 20).fillColor('#f8fafc').fill();
            doc.fillColor('#334155');

            const txDate = new Date(tx.created_at);
            // Date Column
            doc.text(txDate.toLocaleDateString(), 50, y);
            doc.fontSize(7).fillColor('#94a3b8').text(txDate.toLocaleTimeString(), 50, y + 10).fontSize(8).fillColor('#334155');
            
            // Desc Column
            doc.text(tx.full_name, 120, y, { width: 150, ellipsis: true });
            doc.fontSize(7).fillColor('#64748b').text(tx.description || tx.type, 120, y + 10).fontSize(8).fillColor('#334155');

            // Ref Column
            doc.text(tx.reference_code || '-', 280, y + 5);

            // Money Columns
            if (moneyOut > 0) doc.fillColor('#dc2626').text(moneyOut.toLocaleString(), 350, y + 5);
            else doc.text('-', 350, y + 5);

            if (moneyIn > 0) doc.fillColor('#16a34a').text(moneyIn.toLocaleString(), 430, y + 5);
            else doc.text('-', 430, y + 5);

            y += 25;
        });

        // --- LEDGER TOTALS ---
        if (y > 650) { doc.addPage(); y = 50; }
        y += 10;
        doc.rect(300, y, 250, 50).fillColor('#f1f5f9').fillAndStroke('#cbd5e1');
        doc.fillColor('#0f172a');
        let sumY = y + 10;
        doc.font('Helvetica-Bold').fontSize(10);
        
        doc.text('TOTAL INFLOW:', 310, sumY);
        doc.fillColor('#16a34a').text(`KES ${totalLedgerIn.toLocaleString()}`, 310, sumY, { align: 'right', width: 230 });
        
        sumY += 15;
        doc.fillColor('#0f172a').text('TOTAL OUTFLOW:', 310, sumY);
        doc.fillColor('#dc2626').text(`KES ${totalLedgerOut.toLocaleString()}`, 310, sumY, { align: 'right', width: 230 });

        // --- FOOTER ---
        const bottomY = 730;
        doc.fontSize(8).fillColor('#94a3b8');
        doc.text('This is an official document generated by the Sacco Management System.', 50, bottomY, { align: 'center' });
        doc.text(`Digital Seal: ${serialNo} | Generated: ${now.toLocaleString()}`, 50, bottomY + 12, { align: 'center' });

        doc.end();

    } catch (err) {
        console.error("Exec Report Error:", err);
        if (!res.headersSent) res.status(500).json({ error: "Report Generation Failed" });
    }
});

router.get('/summary', authenticateUser, async (req, res) => {
    try {
        if (!['ADMIN', 'CHAIRPERSON', 'TREASURER'].includes(req.user.role)) return res.status(403).json({ error: "Access Denied" });

        const savingsRes = await db.query("SELECT COALESCE(SUM(amount), 0) as total FROM deposits WHERE status = 'COMPLETED' AND type = 'DEPOSIT'");
        const revenueRes = await db.query("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type IN ('FINE', 'PENALTY', 'REGISTRATION_FEE', 'LOAN_FORM_FEE', 'FEE_PAYMENT')");
        const liquidityRes = await db.query(`SELECT COALESCE(SUM(CASE WHEN type IN ('DEPOSIT', 'LOAN_REPAYMENT', 'FINE', 'PENALTY', 'REGISTRATION_FEE', 'FEE_PAYMENT') THEN amount ELSE 0 END), 0) as inflow, COALESCE(SUM(CASE WHEN type IN ('LOAN_DISBURSEMENT', 'WITHDRAWAL') THEN amount ELSE 0 END), 0) as outflow FROM transactions`);
        const cashOnHand = parseFloat(liquidityRes.rows[0].inflow) - parseFloat(liquidityRes.rows[0].outflow);
        const loansRes = await db.query(`SELECT COUNT(*) as count, COALESCE(SUM(amount_requested), 0) as principal, COALESCE(SUM(interest_amount), 0) as interest, COALESCE(SUM(amount_repaid), 0) as repaid, COALESCE(SUM(total_due), 0) as total_due FROM loan_applications WHERE status = 'ACTIVE'`);
        const loanStats = loansRes.rows[0];
        const outstanding = parseFloat(loanStats.total_due) - parseFloat(loanStats.repaid);
        const membersRes = await db.query("SELECT COUNT(*) as count FROM users WHERE role != 'ADMIN'");

        res.json({
            generated_at: new Date(),
            membership_count: parseInt(membersRes.rows[0].count),
            financials: {
                net_savings: parseFloat(savingsRes.rows[0].total),
                total_revenue: parseFloat(revenueRes.rows[0].total),
                financial_position: parseFloat(savingsRes.rows[0].total) + parseFloat(revenueRes.rows[0].total),
                cash_on_hand: cashOnHand,
                loan_portfolio: {
                    active_loans_count: parseInt(loanStats.count),
                    total_disbursed_active: parseFloat(loanStats.principal),
                    total_interest_charged: parseFloat(loanStats.interest),
                    total_repaid_active: parseFloat(loanStats.repaid),
                    outstanding_balance: outstanding
                }
            }
        });
    } catch(e) { res.status(500).json({error: "Error"}); }
});

// ============================================================================
// ROUTE 3: ACTIVE PORTFOLIO (FIXED: ADDED THIS ROUTE)
// ============================================================================
router.get('/active-portfolio', authenticateUser, async (req, res) => {
    try {
        if (!['ADMIN', 'CHAIRPERSON', 'TREASURER'].includes(req.user.role)) return res.status(403).json({ error: "Access Denied" });

        const result = await db.query(`
            SELECT 
                l.id, 
                u.full_name, 
                l.total_due, 
                l.amount_repaid, 
                (l.total_due - l.amount_repaid) as outstanding_balance,
                l.disbursed_at,
                l.amount_requested as principal,
                CASE 
                    WHEN l.total_due > 0 THEN ROUND((l.amount_repaid / l.total_due) * 100, 1) 
                    ELSE 0 
                END as progress
            FROM loan_applications l
            JOIN users u ON l.user_id = u.id
            WHERE l.status = 'ACTIVE'
            ORDER BY l.created_at DESC
        `);
        
        res.json(result.rows);
    } catch (err) {
        console.error("Portfolio Error:", err);
        res.status(500).json({ error: "Failed to fetch portfolio" });
    }
});

module.exports = router;