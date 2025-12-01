const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateUser } = require('../auth/middleware');

router.get('/summary', authenticateUser, async (req, res) => {
    if (!['ADMIN', 'CHAIRPERSON', 'TREASURER'].includes(req.user.role)) {
        return res.status(403).json({ error: "Access Denied" });
    }

    try {
        // 1. Net Savings
        const savingsRes = await db.query(`
            SELECT 
                SUM(CASE WHEN type = 'DEPOSIT' THEN amount ELSE 0 END) as gross_deposits,
                SUM(CASE WHEN type = 'DEDUCTION' THEN amount ELSE 0 END) as total_deductions,
                SUM(amount) as net_total
            FROM deposits
        `);

        // 2. Total Revenue 
        // FIX: Added 'FEE_PAYMENT' to the list to catch older/legacy loan form fees
        const revenueRes = await db.query(`
            SELECT SUM(amount) as total 
            FROM transactions 
            WHERE type IN ('LOAN_FORM_FEE', 'FEE_PAYMENT', 'FINE', 'PENALTY', 'REGISTRATION_FEE')
        `);

        // 3. Loan Portfolio
        const loansRes = await db.query(`
            SELECT 
                COUNT(*) as count,
                SUM(amount_requested) as principal, 
                SUM(total_due) as total_expected,
                SUM(amount_repaid) as repaid 
            FROM loan_applications 
            WHERE status IN ('ACTIVE', 'OVERDUE')
        `);

        const membersRes = await db.query("SELECT COUNT(*) as total FROM users WHERE role != 'ADMIN'");

        // --- CALCULATIONS ---
        const netSavings = parseFloat(savingsRes.rows[0].net_total || 0); 
        const totalRevenue = parseFloat(revenueRes.rows[0].total || 0);
        const financialPosition = netSavings + totalRevenue;

        const loanPrincipal = parseFloat(loansRes.rows[0].principal || 0);
        const loanTotalExpected = parseFloat(loansRes.rows[0].total_expected || 0);
        const loanRepaid = parseFloat(loansRes.rows[0].repaid || 0);
        
        const interestCharged = Math.max(0, loanTotalExpected - loanPrincipal);
        const outstandingBalance = loanTotalExpected - loanRepaid;

        // Approx Cash on Hand
        const principalRepaidApprox = Math.min(loanPrincipal, loanRepaid);
        const outstandingPrincipal = loanPrincipal - principalRepaidApprox;
        const cashOnHand = financialPosition - outstandingPrincipal;

        res.json({
            generated_at: new Date(),
            membership_count: parseInt(membersRes.rows[0].total),
            financials: {
                net_savings: netSavings,
                total_revenue: totalRevenue,
                financial_position: financialPosition,
                cash_on_hand: cashOnHand,
                
                loan_portfolio: {
                    active_loans_count: parseInt(loansRes.rows[0].count),
                    total_disbursed_active: loanPrincipal,
                    total_interest_charged: interestCharged,
                    total_repaid_active: loanRepaid,
                    outstanding_balance: outstandingBalance
                }
            }
        });

    } catch (err) {
        console.error("Report Error:", err);
        res.status(500).json({ error: "Failed to generate report" });
    }
});

module.exports = router;