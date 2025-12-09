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
    const { date } = req.query; // Optional specific date
    const reportDate = date ? new Date(date) : new Date();

    // Assets
    const assetsRes = await db.query(
      `SELECT 
        SUM(CASE WHEN category = 'SHARE_CAPITAL' THEN amount ELSE 0 END) as share_capital,
        SUM(CASE WHEN category IN ('DEPOSIT', 'SAVINGS') THEN amount ELSE 0 END) as member_savings,
        SUM(CASE WHEN type = 'LOAN' AND status = 'ACTIVE' THEN amount ELSE 0 END) as loans_outstanding,
        (SELECT COALESCE(SUM(amount), 0) FROM deposits WHERE category = 'EMERGENCY_FUND') as emergency_fund
       FROM deposits
       WHERE created_at <= $1 AND status = 'COMPLETED'`,
      [reportDate]
    );

    const assets = assetsRes.rows[0];
    const totalAssets = Object.values(assets).reduce((sum, val) => sum + (val ? parseFloat(val) : 0), 0);

    // Liabilities
    const liabilitiesRes = await db.query(
      `SELECT 
        SUM(CASE WHEN status IN ('ACTIVE', 'PENDING') THEN amount ELSE 0 END) as member_liabilities,
        COUNT(DISTINCT member_id) as member_count
       FROM loans
       WHERE created_at <= $1 AND status IN ('ACTIVE', 'PENDING')`,
      [reportDate]
    );

    const liabilities = liabilitiesRes.rows[0];
    const totalLiabilities = (liabilities.member_liabilities ? parseFloat(liabilities.member_liabilities) : 0);

    // Equity
    const equity = totalAssets - totalLiabilities;

    const report = {
      report_type: 'BALANCE_SHEET',
      report_date: reportDate,
      assets: {
        share_capital: assets.share_capital || 0,
        member_savings: assets.member_savings || 0,
        loans_outstanding: assets.loans_outstanding || 0,
        emergency_fund: assets.emergency_fund || 0,
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
      `SELECT COALESCE(SUM(interest_earned), 0) as total_interest
       FROM loans
       WHERE created_at BETWEEN $1 AND $2 AND status IN ('ACTIVE', 'COMPLETED')`,
      [startDate, endDate]
    );

    // Expenses (penalties, operational costs)
    const penaltiesRes = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as total_penalties
       FROM transactions
       WHERE type = 'DEBIT' AND category = 'PENALTY' AND created_at BETWEEN $1 AND $2`,
      [startDate, endDate]
    );

    // Dividends paid
    const dividendsRes = await db.query(
      `SELECT COALESCE(SUM(dividend_amount), 0) as total_dividends_paid
       FROM dividend_allocations
       WHERE status = 'PAID' AND payment_date BETWEEN $1 AND $2`,
      [startDate, endDate]
    );

    const interest = parseFloat(interestRes.rows[0].total_interest);
    const penalties = parseFloat(penaltiesRes.rows[0].total_penalties);
    const dividends = parseFloat(dividendsRes.rows[0].total_dividends_paid);

    const revenue = interest;
    const expenses = penalties + dividends;
    const netIncome = revenue - expenses;

    const report = {
      report_type: 'INCOME_STATEMENT',
      period: { start: startDate, end: endDate },
      revenue: {
        interest_earned: interest,
        total: revenue
      },
      expenses: {
        penalties: penalties,
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
        SUM(CASE WHEN type = 'CREDIT' AND category IN ('DEPOSIT', 'SAVINGS', 'SHARE_CAPITAL') THEN amount ELSE 0 END) as member_deposits,
        SUM(CASE WHEN type = 'DEBIT' AND category = 'WITHDRAWAL' THEN amount ELSE 0 END) as withdrawals,
        SUM(CASE WHEN type = 'CREDIT' AND category = 'LOAN_REPAYMENT' THEN amount ELSE 0 END) as loan_repayments,
        SUM(CASE WHEN type = 'DEBIT' AND category = 'LOAN_DISBURSEMENT' THEN amount ELSE 0 END) as loan_disbursements
       FROM transactions
       WHERE created_at BETWEEN $1 AND $2 AND status = 'COMPLETED'`,
      [startDate, endDate]
    );

    const operating = operatingRes.rows[0];
    const operatingInflow = (operating.member_deposits ? parseFloat(operating.member_deposits) : 0) + 
                           (operating.loan_repayments ? parseFloat(operating.loan_repayments) : 0);
    const operatingOutflow = (operating.withdrawals ? parseFloat(operating.withdrawals) : 0) + 
                            (operating.loan_disbursements ? parseFloat(operating.loan_disbursements) : 0);

    // Investing activities (dividend distributions)
    const investingRes = await db.query(
      `SELECT COALESCE(SUM(dividend_amount), 0) as dividend_distributions
       FROM dividend_allocations
       WHERE status = 'PAID' AND payment_date BETWEEN $1 AND $2`,
      [startDate, endDate]
    );

    const investingOutflow = parseFloat(investingRes.rows[0].dividend_distributions);

    const report = {
      report_type: 'CASH_FLOW',
      period: { start: startDate, end: endDate },
      operating_activities: {
        inflow: {
          member_deposits: operating.member_deposits || 0,
          loan_repayments: operating.loan_repayments || 0,
          total: operatingInflow
        },
        outflow: {
          withdrawals: operating.withdrawals || 0,
          loan_disbursements: operating.loan_disbursements || 0,
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
        COUNT(DISTINCT id) FILTER (WHERE status = 'ACTIVE') as active_loans,
        COUNT(DISTINCT id) FILTER (WHERE status IN ('ACTIVE', 'COMPLETED')) as total_loans,
        SUM(amount) FILTER (WHERE status = 'ACTIVE') as total_outstanding,
        SUM(amount) FILTER (WHERE status = 'COMPLETED') as total_repaid,
        SUM(amount) FILTER (WHERE status = 'DEFAULT') as total_defaulted,
        SUM(amount) FILTER (WHERE status = 'OVERDUE') as total_overdue,
        AVG(amount) as avg_loan_amount,
        AVG(interest_earned) as avg_interest,
        AVG(EXTRACT(DAY FROM (expected_repayment_date - application_date))) as avg_term_days
       FROM loans
       WHERE created_at >= NOW() - INTERVAL '1 year'`
    );

    const loans = loansRes.rows[0];
    const totalLoans = parseInt(loans.total_loans) || 0;
    const defaultedLoans = parseInt(loans.total_defaulted) || 0;
    const overdueLoans = parseInt(loans.total_overdue) || 0;

    const analytics = {
      summary: {
        active_loans: loans.active_loans,
        total_loans: loans.total_loans,
        total_portfolio: loans.total_outstanding || 0,
        total_repaid: loans.total_repaid || 0,
        total_defaulted: loans.total_defaulted || 0,
        total_overdue: loans.total_overdue || 0
      },
      ratios: {
        default_rate: totalLoans > 0 ? ((defaultedLoans / totalLoans) * 100).toFixed(2) + '%' : '0%',
        overdue_rate: totalLoans > 0 ? ((overdueLoans / totalLoans) * 100).toFixed(2) + '%' : '0%',
        repayment_rate: totalLoans > 0 ? (((totalLoans - defaultedLoans) / totalLoans) * 100).toFixed(2) + '%' : '0%'
      },
      averages: {
        average_loan: loans.avg_loan_amount ? parseFloat(loans.avg_loan_amount).toFixed(2) : 0,
        average_interest: loans.avg_interest ? parseFloat(loans.avg_interest).toFixed(2) : 0,
        average_term_days: loans.avg_term_days ? Math.round(loans.avg_term_days) : 0
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
        COUNT(DISTINCT member_id) as total_members,
        COUNT(DISTINCT id) as total_deposits,
        SUM(amount) as total_amount,
        AVG(amount) as avg_deposit,
        SUM(CASE WHEN category = 'SHARE_CAPITAL' THEN amount ELSE 0 END) as share_capital_total,
        SUM(CASE WHEN category = 'EMERGENCY_FUND' THEN amount ELSE 0 END) as emergency_fund_total,
        SUM(CASE WHEN category = 'WELFARE' THEN amount ELSE 0 END) as welfare_total
       FROM deposits
       WHERE status = 'COMPLETED' AND created_at >= NOW() - INTERVAL '1 year'`
    );

    const deposits = depositsRes.rows[0];

    const analytics = {
      summary: {
        total_members: deposits.total_members,
        total_deposits: deposits.total_deposits,
        total_amount: deposits.total_amount || 0
      },
      by_category: {
        share_capital: deposits.share_capital_total || 0,
        emergency_fund: deposits.emergency_fund_total || 0,
        welfare: deposits.welfare_total || 0
      },
      averages: {
        average_deposit: deposits.avg_deposit ? parseFloat(deposits.avg_deposit).toFixed(2) : 0,
        average_per_member: deposits.total_members > 0 
          ? (parseFloat(deposits.total_amount) / deposits.total_members).toFixed(2) 
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
        u.id, u.full_name, u.email, u.phone,
        COUNT(DISTINCT d.id) FILTER (WHERE d.type = 'CREDIT') as total_deposits,
        SUM(d.amount) FILTER (WHERE d.type = 'CREDIT' AND d.status = 'COMPLETED') as total_deposit_amount,
        COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'ACTIVE') as active_loans,
        COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'COMPLETED') as completed_loans,
        SUM(l.amount) FILTER (WHERE l.status = 'DEFAULT') as defaulted_amount,
        COUNT(DISTINCT t.id) FILTER (WHERE t.type = 'CREDIT' AND t.category = 'LOAN_REPAYMENT') as repayments,
        SUM(t.amount) FILTER (WHERE t.type = 'CREDIT' AND t.category = 'LOAN_REPAYMENT' AND t.status = 'COMPLETED') as total_repaid,
        CASE 
          WHEN (SELECT COUNT(*) FROM loans WHERE member_id = u.id AND status = 'DEFAULT') > 0 THEN 'DEFAULTED'
          WHEN (SELECT SUM(amount) FROM loans WHERE member_id = u.id AND status = 'OVERDUE') > 0 THEN 'OVERDUE'
          WHEN (SELECT COUNT(*) FROM deposits WHERE member_id = u.id AND status = 'COMPLETED') > 0 THEN 'ACTIVE'
          ELSE 'INACTIVE'
        END as account_status
       FROM users u
       LEFT JOIN deposits d ON u.id = d.member_id
       LEFT JOIN loans l ON u.id = l.member_id
       LEFT JOIN transactions t ON u.id = t.member_id
       WHERE u.role = 'MEMBER'
       GROUP BY u.id, u.full_name, u.email, u.phone
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
        SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE 0 END) as inflow,
        SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE 0 END) as outflow,
        COUNT(DISTINCT id) as transaction_count,
        COUNT(DISTINCT member_id) as unique_members,
        COUNT(DISTINCT CASE WHEN type = 'CREDIT' THEN member_id END) as depositors,
        COUNT(DISTINCT CASE WHEN type = 'DEBIT' THEN member_id END) as withdrawers
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
    const { format = 'json', start_date, end_date } = req.query; // json, csv, pdf

    let data = {};

    // Get report data based on type
    if (report_type === 'balance-sheet') {
      const result = await fetch(req.protocol + '://' + req.host + `/api/reports/financial/balance-sheet`);
      data = await result.json();
    } else if (report_type === 'income-statement') {
      const params = new URLSearchParams({ start_date, end_date }).toString();
      const result = await fetch(req.protocol + '://' + req.host + `/api/reports/financial/income-statement?${params}`);
      data = await result.json();
    } else if (report_type === 'loans') {
      const result = await fetch(req.protocol + '://' + req.host + `/api/reports/analytics/loans`);
      data = await result.json();
    }

    if (format === 'csv') {
      // Convert to CSV
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${report_type}_${new Date().toISOString()}.csv"`);
      
      // Simple CSV conversion
      const csv = JSON.stringify(data, null, 2); // Simplified - should use proper CSV lib
      res.send(csv);
    } else if (format === 'pdf') {
      // Would require PDF library (pdfkit, etc)
      res.status(501).json({ error: 'PDF export not yet implemented' });
    } else {
      res.json(data);
    }
  } catch (error) {
    console.error('Export report error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
