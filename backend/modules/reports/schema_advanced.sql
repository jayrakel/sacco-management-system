-- Advanced Reporting Schema

-- Financial reports cache (for performance)
CREATE TABLE IF NOT EXISTS financial_reports (
    id SERIAL PRIMARY KEY,
    report_type VARCHAR(50), -- BALANCE_SHEET, INCOME_STATEMENT, CASH_FLOW
    report_date DATE NOT NULL,
    period_start DATE,
    period_end DATE,
    report_data JSONB, -- Store report structure as JSON
    generated_by INTEGER REFERENCES users(id),
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Member performance metrics
CREATE TABLE IF NOT EXISTS member_performance (
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES users(id),
    report_month DATE, -- First day of month
    total_deposits NUMERIC(15, 2),
    total_loans NUMERIC(15, 2),
    total_loan_repayments NUMERIC(15, 2),
    loan_default_amount NUMERIC(15, 2),
    average_balance NUMERIC(15, 2),
    account_status VARCHAR(20), -- ACTIVE, INACTIVE, DORMANT, DEFAULTED
    score NUMERIC(5, 2), -- Member score 0-100
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Loan analytics
CREATE TABLE IF NOT EXISTS loan_analytics (
    id SERIAL PRIMARY KEY,
    report_date DATE DEFAULT CURRENT_DATE,
    total_active_loans INTEGER,
    total_loan_portfolio NUMERIC(15, 2),
    total_repaid NUMERIC(15, 2),
    total_outstanding NUMERIC(15, 2),
    total_defaulted NUMERIC(15, 2),
    total_overdue NUMERIC(15, 2),
    default_rate NUMERIC(5, 2),
    repayment_rate NUMERIC(5, 2),
    average_interest_earned NUMERIC(15, 2),
    avg_loan_amount NUMERIC(15, 2),
    avg_loan_term_days INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Deposit analytics
CREATE TABLE IF NOT EXISTS deposit_analytics (
    id SERIAL PRIMARY KEY,
    report_date DATE DEFAULT CURRENT_DATE,
    total_members INTEGER,
    total_deposits NUMERIC(15, 2),
    total_share_capital NUMERIC(15, 2),
    total_emergency_fund NUMERIC(15, 2),
    total_welfare_fund NUMERIC(15, 2),
    average_member_balance NUMERIC(15, 2),
    liquidity_ratio NUMERIC(5, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Daily transaction summary
CREATE TABLE IF NOT EXISTS transaction_summary (
    id SERIAL PRIMARY KEY,
    summary_date DATE NOT NULL,
    inflow_amount NUMERIC(15, 2), -- Total deposits
    outflow_amount NUMERIC(15, 2), -- Total withdrawals/loans
    net_flow NUMERIC(15, 2),
    transaction_count INTEGER,
    unique_members INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_financial_reports_date ON financial_reports(report_date);
CREATE INDEX idx_financial_reports_type ON financial_reports(report_type);
CREATE INDEX idx_member_performance_member ON member_performance(member_id);
CREATE INDEX idx_member_performance_month ON member_performance(report_month);
CREATE INDEX idx_loan_analytics_date ON loan_analytics(report_date);
CREATE INDEX idx_deposit_analytics_date ON deposit_analytics(report_date);
CREATE INDEX idx_transaction_summary_date ON transaction_summary(summary_date);
