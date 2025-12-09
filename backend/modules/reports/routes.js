const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateUser } = require('../auth/middleware');
const PDFDocument = require('pdfkit'); 

// 1. MEMBER STATEMENT (PDF) - FIXED
router.get('/statement/me', authenticateUser, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // FIX: Fetch user details explicitly to get the correct name
        const userRes = await db.query("SELECT full_name, phone_number FROM users WHERE id = $1", [userId]);
        const user = userRes.rows[0];
        const userName = user ? user.full_name : "Valued Member";

        const result = await db.query(
            `SELECT created_at, type, amount, reference_code, description 
             FROM transactions WHERE user_id = $1 ORDER BY created_at ASC`,
            [userId]
        );

        const doc = new PDFDocument({ margin: 50 });
        
        // Set headers for download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Statement_${userId}.pdf`);
        doc.pipe(res);

        // Header Design
        doc.fontSize(20).text('SACCO ACCOUNT STATEMENT', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Member: ${userName}`);
        doc.text(`Date: ${new Date().toDateString()}`);
        doc.moveDown();
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke().moveDown();

        // Table Headers
        let y = doc.y;
        doc.font('Helvetica-Bold');
        doc.text('Date', 50, y);
        doc.text('Type', 150, y);
        doc.text('Ref', 280, y);
        doc.text('Amount', 400, y);
        doc.font('Helvetica');
        y += 20;

        // Transaction Rows
        let balance = 0;
        result.rows.forEach(tx => {
            if (y > 700) { doc.addPage(); y = 50; }
            
            const amt = parseFloat(tx.amount);
            balance += amt; // Add to running balance

            doc.text(new Date(tx.created_at).toISOString().split('T')[0], 50, y);
            doc.text(tx.type.substring(0, 15), 150, y);
            doc.text(tx.reference_code || '-', 280, y);
            
            // Format Currency
            doc.text(amt.toLocaleString('en-KE', { style: 'currency', currency: 'KES' }), 400, y);
            
            y += 20;
        });
        
        doc.moveDown();
        doc.font('Helvetica-Bold').text(`Closing Balance: KES ${balance.toLocaleString()}`, 50, y + 10);
        doc.fontSize(10).text('System Generated Report', { align: 'center', color: 'grey' });

        doc.end();
    } catch (err) {
        console.error("PDF Error:", err);
        if (!res.headersSent) res.status(500).json({ error: "PDF Generation Failed" });
    }
});

// 2. ADMIN SUMMARY (For Chairperson Dashboard) - IMPLEMENTED
router.get('/summary', authenticateUser, async (req, res) => {
    try {
        if (!['ADMIN', 'CHAIRPERSON', 'TREASURER'].includes(req.user.role)) {
            return res.status(403).json({ error: "Access Denied" });
        }

        // A. Financials
        // 1. Net Savings (Sum of COMPLETED DEPOSITS)
        const savingsRes = await db.query("SELECT COALESCE(SUM(amount), 0) as total FROM deposits WHERE status = 'COMPLETED' AND type = 'DEPOSIT'");
        const netSavings = parseFloat(savingsRes.rows[0].total);

        // 2. Total Revenue (Fines, Penalties, Fees)
        const revenueRes = await db.query("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type IN ('FINE', 'PENALTY', 'REGISTRATION_FEE', 'LOAN_FORM_FEE', 'FEE_PAYMENT')");
        const totalRevenue = parseFloat(revenueRes.rows[0].total);

        // 3. Cash on Hand (Liquidity) = Inflow - Outflow
        // Inflow: Deposits, Repayments, Fines, Fees
        // Outflow: Loan Disbursements, Withdrawals
        const liquidityRes = await db.query(`
            SELECT 
                COALESCE(SUM(CASE WHEN type IN ('DEPOSIT', 'LOAN_REPAYMENT', 'FINE', 'PENALTY', 'REGISTRATION_FEE', 'FEE_PAYMENT') THEN amount ELSE 0 END), 0) as inflow,
                COALESCE(SUM(CASE WHEN type IN ('LOAN_DISBURSEMENT', 'WITHDRAWAL') THEN amount ELSE 0 END), 0) as outflow
            FROM transactions
        `);
        const cashOnHand = parseFloat(liquidityRes.rows[0].inflow) - parseFloat(liquidityRes.rows[0].outflow);

        // B. Loan Portfolio
        const loansRes = await db.query(`
            SELECT 
                COUNT(*) as count,
                COALESCE(SUM(amount_requested), 0) as principal,
                COALESCE(SUM(interest_amount), 0) as interest,
                COALESCE(SUM(amount_repaid), 0) as repaid,
                COALESCE(SUM(total_due), 0) as total_due
            FROM loan_applications 
            WHERE status = 'ACTIVE'
        `);
        const loanStats = loansRes.rows[0];

        // Calculated Outstanding
        const outstanding = parseFloat(loanStats.total_due) - parseFloat(loanStats.repaid);

        // C. Membership
        const membersRes = await db.query("SELECT COUNT(*) as count FROM users WHERE role != 'ADMIN'");
        
        // D. Construct Response (Must match structure in ChairpersonDashboard.jsx)
        const reportData = {
            generated_at: new Date(),
            membership_count: parseInt(membersRes.rows[0].count),
            financials: {
                net_savings: netSavings,
                total_revenue: totalRevenue,
                financial_position: netSavings + totalRevenue, // Simple Assets calculation
                cash_on_hand: cashOnHand,
                loan_portfolio: {
                    active_loans_count: parseInt(loanStats.count),
                    total_disbursed_active: parseFloat(loanStats.principal),
                    total_interest_charged: parseFloat(loanStats.interest),
                    total_repaid_active: parseFloat(loanStats.repaid),
                    outstanding_balance: outstanding
                }
            }
        };

        res.json(reportData);

    } catch (err) {
        console.error("Report Error:", err);
        res.status(500).json({ error: "Failed to generate report" });
    }
});

module.exports = router;