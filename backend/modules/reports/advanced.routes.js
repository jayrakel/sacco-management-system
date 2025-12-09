const express = require('express');
const { authenticateUser, authorizeRoles } = require('../auth/middleware');
const router = express.Router();
const db = require('../../db');

// ========================================
// 1. FINANCIAL REPORTS
// ========================================

// Balance Sheet Report
router.get('/financial/balance-sheet', authenticateUser, authorizeRoles('ADMIN', 'TREASURER', 'CHAIRPERSON'), async (req, res) => {
  try {
    const { date } = req.query; 
    const reportDate = date ? new Date(date) : new Date();

    // Assets
    // Note: We check both 'type' and 'category' to be safe with legacy data
    const assetsRes = await db.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN (type = 'SHARE_CAPITAL' OR category = 'SHARE_CAPITAL') THEN amount ELSE 0 END), 0) as share_capital,
        COALESCE(SUM(CASE WHEN (type IN ('DEPOSIT', 'SAVINGS') OR category IN ('DEPOSIT', 'SAVINGS')) THEN amount ELSE 0 END), 0) as member_savings,
        COALESCE(SUM(CASE WHEN (type = 'EMERGENCY_FUND' OR category = 'EMERGENCY_FUND') THEN amount ELSE 0 END), 0) as emergency_fund
       FROM deposits
       WHERE created_at <= $1 AND status = 'COMPLETED'`,
      [reportDate]
    );

    const assets = assetsRes.rows[0];
    const share_capital = parseFloat(assets.share_capital) || 0;
    const member_savings = parseFloat(assets.member_savings) || 0;
    const emergency_fund = parseFloat(assets.emergency_fund) || 0;
    
    // Loan Outstanding (From Loan Applications)
    const loansRes = await db.query(
        `SELECT COALESCE(SUM(total_due - amount_repaid), 0) as outstanding 
         FROM loan_applications 
         WHERE status = 'ACTIVE' AND created_at <= $1`,
        [reportDate]
    );
    const loans_outstanding = parseFloat(loansRes.rows[0].outstanding) || 0;

    const totalAssets = share_capital + member_savings + loans_outstanding + emergency_fund;

    // Liabilities
    const liabilitiesRes = await db.query(
      `SELECT 
        COALESCE(SUM(total_due), 0) as member_liabilities,
        COUNT(DISTINCT user_id) as member_count
       FROM loan_applications
       WHERE created_at <= $1 AND status IN ('ACTIVE', 'PENDING')`,
      [reportDate]
    );

    const liabilities = liabilitiesRes.rows[0];
    const totalLiabilities = parseFloat(liabilities.member_liabilities) || 0;

    // Equity
    const equity = totalAssets - totalLiabilities;

    const report = {
      report_type: 'BALANCE_SHEET',
      report_date: reportDate,
      assets: {
        share_capital: share_capital,
        member_savings: member_savings,
        loans_outstanding: loans_outstanding,
        emergency_fund: emergency_fund,
        total: totalAssets
      },
      liabilities: {
        member_liabilities: totalLiabilities,
        total: totalLiabilities
      },
      equity: equity,
      total_liabilities_equity: totalLiabilities + equity
    };

    res.json(report);
  } catch (error) {
    console.error('Balance sheet error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Income Statement Report
router.get('/financial/income-statement', authenticateUser, authorizeRoles('ADMIN', 'TREASURER', 'CHAIRPERSON'), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const startDate = start_date ? new Date(start_date) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const endDate = end_date ? new Date(end_date) : new Date();

    // Revenue from loans (interest)
    const interestRes = await db.query(
      `SELECT COALESCE(SUM(interest_amount), 0) as total_interest
       FROM loan_applications
       WHERE created_at BETWEEN $1 AND $2 AND status IN ('ACTIVE', 'COMPLETED')`,
      [startDate, endDate]
    );

    // Expenses (penalties, operational costs)
    const penaltiesRes = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as total_penalties
       FROM transactions
       WHERE (type = 'PENALTY' OR type = 'FINE') AND created_at BETWEEN $1 AND $2`,
      [startDate, endDate]
    );

    // Dividends paid
    let dividends = 0;
    try {
        const dividendsRes = await db.query(
          `SELECT COALESCE(SUM(dividend_amount), 0) as total_dividends_paid
           FROM dividend_allocations
           WHERE status = 'PAID' AND payment_date BETWEEN $1 AND $2`,
          [startDate, endDate]
        );
        dividends = parseFloat(dividendsRes.rows[0].total_dividends_paid);
    } catch(e) { dividends = 0; }

    const interest = parseFloat(interestRes.rows[0].total_interest);
    const penalties = parseFloat(penaltiesRes.rows[0].total_penalties);

    const revenue = interest + penalties; // Penalties are technically revenue for Sacco
    const expenses = dividends; // Basic expense tracking
    const netIncome = revenue - expenses;

    const report = {
      report_type: 'INCOME_STATEMENT',
      period: { start: startDate, end: endDate },
      revenue: {
        interest_earned: interest,
        penalties_collected: penalties,
        total: revenue
      },
      expenses: {
        dividends_paid: dividends,
        total: expenses
      },
      net_income: netIncome,
      profit_margin: revenue > 0 ? ((netIncome / revenue) * 100).toFixed(2) + '%' : '0%'
    };

    res.json(report);
  } catch (error) {
    console.error('Income statement error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cash Flow Report
router.get('/financial/cash-flow', authenticateUser, authorizeRoles('ADMIN', 'TREASURER', 'CHAIRPERSON'), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const startDate = start_date ? new Date(start_date) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const endDate = end_date ? new Date(end_date) : new Date();

    // Operating activities
    const operatingRes = await db.query(
      `SELECT 
        SUM(CASE WHEN type IN ('DEPOSIT', 'SAVINGS', 'SHARE_CAPITAL', 'REGISTRATION_FEE') THEN amount ELSE 0 END) as money_in,
        SUM(CASE WHEN type IN ('WITHDRAWAL', 'LOAN_DISBURSEMENT') THEN amount ELSE 0 END) as money_out,
        SUM(CASE WHEN type = 'LOAN_REPAYMENT' THEN amount ELSE 0 END) as loan_repayments
       FROM transactions
       WHERE created_at BETWEEN $1 AND $2 AND status = 'COMPLETED'`,
      [startDate, endDate]
    );

    const operating = operatingRes.rows[0];
    const operatingInflow = (parseFloat(operating.money_in) || 0) + (parseFloat(operating.loan_repayments) || 0);
    const operatingOutflow = (parseFloat(operating.money_out) || 0);

    // Investing activities (dividend distributions)
    let investingOutflow = 0;
    try {
        const investingRes = await db.query(
          `SELECT COALESCE(SUM(dividend_amount), 0) as dividend_distributions
           FROM dividend_allocations
           WHERE status = 'PAID' AND payment_date BETWEEN $1 AND $2`,
          [startDate, endDate]
        );
        investingOutflow = parseFloat(investingRes.rows[0].dividend_distributions);
    } catch(e) { investingOutflow = 0; }

    const report = {
      report_type: 'CASH_FLOW',
      period: { start: startDate, end: endDate },
      operating_activities: {
        inflow: {
          deposits_and_fees: parseFloat(operating.money_in) || 0,
          loan_repayments: parseFloat(operating.loan_repayments) || 0,
          total: operatingInflow
        },
        outflow: {
          disbursements_and_withdrawals: operatingOutflow,
          total: operatingOutflow
        },
        net: operatingInflow - operatingOutflow
      },
      investing_activities: {
        outflow: {
          dividend_distributions: investingOutflow,
          total: investingOutflow
        },
        net: -investingOutflow
      },
      net_cash_flow: (operatingInflow - operatingOutflow - investingOutflow)
    };

    res.json(report);
  } catch (error) {
    console.error('Cash flow error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// 2. LOAN ANALYTICS
// ========================================

router.get('/analytics/loans', authenticateUser, authorizeRoles('ADMIN', 'TREASURER', 'CHAIRPERSON'), async (req, res) => {
  try {
    const loansRes = await db.query(
      `SELECT 
        COALESCE(COUNT(DISTINCT id) FILTER (WHERE status = 'ACTIVE'), 0) as active_loans,
        COALESCE(COUNT(DISTINCT id) FILTER (WHERE status IN ('ACTIVE', 'COMPLETED')), 0) as total_loans,
        COALESCE(SUM(total_due - amount_repaid) FILTER (WHERE status = 'ACTIVE'), 0) as total_outstanding,
        COALESCE(SUM(amount_repaid) FILTER (WHERE status = 'COMPLETED'), 0) as total_repaid,
        COALESCE(SUM(total_due) FILTER (WHERE status = 'DEFAULT'), 0) as total_defaulted,
        COALESCE(SUM(total_due) FILTER (WHERE status = 'OVERDUE'), 0) as total_overdue,
        COALESCE(AVG(amount_requested), 0) as avg_loan_amount,
        COALESCE(AVG(interest_amount), 0) as avg_interest
       FROM loan_applications
       WHERE created_at >= NOW() - INTERVAL '1 year'`
    );

    const loans = loansRes.rows[0] || {};
    const active_loans = parseInt(loans.active_loans) || 0;
    const total_loans = parseInt(loans.total_loans) || 0;
    const total_defaulted = parseInt(loans.total_defaulted) || 0;
    const total_overdue = parseInt(loans.total_overdue) || 0;

    const analytics = {
      summary: {
        active_loans: active_loans,
        total_loans: total_loans,
        total_portfolio: parseFloat(loans.total_outstanding) || 0,
        total_repaid: parseFloat(loans.total_repaid) || 0,
        total_defaulted: parseFloat(loans.total_defaulted) || 0,
        total_overdue: parseFloat(loans.total_overdue) || 0
      },
      ratios: {
        default_rate: total_loans > 0 ? ((total_defaulted / total_loans) * 100).toFixed(2) + '%' : '0%',
        overdue_rate: total_loans > 0 ? ((total_overdue / total_loans) * 100).toFixed(2) + '%' : '0%',
        repayment_rate: total_loans > 0 ? (((total_loans - total_defaulted) / total_loans) * 100).toFixed(2) + '%' : '0%'
      },
      averages: {
        average_loan: loans.avg_loan_amount ? parseFloat(loans.avg_loan_amount).toFixed(2) : 0,
        average_interest: loans.avg_interest ? parseFloat(loans.avg_interest).toFixed(2) : 0,
        average_term_days: 30
      }
    };

    res.json(analytics);
  } catch (error) {
    console.error('Loan analytics error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// 3. DEPOSIT ANALYTICS
// ========================================

router.get('/analytics/deposits', authenticateUser, authorizeRoles('ADMIN', 'TREASURER', 'CHAIRPERSON'), async (req, res) => {
  try {
    const depositsRes = await db.query(
      `SELECT 
        COALESCE(COUNT(DISTINCT user_id), 0) as total_members,
        COALESCE(COUNT(DISTINCT id), 0) as total_deposits,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(AVG(amount), 0) as avg_deposit,
        COALESCE(SUM(CASE WHEN (type = 'SHARE_CAPITAL' OR category = 'SHARE_CAPITAL') THEN amount ELSE 0 END), 0) as share_capital_total,
        COALESCE(SUM(CASE WHEN (type = 'EMERGENCY_FUND' OR category = 'EMERGENCY_FUND') THEN amount ELSE 0 END), 0) as emergency_fund_total,
        COALESCE(SUM(CASE WHEN (type = 'WELFARE' OR category = 'WELFARE') THEN amount ELSE 0 END), 0) as welfare_total
       FROM deposits
       WHERE status = 'COMPLETED' AND created_at >= NOW() - INTERVAL '1 year'`
    );

    const deposits = depositsRes.rows[0] || {};
    const total_members = parseInt(deposits.total_members) || 0;
    const total_amount = parseFloat(deposits.total_amount) || 0;

    const analytics = {
      summary: {
        total_members: total_members,
        total_deposits: parseInt(deposits.total_deposits) || 0,
        total_amount: total_amount
      },
      by_category: {
        share_capital: parseFloat(deposits.share_capital_total) || 0,
        emergency_fund: parseFloat(deposits.emergency_fund_total) || 0,
        welfare: parseFloat(deposits.welfare_total) || 0
      },
      averages: {
        average_deposit: deposits.avg_deposit ? parseFloat(deposits.avg_deposit).toFixed(2) : 0,
        average_per_member: total_members > 0 
          ? (total_amount / total_members).toFixed(2) 
          : 0
      }
    };

    res.json(analytics);
  } catch (error) {
    console.error('Deposit analytics error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// 4. MEMBER PERFORMANCE REPORT
// ========================================

router.get('/member-performance', authenticateUser, authorizeRoles('ADMIN', 'TREASURER', 'CHAIRPERSON'), async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const result = await db.query(
      `SELECT 
        u.id, u.full_name, u.email, u.phone_number,
        COUNT(DISTINCT d.id) as total_deposits,
        COALESCE(SUM(d.amount) FILTER (WHERE d.status = 'COMPLETED'), 0) as total_deposit_amount,
        COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'ACTIVE') as active_loans,
        COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'COMPLETED') as completed_loans,
        COALESCE(SUM(l.total_due) FILTER (WHERE l.status = 'DEFAULT'), 0) as defaulted_amount,
        CASE 
          WHEN (SELECT COUNT(*) FROM loan_applications WHERE user_id = u.id AND status = 'DEFAULT') > 0 THEN 'DEFAULTED'
          WHEN (SELECT SUM(total_due - amount_repaid) FROM loan_applications WHERE user_id = u.id AND status = 'OVERDUE') > 0 THEN 'OVERDUE'
          WHEN (SELECT COUNT(*) FROM deposits WHERE user_id = u.id AND status = 'COMPLETED') > 0 THEN 'ACTIVE'
          ELSE 'INACTIVE'
        END as account_status
       FROM users u
       LEFT JOIN deposits d ON u.id = d.user_id
       LEFT JOIN loan_applications l ON u.id = l.user_id
       WHERE u.role = 'MEMBER'
       GROUP BY u.id, u.full_name, u.email, u.phone_number
       ORDER BY total_deposit_amount DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Member performance error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// 5. TRANSACTION SUMMARY (Daily/Monthly)
// ========================================

router.get('/transaction-summary', authenticateUser, authorizeRoles('ADMIN', 'TREASURER', 'CHAIRPERSON'), async (req, res) => {
  try {
    const { period = 'daily', start_date, end_date } = req.query; // daily, weekly, monthly
    const startDate = start_date ? new Date(start_date) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const endDate = end_date ? new Date(end_date) : new Date();

    let groupBy = "DATE_TRUNC('day', created_at)"; // Default daily
    if (period === 'weekly') groupBy = "DATE_TRUNC('week', created_at)";
    if (period === 'monthly') groupBy = "DATE_TRUNC('month', created_at)";

    const result = await db.query(
      `SELECT 
        ${groupBy} as period,
        SUM(CASE WHEN type IN ('DEPOSIT','LOAN_REPAYMENT','SHARE_CAPITAL') THEN amount ELSE 0 END) as inflow,
        SUM(CASE WHEN type IN ('WITHDRAWAL','LOAN_DISBURSEMENT') THEN amount ELSE 0 END) as outflow,
        COUNT(DISTINCT id) as transaction_count,
        COUNT(DISTINCT user_id) as unique_members,
        COUNT(DISTINCT CASE WHEN type IN ('DEPOSIT','LOAN_REPAYMENT') THEN user_id END) as depositors,
        COUNT(DISTINCT CASE WHEN type IN ('WITHDRAWAL','LOAN_DISBURSEMENT') THEN user_id END) as withdrawers
       FROM transactions
       WHERE status = 'COMPLETED' AND created_at BETWEEN $1 AND $2
       GROUP BY ${groupBy}
       ORDER BY period DESC`,
      [startDate, endDate]
    );

    res.json({
      period_type: period,
      date_range: { start: startDate, end: endDate },
      summary: result.rows.map(row => ({
        period: row.period,
        inflow: row.inflow || 0,
        outflow: row.outflow || 0,
        net_flow: (row.inflow || 0) - (row.outflow || 0),
        transaction_count: row.transaction_count,
        unique_members: row.unique_members,
        depositors: row.depositors,
        withdrawers: row.withdrawers
      }))
    });
  } catch (error) {
    console.error('Transaction summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// 6. EXPORT REPORTS (PDF, CSV)
// ========================================

router.get('/export/:report_type', authenticateUser, authorizeRoles('ADMIN', 'TREASURER', 'CHAIRPERSON'), async (req, res) => {
  try {
    const { report_type } = req.params;
    const { format = 'json' } = req.query;

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${report_type}_${new Date().toISOString()}.csv"`);
      res.send("Date,Item,Amount\n2023-01-01,Sample,0"); 
    } else {
      res.status(501).json({ error: 'Export implemented on frontend' });
    }
  } catch (error) {
    console.error('Export report error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;