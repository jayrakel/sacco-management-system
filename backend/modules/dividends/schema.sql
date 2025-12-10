-- Dividend Management Schema

-- Dividend declaration (when SACCO decides to distribute dividends)
CREATE TABLE IF NOT EXISTS dividends (
    id SERIAL PRIMARY KEY,
    financial_year INTEGER NOT NULL,
    declaration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approval_date TIMESTAMP,
    dividend_rate NUMERIC(10, 2) NOT NULL, -- Percentage or fixed amount
    total_amount NUMERIC(15, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, APPROVED, PROCESSING, COMPLETED, CANCELLED
    declared_by INTEGER REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id),
    description TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dividend allocation per member
CREATE TABLE IF NOT EXISTS dividend_allocations (
    id SERIAL PRIMARY KEY,
    dividend_id INTEGER NOT NULL REFERENCES dividends(id) ON DELETE CASCADE,
    member_id INTEGER NOT NULL REFERENCES users(id),
    share_value NUMERIC(15, 2), -- Member's share capital at calculation date
    dividend_amount NUMERIC(15, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, APPROVED, PAID, FAILED, REVERSED
    payment_method VARCHAR(50), -- MPESA, BANK, CASH, INTERNAL
    transaction_id INTEGER REFERENCES transactions(id),
    payment_date TIMESTAMP,
    reference_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dividend calculation history (audit trail)
CREATE TABLE IF NOT EXISTS dividend_calculations (
    id SERIAL PRIMARY KEY,
    dividend_id INTEGER NOT NULL REFERENCES dividends(id) ON DELETE CASCADE,
    calculation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_members INTEGER,
    total_share_capital NUMERIC(15, 2),
    dividend_rate NUMERIC(10, 2),
    total_dividend_amount NUMERIC(15, 2),
    calculation_method VARCHAR(50), -- SHARE_BASED, FIXED, HYBRID
    calculated_by INTEGER REFERENCES users(id),
    notes TEXT
);

-- Dividend payment log (for tracking M-Pesa/bank transfers)
CREATE TABLE IF NOT EXISTS dividend_payments (
    id SERIAL PRIMARY KEY,
    allocation_id INTEGER NOT NULL REFERENCES dividend_allocations(id) ON DELETE CASCADE,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    amount NUMERIC(15, 2),
    payment_method VARCHAR(50),
    status VARCHAR(20), -- SUCCESS, PENDING, FAILED, RETRY
    external_reference VARCHAR(100), -- M-Pesa receipt, bank reference
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    last_retry TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_dividends_financial_year ON dividends(financial_year);
CREATE INDEX idx_dividends_status ON dividends(status);
CREATE INDEX idx_dividend_allocations_member ON dividend_allocations(member_id);
CREATE INDEX idx_dividend_allocations_status ON dividend_allocations(status);
CREATE INDEX idx_dividend_allocations_dividend ON dividend_allocations(dividend_id);
CREATE INDEX idx_dividend_payments_allocation ON dividend_payments(allocation_id);
